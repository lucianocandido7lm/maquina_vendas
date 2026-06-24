from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import re
import unicodedata
from typing import Any


SECTION_ORDER = {
    "civil": 10,
    "renda": 20,
    "dependentes": 30,
    "caixa": 40,
    "caixa_pessoais": 10,
    "caixa_conjuge": 20,
    "caixa_dependentes": 30,
    "caixa_formularios": 40,
    "creditu": 50,
    "agehab_pessoais": 60,
    "agehab_dependentes": 70,
    "agehab": 80,
}

SECTION_LABELS = {
    "civil": "Documentação civil",
    "renda": "Comprovação de renda",
    "dependentes": "Dependentes e composição familiar",
    "caixa": "Kit Caixa",
    "caixa_pessoais": "Documentos pessoais",
    "caixa_conjuge": "Documentos pessoais do cônjuge",
    "caixa_dependentes": "Documentos dos dependentes",
    "caixa_formularios": "Formulários e autorizações Caixa",
    "creditu": "Kit Creditú",
    "agehab_pessoais": "Documentos pessoais AGEHAB",
    "agehab_dependentes": "Dependentes AGEHAB",
    "agehab": "Kit AGEHAB",
}

SPOUSE_RELATIONS = {
    "conjuge",
    "companheiro",
    "companheira",
    "esposo",
    "esposa",
}

SOCIO_RELATIONS = {"socio", "socia"}

FIELD_FALSE_VALUES = {"", "0", "nao", "false", "none", "null"}

KINSHIP_DEGREES = {
    "pai": 1,
    "mae": 1,
    "filho": 1,
    "filha": 1,
    "enteado": 1,
    "enteada": 1,
    "irmao": 2,
    "irma": 2,
    "avo": 2,
    "avoh": 2,
    "avos": 2,
    "avohs": 2,
    "neta": 2,
    "neto": 2,
    "tio": 3,
    "tia": 3,
    "sobrinho": 3,
    "sobrinha": 3,
    "primo": 4,
    "prima": 4,
    "bisavo": 4,
    "bisavoh": 4,
    "bisavos": 4,
    "bisavohs": 4,
    "bisneto": 4,
    "bisneta": 4,
}


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _slug(value: Any) -> str:
    text = _normalize_text(value).replace(" ", "-")
    return text or "item"


def _to_decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    normalized = _normalize_text(value)
    if normalized in FIELD_FALSE_VALUES:
        return False
    return bool(normalized)


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    for candidate in (text, text.split("T", 1)[0], text.split(" ", 1)[0]):
        try:
            return date.fromisoformat(candidate)
        except ValueError:
            continue
    return None


def _age_from_date(value: Any) -> int | None:
    parsed = _parse_date(value)
    if not parsed:
        return None
    today = date.today()
    years = today.year - parsed.year - ((today.month, today.day) < (parsed.month, parsed.day))
    return max(years, 0)


def _detail_text(primary: Any, secondary: Any = "") -> str:
    for value in (primary, secondary):
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _extract_snapshot(processo: dict[str, Any]) -> dict[str, Any]:
    simulacao = processo.get("simulacao_detalhes") or {}
    if not isinstance(simulacao, dict):
        return {}
    snapshot = simulacao.get("payload_snapshot") or {}
    return snapshot if isinstance(snapshot, dict) else {}


def _extract_snapshot_cliente(processo: dict[str, Any]) -> dict[str, Any]:
    snapshot = _extract_snapshot(processo)
    cliente = (((snapshot.get("calculo") or {}).get("cliente") or {}).get("cliente")) or {}
    return cliente if isinstance(cliente, dict) else {}


def _extract_snapshot_complementos(processo: dict[str, Any]) -> list[dict[str, Any]]:
    snapshot = _extract_snapshot(processo)
    calculo = snapshot.get("calculo") or {}
    cliente = calculo.get("cliente") or {}
    complementos = cliente.get("complementos") or []
    if isinstance(complementos, list) and complementos:
        return [item for item in complementos if isinstance(item, dict)]
    aprovacao = snapshot.get("aprovacao_excecao") or {}
    composicao = aprovacao.get("composicao_familiar") or {}
    complementos = composicao.get("complementos") or []
    if isinstance(complementos, list):
        return [item for item in complementos if isinstance(item, dict)]
    return []


def _extract_resumo_operacao(processo: dict[str, Any]) -> dict[str, Any]:
    snapshot = _extract_snapshot(processo)
    resumo = snapshot.get("resumo_operacao") or {}
    return resumo if isinstance(resumo, dict) else {}


def _source_candidates(processo: dict[str, Any]) -> list[dict[str, Any]]:
    snapshot = _extract_snapshot(processo)
    calculo = snapshot.get("calculo") or {}
    cliente_cadastro = processo.get("cliente_cadastro") or {}
    return [
        processo,
        cliente_cadastro,
        cliente_cadastro.get("parametros_simulacao") or {},
        processo.get("reserva_comercial") or {},
        processo.get("imovel_detalhes") or {},
        processo.get("simulacao_fechada") or {},
        _extract_resumo_operacao(processo),
        snapshot.get("extra") or {},
        calculo.get("cliente") or {},
        calculo.get("imovel") or {},
    ]


def _flag_from_sources(processo: dict[str, Any], *keys: str) -> bool | None:
    for source in _source_candidates(processo):
        if not isinstance(source, dict):
            continue
        for key in keys:
            if key not in source:
                continue
            value = source.get(key)
            if value in (None, ""):
                continue
            return _to_bool(value)
    return None


def _decimal_from_sources(processo: dict[str, Any], *keys: str) -> Decimal:
    for source in _source_candidates(processo):
        if not isinstance(source, dict):
            continue
        for key in keys:
            if key not in source:
                continue
            value = source.get(key)
            if value in (None, ""):
                continue
            amount = _to_decimal(value)
            if amount > 0:
                return amount
    return Decimal("0")


