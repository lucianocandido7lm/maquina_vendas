"""
Servicos de dominio do simulador comercial inteligente.
"""

from __future__ import annotations

import json
import re

from datetime import date
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
from typing import Any

from utilitarios.documentos import cpf_valido, normalizar_cpf
from validacoes.imoveis import (
    calcular_percentual_captacao_ate_entrega_por_valor,
    calcular_data_entrega_dinamica,
    calcular_meses_ate_entrega,
    calcular_meses_ate_entrega_dinamica,
    calcular_valor_captacao_ate_entrega_planejado,
    calcular_valor_garantido_padrao,
    normalizar_data,
)


DECIMAL_ZERO = Decimal("0")
DECIMAL_100 = Decimal("100")

LIMITE_COMPROMETIMENTO_PADRAO = Decimal("0.45")
PARCELA_CLIENTE_MINIMA = Decimal("120.00")
MAXIMO_MESES_TOTAIS_SIMULACAO = 80
CREDITUR_MAXIMO_MESES_PRE_CHAVES = 60
CREDITUR_MAXIMO_MESES_POS_CHAVES = 80
CREDITUR_MAXIMO_MESES_TOTAIS = 80
CREDITUR_PADRAO_MESES_PRE_CHAVES = 60
CREDITUR_PADRAO_MESES_POS_CHAVES = 20
CREDITUR_RETENCAO_PERCENTUAL = Decimal("0.00")
FECHAMENTO_MINIMO_PADRAO = Decimal("0.70")
APROVACAO_EXCECAO_PERCENTUAL_GAP_MAXIMO = Decimal("0.0500")
APROVACAO_EXCECAO_GAP_MAXIMO_ABSOLUTO = Decimal("15000.00")
DESCONTO_IMOVEL_MAXIMO = Decimal("50000.00")
DESCONTO_IMOVEL_MINIMO_PADRAO = Decimal("0.00")
DESCONTO_IMOVEL_REDUCAO_POR_FAIXA = Decimal("5000.00")
DESCONTO_IMOVEL_UNIDADES_POR_FAIXA = 6000
DESCONTO_SEM_APROVACAO_GESTOR = Decimal("40000.00")
PARCEIRO_SIMULACAO_PADRAO = "7lm"
PARCEIRO_SIMULACAO_CREDITUR = "creditur"
PARCEIRO_SIMULACAO_CREDITUR_GERAL = "creditur_geral"

ENTREGA_REFERENCIA = Decimal("1.00")
ENTREGA_MINIMO = Decimal("0.95")
ENTREGA_FAIXA_IDEAL = Decimal("0.98")

STATUS_SIMULACAO_IDEAL = "ideal"
STATUS_SIMULACAO_ATENCAO = "atenção"
STATUS_SIMULACAO_INVALIDA = "inválida"

CLASSIFICACAO_IDEAL = "ideal"
CLASSIFICACAO_ATENCAO = "atenção"
CLASSIFICACAO_INVALIDA = "inválida"


def _decimal(valor: Any, padrao: Decimal = DECIMAL_ZERO) -> Decimal:
    if valor in (None, ""):
        return padrao
    if isinstance(valor, Decimal):
        return valor
    try:
        texto = str(valor).strip()
        if not texto:
            return padrao
        if "," in texto and "." in texto:
            if texto.rfind(",") > texto.rfind("."):
                texto = texto.replace(".", "").replace(",", ".")
            else:
                texto = texto.replace(",", "")
        elif "," in texto:
            texto = texto.replace(".", "").replace(",", ".")
        return Decimal(texto)
    except Exception:
        return padrao


def _money(valor: Any) -> Decimal:
    return _decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _inteiro_positivo(valor: Any) -> int:
    try:
        return max(int(valor or 0), 0)
    except Exception:
        return 0


