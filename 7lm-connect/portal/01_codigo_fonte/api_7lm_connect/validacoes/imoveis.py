"""
Validacoes e normalizacoes do modulo de imóveis.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Iterable, Optional

from fastapi import HTTPException


EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".webp"}
EXTENSOES_VIDEO = {".mp4", ".mov", ".webm"}
EXTENSOES_PLANILHA_IMPORTACAO = {".xlsx", ".xlsm"}
MIME_IMAGEM = {"image/jpeg", "image/png", "image/webp"}
MIME_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}
MESES_PRE_ENTREGA_DINAMICA_PADRAO = 20
DATA_ENTREGA_DINAMICA_PADRAO = date(2027, 12, 15)
PERCENTUAL_FECHAMENTO_MINIMO_PADRAO = Decimal("0.70")
VALOR_DESCONTO_MINIMO_PADRAO = Decimal("0.00")
VALOR_DESCONTO_MAXIMO_PADRAO = Decimal("50000.00")
TIPOS_GARAGEM_VALIDOS = {
    "carro": "carro",
    "automovel": "carro",
    "veículo": "carro",
    "moto": "moto",
    "motocicleta": "moto",
}


def _primeiro_valor_preenchido(*valores: Any) -> Any:
    for valor in valores:
        if valor not in (None, ""):
            return valor
    return None


def _valor_chave(payload: dict[str, Any], *chaves: str) -> Any:
    for chave in chaves:
        if chave in payload:
            return payload.get(chave)
    return None

MAPA_COLUNAS_IMPORTACAO = {
    "titulo": ("titulo", "título"),
    "descrição": ("descrição", "descrição"),
    "tipo_imovel": ("tipo imóvel", "tipo do imóvel", "tipo"),
    "endereço": ("endereço", "endereço"),
    "cidade": ("cidade",),
    "bairro": ("bairro",),
    "estado": ("estado", "uf"),
    "cep": ("cep",),
    "valor": ("valor", "preco", "preço", "vgv"),
    "quartos": ("quartos", "dorm", "dormitorio", "dormitorios"),
    "banheiros": ("banheiros", "banheiro"),
    "vagas_garagem": ("vagas garagem", "vagas de garagem", "vagas", "garagem"),
    "tipo_garagem": ("tipo garagem", "tipo de garagem", "garagem tipo", "vaga tipo", "tipo da vaga"),
    "area_m2": ("área m2", "área m2", "área", "área", "ap real coluna 23", "ap real", "área total construida m2"),
    "data_entrega": ("data entrega", "data da entrega", "previsao entrega", "previsao de entrega", "data conclusão", "data conclusão"),
    "meses_pre_entrega": ("meses até entrega", "meses pre entrega", "prazo entrega", "entrega em meses"),
    "meses_pos_entrega": ("meses pos entrega", "meses pos-entrega", "prazo pos entrega", "parcelamento pos entrega"),
    "percentual_conclusao_obra": ("percentual conclusão obra", "% conclusão obra", "conclusão obra", "obra %", "evolucao obra"),
    "percentual_fechamento_minimo": ("percentual fechamento mínimo", "fechamento mínimo", "captação mínima", "captação mínima fechamento"),
    "valor_garantido": ("valor garantido", "garantido", "valor mínimo fechamento", "valor mínimo para fechar"),
    "valor_garantido_pre_obra_planejado": (
        "garantido pre obra planejado",
        "garantido + pre obra planejado",
        "garantido pre obra",
        "garantido pre",
        "garantido pré",
        "captação até entrega planejada",
        "valor captação até entrega",
    ),
    "percentual_captacao_ate_entrega": (
        "percentual captação até entrega",
        "% captação até entrega",
        "captação até entrega %",
        "percentual entrega planejado",
    ),
    "valor_parcela_minima_pre_obra": ("valor parcela mínima pre obra", "parcela mínima pre obra", "pre obra mínima", "mínimo pre obra", "parcela pre obra"),
    "valor_desconto_minimo": (
        "valor incentivo 7lm minimo",
        "valor incentivo minimo",
        "incentivo minimo",
        "incentivo piso",
        "valor desconto minimo",
        "valor desconto minimo",
        "desconto minimo",
        "desconto piso",
    ),
    "valor_desconto_maximo": (
        "valor incentivo 7lm maximo",
        "valor incentivo maximo",
        "incentivo maximo",
        "incentivo teto",
        "valor desconto maximo",
        "valor desconto maximo",
        "desconto maximo",
        "desconto teto",
    ),
    "status": ("status",),
    "localidade": ("localidade",),
    "suite": ("suite", "suíte", "suites", "suítes"),
    "unidade_autonoma": ("unidade autonoma", "unidade autônoma", "unidade"),
    "pavimento": ("pavimento",),
    "ap_real": ("ap real coluna 23", "ap real"),
    "ap_equivalente": ("ap equivalente coluna 24 30", "ap equivalente"),
    "area_total_construida": ("área total construida m2", "área total construída m2", "área total construida"),
    "vaga_vinculada": ("vaga vinculada",),
    "bloco": ("bloco",),
    "orientacao": ("orientacao", "orientação"),
    "posicao": ("posicao", "posição"),
}


def normalizar_texto(valor: Optional[str]) -> str:
    return str(valor or "").strip()


def _normalizar_texto_opcional(valor: Optional[str], maximo: int) -> Optional[str]:
    texto = normalizar_texto(valor)
    if not texto:
        return None
    if len(texto) > maximo:
        raise HTTPException(status_code=400, detail=f"O valor informado excede {maximo} caracteres.")
    return texto


def normalizar_titulo(valor: Optional[str]) -> str:
    texto = normalizar_texto(valor)
    if len(texto) < 3:
        raise HTTPException(status_code=400, detail="Informe o titulo do imóvel.")
    if len(texto) > 160:
        raise HTTPException(status_code=400, detail="O titulo do imóvel excede 160 caracteres.")
    return texto


def normalizar_descricao(valor: Optional[str]) -> Optional[str]:
    return _normalizar_texto_opcional(valor, 4000)


def normalizar_tipo_imovel(valor: Optional[str]) -> Optional[str]:
    return _normalizar_texto_opcional(valor, 80)


def normalizar_endereco(valor: Optional[str]) -> Optional[str]:
    return _normalizar_texto_opcional(valor, 255)


def normalizar_tipo_garagem(valor: Any) -> str:
    texto = normalizar_texto(valor)
    if not texto:
        return "carro"

    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(caractere for caractere in texto if not unicodedata.combining(caractere))
    texto = texto.lower().replace("-", " ")
    texto = re.sub(r"\s+", " ", texto).strip()

    tipo = TIPOS_GARAGEM_VALIDOS.get(texto)
    if tipo:
        return tipo

    raise HTTPException(status_code=400, detail="O tipo de garagem deve ser carro ou moto.")


def normalizar_cidade(valor: Optional[str]) -> str:
    texto = normalizar_texto(valor)
    if len(texto) < 2:
        raise HTTPException(status_code=400, detail="Informe a cidade do imóvel.")
    if len(texto) > 120:
        raise HTTPException(status_code=400, detail="A cidade excede 120 caracteres.")
    return texto


def normalizar_bairro(valor: Optional[str]) -> str:
    texto = normalizar_texto(valor)
    if len(texto) < 2:
        raise HTTPException(status_code=400, detail="Informe o bairro do imóvel.")
    if len(texto) > 120:
        raise HTTPException(status_code=400, detail="O bairro excede 120 caracteres.")
    return texto


def normalizar_estado(valor: Optional[str]) -> Optional[str]:
    texto = _normalizar_texto_opcional(valor, 40)
    return texto.upper() if texto else None


def normalizar_cep(valor: Optional[str]) -> Optional[str]:
    texto = _normalizar_texto_opcional(valor, 20)
    if not texto:
        return None
    return re.sub(r"\s+", "", texto)


def normalizar_status(valor: Optional[str]) -> str:
    texto = normalizar_texto(valor)
    if len(texto) < 2:
        raise HTTPException(status_code=400, detail="Informe o status do imóvel.")
    if len(texto) > 60:
        raise HTTPException(status_code=400, detail="O status excede 60 caracteres.")
    return texto


def normalizar_decimal(valor: Any, campo: str, casas: str = "0.01") -> Optional[Decimal]:
    if valor is None or valor == "":
        return None

    if isinstance(valor, Decimal):
        numero = valor
    else:
        texto = str(valor).strip()
        if not texto:
            return None

        if "," in texto and "." in texto:
            if texto.rfind(",") > texto.rfind("."):
                texto = texto.replace(".", "").replace(",", ".")
            else:
                texto = texto.replace(",", "")
        elif "," in texto:
            texto = texto.replace(".", "").replace(",", ".")

        try:
            numero = Decimal(texto)
        except InvalidOperation as erro:
            raise HTTPException(status_code=400, detail=f"O campo {campo} deve ser numerico.") from erro

    if numero < 0:
        raise HTTPException(status_code=400, detail=f"O campo {campo} não pode ser negativo.")

    return numero.quantize(Decimal(casas), rounding=ROUND_HALF_UP)


def normalizar_inteiro(valor: Any, campo: str) -> Optional[int]:
    if valor is None or valor == "":
        return None

    try:
        numero = int(valor)
    except Exception as erro:
        raise HTTPException(status_code=400, detail=f"O campo {campo} deve ser numerico.") from erro

    if numero < 0:
        raise HTTPException(status_code=400, detail=f"O campo {campo} não pode ser negativo.")

    return numero


def normalizar_inteiro_intervalo(valor: Any, campo: str, minimo: int, maximo: int, padrao: int) -> int:
    numero = normalizar_inteiro(padrao if valor in (None, "") else valor, campo)
    if numero is None:
        numero = padrao
    if numero < minimo or numero > maximo:
        raise HTTPException(status_code=400, detail=f"O campo {campo} deve ficar entre {mínimo} e {maximo}.")
    return numero


def normalizar_decimal_intervalo(valor: Any, campo: str, minimo: Decimal, maximo: Decimal, padrao: Decimal) -> Decimal:
    numero = normalizar_decimal(padrao if valor in (None, "") else valor, campo)
    if numero is None:
        numero = padrao
    if numero < minimo or numero > maximo:
        raise HTTPException(status_code=400, detail=f"O campo {campo} deve ficar entre {mínimo} e {maximo}.")
    return numero


def normalizar_percentual_comercial(
    valor: Any,
    campo: str,
    *,
    minimo: Decimal,
    maximo: Decimal,
    padrao: Decimal,
) -> Decimal:
    numero = normalizar_decimal(padrao if valor in (None, "") else valor, campo, casas="0.0001")
    if numero is None:
        numero = padrao
    if numero > Decimal("1"):
        numero = (numero / Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if numero < minimo or numero > maximo:
        minimo_percentual = (minimo * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        maximo_percentual = (maximo * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        raise HTTPException(
            status_code=400,
            detail=f"O campo {campo} deve ficar entre {minimo_percentual}% e {maximo_percentual}%.",
        )
    return numero


def calcular_valor_garantido_padrao(
    valor_imovel: Any,
    percentual_fechamento_minimo: Any = PERCENTUAL_FECHAMENTO_MINIMO_PADRAO,
) -> Decimal | None:
    valor = normalizar_decimal(valor_imovel, "valor")
    if valor is None or valor <= 0:
        return None

    percentual = normalizar_percentual_comercial(
        percentual_fechamento_minimo,
        "percentual mínimo de fechamento",
        minimo=Decimal("0.01"),
        maximo=Decimal("1"),
        padrao=PERCENTUAL_FECHAMENTO_MINIMO_PADRAO,
    )
    return (valor * percentual).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_percentual_fechamento_por_valor_garantido(
    valor_imovel: Any,
    valor_garantido: Any,
    percentual_padrao: Decimal = PERCENTUAL_FECHAMENTO_MINIMO_PADRAO,
) -> Decimal:
    valor = normalizar_decimal(valor_imovel, "valor")
    garantido = normalizar_decimal(valor_garantido, "valor garantido")

    if valor is None or valor <= 0 or garantido is None or garantido <= 0:
        return percentual_padrao

    percentual = (garantido / valor).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if percentual < Decimal("0.01") or percentual > Decimal("1"):
        raise HTTPException(
            status_code=400,
            detail="O valor garantido deve ficar entre 1% e 100% do valor do imóvel.",
        )
    return percentual


def calcular_valor_captacao_ate_entrega_planejado(
    valor_imovel: Any,
    percentual_captacao_ate_entrega: Any,
) -> Decimal | None:
    valor = normalizar_decimal(valor_imovel, "valor")
    if valor is None or valor <= 0 or percentual_captacao_ate_entrega in (None, ""):
        return None

    percentual = normalizar_percentual_comercial(
        percentual_captacao_ate_entrega,
        "percentual de captação até entrega",
        minimo=Decimal("0.01"),
        maximo=Decimal("1"),
        padrao=Decimal("1"),
    )
    return (valor * percentual).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calcular_percentual_captacao_ate_entrega_por_valor(
    valor_imovel: Any,
    valor_captacao_ate_entrega: Any,
) -> Decimal | None:
    valor = normalizar_decimal(valor_imovel, "valor")
    captacao = normalizar_decimal(
        valor_captacao_ate_entrega,
        "valor garantido + pré-obra planejado",
    )

    if valor is None or valor <= 0 or captacao is None or captacao <= 0:
        return None

    percentual = (captacao / valor).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if percentual < Decimal("0.01") or percentual > Decimal("1"):
        raise HTTPException(
            status_code=400,
            detail="O valor garantido + pré-obra planejado deve ficar entre 1% e 100% do valor do imóvel.",
        )
    return percentual


def normalizar_data(valor: Any, campo: str) -> date | None:
    if valor is None or valor == "":
        return None

    if isinstance(valor, datetime):
        return valor.date()

    if isinstance(valor, date):
        return valor

    texto = str(valor).strip()
    if not texto:
        return None

    formatos = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")
    for formato in formatos:
        try:
            return datetime.strptime(texto[:10], formato).date()
        except ValueError:
            continue

    raise HTTPException(status_code=400, detail=f"O campo {campo} deve ser uma data válida.")


def calcular_meses_ate_entrega(data_entrega: Any, referência: date | None = None) -> int | None:
    entrega = normalizar_data(data_entrega, "data de entrega")
    if not entrega:
        return None

    hoje = referência or date.today()
    meses = (entrega.year - hoje.year) * 12 + (entrega.month - hoje.month)
    if entrega.day > hoje.day:
        meses += 1

    return max(1, min(240, meses))


def calcular_data_entrega_dinamica(
    referência: date | None = None,
    meses_base: int = MESES_PRE_ENTREGA_DINAMICA_PADRAO,
) -> date:
    return DATA_ENTREGA_DINAMICA_PADRAO


def calcular_meses_ate_entrega_dinamica(
    referência: date | None = None,
    meses_base: int = MESES_PRE_ENTREGA_DINAMICA_PADRAO,
) -> int:
    hoje = referência or date.today()
    entrega = calcular_data_entrega_dinamica(hoje, meses_base=meses_base)
    return int(
        calcular_meses_ate_entrega(entrega, referência=hoje)
        or max(1, int(meses_base or MESES_PRE_ENTREGA_DINAMICA_PADRAO))
    )


def normalizar_payload_imovel(payload: dict[str, Any]) -> dict[str, Any]:
    data_entrega = normalizar_data(payload.get("data_entrega"), "data de entrega")
    valor = normalizar_decimal(payload.get("valor"), "valor")
    percentual_fechamento_minimo = normalizar_percentual_comercial(
        payload.get("percentual_fechamento_minimo"),
        "percentual mínimo de fechamento",
        minimo=Decimal("0.01"),
        maximo=Decimal("1"),
        padrao=PERCENTUAL_FECHAMENTO_MINIMO_PADRAO,
    )
    valor_garantido = normalizar_decimal(payload.get("valor_garantido"), "valor garantido")
    valor_garantido_pre_obra_planejado = normalizar_decimal(
        payload.get("valor_garantido_pre_obra_planejado"),
        "valor garantido + pré-obra planejado",
    )
    percentual_captacao_ate_entrega = None
    if payload.get("percentual_captacao_ate_entrega") not in (None, ""):
        percentual_captacao_ate_entrega = normalizar_percentual_comercial(
            payload.get("percentual_captacao_ate_entrega"),
            "percentual de captação até entrega",
            minimo=Decimal("0.01"),
            maximo=Decimal("1"),
            padrao=Decimal("1"),
        )

    if valor_garantido is not None and valor_garantido <= 0:
        raise HTTPException(status_code=400, detail="Informe um valor garantido maior que zero.")
    if valor_garantido_pre_obra_planejado is not None and valor_garantido_pre_obra_planejado <= 0:
        raise HTTPException(status_code=400, detail="Informe um valor garantido + pré-obra planejado maior que zero.")

    if valor is not None and valor_garantido is None:
        valor_garantido = calcular_valor_garantido_padrao(valor, percentual_fechamento_minimo)

    if valor is not None and valor_garantido is not None:
        if valor_garantido > valor:
            raise HTTPException(status_code=400, detail="O valor garantido não pode ser maior que o valor do imóvel.")
        percentual_fechamento_minimo = calcular_percentual_fechamento_por_valor_garantido(
            valor,
            valor_garantido,
            percentual_fechamento_minimo,
        )

    if valor is not None and valor_garantido_pre_obra_planejado is None and percentual_captacao_ate_entrega is not None:
        valor_garantido_pre_obra_planejado = calcular_valor_captacao_ate_entrega_planejado(
            valor,
            percentual_captacao_ate_entrega,
        )

    if valor is not None and valor_garantido_pre_obra_planejado is not None and percentual_captacao_ate_entrega is None:
        percentual_captacao_ate_entrega = calcular_percentual_captacao_ate_entrega_por_valor(
            valor,
            valor_garantido_pre_obra_planejado,
        )

    if valor is not None and valor_garantido_pre_obra_planejado is not None:
        if valor_garantido_pre_obra_planejado > valor:
            raise HTTPException(
                status_code=400,
                detail="O valor garantido + pré-obra planejado não pode ser maior que o valor do imóvel.",
            )
        percentual_captacao_ate_entrega = calcular_percentual_captacao_ate_entrega_por_valor(
            valor,
            valor_garantido_pre_obra_planejado,
        )

    if (
        valor_garantido is not None
        and valor_garantido_pre_obra_planejado is not None
        and valor_garantido_pre_obra_planejado < valor_garantido
    ):
        raise HTTPException(
            status_code=400,
            detail="O garantido + pré-obra planejado não pode ser menor que o garantido planejado.",
        )

    meses_pre_entrega = (
        calcular_meses_ate_entrega(data_entrega)
        if data_entrega
        else normalizar_inteiro_intervalo(
            payload.get("meses_pre_entrega"),
            "meses até entrega",
            1,
            240,
            36,
        )
    )

    valor_incentivo_minimo_payload = _primeiro_valor_preenchido(
        payload.get("valor_incentivo_minimo"),
        payload.get("valor_desconto_minimo"),
    )
    valor_incentivo_maximo_payload = _primeiro_valor_preenchido(
        payload.get("valor_incentivo_maximo"),
        payload.get("valor_desconto_maximo"),
    )

    valor_desconto_minimo = (
        normalizar_decimal(valor_incentivo_minimo_payload, "valor incentivo 7LM minimo")
        if valor_incentivo_minimo_payload not in (None, "")
        else VALOR_DESCONTO_MINIMO_PADRAO
    )
    valor_desconto_maximo = (
        normalizar_decimal(valor_incentivo_maximo_payload, "valor incentivo 7LM maximo")
        if valor_incentivo_maximo_payload not in (None, "")
        else VALOR_DESCONTO_MAXIMO_PADRAO
    )
    if valor_desconto_maximo < valor_desconto_minimo:
        raise HTTPException(
            status_code=400,
            detail="O incentivo 7LM maximo do imovel nao pode ser menor que o incentivo 7LM minimo.",
        )

    return {
        "titulo": normalizar_titulo(payload.get("titulo")),
        "descricao": normalizar_descricao(_valor_chave(payload, "descricao", "descrição")),
        "tipo_imovel": normalizar_tipo_imovel(payload.get("tipo_imovel")),
        "endereco": normalizar_endereco(_valor_chave(payload, "endereco", "endereço")),
        "cidade": normalizar_cidade(payload.get("cidade")),
        "bairro": normalizar_bairro(payload.get("bairro")),
        "estado": normalizar_estado(payload.get("estado")),
        "cep": normalizar_cep(payload.get("cep")),
        "valor": valor,
        "quartos": normalizar_inteiro(payload.get("quartos"), "quartos"),
        "banheiros": normalizar_inteiro(payload.get("banheiros"), "banheiros"),
        "vagas_garagem": normalizar_inteiro(payload.get("vagas_garagem"), "vagas de garagem"),
        "tipo_garagem": normalizar_tipo_garagem(payload.get("tipo_garagem")),
        "area_m2": normalizar_decimal(payload.get("area_m2"), "área em m2"),
        "data_entrega": data_entrega,
        "meses_pre_entrega": meses_pre_entrega,
        "meses_pos_entrega": normalizar_inteiro_intervalo(
            payload.get("meses_pos_entrega"),
            "meses pos-entrega",
            0,
            360,
            24,
        ),
        "percentual_conclusao_obra": normalizar_decimal_intervalo(
            payload.get("percentual_conclusao_obra"),
            "percentual de conclusão da obra",
            Decimal("0"),
            Decimal("100"),
            Decimal("0"),
        ),
        "percentual_fechamento_minimo": percentual_fechamento_minimo,
        "valor_garantido": valor_garantido,
        "valor_garantido_pre_obra_planejado": valor_garantido_pre_obra_planejado,
        "percentual_captacao_ate_entrega": percentual_captacao_ate_entrega,
        "valor_parcela_minima_pre_obra": normalizar_decimal(
            payload.get("valor_parcela_minima_pre_obra"),
            "valor da parcela mínima pré-obra",
        ) or Decimal("0.00"),
        "valor_desconto_minimo": valor_desconto_minimo,
        "valor_desconto_maximo": valor_desconto_maximo,
        "status": normalizar_status(payload.get("status")),
    }


def classificar_arquivo_de_midia(nome_arquivo: Optional[str], mime_type: Optional[str]) -> dict[str, str]:
    nome = Path(str(nome_arquivo or "")).name.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Todos os arquivos de mídia devem possuir nome.")

    extensao = Path(nome).suffix.lower()
    mime = str(mime_type or "").strip().lower()

    if extensao in EXTENSOES_IMAGEM:
        if mime and mime not in MIME_IMAGEM:
            raise HTTPException(status_code=400, detail=f"O arquivo {nome} não possui um tipo de imagem permitido.")
        return {"tipo_arquivo": "foto", "extensao": extensao, "mime_type": mime or "image/jpeg"}

    if extensao in EXTENSOES_VIDEO:
        if mime and mime not in MIME_VIDEO:
            raise HTTPException(status_code=400, detail=f"O arquivo {nome} não possui um tipo de video permitido.")
        return {"tipo_arquivo": "video", "extensao": extensao, "mime_type": mime or "video/mp4"}

    raise HTTPException(
        status_code=400,
        detail=f"O arquivo {nome} possui uma extensao não permitida. Use jpg, jpeg, png, webp, mp4, mov ou webm.",
    )


def normalizar_nome_para_arquivo(valor: Optional[str]) -> str:
    texto = unicodedata.normalize("NFKD", normalizar_texto(valor))
    texto = "".join(char for char in texto if not unicodedata.combining(char))
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", "-", texto).strip("-")
    return texto[:72] or "mídia"


def normalizar_identificador_coluna_planilha(valor: Any) -> str:
    texto = unicodedata.normalize("NFKD", normalizar_texto(valor))
    texto = "".join(char for char in texto if not unicodedata.combining(char))
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def mapear_colunas_importacao(cabecalhos: Iterable[Any]) -> dict[str, int]:
    normalizados = {
        indice: normalizar_identificador_coluna_planilha(valor)
        for indice, valor in enumerate(list(cabecalhos or []))
    }
    encontrados: dict[str, int] = {}

    for chave, aliases in MAPA_COLUNAS_IMPORTACAO.items():
        for alias in aliases:
            alias_normalizado = normalizar_identificador_coluna_planilha(alias)
            for indice, valor_normalizado in normalizados.items():
                if valor_normalizado == alias_normalizado:
                    encontrados[chave] = indice
                    break
            if chave in encontrados:
                break

    return encontrados


def linha_planilha_vazia(linha: Iterable[Any]) -> bool:
    for valor in list(linha or []):
        if valor is None:
            continue
        if isinstance(valor, str) and not valor.strip():
            continue
        return False
    return True


def obter_valor_coluna_planilha(linha: list[Any] | tuple[Any, ...], colunas: dict[str, int], chave: str) -> Any:
    indice = colunas.get(chave)
    if indice is None:
        return None
    if indice >= len(linha):
        return None
    return linha[indice]


def valor_planilha_como_texto(valor: Any) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return str(valor).strip()