def _person_from_cliente(processo: dict[str, Any]) -> dict[str, Any]:
    cadastro = processo.get("cliente_cadastro") or {}
    snapshot_cliente = _extract_snapshot_cliente(processo)
    return {
        "id": _detail_text(cadastro.get("identificador_cliente"), processo.get("cliente_id")),
        "nome": _detail_text(cadastro.get("nome_completo"), processo.get("cliente")),
        "cpf": _detail_text(cadastro.get("cpf"), processo.get("cliente_cpf")),
        "rg": cadastro.get("rg"),
        "estado_civil": _detail_text(cadastro.get("estado_civil"), snapshot_cliente.get("estado_civil")),
        "regime_casamento": cadastro.get("regime_casamento"),
        "data_nascimento": cadastro.get("data_nascimento"),
        "email": _detail_text(cadastro.get("email"), processo.get("cliente_email")),
        "telefone": _detail_text(cadastro.get("celular"), _detail_text(cadastro.get("telefone"), processo.get("cliente_telefone"))),
        "cidade": _detail_text(cadastro.get("cidade"), processo.get("cliente_cidade")),
        "estado": _detail_text(cadastro.get("estado"), processo.get("cliente_estado")),
        "renda_principal": _to_decimal(cadastro.get("renda_principal")),
        "renda_conjuge": _to_decimal(cadastro.get("renda_conjuge")),
        "renda_total": _to_decimal(cadastro.get("renda_total")),
        "renda_formal": _to_decimal(cadastro.get("renda_formal")),
        "renda_informal": _to_decimal(cadastro.get("renda_informal")),
        "outras_rendas": _to_decimal(cadastro.get("outras_rendas")),
        "tempo_emprego_anos": cadastro.get("tempo_emprego_anos"),
        "tipo_contrato": cadastro.get("tipo_contrato"),
        "empresa": cadastro.get("empresa"),
        "cargo": cadastro.get("cargo"),
        "profissao": cadastro.get("profissao"),
        "dependentes": cadastro.get("dependentes"),
        "filhos": cadastro.get("filhos"),
    }


def _raw_member_to_person(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _detail_text(item.get("identificador_membro"), item.get("id")),
        "nome": _detail_text(item.get("nome_completo"), item.get("nome")),
        "cpf": item.get("cpf"),
        "rg": item.get("rg"),
        "estado_civil": item.get("estado_civil"),
        "data_nascimento": item.get("data_nascimento"),
        "parentesco": item.get("parentesco"),
        "renda_total": _to_decimal(item.get("renda_total") or item.get("renda_mensal") or item.get("renda")),
        "renda_formal": _to_decimal(item.get("renda_formal")),
        "renda_informal": _to_decimal(item.get("renda_informal")),
        "tempo_emprego_anos": item.get("tempo_emprego_anos"),
        "tipo_contrato": item.get("tipo_contrato"),
        "empresa": item.get("empresa_atual") or item.get("empresa"),
        "cargo": item.get("cargo") or item.get("ocupacao"),
        "profissao": item.get("profissao"),
        "fgts": _to_decimal(item.get("fgts") or item.get("saldo_fgts") or item.get("valor_fgts")),
        "compoe_renda": bool(item.get("compoe_renda", True)),
        "incluir_na_analise": bool(item.get("incluir_na_analise", True)),
        "ativo": bool(item.get("ativo", True)),
    }


def _snapshot_member_to_person(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _detail_text(item.get("id"), item.get("identificador_membro")),
        "nome": _detail_text(item.get("nome"), item.get("nome_completo")),
        "cpf": item.get("cpf"),
        "rg": item.get("rg"),
        "estado_civil": item.get("estado_civil"),
        "data_nascimento": item.get("data_nascimento"),
        "parentesco": item.get("parentesco"),
        "renda_total": _to_decimal(item.get("renda")),
        "renda_formal": _to_decimal(item.get("renda_formal")),
        "renda_informal": _to_decimal(item.get("renda_informal")),
        "tempo_emprego_anos": item.get("tempo_emprego_anos"),
        "tipo_contrato": item.get("tipo_contrato"),
        "empresa": item.get("empresa"),
        "cargo": item.get("cargo"),
        "profissao": item.get("profissao"),
        "fgts": _to_decimal(item.get("fgts") or item.get("saldo_fgts") or item.get("valor_fgts")),
        "compoe_renda": bool(item.get("compoe_renda", True)),
        "incluir_na_analise": bool(item.get("incluir_na_analise", True)),
        "ativo": bool(item.get("ativo", True)),
    }


