"""
Servicos da composição familiar vinculada ao cliente principal.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from utilitarios.documentos import cpf_valido, normalizar_cep, normalizar_cpf


def _texto_limpo(valor: Any) -> str | None:
    texto = str(valor or "").strip()
    return texto or None


def _valor_chave(payload: dict[str, Any], *chaves: str) -> Any:
    for chave in chaves:
        if chave in payload:
            return payload.get(chave)
    return None


def _numero_int(valor: Any) -> int | None:
    if valor in (None, ""):
        return None
    try:
        return int(valor)
    except Exception:
        return None


def _bool_valor(valor: Any, padrao: bool = False) -> bool:
    if valor in (True, False):
        return bool(valor)
    if valor in (None, ""):
        return padrao
    texto = str(valor).strip().lower()
    if texto in ("true", "1", "sim", "yes", "y"):
        return True
    if texto in ("false", "0", "não", "não", "no", "n"):
        return False
    return padrao


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


def _normalizar_cpf_membro(cpf: Any) -> tuple[str, str]:
    cpf_normalizado = normalizar_cpf(cpf)
    if not cpf_normalizado or len(cpf_normalizado) != 11:
        raise ValueError("CPF obrigaterio com 11 digitos para composição familiar.")
    if not cpf_valido(cpf_normalizado):
        raise ValueError("CPF inválido. Confira os digitos informados.")
    return cpf_normalizado, cpf_normalizado


def normalizar_payload_membro(
    payload: dict[str, Any],
    *,
    endereco_cliente_principal: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cpf, cpf_normalizado = _normalizar_cpf_membro(payload.get("cpf"))

    usar_endereco_cliente = _bool_valor(payload.get("usar_endereco_cliente_principal"), False)
    cep = normalizar_cep(payload.get("cep"))
    logradouro = _texto_limpo(payload.get("logradouro"))
    numero = _texto_limpo(payload.get("numero"))
    complemento = _texto_limpo(payload.get("complemento"))
    bairro = _texto_limpo(payload.get("bairro"))
    cidade = _texto_limpo(payload.get("cidade"))
    estado = _texto_limpo(payload.get("estado"))

    if usar_endereco_cliente and endereco_cliente_principal:
        cep = normalizar_cep(endereco_cliente_principal.get("cep"))
        logradouro = _texto_limpo(endereco_cliente_principal.get("logradouro"))
        numero = _texto_limpo(endereco_cliente_principal.get("numero"))
        complemento = _texto_limpo(endereco_cliente_principal.get("complemento"))
        bairro = _texto_limpo(endereco_cliente_principal.get("bairro"))
        cidade = _texto_limpo(endereco_cliente_principal.get("cidade"))
        estado = _texto_limpo(endereco_cliente_principal.get("estado"))

    renda_mensal = _decimal_valor(payload.get("renda_mensal"))
    outras_rendas = _decimal_valor(payload.get("outras_rendas"))
    renda_total = _decimal_valor(payload.get("renda_total"))
    if renda_total is None and (renda_mensal is not None or outras_rendas is not None):
        renda_total = (renda_mensal or Decimal("0")) + (outras_rendas or Decimal("0"))

    renda_formal = _decimal_valor(payload.get("renda_formal"))
    renda_informal = _decimal_valor(payload.get("renda_informal"))

    return {
        "nome_completo": _texto_limpo(payload.get("nome_completo")) or "",
        "cpf": cpf,
        "cpf_normalizado": cpf_normalizado,
        "rg": _texto_limpo(payload.get("rg")),
        "data_nascimento": payload.get("data_nascimento"),
        "sexo": _texto_limpo(payload.get("sexo")),
        "estado_civil": _texto_limpo(payload.get("estado_civil")),
        "regime_casamento": _texto_limpo(payload.get("regime_casamento")),
        "nacionalidade": _texto_limpo(payload.get("nacionalidade")),
        "nome_mae": _texto_limpo(payload.get("nome_mae")),
        "nome_pai": _texto_limpo(payload.get("nome_pai")),
        "parentesco": _texto_limpo(payload.get("parentesco")) or "",
        "telefone": _texto_limpo(payload.get("telefone")),
        "celular": _texto_limpo(payload.get("celular")),
        "email": _texto_limpo(payload.get("email")),
        "cep": cep,
        "logradouro": logradouro,
        "numero": numero,
        "complemento": complemento,
        "bairro": bairro,
        "cidade": cidade,
        "estado": estado,
        "mora_com_cliente_principal": _bool_valor(payload.get("mora_com_cliente_principal"), False),
        "usar_endereco_cliente_principal": usar_endereco_cliente,
        "renda_mensal": renda_mensal,
        "outras_rendas": outras_rendas,
        "renda_total": renda_total,
        "renda_formal": renda_formal,
        "renda_informal": renda_informal,
        "despesas_fixas": _decimal_valor(payload.get("despesas_fixas")),
        "despesas_variaveis": _decimal_valor(payload.get("despesas_variaveis")),
        "financiamentos": _texto_limpo(payload.get("financiamentos")),
        "profissao": _texto_limpo(payload.get("profissao")),
        "ocupacao": _texto_limpo(payload.get("ocupacao")),
        "empresa_atual": _texto_limpo(payload.get("empresa_atual")),
        "cargo": _texto_limpo(payload.get("cargo")),
        "tempo_emprego_anos": _numero_int(payload.get("tempo_emprego_anos")),
        "tipo_contrato": _texto_limpo(payload.get("tipo_contrato")),
        "escolaridade": _texto_limpo(payload.get("escolaridade")),
        "situacao_moradia": _texto_limpo(payload.get("situacao_moradia")),
        "compoe_renda": _bool_valor(payload.get("compoe_renda"), True),
        "incluir_na_analise": _bool_valor(payload.get("incluir_na_analise"), True),
        "incluir_na_composicao_financeira": _bool_valor(payload.get("incluir_na_composicao_financeira"), True),
        "incluir_na_confissao_divida": _bool_valor(payload.get("incluir_na_confissao_divida"), False),
        "responsavel_documentacao": _bool_valor(payload.get("responsavel_documentacao"), False),
        "principal_comprador": _bool_valor(payload.get("principal_comprador"), False),
        "documentacao_pendente": _texto_limpo(payload.get("documentacao_pendente")),
        "status_documental": _texto_limpo(payload.get("status_documental")),
        "observacoes": _texto_limpo(_valor_chave(payload, "observacoes", "observações")),
        "ativo": _bool_valor(payload.get("ativo"), True),
    }


def serializar_membro(registro: dict[str, Any] | Any) -> dict[str, Any]:
    linha = dict(registro or {})
    return {
        "id": str(linha.get("identificador_membro") or ""),
        "cliente_principal_id": str(linha.get("identificador_cliente_principal") or ""),
        "nome_completo": linha.get("nome_completo"),
        "cpf": linha.get("cpf"),
        "cpf_normalizado": linha.get("cpf_normalizado"),
        "rg": linha.get("rg"),
        "data_nascimento": linha.get("data_nascimento"),
        "sexo": linha.get("sexo"),
        "estado_civil": linha.get("estado_civil"),
        "regime_casamento": linha.get("regime_casamento"),
        "nacionalidade": linha.get("nacionalidade"),
        "nome_mae": linha.get("nome_mae"),
        "nome_pai": linha.get("nome_pai"),
        "parentesco": linha.get("parentesco"),
        "telefone": linha.get("telefone"),
        "celular": linha.get("celular"),
        "email": linha.get("email"),
        "cep": linha.get("cep"),
        "logradouro": linha.get("logradouro"),
        "numero": linha.get("numero"),
        "complemento": linha.get("complemento"),
        "bairro": linha.get("bairro"),
        "cidade": linha.get("cidade"),
        "estado": linha.get("estado"),
        "mora_com_cliente_principal": bool(linha.get("mora_com_cliente_principal")),
        "usar_endereco_cliente_principal": bool(linha.get("usar_endereco_cliente_principal")),
        "renda_mensal": linha.get("renda_mensal"),
        "outras_rendas": linha.get("outras_rendas"),
        "renda_total": linha.get("renda_total"),
        "renda_formal": linha.get("renda_formal"),
        "renda_informal": linha.get("renda_informal"),
        "despesas_fixas": linha.get("despesas_fixas"),
        "despesas_variaveis": linha.get("despesas_variaveis"),
        "financiamentos": linha.get("financiamentos"),
        "profissao": linha.get("profissao"),
        "ocupacao": linha.get("ocupacao"),
        "empresa_atual": linha.get("empresa_atual"),
        "cargo": linha.get("cargo"),
        "tempo_emprego_anos": linha.get("tempo_emprego_anos"),
        "tipo_contrato": linha.get("tipo_contrato"),
        "escolaridade": linha.get("escolaridade"),
        "situacao_moradia": linha.get("situacao_moradia"),
        "compoe_renda": bool(linha.get("compoe_renda")),
        "incluir_na_analise": bool(linha.get("incluir_na_analise")),
        "incluir_na_composicao_financeira": bool(linha.get("incluir_na_composicao_financeira")),
        "incluir_na_confissao_divida": bool(linha.get("incluir_na_confissao_divida")),
        "responsavel_documentacao": bool(linha.get("responsavel_documentacao")),
        "principal_comprador": bool(linha.get("principal_comprador")),
        "documentacao_pendente": linha.get("documentacao_pendente"),
        "status_documental": linha.get("status_documental"),
        "observacoes": _valor_chave(linha, "observacoes", "observações"),
        "ativo": bool(linha.get("ativo", True)),
        "data_hora_desativacao": linha.get("data_hora_desativacao"),
        "data_hora_criacao": linha.get("data_hora_criacao"),
        "data_hora_atualizado_em": linha.get("data_hora_atualizado_em"),
    }