def _resolver_politica_desconto_imovel(imovel: dict[str, Any] | Any) -> dict[str, Decimal | int]:
    registro = dict(imovel or {})
    desconto_minimo = _money(registro.get("valor_incentivo_minimo") or registro.get("valor_desconto_minimo"))
    desconto_maximo_bruto = registro.get("valor_incentivo_maximo") or registro.get("valor_desconto_maximo")
    desconto_maximo = (
        _money(desconto_maximo_bruto)
        if desconto_maximo_bruto not in (None, "")
        else DESCONTO_IMOVEL_MAXIMO
    )

    desconto_minimo = max(desconto_minimo, DESCONTO_IMOVEL_MINIMO_PADRAO)
    desconto_maximo = max(desconto_maximo, DESCONTO_IMOVEL_MINIMO_PADRAO)
    if desconto_maximo < desconto_minimo:
        desconto_maximo = desconto_minimo

    quantidade = _inteiro_positivo(
        registro.get("quantidade_incentivo_reservas_vendas")
        or registro.get("quantidade_desconto_reservas_vendas")
    )
    if quantidade <= 0 and _normalizar_chave_texto(registro.get("status")) in {"reservado", "vendido", "pendente de aprovacao", "pendente_aprovacao"}:
        quantidade = 1

    reducao = Decimal(quantidade // DESCONTO_IMOVEL_UNIDADES_POR_FAIXA) * DESCONTO_IMOVEL_REDUCAO_POR_FAIXA
    desconto_maximo_efetivo = _money(max(DECIMAL_ZERO, desconto_maximo - reducao))
    return {
        "desconto_minimo": _money(desconto_minimo),
        "desconto_maximo_configurado": _money(desconto_maximo),
        "desconto_maximo_efetivo": desconto_maximo_efetivo,
        "desconto_reducao": _money(reducao),
        "desconto_quantidade_reservas_vendas": quantidade,
    }


def _percent(valor: Decimal) -> Decimal:
    return _decimal(valor).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _percentual_texto(valor: Decimal) -> str:
    return f"{(valor * DECIMAL_100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}%"


def _moeda_texto(valor: Any) -> str:
    numero = _money(valor)
    texto = f"{numero:,.2f}"
    texto = texto.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def _limpar_texto(valor: Any) -> str:
    return str(valor or "").strip()


def _valor_chave(payload: dict[str, Any], *chaves: str) -> Any:
    for chave in chaves:
        if chave in payload:
            return payload.get(chave)
    return None


def _normalizar_chave_texto(valor: Any) -> str:
    texto = _limpar_texto(valor).lower()
    substituicoes = str.maketrans(
        "áàâãäéèêëíìîïóòôõöúùûüç",
        "aaaaaeeeeiiiiooooouuuuc",
    )
    return texto.translate(substituicoes)


def _normalizar_parceiro_simulacao(valor: Any) -> str:
    texto = _normalizar_chave_texto(valor)
    eh_creditur = "creditur" in texto or "creditu" in texto or "credtur" in texto or "credi tur" in texto
    if eh_creditur and "geral" in texto:
        return PARCEIRO_SIMULACAO_CREDITUR_GERAL
    if eh_creditur:
        return PARCEIRO_SIMULACAO_CREDITUR
    return PARCEIRO_SIMULACAO_PADRAO


def _is_creditur(valor: Any) -> bool:
    return _normalizar_parceiro_simulacao(valor) in {PARCEIRO_SIMULACAO_CREDITUR, PARCEIRO_SIMULACAO_CREDITUR_GERAL}


def _is_creditur_geral(valor: Any) -> bool:
    return _normalizar_parceiro_simulacao(valor) == PARCEIRO_SIMULACAO_CREDITUR_GERAL


def _normalizar_creditu_geral(payload: dict[str, Any]) -> dict[str, Any] | None:
    dados = payload.get("creditu_geral")
    if not isinstance(dados, dict):
        return None

    valor_liberado = _money(dados.get("valor_liberado"))
    if valor_liberado <= DECIMAL_ZERO:
        return None
    if dados.get("aplicado") is False:
        return None

    prazo = _inteiro_positivo(dados.get("prazo")) or CREDITUR_PADRAO_MESES_PRE_CHAVES
    prazo = min(max(prazo, 1), CREDITUR_PADRAO_MESES_PRE_CHAVES)
    sistema = _limpar_texto(dados.get("sistema") or "SAC").upper()
    if sistema not in {"SAC", "PRICE"}:
        sistema = "SAC"
    arquivo_pdf = dados.get("arquivo_pdf") if isinstance(dados.get("arquivo_pdf"), dict) else None
    anexos_creditu_bruto = dados.get("anexos_creditu") if isinstance(dados.get("anexos_creditu"), dict) else {}
    anexo_serasa = dados.get("anexo_serasa") if isinstance(dados.get("anexo_serasa"), dict) else anexos_creditu_bruto.get("serasa")
    anexo_sicaq = dados.get("anexo_sicaq") if isinstance(dados.get("anexo_sicaq"), dict) else anexos_creditu_bruto.get("sicaq")
    anexos_creditu = {
        "serasa": anexo_serasa if isinstance(anexo_serasa, dict) else None,
        "sicaq": anexo_sicaq if isinstance(anexo_sicaq, dict) else None,
    }
    origem = _limpar_texto(dados.get("origem")) or "simulador_creditu_geral"

    return {
        "aplicado": True,
        "aprovado": bool(dados.get("aprovado", True)),
        "cliente_nome": _limpar_texto(dados.get("cliente_nome")),
        "cliente_id": _limpar_texto(dados.get("cliente_id")),
        "imovel_id": _limpar_texto(dados.get("imovel_id")),
        "id_simulacao_creditu": _limpar_texto(dados.get("id_simulacao_creditu")),
        "empreendimento": _limpar_texto(dados.get("empreendimento")),
        "emissao": _limpar_texto(dados.get("emissao")),
        "valido_ate": _limpar_texto(dados.get("valido_ate")),
        "valor_liberado": valor_liberado,
        "valor_entrada": _money(dados.get("valor_entrada")),
        "total_financiado": _money(dados.get("total_financiado")),
        "parcela_inicial": _money(dados.get("parcela_inicial")),
        "parcela_final": _money(dados.get("parcela_final")),
        "parcela_7lm_20": _money(dados.get("parcela_7lm_20") or dados.get("parcela_7lm")),
        "prazo": prazo,
        "sistema": sistema,
        "seguro_prestamista": bool(dados.get("seguro_prestamista", True)),
        "seguro_prestamista_valor": _money(dados.get("seguro_prestamista_valor")),
        "renda_total": _money(dados.get("renda_total")),
        "parcela_caixa": _money(dados.get("parcela_caixa")),
        "valor_imovel": _money(dados.get("valor_imovel")),
        "idade": _inteiro_positivo(dados.get("idade")),
        "score": _inteiro_positivo(dados.get("score")),
        "restricoes": _money(dados.get("restricoes")),
        "comprometimento": _decimal(dados.get("comprometimento")),
        "percentual_entrada_imovel": _decimal(dados.get("percentual_entrada_imovel")),
        "taxa_mensal": _decimal(dados.get("taxa_mensal")),
        "taxa_anual": _decimal(dados.get("taxa_anual")),
        "vencimento_primeira_parcela": _limpar_texto(dados.get("vencimento_primeira_parcela")),
        "custo_cartorio": _money(dados.get("custo_cartorio")),
        "custo_avaliacao_garantia": _money(dados.get("custo_avaliacao_garantia")),
        "custo_tarifa_cadastro": _money(dados.get("custo_tarifa_cadastro")),
        "arquivo_pdf": arquivo_pdf,
        "anexo_serasa": anexos_creditu["serasa"],
        "anexo_sicaq": anexos_creditu["sicaq"],
        "anexos_creditu": anexos_creditu,
        "origem": origem,
    }


def _parcela_7lm_creditu_geral(dados: Any, fallback: Decimal) -> Decimal:
    if isinstance(dados, dict):
        for campo in ("parcela_7lm_20", "parcela_7lm", "parcela_7lm_pos", "parcela_final", "parcela_inicial"):
            valor = _money(dados.get(campo))
            if valor > DECIMAL_ZERO:
                return valor
        total_financiado = _money(dados.get("total_financiado"))
        prazo = _inteiro_positivo(dados.get("prazo")) or CREDITUR_PADRAO_MESES_PRE_CHAVES
        if total_financiado > DECIMAL_ZERO:
            return _money(total_financiado / Decimal(max(prazo, 1)))
    return _money(fallback)


def _intervalos_creditu_geral(dados_creditu: Any) -> list[dict[str, Decimal | int]]:
    valor = _money(dados_creditu.get("valor_liberado") if isinstance(dados_creditu, dict) else dados_creditu)
    if valor <= DECIMAL_ZERO:
        return []
    parcelas = CREDITUR_PADRAO_MESES_PRE_CHAVES
    total_centavos = int((valor * DECIMAL_100).to_integral_value(rounding=ROUND_HALF_UP))
    base_centavos = total_centavos // parcelas
    ultima_centavos = total_centavos - (base_centavos * (parcelas - 1))
    base = _money(Decimal(base_centavos) / DECIMAL_100)
    ultima = _money(Decimal(ultima_centavos) / DECIMAL_100)
    intervalos: list[dict[str, Decimal | int]] = []
    if base == ultima:
        intervalos.append({"parcela_inicio": 1, "parcela_fim": parcelas, "valor": base})
    else:
        intervalos.extend([
            {"parcela_inicio": 1, "parcela_fim": parcelas - 1, "valor": base},
            {"parcela_inicio": parcelas, "parcela_fim": parcelas, "valor": ultima},
        ])

    parcela_7lm = _parcela_7lm_creditu_geral(dados_creditu, base)
    if parcela_7lm > DECIMAL_ZERO:
        intervalos.append({
            "parcela_inicio": CREDITUR_PADRAO_MESES_PRE_CHAVES + 1,
            "parcela_fim": CREDITUR_MAXIMO_MESES_TOTAIS,
            "valor": _money(max(parcela_7lm, PARCELA_CLIENTE_MINIMA)),
        })
    return intervalos


def _percentual_fechamento_minimo_imovel(valor: Any) -> Decimal:
    percentual = _percent(_decimal(valor, FECHAMENTO_MINIMO_PADRAO))
    if percentual > Decimal("1"):
        percentual = _percent(percentual / DECIMAL_100)
    if percentual <= DECIMAL_ZERO:
        return FECHAMENTO_MINIMO_PADRAO
    if percentual > Decimal("1"):
        return Decimal("1.00")
    return percentual


def _valor_garantido_imovel(
    valor_configurado: Any,
    valor_imovel: Any,
    percentual_fechamento_minimo: Any = FECHAMENTO_MINIMO_PADRAO,
) -> Decimal:
    valor_garantido = _money(valor_configurado)
    if valor_garantido > DECIMAL_ZERO:
        return valor_garantido

    valor_padrao = calcular_valor_garantido_padrao(valor_imovel, percentual_fechamento_minimo)
    return _money(valor_padrao or DECIMAL_ZERO)


def _percentual_fechamento_minimo_por_valor_garantido(
    valor_garantido: Any,
    valor_total_operacao: Any,
    percentual_padrao: Any = FECHAMENTO_MINIMO_PADRAO,
) -> Decimal:
    total_operacao = _money(valor_total_operacao)
    valor_minimo = _money(valor_garantido)

    if total_operacao > DECIMAL_ZERO and valor_minimo > DECIMAL_ZERO:
        percentual = _percent(valor_minimo / total_operacao)
        if percentual <= DECIMAL_ZERO:
            return FECHAMENTO_MINIMO_PADRAO
        if percentual > Decimal("1"):
            return Decimal("1.00")
        return percentual

    return _percentual_fechamento_minimo_imovel(percentual_padrao)


def _parcela_minima_pre_obra_imovel(valor: Any) -> Decimal:
    parcela = _money(valor)
    if parcela <= DECIMAL_ZERO:
        return DECIMAL_ZERO
    return parcela


def _valor_garantido_pre_obra_planejado_imovel(
    valor_configurado: Any,
    valor_imovel: Any,
    percentual_captacao_ate_entrega: Any,
) -> Decimal:
    valor_planejado = _money(valor_configurado)
    if valor_planejado > DECIMAL_ZERO:
        return valor_planejado

    valor_padrao = calcular_valor_captacao_ate_entrega_planejado(
        valor_imovel,
        percentual_captacao_ate_entrega,
    )
    return _money(valor_padrao or DECIMAL_ZERO)


def _percentual_captacao_ate_entrega_imovel(
    percentual_configurado: Any,
    valor_imovel: Any,
    valor_planejado: Any,
) -> Decimal:
    percentual = _percent(_decimal(percentual_configurado))
    if percentual > Decimal("1"):
        percentual = _percent(percentual / DECIMAL_100)
    if percentual > DECIMAL_ZERO:
        return min(percentual, Decimal("1.00"))

    percentual_por_valor = calcular_percentual_captacao_ate_entrega_por_valor(
        valor_imovel,
        valor_planejado,
    )
    return _percent(percentual_por_valor or DECIMAL_ZERO)


def _extrair_campo_rotulado(texto: Any, rotulo: str) -> str:
    conteudo = _limpar_texto(texto)
    if not conteudo:
        return ""

    correspondencia = re.search(
        rf"{re.escape(rotulo)}\s*:\s*([^.\n\r]+)",
        conteudo,
        flags=re.IGNORECASE,
    )
    return correspondencia.group(1).strip() if correspondencia else ""


def _extrair_regex(texto: Any, padrao: str) -> str:
    conteudo = _limpar_texto(texto)
    if not conteudo:
        return ""
    correspondencia = re.search(padrao, conteudo, flags=re.IGNORECASE)
    return correspondencia.group(1).strip() if correspondencia else ""


def _inferir_pavimento_por_unidade(unidade: str) -> str:
    digitos = re.sub(r"\D", "", _limpar_texto(unidade))
    if len(digitos) < 3:
        return ""

    andar = digitos[:-2].lstrip("0") or "0"
    return f"{andar}o PAVIMENTO"


def montar_identificacao_imovel_simulador(imovel: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(imovel or {})
    titulo = _limpar_texto(linha.get("titulo"))
    descricao = _limpar_texto(_valor_chave(linha, "descricao", "descrição"))
    endereco = _limpar_texto(_valor_chave(linha, "endereco", "endereço"))
    tipo = _limpar_texto(linha.get("tipo_imovel") or linha.get("tipologia")) or "Imovel"

    unidade = (
        _extrair_campo_rotulado(descricao, "Unidade")
        or _extrair_regex(titulo, r"\b([a-z0-9-]+)\s*-\s*bloco\b")
        or _extrair_regex(endereco, r"\bunidade\s+([a-z0-9-]+)")
    )
    bloco = (
        _extrair_campo_rotulado(descricao, "Bloco")
        or _extrair_regex(titulo, r"\bbloco\s+([a-z0-9-]+)")
        or _extrair_regex(endereco, r"\bbloco\s+([a-z0-9-]+)")
    )
    pavimento = (
        _extrair_campo_rotulado(descricao, "Pavimento")
        or _extrair_regex(endereco, r"\bpavimento\s+([^,\n\r.]+)")
        or _inferir_pavimento_por_unidade(unidade)
    )
    empreendimento = (
        _extrair_campo_rotulado(descricao, "Empreendimento")
        or _extrair_campo_rotulado(descricao, "Localidade")
        or _limpar_texto(linha.get("empreendimento"))
        or _limpar_texto(linha.get("bairro"))
        or _limpar_texto(linha.get("cidade"))
    )
    orientacao = _extrair_campo_rotulado(descricao, "Orientacao")
    posicao = _extrair_campo_rotulado(descricao, "Posicao")

    titulo_exibicao = titulo
    if unidade and bloco:
        titulo_exibicao = f"{tipo} {unidade} - Bloco {bloco}"
    elif unidade:
        titulo_exibicao = f"{tipo} {unidade}"

    agrupamento = {
        "localidade": empreendimento or "Sem localidade",
        "bloco": bloco or "Sem bloco",
        "andar": pavimento or "Andar não informado",
        "pavimento": pavimento or "Andar não informado",
        "unidade": unidade or titulo or "Unidade",
    }
    detalhes_comerciais = {
        "empreendimento": empreendimento,
        "bloco": bloco,
        "unidade": unidade,
        "pavimento": pavimento,
        "andar": pavimento,
        "orientacao": orientacao,
        "posicao": posicao,
    }

    return {
        "titulo": titulo_exibicao or titulo or "Imovel",
        "titulo_original": titulo or None,
        "agrupamento": agrupamento,
        "detalhes_comerciais": detalhes_comerciais,
    }


def _json_dict(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str):
        try:
            carregado = json.loads(valor)
            return carregado if isinstance(carregado, dict) else {}
        except Exception:
            return {}
    return {}


def _valor_prefixado(linha: dict[str, Any], prefixo: str, campo: str) -> Any:
    chave_prefixada = f"{prefixo}{campo}" if prefixo else campo
    if chave_prefixada in linha:
        return linha.get(chave_prefixada)
    return linha.get(campo)


def _normalizar_status_imovel(valor: Any) -> str:
    return _limpar_texto(valor).lower()


def _add_months(data_base: date, meses: int) -> date:
    if meses <= 0:
        return data_base

    ano = data_base.year + ((data_base.month - 1 + meses) // 12)
    mes = ((data_base.month - 1 + meses) % 12) + 1

    dias_por_mes = [
        31,
        29 if (ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0)) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ]
    dia = min(data_base.day, dias_por_mes[mes - 1])
    return date(ano, mes, dia)


def _normalizar_data_evento(valor: Any) -> date | None:
    if isinstance(valor, date):
        return valor
    texto = _limpar_texto(valor)
    if not texto:
        return None
    try:
        return date.fromisoformat(texto[:10])
    except Exception:
        pass
    match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", texto)
    if not match:
        return None
    dia, mes, ano = match.groups()
    try:
        return date(int(ano), int(mes), int(dia))
    except Exception:
        return None


def _mes_relativo_data_evento(data_evento: date | None, data_contrato: date) -> int | None:
    if not data_evento:
        return None
    meses = (data_evento.year - data_contrato.year) * 12 + (data_evento.month - data_contrato.month)
    if data_evento.day > data_contrato.day:
        meses += 1
    return max(0, meses)


def _mes_inicial_recorrente(data_primeira: date | None, data_contrato: date, fallback: int) -> int:
    if not data_primeira:
        return fallback
    mes_relativo = _mes_relativo_data_evento(data_primeira, data_contrato)
    return max(1, int(mes_relativo or 0))


def _ocorrencias_recorrentes_pre_entrega(
    *,
    quantidade: int,
    primeira_data: Any,
    intervalo_meses: int,
    data_contrato: date,
    data_entrega: date | None,
    meses_pre: int,
    fallback_mes: int,
    limitar_data_entrega: bool = True,
) -> list[tuple[int, int, date]]:
    if quantidade <= 0:
        return []

    limite_entrega = data_entrega or _add_months(data_contrato, max(int(meses_pre or 0), 1))
    mes_limite = max(1, min(int(meses_pre or 1), MAXIMO_MESES_TOTAIS_SIMULACAO))
    data_primeira = _normalizar_data_evento(primeira_data)
    ocorrencias: list[tuple[int, int, date]] = []

    for indice in range(quantidade):
        if data_primeira:
            vencimento = _add_months(data_primeira, intervalo_meses * indice)
            mes_evento = _mes_relativo_data_evento(vencimento, data_contrato)
            mes_evento = max(1, int(mes_evento or 0))
            # Preserva a quantidade contratada e concentra ocorrencias fora da janela no limite pre-chaves.
            if vencimento < data_contrato:
                mes_evento = 1
                vencimento = data_contrato
            elif limitar_data_entrega and vencimento > limite_entrega:
                mes_evento = mes_limite
                vencimento = limite_entrega
        else:
            mes_evento = fallback_mes + (intervalo_meses * indice)
            mes_evento = max(1, min(mes_evento, mes_limite))
            vencimento = _add_months(data_contrato, mes_evento)

        if limitar_data_entrega and mes_evento > MAXIMO_MESES_TOTAIS_SIMULACAO:
            continue
        ocorrencias.append((indice + 1, mes_evento, vencimento))

    return ocorrencias


def _normalizar_lista_datas_eventos(valor: Any) -> list[date]:
    if valor in (None, ""):
        return []
    origem = valor if isinstance(valor, list) else str(valor).split(",")
    datas: list[date] = []
    for item in origem:
        data_evento = _normalizar_data_evento(item)
        if data_evento:
            datas.append(data_evento)
    return datas


def _registrar_extra_mes(extras_por_mes: dict[int, Decimal], mes: int, valor: Decimal) -> None:
    if valor <= DECIMAL_ZERO:
        return
    mes_normalizado = int(mes or 0)
    if mes_normalizado <= 0:
        mes_normalizado = 1
    if mes_normalizado > MAXIMO_MESES_TOTAIS_SIMULACAO:
        return
    extras_por_mes[mes_normalizado] = _money(extras_por_mes.get(mes_normalizado, DECIMAL_ZERO) + valor)


def serializar_complemento_renda(registro: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(registro or {})
    return {
        "id": str(linha.get("identificador_complemento") or ""),
        "cliente_id": str(linha.get("identificador_cliente") or ""),
        "nome": linha.get("nome"),
        "cpf": linha.get("cpf"),
        "parentesco": linha.get("parentesco"),
        "renda": _money(linha.get("renda")),
        "incluir_na_analise": bool(linha.get("incluir_na_analise", True)),
        "compoe_renda": bool(linha.get("compoe_renda", True)),
        "incluir_na_composicao_financeira": bool(linha.get("incluir_na_composicao_financeira", True)),
        "ativo": bool(linha.get("ativo", True)),
        "data_hora_criacao": linha.get("data_hora_criacao"),
        "data_hora_atualizado_em": linha.get("data_hora_atualizado_em"),
    }


def normalizar_payload_complemento(payload: dict[str, Any]) -> dict[str, Any]:
    cpf = normalizar_cpf(payload.get("cpf"))
    if not cpf or len(cpf) != 11 or not cpf_valido(cpf):
        raise ValueError("CPF inválido para complemento de renda.")

    return {
        "nome": _limpar_texto(payload.get("nome")),
        "cpf": cpf,
        "parentesco": _limpar_texto(payload.get("parentesco")) or None,
        "renda": _money(payload.get("renda")),
        "incluir_na_analise": bool(payload.get("incluir_na_analise", True)),
        "compoe_renda": bool(payload.get("compoe_renda", True)),
        "incluir_na_composicao_financeira": bool(payload.get("incluir_na_composicao_financeira", True)),
        "ativo": bool(payload.get("ativo", True)),
    }


def _classificar_garantia(valor_real: Decimal, valor_planejado: Decimal) -> str:
    valor_real_final = _money(valor_real)
    valor_planejado_final = _money(valor_planejado)

    if valor_planejado_final <= DECIMAL_ZERO:
        return CLASSIFICACAO_IDEAL
    if valor_real_final >= valor_planejado_final:
        return CLASSIFICACAO_IDEAL
    if valor_real_final <= DECIMAL_ZERO:
        return CLASSIFICACAO_INVALIDA
    return CLASSIFICACAO_ATENCAO


def _classificar_entrega(percentual: Decimal, percentual_meta: Any = None) -> str:
    meta = _percent(_decimal(percentual_meta))
    if meta > Decimal("1"):
        meta = _percent(meta / DECIMAL_100)

    if meta <= DECIMAL_ZERO:
        if percentual >= ENTREGA_FAIXA_IDEAL:
            return CLASSIFICACAO_IDEAL
        return CLASSIFICACAO_ATENCAO

    meta = min(meta, Decimal("1.00"))
    limite_invalido = max(meta - Decimal("0.05"), DECIMAL_ZERO)
    if percentual < limite_invalido:
        return CLASSIFICACAO_INVALIDA
    if percentual >= meta:
        return CLASSIFICACAO_IDEAL
    return CLASSIFICACAO_ATENCAO


def _coletar_parametros_financeiros(
    payload: dict[str, Any],
    valor_imovel: Decimal,
    imovel: dict[str, Any] | Any | None = None,
) -> dict[str, Any]:
    sobrepreco = _money(payload.get("sobrepreco"))
    valor_total_bruto = _money(valor_imovel + sobrepreco)
    politica_desconto = _resolver_politica_desconto_imovel(imovel or {})
    desconto_imovel_solicitado = _money(payload.get("incentivo_7lm") or payload.get("desconto_imovel"))
    desconto_imovel = _money(
        min(
            max(desconto_imovel_solicitado, DECIMAL_ZERO),
            politica_desconto["desconto_maximo_efetivo"],
            max(valor_total_bruto, DECIMAL_ZERO),
        )
    )
    valor_total_operacao = _money(max(valor_total_bruto - desconto_imovel, DECIMAL_ZERO))

    entrada_solicitada = _money(payload.get("entrada"))
    entrada = entrada_solicitada
    usar_entrada_padrao = bool(payload.get("usar_entrada_padrao", False))
    if entrada <= DECIMAL_ZERO and usar_entrada_padrao:
        entrada = _money(valor_total_operacao * Decimal("0.10"))
        entrada_solicitada = entrada

    fgts = _money(payload.get("fgts"))
    subsidio = _money(payload.get("subsidio"))
    cheque_moradia = _money(payload.get("cheque_moradia"))

    financiamento_caixa = _money(payload.get("financiamento_caixa"))
    parcela_financiamento_banco = _money(payload.get("parcela_financiamento_banco"))
    limite_entrada = _money(max(valor_total_operacao - (financiamento_caixa + fgts + subsidio), DECIMAL_ZERO))
    entrada_excedente_valor_negociado = DECIMAL_ZERO
    if entrada > limite_entrada:
        entrada_excedente_valor_negociado = _money(entrada - limite_entrada)

    estrutura_operacao_inicial = _money(entrada + financiamento_caixa + fgts + subsidio)
    valor_captacao_entrega_base = estrutura_operacao_inicial

    valor_captacao_inicial = estrutura_operacao_inicial

    pro_soluto_total = _money(max(valor_total_operacao - valor_captacao_entrega_base, DECIMAL_ZERO))

    return {
        "valor_imovel": _money(valor_imovel),
        "sobrepreco": sobrepreco,
        "desconto_imovel": desconto_imovel,
        "incentivo_7lm": desconto_imovel,
        "desconto_imovel_solicitado": desconto_imovel_solicitado,
        "incentivo_7lm_solicitado": desconto_imovel_solicitado,
        "desconto_imovel_minimo": politica_desconto["desconto_minimo"],
        "valor_incentivo_minimo": politica_desconto["desconto_minimo"],
        "desconto_imovel_maximo_configurado": politica_desconto["desconto_maximo_configurado"],
        "valor_incentivo_maximo": politica_desconto["desconto_maximo_configurado"],
        "desconto_imovel_maximo_efetivo": politica_desconto["desconto_maximo_efetivo"],
        "incentivo_7lm_maximo_efetivo": politica_desconto["desconto_maximo_efetivo"],
        "desconto_imovel_reducao_por_reservas_vendas": politica_desconto["desconto_reducao"],
        "incentivo_7lm_reducao_por_reservas_vendas": politica_desconto["desconto_reducao"],
        "desconto_imovel_quantidade_reservas_vendas": politica_desconto["desconto_quantidade_reservas_vendas"],
        "incentivo_7lm_quantidade_reservas_vendas": politica_desconto["desconto_quantidade_reservas_vendas"],
        "valor_total_operacao_bruto": valor_total_bruto,
        "valor_total_operacao": valor_total_operacao,
        "entrada": entrada,
        "entrada_solicitada": entrada_solicitada,
        "entrada_limite_valor_negociado": limite_entrada,
        "entrada_excedente_valor_negociado": entrada_excedente_valor_negociado,
        "fgts": fgts,
        "subsidio": subsidio,
        "cheque_moradia": cheque_moradia,
        "financiamento_caixa": financiamento_caixa,
        "parcela_financiamento_banco": parcela_financiamento_banco,
        "estrutura_operacao_inicial": estrutura_operacao_inicial,
        "valor_captacao_inicial": valor_captacao_inicial,
        "valor_captacao_entrega_base": valor_captacao_entrega_base,
        "pro_soluto_total": pro_soluto_total,
    }


def _ajustar_valor_planejado_por_desconto(
    valor_configurado: Any,
    valor_imovel_base: Any,
    valor_total_operacao: Any,
    desconto_imovel: Any,
) -> Decimal:
    valor_planejado = _money(valor_configurado)
    valor_base = _money(valor_imovel_base)
    valor_negociado = _money(valor_total_operacao)
    desconto = _money(desconto_imovel)

    if valor_planejado <= DECIMAL_ZERO:
        return DECIMAL_ZERO
    if desconto <= DECIMAL_ZERO or valor_base <= DECIMAL_ZERO or valor_negociado <= DECIMAL_ZERO:
        return valor_planejado

    percentual_planejado = _percent(valor_planejado / valor_base)
    if percentual_planejado <= DECIMAL_ZERO:
        return valor_planejado

    return _money(valor_negociado * percentual_planejado)


def _valor_sugestao_para_ranking(item: dict[str, Any]) -> Decimal:
    resumo = item.get("resumo_operacao") or {}
    imovel = item.get("imovel") or {}
    return _money(
        resumo.get("valor_total_operacao")
        or imovel.get("valor_negociado")
        or imovel.get("valor_total_operacao")
        or imovel.get("valor")
    )


def _total_parcelamento(valor_unitario: Any, quantidade: Any) -> tuple[Decimal, int, Decimal]:
    valor = _normalizar_parcela_evento_minima(valor_unitario)
    qtd = int(quantidade or 0)
    if qtd < 0:
        qtd = 0
    if valor <= DECIMAL_ZERO or qtd <= 0:
        return DECIMAL_ZERO, 0, DECIMAL_ZERO
    return _money(valor * Decimal(qtd)), qtd, valor


def _normalizar_parcelas_intermediarias_personalizadas(payload: dict[str, Any]) -> list[dict[str, Any]]:
    origem = payload.get("parcelas_intermediarias_personalizadas")
    itens: list[dict[str, Any]] = []

    if isinstance(origem, list):
        for indice, item in enumerate(origem[:24]):
            linha = item if isinstance(item, dict) else {}
            valor = _money(
                linha.get("valor")
                or linha.get("valor_parcela")
                or linha.get("parcela_intermediaria_valor")
            )
            if valor <= DECIMAL_ZERO:
                continue
            itens.append(
                {
                    "numero": indice + 1,
                    "valor": valor,
                    "data": _normalizar_data_evento(
                        linha.get("data")
                        or linha.get("vencimento")
                        or linha.get("data_vencimento")
                    ),
                }
            )

    if itens:
        return itens

    valor_padrao = _normalizar_parcela_evento_minima(payload.get("parcela_intermediaria_valor"))
    quantidade = min(_inteiro_positivo(payload.get("parcelas_intermediarias_quantidade")), 24)
    datas = _normalizar_lista_datas_eventos(payload.get("parcelas_intermediarias_datas"))
    if valor_padrao <= DECIMAL_ZERO or quantidade <= 0:
        return []

    return [
        {
            "numero": indice + 1,
            "valor": valor_padrao,
            "data": datas[indice] if indice < len(datas) else None,
        }
        for indice in range(quantidade)
    ]


def _resumir_parcelas_intermediarias(itens: list[dict[str, Any]]) -> tuple[Decimal, int, Decimal]:
    valores = [_money(item.get("valor")) for item in itens if _money(item.get("valor")) > DECIMAL_ZERO]
    if not valores:
        return DECIMAL_ZERO, 0, DECIMAL_ZERO

    valor_referencia = valores[0]
    valor_uniforme = valor_referencia if all(valor == valor_referencia for valor in valores) else DECIMAL_ZERO
    return _money(sum(valores, DECIMAL_ZERO)), len(valores), valor_uniforme


def _normalizar_parcelas_7lm_personalizadas(
    payload: dict[str, Any],
    *,
    meses_pre: int,
    meses_pos: int,
) -> list[dict[str, Any]]:
    origem = payload.get("parcelas_7lm_personalizadas")
    if not isinstance(origem, list):
        return []

    limite_total = max(min(int(meses_pre or 0) + int(meses_pos or 0), MAXIMO_MESES_TOTAIS_SIMULACAO), 0)
    if limite_total <= 0:
        return []

    itens: list[dict[str, Any]] = []
    parcelas_usadas: set[int] = set()
    for indice, item in enumerate(origem[:MAXIMO_MESES_TOTAIS_SIMULACAO]):
        linha = item if isinstance(item, dict) else {}
        valor = _money(
            linha.get("valor")
            or linha.get("valor_parcela")
            or linha.get("parcela_7lm_valor")
        )
        if valor <= DECIMAL_ZERO:
            continue

        parcela = _inteiro_positivo(
            linha.get("parcela")
            or linha.get("parcela_global")
            or linha.get("numero")
            or (indice + 1)
        )
        if parcela <= 0 or parcela > limite_total or parcela in parcelas_usadas:
            continue
        parcelas_usadas.add(parcela)

        fase = "pre" if parcela <= meses_pre else "pos"
        mes_fase = parcela if fase == "pre" else parcela - max(int(meses_pre or 0), 0)
        itens.append(
            {
                "parcela": parcela,
                "mes": mes_fase,
                "fase": fase,
                "valor": valor,
                "data": _normalizar_data_evento(
                    linha.get("data")
                    or linha.get("vencimento")
                    or linha.get("data_vencimento")
                ),
            }
        )

    return sorted(itens, key=lambda item: int(item.get("parcela") or 0))


def _percentual_obra(valor: Any) -> Decimal:
    percentual = _decimal(valor)
    if percentual < DECIMAL_ZERO:
        return DECIMAL_ZERO
    if percentual > DECIMAL_100:
        return DECIMAL_100
    return _percent(percentual)


def _fator_obra(valor: Any) -> Decimal:
    return _percent(_percentual_obra(valor) / DECIMAL_100)


def _mapear_extras_pre_entrega(
    *,
    meses_pre: int,
    data_entrega: date | None,
    intermediaria_valor: Decimal,
    intermediaria_qtd: int,
    intermediaria_itens: list[dict[str, Any]] | None = None,
    anual_valor: Decimal,
    anual_qtd: int,
    semestral_valor: Decimal,
    semestral_qtd: int,
    reforco_valor: Decimal,
    reforco_qtd: int,
    intermediaria_datas: Any = None,
    anual_primeira_data: Any = None,
    semestral_primeira_data: Any = None,
) -> dict[int, Decimal]:
    extras_por_mes: dict[int, Decimal] = {}
    data_contrato = date.today()
    limite_entrega = data_entrega or _add_months(data_contrato, max(int(meses_pre or 0), 1))
    itens_intermediarias = intermediaria_itens or []

    if itens_intermediarias:
        for indice, item in enumerate(itens_intermediarias):
            valor_evento = _money(item.get("valor"))
            if valor_evento <= DECIMAL_ZERO:
                continue
            data_evento = _normalizar_data_evento(item.get("data"))
            if data_evento and data_evento < data_contrato:
                continue
            mes_evento = _mes_relativo_data_evento(data_evento, data_contrato)
            if mes_evento is None:
                mes_evento = max(1, int(((indice + 1) * meses_pre) / (len(itens_intermediarias) + 1)))
            if not data_evento and mes_evento > meses_pre:
                continue
            _registrar_extra_mes(extras_por_mes, mes_evento, valor_evento)
    elif intermediaria_qtd > 0 and intermediaria_valor > DECIMAL_ZERO:
        datas_intermediarias = _normalizar_lista_datas_eventos(intermediaria_datas)
        for indice in range(intermediaria_qtd):
            data_evento = datas_intermediarias[indice] if indice < len(datas_intermediarias) else None
            if data_evento and data_evento < data_contrato:
                continue
            mes_evento = _mes_relativo_data_evento(data_evento, data_contrato)
            if mes_evento is None:
                mes_evento = max(1, int(((indice + 1) * meses_pre) / (intermediaria_qtd + 1)))
            if not data_evento and mes_evento > meses_pre:
                continue
            _registrar_extra_mes(extras_por_mes, mes_evento, intermediaria_valor)

    if anual_qtd > 0 and anual_valor > DECIMAL_ZERO:
        for _, mes_evento, _ in _ocorrencias_recorrentes_pre_entrega(
            quantidade=anual_qtd,
            primeira_data=anual_primeira_data,
            intervalo_meses=12,
            data_contrato=data_contrato,
            data_entrega=data_entrega,
            meses_pre=meses_pre,
            fallback_mes=12,
            limitar_data_entrega=False,
        ):
            _registrar_extra_mes(extras_por_mes, mes_evento, anual_valor)

    if semestral_qtd > 0 and semestral_valor > DECIMAL_ZERO:
        for _, mes_evento, _ in _ocorrencias_recorrentes_pre_entrega(
            quantidade=semestral_qtd,
            primeira_data=semestral_primeira_data,
            intervalo_meses=6,
            data_contrato=data_contrato,
            data_entrega=data_entrega,
            meses_pre=meses_pre,
            fallback_mes=6,
            limitar_data_entrega=False,
        ):
            _registrar_extra_mes(extras_por_mes, mes_evento, semestral_valor)

    if reforco_qtd > 0 and reforco_valor > DECIMAL_ZERO:
        for indice in range(reforco_qtd):
            deslocamento = max(1, int(((indice + 1) * meses_pre) / (reforco_qtd + 1)))
            _registrar_extra_mes(extras_por_mes, deslocamento, reforco_valor)

    return extras_por_mes


def _normalizar_degraus_creditur_legado(payload: dict[str, Any]) -> dict[int, Decimal]:
    itens = payload.get("parcelas_creditur_semestrais")
    if not isinstance(itens, list):
        return {}

    degraus: dict[int, Decimal] = {}
    for item in itens:
        if not isinstance(item, dict):
            continue
        try:
            semestre = int(item.get("semestre") or 0)
        except Exception:
            continue
        if semestre < 1 or semestre > 17:
            continue
        valor = _money(item.get("valor"))
        if valor <= DECIMAL_ZERO:
            continue
        degraus[semestre] = _money(max(valor, PARCELA_CLIENTE_MINIMA))
    return dict(sorted(degraus.items()))


def _consolidar_intervalos_creditur(
    intervalos_base: list[dict[str, Decimal | int]],
    meses_creditur: int,
    *,
    completar_pre_entrega: bool = True,
) -> list[dict[str, Decimal | int]]:
    if not intervalos_base:
        return []

    limite_creditur = min(max(int(meses_creditur or CREDITUR_PADRAO_MESES_PRE_CHAVES), 1), CREDITUR_MAXIMO_MESES_TOTAIS)
    if not completar_pre_entrega:
        intervalos: list[dict[str, Decimal | int]] = []
        parcelas_usadas: set[int] = set()
        for item in sorted(intervalos_base, key=lambda item: (int(item["parcela_inicio"]), int(item["parcela_fim"]))):
            inicio = max(1, min(int(item["parcela_inicio"]), CREDITUR_MAXIMO_MESES_TOTAIS))
            fim = max(1, min(int(item["parcela_fim"]), CREDITUR_MAXIMO_MESES_TOTAIS))
            if fim < inicio:
                inicio, fim = fim, inicio
            valor = _money(item["valor"])
            if valor <= DECIMAL_ZERO:
                continue
            sequencia: list[int] = []
            for numero in range(inicio, fim + 1):
                if numero in parcelas_usadas:
                    if sequencia:
                        intervalos.append({
                            "parcela_inicio": sequencia[0],
                            "parcela_fim": sequencia[-1],
                            "valor": valor,
                        })
                        sequencia = []
                    continue
                parcelas_usadas.add(numero)
                sequencia.append(numero)
            if sequencia:
                intervalos.append({
                    "parcela_inicio": sequencia[0],
                    "parcela_fim": sequencia[-1],
                    "valor": valor,
                })
        return sorted(intervalos, key=lambda item: (int(item["parcela_inicio"]), int(item["parcela_fim"])))

    pre_valor: Decimal | None = None
    pos_brutos: list[dict[str, Decimal | int]] = []
    for item in sorted(intervalos_base, key=lambda item: (int(item["parcela_inicio"]), int(item["parcela_fim"]))):
        inicio = int(item["parcela_inicio"])
        fim = int(item["parcela_fim"])
        valor = _money(item["valor"])
        if valor <= DECIMAL_ZERO:
            continue
        if inicio <= limite_creditur and fim >= 1 and pre_valor is None:
            pre_valor = valor
        if fim > limite_creditur:
            pos_inicio = max(inicio, limite_creditur + 1)
            pos_fim = min(fim, CREDITUR_MAXIMO_MESES_TOTAIS)
            if pos_inicio <= pos_fim:
                pos_brutos.append({
                    "parcela_inicio": pos_inicio,
                    "parcela_fim": pos_fim,
                    "valor": valor,
                })

    intervalos: list[dict[str, Decimal | int]] = []
    if pre_valor is not None:
        intervalos.append({
            "parcela_inicio": 1,
            "parcela_fim": limite_creditur,
            "valor": pre_valor,
        })

    parcelas_usadas: set[int] = set()
    for item in pos_brutos:
        inicio = int(item["parcela_inicio"])
        fim = int(item["parcela_fim"])
        valor = _money(item["valor"])
        sequencia: list[int] = []
        for numero in range(inicio, fim + 1):
            if numero in parcelas_usadas:
                if sequencia:
                    intervalos.append({
                        "parcela_inicio": sequencia[0],
                        "parcela_fim": sequencia[-1],
                        "valor": valor,
                    })
                    sequencia = []
                continue
            parcelas_usadas.add(numero)
            sequencia.append(numero)
        if sequencia:
            intervalos.append({
                "parcela_inicio": sequencia[0],
                "parcela_fim": sequencia[-1],
                "valor": valor,
            })

    return sorted(intervalos, key=lambda item: (int(item["parcela_inicio"]), int(item["parcela_fim"])))


def _normalizar_intervalos_creditur(
    payload: dict[str, Any],
    total_parcelas: int,
    meses_creditur: int,
) -> list[dict[str, Decimal | int]]:
    limite = max(int(total_parcelas or 0), 0)
    if limite <= 0:
        return []

    itens = payload.get("parcelas_creditur_intervalos")
    intervalos_brutos: list[dict[str, Decimal | int]] = []
    if isinstance(itens, list):
        for item in itens:
            if not isinstance(item, dict):
                continue
            try:
                inicio = int(
                    item.get("parcela_inicio")
                    or item.get("inicio")
                    or item.get("de")
                    or item.get("parcela_de")
                    or 0
                )
                fim = int(
                    item.get("parcela_fim")
                    or item.get("fim")
                    or item.get("ate")
                    or item.get("parcela_ate")
                    or inicio
                )
            except Exception:
                continue
            inicio = max(1, min(inicio, limite))
            fim = max(1, min(fim, limite))
            if fim < inicio:
                inicio, fim = fim, inicio
            valor = _money(item.get("valor"))
            if valor <= DECIMAL_ZERO:
                continue
            intervalos_brutos.append({
                "parcela_inicio": inicio,
                "parcela_fim": fim,
                "valor": _money(max(valor, PARCELA_CLIENTE_MINIMA)),
            })

    if intervalos_brutos:
        intervalos: list[dict[str, Decimal | int]] = []
        parcelas_usadas: set[int] = set()
        for item in intervalos_brutos:
            inicio = int(item["parcela_inicio"])
            fim = int(item["parcela_fim"])
            valor = _money(item["valor"])
            sequencia: list[int] = []
            for numero in range(inicio, fim + 1):
                if numero in parcelas_usadas:
                    if sequencia:
                        intervalos.append({
                            "parcela_inicio": sequencia[0],
                            "parcela_fim": sequencia[-1],
                            "valor": valor,
                        })
                        sequencia = []
                    continue
                parcelas_usadas.add(numero)
                sequencia.append(numero)
            if sequencia:
                intervalos.append({
                    "parcela_inicio": sequencia[0],
                    "parcela_fim": sequencia[-1],
                    "valor": valor,
                })

        return _consolidar_intervalos_creditur(intervalos, meses_creditur, completar_pre_entrega=False)

    degraus_legado = _normalizar_degraus_creditur_legado(payload)
    if not degraus_legado:
        return []

    intervalos: list[dict[str, Decimal | int]] = []
    inicios = sorted(max(1, ((semestre - 1) * 6) + 1) for semestre in degraus_legado)
    for indice, inicio in enumerate(inicios):
        if indice + 1 < len(inicios):
            fim = inicios[indice + 1] - 1
        elif inicio <= meses_creditur:
            fim = min(limite, meses_creditur)
        else:
            fim = limite
        if inicio > limite:
            continue
        semestre = int(((inicio - 1) / 6) + 1)
        intervalos.append({
            "parcela_inicio": inicio,
            "parcela_fim": max(inicio, min(fim, limite)),
            "valor": degraus_legado[semestre],
        })
    return _consolidar_intervalos_creditur(intervalos, meses_creditur)


def _normalizar_parcela_manual_minima(valor: Any, capacidade: Any) -> Decimal:
    parcela = _money(valor)
    limite = _money(capacidade)
    if parcela <= DECIMAL_ZERO or limite <= DECIMAL_ZERO:
        return DECIMAL_ZERO
    minimo = PARCELA_CLIENTE_MINIMA if limite >= PARCELA_CLIENTE_MINIMA else limite
    return _money(min(max(parcela, minimo), limite))


def _normalizar_parcela_evento_minima(valor: Any) -> Decimal:
    parcela = _money(valor)
    if parcela <= DECIMAL_ZERO:
        return DECIMAL_ZERO
    return _money(max(parcela, PARCELA_CLIENTE_MINIMA))


def _valor_creditur_por_parcela(intervalos: list[dict[str, Any]] | None, numero_parcela: int) -> Decimal:
    if not intervalos:
        return DECIMAL_ZERO

    numero = max(int(numero_parcela or 1), 1)
    for intervalo in intervalos:
        inicio = int(intervalo.get("parcela_inicio") or 0)
        fim = int(intervalo.get("parcela_fim") or inicio)
        if inicio <= numero <= fim:
            return _money(intervalo.get("valor"))
    return DECIMAL_ZERO


def _total_creditur_pre_programado(
    fluxo_capacidade_pre: list[dict[str, Any]],
    intervalos: list[dict[str, Any]] | None,
) -> Decimal:
    if not intervalos:
        return DECIMAL_ZERO

    total = DECIMAL_ZERO
    for item in fluxo_capacidade_pre:
        mes = int(item.get("mes") or 1)
        valor_programado = _valor_creditur_por_parcela(intervalos, mes)
        if valor_programado <= DECIMAL_ZERO:
            continue
        total += valor_programado
    return _money(total)


def _planejar_fluxo_pos_entrega(
    *,
    pro_soluto_pos: Decimal,
    capacidade_pos_7lm: Decimal,
    parcela_pos_minima: Decimal,
    meses_pos_limite: int,
    parcela_pos_manual: Decimal = DECIMAL_ZERO,
    preservar_prazo: bool = False,
) -> tuple[int, Decimal, Decimal, Decimal]:
    saldo_pos = _money(pro_soluto_pos)
    capacidade = _money(capacidade_pos_7lm)
    parcela_minima = _money(max(parcela_pos_minima, DECIMAL_ZERO))
    limite = max(int(meses_pos_limite or 0), 0)

    if saldo_pos <= DECIMAL_ZERO:
        return 0, DECIMAL_ZERO, DECIMAL_ZERO, DECIMAL_ZERO

    if limite <= 0:
        return 0, saldo_pos, capacidade, saldo_pos

    parcela_manual = _money(max(parcela_pos_manual, DECIMAL_ZERO))
    if parcela_manual > DECIMAL_ZERO:
        parcela_desejada = _money(min(parcela_manual, capacidade)) if capacidade > DECIMAL_ZERO else DECIMAL_ZERO
        parcela_ideal_manual = _money(saldo_pos / Decimal(max(limite, 1)))
        if parcela_desejada <= DECIMAL_ZERO:
            return limite, DECIMAL_ZERO, DECIMAL_ZERO, parcela_ideal_manual
        meses_necessarios = int((saldo_pos / parcela_desejada).to_integral_value(rounding=ROUND_CEILING))
        meses_planejados = max(1, min(limite, meses_necessarios))
        mensal = (
            _money(saldo_pos / Decimal(max(meses_planejados, 1)))
            if meses_necessarios <= limite
            else parcela_desejada
        )
        return meses_planejados, mensal, _money(capacidade * Decimal(meses_planejados)), parcela_ideal_manual

    parcela_minima_efetiva = _money(min(parcela_minima, saldo_pos)) if parcela_minima > DECIMAL_ZERO else DECIMAL_ZERO
    meses_maximos_por_piso = limite
    if parcela_minima_efetiva > DECIMAL_ZERO:
        meses_maximos_por_piso = int(
            (saldo_pos / parcela_minima_efetiva).to_integral_value(rounding=ROUND_FLOOR)
        )
        meses_maximos_por_piso = max(1, min(limite, meses_maximos_por_piso))
    else:
        meses_maximos_por_piso = max(1, limite)

    parcela_ideal = _money(saldo_pos / Decimal(max(meses_maximos_por_piso, 1)))

    if capacidade <= DECIMAL_ZERO:
        return meses_maximos_por_piso, parcela_ideal, DECIMAL_ZERO, parcela_ideal

    if preservar_prazo:
        mensal = _money(min(parcela_ideal, capacidade))
        return meses_maximos_por_piso, mensal, _money(capacidade * Decimal(meses_maximos_por_piso)), parcela_ideal

    meses_minimos_por_capacidade = int((saldo_pos / capacidade).to_integral_value(rounding=ROUND_CEILING))
    meses_minimos_por_capacidade = max(1, meses_minimos_por_capacidade)

    if meses_minimos_por_capacidade <= meses_maximos_por_piso:
        meses_planejados = meses_minimos_por_capacidade
        mensal = _money(saldo_pos / Decimal(max(meses_planejados, 1)))
    else:
        meses_planejados = meses_maximos_por_piso
        mensal = parcela_ideal

    return meses_planejados, mensal, _money(capacidade * Decimal(meses_planejados)), parcela_ideal


def _planejar_fluxo_pos_entrega_creditur(
    *,
    pro_soluto_pos: Decimal,
    capacidade_pos_7lm: Decimal,
    meses_pre: int,
    meses_pos_limite: int,
    intervalos: list[dict[str, Any]],
    parcela_pos_manual: Decimal = DECIMAL_ZERO,
) -> tuple[int, Decimal, Decimal, Decimal, list[dict[str, Any]], Decimal]:
    saldo = _money(pro_soluto_pos)
    capacidade = _money(capacidade_pos_7lm)
    limite = max(int(meses_pos_limite or 0), 0)
    manual = _money(max(parcela_pos_manual, DECIMAL_ZERO))
    fluxo: list[dict[str, Any]] = []
    total_alocado = DECIMAL_ZERO

    if limite <= 0:
        return 0, DECIMAL_ZERO, DECIMAL_ZERO, saldo, fluxo, saldo

    for indice in range(1, limite + 1):
        mes_fluxo = max(int(meses_pre or 0), 0) + indice
        valor_programado = _valor_creditur_por_parcela(intervalos, mes_fluxo)
        if valor_programado <= DECIMAL_ZERO and manual > DECIMAL_ZERO:
            valor_programado = manual
        if valor_programado <= DECIMAL_ZERO:
            continue
        valor_programado = _money(max(valor_programado, PARCELA_CLIENTE_MINIMA))
        valor_parcela = valor_programado
        fluxo.append(
            {
                "mes": indice,
                "parcela_7lm": valor_parcela,
                "capacidade_parcela_7lm": capacidade,
            }
        )
        total_alocado = _money(total_alocado + valor_parcela)

    if not fluxo:
        return limite, DECIMAL_ZERO, DECIMAL_ZERO, _money(saldo / Decimal(max(limite, 1))), fluxo, saldo

    meses_planejados = int(fluxo[-1]["mes"])
    mensal_medio = _money(total_alocado / Decimal(max(meses_planejados, 1)))
    parcela_ideal = _money(pro_soluto_pos / Decimal(max(limite, 1)))
    capacidade_total = _money(capacidade * Decimal(meses_planejados))
    saldo = _money(max(saldo - total_alocado, DECIMAL_ZERO))
    return meses_planejados, mensal_medio, capacidade_total, parcela_ideal, fluxo, saldo


def _total_pago_cliente_creditur_fluxo(
    *,
    valor_captacao_inicial: Decimal,
    total_extras_pre: Decimal,
    total_extras_pos: Decimal,
    fluxo_pre_entrega: list[dict[str, Any]],
    fluxo_pos_creditur: list[dict[str, Any]],
) -> Decimal:
    total_pre = _money(
        sum((_money(item.get("parcela_7lm")) for item in fluxo_pre_entrega), DECIMAL_ZERO)
    )
    total_pos = _money(
        sum((_money(item.get("parcela_7lm")) for item in fluxo_pos_creditur), DECIMAL_ZERO)
    )
    retencao_pre = _money(total_pre * CREDITUR_RETENCAO_PERCENTUAL)
    return _money(valor_captacao_inicial + total_extras_pre + max(total_pre - retencao_pre, DECIMAL_ZERO) + total_pos + total_extras_pos)


def _atualizar_parcela_pre_creditur(item: dict[str, Any], valor_7lm: Decimal) -> None:
    parcela_7lm = _money(max(valor_7lm, DECIMAL_ZERO))
    parcela_banco = _money(item.get("parcela_banco_obra"))
    extras_mes = _money(item.get("extras_mes"))
    item["parcela_7lm"] = parcela_7lm
    item["valor_total_cliente"] = _money(parcela_banco + parcela_7lm)
    item["valor_total_comprometido"] = _money(item["valor_total_cliente"] + extras_mes)


def _reduzir_fluxo_creditur_por_excesso(
    *,
    valor_total_operacao: Decimal,
    valor_captacao_inicial: Decimal,
    total_extras_pre: Decimal,
    total_extras_pos: Decimal,
    fluxo_pre_entrega: list[dict[str, Any]],
    fluxo_pos_creditur: list[dict[str, Any]],
) -> Decimal:
    def excesso_atual() -> Decimal:
        total = _total_pago_cliente_creditur_fluxo(
            valor_captacao_inicial=valor_captacao_inicial,
            total_extras_pre=total_extras_pre,
            total_extras_pos=total_extras_pos,
            fluxo_pre_entrega=fluxo_pre_entrega,
            fluxo_pos_creditur=fluxo_pos_creditur,
        )
        return _money(max(total - valor_total_operacao, DECIMAL_ZERO))

    excesso_inicial = excesso_atual()
    if excesso_inicial <= DECIMAL_ZERO:
        return DECIMAL_ZERO

    for item in reversed(fluxo_pos_creditur):
        excesso = excesso_atual()
        if excesso <= DECIMAL_ZERO:
            break
        parcela_atual = _money(item.get("parcela_7lm"))
        if parcela_atual <= DECIMAL_ZERO:
            continue
        reducao = _money(min(parcela_atual, excesso))
        item["parcela_7lm"] = _money(parcela_atual - reducao)

    fator_liquido_pre = _money(Decimal("1") - CREDITUR_RETENCAO_PERCENTUAL)
    for item in reversed(fluxo_pre_entrega):
        excesso = excesso_atual()
        if excesso <= DECIMAL_ZERO:
            break
        parcela_atual = _money(item.get("parcela_7lm"))
        if parcela_atual <= DECIMAL_ZERO:
            continue
        reducao_necessaria = _money(
            (excesso / fator_liquido_pre).quantize(Decimal("0.01"), rounding=ROUND_CEILING)
        ) if fator_liquido_pre > DECIMAL_ZERO else parcela_atual
        reducao = _money(min(parcela_atual, reducao_necessaria))
        _atualizar_parcela_pre_creditur(item, _money(parcela_atual - reducao))

    return _money(excesso_inicial - excesso_atual())


def _agrupar_intervalos_creditur_ajustados(
    *,
    fluxo_pre_entrega: list[dict[str, Any]],
    fluxo_pos_creditur: list[dict[str, Any]],
    meses_pre: int,
) -> list[dict[str, Decimal | int]]:
    intervalos: list[dict[str, Decimal | int]] = []

    def adicionar(numero_parcela: int, valor: Decimal) -> None:
        valor_parcela = _money(valor)
        if numero_parcela <= 0 or valor_parcela <= DECIMAL_ZERO:
            return
        if intervalos and intervalos[-1]["parcela_fim"] == numero_parcela - 1 and intervalos[-1]["valor"] == valor_parcela:
            intervalos[-1]["parcela_fim"] = numero_parcela
            return
        intervalos.append(
            {
                "parcela_inicio": numero_parcela,
                "parcela_fim": numero_parcela,
                "valor": valor_parcela,
            }
        )

    for item in sorted(fluxo_pre_entrega, key=lambda linha: int(linha.get("parcela") or linha.get("mes") or 0)):
        numero = int(item.get("parcela") or item.get("mes") or 0)
        adicionar(numero, _money(item.get("parcela_7lm")))

    offset = max(int(meses_pre or 0), 0)
    for item in sorted(fluxo_pos_creditur, key=lambda linha: int(linha.get("parcela") or linha.get("mes") or 0)):
        numero = offset + int(item.get("parcela") or item.get("mes") or 0)
        adicionar(numero, _money(item.get("parcela_7lm")))

    return intervalos


def _montar_fluxo_obra_pre_entrega(
    *,
    meses_pre: int,
    limite_comprometimento: Decimal,
    parcela_financiamento_banco: Decimal,
    percentual_conclusao_obra: Decimal,
    mensal_pre_total: Decimal,
    extras_por_mes: dict[int, Decimal],
    parcela_pre_manual: Decimal = DECIMAL_ZERO,
    capacidade_pre_7lm: Decimal | None = None,
    preservar_parcela_pre_manual: bool = False,
    intervalos_creditur: list[dict[str, Any]] | None = None,
) -> list[dict[str, Decimal | int]]:
    if meses_pre <= 0:
        return []

    percentual_inicial = _percentual_obra(percentual_conclusao_obra)
    incremento_total = max(DECIMAL_100 - percentual_inicial, DECIMAL_ZERO)
    divisor_incremento = Decimal(max(meses_pre - 1, 1))
    fluxo: list[dict[str, Decimal | int]] = []

    for mes in range(1, meses_pre + 1):
        if meses_pre <= 1:
            percentual_mes = DECIMAL_100
        else:
            percentual_mes = _percent(percentual_inicial + (incremento_total * Decimal(mes - 1) / divisor_incremento))
        if percentual_mes > DECIMAL_100:
            percentual_mes = DECIMAL_100
        parcela_banco_obra = _money(parcela_financiamento_banco * (percentual_mes / DECIMAL_100))
        extras_mes = _money(extras_por_mes.get(mes, DECIMAL_ZERO))
        capacidade_base = _money(capacidade_pre_7lm) if capacidade_pre_7lm is not None else _money(limite_comprometimento - parcela_banco_obra)
        capacidade_7lm = _money(max(capacidade_base, DECIMAL_ZERO))
        fluxo.append(
            {
                "mes": mes,
                "percentual_conclusao_obra": percentual_mes,
                "parcela_banco_obra": parcela_banco_obra,
                "extras_mes": extras_mes,
                "capacidade_parcela_7lm": capacidade_7lm,
                "parcela_7lm": DECIMAL_ZERO,
                "valor_total_cliente": parcela_banco_obra,
                "valor_total_comprometido": _money(parcela_banco_obra + extras_mes),
            }
        )

    restante = _money(mensal_pre_total)
    if restante <= DECIMAL_ZERO:
        return fluxo

    capacidades = [_money(item["capacidade_parcela_7lm"]) for item in fluxo]
    if intervalos_creditur:
        for indice, item in enumerate(fluxo):
            if restante <= DECIMAL_ZERO:
                break
            mes = int(item.get("mes") or indice + 1)
            valor_programado = _valor_creditur_por_parcela(intervalos_creditur, mes)
            if valor_programado <= DECIMAL_ZERO:
                continue
            parcela_7lm = _money(min(valor_programado, restante))
            item["parcela_7lm"] = parcela_7lm
            item["valor_total_cliente"] = _money(item["parcela_banco_obra"] + parcela_7lm)
            item["valor_total_comprometido"] = _money(item["valor_total_cliente"] + item["extras_mes"])
            restante = _money(max(restante - parcela_7lm, DECIMAL_ZERO))
        return fluxo

    parcela_pre_fixa = _money(max(parcela_pre_manual, DECIMAL_ZERO))
    if parcela_pre_fixa > DECIMAL_ZERO:
        for indice, item in enumerate(fluxo):
            if restante <= DECIMAL_ZERO:
                break
            parcela_7lm = _money(min(parcela_pre_fixa, restante))
            if not preservar_parcela_pre_manual:
                parcela_7lm = _money(min(capacidades[indice], parcela_7lm))
            item["parcela_7lm"] = parcela_7lm
            item["valor_total_cliente"] = _money(item["parcela_banco_obra"] + parcela_7lm)
            item["valor_total_comprometido"] = _money(item["valor_total_cliente"] + item["extras_mes"])
            restante = _money(max(restante - parcela_7lm, DECIMAL_ZERO))
        return fluxo

    for indice, item in enumerate(fluxo):
        if restante <= DECIMAL_ZERO:
            break
        capacidade_atual = capacidades[indice]
        meses_restantes = len(fluxo) - indice
        capacidade_futura = _money(sum(capacidades[indice + 1 :], DECIMAL_ZERO))
        minimo_agora = _money(max(restante - capacidade_futura, DECIMAL_ZERO))
        ideal_agora = _money(restante / Decimal(max(meses_restantes, 1)))
        parcela_7lm = _money(min(capacidade_atual, max(minimo_agora, ideal_agora)))
        if indice == len(fluxo) - 1:
            parcela_7lm = _money(min(capacidade_atual, restante))
        item["parcela_7lm"] = parcela_7lm
        item["valor_total_cliente"] = _money(item["parcela_banco_obra"] + parcela_7lm)
        item["valor_total_comprometido"] = _money(item["valor_total_cliente"] + item["extras_mes"])
        restante = _money(max(restante - parcela_7lm, DECIMAL_ZERO))

    return fluxo


def _aplicar_parcelas_7lm_personalizadas_pre(
    fluxo_base: list[dict[str, Any]],
    parcelas: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    valores_por_mes = {
        int(item.get("mes") or 0): item
        for item in parcelas
        if item.get("fase") == "pre"
    }
    fluxo: list[dict[str, Any]] = []
    for item in fluxo_base:
        mes = int(item.get("mes") or 0)
        personalizado = valores_por_mes.get(mes)
        valor_7lm = _money(personalizado.get("valor")) if personalizado else DECIMAL_ZERO
        linha = dict(item)
        linha["parcela_7lm"] = valor_7lm
        linha["valor_total_cliente"] = _money(_money(linha.get("parcela_banco_obra")) + valor_7lm)
        linha["valor_total_comprometido"] = _money(linha["valor_total_cliente"] + _money(linha.get("extras_mes")))
        if personalizado:
            linha["parcela_personalizada"] = True
            if personalizado.get("data"):
                linha["vencimento"] = personalizado["data"]
        fluxo.append(linha)
    return fluxo


def _montar_fluxo_7lm_personalizado_pos(
    parcelas: list[dict[str, Any]],
    *,
    capacidade_pos_7lm: Decimal,
) -> list[dict[str, Any]]:
    fluxo: list[dict[str, Any]] = []
    for item in parcelas:
        if item.get("fase") != "pos":
            continue
        linha = {
            "mes": int(item.get("mes") or 1),
            "parcela": int(item.get("parcela") or 1),
            "parcela_7lm": _money(item.get("valor")),
            "capacidade_parcela_7lm": _money(capacidade_pos_7lm),
            "parcela_personalizada": True,
        }
        if item.get("data"):
            linha["vencimento"] = item["data"]
        fluxo.append(linha)
    return sorted(fluxo, key=lambda item: int(item.get("parcela") or item.get("mes") or 0))


def _limite_meses_pos_entrega_por_prazo_total(meses_pre: int) -> int:
    meses_pre_normalizado = min(max(int(meses_pre or 0), 0), MAXIMO_MESES_TOTAIS_SIMULACAO)
    return max(MAXIMO_MESES_TOTAIS_SIMULACAO - meses_pre_normalizado, 0)


def _limite_meses_pos_creditur(meses_pre: int) -> int:
    meses_pre_normalizado = min(max(int(meses_pre or 0), 0), CREDITUR_MAXIMO_MESES_TOTAIS)
    return max(CREDITUR_MAXIMO_MESES_TOTAIS - meses_pre_normalizado, 0)


def _normalizar_prazos_simulacao(
    meses_pre_origem: Any,
    meses_pos_origem: Any,
    parceiro_simulacao: Any = PARCEIRO_SIMULACAO_PADRAO,
) -> tuple[int, int, int, int]:
    creditur = _is_creditur(parceiro_simulacao)
    limite_pre = CREDITUR_MAXIMO_MESES_PRE_CHAVES if creditur else MAXIMO_MESES_TOTAIS_SIMULACAO
    meses_pre_padrao = CREDITUR_PADRAO_MESES_PRE_CHAVES if creditur else 20
    meses_pos_padrao = None if creditur else None
    meses_pre = int(meses_pre_padrao if meses_pre_origem in (None, "") else meses_pre_origem)
    if meses_pre < 1:
        meses_pre = 1
    if meses_pre > limite_pre:
        meses_pre = limite_pre

    limite_padrao = _limite_meses_pos_creditur(meses_pre) if creditur else _limite_meses_pos_entrega_por_prazo_total(meses_pre)
    if meses_pos_origem in (None, ""):
        meses_pos_solicitado = int(min(meses_pos_padrao, limite_padrao) if meses_pos_padrao is not None else limite_padrao)
    else:
        meses_pos_solicitado = int(meses_pos_origem)

    if meses_pos_solicitado < 0:
        meses_pos_solicitado = 0

    limite_meses_pos = _limite_meses_pos_creditur(meses_pre) if creditur else _limite_meses_pos_entrega_por_prazo_total(meses_pre)
    meses_pos = limite_meses_pos if creditur else min(meses_pos_solicitado, limite_meses_pos)
    return meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado


def _definir_alvo_pre_entrega(
    *,
    pro_soluto_total: Decimal,
    meses_pre: int,
    meses_pos_configurado: int,
    valor_captacao_entrega_base: Decimal,
    valor_garantido_pre_obra_planejado: Decimal,
    capacidade_pos_7lm: Decimal,
) -> Decimal:
    if pro_soluto_total <= DECIMAL_ZERO:
        return DECIMAL_ZERO

    pre_planejado_minimo = _money(
        max(valor_garantido_pre_obra_planejado - valor_captacao_entrega_base, DECIMAL_ZERO)
    )

    if meses_pos_configurado <= 0:
        return _money(max(pre_planejado_minimo, pro_soluto_total))

    total_meses_fluxo = max(meses_pre + meses_pos_configurado, 1)
    pre_distribuido = _money(
        pro_soluto_total * (Decimal(meses_pre) / Decimal(total_meses_fluxo))
    )
    capacidade_pos_total = _money(capacidade_pos_7lm * Decimal(max(meses_pos_configurado, 0)))
    pre_necessario_para_respeitar_prazo = _money(
        max(pro_soluto_total - capacidade_pos_total, DECIMAL_ZERO)
    )

    return _money(
        min(
            pro_soluto_total,
            max(pre_planejado_minimo, pre_distribuido, pre_necessario_para_respeitar_prazo),
        )
    )


def _gerar_demonstrativo_parcelas(
    *,
    renda_total: Decimal,
    entrada: Decimal,
    fluxo_pre_entrega: list[dict[str, Any]],
    mensal_pos: Decimal,
    parcela_financiamento_banco: Decimal,
    capacidade_pos_7lm: Decimal,
    meses_pre: int,
    meses_pos: int,
    data_entrega: date | None,
    intermediaria_valor: Decimal,
    intermediaria_qtd: int,
    intermediaria_itens: list[dict[str, Any]] | None = None,
    anual_valor: Decimal,
    anual_qtd: int,
    semestral_valor: Decimal,
    semestral_qtd: int,
    reforco_valor: Decimal,
    reforco_qtd: int,
    intermediaria_datas: Any = None,
    anual_primeira_data: Any = None,
    semestral_primeira_data: Any = None,
    fluxo_pos_entrega: list[dict[str, Any]] | None = None,
    creditur_ativo: bool = False,
) -> list[dict[str, Any]]:
    hoje = date.today()
    limite_entrega = data_entrega or _add_months(hoje, max(int(meses_pre or 0), 1))
    parcelas: list[dict[str, Any]] = []

    def fase_por_mes(mes: int) -> str:
        return "pre_entrega" if mes <= meses_pre else "pos_entrega"

    def adicionar(
        *,
        fase: str,
        tipo: str,
        numero: int,
        vencimento: date,
        valor: Decimal,
        observacao: str,
        valor_7lm: Decimal | None = None,
        parcela_banco_obra: Decimal = DECIMAL_ZERO,
        percentual_conclusao_obra: Decimal | None = None,
        capacidade_parcela_7lm: Decimal | None = None,
        valor_total_cliente: Decimal | None = None,
        parcela_personalizada: bool = False,
    ):
        valor_7lm_final = _money(valor if valor_7lm is None else valor_7lm)
        parcela_banco_final = _money(parcela_banco_obra)
        valor_total_final = _money(valor_total_cliente if valor_total_cliente is not None else valor_7lm_final + parcela_banco_final)
        if valor <= DECIMAL_ZERO and valor_total_final <= DECIMAL_ZERO:
            return
        percentual_renda = _percent(valor_total_final / renda_total) if renda_total > DECIMAL_ZERO else Decimal("1")
        parcelas.append(
            {
                "fase": fase,
                "tipo": tipo,
                "parcela": numero,
                "vencimento": vencimento,
                "valor": valor_total_final,
                "valor_7lm": valor_7lm_final,
                "parcela_banco_obra": parcela_banco_final,
                "valor_total_cliente": valor_total_final,
                "percentual_conclusao_obra": _percent(percentual_conclusao_obra or DECIMAL_ZERO),
                "capacidade_parcela_7lm": _money(capacidade_parcela_7lm or DECIMAL_ZERO),
                "percentual_renda": percentual_renda,
                "observacao": observacao,
                "parcela_personalizada": bool(parcela_personalizada),
            }
        )

    adicionar(
        fase="pre_entrega",
        tipo="entrada_sinal",
        numero=1,
        vencimento=hoje,
        valor=entrada,
        observacao="Sinal de fechamento comercial.",
    )

    for item in fluxo_pre_entrega:
        adicionar(
            fase="pre_entrega",
            tipo="mensal_pre",
            numero=int(item.get("mes") or 1),
            vencimento=item.get("vencimento") if isinstance(item.get("vencimento"), date) else _add_months(hoje, int(item.get("mes") or 1)),
            valor=_money(item.get("valor_total_cliente")),
            valor_7lm=_money(item.get("parcela_7lm")),
            parcela_banco_obra=_money(item.get("parcela_banco_obra")),
            percentual_conclusao_obra=_percent(item.get("percentual_conclusao_obra") or DECIMAL_ZERO),
            capacidade_parcela_7lm=_money(item.get("capacidade_parcela_7lm")),
            valor_total_cliente=_money(item.get("valor_total_cliente")),
            observacao=(
                "Parcela Creditú fixa conforme intervalo configurado."
                if creditur_ativo
                else "Parcela 7LM informada manualmente no prazo do fluxo."
                if item.get("parcela_personalizada")
                else "Parcela 7LM ajustada pela evolução da obra e pela parcela proporcional do banco."
            ),
            parcela_personalizada=bool(item.get("parcela_personalizada")),
        )

    itens_intermediarias = intermediaria_itens or []
    if itens_intermediarias:
        for indice, item in enumerate(itens_intermediarias):
            valor_evento = _money(item.get("valor"))
            if valor_evento <= DECIMAL_ZERO:
                continue
            data_evento = _normalizar_data_evento(item.get("data"))
            if data_evento and data_evento < hoje:
                continue
            deslocamento = _mes_relativo_data_evento(data_evento, hoje)
            if deslocamento is None:
                deslocamento = max(1, int(((indice + 1) * meses_pre) / (len(itens_intermediarias) + 1)))
            deslocamento = max(1, deslocamento)
            if not data_evento and (deslocamento > meses_pre or deslocamento > MAXIMO_MESES_TOTAIS_SIMULACAO):
                continue
            adicionar(
                fase=fase_por_mes(deslocamento),
                tipo="intermediaria",
                numero=indice + 1,
                vencimento=data_evento or _add_months(hoje, deslocamento),
                valor=valor_evento,
                observacao="Intermediaria planejada para reforcar pre-entrega.",
            )
    elif intermediaria_qtd > 0 and intermediaria_valor > DECIMAL_ZERO:
        datas_intermediarias = _normalizar_lista_datas_eventos(intermediaria_datas)
        for indice in range(intermediaria_qtd):
            data_evento = datas_intermediarias[indice] if indice < len(datas_intermediarias) else None
            if data_evento and data_evento < hoje:
                continue
            deslocamento = _mes_relativo_data_evento(data_evento, hoje)
            if deslocamento is None:
                deslocamento = max(1, int(((indice + 1) * meses_pre) / (intermediaria_qtd + 1)))
            deslocamento = max(1, deslocamento)
            if not data_evento and (deslocamento > meses_pre or deslocamento > MAXIMO_MESES_TOTAIS_SIMULACAO):
                continue
            adicionar(
                fase=fase_por_mes(deslocamento),
                tipo="intermediaria",
                numero=indice + 1,
                vencimento=data_evento or _add_months(hoje, deslocamento),
                valor=intermediaria_valor,
                observacao="Intermediaria planejada para reforcar pre-entrega.",
            )

    if anual_qtd > 0 and anual_valor > DECIMAL_ZERO:
        for numero, deslocamento, vencimento in _ocorrencias_recorrentes_pre_entrega(
            quantidade=anual_qtd,
            primeira_data=anual_primeira_data,
            intervalo_meses=12,
            data_contrato=hoje,
            data_entrega=data_entrega,
            meses_pre=meses_pre,
            fallback_mes=12,
            limitar_data_entrega=False,
        ):
            adicionar(
                fase=fase_por_mes(deslocamento),
                tipo="anual",
                numero=numero,
                vencimento=vencimento,
                valor=anual_valor,
                observacao="Parcela anual de reforco.",
            )

    if semestral_qtd > 0 and semestral_valor > DECIMAL_ZERO:
        for numero, deslocamento, vencimento in _ocorrencias_recorrentes_pre_entrega(
            quantidade=semestral_qtd,
            primeira_data=semestral_primeira_data,
            intervalo_meses=6,
            data_contrato=hoje,
            data_entrega=data_entrega,
            meses_pre=meses_pre,
            fallback_mes=6,
            limitar_data_entrega=False,
        ):
            adicionar(
                fase=fase_por_mes(deslocamento),
                tipo="semestral",
                numero=numero,
                vencimento=vencimento,
                valor=semestral_valor,
                observacao="Parcela semestral de reforco.",
            )

    if reforco_qtd > 0 and reforco_valor > DECIMAL_ZERO:
        for indice in range(reforco_qtd):
            deslocamento = max(1, int(((indice + 1) * meses_pre) / (reforco_qtd + 1)))
            adicionar(
                fase="pre_entrega",
                tipo="reforco",
                numero=indice + 1,
                vencimento=_add_months(hoje, deslocamento),
                valor=reforco_valor,
                observacao="Reforco comercial de equilibrio de fluxo.",
            )

    fluxo_pos_customizado = list(fluxo_pos_entrega or [])
    if fluxo_pos_customizado:
        for item in fluxo_pos_customizado:
            indice = int(item.get("mes") or 1)
            adicionar(
                fase="pos_entrega",
                tipo="mensal_pos_7lm",
                numero=int(item.get("parcela") or indice),
                vencimento=item.get("vencimento") if isinstance(item.get("vencimento"), date) else _add_months(hoje, meses_pre + indice),
                valor=_money(item.get("parcela_7lm")),
                valor_7lm=_money(item.get("parcela_7lm")),
                parcela_banco_obra=parcela_financiamento_banco,
                percentual_conclusao_obra=DECIMAL_100,
                capacidade_parcela_7lm=_money(item.get("capacidade_parcela_7lm") or capacidade_pos_7lm),
                observacao="Parcela pós-chaves 7LM informada manualmente no prazo do fluxo." if item.get("parcela_personalizada") else "Parcela pós-chaves financiada pela 7LM conforme intervalo de parcelas informado.",
                parcela_personalizada=bool(item.get("parcela_personalizada")),
            )
    elif meses_pos <= 0 and mensal_pos > DECIMAL_ZERO:
        adicionar(
            fase="pos_entrega",
            tipo="saldo_pos",
            numero=1,
            vencimento=_add_months(hoje, meses_pre + 1),
            valor=mensal_pos,
            valor_7lm=mensal_pos,
            parcela_banco_obra=parcela_financiamento_banco,
            percentual_conclusao_obra=DECIMAL_100,
            capacidade_parcela_7lm=capacidade_pos_7lm,
            observacao="Saldo pos-entrega sem parcelamento configurado, considerando a parcela cheia do banco.",
        )
    elif mensal_pos > DECIMAL_ZERO:
        for indice in range(meses_pos):
            adicionar(
                fase="pos_entrega",
                tipo="mensal_pos",
                numero=indice + 1,
                vencimento=_add_months(hoje, meses_pre + indice + 1),
                valor=mensal_pos,
                valor_7lm=mensal_pos,
                parcela_banco_obra=parcela_financiamento_banco,
                percentual_conclusao_obra=DECIMAL_100,
                capacidade_parcela_7lm=capacidade_pos_7lm,
                observacao="Parcela pos-entrega para fechamento da operação, somada a parcela cheia do banco.",
            )

    return parcelas


def _parcela_cliente_minima(limite_comprometimento: Decimal) -> Decimal:
    limite = _money(limite_comprometimento)
    if limite <= DECIMAL_ZERO:
        return PARCELA_CLIENTE_MINIMA
    return _money(min(PARCELA_CLIENTE_MINIMA, limite))


def _resolver_limite_comprometimento(payload: dict[str, Any], renda_total: Decimal) -> tuple[Decimal, Decimal]:
    limite_padrao = _money(_money(renda_total) * LIMITE_COMPROMETIMENTO_PADRAO)
    parcela_informada = _money(payload.get("parcela_cliente_maxima"))

    if parcela_informada <= DECIMAL_ZERO:
        return limite_padrao, limite_padrao

    if limite_padrao <= DECIMAL_ZERO:
        return parcela_informada, limite_padrao

    parcela_minima = _parcela_cliente_minima(limite_padrao)
    return _money(min(max(parcela_informada, parcela_minima), limite_padrao)), limite_padrao


def _resolver_parcela_cliente_informada(payload: dict[str, Any], limite_comprometimento_padrao: Decimal) -> Decimal:
    parcela_informada = _money(payload.get("parcela_cliente_maxima"))
    if parcela_informada <= DECIMAL_ZERO:
        return DECIMAL_ZERO

    limite_padrao = _money(limite_comprometimento_padrao)
    if limite_padrao <= DECIMAL_ZERO:
        return parcela_informada

    parcela_minima = _parcela_cliente_minima(limite_padrao)
    return _money(min(max(parcela_informada, parcela_minima), limite_padrao))


def _classificar_status_comercial(
    *,
    valor_total_operacao: Decimal,
    status_imovel: str,
    valor_garantido_real: Decimal,
    valor_garantido_planejado: Decimal,
    valor_garantido_pre_obra_real: Decimal,
    valor_garantido_pre_obra_planejado: Decimal,
    status_simulacao: str,
) -> str:
    if valor_total_operacao <= DECIMAL_ZERO:
        return STATUS_SIMULACAO_INVALIDA

    if _normalizar_status_imovel(status_imovel) in ("reservado", "vendido", "inativo"):
        return STATUS_SIMULACAO_INVALIDA

    garantido_encaixado = (
        valor_garantido_planejado > DECIMAL_ZERO
        and valor_garantido_real >= valor_garantido_planejado
    )
    pre_obra_encaixado = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or valor_garantido_pre_obra_real >= valor_garantido_pre_obra_planejado
    )

    if not garantido_encaixado:
        return STATUS_SIMULACAO_INVALIDA

    if not pre_obra_encaixado:
        return STATUS_SIMULACAO_ATENCAO

    if garantido_encaixado and pre_obra_encaixado:
        return STATUS_SIMULACAO_IDEAL

    if _limpar_texto(status_simulacao).lower() in (STATUS_SIMULACAO_INVALIDA, "invalida"):
        return STATUS_SIMULACAO_INVALIDA

    return STATUS_SIMULACAO_IDEAL


def _sugerir_reforco_pre_obra(
    *,
    valor_necessario: Decimal,
    meses_pre: int,
) -> dict[str, Any] | None:
    necessario = _money(valor_necessario)
    meses_pre_normalizados = max(int(meses_pre or 0), 0)

    if necessario <= DECIMAL_ZERO or meses_pre_normalizados <= 0:
        return None

    opcoes: list[tuple[str, list[int]]] = []

    meses_anuais = [mes for mes in range(12, meses_pre_normalizados + 1, 12)]
    if meses_anuais:
        opcoes.append(("anual", meses_anuais))

    meses_semestrais = [mes for mes in range(6, meses_pre_normalizados + 1, 6)]
    if meses_semestrais:
        opcoes.append(("semestral", meses_semestrais))

    quantidade_intermediarias = min(3, meses_pre_normalizados)
    meses_intermediarios = sorted(
        {
            max(1, min(meses_pre_normalizados, int(((indice + 1) * meses_pre_normalizados) / (quantidade_intermediarias + 1))))
            for indice in range(quantidade_intermediarias)
        }
    )
    if meses_intermediarios:
        opcoes.append(("intermediaria", meses_intermediarios))

    melhor_plano: dict[str, Any] | None = None

    for tipo, meses in opcoes:
        quantidade = len(meses)
        if quantidade <= 0:
            continue
        valor_unitario = _money((necessario / Decimal(quantidade)).quantize(Decimal("0.01"), rounding=ROUND_CEILING))
        plano = {
            "tipo": tipo,
            "quantidade": quantidade,
            "valor_unitario": valor_unitario,
            "valor_total": _money(valor_unitario * Decimal(quantidade)),
            "meses_referencia": meses,
        }

        if melhor_plano is None:
            melhor_plano = plano
            continue

        if quantidade < melhor_plano["quantidade"]:
            melhor_plano = plano
            continue

        if quantidade == melhor_plano["quantidade"] and valor_unitario < melhor_plano["valor_unitario"]:
            melhor_plano = plano

    if melhor_plano is None:
        return None

    descricoes = {
        "anual": "parcela anual",
        "semestral": "parcela semestral",
        "intermediaria": "parcela intermediaria",
    }
    melhor_plano["descrição"] = (
        f"Use {melhor_plano['quantidade']} {descricoes.get(melhor_plano['tipo'], 'reforcos')} de "
        f"{_moeda_texto(melhor_plano['valor_unitario'])} para fortalecer o pré-obra."
    )
    return melhor_plano


def _avaliar_status_geral(
    *,
    percentual_comprometimento: Decimal,
    limite_comprometimento: Decimal,
    parcela_financiamento_banco: Decimal,
    valor_garantido_real: Decimal,
    valor_garantido_planejado: Decimal,
    parcela_7lm_media_pre: Decimal,
    valor_parcela_minima_pre_obra: Decimal,
    valor_garantido_pre_obra_real: Decimal,
    valor_garantido_pre_obra_planejado: Decimal,
    classificacao_entrega: str,
    status_imovel: str,
    valor_total_operacao: Decimal,
) -> tuple[str, list[str], list[str]]:
    bloqueios: list[str] = []
    atenções: list[str] = []
    garantido_encaixado = valor_garantido_planejado > DECIMAL_ZERO and valor_garantido_real >= valor_garantido_planejado
    pre_obra_encaixado = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or valor_garantido_pre_obra_real >= valor_garantido_pre_obra_planejado
    )
    gatilhos_comerciais_encaixados = garantido_encaixado and pre_obra_encaixado

    if valor_total_operacao <= DECIMAL_ZERO:
        bloqueios.append("Valor total da operação inválido.")

    if percentual_comprometimento > LIMITE_COMPROMETIMENTO_PADRAO:
        if gatilhos_comerciais_encaixados:
            atenções.append(
                "Fluxo possui parcela pontual acima da referência mensal; validar combinados no demonstrativo."
            )
        else:
            bloqueios.append("Comprometimento de renda acima da trava de 45%.")

    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        bloqueios.append(
            f"Parcela mídia de pré-obra abaixo do mínimo da unidade ({_moeda_texto(valor_parcela_minima_pre_obra)})."
        )

    if valor_garantido_real < valor_garantido_planejado:
        atenções.append(
            f"Estrutura inicial abaixo do garantido planejado da unidade ({_moeda_texto(valor_garantido_planejado)})."
        )

    if (
        valor_garantido_pre_obra_planejado > DECIMAL_ZERO
        and valor_garantido_pre_obra_real < valor_garantido_pre_obra_planejado
    ):
        atenções.append(
            "Fluxo até a entrega ainda abaixo do planejado. Ajuste a entrada ou a distribuicao do pro-soluto."
        )

    if classificacao_entrega == CLASSIFICACAO_INVALIDA:
        atenções.append("Projecao de entrega abaixo da meta comercial configurada para a unidade.")
    elif classificacao_entrega == CLASSIFICACAO_ATENCAO:
        atenções.append("A operação respeita o prazo configurado, mas ainda pode ganhar mais forca até a entrega.")

    status_normalizado = _normalizar_status_imovel(status_imovel)
    if status_normalizado in ("reservado", "vendido", "inativo"):
        if status_normalizado == "reservado":
            bloqueios.append("Imóvel reservado no momento. Selecione unidade disponivel.")
        elif status_normalizado == "vendido":
            bloqueios.append("Imovel vendido e indisponivel para nova operação.")
        else:
            bloqueios.append("Imovel inativo para operação comercial.")

    if bloqueios:
        return STATUS_SIMULACAO_INVALIDA, bloqueios, atenções

    if gatilhos_comerciais_encaixados:
        return STATUS_SIMULACAO_IDEAL, bloqueios, atenções

    return STATUS_SIMULACAO_ATENCAO, bloqueios, atenções


def _gerar_sugestões_ajuste(
    *,
    valor_garantido_real: Decimal,
    valor_garantido_planejado: Decimal,
    parcela_7lm_media_pre: Decimal,
    valor_parcela_minima_pre_obra: Decimal,
    valor_garantido_pre_obra_real: Decimal,
    valor_garantido_pre_obra_planejado: Decimal,
    percentual_projetado_entrega: Decimal,
    percentual_comprometimento: Decimal,
) -> list[str]:
    sugestões: list[str] = []

    if percentual_comprometimento > LIMITE_COMPROMETIMENTO_PADRAO:
        sugestões.append("Aumentar entrada ou renda complementar para reduzir a pressao mensal.")

    if valor_garantido_real < valor_garantido_planejado:
        sugestões.append(
            f"Reforcar entrada ou FGTS para levar o garantido real até {_moeda_texto(valor_garantido_planejado)}."
        )

    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        sugestões.append(
            f"Esta unidade exige ao menos {_moeda_texto(valor_parcela_minima_pre_obra)} de parcela pré-obra. Priorize um imovel com encaixe natural maior ou revise a estrutura comercial."
        )

    if (
        valor_garantido_pre_obra_planejado > DECIMAL_ZERO
        and valor_garantido_pre_obra_real < valor_garantido_pre_obra_planejado
    ):
        sugestões.append("Aumente a captação até a entrega ou redistribua o pro-soluto para fortalecer o fluxo pré-obra.")

    if percentual_projetado_entrega < ENTREGA_MINIMO:
        sugestões.append("Redistribuir pro-soluto para elevar o percentual projetado até a entrega.")
    elif percentual_projetado_entrega < ENTREGA_REFERENCIA:
        sugestões.append("Aumentar ligeiramente o fluxo pre-entrega para aproximar a quitacao de 100%.")

    if not sugestões:
        sugestões.append("Cenario equilibrado. Mantenha os parametros para fechamento seguro.")

    return sugestões[:4]


def _resumo_cliente(cliente: dict[str, Any] | Any, complementos: list[dict[str, Any] | Any]) -> dict[str, Any]:
    cliente_linha = dict(cliente or {})

    renda_principal = _money(cliente_linha.get("renda_principal"))
    renda_total_cadastro = _money(cliente_linha.get("renda_total"))
    renda_conjuge = _money(cliente_linha.get("renda_conjuge"))
    outras_rendas = _money(cliente_linha.get("outras_rendas"))

    base_complementar = _money(renda_conjuge + outras_rendas)

    complementos_serializados = [serializar_complemento_renda(item) for item in (complementos or [])]
    membros_ativos = [
        item
        for item in complementos_serializados
        if item.get("ativo", True)
    ]
    membros_em_analise = [
        item
        for item in membros_ativos
        if item.get("incluir_na_analise", True)
    ]
    complementos_ativos = [
        item
        for item in membros_em_analise
        if item.get("compoe_renda", True)
        and item.get("incluir_na_composicao_financeira", True)
    ]
    renda_complementar_dinamica = _money(sum((_money(item.get("renda")) for item in complementos_ativos), DECIMAL_ZERO))

    renda_complementar_total = _money(base_complementar + renda_complementar_dinamica)
    renda_total = _money(renda_principal + renda_complementar_total)

    if renda_total <= DECIMAL_ZERO and renda_total_cadastro > DECIMAL_ZERO:
        renda_total = renda_total_cadastro

    if renda_principal <= DECIMAL_ZERO and renda_total > DECIMAL_ZERO:
        renda_principal = renda_total

    limite_comprometimento = _money(renda_total * LIMITE_COMPROMETIMENTO_PADRAO)

    return {
        "cliente": {
            "id": str(cliente_linha.get("identificador_cliente") or ""),
            "nome_completo": cliente_linha.get("nome_completo"),
            "cpf": cliente_linha.get("cpf"),
            "cidade": cliente_linha.get("cidade"),
            "email": cliente_linha.get("email"),
            "telefone": cliente_linha.get("telefone") or cliente_linha.get("celular"),
            "status_documental": cliente_linha.get("status_documental"),
            "aprovado": bool(cliente_linha.get("aprovado", True)),
        },
        "renda_principal": renda_principal,
        "renda_complementar": renda_complementar_total,
        "renda_total": renda_total,
        "limite_comprometimento": limite_comprometimento,
        "nucleo_familiar": {
            "total_membros": len(complementos_serializados),
            "membros_ativos": len(membros_ativos),
            "membros_em_analise": len(membros_em_analise),
            "membros_compoem_renda": len(complementos_ativos),
            "renda_complementar_ativa": renda_complementar_dinamica,
        },
        "complementos": complementos_serializados,
    }


def consolidar_nucleo_familiar(
    cliente: dict[str, Any] | Any,
    complementos: list[dict[str, Any] | Any],
) -> dict[str, Any]:
    return _resumo_cliente(cliente, complementos)

def calcular_simulacao_comercial(
    cliente: dict[str, Any] | Any,
    complementos: list[dict[str, Any] | Any],
    imovel: dict[str, Any] | Any,
    payload: dict[str, Any],
    *,
    incluir_demonstrativo: bool = True,
) -> dict[str, Any]:
    imovel_linha = dict(imovel or {})
    valor_imovel_base = _money(imovel_linha.get("valor"))
    valor_imovel = valor_imovel_base

    resumo_cliente = _resumo_cliente(cliente, complementos)
    renda_total = resumo_cliente["renda_total"]
    limite_comprometimento, limite_comprometimento_padrao = _resolver_limite_comprometimento(payload, renda_total)
    parcela_cliente_informada = _resolver_parcela_cliente_informada(payload, limite_comprometimento_padrao)
    resumo_cliente["limite_comprometimento"] = limite_comprometimento
    resumo_cliente["limite_comprometimento_padrao"] = limite_comprometimento_padrao
    resumo_cliente["parcela_cliente_maxima"] = limite_comprometimento
    resumo_cliente["parcela_cliente_informada"] = parcela_cliente_informada

    parametros = _coletar_parametros_financeiros(payload, valor_imovel, imovel_linha)
    parceiro_simulacao = _normalizar_parceiro_simulacao(payload.get("parceiro_simulacao"))
    simulacao_creditur = _is_creditur(parceiro_simulacao)
    simulacao_creditur_geral = _is_creditur_geral(parceiro_simulacao)
    creditu_geral = _normalizar_creditu_geral(payload) if simulacao_creditur_geral else None
    percentual_fechamento_minimo_configurado = _percentual_fechamento_minimo_imovel(
        imovel_linha.get("percentual_fechamento_minimo")
    )
    valor_referencia_comercial = valor_imovel_base
    valor_garantido_configurado = _money(imovel_linha.get("valor_garantido"))
    valor_garantido = _valor_garantido_imovel(
        valor_garantido_configurado,
        valor_referencia_comercial,
        percentual_fechamento_minimo_configurado,
    )
    percentual_fechamento_minimo = _percentual_fechamento_minimo_por_valor_garantido(
        valor_garantido,
        valor_referencia_comercial,
        percentual_fechamento_minimo_configurado,
    )
    valor_parcela_minima_pre_obra = _parcela_minima_pre_obra_imovel(
        imovel_linha.get("valor_parcela_minima_pre_obra")
    )
    valor_garantido_pre_obra_configurado = _money(imovel_linha.get("valor_garantido_pre_obra_planejado"))
    valor_garantido_pre_obra_planejado = _valor_garantido_pre_obra_planejado_imovel(
        valor_garantido_pre_obra_configurado,
        valor_referencia_comercial,
        imovel_linha.get("percentual_captacao_ate_entrega"),
    )
    percentual_captacao_ate_entrega = _percentual_captacao_ate_entrega_imovel(
        imovel_linha.get("percentual_captacao_ate_entrega"),
        valor_referencia_comercial,
        valor_garantido_pre_obra_planejado,
    )

    fechamento_percentual = _percent(
        parametros["valor_captacao_inicial"] / valor_referencia_comercial
    ) if valor_referencia_comercial > DECIMAL_ZERO else Decimal("0")

    data_entrega_imovel = normalizar_data(imovel_linha.get("data_entrega"), "data de entrega")
    data_entrega_resolvida = data_entrega_imovel or calcular_data_entrega_dinamica()
    if simulacao_creditur:
        meses_pre_origem = payload.get("meses_pre_entrega")
    else:
        meses_pre_entrega_real = calcular_meses_ate_entrega(data_entrega_imovel) if data_entrega_imovel else None
        if meses_pre_entrega_real in (None, ""):
            meses_pre_entrega_real = imovel_linha.get("meses_pre_entrega")
        if meses_pre_entrega_real in (None, ""):
            meses_pre_entrega_real = calcular_meses_ate_entrega_dinamica()
        meses_pre_origem = payload.get("meses_pre_entrega")
        if meses_pre_origem in (None, ""):
            meses_pre_origem = meses_pre_entrega_real
        else:
            meses_pre_origem = min(
                max(int(meses_pre_origem or 1), 1),
                max(int(meses_pre_entrega_real or 1), 1),
            )
    meses_pos_origem = payload.get("meses_pos_entrega")
    if meses_pos_origem in (None, "") and not simulacao_creditur:
        meses_pos_origem = imovel_linha.get("meses_pos_entrega")

    meses_pre, meses_pos, limite_meses_pos, meses_pos_solicitado = _normalizar_prazos_simulacao(
        meses_pre_origem,
        meses_pos_origem,
        parceiro_simulacao,
    )
    meses_pre_resumo = meses_pre
    meses_pos_resumo = meses_pos
    meses_pos_configurado_resumo = meses_pos
    if simulacao_creditur and not simulacao_creditur_geral:
        meses_pre_creditur_configurado = meses_pre
        meses_pos_creditur_configurado = meses_pos
        meses_pre_entrega_real_origem = calcular_meses_ate_entrega(data_entrega_imovel) if data_entrega_imovel else None
        if meses_pre_entrega_real_origem in (None, ""):
            meses_pre_entrega_real_origem = imovel_linha.get("meses_pre_entrega")
        if meses_pre_entrega_real_origem in (None, ""):
            meses_pre_entrega_real_origem = calcular_meses_ate_entrega_dinamica()
        try:
            meses_pre = int(meses_pre_entrega_real_origem)
        except Exception:
            meses_pre = CREDITUR_PADRAO_MESES_PRE_CHAVES
        meses_pre = min(max(meses_pre, 1), CREDITUR_MAXIMO_MESES_TOTAIS)
        meses_pos = _limite_meses_pos_creditur(meses_pre)
        limite_meses_pos = meses_pos
        meses_pos_solicitado = meses_pos
        meses_pre_resumo = meses_pre_creditur_configurado
        meses_pos_resumo = meses_pos_creditur_configurado
        meses_pos_configurado_resumo = meses_pos_creditur_configurado
    if simulacao_creditur_geral and creditu_geral:
        intervalos_creditur = _normalizar_intervalos_creditur(
            payload,
            CREDITUR_MAXIMO_MESES_TOTAIS,
            CREDITUR_PADRAO_MESES_PRE_CHAVES,
        ) or _intervalos_creditu_geral(creditu_geral)
    elif simulacao_creditur:
        intervalos_creditur = _normalizar_intervalos_creditur(payload, meses_pre + meses_pos, meses_pre)
    else:
        intervalos_creditur = []
    creditur_tem_curva_manual = bool(intervalos_creditur)
    creditur_planejamento_automatico = (
        simulacao_creditur
        and not creditur_tem_curva_manual
        and not payload.get("imovel_id")
    )
    parcelas_pre_entrega_sem_creditur: list[int] = []
    if simulacao_creditur and intervalos_creditur:
        parcelas_cobertas_pre_entrega: set[int] = set()
        for intervalo in intervalos_creditur:
            inicio = max(1, int(intervalo.get("parcela_inicio") or 0))
            fim = min(meses_pre, int(intervalo.get("parcela_fim") or inicio))
            if fim < inicio:
                continue
            parcelas_cobertas_pre_entrega.update(range(inicio, fim + 1))
        parcelas_pre_entrega_sem_creditur = [
            parcela
            for parcela in range(1, max(int(meses_pre or 0), 0) + 1)
            if parcela not in parcelas_cobertas_pre_entrega
        ]

    parcelas_intermediarias_personalizadas = _normalizar_parcelas_intermediarias_personalizadas(payload)
    parcelas_7lm_personalizadas = [] if simulacao_creditur else _normalizar_parcelas_7lm_personalizadas(
        payload,
        meses_pre=meses_pre,
        meses_pos=meses_pos,
    )
    fluxo_7lm_personalizado = bool(parcelas_7lm_personalizadas)
    total_intermediarias, qtd_intermediarias, valor_intermediaria = _resumir_parcelas_intermediarias(
        parcelas_intermediarias_personalizadas
    )
    total_anuais, qtd_anuais, valor_anual = _total_parcelamento(
        payload.get("parcela_anual_valor"),
        payload.get("parcelas_anuais_quantidade"),
    )
    total_semestrais, qtd_semestrais, valor_semestral = _total_parcelamento(
        payload.get("parcela_semestral_valor"),
        payload.get("parcelas_semestrais_quantidade"),
    )
    total_reforcos, qtd_reforcos, valor_reforco = _total_parcelamento(
        payload.get("parcela_reforco_valor"),
        payload.get("parcelas_reforco_quantidade"),
    )

    percentual_conclusao_obra = _percentual_obra(imovel_linha.get("percentual_conclusao_obra"))
    parcela_banco_atual_obra = _money(parametros["parcela_financiamento_banco"] * _fator_obra(percentual_conclusao_obra))
    extras_por_mes = _mapear_extras_pre_entrega(
        meses_pre=meses_pre,
        data_entrega=data_entrega_resolvida,
        intermediaria_valor=valor_intermediaria,
        intermediaria_qtd=qtd_intermediarias,
        intermediaria_itens=parcelas_intermediarias_personalizadas,
        anual_valor=valor_anual,
        anual_qtd=qtd_anuais,
        semestral_valor=valor_semestral,
        semestral_qtd=qtd_semestrais,
        reforco_valor=valor_reforco,
        reforco_qtd=qtd_reforcos,
        intermediaria_datas=payload.get("parcelas_intermediarias_datas"),
        anual_primeira_data=payload.get("parcela_anual_primeira_data"),
        semestral_primeira_data=payload.get("parcela_semestral_primeira_data"),
    )
    total_extras_agendados = _money(sum(extras_por_mes.values(), DECIMAL_ZERO))
    total_extras_pre = _money(sum((valor for mes, valor in extras_por_mes.items() if mes <= meses_pre), DECIMAL_ZERO))
    total_extras_pos = _money(max(total_extras_agendados - total_extras_pre, DECIMAL_ZERO))
    total_anuais_pre = _money(
        valor_anual
        * Decimal(
            len(
                _ocorrencias_recorrentes_pre_entrega(
                    quantidade=qtd_anuais,
                    primeira_data=payload.get("parcela_anual_primeira_data"),
                    intervalo_meses=12,
                    data_contrato=date.today(),
                    data_entrega=data_entrega_resolvida,
                    meses_pre=meses_pre,
                    fallback_mes=12,
                    limitar_data_entrega=False,
                )
            )
        )
    )
    total_semestrais_pre = _money(
        valor_semestral
        * Decimal(
            len(
                _ocorrencias_recorrentes_pre_entrega(
                    quantidade=qtd_semestrais,
                    primeira_data=payload.get("parcela_semestral_primeira_data"),
                    intervalo_meses=6,
                    data_contrato=date.today(),
                    data_entrega=data_entrega_resolvida,
                    meses_pre=meses_pre,
                    fallback_mes=6,
                    limitar_data_entrega=False,
                )
            )
        )
    )
    total_extras_programados = _money(total_intermediarias + total_anuais_pre + total_semestrais_pre + total_reforcos)
    total_extras_fora_do_fluxo = _money(max(total_extras_programados - total_extras_agendados, DECIMAL_ZERO))

    capacidade_pos_7lm = _money(max(limite_comprometimento - parametros["parcela_financiamento_banco"], DECIMAL_ZERO))
    capacidade_pre_7lm_atual = _money(max(limite_comprometimento - parcela_banco_atual_obra, DECIMAL_ZERO))
    parcela_pos_minima = _money(
        max(
            parametros["parcela_financiamento_banco"],
            _parcela_cliente_minima(capacidade_pos_7lm),
        )
    )
    parcela_pre_manual_raw = _money(payload.get("parcela_pre_obra_valor"))
    parcela_pos_manual_raw = _money(payload.get("parcela_pos_obra_valor"))
    parcela_pos_manual_informada = "parcela_pos_obra_valor" in payload
    parcela_pre_manual = _normalizar_parcela_manual_minima(parcela_pre_manual_raw, capacidade_pre_7lm_atual)
    parcela_pos_manual = _normalizar_parcela_manual_minima(parcela_pos_manual_raw, capacidade_pos_7lm)

    fluxo_capacidade_pre = _montar_fluxo_obra_pre_entrega(
        meses_pre=meses_pre,
        limite_comprometimento=limite_comprometimento,
        parcela_financiamento_banco=parametros["parcela_financiamento_banco"],
        percentual_conclusao_obra=percentual_conclusao_obra,
        mensal_pre_total=DECIMAL_ZERO,
        extras_por_mes=extras_por_mes,
    )
    capacidade_pre_total = _money(
        sum((_money(item.get("capacidade_parcela_7lm")) for item in fluxo_capacidade_pre), DECIMAL_ZERO)
    )
    total_creditur_pre_programado = _total_creditur_pre_programado(fluxo_capacidade_pre, intervalos_creditur)
    pro_soluto_pre_maximo = _money(min(parametros["pro_soluto_total"], capacidade_pre_total + total_extras_pre))
    if intervalos_creditur:
        pro_soluto_pre_maximo = _money(total_extras_pre + total_creditur_pre_programado)
    elif parcela_pre_manual > DECIMAL_ZERO:
        pro_soluto_pre_maximo = _money(
            max(
                pro_soluto_pre_maximo,
                total_extras_pre + (parcela_pre_manual * Decimal(max(meses_pre, 0))),
            )
        )
    meses_pos_configurado = meses_pos
    meses_pos_planejado = meses_pos_configurado
    fluxo_pre_entrega: list[dict[str, Any]] = []
    fluxo_pos_creditur: list[dict[str, Any]] = []
    fluxo_pos_7lm_personalizado: list[dict[str, Any]] = []
    mensal_pre = DECIMAL_ZERO
    pro_soluto_pre = DECIMAL_ZERO
    pro_soluto_pos = _money(parametros["pro_soluto_total"])
    mensal_pos = DECIMAL_ZERO
    capacidade_pos_total_7lm = DECIMAL_ZERO
    parcela_pos_ideal = DECIMAL_ZERO
    parcela_pos_sugerida = DECIMAL_ZERO
    saldo_pos_nao_quitado_creditur = DECIMAL_ZERO
    total_7lm_personalizado_pos = DECIMAL_ZERO

    for _ in range(max(meses_pos_configurado, 1) + 1):
        if intervalos_creditur:
            pro_soluto_pre_teorico = _money(total_extras_pre + total_creditur_pre_programado)
        elif simulacao_creditur and not creditur_planejamento_automatico:
            pro_soluto_pre_teorico = _money(total_extras_pre)
        elif parcela_pre_manual > DECIMAL_ZERO:
            pro_soluto_pre_teorico = _money(total_extras_pre + (parcela_pre_manual * Decimal(max(meses_pre, 0))))
        else:
            pro_soluto_pre_teorico = _definir_alvo_pre_entrega(
                pro_soluto_total=parametros["pro_soluto_total"],
                meses_pre=meses_pre,
                meses_pos_configurado=meses_pos_planejado,
                valor_captacao_entrega_base=parametros["valor_captacao_entrega_base"],
                valor_garantido_pre_obra_planejado=valor_garantido_pre_obra_planejado,
                capacidade_pos_7lm=capacidade_pos_7lm,
            )
        pro_soluto_pre_planejado = _money(min(pro_soluto_pre_teorico, pro_soluto_pre_maximo))
        mensal_pre_total = _money(max(pro_soluto_pre_planejado - total_extras_pre, DECIMAL_ZERO))
        fluxo_pre_entrega = _montar_fluxo_obra_pre_entrega(
            meses_pre=meses_pre,
            limite_comprometimento=limite_comprometimento,
            parcela_financiamento_banco=parametros["parcela_financiamento_banco"],
            percentual_conclusao_obra=percentual_conclusao_obra,
            mensal_pre_total=mensal_pre_total,
            extras_por_mes=extras_por_mes,
            parcela_pre_manual=parcela_pre_manual,
            preservar_parcela_pre_manual=not simulacao_creditur,
            intervalos_creditur=intervalos_creditur,
        )
        mensal_pre_total_alocado = _money(
            sum((_money(item.get("parcela_7lm")) for item in fluxo_pre_entrega), DECIMAL_ZERO)
        )
        mensal_pre = _money(mensal_pre_total_alocado / Decimal(max(meses_pre, 1)))
        pro_soluto_pre = _money(min(pro_soluto_pre_planejado, mensal_pre_total_alocado + total_extras_pre))
        pro_soluto_pos = _money(max(parametros["pro_soluto_total"] - pro_soluto_pre - total_extras_pos, DECIMAL_ZERO))
        if intervalos_creditur:
            (
                meses_pos_calculado,
                mensal_pos_calculado,
                capacidade_pos_total_calculada,
                parcela_pos_ideal_calculada,
                fluxo_pos_creditur,
                saldo_pos_nao_quitado_creditur,
            ) = _planejar_fluxo_pos_entrega_creditur(
                pro_soluto_pos=pro_soluto_pos,
                capacidade_pos_7lm=capacidade_pos_7lm,
                meses_pre=meses_pre,
                meses_pos_limite=meses_pos_planejado,
                intervalos=intervalos_creditur,
                parcela_pos_manual=parcela_pos_manual,
            )
        else:
            pro_soluto_pos_planejamento = pro_soluto_pos
            if simulacao_creditur and total_extras_agendados > DECIMAL_ZERO:
                # Extras informados pelo corretor nao podem reduzir automaticamente o pos-chave Creditur.
                pro_soluto_pos_planejamento = _money(pro_soluto_pos + total_extras_agendados)
            if simulacao_creditur and not creditur_planejamento_automatico:
                meses_pos_calculado = max(int(meses_pos_planejado or 0), 0)
                mensal_pos_calculado = DECIMAL_ZERO
                capacidade_pos_total_calculada = _money(capacidade_pos_7lm * Decimal(meses_pos_calculado))
                parcela_pos_ideal_calculada = (
                    _money(pro_soluto_pos_planejamento / Decimal(max(meses_pos_calculado, 1)))
                    if pro_soluto_pos_planejamento > DECIMAL_ZERO and meses_pos_calculado > 0
                    else pro_soluto_pos_planejamento
                )
                saldo_pos_nao_quitado_creditur = pro_soluto_pos_planejamento
                fluxo_pos_creditur = []
            elif not simulacao_creditur and parcela_pos_manual > DECIMAL_ZERO:
                meses_pos_calculado = max(int(meses_pos_planejado or 0), 0)
                mensal_pos_calculado = parcela_pos_manual
                capacidade_pos_total_calculada = _money(capacidade_pos_7lm * Decimal(meses_pos_calculado))
                parcela_pos_ideal_calculada = (
                    _money(pro_soluto_pos_planejamento / Decimal(max(meses_pos_calculado, 1)))
                    if pro_soluto_pos_planejamento > DECIMAL_ZERO and meses_pos_calculado > 0
                    else pro_soluto_pos_planejamento
                )
                saldo_pos_nao_quitado_creditur = DECIMAL_ZERO
                mensal_pos = mensal_pos_calculado
                capacidade_pos_total_7lm = capacidade_pos_total_calculada
                parcela_pos_ideal = parcela_pos_ideal_calculada
                meses_pos = meses_pos_calculado
                break
            elif (
                not simulacao_creditur
                and parcela_pos_manual_informada
                and parcela_pos_manual <= DECIMAL_ZERO
            ):
                meses_pos_calculado = max(int(meses_pos_planejado or 0), 0)
                mensal_pos_calculado = DECIMAL_ZERO
                capacidade_pos_total_calculada = _money(capacidade_pos_7lm * Decimal(meses_pos_calculado))
                parcela_pos_ideal_calculada = (
                    _money(pro_soluto_pos_planejamento / Decimal(max(meses_pos_calculado, 1)))
                    if pro_soluto_pos_planejamento > DECIMAL_ZERO and meses_pos_calculado > 0
                    else pro_soluto_pos_planejamento
                )
            else:
                (
                    meses_pos_calculado,
                    mensal_pos_calculado,
                    capacidade_pos_total_calculada,
                    parcela_pos_ideal_calculada,
                ) = _planejar_fluxo_pos_entrega(
                    pro_soluto_pos=pro_soluto_pos_planejamento,
                    capacidade_pos_7lm=capacidade_pos_7lm,
                    parcela_pos_minima=parcela_pos_minima,
                    meses_pos_limite=meses_pos_planejado,
                    parcela_pos_manual=parcela_pos_manual,
                    preservar_prazo=simulacao_creditur,
                )
                saldo_pos_nao_quitado_creditur = DECIMAL_ZERO
        mensal_pos = mensal_pos_calculado
        capacidade_pos_total_7lm = capacidade_pos_total_calculada
        parcela_pos_ideal = parcela_pos_ideal_calculada

        if simulacao_creditur or meses_pos_calculado >= meses_pos_planejado:
            meses_pos = meses_pos_calculado
            break

        meses_pos_planejado = meses_pos_calculado
        meses_pos = meses_pos_calculado

    if fluxo_7lm_personalizado:
        fluxo_pre_entrega = _aplicar_parcelas_7lm_personalizadas_pre(
            fluxo_capacidade_pre,
            parcelas_7lm_personalizadas,
        )
        total_7lm_personalizado_pre = _money(
            sum((_money(item.get("parcela_7lm")) for item in fluxo_pre_entrega), DECIMAL_ZERO)
        )
        fluxo_pos_7lm_personalizado = _montar_fluxo_7lm_personalizado_pos(
            parcelas_7lm_personalizadas,
            capacidade_pos_7lm=capacidade_pos_7lm,
        )
        total_7lm_personalizado_pos = _money(
            sum((_money(item.get("parcela_7lm")) for item in fluxo_pos_7lm_personalizado), DECIMAL_ZERO)
        )
        meses_pos = meses_pos_configurado
        mensal_pre = _money(total_7lm_personalizado_pre / Decimal(max(meses_pre, 1)))
        pro_soluto_pre = _money(total_7lm_personalizado_pre + total_extras_pre)
        pro_soluto_pos = _money(max(parametros["pro_soluto_total"] - pro_soluto_pre - total_extras_pos, DECIMAL_ZERO))
        mensal_pos = _money(total_7lm_personalizado_pos / Decimal(max(meses_pos, 1))) if meses_pos > 0 else total_7lm_personalizado_pos
        capacidade_pos_total_7lm = _money(capacidade_pos_7lm * Decimal(max(meses_pos, 0)))
        parcela_pos_ideal = _money(pro_soluto_pos / Decimal(max(meses_pos, 1))) if pro_soluto_pos > DECIMAL_ZERO and meses_pos > 0 else pro_soluto_pos
        fluxo_pos_creditur = []
        saldo_pos_nao_quitado_creditur = DECIMAL_ZERO

    (
        _,
        _,
        _,
        parcela_pos_sugerida,
    ) = _planejar_fluxo_pos_entrega(
        pro_soluto_pos=pro_soluto_pos,
        capacidade_pos_7lm=DECIMAL_ZERO,
        parcela_pos_minima=parcela_pos_minima,
        meses_pos_limite=limite_meses_pos,
    )

    # Excesso na Creditur fica apenas como aviso/bloqueio; nao altera a curva informada.
    ajuste_excesso_creditur = DECIMAL_ZERO

    total_creditur_financiado_pre = DECIMAL_ZERO
    total_creditur_financiado_pos = DECIMAL_ZERO
    if simulacao_creditur:
        total_creditur_financiado_pre = _money(
            sum((_money(item.get("parcela_7lm")) for item in fluxo_pre_entrega), DECIMAL_ZERO)
        )
        total_creditur_financiado_pos = _money(
            sum((_money(item.get("parcela_7lm")) for item in fluxo_pos_creditur), DECIMAL_ZERO)
            if fluxo_pos_creditur
            else mensal_pos * Decimal(max(meses_pos, 0))
        )
    total_creditur_financiado_pre_pos = _money(total_creditur_financiado_pre + total_creditur_financiado_pos)
    creditur_retencao_pre = _money(total_creditur_financiado_pre * CREDITUR_RETENCAO_PERCENTUAL)
    creditur_retencao_pos = DECIMAL_ZERO
    creditur_retencao_total = _money(creditur_retencao_pre + creditur_retencao_pos)
    creditur_repasse_liquido = _money(max(total_creditur_financiado_pre - creditur_retencao_pre, DECIMAL_ZERO))
    financiamento_7lm_pos_chaves = total_creditur_financiado_pos
    valor_liquido_negociacao = _money(max(parametros["valor_total_operacao"] - creditur_retencao_total, DECIMAL_ZERO))
    total_projetado_entrega_cliente = _money(parametros["valor_captacao_entrega_base"] + pro_soluto_pre)
    total_projetado_entrega = _money(max(total_projetado_entrega_cliente - creditur_retencao_pre, DECIMAL_ZERO))
    total_pre_pago_cliente = _money(max(pro_soluto_pre - creditur_retencao_pre, DECIMAL_ZERO))
    if simulacao_creditur:
        total_pos_pago_cliente = _money(financiamento_7lm_pos_chaves + total_extras_pos + total_extras_fora_do_fluxo)
    elif fluxo_7lm_personalizado:
        total_pos_pago_cliente = _money(total_7lm_personalizado_pos + total_extras_pos + total_extras_fora_do_fluxo)
    else:
        total_pos_pago_cliente = _money(
            (mensal_pos * Decimal(max(meses_pos, 0))) + total_extras_pos + total_extras_fora_do_fluxo
        )
    valor_total_pago_cliente_sem_desconto = _money(
        parametros["valor_captacao_inicial"]
        + total_pre_pago_cliente
        + total_pos_pago_cliente
    )
    valor_total_pago_cliente = _money(valor_total_pago_cliente_sem_desconto)
    valor_total_pago_cliente_exclui_incentivo = valor_total_pago_cliente
    valor_total_pago_cliente_com_incentivo = _money(
        valor_total_pago_cliente + parametros["desconto_imovel"]
    )
    diferenca_valor_negociado = _money(parametros["valor_total_operacao"] - valor_total_pago_cliente)
    falta_para_imovel = _money(max(diferenca_valor_negociado, DECIMAL_ZERO))
    falta_para_valor_negociado = _money(max(diferenca_valor_negociado, DECIMAL_ZERO))
    excesso_valor_negociado = _money(max(-diferenca_valor_negociado, DECIMAL_ZERO))
    percentual_projetado_entrega = _percent(
        total_projetado_entrega / valor_referencia_comercial
    ) if valor_referencia_comercial > DECIMAL_ZERO else Decimal("0")
    saldo_pos_entrega = _money(max(valor_liquido_negociacao - total_projetado_entrega, DECIMAL_ZERO))

    parcela_pre_pico = _money(
        max([_money(item.get("valor_total_comprometido")) for item in fluxo_pre_entrega] or [DECIMAL_ZERO])
    )
    fluxo_pos_referencia = fluxo_pos_creditur or fluxo_pos_7lm_personalizado
    maior_pos_7lm = max([_money(item.get("parcela_7lm")) for item in fluxo_pos_referencia] or [mensal_pos])
    parcela_pos_pico = _money(maior_pos_7lm + parametros["parcela_financiamento_banco"])
    parcela_referencia = max(parcela_pre_pico, parcela_pos_pico)

    percentual_comprometimento = _percent(
        parcela_referencia / renda_total
    ) if renda_total > DECIMAL_ZERO else Decimal("1")
    if fluxo_pos_creditur:
        saldo_pos_nao_quitado_no_prazo = _money(saldo_pos_nao_quitado_creditur)
    elif fluxo_7lm_personalizado:
        saldo_pos_nao_quitado_no_prazo = _money(
            max(pro_soluto_pos - total_7lm_personalizado_pos, DECIMAL_ZERO)
        )
    else:
        saldo_pos_nao_quitado_no_prazo = _money(
            max(pro_soluto_pos - (mensal_pos * Decimal(max(meses_pos, 0))), DECIMAL_ZERO)
        )
    intervalos_creditur_ajustados = _agrupar_intervalos_creditur_ajustados(
        fluxo_pre_entrega=fluxo_pre_entrega,
        fluxo_pos_creditur=fluxo_pos_creditur,
        meses_pre=meses_pre,
    ) if simulacao_creditur else []

    classificacao_fechamento = _classificar_garantia(
        parametros["valor_captacao_inicial"],
        valor_garantido,
    )
    classificacao_entrega = _classificar_entrega(
        percentual_projetado_entrega,
        percentual_captacao_ate_entrega,
    )

    status_simulacao, bloqueios, atenções = _avaliar_status_geral(
        percentual_comprometimento=percentual_comprometimento,
        limite_comprometimento=limite_comprometimento,
        parcela_financiamento_banco=parametros["parcela_financiamento_banco"],
        valor_garantido_real=parametros["valor_captacao_inicial"],
        valor_garantido_planejado=valor_garantido,
        parcela_7lm_media_pre=mensal_pre,
        valor_parcela_minima_pre_obra=valor_parcela_minima_pre_obra,
        valor_garantido_pre_obra_real=total_projetado_entrega,
        valor_garantido_pre_obra_planejado=valor_garantido_pre_obra_planejado,
        classificacao_entrega=classificacao_entrega,
        status_imovel=imovel_linha.get("status"),
        valor_total_operacao=parametros["valor_total_operacao"],
    )
    if parametros["desconto_imovel_solicitado"] > parametros["desconto_imovel"]:
        detalhe_reducao_desconto = ""
        if parametros["desconto_imovel_reducao_por_reservas_vendas"] > DECIMAL_ZERO:
            detalhe_reducao_desconto = (
                f", após redução de {_moeda_texto(parametros['desconto_imovel_reducao_por_reservas_vendas'])} "
                f"por {parametros['desconto_imovel_quantidade_reservas_vendas']} vendido(s)/pendente(s) de aprovação"
            )
        atenções.append(
            f"Incentivo 7LM ajustado para {_moeda_texto(parametros['desconto_imovel'])}, respeitando o teto de {_moeda_texto(parametros['desconto_imovel_maximo_efetivo'])}{detalhe_reducao_desconto}."
        )
    garantido_encaixado = valor_garantido > DECIMAL_ZERO and parametros["valor_captacao_inicial"] >= valor_garantido
    pre_obra_encaixado = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or total_projetado_entrega >= valor_garantido_pre_obra_planejado
    )
    gatilhos_comerciais_encaixados = garantido_encaixado and pre_obra_encaixado

    parcela_pos_validacao = maior_pos_7lm if fluxo_7lm_personalizado else mensal_pos
    if pro_soluto_pos > DECIMAL_ZERO and parcela_pos_validacao > capacidade_pos_7lm:
        mensagem_pos_obra = (
            "No pós-obra, a parcela 7LM excede a margem disponivel depois de descontar a parcela cheia do banco."
        )
        if gatilhos_comerciais_encaixados:
            if status_simulacao == STATUS_SIMULACAO_IDEAL:
                status_simulacao = STATUS_SIMULACAO_ATENCAO
            atenções.append(
                "Garantido e pré-obra encaixados, mas o pós-obra segue acima da margem mensal. Revise o demonstrativo antes do fechamento."
            )
        else:
            status_simulacao = STATUS_SIMULACAO_INVALIDA
            bloqueios.append(mensagem_pos_obra)
    if parcela_pre_manual_raw > capacidade_pre_7lm_atual and capacidade_pre_7lm_atual >= DECIMAL_ZERO:
        atenções.append(
            f"Parcela pré-obra 7LM ajustada para {_moeda_texto(parcela_pre_manual)} pelo teto de 45% da renda menos banco proporcional à obra."
        )
    if DECIMAL_ZERO < parcela_pre_manual_raw < PARCELA_CLIENTE_MINIMA and capacidade_pre_7lm_atual >= PARCELA_CLIENTE_MINIMA:
        atenções.append(
            f"Parcela pré-obra 7LM ajustada para o mínimo de {_moeda_texto(PARCELA_CLIENTE_MINIMA)}."
        )
    if DECIMAL_ZERO < parcela_pre_manual_raw and DECIMAL_ZERO < capacidade_pre_7lm_atual < PARCELA_CLIENTE_MINIMA:
        status_simulacao = STATUS_SIMULACAO_INVALIDA
        bloqueios.append(
            f"Parcela pré-obra 7LM abaixo do mínimo de {_moeda_texto(PARCELA_CLIENTE_MINIMA)} porque a margem disponível é {_moeda_texto(capacidade_pre_7lm_atual)}."
        )
    if parcela_pos_manual_raw > capacidade_pos_7lm and capacidade_pos_7lm >= DECIMAL_ZERO:
        atenções.append(
            f"Parcela pós-obra 7LM ajustada para {_moeda_texto(parcela_pos_manual)} pelo teto de 45% da renda menos banco."
        )
    if DECIMAL_ZERO < parcela_pos_manual_raw < PARCELA_CLIENTE_MINIMA and capacidade_pos_7lm >= PARCELA_CLIENTE_MINIMA:
        atenções.append(
            f"Parcela pós-obra 7LM ajustada para o mínimo de {_moeda_texto(PARCELA_CLIENTE_MINIMA)}."
        )
    if DECIMAL_ZERO < parcela_pos_manual_raw and DECIMAL_ZERO < capacidade_pos_7lm < PARCELA_CLIENTE_MINIMA:
        status_simulacao = STATUS_SIMULACAO_INVALIDA
        bloqueios.append(
            f"Parcela pós-obra 7LM abaixo do mínimo de {_moeda_texto(PARCELA_CLIENTE_MINIMA)} porque a margem disponível é {_moeda_texto(capacidade_pos_7lm)}."
        )
    if ajuste_excesso_creditur > DECIMAL_ZERO:
        atenções.append(
            f"Parcelas finais da curva ajustadas em {_moeda_texto(ajuste_excesso_creditur)} para fechar o valor negociado sem excesso."
        )
    if pro_soluto_pos > DECIMAL_ZERO and parcela_pos_sugerida > capacidade_pos_7lm:
        atenções.append(
            f"Para quitar o pro-soluto no prazo total maximo, a parcela 7LM ideal no pós-obra fica em {_moeda_texto(parcela_pos_sugerida)}."
        )
    if (parcela_pos_manual_raw > DECIMAL_ZERO or fluxo_7lm_personalizado) and saldo_pos_nao_quitado_no_prazo > Decimal("0.01"):
        if status_simulacao == STATUS_SIMULACAO_IDEAL:
            status_simulacao = STATUS_SIMULACAO_ATENCAO
        atenções.append(
            f"Parcela pós-obra informada não quita o saldo dentro do prazo. Saldo residual estimado: {_moeda_texto(saldo_pos_nao_quitado_no_prazo)}."
        )
    if meses_pos_solicitado > limite_meses_pos:
        if simulacao_creditur:
            atenções.append(
                f"Meses 7LM ajustados para {meses_pos_configurado}; a 7LM sempre começa após a última parcela Creditú e segue até a parcela {CREDITUR_MAXIMO_MESES_TOTAIS}."
            )
        else:
            atenções.append(
                f"Meses pos-entrega ajustados para {meses_pos_configurado} porque o prazo total pre + pos não pode passar de {MAXIMO_MESES_TOTAIS_SIMULACAO}."
            )
    if (
        pro_soluto_pos > DECIMAL_ZERO
        and capacidade_pos_7lm > DECIMAL_ZERO
        and meses_pos > 0
        and meses_pos < meses_pos_configurado
        and not simulacao_creditur
    ):
        atenções.append(
            f"Meses pos-entrega travados em {meses_pos} para usar a parcela máxima segura e quitar no menor prazo."
        )
    if simulacao_creditur and parcelas_pre_entrega_sem_creditur:
        total_sem_parcela = len(parcelas_pre_entrega_sem_creditur)
        primeira_sem_parcela = parcelas_pre_entrega_sem_creditur[0]
        ultima_sem_parcela = parcelas_pre_entrega_sem_creditur[-1]
        intervalo_sem_parcela = (
            f"parcela {primeira_sem_parcela}"
            if primeira_sem_parcela == ultima_sem_parcela
            else f"parcelas {primeira_sem_parcela} a {ultima_sem_parcela}"
        )
        if status_simulacao == STATUS_SIMULACAO_IDEAL:
            status_simulacao = STATUS_SIMULACAO_ATENCAO
        atenções.append(
            f"Curva Creditú mantida como informada; faltam {total_sem_parcela} parcela(s) antes da entrega ({intervalo_sem_parcela})."
        )
    if intervalos_creditur and saldo_pos_nao_quitado_no_prazo > Decimal("0.01"):
        if status_simulacao == STATUS_SIMULACAO_IDEAL:
            status_simulacao = STATUS_SIMULACAO_ATENCAO
        atenções.append(
            f"Curva por parcelas Creditú não quita todo o saldo dentro do prazo configurado. Saldo residual estimado: {_moeda_texto(saldo_pos_nao_quitado_no_prazo)}."
        )
    if falta_para_valor_negociado > DECIMAL_ZERO:
        margem_incentivo_disponivel = _money(
            max(parametros["incentivo_7lm_maximo_efetivo"] - parametros["incentivo_7lm"], DECIMAL_ZERO)
        )
        if margem_incentivo_disponivel >= falta_para_valor_negociado:
            atenções.append(
                f"Venda bloqueada até fechar o valor negociado: faltam {_moeda_texto(falta_para_valor_negociado)}. Ajuste entrada, balões/reforços ou submeta aprovação de Incentivo 7LM adicional."
            )
        else:
            atenções.append(
                f"Venda bloqueada até fechar o valor negociado: faltam {_moeda_texto(falta_para_valor_negociado)} e a margem de Incentivo 7LM disponível é {_moeda_texto(margem_incentivo_disponivel)}. Ajuste entrada, balões/reforços ou parcelas."
            )
    elif excesso_valor_negociado > DECIMAL_ZERO:
        atenções.append(
            f"Venda bloqueada até ajustar a proposta: o total considerado excede o valor negociado em {_moeda_texto(excesso_valor_negociado)}."
        )
    if parametros["entrada_excedente_valor_negociado"] > DECIMAL_ZERO:
        atenções.append(
            f"Entrada/sinal informado excede o valor negociado em {_moeda_texto(parametros['entrada_excedente_valor_negociado'])}. Ajuste a entrada para vender sem divergência."
        )

    gap_pre_obra = _money(max(valor_garantido_pre_obra_planejado - total_projetado_entrega, DECIMAL_ZERO))
    capacidade_pos_total_limite = _money(capacidade_pos_7lm * Decimal(max(limite_meses_pos, 0)))
    necessidade_pre_para_pos = _money(max(pro_soluto_pos - capacidade_pos_total_limite, DECIMAL_ZERO))
    sugestao_reforco_pre_obra = _sugerir_reforco_pre_obra(
        valor_necessario=max(gap_pre_obra, necessidade_pre_para_pos),
        meses_pre=meses_pre,
    )

    status_comercial = _classificar_status_comercial(
        valor_total_operacao=parametros["valor_total_operacao"],
        status_imovel=imovel_linha.get("status") or "",
        valor_garantido_real=parametros["valor_captacao_inicial"],
        valor_garantido_planejado=valor_garantido,
        valor_garantido_pre_obra_real=total_projetado_entrega,
        valor_garantido_pre_obra_planejado=valor_garantido_pre_obra_planejado,
        status_simulacao=status_simulacao,
    )

    sugestões = _gerar_sugestões_ajuste(
        valor_garantido_real=parametros["valor_captacao_inicial"],
        valor_garantido_planejado=valor_garantido,
        parcela_7lm_media_pre=mensal_pre,
        valor_parcela_minima_pre_obra=valor_parcela_minima_pre_obra,
        valor_garantido_pre_obra_real=total_projetado_entrega,
        valor_garantido_pre_obra_planejado=valor_garantido_pre_obra_planejado,
        percentual_projetado_entrega=percentual_projetado_entrega,
        percentual_comprometimento=percentual_comprometimento,
    )
    if falta_para_valor_negociado > DECIMAL_ZERO:
        sugestões.insert(
            0,
            f"Complete {_moeda_texto(falta_para_valor_negociado)} com entrada, balões/reforços ou parcelas; sem isso a venda não pode ser concluída.",
        )
    elif excesso_valor_negociado > DECIMAL_ZERO:
        sugestões.insert(
            0,
            f"Reduza {_moeda_texto(excesso_valor_negociado)} em entrada, balões/reforços ou parcelas para fechar exatamente o valor negociado.",
        )
    if pro_soluto_pos > DECIMAL_ZERO and parcela_pos_sugerida > capacidade_pos_7lm:
        sugestões.insert(
            0,
            f"Reforce entrada ou pré-obra para reduzir o pro-soluto. No prazo total maximo, a parcela 7LM ideal no pós-obra fica em {_moeda_texto(parcela_pos_sugerida)}.",
        )
    elif (
        pro_soluto_pos > DECIMAL_ZERO
        and parcela_pos_sugerida > DECIMAL_ZERO
        and parcela_pos_sugerida > parcela_pos_minima
    ):
        sugestões.insert(
            0,
            f"Use parcela 7LM de ao menos {_moeda_texto(parcela_pos_sugerida)} no pós-obra para liquidar o pro-soluto dentro do prazo total.",
        )
    if sugestao_reforco_pre_obra:
        sugestões.insert(0, sugestao_reforco_pre_obra["descrição"])
    sugestões = sugestões[:4]

    demonstrativo = []
    if incluir_demonstrativo:
        demonstrativo = _gerar_demonstrativo_parcelas(
            renda_total=renda_total,
            entrada=parametros["entrada"],
            fluxo_pre_entrega=fluxo_pre_entrega,
            mensal_pos=mensal_pos,
            parcela_financiamento_banco=parametros["parcela_financiamento_banco"],
            capacidade_pos_7lm=capacidade_pos_7lm,
            meses_pre=meses_pre,
            meses_pos=meses_pos,
            data_entrega=data_entrega_resolvida,
            intermediaria_valor=valor_intermediaria,
            intermediaria_qtd=qtd_intermediarias,
            intermediaria_itens=parcelas_intermediarias_personalizadas,
            anual_valor=valor_anual,
            anual_qtd=qtd_anuais,
            semestral_valor=valor_semestral,
            semestral_qtd=qtd_semestrais,
            reforco_valor=valor_reforco,
            reforco_qtd=qtd_reforcos,
            intermediaria_datas=payload.get("parcelas_intermediarias_datas"),
            anual_primeira_data=payload.get("parcela_anual_primeira_data"),
            semestral_primeira_data=payload.get("parcela_semestral_primeira_data"),
            fluxo_pos_entrega=fluxo_pos_creditur if simulacao_creditur else fluxo_pos_7lm_personalizado,
            creditur_ativo=simulacao_creditur,
        )

    identificacao_imovel = montar_identificacao_imovel_simulador(imovel_linha)

    resultado = {
        "cliente": resumo_cliente,
        "imovel": {
            "id": str(imovel_linha.get("identificador_imovel") or ""),
            "titulo": identificacao_imovel["titulo"],
            "titulo_original": identificacao_imovel["titulo_original"],
            "descricao": _valor_chave(imovel_linha, "descricao", "descrição"),
            "empreendimento": imovel_linha.get("empreendimento") or imovel_linha.get("titulo"),
            "cidade": imovel_linha.get("cidade"),
            "bairro": imovel_linha.get("bairro"),
            "endereco": _valor_chave(imovel_linha, "endereco", "endereço"),
            "estado": imovel_linha.get("estado"),
            "cep": imovel_linha.get("cep"),
            "tipologia": imovel_linha.get("tipo_imovel"),
            "dormitorios": imovel_linha.get("quartos"),
            "quartos": imovel_linha.get("quartos"),
            "banheiros": imovel_linha.get("banheiros"),
            "vagas": imovel_linha.get("vagas_garagem"),
            "tipo_garagem": imovel_linha.get("tipo_garagem") or "carro",
            "area_m2": _decimal(imovel_linha.get("area_m2")),
            "data_entrega": data_entrega_resolvida.isoformat(),
            "meses_pre_entrega": meses_pre_resumo if simulacao_creditur else meses_pre,
            "meses_pos_entrega": meses_pos_resumo if simulacao_creditur else meses_pos,
            "meses_pos_entrega_configurado": meses_pos_configurado_resumo if simulacao_creditur else meses_pos_configurado,
            "percentual_conclusao_obra": percentual_conclusao_obra,
            "percentual_fechamento_minimo": percentual_fechamento_minimo,
            "valor_garantido": valor_garantido,
            "valor_garantido_planejado": valor_garantido,
            "valor_garantido_pre_obra_planejado": valor_garantido_pre_obra_planejado,
            "percentual_captacao_ate_entrega": percentual_captacao_ate_entrega,
            "valor_parcela_minima_pre_obra": valor_parcela_minima_pre_obra,
            "valor": _money(imovel_linha.get("valor")),
            "valor_original": valor_imovel_base,
            "valor_negociado": parametros["valor_total_operacao"],
            "valor_total_operacao": parametros["valor_total_operacao"],
            "valor_total_cliente": valor_total_pago_cliente,
            "valor_total_pago_cliente": valor_total_pago_cliente,
            "valor_total_pago_cliente_exclui_incentivo": valor_total_pago_cliente_exclui_incentivo,
            "valor_total_pago_cliente_sem_desconto": valor_total_pago_cliente_sem_desconto,
            "valor_total_pago_cliente_sem_incentivo": valor_total_pago_cliente,
            "valor_total_pago_cliente_com_incentivo": valor_total_pago_cliente_com_incentivo,
            "valor_total_coberto_cliente_incentivo": valor_total_pago_cliente_com_incentivo,
            "falta_para_imovel": falta_para_imovel,
            "falta_para_valor_negociado": falta_para_valor_negociado,
            "excesso_valor_negociado": excesso_valor_negociado,
            "ajuste_excesso_creditur": ajuste_excesso_creditur,
            "total_considerado": valor_total_pago_cliente,
            "valor_liquido_negociacao": valor_liquido_negociacao,
            "creditur_retencao": creditur_retencao_total,
            "desconto_imovel": parametros["desconto_imovel"],
            "incentivo_7lm": parametros["incentivo_7lm"],
            "valor_desconto_minimo": parametros["desconto_imovel_minimo"],
            "valor_incentivo_minimo": parametros["valor_incentivo_minimo"],
            "valor_desconto_maximo": parametros["desconto_imovel_maximo_configurado"],
            "valor_incentivo_maximo": parametros["valor_incentivo_maximo"],
            "desconto_imovel_maximo_efetivo": parametros["desconto_imovel_maximo_efetivo"],
            "incentivo_7lm_maximo_efetivo": parametros["incentivo_7lm_maximo_efetivo"],
            "desconto_imovel_reducao_por_reservas_vendas": parametros["desconto_imovel_reducao_por_reservas_vendas"],
            "incentivo_7lm_reducao_por_reservas_vendas": parametros["incentivo_7lm_reducao_por_reservas_vendas"],
            "quantidade_desconto_reservas_vendas": parametros["desconto_imovel_quantidade_reservas_vendas"],
            "quantidade_incentivo_reservas_vendas": parametros["incentivo_7lm_quantidade_reservas_vendas"],
            "parceiro_simulacao": parceiro_simulacao,
            "status": imovel_linha.get("status"),
            "foto_principal": imovel_linha.get("foto_principal"),
            "agrupamento": identificacao_imovel["agrupamento"],
            "detalhes_comerciais": identificacao_imovel["detalhes_comerciais"],
        },
        "resumo_operacao": {
            "renda_total": renda_total,
            "limite_comprometimento": limite_comprometimento,
            "limite_comprometimento_padrao": limite_comprometimento_padrao,
            "parcela_cliente_maxima": limite_comprometimento,
            "parcela_cliente_informada": parcela_cliente_informada,
            "percentual_comprometimento": percentual_comprometimento,
            "parcela_maxima_segura": limite_comprometimento,
            "parcela_referencia": parcela_referencia,
            "entrada": parametros["entrada"],
            "entrada_solicitada": parametros["entrada_solicitada"],
            "entrada_limite_valor_negociado": parametros["entrada_limite_valor_negociado"],
            "entrada_excedente_valor_negociado": parametros["entrada_excedente_valor_negociado"],
            "pro_soluto_total": parametros["pro_soluto_total"],
            "valor_imovel": parametros["valor_imovel"],
            "valor_total_operacao_bruto": parametros["valor_total_operacao_bruto"],
            "desconto_imovel": parametros["desconto_imovel"],
            "incentivo_7lm": parametros["incentivo_7lm"],
            "desconto_imovel_minimo": parametros["desconto_imovel_minimo"],
            "valor_incentivo_minimo": parametros["valor_incentivo_minimo"],
            "desconto_imovel_maximo_configurado": parametros["desconto_imovel_maximo_configurado"],
            "valor_incentivo_maximo": parametros["valor_incentivo_maximo"],
            "desconto_imovel_maximo_efetivo": parametros["desconto_imovel_maximo_efetivo"],
            "incentivo_7lm_maximo_efetivo": parametros["incentivo_7lm_maximo_efetivo"],
            "desconto_imovel_reducao_por_reservas_vendas": parametros["desconto_imovel_reducao_por_reservas_vendas"],
            "incentivo_7lm_reducao_por_reservas_vendas": parametros["incentivo_7lm_reducao_por_reservas_vendas"],
            "desconto_imovel_quantidade_reservas_vendas": parametros["desconto_imovel_quantidade_reservas_vendas"],
            "incentivo_7lm_quantidade_reservas_vendas": parametros["incentivo_7lm_quantidade_reservas_vendas"],
            "limite_desconto_sem_aprovacao": DESCONTO_SEM_APROVACAO_GESTOR,
            "limite_incentivo_sem_aprovacao": DESCONTO_SEM_APROVACAO_GESTOR,
            "desconto_requer_aprovacao": parametros["desconto_imovel"] > DESCONTO_SEM_APROVACAO_GESTOR,
            "incentivo_requer_aprovacao": parametros["desconto_imovel"] > DESCONTO_SEM_APROVACAO_GESTOR,
            "valor_total_operacao": parametros["valor_total_operacao"],
            "valor_total_cliente": valor_total_pago_cliente,
            "valor_total_pago_cliente": valor_total_pago_cliente,
            "valor_total_pago_cliente_exclui_incentivo": valor_total_pago_cliente_exclui_incentivo,
            "valor_total_pago_cliente_sem_desconto": valor_total_pago_cliente_sem_desconto,
            "valor_total_pago_cliente_sem_incentivo": valor_total_pago_cliente,
            "valor_total_pago_cliente_com_incentivo": valor_total_pago_cliente_com_incentivo,
            "valor_total_coberto_cliente_incentivo": valor_total_pago_cliente_com_incentivo,
            "falta_para_imovel": falta_para_imovel,
            "falta_para_valor_negociado": falta_para_valor_negociado,
            "excesso_valor_negociado": excesso_valor_negociado,
            "ajuste_excesso_creditur": ajuste_excesso_creditur,
            "total_considerado": valor_total_pago_cliente,
            "valor_liquido_negociacao": valor_liquido_negociacao,
            "valor_base_gatilhos": valor_referencia_comercial,
            "parceiro_simulacao": parceiro_simulacao,
            "creditur_ativo": simulacao_creditur,
            "creditu_geral": creditu_geral if simulacao_creditur_geral else None,
            "creditur_percentual_retencao": CREDITUR_RETENCAO_PERCENTUAL if simulacao_creditur else DECIMAL_ZERO,
            "garantido_real": parametros["valor_captacao_inicial"],
            "garantido_mais_pre_obra_real": total_projetado_entrega,
            "creditur_pre_chaves_bruto": total_creditur_financiado_pre,
            "creditur_retencao_20": creditur_retencao_pre,
            "creditur_pre_chaves_liquido": creditur_repasse_liquido,
            "pos_chaves_7lm_total": financiamento_7lm_pos_chaves,
            "creditur_valor_financiado_pre_pos": total_creditur_financiado_pre_pos,
            "creditur_valor_financiado_pre_chaves": total_creditur_financiado_pre,
            "financiamento_7lm_pos_chaves": financiamento_7lm_pos_chaves,
            "creditur_retencao": creditur_retencao_total,
            "creditur_retencao_pre_chaves": creditur_retencao_pre,
            "creditur_retencao_pos_chaves": creditur_retencao_pos,
            "creditur_valor_repassado_7lm": creditur_repasse_liquido,
            "creditur_intervalos_parcelas_ajustados": [
                {
                    "parcela_inicio": item["parcela_inicio"],
                    "parcela_fim": item["parcela_fim"],
                    "valor": item["valor"],
                }
                for item in intervalos_creditur_ajustados
            ],
            "creditur_intervalos_parcelas": [
                {
                    "parcela_inicio": item["parcela_inicio"],
                    "parcela_fim": item["parcela_fim"],
                    "valor": item["valor"],
                }
                for item in intervalos_creditur
            ],
            "creditur_degraus_semestrais": [],
            "financiamento_caixa": parametros["financiamento_caixa"],
            "parcela_financiamento_banco": parametros["parcela_financiamento_banco"],
            "parcela_banco_obra_atual": parcela_banco_atual_obra,
            "parcela_banco_obra_entrega": parametros["parcela_financiamento_banco"],
            "parcela_pre_obra_manual": parcela_pre_manual,
            "parcela_pos_obra_manual": parcela_pos_manual,
            "capacidade_parcela_7lm": capacidade_pos_7lm,
            "capacidade_pre_obra_7lm_atual": capacidade_pre_7lm_atual,
            "parcela_7lm_media_pre": mensal_pre,
            "parcela_7lm_primeira_pre": _money(fluxo_pre_entrega[0].get("parcela_7lm")) if fluxo_pre_entrega else DECIMAL_ZERO,
            "parcela_7lm_ultima_pre": _money(fluxo_pre_entrega[-1].get("parcela_7lm")) if fluxo_pre_entrega else DECIMAL_ZERO,
            "valor_parcela_minima_pre_obra": valor_parcela_minima_pre_obra,
            "parcela_7lm_pos": mensal_pos,
            "parcela_7lm_pos_media": mensal_pos,
            "parcela_7lm_pos_minima": parcela_pos_minima,
            "parcela_7lm_pos_ideal": parcela_pos_sugerida,
            "parcela_7lm_pos_ideal_fluxo": parcela_pos_ideal,
            "capacidade_pos_obra_7lm": capacidade_pos_7lm,
            "capacidade_pos_obra_total_7lm": capacidade_pos_total_7lm,
            "percentual_conclusao_obra": percentual_conclusao_obra,
            "fgts": parametros["fgts"],
            "subsidio": parametros["subsidio"],
            "cheque_moradia": parametros["cheque_moradia"],
            "sobrepreco": parametros["sobrepreco"],
            "valor_fechamento_inicial": parametros["valor_captacao_inicial"],
            "valor_garantido_real": parametros["valor_captacao_inicial"],
            "percentual_fechamento_inicial": fechamento_percentual,
            "percentual_fechamento_minimo": percentual_fechamento_minimo,
            "valor_garantido": valor_garantido,
            "valor_garantido_planejado": valor_garantido,
            "valor_garantido_pre_obra_planejado": valor_garantido_pre_obra_planejado,
            "valor_garantido_pre_obra_real": total_projetado_entrega,
            "percentual_captacao_ate_entrega": percentual_captacao_ate_entrega,
            "classificacao_fechamento_inicial": classificacao_fechamento,
            "valor_projetado_entrega_cliente": total_projetado_entrega_cliente,
            "valor_projetado_entrega": total_projetado_entrega,
            "percentual_projetado_entrega": percentual_projetado_entrega,
            "classificacao_projecao_entrega": classificacao_entrega,
            "saldo_pos_entrega": saldo_pos_entrega,
            "saldo_pos_nao_quitado_no_prazo": saldo_pos_nao_quitado_no_prazo,
            "parcelas_creditur_customizadas": bool(fluxo_pos_creditur),
            "parcelas_7lm_customizadas": bool(fluxo_7lm_personalizado),
            "meses_pre_entrega": meses_pre_resumo if simulacao_creditur else meses_pre,
            "meses_pos_entrega": meses_pos_resumo if simulacao_creditur else meses_pos,
            "meses_pos_entrega_configurado": meses_pos_configurado_resumo if simulacao_creditur else meses_pos_configurado,
            "mensal_pre": mensal_pre,
            "mensal_pos": mensal_pos,
            "status_simulacao": status_simulacao,
            "status_comercial": status_comercial,
            "bloqueios": bloqueios,
            "atenções": atenções,
            "sugestões": sugestões,
            "sugestao_reforco_pre_obra": sugestao_reforco_pre_obra,
        },
        "demonstrativo": demonstrativo,
        "componentes_pre_entrega": {
            "total_intermediarias": total_intermediarias,
            "total_anuais": total_anuais_pre,
            "total_semestrais": total_semestrais_pre,
            "total_reforcos": total_reforcos,
            "total_extras_pre": total_extras_pre,
            "total_extras_pos": total_extras_pos,
            "total_extras_agendados": total_extras_agendados,
            "total_extras_programados": total_extras_programados,
            "total_extras_fora_do_fluxo": total_extras_fora_do_fluxo,
            "pro_soluto_pre": pro_soluto_pre,
            "pro_soluto_pos": pro_soluto_pos,
            "capacidade_pre_total_obra": capacidade_pre_total,
            "capacidade_pre_obra_7lm_atual": capacidade_pre_7lm_atual,
            "capacidade_pos_obra_7lm": capacidade_pos_7lm,
            "capacidade_pos_obra_total_7lm": capacidade_pos_total_7lm,
            "necessidade_pre_para_pos": necessidade_pre_para_pos,
            "parcela_banco_atual_obra": parcela_banco_atual_obra,
            "total_creditur_pre_programado": total_creditur_pre_programado,
            "creditur_valor_financiado_pre_pos": total_creditur_financiado_pre_pos,
            "creditur_valor_financiado_pre_chaves": total_creditur_financiado_pre,
            "financiamento_7lm_pos_chaves": financiamento_7lm_pos_chaves,
            "creditur_retencao": creditur_retencao_total,
            "creditur_valor_repassado_7lm": creditur_repasse_liquido,
            "valor_total_pago_cliente": valor_total_pago_cliente,
            "valor_total_pago_cliente_exclui_incentivo": valor_total_pago_cliente_exclui_incentivo,
            "valor_total_pago_cliente_sem_desconto": valor_total_pago_cliente_sem_desconto,
            "valor_total_pago_cliente_sem_incentivo": valor_total_pago_cliente,
            "valor_total_pago_cliente_com_incentivo": valor_total_pago_cliente_com_incentivo,
            "valor_total_coberto_cliente_incentivo": valor_total_pago_cliente_com_incentivo,
            "falta_para_imovel": falta_para_imovel,
            "falta_para_valor_negociado": falta_para_valor_negociado,
            "excesso_valor_negociado": excesso_valor_negociado,
            "total_considerado": valor_total_pago_cliente,
            "parcelas_creditur_customizadas": bool(fluxo_pos_creditur),
            "parcelas_7lm_customizadas": bool(fluxo_7lm_personalizado),
        },
    }
    resultado["aprovacao_excecao"] = analisar_aprovacao_excecao(resultado)
    return resultado


def _montar_payload_base_sugestao(payload: dict[str, Any] | None) -> dict[str, Any]:
    dados = dict(payload or {})
    dados["usar_entrada_padrao"] = False
    return dados


def _limite_gap_aprovacao_excecao(valor_referencia: Any) -> Decimal:
    referencia = _money(valor_referencia)
    if referencia <= DECIMAL_ZERO:
        return APROVACAO_EXCECAO_GAP_MAXIMO_ABSOLUTO

    limite_percentual = _money(referencia * APROVACAO_EXCECAO_PERCENTUAL_GAP_MAXIMO)
    if limite_percentual <= DECIMAL_ZERO:
        return APROVACAO_EXCECAO_GAP_MAXIMO_ABSOLUTO

    return _money(min(APROVACAO_EXCECAO_GAP_MAXIMO_ABSOLUTO, limite_percentual))


def _lista_dicts(valor: Any) -> list[dict[str, Any]]:
    if not isinstance(valor, list):
        return []
    return [dict(item) for item in valor if isinstance(item, dict)]


def _inteiro_nao_negativo(valor: Any) -> int:
    try:
        return max(int(valor or 0), 0)
    except Exception:
        return 0


def _contexto_cliente_aprovacao(linha: dict[str, Any], calculo_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    calculo = calculo_snapshot if isinstance(calculo_snapshot, dict) else {}
    candidatos = [
        linha.get("cliente"),
        linha.get("resumo_cliente"),
        (linha.get("resumo_operacao") or {}).get("cliente") if isinstance(linha.get("resumo_operacao"), dict) else None,
        calculo.get("cliente"),
        calculo.get("resumo_cliente"),
        (calculo.get("resumo_operacao") or {}).get("cliente") if isinstance(calculo.get("resumo_operacao"), dict) else None,
    ]

    origem: dict[str, Any] = {}
    for candidato in candidatos:
        if isinstance(candidato, dict) and candidato:
            origem = dict(candidato)
            if origem.get("nucleo_familiar") or origem.get("complementos"):
                break

    dados_cliente = origem.get("cliente") if isinstance(origem.get("cliente"), dict) else {}
    complementos = _lista_dicts(origem.get("complementos"))
    nucleo_bruto = origem.get("nucleo_familiar") if isinstance(origem.get("nucleo_familiar"), dict) else {}

    membros_ativos_lista = [item for item in complementos if item.get("ativo", True)]
    membros_em_analise_lista = [item for item in membros_ativos_lista if item.get("incluir_na_analise", True)]
    membros_compoem_renda_lista = [
        item
        for item in membros_em_analise_lista
        if item.get("compoe_renda", True) and item.get("incluir_na_composicao_financeira", True)
    ]

    total_membros = _inteiro_nao_negativo(nucleo_bruto.get("total_membros") or len(complementos))
    membros_ativos = _inteiro_nao_negativo(nucleo_bruto.get("membros_ativos") or len(membros_ativos_lista))
    membros_em_analise = _inteiro_nao_negativo(
        nucleo_bruto.get("membros_em_analise") or len(membros_em_analise_lista)
    )
    membros_compoem_renda = _inteiro_nao_negativo(
        nucleo_bruto.get("membros_compoem_renda") or len(membros_compoem_renda_lista)
    )
    renda_complementar_ativa = _money(
        nucleo_bruto.get("renda_complementar_ativa")
        or sum((_money(item.get("renda")) for item in membros_compoem_renda_lista), DECIMAL_ZERO)
    )

    nucleo = {
        "total_membros": total_membros,
        "membros_ativos": membros_ativos,
        "membros_em_analise": membros_em_analise,
        "membros_compoem_renda": membros_compoem_renda,
        "renda_complementar_ativa": renda_complementar_ativa,
    }

    exige_aprovacao = total_membros > 0 or bool(complementos)
    return {
        "cliente": dados_cliente,
        "renda_principal": _money(origem.get("renda_principal")),
        "renda_complementar": _money(origem.get("renda_complementar")),
        "renda_total": _money(origem.get("renda_total")),
        "limite_comprometimento": _money(origem.get("limite_comprometimento")),
        "parcela_cliente_maxima": _money(origem.get("parcela_cliente_maxima")),
        "parcela_cliente_informada": _money(origem.get("parcela_cliente_informada")),
        "nucleo_familiar": nucleo,
        "complementos": complementos,
        "exige_aprovacao": exige_aprovacao,
    }


def _checklist_aprovacao_excecao(
    *,
    composicao_familiar: bool,
    gatilhos_pendentes: list[str],
) -> list[dict[str, str]]:
    checklist: list[dict[str, str]] = [
        {
            "categoria": "Cadastro",
            "titulo": "Consultar CPF e nome limpo",
            "descricao": "Validar restricoes cadastrais e pendencias documentais antes de liberar a venda.",
            "status": "pendente",
        },
        {
            "categoria": "Renda",
            "titulo": "Conferir comprovacao de renda",
            "descricao": "Comparar renda declarada, parcela do banco, parcela 7LM e comprometimento mensal.",
            "status": "pendente",
        },
    ]

    if composicao_familiar:
        checklist.extend(
            [
                {
                    "categoria": "Composicao familiar",
                    "titulo": "Validar integrantes do nucleo familiar",
                    "descricao": "Checar CPF, vinculo familiar, documentacao e participacao de cada integrante na renda.",
                    "status": "pendente",
                },
                {
                    "categoria": "Composicao familiar",
                    "titulo": "Confirmar renda complementar",
                    "descricao": "Aprovar somente se a renda complementar usada no simulador estiver documentada.",
                    "status": "pendente",
                },
            ]
        )

    if any(item in gatilhos_pendentes for item in ("garantido", "garantido_pre_obra")):
        checklist.append(
            {
                "categoria": "Fluxo",
                "titulo": "Revisar garantido e pre-obra",
                "descricao": "Conferir gap, prazo, entrada, reforcos e capacidade de pagamento antes da decisao.",
                "status": "pendente",
            }
        )

    if any(item in gatilhos_pendentes for item in ("desconto_comercial", "valor_negociado")):
        checklist.append(
            {
                "categoria": "Incentivo 7LM",
                "titulo": "Validar incentivo 7LM",
                "descricao": "Conferir margem, politica da unidade, valor faltante e justificativa comercial do incentivo solicitado.",
                "status": "pendente",
            }
        )

    if "sobrepreco_zerado" in gatilhos_pendentes:
        checklist.append(
            {
                "categoria": "Sobrepreço",
                "titulo": "Validar venda sem sobrepreço",
                "descricao": "Confirmar com o gestor a liberação da venda sem acréscimo comercial na unidade.",
                "status": "pendente",
            }
        )

    return checklist


def analisar_aprovacao_excecao(simulacao: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(simulacao or {})
    payload_snapshot = _json_dict(linha.get("payload_snapshot"))
    calculo_snapshot = payload_snapshot.get("calculo") if isinstance(payload_snapshot.get("calculo"), dict) else {}
    resumo_snapshot = (
        calculo_snapshot.get("resumo_operacao")
        if isinstance(calculo_snapshot.get("resumo_operacao"), dict)
        else {}
    )
    resumo = linha.get("resumo_operacao") or resumo_snapshot or {}
    status_simulacao = _limpar_texto(
        linha.get("status_simulacao")
        or resumo.get("status_simulacao")
        or linha.get("classificacao")
        or resumo.get("classificacao")
    ).lower()
    bloqueios_simulacao = [
        _limpar_texto(item)
        for item in (linha.get("bloqueios") or resumo.get("bloqueios") or [])
        if _limpar_texto(item)
    ]

    valor_total_operacao = _money(
        linha.get("valor_total_operacao")
        or resumo.get("valor_total_operacao")
    )
    valor_total_pago_cliente = _money(
        linha.get("valor_total_pago_cliente_exclui_incentivo")
        or linha.get("valor_total_pago_cliente")
        or linha.get("valor_total_cliente")
        or resumo.get("valor_total_pago_cliente_exclui_incentivo")
        or resumo.get("valor_total_pago_cliente")
        or resumo.get("valor_total_cliente")
    )
    total_pago_informado = any(
        origem.get(campo) is not None
        for origem in (linha, resumo)
        for campo in ("valor_total_pago_cliente_exclui_incentivo", "valor_total_pago_cliente", "valor_total_cliente")
    )
    desconto_imovel = _money(
        linha.get("incentivo_7lm")
        or linha.get("desconto_imovel")
        or resumo.get("incentivo_7lm")
        or resumo.get("desconto_imovel")
        or linha.get("imovel", {}).get("incentivo_7lm")
        or linha.get("imovel", {}).get("desconto_imovel")
    )
    sobrepreco = _money(
        linha.get("sobrepreco")
        or resumo.get("sobrepreco")
    )
    sobrepreco_informado = linha.get("sobrepreco") is not None or resumo.get("sobrepreco") is not None
    incentivo_maximo_efetivo = _money(
        linha.get("incentivo_7lm_maximo_efetivo")
        or linha.get("desconto_imovel_maximo_efetivo")
        or linha.get("valor_incentivo_maximo")
        or linha.get("valor_desconto_maximo")
        or resumo.get("incentivo_7lm_maximo_efetivo")
        or resumo.get("desconto_imovel_maximo_efetivo")
        or resumo.get("valor_incentivo_maximo")
        or resumo.get("desconto_imovel_maximo_configurado")
        or linha.get("imovel", {}).get("incentivo_7lm_maximo_efetivo")
        or linha.get("imovel", {}).get("desconto_imovel_maximo_efetivo")
        or linha.get("imovel", {}).get("valor_incentivo_maximo")
        or linha.get("imovel", {}).get("valor_desconto_maximo")
    )
    falta_informada = (
        linha.get("falta_para_valor_negociado")
        or linha.get("falta_para_imovel")
        or resumo.get("falta_para_valor_negociado")
        or resumo.get("falta_para_imovel")
    )
    falta_para_valor_negociado = _money(
        falta_informada
        if falta_informada is not None
        else (max(valor_total_operacao - valor_total_pago_cliente, DECIMAL_ZERO) if total_pago_informado else DECIMAL_ZERO)
    )
    excesso_informado = (
        linha.get("excesso_valor_negociado")
        or resumo.get("excesso_valor_negociado")
    )
    excesso_valor_negociado = _money(
        excesso_informado
        if excesso_informado is not None
        else (max(valor_total_pago_cliente - valor_total_operacao, DECIMAL_ZERO) if total_pago_informado else DECIMAL_ZERO)
    )
    margem_incentivo_disponivel = _money(max(incentivo_maximo_efetivo - desconto_imovel, DECIMAL_ZERO))
    percentual_comprometimento = _decimal(
        linha.get("percentual_comprometimento")
        or resumo.get("percentual_comprometimento")
    )
    parcela_7lm_media_pre = _money(
        linha.get("parcela_7lm_media_pre")
        or resumo.get("parcela_7lm_media_pre")
    )
    valor_parcela_minima_pre_obra = _money(
        linha.get("valor_parcela_minima_pre_obra")
        or resumo.get("valor_parcela_minima_pre_obra")
        or linha.get("imovel", {}).get("valor_parcela_minima_pre_obra")
    )
    valor_garantido_planejado = _money(
        linha.get("valor_garantido_planejado")
        or resumo.get("valor_garantido_planejado")
        or linha.get("valor_garantido")
        or resumo.get("valor_garantido")
        or linha.get("imovel", {}).get("valor_garantido_planejado")
        or linha.get("imovel", {}).get("valor_garantido")
    )
    valor_garantido_real = _money(
        linha.get("valor_garantido_real")
        or resumo.get("valor_garantido_real")
        or linha.get("valor_fechamento_inicial")
        or resumo.get("valor_fechamento_inicial")
    )
    valor_garantido_pre_obra_planejado = _money(
        linha.get("valor_garantido_pre_obra_planejado")
        or resumo.get("valor_garantido_pre_obra_planejado")
        or linha.get("imovel", {}).get("valor_garantido_pre_obra_planejado")
    )
    valor_garantido_pre_obra_real = _money(
        linha.get("valor_garantido_pre_obra_real")
        or resumo.get("valor_garantido_pre_obra_real")
        or linha.get("valor_projetado_entrega")
        or resumo.get("valor_projetado_entrega")
    )

    gap_garantia = _money(max(valor_garantido_planejado - valor_garantido_real, DECIMAL_ZERO))
    gap_pre_obra = _money(
        max(valor_garantido_pre_obra_planejado - valor_garantido_pre_obra_real, DECIMAL_ZERO)
    )
    garantido_encaixado = (
        valor_garantido_planejado > DECIMAL_ZERO
        and gap_garantia <= DECIMAL_ZERO
    )
    pre_obra_encaixado = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or gap_pre_obra <= DECIMAL_ZERO
    )
    gatilhos_comerciais_encaixados = garantido_encaixado and pre_obra_encaixado
    limite_gap_garantia = _limite_gap_aprovacao_excecao(valor_garantido_planejado)
    limite_gap_pre_obra = _limite_gap_aprovacao_excecao(valor_garantido_pre_obra_planejado)
    percentual_gap_garantia = (
        _percent(gap_garantia / valor_garantido_planejado)
        if valor_garantido_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    percentual_gap_pre_obra = (
        _percent(gap_pre_obra / valor_garantido_pre_obra_planejado)
        if valor_garantido_pre_obra_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    gatilhos_pendentes: list[str] = []
    bloqueios: list[str] = []
    motivos_aprovacao: list[str] = []
    contexto_cliente = _contexto_cliente_aprovacao(linha, calculo_snapshot)
    nucleo_familiar = contexto_cliente["nucleo_familiar"]
    composicao_familiar_requer_aprovacao = bool(contexto_cliente.get("exige_aprovacao"))

    if desconto_imovel > DESCONTO_SEM_APROVACAO_GESTOR:
        gatilhos_pendentes.append("desconto_comercial")
        motivos_aprovacao.append(
            f"Incentivo 7LM de {_moeda_texto(desconto_imovel)} acima do limite sem aprovação ({_moeda_texto(DESCONTO_SEM_APROVACAO_GESTOR)})."
        )

    if sobrepreco_informado and sobrepreco <= DECIMAL_ZERO:
        gatilhos_pendentes.append("sobrepreco_zerado")
        motivos_aprovacao.append(
            "Venda sem sobrepreço precisa de aprovação do gestor antes da reserva ou venda."
        )

    if falta_para_valor_negociado > DECIMAL_ZERO:
        gatilhos_pendentes.append("valor_negociado")
        if margem_incentivo_disponivel >= falta_para_valor_negociado:
            motivos_aprovacao.append(
                f"Faltam {_moeda_texto(falta_para_valor_negociado)} para atingir o valor negociado; pode seguir para decisão do gestor como Incentivo 7LM adicional."
            )
        else:
            motivos_aprovacao.append(
                f"Faltam {_moeda_texto(falta_para_valor_negociado)} para atingir o valor negociado."
            )
            bloqueios.append(
                f"Falta para valor negociado maior que a margem de Incentivo 7LM disponível ({_moeda_texto(margem_incentivo_disponivel)}). Ajuste entrada, balões/reforços ou parcelas antes da venda."
            )

    if gap_garantia > DECIMAL_ZERO:
        gatilhos_pendentes.append("garantido")
        motivos_aprovacao.append("Gap de garantido pendente para avaliação gerencial.")
        if gap_garantia > limite_gap_garantia:
            motivos_aprovacao.append(
                f"Gap do garantido em {_moeda_texto(gap_garantia)} acima da faixa sugerida ({_moeda_texto(limite_gap_garantia)})."
            )

    if gap_pre_obra > DECIMAL_ZERO:
        gatilhos_pendentes.append("garantido_pre_obra")
        motivos_aprovacao.append("Gap de garantido pré-obra pendente para avaliação gerencial.")
        if gap_pre_obra > limite_gap_pre_obra:
            motivos_aprovacao.append(
                f"Gap do garantido pré-obra em {_moeda_texto(gap_pre_obra)} acima da faixa sugerida ({_moeda_texto(limite_gap_pre_obra)})."
            )

    simulacao_invalidada_por_regra_comercial = (
        status_simulacao in (STATUS_SIMULACAO_INVALIDA, "invalida", "inválida")
        and bool(bloqueios_simulacao)
        and not gatilhos_comerciais_encaixados
    )
    if simulacao_invalidada_por_regra_comercial and "validacao_comercial" not in gatilhos_pendentes:
        gatilhos_pendentes.append("validacao_comercial")
        motivos_aprovacao.extend(bloqueios_simulacao)

    if valor_total_operacao <= DECIMAL_ZERO:
        bloqueios.append("Operação sem valor total válido não pode seguir para aprovação.")

    if percentual_comprometimento > LIMITE_COMPROMETIMENTO_PADRAO and not gatilhos_comerciais_encaixados:
        motivos_aprovacao.append("Comprometimento acima de 45% para decisão gerencial.")

    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        motivos_aprovacao.append(
            f"Parcela média de pré-obra abaixo do mínimo da unidade ({_moeda_texto(valor_parcela_minima_pre_obra)})."
        )

    if composicao_familiar_requer_aprovacao:
        gatilhos_pendentes.append("composicao_familiar")
        total_membros = nucleo_familiar.get("total_membros", 0)
        membros_em_analise = nucleo_familiar.get("membros_em_analise", 0)
        membros_compoem_renda = nucleo_familiar.get("membros_compoem_renda", 0)
        motivos_aprovacao.append(
            "Cliente possui composicao familiar vinculada: "
            f"{total_membros} integrante(s), {membros_em_analise} em analise e "
            f"{membros_compoem_renda} compondo renda."
        )
        motivos_aprovacao.append(
            "A venda depende de validacao cadastral, consulta de restricoes e conferencia documental de todos os CPFs envolvidos."
        )
        if membros_compoem_renda > 0:
            motivos_aprovacao.append(
                "Renda complementar do nucleo familiar influencia a capacidade de pagamento e precisa de aprovacao do gestor."
            )

    necessaria = bool(gatilhos_pendentes)
    permitida = necessaria and not bloqueios
    checklist_aprovacao = _checklist_aprovacao_excecao(
        composicao_familiar=composicao_familiar_requer_aprovacao,
        gatilhos_pendentes=gatilhos_pendentes,
    )

    if not necessaria:
        mensagem = "A operação já atende os gatilhos comerciais e não precisa de aprovação excepcional."
    elif composicao_familiar_requer_aprovacao and permitida:
        mensagem = "Operação com composição familiar exige aprovação do gestor antes da reserva ou venda."
    elif "sobrepreco_zerado" in gatilhos_pendentes and permitida:
        mensagem = "Venda sem sobrepreço exige aprovação do gestor antes da reserva ou venda."
    elif permitida:
        mensagem = "Operação bloqueada no simulador e elegível para envio ao gestor."
    else:
        mensagem = "Operação fora dos limites de aprovação excepcional."

    return {
        "necessaria": necessaria,
        "permitida": permitida,
        "mensagem": mensagem,
        "gatilhos_pendentes": gatilhos_pendentes,
        "bloqueios": bloqueios,
        "motivos_aprovacao": motivos_aprovacao,
        "checklist_aprovacao": checklist_aprovacao,
        "bloqueios_simulacao": bloqueios_simulacao,
        "composicao_familiar_requer_aprovacao": composicao_familiar_requer_aprovacao,
        "composicao_familiar": contexto_cliente,
        "nucleo_familiar": nucleo_familiar,
        "valor_garantido_planejado": valor_garantido_planejado,
        "valor_garantido_real": valor_garantido_real,
        "valor_garantido_pre_obra_planejado": valor_garantido_pre_obra_planejado,
        "valor_garantido_pre_obra_real": valor_garantido_pre_obra_real,
        "gap_garantia": gap_garantia,
        "gap_pre_obra": gap_pre_obra,
        "limite_gap_garantia": limite_gap_garantia,
        "limite_gap_pre_obra": limite_gap_pre_obra,
        "percentual_gap_garantia": percentual_gap_garantia,
        "percentual_gap_pre_obra": percentual_gap_pre_obra,
        "desconto_imovel": desconto_imovel,
        "incentivo_7lm": desconto_imovel,
        "sobrepreco": sobrepreco,
        "sobrepreco_zerado_requer_aprovacao": sobrepreco_informado and sobrepreco <= DECIMAL_ZERO,
        "limite_desconto_sem_aprovacao": DESCONTO_SEM_APROVACAO_GESTOR,
        "limite_incentivo_sem_aprovacao": DESCONTO_SEM_APROVACAO_GESTOR,
        "desconto_requer_aprovacao": desconto_imovel > DESCONTO_SEM_APROVACAO_GESTOR,
        "incentivo_requer_aprovacao": desconto_imovel > DESCONTO_SEM_APROVACAO_GESTOR,
        "falta_para_valor_negociado": falta_para_valor_negociado,
        "excesso_valor_negociado": excesso_valor_negociado,
        "valor_total_pago_cliente": valor_total_pago_cliente,
        "margem_incentivo_disponivel": margem_incentivo_disponivel,
        "incentivo_adicional_necessario": falta_para_valor_negociado,
    }


def _analisar_enquadramento_sugestao(resultado: dict[str, Any]) -> dict[str, Any]:
    resumo = resultado.get("resumo_operacao") or {}
    valor_garantido_planejado = _money(
        resumo.get("valor_garantido_planejado")
        or resumo.get("valor_garantido")
    )
    valor_garantido_real = _money(
        resumo.get("valor_garantido_real")
        or resumo.get("valor_fechamento_inicial")
    )
    valor_garantido_pre_obra_planejado = _money(resumo.get("valor_garantido_pre_obra_planejado"))
    valor_garantido_pre_obra_real = _money(
        resumo.get("valor_garantido_pre_obra_real")
        or resumo.get("valor_projetado_entrega")
    )
    status_comercial = _limpar_texto(
        resumo.get("status_comercial")
        or resumo.get("status_simulacao")
    ).lower()
    status_valido = status_comercial in (STATUS_SIMULACAO_IDEAL, STATUS_SIMULACAO_ATENCAO)
    garantia_enquadrada = (
        valor_garantido_planejado <= DECIMAL_ZERO
        or valor_garantido_real >= valor_garantido_planejado
    )
    pre_obra_enquadrada = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or valor_garantido_pre_obra_real >= valor_garantido_pre_obra_planejado
    )
    gap_garantia = _money(max(valor_garantido_planejado - valor_garantido_real, DECIMAL_ZERO))
    gap_pre_obra = _money(max(
        valor_garantido_pre_obra_planejado - valor_garantido_pre_obra_real,
        DECIMAL_ZERO,
    ))
    percentual_gap_garantia = (
        _percent(gap_garantia / valor_garantido_planejado)
        if valor_garantido_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    percentual_gap_pre_obra = (
        _percent(gap_pre_obra / valor_garantido_pre_obra_planejado)
        if valor_garantido_pre_obra_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    desvio_garantia = (
        _percent(abs(valor_garantido_real - valor_garantido_planejado) / valor_garantido_planejado)
        if valor_garantido_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    desvio_pre_obra = (
        _percent(abs(valor_garantido_pre_obra_real - valor_garantido_pre_obra_planejado) / valor_garantido_pre_obra_planejado)
        if valor_garantido_pre_obra_planejado > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    desvio_comercial = max(desvio_garantia, desvio_pre_obra)
    faixa_natural = garantia_enquadrada and pre_obra_enquadrada and status_valido

    return {
        "faixa_natural": faixa_natural,
        "status_valido": status_valido,
        "status_comercial": status_comercial,
        "garantia_enquadrada": garantia_enquadrada,
        "pre_obra_enquadrada": pre_obra_enquadrada,
        "valor_garantido_planejado": valor_garantido_planejado,
        "valor_garantido_real": valor_garantido_real,
        "valor_garantido_pre_obra_planejado": valor_garantido_pre_obra_planejado,
        "valor_garantido_pre_obra_real": valor_garantido_pre_obra_real,
        "gap_garantia": gap_garantia,
        "gap_pre_obra": gap_pre_obra,
        "percentual_gap_garantia": percentual_gap_garantia,
        "percentual_gap_pre_obra": percentual_gap_pre_obra,
        "desvio_garantia": desvio_garantia,
        "desvio_pre_obra": desvio_pre_obra,
        "desvio_comercial": desvio_comercial,
    }


def _gerar_justificativa_sugestao(
    resultado: dict[str, Any],
    *,
    analise_comercial: dict[str, Any],
    faixa_natural: bool,
    ajuste_entrada: dict[str, Any] | None,
) -> str:
    resumo = resultado.get("resumo_operacao") or {}
    percentual_comprometimento = _decimal(resumo.get("percentual_comprometimento"))
    parcela_7lm_media_pre = _money(resumo.get("parcela_7lm_media_pre"))
    valor_parcela_minima_pre_obra = _money(resumo.get("valor_parcela_minima_pre_obra"))
    valor_garantido_real = _money(analise_comercial.get("valor_garantido_real"))
    valor_garantido_planejado = _money(analise_comercial.get("valor_garantido_planejado"))
    gap_pre_obra = _money(analise_comercial.get("gap_pre_obra"))
    status_comercial = _limpar_texto(resumo.get("status_comercial")).lower()

    if faixa_natural:
        if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
            return "A renda fecha a operação, mas a parcela pré-obra ainda fica abaixo do piso exigido para esta unidade."
        if gap_pre_obra > DECIMAL_ZERO:
            return "Imóvel ideal pelo garantido planejado. Falta apenas fortalecer o fluxo até a entrega."
        if status_comercial == STATUS_SIMULACAO_ATENCAO:
            return "Imovel encaixado no garantido da unidade, mas o fluxo mensal ainda precisa de ajuste comercial."
        return (
            "Imóvel ideal para o cliente: o garantido real cobre o garantido planejado "
            f"da unidade ({_moeda_texto(valor_garantido_planejado)})."
        )

    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        return "Fora da faixa natural porque a parcela pré-obra da unidade fica abaixo do mínimo exigido."

    if not analise_comercial.get("garantia_enquadrada") and ajuste_entrada:
        return (
            "Fora da faixa natural com a estrutura atual. Aplique a entrada sugerida para levar o garantido real "
            f"de {_moeda_texto(valor_garantido_real)} para a meta da unidade."
        )

    if not analise_comercial.get("garantia_enquadrada"):
        return (
            "Fora da faixa natural porque o garantido real fecha em "
            f"{_moeda_texto(valor_garantido_real)} e a unidade pede {_moeda_texto(valor_garantido_planejado)}."
        )

    if percentual_comprometimento <= Decimal("0.35") and gap_pre_obra <= DECIMAL_ZERO:
        return "Melhor equilibrio entre entrada e parcela com conforto de renda."

    if percentual_comprometimento <= LIMITE_COMPROMETIMENTO_PADRAO:
        return "Comprometimento dentro da trava com ajustes simples para otimizar o fluxo pre e pos-entrega."

    return "Cenario com potencial, mas exige ajustes de entrada ou fluxo pre-entrega."


def _calcular_score_sugestao(
    resultado: dict[str, Any],
    status_imovel: str,
    analise_comercial: dict[str, Any] | None = None,
) -> Decimal:
    resumo = resultado.get("resumo_operacao") or {}
    if analise_comercial is None:
        analise_comercial = _analisar_enquadramento_sugestao(resultado)

    entrega = _decimal(resumo.get("percentual_projetado_entrega"))
    comprometimento = _decimal(resumo.get("percentual_comprometimento"))
    desvio_garantia = _decimal(analise_comercial.get("desvio_garantia"))
    desvio_pre_obra = _decimal(analise_comercial.get("desvio_pre_obra"))

    score_garantia = max(Decimal("0"), Decimal("1") - (desvio_garantia / Decimal("0.35")))
    score_pre_obra = max(Decimal("0"), Decimal("1") - (desvio_pre_obra / Decimal("0.35")))
    score_entrega = max(Decimal("0"), Decimal("1") - (max(ENTREGA_REFERENCIA - entrega, DECIMAL_ZERO) / Decimal("0.25")))
    score_comprometimento = max(Decimal("0"), Decimal("1") - (comprometimento / LIMITE_COMPROMETIMENTO_PADRAO))

    bonus_status = Decimal("1") if _normalizar_status_imovel(status_imovel) == "disponivel" else Decimal("0.4")

    score = (
        (score_garantia * Decimal("0.45"))
        + (score_pre_obra * Decimal("0.18"))
        + (score_entrega * Decimal("0.12"))
        + (score_comprometimento * Decimal("0.15"))
        + (bonus_status * Decimal("0.10"))
    ) * DECIMAL_100

    return _percent(score)


def _status_simulacao_valido(resultado: dict[str, Any]) -> bool:
    resumo = resultado.get("resumo_operacao") or {}
    status = _limpar_texto(resumo.get("status_simulacao")).lower()
    return status in (STATUS_SIMULACAO_IDEAL, STATUS_SIMULACAO_ATENCAO)


def _ordenar_sugestao_imovel(
    item: dict[str, Any],
    *,
    melhor_valor_faixa_natural: Decimal = DECIMAL_ZERO,
) -> tuple[Any, ...]:
    imovel = item.get("imovel") or {}
    resumo = item.get("resumo_operacao") or {}
    ajuste_entrada = item.get("ajuste_entrada") or {}
    analise_comercial = item.get("analise_comercial") or {}
    valor_imovel = _valor_sugestao_para_ranking(item)
    gap_valor_natural = (
        _money(max(melhor_valor_faixa_natural - valor_imovel, DECIMAL_ZERO))
        if item.get("faixa_natural") and melhor_valor_faixa_natural > DECIMAL_ZERO
        else DECIMAL_ZERO
    )
    return (
        not bool(item.get("faixa_natural")),
        _normalizar_status_imovel(imovel.get("status")) != "disponivel",
        item.get("classificacao") == STATUS_SIMULACAO_INVALIDA,
        not bool(analise_comercial.get("garantia_enquadrada")),
        float(_decimal(analise_comercial.get("percentual_gap_garantia"))),
        float(_decimal(analise_comercial.get("percentual_gap_pre_obra"))),
        float(gap_valor_natural),
        float(_decimal(analise_comercial.get("desvio_comercial"))),
        -float(_decimal(item.get("score"))),
        float(_money(ajuste_entrada.get("entrada_sugerida"))),
        float(_decimal(resumo.get("percentual_comprometimento"))),
        -float(valor_imovel),
    )


def _classificar_exibicao_sugestao(
    item: dict[str, Any],
    *,
    melhor_score_faixa_natural: Decimal,
    melhor_valor_faixa_natural: Decimal,
) -> str:
    if not item.get("faixa_natural"):
        classificacao = _limpar_texto(item.get("classificacao")).lower()
        if classificacao in (STATUS_SIMULACAO_IDEAL, STATUS_SIMULACAO_ATENCAO) or item.get("ajuste_entrada") or item.get("ajuste_fluxo_pre_obra"):
            return STATUS_SIMULACAO_ATENCAO
        return STATUS_SIMULACAO_INVALIDA

    classificacao = _limpar_texto(item.get("classificacao")).lower()
    if classificacao in (STATUS_SIMULACAO_IDEAL, STATUS_SIMULACAO_ATENCAO):
        return classificacao or STATUS_SIMULACAO_IDEAL

    score_atual = _decimal(item.get("score"))
    desvio_comercial = _decimal((item.get("analise_comercial") or {}).get("desvio_comercial"))
    gap_score = max(melhor_score_faixa_natural - score_atual, DECIMAL_ZERO)
    valor_imovel = _valor_sugestao_para_ranking(item)
    gap_valor = (
        _percent(max(melhor_valor_faixa_natural - valor_imovel, DECIMAL_ZERO) / melhor_valor_faixa_natural)
        if melhor_valor_faixa_natural > DECIMAL_ZERO
        else DECIMAL_ZERO
    )

    if gap_score <= Decimal("5") and desvio_comercial <= Decimal("0.03") and gap_valor <= Decimal("0.03"):
        return STATUS_SIMULACAO_IDEAL

    return STATUS_SIMULACAO_ATENCAO


def _reordenar_sugestoes_para_exibicao(sugestões: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ideais = [
        item
        for item in sugestões
        if _limpar_texto(item.get("classificacao_sugestao")).lower() == STATUS_SIMULACAO_IDEAL
    ]
    demais = [
        item
        for item in sugestões
        if _limpar_texto(item.get("classificacao_sugestao")).lower() != STATUS_SIMULACAO_IDEAL
    ]
    ideais.sort(
        key=lambda item: float(_valor_sugestao_para_ranking(item)),
        reverse=True,
    )
    return ideais + demais


def _sugerir_ajuste_entrada(
    cliente: dict[str, Any] | Any,
    complementos: list[dict[str, Any] | Any],
    imovel: dict[str, Any] | Any,
    payload: dict[str, Any],
    resultado_atual: dict[str, Any],
) -> dict[str, Any] | None:
    resumo_atual = resultado_atual.get("resumo_operacao") or {}
    entrada_atual = _money(resumo_atual.get("entrada"))
    valor_total_operacao = _money(resumo_atual.get("valor_total_operacao"))

    if valor_total_operacao <= DECIMAL_ZERO:
        return None

    financiamento = _money(resumo_atual.get("financiamento_caixa"))
    fgts = _money(resumo_atual.get("fgts"))
    valor_garantido_planejado = _money(
        resumo_atual.get("valor_garantido_planejado")
        or resumo_atual.get("valor_garantido")
        or (resultado_atual.get("imovel") or {}).get("valor_garantido_planejado")
        or (resultado_atual.get("imovel") or {}).get("valor_garantido")
    )
    valor_garantido_real = _money(
        resumo_atual.get("valor_garantido_real")
        or resumo_atual.get("valor_fechamento_inicial")
    )
    valor_parcela_minima_pre_obra = _money(
        resumo_atual.get("valor_parcela_minima_pre_obra")
        or (resultado_atual.get("imovel") or {}).get("valor_parcela_minima_pre_obra")
    )
    parcela_7lm_media_pre = _money(resumo_atual.get("parcela_7lm_media_pre"))
    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        return None
    gap_garantia = _money(max(valor_garantido_planejado - valor_garantido_real, DECIMAL_ZERO))
    limite_entrada = _money(max(valor_total_operacao - financiamento - fgts, DECIMAL_ZERO))
    entrada_alvo_garantia = _money(entrada_atual + gap_garantia)

    renda_total = _money(resumo_atual.get("renda_total"))
    limite_comprometimento = _money(resumo_atual.get("limite_comprometimento"))
    parcela_referencia = _money(resumo_atual.get("parcela_referencia"))
    meses_pre = int(_decimal(resumo_atual.get("meses_pre_entrega"), Decimal("1")) or Decimal("1"))
    meses_pre = max(meses_pre, 1)
    excesso_mensal = _money(max(parcela_referencia - limite_comprometimento, DECIMAL_ZERO))
    entrada_alvo_comprometimento = _money(entrada_atual + (excesso_mensal * Decimal(meses_pre)))

    entrada_sugerida = _money(max(entrada_atual, entrada_alvo_garantia, entrada_alvo_comprometimento))
    entrada_sugerida = _money(min(entrada_sugerida, limite_entrada))
    incremento = _money(max(entrada_sugerida - entrada_atual, DECIMAL_ZERO))

    if incremento <= DECIMAL_ZERO:
        return None

    valor_garantido_real_ajustado = _money(valor_garantido_real + incremento)
    fechamento_ajustado = _percent(valor_garantido_real_ajustado / valor_total_operacao)
    valor_entrega_ajustado = _money(_money(resumo_atual.get("valor_projetado_entrega")) + incremento)
    entrega_ajustada = _percent(valor_entrega_ajustado / valor_total_operacao)
    parcela_referencia_ajustada = _money(max(parcela_referencia - (incremento / Decimal(meses_pre)), DECIMAL_ZERO))
    comprometimento_ajustado = _percent(parcela_referencia_ajustada / renda_total) if renda_total > DECIMAL_ZERO else Decimal("1")
    status_ajustado, _, _ = _avaliar_status_geral(
        percentual_comprometimento=comprometimento_ajustado,
        limite_comprometimento=limite_comprometimento,
        parcela_financiamento_banco=_money(resumo_atual.get("parcela_financiamento_banco")),
        valor_garantido_real=valor_garantido_real_ajustado,
        valor_garantido_planejado=valor_garantido_planejado,
        parcela_7lm_media_pre=parcela_7lm_media_pre,
        valor_parcela_minima_pre_obra=valor_parcela_minima_pre_obra,
        valor_garantido_pre_obra_real=valor_entrega_ajustado,
        valor_garantido_pre_obra_planejado=_money(resumo_atual.get("valor_garantido_pre_obra_planejado")),
        classificacao_entrega=_classificar_entrega(
            entrega_ajustada,
            resumo_atual.get("percentual_captacao_ate_entrega"),
        ),
        status_imovel=(resultado_atual.get("imovel") or {}).get("status") or "",
        valor_total_operacao=valor_total_operacao,
    )

    return {
        "entrada_atual": entrada_atual,
        "entrada_sugerida": entrada_sugerida,
        "incremento_necessario": incremento,
        "status_apos_ajuste": status_ajustado,
        "percentual_comprometimento_ajustado": comprometimento_ajustado,
        "parcela_referencia_ajustada": parcela_referencia_ajustada,
        "fechamento_inicial_ajustado": fechamento_ajustado,
        "projecao_entrega_ajustada": entrega_ajustada,
        "valor_garantido_real_ajustado": valor_garantido_real_ajustado,
    }

def sugerir_imoveis_inteligentes(
    cliente: dict[str, Any] | Any,
    complementos: list[dict[str, Any] | Any],
    imoveis: list[dict[str, Any] | Any],
    payload: dict[str, Any],
    *,
    limite: int = 12,
) -> dict[str, Any]:
    sugestões = []
    payload_base = _montar_payload_base_sugestao(payload)

    for item in imoveis or []:
        resultado = calcular_simulacao_comercial(cliente, complementos, item, payload_base, incluir_demonstrativo=False)
        resumo = resultado.get("resumo_operacao") or {}
        analise_comercial = _analisar_enquadramento_sugestao(resultado)
        faixa_natural = bool(analise_comercial.get("faixa_natural"))

        score = _calcular_score_sugestao(
            resultado,
            (resultado.get("imovel") or {}).get("status") or "",
            analise_comercial,
        )
        ajuste_entrada = None if faixa_natural else _sugerir_ajuste_entrada(cliente, complementos, item, payload_base, resultado)
        justificativa = _gerar_justificativa_sugestao(
            resultado,
            analise_comercial=analise_comercial,
            faixa_natural=faixa_natural,
            ajuste_entrada=ajuste_entrada,
        )

        sugestões.append(
            {
                "imovel": resultado.get("imovel"),
                "resumo_operacao": resumo,
                "score": score,
                "classificacao": resumo.get("status_comercial") or resumo.get("status_simulacao"),
                "faixa_natural": faixa_natural,
                "analise_comercial": analise_comercial,
                "justificativa": justificativa,
                "ajuste_entrada": ajuste_entrada,
                "ajuste_fluxo_pre_obra": resumo.get("sugestao_reforco_pre_obra"),
            }
        )

    melhor_valor_faixa_natural = max(
        (_valor_sugestao_para_ranking(item) for item in sugestões if item.get("faixa_natural")),
        default=DECIMAL_ZERO,
    )
    sugestões.sort(
        key=lambda item: _ordenar_sugestao_imovel(
            item,
            melhor_valor_faixa_natural=melhor_valor_faixa_natural,
        )
    )
    melhor_score_faixa_natural = max(
        (_decimal(item.get("score")) for item in sugestões if item.get("faixa_natural")),
        default=DECIMAL_ZERO,
    )
    for item in sugestões:
        item["classificacao_sugestao"] = _classificar_exibicao_sugestao(
            item,
            melhor_score_faixa_natural=melhor_score_faixa_natural,
            melhor_valor_faixa_natural=melhor_valor_faixa_natural,
        )
    sugestões = _reordenar_sugestoes_para_exibicao(sugestões)

    melhores = sugestões[: max(1, int(limite or 12))]
    melhor = melhores[0] if melhores else None

    return {
        "melhor_match": melhor,
        "alternativas": melhores[1:] if len(melhores) > 1 else [],
        "items": melhores,
        "quantidade_avaliada": len(sugestões),
    }


def validar_operacao_final(simulacao: dict[str, Any] | Any, acao: str) -> tuple[bool, list[str]]:
    linha = dict(simulacao or {})
    payload_snapshot = _json_dict(linha.get("payload_snapshot"))
    calculo_snapshot = payload_snapshot.get("calculo") if isinstance(payload_snapshot.get("calculo"), dict) else {}
    status = _limpar_texto(linha.get("status_simulacao") or linha.get("resumo_operacao", {}).get("status_simulacao")).lower()
    percentual_comprometimento = _decimal(
        linha.get("percentual_comprometimento")
        or linha.get("resumo_operacao", {}).get("percentual_comprometimento")
    )
    limite_comprometimento = _money(
        linha.get("limite_comprometimento")
        or linha.get("resumo_operacao", {}).get("limite_comprometimento")
    )
    percentual_fechamento_minimo = _percentual_fechamento_minimo_imovel(
        linha.get("percentual_fechamento_minimo")
        or linha.get("resumo_operacao", {}).get("percentual_fechamento_minimo")
        or linha.get("imovel", {}).get("percentual_fechamento_minimo")
    )
    valor_garantido_planejado = _money(
        linha.get("valor_garantido_planejado")
        or linha.get("resumo_operacao", {}).get("valor_garantido_planejado")
        or linha.get("valor_garantido")
        or linha.get("resumo_operacao", {}).get("valor_garantido")
        or linha.get("imovel", {}).get("valor_garantido_planejado")
        or linha.get("imovel", {}).get("valor_garantido")
        or calcular_valor_garantido_padrao(
            linha.get("valor_imovel")
            or linha.get("resumo_operacao", {}).get("valor_imovel")
            or linha.get("imovel", {}).get("valor"),
            percentual_fechamento_minimo,
        )
        or DECIMAL_ZERO
    )
    valor_garantido_real = _money(
        linha.get("valor_garantido_real")
        or linha.get("resumo_operacao", {}).get("valor_garantido_real")
        or linha.get("valor_fechamento_inicial")
        or linha.get("resumo_operacao", {}).get("valor_fechamento_inicial")
    )
    valor_garantido_pre_obra_planejado = _money(
        linha.get("valor_garantido_pre_obra_planejado")
        or linha.get("resumo_operacao", {}).get("valor_garantido_pre_obra_planejado")
        or linha.get("imovel", {}).get("valor_garantido_pre_obra_planejado")
    )
    valor_garantido_pre_obra_real = _money(
        linha.get("valor_garantido_pre_obra_real")
        or linha.get("resumo_operacao", {}).get("valor_garantido_pre_obra_real")
        or linha.get("valor_projetado_entrega")
        or linha.get("resumo_operacao", {}).get("valor_projetado_entrega")
    )
    garantido_encaixado = valor_garantido_planejado > DECIMAL_ZERO and valor_garantido_real >= valor_garantido_planejado
    pre_obra_encaixado = (
        valor_garantido_pre_obra_planejado <= DECIMAL_ZERO
        or valor_garantido_pre_obra_real >= valor_garantido_pre_obra_planejado
    )
    gatilhos_comerciais_encaixados = garantido_encaixado and pre_obra_encaixado
    parcela_7lm_media_pre = _money(
        linha.get("parcela_7lm_media_pre")
        or linha.get("resumo_operacao", {}).get("parcela_7lm_media_pre")
    )
    valor_parcela_minima_pre_obra = _money(
        linha.get("valor_parcela_minima_pre_obra")
        or linha.get("resumo_operacao", {}).get("valor_parcela_minima_pre_obra")
        or linha.get("imovel", {}).get("valor_parcela_minima_pre_obra")
    )
    valor_total_operacao = _money(
        linha.get("valor_total_operacao")
        or linha.get("resumo_operacao", {}).get("valor_total_operacao")
    )
    valor_total_pago_cliente = _money(
        linha.get("valor_total_pago_cliente_exclui_incentivo")
        or linha.get("valor_total_pago_cliente")
        or linha.get("valor_total_cliente")
        or linha.get("resumo_operacao", {}).get("valor_total_pago_cliente_exclui_incentivo")
        or linha.get("resumo_operacao", {}).get("valor_total_pago_cliente")
        or linha.get("resumo_operacao", {}).get("valor_total_cliente")
    )
    resumo_linha = linha.get("resumo_operacao", {}) if isinstance(linha.get("resumo_operacao"), dict) else {}
    total_pago_informado = any(
        origem.get(campo) is not None
        for origem in (linha, resumo_linha)
        for campo in ("valor_total_pago_cliente_exclui_incentivo", "valor_total_pago_cliente", "valor_total_cliente")
    )
    falta_informada = (
        linha.get("falta_para_valor_negociado")
        or linha.get("falta_para_imovel")
        or resumo_linha.get("falta_para_valor_negociado")
        or resumo_linha.get("falta_para_imovel")
    )
    falta_para_valor_negociado = _money(
        falta_informada
        if falta_informada is not None
        else (max(valor_total_operacao - valor_total_pago_cliente, DECIMAL_ZERO) if total_pago_informado else DECIMAL_ZERO)
    )
    excesso_informado = (
        linha.get("excesso_valor_negociado")
        or resumo_linha.get("excesso_valor_negociado")
    )
    excesso_valor_negociado = _money(
        excesso_informado
        if excesso_informado is not None
        else (max(valor_total_pago_cliente - valor_total_operacao, DECIMAL_ZERO) if total_pago_informado else DECIMAL_ZERO)
    )
    desconto_imovel = _money(
        linha.get("incentivo_7lm")
        or linha.get("desconto_imovel")
        or linha.get("resumo_operacao", {}).get("incentivo_7lm")
        or linha.get("resumo_operacao", {}).get("desconto_imovel")
        or linha.get("imovel", {}).get("incentivo_7lm")
        or linha.get("imovel", {}).get("desconto_imovel")
    )
    sobrepreco = _money(
        linha.get("sobrepreco")
        or linha.get("resumo_operacao", {}).get("sobrepreco")
    )
    sobrepreco_informado = (
        linha.get("sobrepreco") is not None
        or linha.get("resumo_operacao", {}).get("sobrepreco") is not None
    )

    erros: list[str] = []
    contexto_cliente = _contexto_cliente_aprovacao(linha, calculo_snapshot)

    if status == STATUS_SIMULACAO_INVALIDA and not gatilhos_comerciais_encaixados:
        erros.append("A simulacao esta inválida para acao final.")

    if contexto_cliente.get("exige_aprovacao"):
        erros.append("Composicao familiar vinculada exige aprovação do gestor antes de reservar ou vender.")

    if percentual_comprometimento > LIMITE_COMPROMETIMENTO_PADRAO and not gatilhos_comerciais_encaixados:
        erros.append("Comprometimento de renda acima de 45% bloqueia a operação.")

    if valor_garantido_real < valor_garantido_planejado:
        erros.append(
            f"Garantido real abaixo do planejado da unidade ({_moeda_texto(valor_garantido_planejado)})."
        )

    if valor_garantido_pre_obra_planejado > DECIMAL_ZERO and valor_garantido_pre_obra_real < valor_garantido_pre_obra_planejado:
        erros.append(
            f"Garantido + pré-obra real abaixo do planejado da unidade ({_moeda_texto(valor_garantido_pre_obra_planejado)})."
        )

    if desconto_imovel > DESCONTO_SEM_APROVACAO_GESTOR:
        erros.append(
            f"Incentivo 7LM acima de {_moeda_texto(DESCONTO_SEM_APROVACAO_GESTOR)} exige aprovação do gestor."
        )

    if acao == "vender" and sobrepreco_informado and sobrepreco <= DECIMAL_ZERO:
        erros.append("Venda sem sobrepreço exige aprovação do gestor.")

    if valor_parcela_minima_pre_obra > DECIMAL_ZERO and parcela_7lm_media_pre < valor_parcela_minima_pre_obra:
        erros.append(
            f"Parcela mídia de pré-obra abaixo do mínimo exigido para a unidade ({_moeda_texto(valor_parcela_minima_pre_obra)})."
        )

    if acao == "vender" and falta_para_valor_negociado > DECIMAL_ZERO:
        erros.append(
            f"Venda bloqueada: ainda falta {_moeda_texto(falta_para_valor_negociado)} para atingir o valor negociado do imóvel."
        )
    if acao == "vender" and excesso_valor_negociado > DECIMAL_ZERO:
        erros.append(
            f"Venda bloqueada: o total considerado excede o valor negociado em {_moeda_texto(excesso_valor_negociado)}."
        )

    return len(erros) == 0, erros


def serializar_simulacao(registro: dict[str, Any] | Any, parcelas: list[dict[str, Any] | Any] | None = None) -> dict[str, Any]:
    linha = dict(registro or {})

    parcelas_serializadas = [serializar_parcela(item) for item in (parcelas or [])]
    payload_snapshot = _json_dict(linha.get("payload_snapshot"))
    calculo_snapshot = payload_snapshot.get("calculo") if isinstance(payload_snapshot.get("calculo"), dict) else {}
    resumo_snapshot = calculo_snapshot.get("resumo_operacao") if isinstance(calculo_snapshot.get("resumo_operacao"), dict) else {}

    resultado = {
        "id": str(linha.get("identificador_simulacao") or ""),
        "cliente_id": str(linha.get("identificador_cliente") or ""),
        "imovel_id": str(linha.get("identificador_imovel") or ""),
        "empreendimento": linha.get("empreendimento"),
        "corretor_id": str(linha.get("identificador_corretor") or "") or None,
        "renda_principal": _money(linha.get("renda_principal")),
        "renda_complementar": _money(linha.get("renda_complementar")),
        "renda_total": _money(linha.get("renda_total")),
        "limite_comprometimento": _money(linha.get("limite_comprometimento")),
        "parcela_cliente_maxima": _money(resumo_snapshot.get("parcela_cliente_maxima")),
        "parcela_cliente_informada": _money(resumo_snapshot.get("parcela_cliente_informada")),
        "percentual_comprometimento": _percent(_decimal(linha.get("percentual_comprometimento"))),
        "valor_imovel": _money(linha.get("valor_imovel")),
        "valor_total_operacao": _money(linha.get("valor_total_operacao")),
        "financiamento_caixa": _money(linha.get("financiamento_caixa")),
        "parcela_financiamento_banco": _money(resumo_snapshot.get("parcela_financiamento_banco")),
        "capacidade_pos_obra_7lm": _money(resumo_snapshot.get("capacidade_pos_obra_7lm")),
        "parcela_7lm_pos": _money(resumo_snapshot.get("parcela_7lm_pos")),
        "parcela_7lm_pos_minima": _money(resumo_snapshot.get("parcela_7lm_pos_minima")),
        "parcela_7lm_pos_ideal": _money(resumo_snapshot.get("parcela_7lm_pos_ideal")),
        "fgts": _money(linha.get("fgts")),
        "subsidio": _money(linha.get("subsidio")),
        "cheque_moradia": _money(linha.get("cheque_moradia")),
        "entrada": _money(linha.get("entrada")),
        "pro_soluto_total": _money(linha.get("pro_soluto_total")),
        "sobrepreco": _money(linha.get("sobrepreco")),
        "desconto_imovel": _money(resumo_snapshot.get("desconto_imovel")),
        "incentivo_7lm": _money(resumo_snapshot.get("incentivo_7lm") or resumo_snapshot.get("desconto_imovel")),
        "valor_total_pago_cliente": _money(resumo_snapshot.get("valor_total_pago_cliente")),
        "valor_total_pago_cliente_exclui_incentivo": _money(
            resumo_snapshot.get("valor_total_pago_cliente_exclui_incentivo")
            or resumo_snapshot.get("valor_total_pago_cliente")
        ),
        "valor_total_coberto_cliente_incentivo": _money(
            resumo_snapshot.get("valor_total_coberto_cliente_incentivo")
            or resumo_snapshot.get("valor_total_pago_cliente_com_incentivo")
        ),
        "falta_para_valor_negociado": _money(resumo_snapshot.get("falta_para_valor_negociado")),
        "excesso_valor_negociado": _money(resumo_snapshot.get("excesso_valor_negociado")),
        "percentual_fechamento_inicial": _percent(_decimal(linha.get("percentual_fechamento_inicial"))),
        "percentual_fechamento_minimo": _percent(
            _decimal(
                resumo_snapshot.get("percentual_fechamento_minimo")
                or calculo_snapshot.get("imovel", {}).get("percentual_fechamento_minimo")
                or FECHAMENTO_MINIMO_PADRAO
            )
        ),
        "valor_garantido": _money(
            resumo_snapshot.get("valor_garantido")
            or calculo_snapshot.get("imovel", {}).get("valor_garantido")
            or calcular_valor_garantido_padrao(
                linha.get("valor_imovel")
                or resumo_snapshot.get("valor_imovel")
                or calculo_snapshot.get("imovel", {}).get("valor"),
                resumo_snapshot.get("percentual_fechamento_minimo")
                or calculo_snapshot.get("imovel", {}).get("percentual_fechamento_minimo")
                or FECHAMENTO_MINIMO_PADRAO,
            )
            or DECIMAL_ZERO
        ),
        "valor_garantido_planejado": _money(
            resumo_snapshot.get("valor_garantido_planejado")
            or resumo_snapshot.get("valor_garantido")
            or calculo_snapshot.get("imovel", {}).get("valor_garantido_planejado")
            or calculo_snapshot.get("imovel", {}).get("valor_garantido")
            or DECIMAL_ZERO
        ),
        "valor_fechamento_inicial": _money(resumo_snapshot.get("valor_fechamento_inicial")),
        "valor_garantido_real": _money(
            resumo_snapshot.get("valor_garantido_real")
            or resumo_snapshot.get("valor_fechamento_inicial")
        ),
        "valor_garantido_pre_obra_planejado": _money(
            resumo_snapshot.get("valor_garantido_pre_obra_planejado")
            or calculo_snapshot.get("imovel", {}).get("valor_garantido_pre_obra_planejado")
            or DECIMAL_ZERO
        ),
        "valor_projetado_entrega": _money(resumo_snapshot.get("valor_projetado_entrega")),
        "valor_garantido_pre_obra_real": _money(
            resumo_snapshot.get("valor_garantido_pre_obra_real")
            or resumo_snapshot.get("valor_projetado_entrega")
        ),
        "parcela_7lm_media_pre": _money(resumo_snapshot.get("parcela_7lm_media_pre")),
        "valor_parcela_minima_pre_obra": _money(
            resumo_snapshot.get("valor_parcela_minima_pre_obra")
            or calculo_snapshot.get("imovel", {}).get("valor_parcela_minima_pre_obra")
            or DECIMAL_ZERO
        ),
        "classificacao_fechamento_inicial": linha.get("classificacao_fechamento_inicial"),
        "percentual_projetado_entrega": _percent(_decimal(linha.get("percentual_projetado_entrega"))),
        "classificacao_projecao_entrega": linha.get("classificacao_projecao_entrega"),
        "saldo_pos_entrega": _money(linha.get("saldo_pos_entrega")),
        "meses_pre_entrega": int(linha.get("meses_pre_entrega") or 0),
        "meses_pos_entrega": int(linha.get("meses_pos_entrega") or 0),
        "status_comercial": resumo_snapshot.get("status_comercial"),
        "status_simulacao": linha.get("status_simulacao"),
        "payload_snapshot": payload_snapshot,
        "data_hora_criacao": linha.get("data_hora_criacao"),
        "data_hora_atualizado_em": linha.get("data_hora_atualizado_em"),
        "demonstrativo": parcelas_serializadas,
    }
    resultado["aprovacao_excecao"] = analisar_aprovacao_excecao(resultado)
    return resultado


def serializar_parcela(registro: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(registro or {})
    return {
        "id": str(linha.get("identificador_parcela") or ""),
        "simulacao_id": str(linha.get("identificador_simulacao") or ""),
        "fase": linha.get("fase"),
        "tipo": linha.get("tipo_parcela") or linha.get("tipo"),
        "parcela": int(linha.get("numero_parcela") or linha.get("parcela") or 1),
        "vencimento": linha.get("vencimento_previsto") or linha.get("vencimento"),
        "valor": _money(linha.get("valor_parcela") or linha.get("valor")),
        "percentual_renda": _percent(_decimal(linha.get("percentual_renda_comprometido") or linha.get("percentual_renda"))),
        "observacao": linha.get("observacao"),
        "data_hora_criacao": linha.get("data_hora_criacao"),
    }


def montar_payload_simulacao_persistencia(
    calculo: dict[str, Any],
    *,
    identificador_cliente: str,
    identificador_imovel: str,
    identificador_corretor: str,
    payload_snapshot_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resumo = calculo.get("resumo_operacao") or {}
    cliente = calculo.get("cliente") or {}

    payload_snapshot = {
        "calculo": calculo,
        "extra": payload_snapshot_extra or {},
    }

    return {
        "identificador_cliente": identificador_cliente,
        "identificador_imovel": identificador_imovel,
        "empreendimento": (calculo.get("imovel") or {}).get("empreendimento"),
        "identificador_corretor": identificador_corretor,
        "renda_principal": _money(cliente.get("renda_principal")),
        "renda_complementar": _money(cliente.get("renda_complementar")),
        "renda_total": _money(cliente.get("renda_total")),
        "limite_comprometimento": _money(cliente.get("limite_comprometimento")),
        "percentual_comprometimento": _percent(_decimal(resumo.get("percentual_comprometimento"))),
        "valor_imovel": _money(resumo.get("valor_imovel")),
        "valor_total_operacao": _money(resumo.get("valor_total_operacao")),
        "financiamento_caixa": _money(resumo.get("financiamento_caixa")),
        "fgts": _money(resumo.get("fgts")),
        "subsidio": _money(resumo.get("subsidio")),
        "cheque_moradia": _money(resumo.get("cheque_moradia")),
        "entrada": _money(resumo.get("entrada")),
        "pro_soluto_total": _money(resumo.get("pro_soluto_total")),
        "sobrepreco": _money(resumo.get("sobrepreco")),
        "percentual_fechamento_inicial": _percent(_decimal(resumo.get("percentual_fechamento_inicial"))),
        "classificacao_fechamento_inicial": _limpar_texto(resumo.get("classificacao_fechamento_inicial")),
        "percentual_projetado_entrega": _percent(_decimal(resumo.get("percentual_projetado_entrega"))),
        "classificacao_projecao_entrega": _limpar_texto(resumo.get("classificacao_projecao_entrega")),
        "saldo_pos_entrega": _money(resumo.get("saldo_pos_entrega")),
        "meses_pre_entrega": int(resumo.get("meses_pre_entrega") or 0),
        "meses_pos_entrega": int(resumo.get("meses_pos_entrega") or 0),
        "status_simulacao": _limpar_texto(resumo.get("status_simulacao")),
        "payload_snapshot": payload_snapshot,
    }


def serializar_reserva(registro: dict[str, Any] | Any, *, prefixo: str = "") -> dict[str, Any]:
    linha = dict(registro or {})
    payload_snapshot = _json_dict(_valor_prefixado(linha, prefixo, "negociacao_payload_snapshot"))
    calculo = payload_snapshot.get("calculo") if isinstance(payload_snapshot.get("calculo"), dict) else {}
    resumo_snapshot = calculo.get("resumo_operacao") if isinstance(calculo.get("resumo_operacao"), dict) else {}

    cliente_nome = _limpar_texto(_valor_prefixado(linha, prefixo, "cliente_nome"))
    cliente_cpf = _limpar_texto(_valor_prefixado(linha, prefixo, "cliente_cpf"))
    cliente_cidade = _limpar_texto(_valor_prefixado(linha, prefixo, "cliente_cidade"))
    cliente_email = _limpar_texto(_valor_prefixado(linha, prefixo, "cliente_email"))
    cliente_telefone = _limpar_texto(_valor_prefixado(linha, prefixo, "cliente_telefone")) or _limpar_texto(
        _valor_prefixado(linha, prefixo, "cliente_celular")
    )

    imovel_titulo = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_titulo"))
    imovel_status = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_status"))
    imovel_cidade = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_cidade"))
    imovel_bairro = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_bairro"))
    imovel_estado = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_estado"))
    imovel_endereco = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_endereco"))
    imovel_tipo = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_tipo_imovel"))
    imovel_foto = _limpar_texto(_valor_prefixado(linha, prefixo, "imovel_foto_principal"))
    reservado_por = str(_valor_prefixado(linha, prefixo, "reservado_por") or "") or None
    reservado_por_nome = _limpar_texto(_valor_prefixado(linha, prefixo, "reservado_por_nome"))
    reservado_por_email = _limpar_texto(_valor_prefixado(linha, prefixo, "reservado_por_email"))

    reservado_por_usuario = {
        "id": reservado_por,
        "nome_completo": reservado_por_nome or None,
        "email": reservado_por_email or None,
    }

    negociacao = {
        "valor_imovel": _money(
            _valor_prefixado(linha, prefixo, "negociacao_valor_imovel") or resumo_snapshot.get("valor_imovel")
        ),
        "valor_total_operacao": _money(
            _valor_prefixado(linha, prefixo, "negociacao_valor_total_operacao") or resumo_snapshot.get("valor_total_operacao")
        ),
        "financiamento_caixa": _money(
            _valor_prefixado(linha, prefixo, "negociacao_financiamento_caixa") or resumo_snapshot.get("financiamento_caixa")
        ),
        "parcela_financiamento_banco": _money(resumo_snapshot.get("parcela_financiamento_banco")),
        "capacidade_pos_obra_7lm": _money(resumo_snapshot.get("capacidade_pos_obra_7lm")),
        "parcela_7lm_pos": _money(resumo_snapshot.get("parcela_7lm_pos")),
        "parcela_7lm_pos_minima": _money(resumo_snapshot.get("parcela_7lm_pos_minima")),
        "parcela_7lm_pos_ideal": _money(resumo_snapshot.get("parcela_7lm_pos_ideal")),
        "fgts": _money(_valor_prefixado(linha, prefixo, "negociacao_fgts") or resumo_snapshot.get("fgts")),
        "subsidio": _money(_valor_prefixado(linha, prefixo, "negociacao_subsidio") or resumo_snapshot.get("subsidio")),
        "cheque_moradia": _money(_valor_prefixado(linha, prefixo, "negociacao_cheque_moradia") or resumo_snapshot.get("cheque_moradia")),
        "entrada": _money(_valor_prefixado(linha, prefixo, "negociacao_entrada") or resumo_snapshot.get("entrada")),
        "pro_soluto_total": _money(
            _valor_prefixado(linha, prefixo, "negociacao_pro_soluto_total") or resumo_snapshot.get("pro_soluto_total")
        ),
        "sobrepreco": _money(
            _valor_prefixado(linha, prefixo, "negociacao_sobrepreco") or resumo_snapshot.get("sobrepreco")
        ),
        "desconto_imovel": _money(resumo_snapshot.get("desconto_imovel")),
        "incentivo_7lm": _money(resumo_snapshot.get("incentivo_7lm") or resumo_snapshot.get("desconto_imovel")),
        "valor_total_pago_cliente": _money(resumo_snapshot.get("valor_total_pago_cliente")),
        "valor_total_pago_cliente_exclui_incentivo": _money(
            resumo_snapshot.get("valor_total_pago_cliente_exclui_incentivo")
            or resumo_snapshot.get("valor_total_pago_cliente")
        ),
        "valor_total_coberto_cliente_incentivo": _money(
            resumo_snapshot.get("valor_total_coberto_cliente_incentivo")
            or resumo_snapshot.get("valor_total_pago_cliente_com_incentivo")
        ),
        "percentual_comprometimento": _percent(
            _decimal(
                _valor_prefixado(linha, prefixo, "negociacao_percentual_comprometimento")
                or resumo_snapshot.get("percentual_comprometimento")
            )
        ),
        "parcela_cliente_maxima": _money(resumo_snapshot.get("parcela_cliente_maxima")),
        "parcela_cliente_informada": _money(resumo_snapshot.get("parcela_cliente_informada")),
        "percentual_fechamento_inicial": _percent(
            _decimal(
                _valor_prefixado(linha, prefixo, "negociacao_percentual_fechamento_inicial")
                or resumo_snapshot.get("percentual_fechamento_inicial")
            )
        ),
        "percentual_projetado_entrega": _percent(
            _decimal(
                _valor_prefixado(linha, prefixo, "negociacao_percentual_projetado_entrega")
                or resumo_snapshot.get("percentual_projetado_entrega")
            )
        ),
        "saldo_pos_entrega": _money(
            _valor_prefixado(linha, prefixo, "negociacao_saldo_pos_entrega") or resumo_snapshot.get("saldo_pos_entrega")
        ),
        "meses_pre_entrega": int(
            _valor_prefixado(linha, prefixo, "negociacao_meses_pre_entrega") or resumo_snapshot.get("meses_pre_entrega") or 0
        ),
        "meses_pos_entrega": int(
            _valor_prefixado(linha, prefixo, "negociacao_meses_pos_entrega") or resumo_snapshot.get("meses_pos_entrega") or 0
        ),
        "status_comercial": _limpar_texto(resumo_snapshot.get("status_comercial")),
        "status_simulacao": _limpar_texto(
            _valor_prefixado(linha, prefixo, "negociacao_status_simulacao") or resumo_snapshot.get("status_simulacao")
        ),
        "payload_snapshot": payload_snapshot,
        "data_hora_criacao": _valor_prefixado(linha, prefixo, "negociacao_data_hora_criacao"),
        "data_hora_atualizado_em": _valor_prefixado(linha, prefixo, "negociacao_data_hora_atualizado_em"),
    }

    cliente = {
        "id": str(_valor_prefixado(linha, prefixo, "identificador_cliente") or "") or None,
        "nome_completo": cliente_nome or None,
        "cpf": cliente_cpf or None,
        "cidade": cliente_cidade or None,
        "email": cliente_email or None,
        "telefone": cliente_telefone or None,
    }

    imovel = {
        "id": str(_valor_prefixado(linha, prefixo, "identificador_imovel") or "") or None,
        "titulo": imovel_titulo or None,
        "status": imovel_status or None,
        "valor": _money(_valor_prefixado(linha, prefixo, "imovel_valor")),
        "cidade": imovel_cidade or None,
        "bairro": imovel_bairro or None,
        "estado": imovel_estado or None,
        "endereço": imovel_endereco or None,
        "tipo_imovel": imovel_tipo or None,
        "foto_principal": imovel_foto or None,
    }

    return {
        "id": str(_valor_prefixado(linha, prefixo, "identificador_reserva") or ""),
        "imovel_id": str(_valor_prefixado(linha, prefixo, "identificador_imovel") or ""),
        "cliente_id": str(_valor_prefixado(linha, prefixo, "identificador_cliente") or "") or None,
        "simulacao_id": str(_valor_prefixado(linha, prefixo, "identificador_simulacao") or "") or None,
        "status": _valor_prefixado(linha, prefixo, "status"),
        "reservado_por": reservado_por,
        "reservado_por_nome": reservado_por_nome or None,
        "reservado_por_email": reservado_por_email or None,
        "reservado_por_usuario": reservado_por_usuario if any(reservado_por_usuario.values()) else None,
        "reservado_em": _valor_prefixado(linha, prefixo, "reservado_em"),
        "expiracao_em": _valor_prefixado(linha, prefixo, "expiracao_em"),
        "observacoes": _valor_prefixado(linha, prefixo, "observacoes"),
        "data_hora_criacao": _valor_prefixado(linha, prefixo, "data_hora_criacao"),
        "data_hora_atualizado_em": _valor_prefixado(linha, prefixo, "data_hora_atualizado_em"),
        "cliente": cliente if any(cliente.values()) else None,
        "imovel": imovel if any(
            valor not in (None, "", DECIMAL_ZERO)
            for valor in imovel.values()
        ) else None,
        "negociacao": negociacao,
    }


def serializar_aprovacao_excecao(registro: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(registro or {})
    payload_snapshot = _json_dict(linha.get("payload_snapshot"))

    solicitante = {
        "id": str(linha.get("solicitado_por") or "") or None,
        "nome_completo": _limpar_texto(linha.get("solicitado_por_nome")) or None,
        "email": _limpar_texto(linha.get("solicitado_por_email")) or None,
    }
    avaliador = {
        "id": str(linha.get("avaliado_por") or "") or None,
        "nome_completo": _limpar_texto(linha.get("avaliado_por_nome")) or None,
        "email": _limpar_texto(linha.get("avaliado_por_email")) or None,
    }

    cliente = {
        "id": str(linha.get("identificador_cliente") or "") or None,
        "nome_completo": _limpar_texto(linha.get("cliente_nome")) or None,
        "cpf": _limpar_texto(linha.get("cliente_cpf")) or None,
        "cidade": _limpar_texto(linha.get("cliente_cidade")) or None,
        "email": _limpar_texto(linha.get("cliente_email")) or None,
        "telefone": _limpar_texto(linha.get("cliente_telefone") or linha.get("cliente_celular")) or None,
    }

    imovel = {
        "id": str(linha.get("identificador_imovel") or "") or None,
        "titulo": _limpar_texto(linha.get("imovel_titulo")) or None,
        "status": _limpar_texto(linha.get("imovel_status")) or None,
        "valor": _money(linha.get("imovel_valor")),
        "cidade": _limpar_texto(linha.get("imovel_cidade")) or None,
        "bairro": _limpar_texto(linha.get("imovel_bairro")) or None,
        "estado": _limpar_texto(linha.get("imovel_estado")) or None,
        "endereço": _limpar_texto(linha.get("imovel_endereco")) or None,
    }

    simulacao = {
        "id": str(linha.get("identificador_simulacao") or "") or None,
        "status_simulacao": _limpar_texto(linha.get("simulacao_status_simulacao")) or None,
        "valor_total_operacao": _money(linha.get("simulacao_valor_total_operacao")),
        "percentual_comprometimento": _percent(_decimal(linha.get("simulacao_percentual_comprometimento"))),
    }

    return {
        "id": str(linha.get("identificador_aprovacao") or ""),
        "imovel_id": str(linha.get("identificador_imovel") or "") or None,
        "cliente_id": str(linha.get("identificador_cliente") or "") or None,
        "simulacao_id": str(linha.get("identificador_simulacao") or "") or None,
        "reserva_id": str(linha.get("identificador_reserva") or "") or None,
        "status": _limpar_texto(linha.get("status")),
        "motivo": _limpar_texto(linha.get("motivo")) or None,
        "observacoes_solicitacao": _limpar_texto(linha.get("observacoes_solicitacao")) or None,
        "solicitado_em": linha.get("solicitado_em"),
        "avaliado_em": linha.get("avaliado_em"),
        "observacoes_avaliacao": _limpar_texto(linha.get("observacoes_avaliacao")) or None,
        "payload_snapshot": payload_snapshot,
        "valor_garantido_planejado": _money(linha.get("valor_garantido_planejado")),
        "valor_garantido_real": _money(linha.get("valor_garantido_real")),
        "valor_garantido_pre_obra_planejado": _money(linha.get("valor_garantido_pre_obra_planejado")),
        "valor_garantido_pre_obra_real": _money(linha.get("valor_garantido_pre_obra_real")),
        "gap_garantia": _money(linha.get("gap_garantia")),
        "gap_pre_obra": _money(linha.get("gap_pre_obra")),
        "percentual_gap_garantia": _percent(_decimal(linha.get("percentual_gap_garantia"))),
        "percentual_gap_pre_obra": _percent(_decimal(linha.get("percentual_gap_pre_obra"))),
        "reserva_status": _limpar_texto(linha.get("reserva_status")) or None,
        "cliente": cliente if any(valor not in (None, "", DECIMAL_ZERO) for valor in cliente.values()) else None,
        "imovel": imovel if any(valor not in (None, "", DECIMAL_ZERO) for valor in imovel.values()) else None,
        "simulacao": simulacao,
        "solicitante": solicitante if any(solicitante.values()) else None,
        "avaliador": avaliador if any(avaliador.values()) else None,
    }