def _merge_people(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in extra.items():
        if value in (None, "", Decimal("0")):
            continue
        if key in {"compoe_renda", "incluir_na_analise", "ativo"}:
            merged[key] = bool(value)
            continue
        merged[key] = value
    return merged


def _extract_members(processo: dict[str, Any]) -> list[dict[str, Any]]:
    combined: dict[str, dict[str, Any]] = {}
    for item in processo.get("composicao_familiar") or []:
        if not isinstance(item, dict):
            continue
        person = _raw_member_to_person(item)
        identifier = person["id"] or person["cpf"] or f"raw-{len(combined)}"
        combined[identifier] = person
    for item in _extract_snapshot_complementos(processo):
        person = _snapshot_member_to_person(item)
        identifier = person["id"] or person["cpf"] or f"snapshot-{len(combined)}"
        if identifier in combined:
            combined[identifier] = _merge_people(combined[identifier], person)
        else:
            combined[identifier] = person
    return [item for item in combined.values() if item.get("ativo", True)]


def _state_kind(value: Any) -> str:
    normalized = _normalize_text(value)
    if "divorc" in normalized:
        return "divorciado"
    if "casad" in normalized:
        return "casado"
    if "uniao estavel" in normalized or "uniao" in normalized and "estavel" in normalized:
        return "uniao_estavel"
    if "solteir" in normalized:
        return "solteiro"
    return normalized or "nao_informado"


def _relation_kind(value: Any) -> str:
    normalized = _normalize_text(value)
    for spouse in SPOUSE_RELATIONS:
        if spouse in normalized:
            return "conjuge"
    for socio in SOCIO_RELATIONS:
        if socio in normalized:
            return "socio"
    if "filh" in normalized or "entead" in normalized:
        return "filho"
    return normalized or "outro"


def _kinship_degree(value: Any) -> int | None:
    normalized = _normalize_text(value)
    if not normalized:
        return None
    for token, degree in KINSHIP_DEGREES.items():
        if token in normalized:
            return degree
    return None


def _income_profile(person: dict[str, Any]) -> dict[str, bool]:
    text = " ".join(
        filter(
            None,
            [
                _normalize_text(person.get("tipo_contrato")),
                _normalize_text(person.get("profissao")),
                _normalize_text(person.get("cargo")),
                _normalize_text(person.get("empresa")),
            ],
        )
    )
    aposentado = "aposent" in text or "pension" in text or "inss" in text
    formal = person.get("renda_formal", Decimal("0")) > 0
    informal = person.get("renda_informal", Decimal("0")) > 0
    if not formal and not informal and not aposentado and person.get("renda_total", Decimal("0")) > 0:
        if person.get("tempo_emprego_anos") not in (None, "") or person.get("empresa") or person.get("tipo_contrato"):
            formal = True
    return {
        "formal": formal,
        "informal": informal,
        "aposentado": aposentado,
    }


def _has_income(person: dict[str, Any]) -> bool:
    return person.get("renda_total", Decimal("0")) > 0 or person.get("renda_formal", Decimal("0")) > 0 or person.get("renda_informal", Decimal("0")) > 0


def _has_fgts(
    processo: dict[str, Any],
    person: dict[str, Any] | None = None,
    *,
    use_process_totals: bool = True,
) -> bool:
    if person and _to_decimal(person.get("fgts")) > 0:
        return True
    if use_process_totals:
        fgts = _to_decimal(processo.get("simulacao_fgts"))
        if fgts > 0:
            return True
        sim_fechada = processo.get("simulacao_fechada") or {}
        fgts = _to_decimal(sim_fechada.get("fgts"))
        if fgts > 0:
            return True
    renda = _income_profile(person or {})
    return bool(renda.get("formal") and (person or {}).get("tempo_emprego_anos") not in (None, "", 0))


def _has_program_activity(
    prefix: str,
    documentos_status: dict[str, str] | None = None,
    pendencias: dict[str, dict[str, Any]] | None = None,
    uploads: list[dict[str, Any]] | None = None,
) -> bool:
    documentos_status = documentos_status or {}
    pendencias = pendencias or {}
    uploads = uploads or []
    if any(str(key or "").startswith(prefix) for key in documentos_status):
        return True
    if any(str(key or "").startswith(prefix) for key in pendencias):
        return True
    return any(str(item.get("documento_key") or "").startswith(prefix) for item in uploads if isinstance(item, dict))


def _status_indicates_program(value: Any) -> bool:
    normalized = _normalize_text(value)
    return normalized not in {"", "reserva", "cadastro comercial", "nao iniciado", "nao_iniciado"}


def _active_kits(programs: dict[str, bool], *kit_ids: str) -> list[str]:
    return [kit_id for kit_id in kit_ids if programs.get(kit_id)]


def _programs(
    processo: dict[str, Any],
    documentos_status: dict[str, str] | None = None,
    pendencias: dict[str, dict[str, Any]] | None = None,
    uploads: list[dict[str, Any]] | None = None,
) -> dict[str, bool]:
    resumo = _extract_resumo_operacao(processo)
    parceiro = _normalize_text(
        resumo.get("parceiro_simulacao")
        or (((_extract_snapshot(processo).get("calculo") or {}).get("imovel") or {}).get("parceiro_simulacao"))
        or (((processo.get("imovel_detalhes") or {}).get("parceiro_simulacao")))
    )
    explicit_caixa = _flag_from_sources(
        processo,
        "participa_caixa",
        "programa_caixa",
        "usa_caixa",
        "financiamento_caixa_ativo",
    )
    explicit_agehab = _flag_from_sources(
        processo,
        "participa_agehab",
        "programa_agehab",
        "usa_agehab",
        "beneficiario_agehab",
    )
    explicit_creditu = _flag_from_sources(
        processo,
        "participa_creditu",
        "programa_creditu",
        "usa_creditu",
        "parceiro_creditu",
    )

    creditu = explicit_creditu if explicit_creditu is not None else (
        "creditu" in parceiro or "creditur" in parceiro or _to_bool(resumo.get("creditur_ativo"))
    )
    creditu_payload = processo.get("creditu") or {}
    if not creditu and isinstance(creditu_payload, dict):
        creditu = bool(creditu_payload.get("email_segundo_proponente") or creditu_payload.get("telefone_segundo_proponente"))
    if explicit_creditu is None and not creditu:
        creditu = _has_program_activity("documentos-creditu-", documentos_status, pendencias, uploads)

    agehab = explicit_agehab if explicit_agehab is not None else False
    if explicit_agehab is None and not agehab:
        agehab = _status_indicates_program(processo.get("agehab_status")) or _has_program_activity(
            "documentos-agehab-",
            documentos_status,
            pendencias,
            uploads,
        )

    caixa = explicit_caixa if explicit_caixa is not None else False
    if explicit_caixa is None and not caixa:
        caixa = (
            _decimal_from_sources(processo, "financiamento_caixa", "simulacao_financiamento_caixa") > 0
            or _status_indicates_program(processo.get("caixa_status"))
            or _has_program_activity("documentos-caixa-", documentos_status, pendencias, uploads)
        )
    return {"caixa": caixa, "creditu": creditu, "agehab": agehab}


def _document_state(key: str, documentos: dict[str, str], pendencias: dict[str, dict[str, Any]]) -> str:
    status = documentos.get(key) or "Aguardando"
    pendencia = pendencias.get(key) or {}
    normalized = _normalize_text(status)
    if (
        pendencia.get("descricao")
        or "pend" in normalized
        or "bloq" in normalized
        or "rejeit" in normalized
        or "reprov" in normalized
        or ("valid" in normalized and "analist" in normalized)
        or normalized == "enviado"
    ):
        return "pending"
    if "aprov" in normalized or "nao se aplica" in normalized:
        return "done"
    return "missing"


def _upload_count(key: str, uploads: list[dict[str, Any]]) -> int:
    return sum(1 for item in uploads if str(item.get("documento_key") or "").startswith(key))


def _make_doc(
    *,
    docs: list[dict[str, Any]],
    documentos_status: dict[str, str],
    pendencias: dict[str, dict[str, Any]],
    uploads: list[dict[str, Any]],
    key: str,
    label: str,
    section: str,
    helper: str,
    kits: list[str],
    rule_label: str = "",
    person_name: str = "",
    conditional: bool = False,
) -> None:
    docs.append(
        {
            "key": key,
            "label": label,
            "sectionKey": section,
            "sectionLabel": SECTION_LABELS[section],
            "sectionOrder": SECTION_ORDER[section],
            "helper": helper,
            "ruleLabel": rule_label,
            "personName": person_name,
            "kits": kits,
            "status": documentos_status.get(key) or "Aguardando",
            "state": _document_state(key, documentos_status, pendencias),
            "uploadCount": _upload_count(key, uploads),
            "conditional": conditional,
        }
    )


def _civil_rule_label(estado_civil_kind: str) -> str:
    labels = {
        "solteiro": "Perfil solteiro",
        "divorciado": "Perfil divorciado",
        "casado": "Perfil casado",
        "uniao_estavel": "Perfil em união estável",
        "nao_informado": "Estado civil nao informado",
    }
    return labels.get(estado_civil_kind, "Perfil documental")


def _spouse_member(cliente: dict[str, Any], membros: list[dict[str, Any]]) -> dict[str, Any] | None:
    for member in membros:
        if _relation_kind(member.get("parentesco")) == "conjuge":
            return member
    estado = _state_kind(cliente.get("estado_civil"))
    if estado not in {"casado", "uniao_estavel"}:
        return None
    if cliente.get("renda_conjuge", Decimal("0")) <= 0 and estado == "casado":
        return {
            "id": "conjuge",
            "nome": "Cônjuge",
            "cpf": "",
            "estado_civil": "casado",
            "renda_total": Decimal("0"),
            "renda_formal": Decimal("0"),
            "renda_informal": Decimal("0"),
            "tempo_emprego_anos": None,
            "compoe_renda": False,
            "incluir_na_analise": True,
            "ativo": True,
        }
    return {
        "id": "segundo-proponente",
        "nome": "Segundo proponente",
        "cpf": "",
        "estado_civil": estado,
        "renda_total": cliente.get("renda_conjuge", Decimal("0")),
        "renda_formal": Decimal("0"),
        "renda_informal": Decimal("0"),
        "tempo_emprego_anos": None,
        "compoe_renda": True,
        "incluir_na_analise": True,
        "ativo": True,
    }


def _socio_members(membros: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [member for member in membros if _relation_kind(member.get("parentesco")) == "socio"]


def _dependent_members(membros: list[dict[str, Any]]) -> list[dict[str, Any]]:
    dependentes: list[dict[str, Any]] = []
    for member in membros:
        relation = _relation_kind(member.get("parentesco"))
        if relation in {"conjuge", "socio"}:
            continue
        dependentes.append(member)
    return dependentes


def _eligible_general_dependent(member: dict[str, Any]) -> bool:
    relation = _relation_kind(member.get("parentesco"))
    if relation == "filho":
        return True
    degree = _kinship_degree(member.get("parentesco"))
    return degree is not None and degree <= 3


def _eligible_agehab_dependent(member: dict[str, Any]) -> bool:
    relation = _relation_kind(member.get("parentesco"))
    if relation == "filho":
        return True
    degree = _kinship_degree(member.get("parentesco"))
    return degree is not None and degree <= 4


def _caixa_liberacao_flags(processo: dict[str, Any]) -> dict[str, bool]:
    resumo = _extract_resumo_operacao(processo)
    observacoes = _normalize_text(resumo.get("observacoes_comerciais"))
    return {
        "cheque_especial": "cheque especial" in observacoes,
        "cartao_credito": "cartao de credito" in observacoes or "cartao credito" in observacoes,
    }


def _income_rule_copy(subject: str, income: dict[str, bool]) -> tuple[str, str, str]:
    requirements: list[str] = []
    rule_labels: list[str] = []

    if income.get("formal"):
        requirements.append("contracheque")
        rule_labels.append("Renda formal")
    if income.get("informal"):
        requirements.append("extrato bancário dos últimos 90 dias")
        rule_labels.append("Renda informal")
    if income.get("aposentado"):
        requirements.append("extrato de recebimento do INSS")
        rule_labels.append("Aposentado ou pensionista")

    if income.get("formal") and not income.get("informal") and not income.get("aposentado"):
        return (
            f"Contracheque do {subject}",
            "Obrigatório para trabalhador formal.",
            "Renda formal",
        )
    if income.get("informal") and not income.get("formal") and not income.get("aposentado"):
        return (
            f"Extrato bancário de 90 dias do {subject}",
            "Envie os últimos 90 dias com meses completos, sem extratos parciais.",
            "Renda informal",
        )
    if income.get("aposentado") and not income.get("formal") and not income.get("informal"):
        return (
            f"Extrato de recebimento do INSS do {subject}",
            "Obrigatório para aposentado ou pensionista.",
            "Aposentado ou pensionista",
        )
    if requirements:
        return (
            f"Comprovantes de renda do {subject}",
            f"Anexe {' e '.join(requirements)} para comprovar toda a renda considerada.",
            " + ".join(rule_labels),
        )
    return (
        f"Comprovante de renda do {subject}",
        "Obrigatório para comprovar a renda informada neste perfil.",
        "Comprovação de renda",
    )


def _document_keys_for_kit(checklist: list[dict[str, Any]], kit_id: str) -> list[str]:
    ordered = sorted(
        [item for item in checklist if kit_id in item.get("kits", [])],
        key=lambda item: (item.get("sectionOrder", 999), item.get("label", ""), item.get("key", "")),
    )
    return [str(item.get("key") or "") for item in ordered if str(item.get("key") or "")]


def build_documentary_payload(
    processo: dict[str, Any],
    documentos_status: dict[str, str],
    pendencias: dict[str, dict[str, Any]],
    uploads: list[dict[str, Any]],
    creditu: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    creditu = creditu or {}
    cliente = _person_from_cliente(processo)
    membros = _extract_members(processo)
    spouse = _spouse_member(cliente, membros)
    socios = _socio_members(membros)
    dependentes = _dependent_members(membros)
    estado_civil_kind = _state_kind(cliente.get("estado_civil"))
    cliente_income = _income_profile(cliente)
    programs = _programs(processo, documentos_status, pendencias, uploads)
    cliente_has_fgts = _has_fgts(processo, cliente, use_process_totals=True)
    caixa_flags = _caixa_liberacao_flags(processo)
    agehab_endereco_no_nome = _flag_from_sources(
        processo,
        "comprovante_residencia_nome_beneficiario",
        "comprovante_residencia_em_nome_beneficiario",
        "endereco_em_nome_beneficiario",
    )
    checklist: list[dict[str, Any]] = []
    all_program_kits = _active_kits(programs, "caixa", "creditu", "agehab")
    caixa_creditu_kits = _active_kits(programs, "caixa", "creditu")
    caixa_agehab_kits = _active_kits(programs, "caixa", "agehab")

    estado_civil_label = "Certidão civil do proponente"
    estado_civil_helper = "Anexe o documento civil correto do proponente conforme o estado civil."
    if estado_civil_kind == "solteiro":
        estado_civil_label = "Certidão de nascimento do proponente"
        estado_civil_helper = "Obrigatório para perfil solteiro."
    elif estado_civil_kind == "divorciado":
        estado_civil_label = "Certidão de nascimento averbada do proponente"
        estado_civil_helper = "Obrigatório para perfil divorciado."
    elif estado_civil_kind == "casado":
        estado_civil_label = "Certidão de casamento do proponente"
        estado_civil_helper = "Obrigatório para perfil casado."
    elif estado_civil_kind == "uniao_estavel":
        estado_civil_label = "Certidão de nascimento do proponente"
        estado_civil_helper = "Obrigatório para perfil em união estável."

    if all_program_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-do-proponente-identidade-e-cpf",
            label="RG, CPF ou CNH do proponente",
            section="caixa_pessoais",
            helper="Anexe a identificação principal do cliente. Pode ser RG, CPF ou CNH.",
            kits=all_program_kits,
            rule_label=_civil_rule_label(estado_civil_kind),
            person_name=cliente.get("nome") or "",
        )
    if caixa_creditu_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-do-proponente-comp-de-estado-civil",
            label=estado_civil_label,
            section="caixa_pessoais",
            helper=estado_civil_helper,
            kits=caixa_creditu_kits,
            rule_label=_civil_rule_label(estado_civil_kind),
            person_name=cliente.get("nome") or "",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-do-proponente-comprovante-de-residencia",
            label="Comprovante de residência do proponente",
            section="caixa_pessoais",
            helper="Anexe o comprovante principal de endereço do cliente. Na Creditú, use declaração de endereço quando o comprovante não existir.",
            kits=caixa_creditu_kits,
            rule_label="Endereço do beneficiário",
            person_name=cliente.get("nome") or "",
        )

    if estado_civil_kind == "uniao_estavel" and caixa_creditu_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="uniao-estavel-termo",
            label="Termo de união estável",
            section="caixa_pessoais",
            helper="Obrigatório quando a composição for união estável.",
            kits=caixa_creditu_kits,
            rule_label="União estável",
        )

    if spouse and estado_civil_kind in {"casado", "uniao_estavel"} and all_program_kits:
        relation_label = "Cônjuge" if estado_civil_kind == "casado" else "Companheiro(a)"
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="conjuge-identidade-e-cpf",
            label=f"RG, CPF ou CNH do {relation_label.lower()}",
            section="caixa_conjuge",
            helper=f"Anexe a identificação do {relation_label.lower()} ou segundo proponente.",
            kits=all_program_kits,
            rule_label=relation_label,
            person_name=spouse.get("nome") or relation_label,
        )
        if caixa_creditu_kits:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="conjuge-comp-de-estado-civil",
                label=f"Certidão de nascimento, casamento ou união estável do {relation_label.lower()}",
                section="caixa_conjuge",
                helper="Anexe a certidão civil correta do cônjuge, companheiro(a) ou segundo proponente.",
                kits=caixa_creditu_kits,
                rule_label=relation_label,
                person_name=spouse.get("nome") or relation_label,
            )

    if socios and caixa_creditu_kits:
        for index, socio in enumerate(socios, start=1):
            suffix = socio.get("id") or str(index)
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"socio-{_slug(suffix)}-identidade-e-cpf",
                label=f"RG e CPF do sócio {index}",
                section="caixa_pessoais",
                helper="Cada sócio precisa enviar sua identificação completa.",
                kits=caixa_creditu_kits,
                rule_label="Sócios",
                person_name=socio.get("nome") or f"Sócio {index}",
            )
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"socio-{_slug(suffix)}-estado-civil",
                label=f"Certidão civil do sócio {index}",
                section="caixa_pessoais",
                helper="Obrigatorio para socio formal.",
                kits=caixa_creditu_kits,
                rule_label="Sócios",
                person_name=socio.get("nome") or f"Sócio {index}",
            )

    if cliente_income["formal"] and caixa_agehab_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="renda-formal",
            label="Comprovante de renda formal do proponente",
            section="caixa_pessoais",
            helper="Anexe contracheque ou comprovante formal de renda.",
            kits=caixa_agehab_kits,
            rule_label="Renda formal",
            person_name=cliente.get("nome") or "",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-do-proponente-extrato-fgts",
            label="Extrato do FGTS do proponente",
            section="caixa_pessoais",
            helper="Obrigatorio para trabalhador formal ou quando houver FGTS/cotista ativo.",
            kits=["caixa"],
            rule_label="FGTS",
            person_name=cliente.get("nome") or "",
        )
        if (cliente.get("tempo_emprego_anos") or 0) >= 3:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-do-proponente-ctps-carteira",
                label="Carteira de trabalho do proponente",
                section="caixa_pessoais",
                helper="Obrigatória para vínculo ou cotista acima de 3 anos.",
                kits=["caixa"],
                rule_label="Vínculo superior a 3 anos",
                person_name=cliente.get("nome") or "",
            )
    if cliente_income["informal"] and caixa_agehab_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="renda-informal",
            label="Comprovante de renda informal do proponente",
            section="caixa_pessoais",
            helper="Envie os últimos 90 dias com meses completos, sem extratos parciais.",
            kits=caixa_agehab_kits,
            rule_label="Renda informal",
            person_name=cliente.get("nome") or "",
        )
    if cliente_income["aposentado"] and caixa_agehab_kits:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="aposentados",
            label="Extrato de recebimento do INSS do proponente",
            section="caixa_pessoais",
            helper="Obrigatório para aposentado ou pensionista.",
            kits=caixa_agehab_kits,
            rule_label="Aposentado ou pensionista",
            person_name=cliente.get("nome") or "",
        )

    spouse_income_kits = _active_kits(programs, "caixa", "creditu", "agehab")
    if spouse and _has_income(spouse) and spouse_income_kits:
        spouse_income = _income_profile(spouse)
        spouse_label, spouse_helper, spouse_rule = _income_rule_copy("segundo proponente", spouse_income)
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="conjuge-comprovante-de-renda",
            label=spouse_label,
            section="caixa_conjuge",
            helper=spouse_helper,
            kits=spouse_income_kits,
            rule_label=spouse_rule,
            person_name=spouse.get("nome") or "Segundo proponente",
        )
        if spouse_income["formal"]:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="conjuge-extrato-fgts",
                label="Extrato do FGTS do segundo proponente",
                section="caixa_conjuge",
                helper="Obrigatorio para trabalhador formal com FGTS.",
                kits=["caixa"],
                rule_label="FGTS do segundo proponente",
                person_name=spouse.get("nome") or "Segundo proponente",
            )
        if spouse_income["formal"] and (spouse.get("tempo_emprego_anos") or 0) >= 3:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="conjuge-ctps-carteira",
                label="Carteira de trabalho do segundo proponente",
                section="caixa_conjuge",
                helper="Obrigatória para vínculo superior a 3 anos.",
                kits=["caixa"],
                rule_label="Vínculo superior a 3 anos",
                person_name=spouse.get("nome") or "Segundo proponente",
            )

    for index, socio in enumerate(socios, start=1):
        if not caixa_creditu_kits:
            break
        socio_income = _income_profile(socio)
        socio_label, socio_helper, socio_rule = _income_rule_copy(f"socio {index}", socio_income)
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key=f"socio-{_slug(socio.get('id') or index)}-comprovante-renda",
            label=socio_label,
            section="caixa_pessoais",
            helper=socio_helper if _has_income(socio) else "Cada sócio deve possuir renda comprovada para seguir no processo.",
            kits=caixa_creditu_kits,
            rule_label=socio_rule if _has_income(socio) else "Sócios",
            person_name=socio.get("nome") or f"Sócio {index}",
        )
        if socio_income["formal"]:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"socio-{_slug(socio.get('id') or index)}-extrato-fgts",
                label=f"Extrato do FGTS do sócio {index}",
                section="caixa_pessoais",
                helper="Obrigatorio para socio formal com FGTS ou cotista ativo.",
                kits=["caixa"],
                rule_label="FGTS do sócio",
                person_name=socio.get("nome") or f"Sócio {index}",
            )
        if socio_income["formal"] and (socio.get("tempo_emprego_anos") or 0) >= 3:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"socio-{_slug(socio.get('id') or index)}-ctps-carteira",
                label=f"Carteira de trabalho do sócio {index}",
                section="caixa_pessoais",
                helper="Obrigatória para sócio com vínculo superior a 3 anos.",
                kits=["caixa"],
                rule_label="Vínculo superior a 3 anos",
                person_name=socio.get("nome") or f"Sócio {index}",
            )

    for index, dependente in enumerate(dependentes, start=1):
        relation_kind = _relation_kind(dependente.get("parentesco"))
        idade = _age_from_date(dependente.get("data_nascimento"))
        state_kind = _state_kind(dependente.get("estado_civil"))
        slug = _slug(dependente.get("id") or dependente.get("cpf") or dependente.get("nome") or index)
        nome = dependente.get("nome") or f"Dependente {index}"
        general_dependent = programs["caixa"] and _eligible_general_dependent(dependente)
        agehab_dependent = programs["agehab"] and _eligible_agehab_dependent(dependente)
        if not general_dependent and not agehab_dependent:
            continue
        dependent_kits = _active_kits(
            {"caixa": general_dependent, "agehab": agehab_dependent},
            "caixa",
            "agehab",
        )
        dependent_section = "caixa_dependentes" if general_dependent else "agehab_dependentes"
        if relation_kind == "filho" and idade is not None and idade < 18:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"dependente-{slug}-certidao-nascimento",
                label=f"Certidão de nascimento de {nome}",
                section=dependent_section,
                helper="Obrigatória para filho menor.",
                kits=dependent_kits,
                rule_label="Filho menor",
                person_name=nome,
            )
            continue

        if general_dependent:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"dependente-{slug}-identidade-e-cpf",
                label=f"RG, CPF ou CNH de {nome}",
                section="caixa_dependentes",
                helper="Obrigatório para dependente maior ou parente até terceiro grau.",
                kits=dependent_kits,
                rule_label="Dependente maior ou parente",
                person_name=nome,
            )
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"dependente-{slug}-declaracao-dependente",
                label=f"Declaração de parentesco de {nome}",
                section="caixa_dependentes",
                helper="Obrigatória para dependente maior ou parente na composição.",
                kits=["caixa"],
                rule_label="Dependente maior ou parente",
                person_name=nome,
            )
        if agehab_dependent and not general_dependent:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"dependente-{slug}-rg-agehab",
                label=f"RG de {nome}",
                section="agehab_dependentes",
                helper="Obrigatório para dependente Agehab maior de idade ou parente até quarto grau.",
                kits=["agehab"],
                rule_label="Dependente Agehab",
                person_name=nome,
            )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key=f"dependente-{slug}-estado-civil",
            label=f"{'Certidão de casamento' if state_kind == 'casado' else 'Certidão de nascimento'} de {nome}",
            section=dependent_section,
            helper="Substitua pela certidão de casamento quando o dependente for casado.",
            kits=dependent_kits,
            rule_label="Dependente maior ou parente",
            person_name=nome,
        )
        if state_kind == "casado":
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key=f"dependente-{slug}-conjuge-identidade-e-cpf",
                label=f"RG, CPF ou CNH do cônjuge de {nome}",
                section=dependent_section,
                helper="Obrigatório quando o dependente casado participa da composição.",
                kits=dependent_kits,
                rule_label="Dependente casado",
                person_name=nome,
            )
            if agehab_dependent and not _has_income(dependente):
                _make_doc(
                    docs=checklist,
                    documentos_status=documentos_status,
                    pendencias=pendencias,
                    uploads=uploads,
                    key=f"dependente-{slug}-conjuge-declaracao-nao-renda",
                    label=f"Declaração de não renda do cônjuge de {nome}",
                    section="agehab",
                    helper="Obrigatória quando o dependente casado participa da composição Agehab sem renda comprovada.",
                    kits=["agehab"],
                    rule_label="Dependente casado sem renda",
                    person_name=nome,
                    conditional=True,
                )

    if programs["caixa"]:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-do-proponente-irpf-recibo",
            label="IRPF e recibo do proponente",
            section="caixa_pessoais",
            helper="Quando o cliente nao declara IRPF, o corretor pode marcar Nao se aplica para validacao do analista.",
            kits=["caixa"],
            rule_label="IRPF",
            person_name=cliente.get("nome") or "",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-caixa-autorizacao-fgts",
            label="Autorização de consulta do FGTS",
            section="caixa_pessoais",
            helper="Obrigatória para consulta e composição do kit Caixa.",
            kits=["caixa"],
            rule_label="FGTS",
            person_name=cliente.get("nome") or "",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-caixa-mo",
            label="Formulário MO da Caixa",
            section="caixa_formularios",
            helper="Obrigatório para o kit operacional da Caixa.",
            kits=["caixa"],
            rule_label="Caixa",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-caixa-ficha-de-cadastro-caixa",
            label="Ficha de cadastro da Caixa",
            section="caixa_formularios",
            helper="Obrigatória para abertura do processo Caixa.",
            kits=["caixa"],
            rule_label="Caixa",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-caixa-abertura-de-conta",
            label="Ficha de abertura de conta",
            section="caixa_formularios",
            helper="Obrigatória para o kit Caixa.",
            kits=["caixa"],
            rule_label="Caixa",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-caixa-damp",
            label="DAMP",
            section="caixa_formularios",
            helper="Obrigatório para o envio da documentação Caixa.",
            kits=["caixa"],
            rule_label="Caixa",
        )
        if caixa_flags["cheque_especial"]:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-caixa-cheque-especial",
                label="Ficha de cadastro de cheque especial",
                section="caixa_formularios",
                helper="Inclua somente quando houver liberacao desse produto.",
                kits=["caixa"],
                rule_label="Caixa",
                conditional=True,
            )
        if caixa_flags["cartao_credito"]:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-caixa-cartao-credito",
                label="Ficha de cadastro de cartao de credito",
                section="caixa_formularios",
                helper="Inclua somente quando houver liberacao desse produto.",
                kits=["caixa"],
                rule_label="Caixa",
                conditional=True,
            )

    if programs["creditu"]:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-creditu-tela-score-cliente",
            label="Tela de score do proponente",
            section="creditu",
            helper="Obrigatória para o dossiê da Creditú.",
            kits=["creditu"],
            rule_label="Creditú",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-creditu-tela-aprovacao-creditu",
            label="Tela de aprovação da Creditú",
            section="creditu",
            helper="Obrigatória para o kit Creditú.",
            kits=["creditu"],
            rule_label="Creditú",
        )
        if spouse:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-creditu-segundo-proponente-certidao-civil",
                label="Certidão civil do segundo proponente",
                section="creditu",
                helper="Anexe a certidão civil do segundo proponente.",
                kits=["creditu"],
                rule_label="Creditú",
                person_name=spouse.get("nome") or "Segundo proponente",
            )
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-creditu-segundo-proponente-endereco",
                label="Comprovante ou declaração de endereço do segundo proponente",
                section="creditu",
                helper="Use declaração de endereço se o comprovante não existir.",
                kits=["creditu"],
                rule_label="Creditú",
                person_name=spouse.get("nome") or "Segundo proponente",
            )

    if programs["agehab"]:
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-agehab-ficha-agehab",
            label="Ficha Agehab",
            section="agehab",
            helper="Obrigatória para beneficiário participante da Agehab.",
            kits=["agehab"],
            rule_label="Agehab",
        )
        if agehab_endereco_no_nome is False:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-agehab-rg-declarante",
                label="RG do declarante do endereço Agehab",
                section="agehab",
                helper="Obrigatório quando a conta de água ou energia não estiver no nome do beneficiário.",
                kits=["agehab"],
                rule_label="Agehab",
                conditional=True,
            )
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-agehab-cpf-declarante",
                label="CPF do declarante do endereço Agehab",
                section="agehab",
                helper="Obrigatório quando a conta de água ou energia não estiver no nome do beneficiário.",
                kits=["agehab"],
                rule_label="Agehab",
                conditional=True,
            )
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-agehab-declaracao-endereco",
                label="Declaração de endereço conforme modelo Agehab",
                section="agehab",
                helper="Use quando o comprovante de agua ou energia nao estiver no nome do beneficiario.",
                kits=["agehab"],
                rule_label="Agehab",
                conditional=True,
            )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-agehab-comprovante-de-residencia",
            label="Conta de água ou energia em nome do beneficiário",
            section="agehab",
            helper="Se não estiver no nome do beneficiário, use a declaração de endereço AGEHAB com RG e CPF do declarante.",
            kits=["agehab"],
            rule_label="Agehab",
        )
        _make_doc(
            docs=checklist,
            documentos_status=documentos_status,
            pendencias=pendencias,
            uploads=uploads,
            key="documentos-agehab-vinculo-3-anos",
            label="Comprovante de vínculo municipal mínimo de 3 anos",
            section="agehab",
            helper="Obrigatório para o processo Agehab.",
            kits=["agehab"],
            rule_label="Agehab",
        )
        if _has_income(cliente):
            requires_generic_agehab_income = not (
                cliente_income["formal"] or cliente_income["informal"] or cliente_income["aposentado"]
            )
            if requires_generic_agehab_income:
                _make_doc(
                    docs=checklist,
                    documentos_status=documentos_status,
                    pendencias=pendencias,
                    uploads=uploads,
                    key="documentos-agehab-comprovante-renda-beneficiario",
                    label="Comprovante ou declaração de renda do beneficiário",
                    section="agehab",
                    helper="Use declaração de renda quando não houver comprovante formal.",
                    kits=["agehab"],
                    rule_label="Agehab",
                )
        else:
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-agehab-declaracao-nao-renda",
                label="Declaração de não renda do beneficiário",
                section="agehab",
                helper="Obrigatória quando o beneficiário não possui renda.",
                kits=["agehab"],
                rule_label="Agehab",
            )
        if spouse and not _has_income(spouse):
            _make_doc(
                docs=checklist,
                documentos_status=documentos_status,
                pendencias=pendencias,
                uploads=uploads,
                key="documentos-agehab-declaracao-nao-renda-conjuge",
                label="Declaração de não renda do cônjuge",
                section="agehab",
                helper="Obrigatória quando o cônjuge participa da composição e não possui renda.",
                kits=["agehab"],
                rule_label="Agehab",
                person_name=spouse.get("nome") or "Cônjuge",
            )

    checklist.sort(key=lambda item: (item.get("sectionOrder", 999), item.get("label", ""), item.get("key", "")))
    kits = {
        "caixa": {
            "label": "Kit Caixa",
            "documento_keys": _document_keys_for_kit(checklist, "caixa") if programs["caixa"] else [],
            "metadata": {
                "descricao": "Kit completo da Caixa montado automaticamente conforme o checklist documental.",
            },
        },
        "creditu": {
            "label": "Kit Creditú",
            "documento_keys": _document_keys_for_kit(checklist, "creditu") if programs["creditu"] else [],
            "metadata": {
                "descricao": "Kit completo da Creditú com score, aprovação e dados obrigatórios do proponente.",
                "telefone_proponente": str(cliente.get("telefone") or "").strip(),
                "email_proponente": str(cliente.get("email") or "").strip(),
                "telefone_segundo_proponente": str(creditu.get("telefone_segundo_proponente") or "").strip(),
                "email_segundo_proponente": str(creditu.get("email_segundo_proponente") or "").strip(),
                "campos_obrigatorios": [
                    {
                        "key": "telefone_proponente",
                        "label": "Telefone do proponente",
                        "value": str(cliente.get("telefone") or "").strip(),
                        "preenchido": bool(str(cliente.get("telefone") or "").strip()),
                    },
                    {
                        "key": "email_proponente",
                        "label": "E-mail do proponente",
                        "value": str(cliente.get("email") or "").strip(),
                        "preenchido": bool(str(cliente.get("email") or "").strip()),
                    },
                    {
                        "key": "telefone_segundo_proponente",
                        "label": "Telefone do segundo proponente",
                        "value": str(creditu.get("telefone_segundo_proponente") or "").strip(),
                        "preenchido": bool(str(creditu.get("telefone_segundo_proponente") or "").strip()),
                        "condicional": spouse is not None,
                    },
                    {
                        "key": "email_segundo_proponente",
                        "label": "E-mail do segundo proponente",
                        "value": str(creditu.get("email_segundo_proponente") or "").strip(),
                        "preenchido": bool(str(creditu.get("email_segundo_proponente") or "").strip()),
                        "condicional": spouse is not None,
                    },
                ],
            },
        },
        "agehab": {
            "label": "Kit AGEHAB",
            "documento_keys": _document_keys_for_kit(checklist, "agehab") if programs["agehab"] else [],
            "metadata": {
                "descricao": "Kit completo da AGEHAB com documentos sociais, endereço, renda e vínculo municipal.",
            },
        },
        "dossie": {
            "label": "Dossiê completo",
            "documento_keys": [str(item.get("key") or "") for item in checklist],
        },
    }

    profile = {
        "cliente": {
            "nome": cliente.get("nome"),
            "estado_civil": cliente.get("estado_civil"),
            "estado_civil_normalizado": estado_civil_kind,
            "renda_principal": float(cliente.get("renda_principal", Decimal("0"))),
            "renda_conjuge": float(cliente.get("renda_conjuge", Decimal("0"))),
            "renda_total": float(cliente.get("renda_total", Decimal("0"))),
            "renda_formal": float(cliente.get("renda_formal", Decimal("0"))),
            "renda_informal": float(cliente.get("renda_informal", Decimal("0"))),
            "tempo_emprego_anos": cliente.get("tempo_emprego_anos"),
            "tipo_renda": (
                "aposentado"
                if cliente_income["aposentado"]
                else "mista"
                if cliente_income["formal"] and cliente_income["informal"]
                else "formal"
                if cliente_income["formal"]
                else "informal"
                if cliente_income["informal"]
                else "nao_informado"
            ),
            "possui_fgts": cliente_has_fgts,
        },
        "programas": programs,
        "segundo_proponente": {
            "nome": spouse.get("nome"),
            "parentesco": spouse.get("parentesco"),
            "estado_civil": spouse.get("estado_civil"),
            "possui_renda": _has_income(spouse),
        }
        if spouse
        else None,
        "dependentes": [
            {
                "nome": item.get("nome"),
                "parentesco": item.get("parentesco"),
                "estado_civil": item.get("estado_civil"),
                "idade": _age_from_date(item.get("data_nascimento")),
            }
            for item in dependentes
        ],
        "socios": [
            {
                "nome": item.get("nome"),
                "parentesco": item.get("parentesco"),
                "possui_renda": _has_income(item),
            }
            for item in socios
        ],
    }
    return profile, checklist, kits
