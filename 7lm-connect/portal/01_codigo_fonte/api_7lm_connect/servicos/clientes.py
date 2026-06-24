"""
Servicos do modulo de clientes (comercial).
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from repositorios.clientes import (
    atualizar_cliente as atualizar_cliente_repo,
    atualizar_renda_total as atualizar_renda_total_repo,
    criar_cliente as criar_cliente_repo,
    excluir_midias_cliente_por_tipo,
    inserir_midia_cliente as inserir_midia_cliente_repo,
)
from utilitarios.documentos import cpf_valido, normalizar_cep, normalizar_cpf
from validacoes.clientes import classificar_arquivo_cliente, normalizar_nome_arquivo_cliente


DECIMAL_ZERO = Decimal("0")

PARAMETROS_SIMULACAO_DECIMAIS_OBRIGATORIOS = (
    ("financiamento_caixa", "Informe o valor aprovado / financiamento do cliente.", False),
    ("parcela_financiamento_banco", "Informe a parcela banco cheia do cliente.", True),
    ("fgts", "Informe o FGTS do cliente.", True),
)

PARAMETROS_SIMULACAO_INTEIROS_OBRIGATORIOS: tuple[tuple[str, str], ...] = ()


def _texto_limpo(valor: Any) -> str | None:
    texto = str(valor or "").strip()
    return texto or None


def _valor_chave(payload: dict[str, Any], *chaves: str) -> Any:
    for chave in chaves:
        if chave in payload:
            return payload.get(chave)
    return None


def _numero_int(valor: Any) -> int | None:
    if valor is None or valor == "":
        return None
    try:
        return int(valor)
    except Exception:
        return None


def _bool_valor(valor: Any) -> bool | None:
    if valor in (True, False):
        return bool(valor)
    if valor is None or valor == "":
        return None
    texto = str(valor).strip().lower()
    if texto in ("sim", "true", "1", "yes", "y"):
        return True
    if texto in ("não", "não", "false", "0", "no", "n"):
        return False
    return None


def _bool_padrao_true(valor: Any) -> bool:
    if valor in (None, ""):
        return True
    if valor in (True, False):
        return bool(valor)
    texto = str(valor).strip().lower()
    if texto in ("false", "0", "não", "no", "n"):
        return False
    if texto in ("true", "1", "sim", "yes", "y"):
        return True
    return bool(valor)


def _decimal_valor(valor: Any) -> Decimal | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, Decimal):
        return valor
    try:
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
        return Decimal(texto)
    except Exception:
        return None


def _decimal_json(valor: Any) -> str | None:
    decimal = _decimal_valor(valor)
    if decimal is None:
        return None
    return str(decimal)


def _decimal_para_float(valor: Any) -> float | None:
    decimal = _decimal_valor(valor)
    return float(decimal) if decimal is not None else None


def _normalizar_caminho_publico(valor: Any) -> str | None:
    texto = str(valor or "").strip().replace("\\", "/")
    if not texto:
        return None
    return "/" + texto.lstrip("/")


def _normalizar_parametros_simulacao(payload: dict[str, Any]) -> dict[str, Any]:
    bruto = payload.get("parametros_simulacao")
    if not isinstance(bruto, dict):
        return {}

    parametros: dict[str, Any] = {}

    for campo in (
        "financiamento_caixa",
        "parcela_financiamento_banco",
        "fgts",
        "subsidio",
        "cheque_moradia",
        "parcela_intermediaria_valor",
        "parcela_anual_valor",
        "parcela_semestral_valor",
        "parcela_reforco_valor",
    ):
        valor = _decimal_json(bruto.get(campo))
        if valor is not None:
            parametros[campo] = valor

    limites_int = {
        "meses_pre_entrega": (1, 240),
        "meses_pos_entrega": (0, 80),
        "parcelas_intermediarias_quantidade": (0, 24),
        "parcelas_anuais_quantidade": (0, 24),
        "parcelas_semestrais_quantidade": (0, 24),
        "parcelas_reforco_quantidade": (0, 24),
    }
    for campo, (minimo, maximo) in limites_int.items():
        valor = _numero_int(bruto.get(campo))
        if valor is None:
            continue
        parametros[campo] = max(minimo, min(maximo, valor))

    observacoes = _texto_limpo(bruto.get("observacoes_comerciais"))
    if observacoes:
        parametros["observacoes_comerciais"] = observacoes[:4000]

    return parametros


def _json_parametros_simulacao(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if not valor:
        return {}
    try:
        decodificado = json.loads(valor)
    except Exception:
        return {}
    return decodificado if isinstance(decodificado, dict) else {}


def _normalizar_cpf_cliente(valor: Any) -> tuple[str | None, str | None]:
    cpf_normalizado = normalizar_cpf(valor)
    if not cpf_normalizado:
        return None, None
    if len(cpf_normalizado) != 11 or not cpf_valido(cpf_normalizado):
        raise ValueError("CPF inválido. Confira os digitos informados.")
    return cpf_normalizado, cpf_normalizado


def _validar_campos_obrigatorios_cliente(dados: dict[str, Any]) -> None:
    nome = _texto_limpo(dados.get("nome_completo")) or ""
    if len(nome) < 3:
        raise ValueError("Informe o nome completo do cliente.")

    if not dados.get("cpf"):
        raise ValueError("Informe o CPF do cliente.")

    renda_principal = _decimal_valor(dados.get("renda_principal"))
    if renda_principal is None or renda_principal <= DECIMAL_ZERO:
        raise ValueError("Informe a renda principal do cliente.")

    parametros = _json_parametros_simulacao(dados.get("parametros_simulacao"))
    for campo, mensagem, permitir_zero in PARAMETROS_SIMULACAO_DECIMAIS_OBRIGATORIOS:
        valor = _decimal_valor(parametros.get(campo))
        if valor is None or valor < DECIMAL_ZERO or (not permitir_zero and valor <= DECIMAL_ZERO):
            raise ValueError(mensagem)

    for campo, mensagem in PARAMETROS_SIMULACAO_INTEIROS_OBRIGATORIOS:
        valor = _numero_int(parametros.get(campo))
        if valor is None or valor < 0:
            raise ValueError(mensagem)


def normalizar_payload_cliente(payload: dict[str, Any]) -> dict[str, Any]:
    cpf, cpf_normalizado = _normalizar_cpf_cliente(payload.get("cpf"))
    dados = {
        "nome_completo": _texto_limpo(payload.get("nome_completo")) or "",
        "data_nascimento": payload.get("data_nascimento"),
        "sexo": _texto_limpo(payload.get("sexo")),
        "cpf": cpf,
        "cpf_normalizado": cpf_normalizado,
        "rg": _texto_limpo(payload.get("rg")),
        "estado_civil": _texto_limpo(payload.get("estado_civil")),
        "regime_casamento": _texto_limpo(payload.get("regime_casamento")),
        "nacionalidade": _texto_limpo(payload.get("nacionalidade")),
        "nome_mae": _texto_limpo(payload.get("nome_mae")),
        "nome_pai": _texto_limpo(payload.get("nome_pai")),
        "email": _texto_limpo(payload.get("email")),
        "telefone": _texto_limpo(payload.get("telefone")),
        "celular": _texto_limpo(payload.get("celular")),
        "cep": normalizar_cep(payload.get("cep")),
        "logradouro": _texto_limpo(payload.get("logradouro")),
        "numero": _texto_limpo(payload.get("numero")),
        "complemento": _texto_limpo(payload.get("complemento")),
        "bairro": _texto_limpo(payload.get("bairro")),
        "cidade": _texto_limpo(payload.get("cidade")),
        "estado": _texto_limpo(payload.get("estado")),
        "tempo_residencia_anos": _numero_int(payload.get("tempo_residencia_anos")),
        "renda_principal": payload.get("renda_principal"),
        "renda_conjuge": payload.get("renda_conjuge"),
        "outras_rendas": payload.get("outras_rendas"),
        "renda_total": payload.get("renda_total"),
        "moradores": _numero_int(payload.get("moradores")),
        "dependentes": _numero_int(payload.get("dependentes")),
        "filhos": _numero_int(payload.get("filhos")),
        "profissao": _texto_limpo(payload.get("profissao")),
        "empresa": _texto_limpo(payload.get("empresa")),
        "cargo": _texto_limpo(payload.get("cargo")),
        "tempo_emprego_anos": _numero_int(payload.get("tempo_emprego_anos")),
        "tipo_contrato": _texto_limpo(payload.get("tipo_contrato")),
        "escolaridade": _texto_limpo(payload.get("escolaridade")),
        "situacao_moradia": _texto_limpo(payload.get("situacao_moradia")),
        "imovel_proprio": _bool_valor(_valor_chave(payload, "imovel_proprio", "imovel_próprio")),
        "veiculo": _bool_valor(_valor_chave(payload, "veiculo", "veículo")),
        "financiamentos": _texto_limpo(payload.get("financiamentos")),
        "renda_formal": payload.get("renda_formal"),
        "renda_informal": payload.get("renda_informal"),
        "cartao_credito": payload.get("cartao_credito"),
        "aluguel_financiamento": payload.get("aluguel_financiamento"),
        "despesas_fixas": payload.get("despesas_fixas"),
        "despesas_variaveis": payload.get("despesas_variaveis"),
        "documentacao_pendente": _texto_limpo(payload.get("documentacao_pendente")),
        "status_documental": _texto_limpo(payload.get("status_documental")),
        "observacoes": _texto_limpo(_valor_chave(payload, "observacoes", "observações")),
        "parametros_simulacao": _normalizar_parametros_simulacao(payload),
    }
    _validar_campos_obrigatorios_cliente(dados)
    return dados


def calcular_renda_total_cliente(
    payload: dict[str, Any],
    membros_composicao: list[dict[str, Any] | Any] | None = None,
) -> Decimal | None:
    renda_principal = _decimal_valor(payload.get("renda_principal"))
    renda_conjuge = _decimal_valor(payload.get("renda_conjuge"))
    outras_rendas = _decimal_valor(payload.get("outras_rendas"))

    total = DECIMAL_ZERO
    possui_valores = False

    for valor in (renda_principal, renda_conjuge, outras_rendas):
        if valor is None:
            continue
        total += valor
        possui_valores = True

    for membro in membros_composicao or []:
        linha = dict(membro or {})
        if not _bool_padrao_true(linha.get("ativo")):
            continue
        if not _bool_padrao_true(linha.get("compoe_renda")):
            continue
        if not _bool_padrao_true(linha.get("incluir_na_analise")):
            continue
        if not _bool_padrao_true(linha.get("incluir_na_composicao_financeira")):
            continue

        renda_membro = _decimal_valor(linha.get("renda_total"))
        if renda_membro is None:
            renda_mensal = _decimal_valor(linha.get("renda_mensal")) or DECIMAL_ZERO
            outras_rendas_membro = _decimal_valor(linha.get("outras_rendas")) or DECIMAL_ZERO
            if renda_mensal != DECIMAL_ZERO or outras_rendas_membro != DECIMAL_ZERO:
                renda_membro = renda_mensal + outras_rendas_membro

        if renda_membro is None:
            continue

        total += renda_membro
        possui_valores = True

    return total if possui_valores else None


def serializar_midia_cliente(linha: dict[str, Any] | Any) -> dict[str, Any]:
    registro = dict(linha or {})
    return {
        "id": str(registro.get("identificador_midia")),
        "cliente_id": str(registro.get("identificador_cliente")),
        "tipo_arquivo": registro.get("tipo_arquivo"),
        "nome_arquivo": registro.get("nome_arquivo"),
        "caminho_arquivo": _normalizar_caminho_publico(registro.get("caminho_arquivo")),
        "mime_type": registro.get("mime_type"),
        "tamanho_bytes": int(registro.get("tamanho_bytes") or 0),
        "data_hora_criacao": registro.get("data_hora_criacao"),
    }


def _montar_midias_cliente(
    midias_serializadas: list[dict[str, Any]],
    foto_principal_registro: Any,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], str | None, str | None]:
    lista = [dict(midia) for midia in (midias_serializadas or [])]
    foto_principal = _normalizar_caminho_publico(foto_principal_registro)
    foto_principal_id: str | None = None

    for item in lista:
        item["caminho_arquivo"] = _normalizar_caminho_publico(item.get("caminho_arquivo"))

    fotos = [item for item in lista if str(item.get("tipo_arquivo") or "").lower() == "foto"]
    documentos = [item for item in lista if str(item.get("tipo_arquivo") or "").lower() == "documento"]

    if foto_principal:
        for item in fotos:
            if item.get("caminho_arquivo") == foto_principal:
                foto_principal_id = str(item.get("id") or "")
                break

    if not foto_principal and fotos:
        foto_principal = fotos[0].get("caminho_arquivo")
        foto_principal_id = str(fotos[0].get("id") or "")

    return lista, fotos, documentos, foto_principal, foto_principal_id or None


def serializar_cliente(
    registro: dict[str, Any] | Any,
    *,
    midias: Iterable[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not registro:
        return {}
    linha = dict(registro)
    midias_serializadas = [serializar_midia_cliente(midia) for midia in (midias or [])]
    _, fotos, documentos, foto_principal, foto_principal_id = _montar_midias_cliente(
        midias_serializadas,
        linha.get("foto_principal"),
    )
    foto_principal_nome = _texto_limpo(linha.get("foto_principal_nome"))
    if not foto_principal_nome and fotos:
        foto_principal_nome = _texto_limpo(fotos[0].get("nome_arquivo"))

    return {
        "id": str(linha.get("identificador_cliente")),
        "nome_completo": linha.get("nome_completo"),
        "data_nascimento": linha.get("data_nascimento"),
        "sexo": linha.get("sexo"),
        "cpf": linha.get("cpf"),
        "cpf_normalizado": linha.get("cpf_normalizado"),
        "rg": linha.get("rg"),
        "estado_civil": linha.get("estado_civil"),
        "regime_casamento": linha.get("regime_casamento"),
        "nacionalidade": linha.get("nacionalidade"),
        "nome_mae": linha.get("nome_mae"),
        "nome_pai": linha.get("nome_pai"),
        "email": linha.get("email"),
        "telefone": linha.get("telefone"),
        "celular": linha.get("celular"),
        "cep": linha.get("cep"),
        "logradouro": linha.get("logradouro"),
        "numero": linha.get("numero"),
        "complemento": linha.get("complemento"),
        "bairro": linha.get("bairro"),
        "cidade": linha.get("cidade"),
        "estado": linha.get("estado"),
        "tempo_residencia_anos": linha.get("tempo_residencia_anos"),
        "renda_principal": linha.get("renda_principal"),
        "renda_conjuge": linha.get("renda_conjuge"),
        "outras_rendas": linha.get("outras_rendas"),
        "renda_total": linha.get("renda_total"),
        "moradores": linha.get("moradores"),
        "dependentes": linha.get("dependentes"),
        "filhos": linha.get("filhos"),
        "profissao": linha.get("profissao"),
        "empresa": linha.get("empresa"),
        "cargo": linha.get("cargo"),
        "tempo_emprego_anos": linha.get("tempo_emprego_anos"),
        "tipo_contrato": linha.get("tipo_contrato"),
        "escolaridade": linha.get("escolaridade"),
        "situacao_moradia": linha.get("situacao_moradia"),
        "imovel_proprio": _valor_chave(linha, "imovel_proprio", "imovel_próprio"),
        "veiculo": _valor_chave(linha, "veiculo", "veículo"),
        "financiamentos": linha.get("financiamentos"),
        "renda_formal": linha.get("renda_formal"),
        "renda_informal": linha.get("renda_informal"),
        "cartao_credito": linha.get("cartao_credito"),
        "aluguel_financiamento": linha.get("aluguel_financiamento"),
        "despesas_fixas": linha.get("despesas_fixas"),
        "despesas_variaveis": linha.get("despesas_variaveis"),
        "documentacao_pendente": linha.get("documentacao_pendente"),
        "status_documental": linha.get("status_documental"),
        "observacoes": _valor_chave(linha, "observacoes", "observações"),
        "parametros_simulacao": _json_parametros_simulacao(linha.get("parametros_simulacao")),
        "identificador_usuario_cadastro": linha.get("identificador_usuario_cadastro"),
        "usuario_cadastro_nome": linha.get("usuario_cadastro_nome"),
        "usuario_cadastro_email": linha.get("usuario_cadastro_email"),
        "foto_principal": foto_principal,
        "foto_principal_id": foto_principal_id or _texto_limpo(linha.get("foto_principal_id")),
        "foto_principal_nome": foto_principal_nome,
        "quantidade_documentos": int(linha.get("quantidade_documentos") or len(documentos)),
        "documentos": documentos,
        "midias": midias_serializadas,
        "data_hora_criacao": linha.get("data_hora_criacao"),
        "data_hora_atualizado_em": linha.get("data_hora_atualizado_em"),
    }


async def criar_cliente(
    conexao,
    esquema: str,
    payload: dict[str, Any],
    *,
    membros_composicao: list[dict[str, Any] | Any] | None = None,
):
    dados = normalizar_payload_cliente(payload)
    dados["identificador_usuario_cadastro"] = payload.get("identificador_usuario_cadastro")
    dados["usuario_cadastro_nome"] = payload.get("usuario_cadastro_nome")
    dados["usuario_cadastro_email"] = payload.get("usuario_cadastro_email")
    dados["renda_total"] = calcular_renda_total_cliente(dados, membros_composicao)
    return await criar_cliente_repo(conexao, esquema, dados)


async def atualizar_cliente(
    conexao,
    esquema: str,
    identificador_cliente: str,
    payload: dict[str, Any],
    *,
    membros_composicao: list[dict[str, Any] | Any] | None = None,
):
    dados = normalizar_payload_cliente(payload)
    dados["renda_total"] = calcular_renda_total_cliente(dados, membros_composicao)
    return await atualizar_cliente_repo(conexao, esquema, identificador_cliente, dados)


async def recalcular_renda_total_cliente(
    conexao,
    esquema: str,
    identificador_cliente: str,
    payload_cliente: dict[str, Any] | Any,
    membros_composicao: list[dict[str, Any] | Any] | None = None,
):
    renda_total = calcular_renda_total_cliente(dict(payload_cliente or {}), membros_composicao)
    return await atualizar_renda_total_repo(conexao, esquema, identificador_cliente, renda_total)


async def _gravar_upload_em_disco(
    arquivo: UploadFile,
    destino: Path,
    limite_bytes: int,
) -> int:
    total = 0
    destino.parent.mkdir(parents=True, exist_ok=True)

    with destino.open("wb") as ponteiro:
        while True:
            bloco = await arquivo.read(1024 * 1024)
            if not bloco:
                break
            total += len(bloco)
            if total > limite_bytes:
                ponteiro.close()
                destino.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"O arquivo {arquivo.filename or 'informado'} excede o limite permitido.",
                )
            ponteiro.write(bloco)

    if total <= 0:
        destino.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Não é possível enviar arquivos vazios.")

    return total


def _resolver_caminho_publico(base_publica: Path, caminho_publico: str) -> Path | None:
    relativo = str(caminho_publico or "").replace("\\", "/").lstrip("/")
    if not relativo:
        return None

    base_resolvida = base_publica.resolve()
    destino = (base_resolvida / relativo).resolve()

    if destino != base_resolvida and base_resolvida not in destino.parents:
        return None

    return destino


def remover_arquivo_publico(base_publica: Path, caminho_publico: str) -> None:
    destino = _resolver_caminho_publico(base_publica, caminho_publico)
    if not destino:
        return

    try:
        destino.unlink(missing_ok=True)
    except Exception:
        return

    diretorio = destino.parent
    while diretorio != base_publica.resolve():
        try:
            diretorio.rmdir()
        except OSError:
            break
        diretorio = diretorio.parent


def remover_arquivos_publicos(base_publica: Path, caminhos_publicos: Iterable[str]) -> None:
    for caminho_publico in caminhos_publicos:
        remover_arquivo_publico(base_publica, caminho_publico)


async def _salvar_arquivo_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    arquivo: UploadFile,
    tipo_arquivo: str,
    subdiretorio: str,
    diretorio_uploads: Path,
    url_base_uploads: str,
    limite_bytes: int,
):
    metadados = classificar_arquivo_cliente(
        arquivo.filename,
        arquivo.content_type,
        tipo_arquivo=tipo_arquivo,
    )
    nome_base = normalizar_nome_arquivo_cliente(Path(arquivo.filename or tipo_arquivo).stem)
    nome_final = f"{nome_base}-{uuid4().hex[:12]}{metadados['extensao']}"
    destino = Path(diretorio_uploads) / identificador_cliente / subdiretorio / nome_final
    tamanho_bytes = await _gravar_upload_em_disco(arquivo, destino, limite_bytes)
    url_base = str(url_base_uploads or "/uploads/clientes").rstrip("/")
    caminho_publico = f"{url_base}/{identificador_cliente}/{subdiretorio}/{nome_final}"
    registro = await inserir_midia_cliente_repo(
        conexao,
        esquema,
        identificador_cliente=identificador_cliente,
        tipo_arquivo=metadados["tipo_arquivo"],
        nome_arquivo=Path(arquivo.filename or nome_final).name,
        caminho_arquivo=caminho_publico,
        mime_type=metadados["mime_type"],
        tamanho_bytes=tamanho_bytes,
    )
    return registro, destino


async def substituir_foto_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    arquivo: UploadFile,
    diretorio_uploads: Path,
    url_base_uploads: str,
    limite_foto_bytes: int,
) -> dict[str, Any]:
    caminho_salvo: Path | None = None

    try:
        midias_removidas = await excluir_midias_cliente_por_tipo(
            conexao,
            esquema,
            identificador_cliente=identificador_cliente,
            tipo_arquivo="foto",
        )
        registro, caminho_salvo = await _salvar_arquivo_cliente(
            conexao,
            esquema,
            identificador_cliente=identificador_cliente,
            arquivo=arquivo,
            tipo_arquivo="foto",
            subdiretorio="foto",
            diretorio_uploads=diretorio_uploads,
            url_base_uploads=url_base_uploads,
            limite_bytes=limite_foto_bytes,
        )
        return {
            "foto": serializar_midia_cliente(registro),
            "midias_removidas": [serializar_midia_cliente(item) for item in midias_removidas],
        }
    except Exception:
        if caminho_salvo:
            try:
                caminho_salvo.unlink(missing_ok=True)
            except Exception:
                pass
        raise
    finally:
        try:
            await arquivo.close()
        except Exception:
            pass


async def salvar_documentos_cliente(
    conexao,
    esquema: str,
    *,
    identificador_cliente: str,
    arquivos: list[UploadFile],
    diretorio_uploads: Path,
    url_base_uploads: str,
    limite_documento_bytes: int,
) -> list[dict[str, Any]]:
    if not arquivos:
        raise HTTPException(status_code=400, detail="Nenhum documento foi enviado.")

    caminhos_salvos: list[Path] = []
    registros: list[dict[str, Any]] = []

    try:
        for arquivo in arquivos:
            registro, destino = await _salvar_arquivo_cliente(
                conexao,
                esquema,
                identificador_cliente=identificador_cliente,
                arquivo=arquivo,
                tipo_arquivo="documento",
                subdiretorio="documentos",
                diretorio_uploads=diretorio_uploads,
                url_base_uploads=url_base_uploads,
                limite_bytes=limite_documento_bytes,
            )
            caminhos_salvos.append(destino)
            registros.append(serializar_midia_cliente(registro))
    except Exception:
        for caminho in caminhos_salvos:
            try:
                caminho.unlink(missing_ok=True)
            except Exception:
                continue
        raise
    finally:
        for arquivo in arquivos:
            try:
                await arquivo.close()
            except Exception:
                continue

    return registros
