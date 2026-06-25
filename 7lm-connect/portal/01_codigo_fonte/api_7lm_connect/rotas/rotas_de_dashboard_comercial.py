"""
Rotas do Dashboard Comercial migrado do PRJ.

O modulo preserva o contrato /api/v1 usado pelo frontend React original,
mas executa dentro da API atual do 7LM Connect com autenticacao, permissao e
banco padronizados.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from configuracoes import ESQUEMA_BANCO, ESQUEMA_COMERCIAL
from dependencias import obter_usuario_autenticado
from utilitarios.autorizacao import exigir_permissao_portal, usuario_possui_permissao


rotas_de_dashboard_comercial = APIRouter()

IGNORAR_FILTROS = {"", "todos", "todas", "all", "undefined", "null"}
VALOR_EM_BRANCO = "__blank__"

FILTROS_KPI = {
    "cidade": "cidade",
    "origem": "origem",
    "empreendimento": "empreendimento",
    "empreendimentoReduzido": "empreendimento_reduzido",
    "sdr": "sdr",
    "corretor": "corretor",
    "gerencia": "gerencia",
    "coordenacao": "coordenacao",
    "imobiliaria": "imobiliaria",
    "regiaoOperacao": "empreendimento_reduzido",
    "imobiliariaOperacao": "imobiliaria",
    "corretorOperacao": "corretor",
    "sdrOperacao": "sdr",
    "corretorAtivo": "corretor",
    "gestorCorretor": "gerencia",
    "coordenadorCorretor": "coordenacao",
    "regiaoCorretor": "empreendimento_reduzido",
    "imobiliariaCorretor": "imobiliaria",
    "sdrAtivo": "sdr",
    "gestorSdr": "gerencia",
    "coordenadorSdr": "coordenacao",
    "regiaoSdr": "empreendimento_reduzido",
    "imobiliariaSdr": "imobiliaria",
}

FILTROS_BASE = {
    "cidade": "lead_cidade",
    "origem": "lead_origem_nome",
    "empreendimento": "empreendimento_nome",
    "empreendimentoReduzido": "regiao_empreendimento",
    "sdr": "sdr_nome",
    "corretor": "corretor_nome",
    "gerencia": "gestor_nome",
    "coordenacao": "gestor_nome",
    "imobiliaria": "imobiliaria_nome",
    "regiaoOperacao": "regiao_empreendimento",
    "imobiliariaOperacao": "imobiliaria_nome",
    "corretorOperacao": "corretor_nome",
    "sdrOperacao": "sdr_nome",
    "unidade": "unidade_nome",
    "corretorAtivo": "corretor_nome",
    "gestorCorretor": "gestor_nome",
    "coordenadorCorretor": "gestor_nome",
    "regiaoCorretor": "regiao_empreendimento",
    "imobiliariaCorretor": "imobiliaria_nome",
    "sdrAtivo": "sdr_nome",
    "gestorSdr": "gestor_nome",
    "coordenadorSdr": "gestor_nome",
    "regiaoSdr": "regiao_empreendimento",
    "imobiliariaSdr": "imobiliaria_nome",
}

FILTROS_RESERVAS_BASE = {
    "cidade": "lead_cidade",
    "origem": "lead_origem_nome",
    "empreendimento": "empreendimento_nome",
    "empreendimentoReduzido": "regiao_empreendimento",
    "regiao": "regiao_empreendimento",
    "regiaoOperacao": "regiao_empreendimento",
    "regiaoCorretor": "regiao_empreendimento",
    "corretor": "coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''))",
    "corretorOperacao": "coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''))",
    "corretorAtivo": "coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''))",
    "imobiliaria": "coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''))",
    "imobiliariaOperacao": "coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''))",
    "imobiliariaCorretor": "coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''))",
    "situacao": "reserva_situacao_nome",
    "situacaoAtual": "reserva_situacao_nome",
    "status": "reserva_situacao_nome",
    "idReserva": "idreserva::text",
    "repasseNoMes": "reserva_campos_adicionais_reserva_repasse_no_mes",
    "agente": "null::text",
    "unidade": "unidade_nome",
}

EIXOS_RESERVAS = {
    "empreendimento": "coalesce(nullif(empreendimento_nome, ''), 'Sem empreendimento')",
    "corretor": "coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''), 'Sem corretor')",
    "imobiliaria": "coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''), 'Sem imobiliaria')",
    "regiao": "coalesce(nullif(regiao_empreendimento, ''), 'Sem regiao')",
    "situacao": "coalesce(nullif(reserva_situacao_nome, ''), 'Sem situacao')",
    "origem": "coalesce(nullif(lead_origem_nome, ''), 'Sem origem')",
}

METAS_RESERVAS_PADRAO = {
    "equipe própria 2 | agl": 7,
    "equipe própria 3 | agl": 7,
    "equipe própria | agl": 6,
    "canal virtual 1": 7,
    "canal virtual 2": 5,
    "imobiliárias | agl": 5,
    "imobiliárias | fsa": 10,
    "equipe própria | fsa": 1,
    "canal virtual 1 | fsa": 1,
    "canal virtual 2 | fsa": 1,
    "equipe própria 2 | fsa": 8,
    "autônomos | fsa": 10,
    "autônomos 2 | fsa": 10,
    "equipe própria | cat": 15,
    "canal virtual 4": 25,
    "imobiliárias | cat": 10,
}

EIXOS_DETALHE_RESERVAS = {
    **EIXOS_RESERVAS,
    "pipeline": """case
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%venda finalizada%' then 'Venda finalizada'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%aprovado diretoria%' then 'Aprovado Diretoria'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%diretoria%' then 'Aprovado Diretoria'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%assinatura 7lm%' then 'Assinatura 7LM'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%assinatura%' then 'Assinatura 7LM'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%fase creditu%' then 'Fase CreditÚ'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%creditu%' then 'Fase CreditÚ'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%credito%' then 'Crédito'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%cef%' then 'Crédito'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%caixa%' then 'Crédito'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%financ%' then 'Crédito'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%envio sienge%' then 'Envio SIENGE'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%sienge%' then 'Envio SIENGE'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%envio mega%' then 'Envio SIENGE'
        when translate(lower(coalesce(reserva_situacao_nome, '') || ' ' || coalesce(repasse_situacao_nome, '') || ' ' || coalesce(reserva_obs_finalizacao, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%secretaria%' then 'Secretaria de Vendas'
        else 'Em processo'
    end""",
}

SQL_NORMALIZE_ACCENTS_FROM = "ãáàâäéèêëíìîïóòôöõúùûüç"
SQL_NORMALIZE_ACCENTS_TO = "aaaaaeeeeiiiiooooouuuuc"
RESERVA_SITUACAO_NORMALIZADA_SQL = (
    f"translate(lower(coalesce(reserva_situacao_nome, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}')"
)
RESERVA_SLA_LIMITE_SITUACAO_SQL = f"""case
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} = 'credito' then 1
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} = 'em processo' then 7
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} = 'secretaria de vendas' then 1
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} in ('assinatura diretoria', 'assinatura 7lm', 'aprovado diretoria') then 1
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} in ('envio mega', 'envio sienge') then 1
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} = 'fase creditu' then 2
    when {RESERVA_SITUACAO_NORMALIZADA_SQL} = 'venda finalizada' then 10
    else null
end"""
RESERVA_TEMPO_SITUACAO_SQL = "greatest(0, floor(extract(epoch from (now() - data_ultima_alteracao_situacao)) / 86400))"
RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL = (
    f"translate(lower(coalesce(reserva_situacao_nome, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') "
    "in ('credito', 'secretaria de vendas', 'em processo')"
)
RESERVA_REPASSE_NAO_SQL = (
    f"translate(lower(coalesce(reserva_repasse_no_mes, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') = 'nao'"
)
RESERVA_PROB_CAIR_SQL = (
    f"translate(lower(coalesce(reserva_repasse_no_mes, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') = 'probabilidade de cair'"
)
REPASSE_PROB_SIM_TALVEZ_SQL = (
    f"translate(lower(coalesce(repasse_probabilidade_de_assinatura, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') in ('sim', 'talvez')"
)
REPASSE_PROB_NAO_SQL = (
    f"translate(lower(coalesce(repasse_probabilidade_de_assinatura, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') = 'nao'"
)
REPASSE_FLUXO_REPASSE_SQL = (
    f"translate(lower(coalesce(repasse_situacao_nome, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') "
    "in ('em andamento- (repasse)', 'inicio repasse')"
)


def _sql_reserva_situacao_normalizada(alias: str = "b") -> str:
    return (
        f"translate(lower(coalesce({alias}.reserva_situacao_nome, '')), "
        f"'{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}')"
    )


def _sql_reserva_cancelada(alias: str = "b") -> str:
    return f"{_sql_reserva_situacao_normalizada(alias)} like 'cancel%'"


def _sql_venda_data_referencia(alias: str = "b") -> str:
    return f"{alias}.dt_cadastro_reserva"


def _sql_venda_data_desempate(alias: str = "b") -> str:
    return f"coalesce({alias}.dt_referencia_reserva, {alias}.dt_cadastro_reserva)"


def _sql_venda_cliente_chave(alias: str = "b") -> str:
    documento = (
        f"nullif(regexp_replace(coalesce({alias}.cliente_documento, "
        f"{alias}.dim_lead_cliente_documento, ''), '\\D', '', 'g'), '')"
    )
    return f"coalesce({alias}.idcliente_canonico::text, {documento}, {alias}.idreserva::text)"


def _sql_venda_cliente_mes_chave(alias: str = "b") -> str:
    return f"concat(to_char(date_trunc('month', {alias}.dt_cadastro_reserva), 'YYYY-MM'), '|', {_sql_venda_cliente_chave(alias)})"


def _sql_venda_ordem_canonica(alias: str = "b") -> str:
    return (
        f"{alias}.dt_cadastro_reserva desc nulls last, "
        f"{_sql_venda_data_desempate(alias)} desc nulls last, "
        f"case when {_sql_reserva_cancelada(alias)} then 1 else 0 end, "
        f"{alias}.idreserva desc nulls last, "
        f"{alias}.fato_jornada_comercial_key desc nulls last"
    )
REPASSE_MP_ATIVA_SQL = (
    f"translate(lower(coalesce(repasse_situacao_nome, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') "
    "in ('assinatura caixa', 'validacao assinatura caixa', 'em andamento- (garantia)')"
)

EIXOS_BREAKDOWN = {
    "cidade": "cidade",
    "corretor": "corretor",
    "gerencia": "gerencia",
    "coordenacao": "coordenacao",
    "empreendimento": "empreendimento",
    "empreendimentoReduzido": "empreendimento_reduzido",
    "origem": "origem",
    "imobiliaria": "imobiliaria",
}

KPI_SQL = {
    "leads": "sum(leads)",
    "visitas": "sum(visitas)",
    "agendamentos": "sum(agendamentos)",
    "vendas": "sum(vendas)",
    "vendas_geradas": "sum(vendas)",
    "repasses": "sum(repasses)",
    "propostas": "sum(propostas_aprovadas) + sum(propostas_condicionadas)",
    "propostas_total": "sum(propostas_total)",
    "pastas_aprovadas": "sum(propostas_aprovadas)",
    "pastas_condicionadas": "sum(propostas_condicionadas)",
    "pastas_reprovadas": "sum(propostas_reprovadas)",
    "pastas_com_respostas": "sum(propostas_total)",
    "cancelamentos": "sum(cancelamentos)",
    "distratos": "sum(distratos)",
    "sla_f": "case when sum(sla_finalizacao_count) > 0 then sum(sla_finalizacao_sum) / sum(sla_finalizacao_count) else 0 end",
    "sla_r": "case when sum(sla_repasse_count) > 0 then sum(sla_repasse_sum) / sum(sla_repasse_count) else 0 end",
    "ipc": "sum(repasses)",
    "ipc_corretor": "sum(repasses)",
    "ipc_imobiliaria": "sum(repasses)",
}

EXPANDED_CARD_AUDIT_KPIS = {
    "leads": {"summary": "total_leads", "trend": "leads", "additive": True},
    "visitas": {"summary": "total_visitas", "trend": "visitas", "additive": True},
    "propostas": {"summary": "total_propostas_geral", "trend": "propostas", "additive": True},
    "cancelamentos": {"summary": "total_cancelamentos", "trend": "cancelamentos", "additive": True},
    "vendas": {"summary": "total_vendas", "trend": "vendas", "additive": True},
    "distratos": {"summary": "total_distratos", "trend": "distratos", "additive": True},
    "repasses": {"summary": "total_repasses", "trend": "repasses", "additive": True},
    "sla_f": {"summary": "total_sla_finalizacao", "trend": "sla_finalizacao", "additive": False},
    "sla_r": {"summary": "total_sla_repasse", "trend": "sla_repasse", "additive": False},
    "ipc_corretor": {"summary": "total_ipc_corretor", "trend": "ipc_corretor", "additive": False},
}

FUNIL_ETAPAS = [
    {
        "key": "lead",
        "label": "LEAD",
        "order": 1,
        "source": "base",
        "aggregate": "distinct",
        "rule": "Lead com data de conversao no periodo.",
    },
    {
        "key": "atendimento",
        "label": "ATENDIMENTO",
        "order": 2,
        "source": "historico",
        "aggregate": "countrows",
        "statuses": ("Atendimento - IA", "Atendimento - SDR"),
        "status_groups": ("ATENDIMENTO",),
        "rule": "Eventos de workflow em Atendimento - IA ou Atendimento - SDR.",
    },
    {
        "key": "agendamento",
        "label": "AGENDAMENTO",
        "order": 3,
        "source": "historico",
        "aggregate": "latest_by_lead",
        "statuses": ("Agendado", "Agendado - IA", "Agendamento", "Agendamento - IA"),
        "status_groups": ("AGENDADO_IA", "AGENDAMENTO", "AGENDAMENTO_IA"),
        "rule": "Ultima entrada de cada lead em AGENDAMENTO, AGENDAMENTO_IA ou AGENDADO_IA no periodo.",
    },
    {
        "key": "visita",
        "label": "VISITA",
        "order": 4,
        "source": "base",
        "aggregate": "distinct",
        "rule": "Visitas efetivamente realizadas no periodo.",
    },
    {
        "key": "proposta",
        "label": "PROPOSTA",
        "order": 5,
        "source": "historico",
        "aggregate": "countrows",
        "statuses": ("Proposta",),
        "status_groups": ("PROPOSTA",),
        "rule": "Eventos de workflow na situacao Proposta.",
    },
    {
        "key": "prop_aprovada_condicionada",
        "label": "PROP. APROVADA / CONDICIONADA",
        "order": 6,
        "source": "propostas",
        "aggregate": "distinct",
        "statuses": ("APROVADA", "CONDICIONADA", "CONDICIONADO", "CONDICIONADO PENDENTE"),
        "rule": "Soma oficial de propostas aprovadas ou condicionadas no fato diario dos indicadores gerais.",
    },
    {
        "key": "vendas",
        "label": "RESERVA",
        "order": 7,
        "source": "base",
        "aggregate": "distinct",
        "rule": "Uma reserva por cliente no mes pela data de cadastro da reserva; se o cliente tiver mais de uma reserva no periodo, conta a reserva mais recente.",
    },
    {
        "key": "vendas_finalizadas",
        "label": "VENDAS FINALIZADAS",
        "order": 8,
        "source": "base",
        "aggregate": "distinct",
        "rule": "Entradas em repasse, usando dt_cadastro_repasse; nao usa dt_referencia_repasse.",
    },
    {
        "key": "repasse",
        "label": "REPASSE",
        "order": 9,
        "source": "base",
        "aggregate": "distinct",
        "rule": "Contratos de repasse assinados no periodo.",
    },
]

FUNIL_ETAPA_POR_CHAVE = {
    str(valor).lower(): etapa
    for etapa in FUNIL_ETAPAS
    for valor in (etapa["key"], etapa["label"])
}
FUNIL_ETAPA_POR_CHAVE["vendas"] = next(etapa for etapa in FUNIL_ETAPAS if etapa["key"] == "vendas")
FUNIL_ETAPA_POR_CHAVE["venda"] = FUNIL_ETAPA_POR_CHAVE["vendas"]

FUNIL_FILTROS_IGNORADOS = {"cidade"}

PROPOSTAS_AUDIT_STATUS_KPIS = {
    "aprovadas": "pastas_aprovadas",
    "condicionadas": "pastas_condicionadas",
    "reprovadas": "pastas_reprovadas",
    "total": "pastas_com_respostas",
}

SEGMENTED_FILTER_COLUMNS_KPI = {
    "regiaoOperacao": "empreendimento_reduzido",
    "imobiliariaOperacao": "imobiliaria",
    "corretorOperacao": "corretor",
    "sdrOperacao": "sdr",
    "origem": "origem",
    "empreendimento": "empreendimento",
    "corretorAtivo": "corretor",
    "gestorCorretor": "gerencia",
    "coordenadorCorretor": "coordenacao",
    "regiaoCorretor": "empreendimento_reduzido",
    "imobiliariaCorretor": "imobiliaria",
    "sdrAtivo": "sdr",
    "gestorSdr": "gerencia",
    "coordenadorSdr": "coordenacao",
    "regiaoSdr": "empreendimento_reduzido",
    "imobiliariaSdr": "imobiliaria",
}

SEGMENTED_FILTER_COLUMNS_BASE = {
    **SEGMENTED_FILTER_COLUMNS_KPI,
    "unidade": "unidade_nome",
}

SEGMENTED_OPERATION_FIELDS = {
    "regiaoOperacao",
    "imobiliariaOperacao",
    "corretorOperacao",
    "sdrOperacao",
    "origem",
    "empreendimento",
    "unidade",
}

SEGMENTED_CORRETOR_FIELDS = {
    "corretorAtivo",
    "gestorCorretor",
    "coordenadorCorretor",
    "regiaoCorretor",
    "imobiliariaCorretor",
}

SEGMENTED_SDR_FIELDS = {
    "sdrAtivo",
    "gestorSdr",
    "coordenadorSdr",
    "regiaoSdr",
    "imobiliariaSdr",
}

CORRETOR_FUNCIONARIO_FIELDS = {
    "corretor",
    "corretorOperacao",
    "corretorAtivo",
    "gestorCorretor",
    "coordenadorCorretor",
    "regiaoCorretor",
    "imobiliariaCorretor",
}

SDR_FUNCIONARIO_FIELDS = {
    "sdr",
    "sdrOperacao",
    "sdrAtivo",
    "gestorSdr",
    "coordenadorSdr",
    "regiaoSdr",
    "imobiliariaSdr",
}

FUNCIONARIO_PESSOA_FIELDS = CORRETOR_FUNCIONARIO_FIELDS | SDR_FUNCIONARIO_FIELDS

SEGMENTED_HIERARQUIA_FIELDS = {
    "corretorAtivo": "coalesce(nullif(trim(nome), ''), 'Sem corretor')",
    "gestorCorretor": "coalesce(nullif(trim(gestor), ''), 'Sem gerente')",
    "coordenadorCorretor": "coalesce(nullif(trim(coordenador), ''), nullif(trim(gerente), ''), 'Sem coordenador')",
    "regiaoCorretor": "coalesce(nullif(trim(regiao), ''), nullif(trim(regional), ''), 'Sem regiao')",
    "imobiliariaCorretor": "coalesce(nullif(trim(imobiliaria), ''), 'Sem imobiliaria')",
}


@dataclass(frozen=True)
class IntervaloDatas:
    inicio: date
    fim: date


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")
    return pool


def _serializar(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    if isinstance(valor, list):
        return [_serializar(item) for item in valor]
    if isinstance(valor, dict):
        return {chave: _serializar(item) for chave, item in valor.items()}
    return valor


def _linha_para_dict(linha: Any) -> dict[str, Any]:
    if not linha:
        return {}
    return _serializar(dict(linha))


def _parse_data(valor: str | None) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Formato de data invalido. Use YYYY-MM-DD.",
        ) from exc


def _intervalo_datas(request: Request) -> IntervaloDatas:
    hoje = date.today()
    inicio_padrao = hoje.replace(day=1)
    proximo_mes = (inicio_padrao.replace(day=28) + timedelta(days=4)).replace(day=1)
    fim_padrao = proximo_mes - timedelta(days=1)

    inicio = _parse_data(request.query_params.get("startDate")) or inicio_padrao
    fim = _parse_data(request.query_params.get("endDate")) or fim_padrao
    if inicio > fim:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="startDate nao pode ser maior que endDate.",
        )
    return IntervaloDatas(inicio=inicio, fim=fim)


def _intervalo_anterior(intervalo: IntervaloDatas) -> IntervaloDatas:
    dias = (intervalo.fim - intervalo.inicio).days + 1
    fim = intervalo.inicio - timedelta(days=1)
    inicio = fim - timedelta(days=dias - 1)
    return IntervaloDatas(inicio=inicio, fim=fim)


def _valores_filtro(request: Request, nome: str) -> list[str]:
    bruto = request.query_params.get(nome)
    if bruto is None:
        return []
    valores = []
    for parte in str(bruto).split(","):
        texto = parte.strip()
        if texto and texto.lower() not in IGNORAR_FILTROS:
            valores.append(texto)
    return valores


def _campo_funcionario_expr(nome: str, alias: str = "f") -> str:
    expr = {
        "corretor": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem corretor')",
        "corretorOperacao": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem corretor')",
        "corretorAtivo": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem corretor')",
        "gestorCorretor": f"coalesce(nullif(trim({alias}.gestor), ''), 'Sem gerente')",
        "coordenadorCorretor": f"coalesce(nullif(trim({alias}.coordenador), ''), nullif(trim({alias}.gerente), ''), 'Sem coordenador')",
        "regiaoCorretor": f"coalesce(nullif(trim({alias}.regiao), ''), nullif(trim({alias}.regional), ''), 'Sem regiao')",
        "imobiliariaCorretor": f"coalesce(nullif(trim({alias}.imobiliaria), ''), 'Sem equipe')",
        "sdr": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem SDR')",
        "sdrOperacao": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem SDR')",
        "sdrAtivo": f"coalesce(nullif(trim({alias}.nome), ''), 'Sem SDR')",
        "gestorSdr": f"coalesce(nullif(trim({alias}.gestor), ''), 'Sem gerente')",
        "coordenadorSdr": f"coalesce(nullif(trim({alias}.coordenador), ''), nullif(trim({alias}.gerente), ''), 'Sem coordenador')",
        "regiaoSdr": f"coalesce(nullif(trim({alias}.regiao), ''), nullif(trim({alias}.regional), ''), 'Sem regiao')",
        "imobiliariaSdr": f"coalesce(nullif(trim({alias}.imobiliaria), ''), 'Sem equipe')",
    }.get(nome)
    return expr or f"coalesce(nullif(trim({alias}.nome), ''), 'Sem funcionario')"


def _coluna_fato_pessoa(mapa_colunas: dict[str, str], pessoa: str) -> str:
    if pessoa == "sdr":
        for nome in ("sdrAtivo", "sdrOperacao", "sdr"):
            if nome in mapa_colunas:
                return mapa_colunas[nome]
        return "sdr"
    for nome in ("corretorAtivo", "corretorOperacao", "corretor"):
        if nome in mapa_colunas:
            return mapa_colunas[nome]
    return "corretor"


def _condicao_filtro_funcionario(
    nome: str,
    mapa_colunas: dict[str, str],
    indice: int | None,
    *,
    branco: bool = False,
) -> str:
    pessoa = _pessoa_funcionario_por_campo(nome) or "corretor"
    coluna_fato = _coluna_fato_pessoa(mapa_colunas, pessoa)
    fato_match = _normalizar_nome_sql(coluna_fato)
    funcionario_match = _normalizar_nome_sql("f.nome")
    campo_funcionario = _campo_funcionario_expr(nome, "f")
    base = (
        f"from {ESQUEMA_BANCO}.funcionario_acesso f "
        f"where {_condicao_funcionario_pessoa('f', pessoa)} "
        "and trim(coalesce(f.nome, '')) <> '' "
        f"and {funcionario_match} = {fato_match}"
    )
    if branco:
        return (
            f"not exists (select 1 {base}) "
            f"or exists (select 1 {base} and ({campo_funcionario} is null or btrim({campo_funcionario}) = ''))"
        )
    return f"exists (select 1 {base} and {campo_funcionario} = any(${indice}::text[]))"


def _montar_where_dimensoes(
    request: Request,
    mapa_colunas: dict[str, str],
    indice_parametro_inicial: int,
    ignorar: set[str] | None = None,
) -> tuple[str, list[Any]]:
    partes: list[str] = []
    parametros: list[Any] = []
    indice = indice_parametro_inicial
    ignorar = ignorar or set()

    for nome, coluna in mapa_colunas.items():
        if nome in ignorar:
            continue
        valores = _valores_filtro(request, nome)
        if not valores:
            continue

        tem_branco = VALOR_EM_BRANCO in valores
        valores_sem_branco = [valor for valor in valores if valor != VALOR_EM_BRANCO]
        condicoes: list[str] = []

        if nome in FUNCIONARIO_PESSOA_FIELDS or nome in SEGMENTED_CORRETOR_FIELDS or nome in SEGMENTED_SDR_FIELDS:
            if valores_sem_branco:
                condicoes.append(_condicao_filtro_funcionario(nome, mapa_colunas, indice))
                parametros.append(valores_sem_branco)
                indice += 1
            if tem_branco:
                condicoes.append(f"({_condicao_filtro_funcionario(nome, mapa_colunas, None, branco=True)})")
            if condicoes:
                partes.append("(" + " or ".join(condicoes) + ")")
            continue

        if valores_sem_branco:
            condicoes.append(f"{coluna} = any(${indice}::text[])")
            parametros.append(valores_sem_branco)
            indice += 1

        if tem_branco:
            condicoes.append(f"({coluna} is null or btrim({coluna}) = '')")

        if condicoes:
            partes.append("(" + " or ".join(condicoes) + ")")

    return (" and " + " and ".join(partes)) if partes else "", parametros


def _opcao(valor: Any) -> dict[str, str]:
    texto = str(valor or "").strip()
    return {"value": texto, "label": texto}


def _opcoes_com_todos(itens: list[dict[str, str]], valor_todos: str, rotulo_todos: str) -> list[dict[str, str]]:
    return [
        {"value": valor_todos, "label": rotulo_todos},
        {"value": VALOR_EM_BRANCO, "label": "Em branco / Nulo"},
        *itens,
    ]


def _campo_hierarquia_segmentada(campo: str) -> str | None:
    return SEGMENTED_HIERARQUIA_FIELDS.get(campo)


def _inicio_mes(valor: date) -> date:
    return valor.replace(day=1)


def _somar_meses(referencia: date, deslocamento: int) -> date:
    indice = referencia.year * 12 + (referencia.month - 1) + deslocamento
    return date(indice // 12, (indice % 12) + 1, 1)


def _valores_filtros_produtividade(
    request: Request,
    nomes: tuple[str, ...],
    rotulo_branco: str,
) -> list[str]:
    valores: list[str] = []
    vistos: set[str] = set()
    for nome in nomes:
        for valor in _valores_filtro(request, nome):
            texto = rotulo_branco if valor == VALOR_EM_BRANCO else valor.strip()
            chave = texto.lower()
            if texto and chave not in vistos:
                vistos.add(chave)
                valores.append(texto)
    return valores


def _filtros_produtividade_oficial(request: Request) -> dict[str, list[str]]:
    return {
        "hierarquia_corretores": _valores_filtros_produtividade(request, ("corretorAtivo",), "Sem corretor"),
        "hierarquia_equipes": _valores_filtros_produtividade(request, ("imobiliariaCorretor",), "Sem equipe"),
        "hierarquia_gerentes": _valores_filtros_produtividade(request, ("gestorCorretor",), "Sem gerente"),
        "hierarquia_coordenadores": _valores_filtros_produtividade(request, ("coordenadorCorretor",), "Sem coordenador"),
        "hierarquia_regioes": _valores_filtros_produtividade(request, ("regiaoCorretor",), "Sem regiao"),
        "fato_cidades": _valores_filtros_produtividade(request, ("cidade",), "Sem regiao"),
        "fato_regioes": _valores_filtros_produtividade(
            request,
            ("regiaoOperacao", "empreendimentoReduzido"),
            "Sem regiao",
        ),
        "fato_equipes": _valores_filtros_produtividade(
            request,
            ("imobiliaria", "imobiliariaOperacao"),
            "Sem equipe",
        ),
        "fato_corretores": _valores_filtros_produtividade(
            request,
            ("corretor", "corretorOperacao"),
            "Sem corretor",
        ),
        "fato_sdrs": _valores_filtros_produtividade(
            request,
            ("sdr", "sdrOperacao", "sdrAtivo"),
            "Sem SDR",
        ),
        "fato_origens": _valores_filtros_produtividade(request, ("origem",), "Sem origem"),
        "fato_empreendimentos": _valores_filtros_produtividade(
            request,
            ("empreendimento",),
            "Sem empreendimento",
        ),
    }


def _params_produtividade_oficial(intervalo: IntervaloDatas, request: Request) -> list[Any]:
    filtros = _filtros_produtividade_oficial(request)
    return [
        intervalo.inicio,
        intervalo.fim,
        filtros["hierarquia_corretores"],
        filtros["hierarquia_equipes"],
        filtros["hierarquia_gerentes"],
        filtros["hierarquia_coordenadores"],
        filtros["hierarquia_regioes"],
        filtros["fato_cidades"],
        filtros["fato_regioes"],
        filtros["fato_equipes"],
        filtros["fato_corretores"],
        filtros["fato_sdrs"],
        filtros["fato_origens"],
        filtros["fato_empreendimentos"],
    ]


def _filtros_corretor_analytics(request: Request) -> dict[str, list[str]]:
    return {
        "hierarquia_corretores": _valores_filtros_produtividade(request, ("corretorAtivo",), "Sem corretor"),
        "hierarquia_equipes": _valores_filtros_produtividade(request, ("imobiliariaCorretor",), "Sem equipe"),
        "hierarquia_gerentes": _valores_filtros_produtividade(request, ("gestorCorretor",), "Sem gerente"),
        "hierarquia_coordenadores": _valores_filtros_produtividade(request, ("coordenadorCorretor",), "Sem coordenador"),
        "hierarquia_regioes": _valores_filtros_produtividade(request, ("regiaoCorretor",), "Sem regiao"),
        "fato_cidades": _valores_filtros_produtividade(request, ("cidade",), "Sem regiao"),
        "fato_regioes": _valores_filtros_produtividade(
            request,
            ("regiaoOperacao", "empreendimentoReduzido"),
            "Sem regiao",
        ),
        "fato_equipes": _valores_filtros_produtividade(
            request,
            ("imobiliaria", "imobiliariaOperacao"),
            "Sem equipe",
        ),
        "fato_corretores": _valores_filtros_produtividade(
            request,
            ("corretor", "corretorOperacao"),
            "Sem corretor",
        ),
        "fato_sdrs": _valores_filtros_produtividade(
            request,
            ("sdr", "sdrOperacao", "sdrAtivo"),
            "Sem SDR",
        ),
        "fato_origens": _valores_filtros_produtividade(request, ("origem",), "Sem origem"),
        "fato_empreendimentos": _valores_filtros_produtividade(
            request,
            ("empreendimento",),
            "Sem empreendimento",
        ),
    }


def _params_corretor_analytics(intervalo: IntervaloDatas, request: Request) -> list[Any]:
    filtros = _filtros_corretor_analytics(request)
    return [
        intervalo.inicio,
        intervalo.fim,
        filtros["hierarquia_corretores"],
        filtros["hierarquia_equipes"],
        filtros["hierarquia_gerentes"],
        filtros["hierarquia_coordenadores"],
        filtros["hierarquia_regioes"],
        filtros["fato_cidades"],
        filtros["fato_regioes"],
        filtros["fato_equipes"],
        filtros["fato_corretores"],
        filtros["fato_sdrs"],
        filtros["fato_origens"],
        filtros["fato_empreendimentos"],
    ]


def _sql_corretor_nome_match(expressao: str) -> str:
    return (
        "regexp_replace("
        "regexp_replace("
        f"lower(trim(coalesce({expressao}, 'Sem corretor'))), "
        "'\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'"
        "), "
        "'\\s+', ' ', 'g'"
        ")"
    )


def _sql_corretor_email_norm(expressao: str) -> str:
    return f"nullif(lower(trim({expressao}::text)), '')"


def _sql_corretor_identity_funcionario(alias: str) -> str:
    return f"""
    coalesce(
        'doc:' || nullif(regexp_replace(coalesce({alias}.documento, ''), '\\D', '', 'g'), ''),
        'email:' || nullif(lower(trim({alias}.email::text)), ''),
        'func:' || nullif(trim({alias}.identificador_funcionario::text), ''),
        'nome:' || {_sql_corretor_nome_match(f"{alias}.nome")}
    )
    """


def _sql_corretor_identity_fato_com_dim(alias: str = "b", dim_alias: str = "dc") -> str:
    return f"""
    coalesce(
        'email:' || nullif(lower(trim({dim_alias}.email_norm::text)), ''),
        'id:' || nullif(coalesce({alias}.idcorretor_canonico, {alias}.idcorretor_atual)::text, ''),
        'nome:' || {_sql_corretor_nome_match(f"coalesce(nullif(trim({alias}.corretor_nome_canonico), ''), nullif(trim({alias}.corretor_nome), ''))")}
    )
    """


def _sql_corretor_identity_fato(alias: str = "b") -> str:
    return f"""
    coalesce(
        'id:' || nullif(coalesce({alias}.idcorretor_canonico, {alias}.idcorretor_atual)::text, ''),
        'nome:' || {_sql_corretor_nome_match(f"coalesce(nullif(trim({alias}.corretor_nome_canonico), ''), nullif(trim({alias}.corretor_nome), ''))")}
    )
    """


def _sql_funcionarios_comerciais_vigentes() -> str:
    nome_hierarquia = _sql_corretor_nome_match("h.corretor")
    identidade_funcionario = _sql_corretor_identity_funcionario("f")
    return f"""
    meses as (
        select generate_series(
            (select mes_inicio from periodo),
            (select mes_fim from periodo),
            interval '1 month'
        )::date as mes_referencia
    ),
    hierarquia_manual_base as (
        select
            m.mes_referencia,
            coalesce(nullif(trim(h.coordenador), ''), 'Sem coordenador') as coordenador,
            coalesce(nullif(trim(h.gerente), ''), 'Sem gerente') as gerente,
            coalesce(nullif(trim(h.equipe), ''), 'Sem equipe') as equipe,
            coalesce(nullif(trim(h.corretor), ''), 'Sem corretor') as corretor,
            coalesce(nullif(trim(h.regiao), ''), 'Sem regiao') as regiao,
            coalesce(
                nullif(trim(h.corretor_key), ''),
                regexp_replace(regexp_replace(lower(trim(h.corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
            ) as corretor_hierarquia_key,
            'nome:' || {nome_hierarquia} as corretor_identity_key,
            null::text as identificador_funcionario,
            null::text as documento,
            null::text as email,
            coalesce(nullif(trim(h.tipo), ''), 'CORRETOR') as tipo_funcionario,
            case when h.ativo_no_mes then 'true' else 'false' end as ativo_cadastro,
            'true'::text as ativo_negocio_cadastro,
            concat(
                coalesce(
                    nullif(trim(h.corretor_key), ''),
                    regexp_replace(regexp_replace(lower(trim(h.corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
                ),
                '_',
                coalesce(nullif(trim(h.equipe_key), ''), lower(trim(coalesce(h.equipe, 'Sem equipe')))),
                '_',
                to_char(m.mes_referencia, 'YYYYMM')
            ) as corretor_ativo_mes_key,
            'true'::text as ativo_negocio,
            case when h.ativo_no_mes then 'true' else 'false' end as ativo,
            'true'::text as ativo_login,
            m.mes_referencia as data_inicio_vigencia_data,
            (m.mes_referencia + interval '1 month' - interval '1 day')::date as data_fim_vigencia_data
        from meses m
        join {ESQUEMA_COMERCIAL}.dashboard_gc_produtividade_historico_corretor_equipe h
          on h.mes_referencia = m.mes_referencia
         and h.ativo_no_mes is true
        where trim(coalesce(h.corretor, '')) <> ''
    ),
    meses_com_historico_manual as (
        select distinct mes_referencia
          from hierarquia_manual_base
    ),
    hierarquia_funcionario_base as (
        select
            m.mes_referencia,
            coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador') as coordenador,
            coalesce(nullif(trim(f.gestor), ''), 'Sem gerente') as gerente,
            coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe') as equipe,
            coalesce(nullif(trim(f.nome), ''), 'Sem corretor') as corretor,
            coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao') as regiao,
            coalesce(
                nullif(trim(f.documento), ''),
                nullif(lower(trim(f.email::text)), ''),
                f.identificador_funcionario::text,
                regexp_replace(regexp_replace(lower(trim(f.nome)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
            ) as corretor_hierarquia_key,
            {identidade_funcionario} as corretor_identity_key,
            f.identificador_funcionario::text as identificador_funcionario,
            nullif(trim(f.documento), '') as documento,
            nullif(lower(trim(f.email::text)), '') as email,
            coalesce(nullif(trim(f.tipo_funcionario), ''), nullif(trim(f.cargo), ''), 'Sem cargo') as tipo_funcionario,
            f.ativo::text as ativo_cadastro,
            f.ativo_negocio::text as ativo_negocio_cadastro,
            concat(
                coalesce(
                    nullif(trim(f.documento), ''),
                    nullif(lower(trim(f.email::text)), ''),
                    f.identificador_funcionario::text,
                    regexp_replace(regexp_replace(lower(trim(f.nome)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
                ),
                '_',
                coalesce(f.identificador_equipe_vigencia::text, lower(trim(coalesce(f.imobiliaria, 'Sem equipe')))),
                '_',
                to_char(m.mes_referencia, 'YYYYMM')
            ) as corretor_ativo_mes_key,
            f.ativo_negocio::text as ativo_negocio,
            f.ativo::text as ativo,
            f.ativo_login::text as ativo_login,
            f.data_inicio_vigencia::date as data_inicio_vigencia_data,
            f.data_fim_vigencia::date as data_fim_vigencia_data
        from meses m
        join {ESQUEMA_BANCO}.funcionario_acesso f
          on upper(trim(coalesce(f.tipo_funcionario, ''))) in ('CORRETOR', 'SDR')
         and coalesce(f.ativo_negocio, true) is true
         and (coalesce(f.ativo, false) is true or coalesce(f.ativo_login, false) is true)
         and (f.data_inicio_vigencia is null or f.data_inicio_vigencia < (m.mes_referencia + interval '1 month')::date)
         and (f.data_fim_vigencia is null or f.data_fim_vigencia >= m.mes_referencia)
        where trim(coalesce(f.nome, '')) <> ''
    ),
    hierarquia_base as (
        select * from hierarquia_manual_base
        union all
        select hf.*
          from hierarquia_funcionario_base hf
         where not exists (
            select 1
              from meses_com_historico_manual mm
             where mm.mes_referencia = hf.mes_referencia
         )
    ),
    hierarquia_ativa as (
        select
            *,
            {_sql_corretor_nome_match("corretor")} as corretor_match,
            lower(trim(equipe)) as equipe_match,
            concat_ws(
                '|',
                coalesce(nullif(trim(coordenador), ''), 'Sem coordenador'),
                coalesce(nullif(trim(gerente), ''), 'Sem gerente'),
                coalesce(nullif(trim(equipe), ''), 'Sem equipe'),
                coalesce(nullif(trim(corretor_identity_key), ''), nullif(trim(corretor_hierarquia_key), ''), {_sql_corretor_nome_match("corretor")}, 'Sem corretor')
            ) as produtivo_key,
            concat_ws(
                '|',
                coalesce(nullif(trim(coordenador), ''), 'Sem coordenador'),
                coalesce(nullif(trim(gerente), ''), 'Sem gerente'),
                coalesce(nullif(trim(equipe), ''), 'Sem equipe'),
                coalesce(nullif(trim(corretor_ativo_mes_key), ''), nullif(trim(corretor_identity_key), ''), nullif(trim(corretor_hierarquia_key), ''), {_sql_corretor_nome_match("corretor")}, 'Sem corretor')
            ) as produtivo_mes_key
        from hierarquia_base
        where (data_inicio_vigencia_data is null or data_inicio_vigencia_data < (mes_referencia + interval '1 month')::date)
          and (data_fim_vigencia_data is null or data_fim_vigencia_data >= mes_referencia)
          and (
            cardinality($3::text[]) = 0
            or {_sql_corretor_nome_match("corretor")} in (
                select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                  from unnest($3::text[]) as filtro(valor)
            )
          )
          and (cardinality($4::text[]) = 0 or equipe = any($4::text[]))
          and (cardinality($5::text[]) = 0 or gerente = any($5::text[]))
          and (cardinality($6::text[]) = 0 or coordenador = any($6::text[]))
          and (cardinality($7::text[]) = 0 or regiao = any($7::text[]))
    )
    """


def _sql_corretor_analytics_base() -> str:
    nome_funcionario = _sql_corretor_nome_match("f.nome")
    identidade_funcionario = _sql_corretor_identity_funcionario("f")
    nome_kpi = _sql_corretor_nome_match("corretor")
    nome_base = _sql_corretor_nome_match("coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''))")
    identidade_base = _sql_corretor_identity_fato_com_dim("b", "dc")
    return f"""
    with periodo as (
        select
            $1::date as inicio,
            $2::date as fim,
            date_trunc('month', $1::date)::date as mes_inicio,
            date_trunc('month', $2::date)::date as mes_fim,
            ($2::date + interval '1 day')::date as fim_exclusivo
    ),
    {_sql_funcionarios_comerciais_vigentes()},
    funcionarios_vinculo as (
        select distinct on (corretor_identity_key)
            concat_ws(
                '|',
                coalesce(nullif(trim(f.identificador_funcionario::text), ''), nullif(regexp_replace(coalesce(f.documento, ''), '\\D', '', 'g'), ''), nullif(lower(trim(f.email::text)), ''), {nome_funcionario}),
                coalesce(f.identificador_equipe_vigencia::text, lower(trim(coalesce(f.imobiliaria, 'Sem equipe'))), 'Sem equipe')
            ) as produtivo_key,
            {identidade_funcionario} as corretor_identity_key,
            {nome_funcionario} as corretor_match,
            lower(trim(coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe'))) as equipe_match,
            coalesce(nullif(trim(f.nome), ''), 'Sem corretor') as corretor,
            f.identificador_funcionario::text as identificador_funcionario,
            nullif(trim(f.documento), '') as documento,
            nullif(lower(trim(f.email::text)), '') as email,
            {_sql_corretor_email_norm("f.email")} as email_norm,
            coalesce(nullif(trim(f.tipo_funcionario), ''), nullif(trim(f.cargo), ''), 'Sem cargo') as tipo_funcionario,
            nullif(trim(f.tipo_vinculo), '') as tipo_vinculo,
            f.ativo::text as ativo,
            f.ativo_negocio::text as ativo_negocio,
            f.ativo_login::text as ativo_login,
            f.data_inicio_vigencia::date as data_inicio_vigencia,
            f.data_fim_vigencia::date as data_fim_vigencia,
            coalesce(nullif(trim(f.gestor), ''), 'Sem gerente') as gerente,
            coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador') as coordenador,
            coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao') as regiao,
            coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe') as equipe
        from {ESQUEMA_BANCO}.funcionario_acesso f
        where {_condicao_funcionario_pessoa("f", "corretor")}
          and trim(coalesce(f.nome, '')) <> ''
          and (
            cardinality($3::text[]) = 0
            or regexp_replace(regexp_replace(lower(trim(f.nome)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                  from unnest($3::text[]) as filtro(valor)
            )
          )
          and (cardinality($4::text[]) = 0 or coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe') = any($4::text[]))
          and (cardinality($5::text[]) = 0 or coalesce(nullif(trim(f.gestor), ''), 'Sem gerente') = any($5::text[]))
          and (cardinality($6::text[]) = 0 or coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador') = any($6::text[]))
          and (cardinality($7::text[]) = 0 or coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao') = any($7::text[]))
        order by
            corretor_identity_key,
            coalesce(f.ativo, false) desc,
            coalesce(f.ativo_negocio, false) desc,
            coalesce(f.ativo_login, false) desc,
            f.data_fim_vigencia desc nulls first,
            f.data_inicio_vigencia desc nulls last,
            f.data_hora_atualizado_em desc nulls last
    ),
    funcionarios_por_email as (
        select distinct on (email_norm)
            *
        from funcionarios_vinculo
        where email_norm is not null
        order by
            email_norm,
            coalesce(ativo = 'true', false) desc,
            coalesce(ativo_negocio = 'true', false) desc,
            coalesce(ativo_login = 'true', false) desc,
            data_fim_vigencia desc nulls first,
            data_inicio_vigencia desc nulls last
    ),
    funcionarios_por_nome as (
        select distinct on (corretor_match)
            *
        from funcionarios_vinculo
        order by
            corretor_match,
            coalesce(ativo = 'true', false) desc,
            coalesce(ativo_negocio = 'true', false) desc,
            coalesce(ativo_login = 'true', false) desc,
            data_fim_vigencia desc nulls first,
            data_inicio_vigencia desc nulls last
    ),
    dim_corretor_ref as (
        select distinct on (idcorretor_text)
            idcorretor_text,
            email_norm,
            corretor_match,
            corretor_nome
        from (
            select
                nullif(trim(idcorretor::text), '') as idcorretor_text,
                {_sql_corretor_email_norm("email")} as email_norm,
                {_sql_corretor_nome_match("nome_corretor")} as corretor_match,
                coalesce(nullif(trim(nome_corretor), ''), nullif(trim(apelido), ''), nullif(trim(idcorretor::text), ''), 'Sem corretor') as corretor_nome
            from {ESQUEMA_COMERCIAL}.dim_corretor
            where nullif(trim(idcorretor::text), '') is not null
        ) dc_base
        order by
            idcorretor_text,
            case when email_norm is not null then 1 else 2 end,
            corretor_nome
    ),
    fato_identity_refs as (
        select distinct on (fato_identity_key)
            fato_identity_key,
            corretor_match,
            corretor_nome,
            idcorretor_text,
            dim_email_norm,
            origem_identity
        from (
            select
                {identidade_base} as fato_identity_key,
                {nome_base} as corretor_match,
                coalesce(nullif(trim(dc.corretor_nome), ''), nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor') as corretor_nome,
                nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual)::text, '') as idcorretor_text,
                dc.email_norm as dim_email_norm,
                case
                    when fve.corretor_identity_key is not null then 'dim_corretor_email_funcionario'
                    when dc.email_norm is not null then 'dim_corretor_email'
                    when nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual)::text, '') is not null then 'idcorretor_fato'
                    else 'nome_fato'
                end as origem_identity,
                coalesce(
                    b.dt_ultima_conversao_lead,
                    b.dim_lead_dt_visita,
                    b.dt_visita_realizada,
                    b.dt_resposta_analise_precadastro,
                    b.dt_cadastro_reserva,
                    b.dt_contrato_contabilizado,
                    b.data_venda,
                    b.dt_venda_finalizada,
                    b.dt_assinatura_contrato,
                    b.dt_cancelamento_reserva
                ) as data_referencia
            from {ESQUEMA_COMERCIAL}.comercial_base b
            left join dim_corretor_ref dc
              on dc.idcorretor_text = nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual)::text, '')
            left join funcionarios_por_email fve
              on fve.email_norm = dc.email_norm
            where (
                b.dt_ultima_conversao_lead >= (select inicio from periodo) and b.dt_ultima_conversao_lead < (select fim_exclusivo from periodo)
                or b.dim_lead_dt_visita >= (select inicio from periodo) and b.dim_lead_dt_visita < (select fim_exclusivo from periodo)
                or b.dt_visita_realizada >= (select inicio from periodo) and b.dt_visita_realizada < (select fim_exclusivo from periodo)
                or b.dt_resposta_analise_precadastro >= (select inicio from periodo) and b.dt_resposta_analise_precadastro < (select fim_exclusivo from periodo)
                or b.dt_contrato_contabilizado >= (select inicio from periodo) and b.dt_contrato_contabilizado < (select fim_exclusivo from periodo)
                or b.data_venda >= (select inicio from periodo) and b.data_venda < (select fim_exclusivo from periodo)
                or b.dt_venda_finalizada >= (select inicio from periodo) and b.dt_venda_finalizada < (select fim_exclusivo from periodo)
                or b.dt_assinatura_contrato >= (select inicio from periodo) and b.dt_assinatura_contrato < (select fim_exclusivo from periodo)
                or b.dt_cancelamento_reserva >= (select inicio from periodo) and b.dt_cancelamento_reserva < (select fim_exclusivo from periodo)
            )
              and trim(coalesce(b.corretor_nome_canonico, b.corretor_nome, '')) <> ''
        ) refs
        order by fato_identity_key, data_referencia desc nulls last, corretor_nome
    ),
    fato_identity_bridge as (
        select distinct on (corretor_match)
            fir.corretor_match,
            coalesce(fve.corretor_identity_key, fvn.corretor_identity_key, fir.fato_identity_key, 'nome:' || fir.corretor_match) as corretor_identity_key,
            case
                when fve.corretor_identity_key is not null then 'dim_corretor_email_funcionario'
                when fvn.corretor_identity_key is not null then 'funcionario_por_nome'
                else fir.origem_identity
            end as origem_identity
        from fato_identity_refs fir
        left join funcionarios_por_email fve
          on fve.email_norm = fir.dim_email_norm
        left join funcionarios_por_nome fvn
          on fvn.corretor_match = fir.corretor_match
        order by
            fir.corretor_match,
            case
                when fve.corretor_identity_key is not null then 1
                when fir.dim_email_norm is not null then 2
                when fvn.corretor_identity_key is not null then 3
                when fir.fato_identity_key like 'id:%' then 4
                else 5
            end,
            fir.fato_identity_key
    ),
    kpi_diarios as (
        select
            data::date as data,
            date_trunc('month', data)::date as mes_referencia,
            coalesce(nullif(trim(corretor), ''), 'Sem corretor') as corretor,
            coalesce(fib.corretor_identity_key, 'nome:' || {nome_kpi}) as corretor_identity_key,
            {nome_kpi} as corretor_match,
            coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe') as equipe,
            lower(trim(coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe'))) as equipe_match,
            coalesce(nullif(trim(empreendimento), ''), 'Sem empreendimento') as empreendimento,
            sum(coalesce(leads, 0))::numeric as leads,
            0::numeric as agendamentos,
            sum(coalesce(visitas, 0))::numeric as visitas,
            sum(coalesce(propostas_total, 0))::numeric as propostas,
            sum(coalesce(propostas_aprovadas, 0))::numeric as propostas_aprovadas,
            sum(coalesce(propostas_condicionadas, 0))::numeric as propostas_condicionadas,
            sum(coalesce(propostas_reprovadas, 0))::numeric as propostas_reprovadas,
            sum(coalesce(vendas, 0))::numeric as vendas,
            sum(coalesce(repasses, 0))::numeric as repasses,
            sum(coalesce(cancelamentos, 0))::numeric as cancelamentos,
            sum(coalesce(distratos, 0))::numeric as distratos
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
        left join fato_identity_bridge fib
          on fib.corretor_match = {nome_kpi}
        where data >= (select inicio from periodo)
          and data < (select fim_exclusivo from periodo)
          and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(cidade), ''), 'Sem regiao') = any($8::text[]))
          and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(empreendimento_reduzido), ''), 'Sem regiao') = any($9::text[]))
          and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe') = any($10::text[]))
          and (
            cardinality($11::text[]) = 0
            or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g') in (
                select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
                  from unnest($11::text[]) as filtro(valor)
            )
          )
          and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(sdr), ''), 'Sem SDR') = any($12::text[]))
          and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(origem), ''), 'Sem origem') = any($13::text[]))
          and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(empreendimento), ''), 'Sem empreendimento') = any($14::text[]))
        group by 1, 2, 3, 4, 5, 6, 7, 8
    ),
    agendamentos_diarios as (
        select
            ag.data,
            ag.mes_referencia,
            ag.corretor,
            ag.corretor_identity_key,
            ag.corretor_match,
            ag.equipe,
            ag.equipe_match,
            ag.empreendimento,
            0::numeric as leads,
            count(*)::numeric as agendamentos,
            0::numeric as visitas,
            0::numeric as propostas,
            0::numeric as propostas_aprovadas,
            0::numeric as propostas_condicionadas,
            0::numeric as propostas_reprovadas,
            0::numeric as vendas,
            0::numeric as repasses,
            0::numeric as cancelamentos,
            0::numeric as distratos
        from (
            select distinct on (
                lh.dt_referencia,
                lh.idlead,
                coalesce(fve.corretor_identity_key, 'id:' || nullif(lh.idcorretor_atual::text, ''), 'nome:' || coalesce(dc.corretor_match, {nome_base}))
            )
                lh.dt_referencia::date as data,
                date_trunc('month', lh.dt_referencia)::date as mes_referencia,
                coalesce(fve.corretor, dc.corretor_nome, nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor') as corretor,
                coalesce(fve.corretor_identity_key, 'id:' || nullif(lh.idcorretor_atual::text, ''), 'nome:' || coalesce(dc.corretor_match, {nome_base})) as corretor_identity_key,
                coalesce(dc.corretor_match, {nome_base}) as corretor_match,
                coalesce(nullif(trim(fve.equipe), ''), nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''), 'Sem equipe') as equipe,
                lower(trim(coalesce(nullif(trim(fve.equipe), ''), nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''), 'Sem equipe'))) as equipe_match,
                coalesce(nullif(trim(b.empreendimento_nome), ''), 'Sem empreendimento') as empreendimento,
                lh.historico_status_key
            from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
            left join dim_corretor_ref dc
              on dc.idcorretor_text = nullif(lh.idcorretor_atual::text, '')
            left join funcionarios_por_email fve
              on fve.email_norm = dc.email_norm
            left join lateral (
                select b.*
                from {ESQUEMA_COMERCIAL}.comercial_base b
                where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                   or (lh.idlead is not null and b.idlead = lh.idlead)
                order by
                    case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                    b.dt_ultima_conversao_lead desc nulls last,
                    b.fato_jornada_comercial_key
                limit 1
            ) b on true
            where lh.dt_referencia >= (select inicio from periodo)
              and lh.dt_referencia < (select fim_exclusivo from periodo)
              and lh.idlead is not null
              and lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
              and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(b.lead_cidade), ''), 'Sem regiao') = any($8::text[]))
              and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(b.regiao_empreendimento), ''), 'Sem regiao') = any($9::text[]))
              and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(fve.equipe), ''), nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''), 'Sem equipe') = any($10::text[]))
              and (
                cardinality($11::text[]) = 0
                or coalesce(dc.corretor_match, {nome_base}) in (
                    select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')
                      from unnest($11::text[]) as filtro(valor)
                )
              )
              and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(b.sdr_nome), ''), 'Sem SDR') = any($12::text[]))
              and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(b.lead_origem_nome), ''), 'Sem origem') = any($13::text[]))
              and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(b.empreendimento_nome), ''), 'Sem empreendimento') = any($14::text[]))
            order by
                lh.dt_referencia,
                lh.idlead,
                coalesce(fve.corretor_identity_key, 'id:' || nullif(lh.idcorretor_atual::text, ''), 'nome:' || coalesce(dc.corretor_match, {nome_base})),
                lh.historico_status_key
        ) ag
        group by 1, 2, 3, 4, 5, 6, 7, 8
    ),
    fatos_diarios as (
        select
            data,
            mes_referencia,
            (array_agg(corretor order by corretor))[1] as corretor,
            corretor_identity_key,
            corretor_match,
            (array_agg(equipe order by equipe))[1] as equipe,
            equipe_match,
            empreendimento,
            coalesce(sum(leads), 0)::numeric as leads,
            coalesce(sum(agendamentos), 0)::numeric as agendamentos,
            coalesce(sum(visitas), 0)::numeric as visitas,
            coalesce(sum(propostas), 0)::numeric as propostas,
            coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
            coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
            coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
            coalesce(sum(vendas), 0)::numeric as vendas,
            coalesce(sum(repasses), 0)::numeric as repasses,
            coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
            coalesce(sum(distratos), 0)::numeric as distratos
        from (
            select * from kpi_diarios
            union all
            select * from agendamentos_diarios
        ) eventos_diarios
        group by data, mes_referencia, corretor_identity_key, corretor_match, equipe_match, empreendimento
    )
    """


def _sql_produtividade_oficial() -> str:
    return f"""
    with periodo as (
        select
            $1::date as inicio,
            $2::date as fim,
            date_trunc('month', $1::date)::date as mes_inicio,
            date_trunc('month', $2::date)::date as mes_fim,
            ($2::date + interval '1 day')::date as fim_exclusivo
    ),
    {_sql_funcionarios_comerciais_vigentes()},
    denominadores_mensais as (
        select
            mes_referencia,
            count(
                distinct coalesce(
                    nullif(trim(corretor_identity_key), ''),
                    nullif(trim(corretor_hierarquia_key), ''),
                    {_sql_corretor_nome_match("corretor")},
                    'Sem corretor'
                )
            )::numeric as corretores_ativos,
            count(distinct coalesce(nullif(trim(equipe), ''), 'Sem equipe'))::numeric as equipes_ativas
        from hierarquia_ativa
        group by mes_referencia
    ),
    repasses_fato_brutos as (
        select
            k.data::date as data,
            date_trunc('month', k.data)::date as mes_referencia,
            coalesce(nullif(trim(k.corretor), ''), 'Sem corretor') as corretor,
            regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') as corretor_match,
            coalesce(nullif(trim(k.imobiliaria), ''), 'Sem equipe') as equipe,
            coalesce(nullif(trim(k.cidade), ''), 'Sem regiao') as regiao,
            coalesce(nullif(trim(k.origem), ''), 'Sem origem') as origem,
            coalesce(nullif(trim(k.empreendimento), ''), 'Sem empreendimento') as empreendimento,
            coalesce(nullif(trim(k.sdr), ''), 'Sem SDR') as sdr,
            sum(coalesce(k.repasses, 0))::numeric as repasses
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily k
        where k.data >= (select inicio from periodo)
          and k.data < (select fim_exclusivo from periodo)
          and (
            cardinality($11::text[]) = 0
            or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                  from unnest($11::text[]) as filtro(valor)
            )
          )
          and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(k.cidade), ''), 'Sem regiao') = any($8::text[]))
          and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(k.empreendimento_reduzido), ''), 'Sem regiao') = any($9::text[]))
          and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(k.imobiliaria), ''), 'Sem equipe') = any($10::text[]))
          and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(k.sdr), ''), 'Sem SDR') = any($12::text[]))
          and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(k.origem), ''), 'Sem origem') = any($13::text[]))
          and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(k.empreendimento), ''), 'Sem empreendimento') = any($14::text[]))
        group by 1, 2, 3, 4, 5, 6, 7, 8, 9
    ),
    hierarquia_match_mes as (
        select distinct mes_referencia, corretor_match
          from hierarquia_ativa
    ),
    repasses_oficiais as (
        select
            r.data,
            r.mes_referencia,
            r.corretor,
            r.equipe,
            r.regiao,
            r.origem,
            r.empreendimento,
            r.sdr,
            r.repasses,
            (hm.corretor_match is not null) as ativo_na_hierarquia
        from repasses_fato_brutos r
        left join hierarquia_match_mes hm
          on hm.mes_referencia = r.mes_referencia
         and hm.corretor_match = r.corretor_match
    )
    """


async def _buscar_produtividade_oficial_resumo(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        f"""
        {_sql_produtividade_oficial()}
        select
            coalesce((select sum(repasses) from repasses_fato_brutos), 0)::numeric as repasses_fato_total,
            coalesce((select sum(repasses) from repasses_oficiais where ativo_na_hierarquia), 0)::numeric as repasses_elegiveis,
            coalesce((select sum(corretores_ativos) from denominadores_mensais), 0)::numeric as corretores_ativos,
            coalesce((select sum(equipes_ativas) from denominadores_mensais), 0)::numeric as equipes_ativas,
            coalesce((select count(distinct produtivo_key) from hierarquia_ativa), 0)::numeric as meta_operacional,
            coalesce(
                (
                    select count(distinct corretor_match)
                    from repasses_fato_brutos
                    where coalesce(repasses, 0) <> 0
                ),
                0
            )::numeric as performance_real,
            coalesce((select count(*) from repasses_fato_brutos), 0)::numeric as volume_total_eventos
        """,
        *_params_produtividade_oficial(intervalo, request),
    )
    dados = _linha_para_dict(linha)
    repasses = float(dados.get("repasses_fato_total") or 0)
    repasses_elegiveis = float(dados.get("repasses_elegiveis") or 0)
    corretores = float(dados.get("corretores_ativos") or 0)
    equipes = float(dados.get("equipes_ativas") or 0)
    meta_operacional = float(dados.get("meta_operacional") or 0)
    performance_real = float(dados.get("performance_real") or 0)
    volume_total_eventos = float(dados.get("volume_total_eventos") or 0)
    return {
        "repasses": repasses,
        "repasses_fato_total": repasses,
        "repasses_elegiveis": repasses_elegiveis,
        "repasses_excluidos_nao_elegiveis": repasses - repasses_elegiveis,
        "corretores_ativos": corretores,
        "equipes_ativas": equipes,
        "meta_operacional": meta_operacional,
        "performance_real": performance_real,
        "volume_total_eventos": volume_total_eventos,
        "ipc_corretor": repasses / corretores if corretores else 0,
        "ipc_imobiliaria": repasses / equipes if equipes else 0,
    }


async def _buscar_produtividade_oficial_tendencias(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
) -> dict[str, dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        {_sql_produtividade_oficial()}
        select
            dias.data::date as data,
            coalesce(sum(ro.repasses), 0)::numeric as repasses,
            coalesce(max(dm.corretores_ativos), 0)::numeric as ipc_corretores_ativos,
            coalesce(max(dm.equipes_ativas), 0)::numeric as ipc_imobiliarias_ativas
        from generate_series($1::date, $2::date, interval '1 day') dias(data)
        left join repasses_fato_brutos ro
          on ro.data = dias.data::date
        left join denominadores_mensais dm
          on dm.mes_referencia = date_trunc('month', dias.data)::date
        group by dias.data
        order by dias.data
        """,
        *_params_produtividade_oficial(intervalo, request),
    )
    resultado: dict[str, dict[str, Any]] = {}
    for linha in linhas:
        item = _linha_para_dict(linha)
        repasses = float(item.get("repasses") or 0)
        corretores = float(item.get("ipc_corretores_ativos") or 0)
        equipes = float(item.get("ipc_imobiliarias_ativas") or 0)
        item["ipc_corretor"] = repasses / corretores if corretores else 0
        item["ipc_imobiliaria"] = repasses / equipes if equipes else 0
        resultado[str(item["data"])] = item
    return resultado


async def _buscar_produtividade_oficial_rankings(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int = 20,
) -> dict[str, list[dict[str, Any]]]:
    linhas_corretor = await conexao.fetch(
        f"""
        {_sql_produtividade_oficial()}
        select
            ha.corretor as label,
            coalesce(sum(ro.repasses), 0)::numeric as value,
            coalesce(sum(ro.repasses), 0)::numeric as repasses,
            count(distinct ha.mes_referencia)::numeric as base,
            count(distinct ha.mes_referencia)::numeric as meses_ativos,
            case when count(distinct ha.mes_referencia) > 0
                 then coalesce(sum(ro.repasses), 0)::numeric / count(distinct ha.mes_referencia)::numeric
                 else 0 end as ipc
        from hierarquia_ativa ha
        left join repasses_oficiais ro
          on ro.mes_referencia = ha.mes_referencia
         and regexp_replace(regexp_replace(lower(trim(ro.corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g') = ha.corretor_match
        group by ha.corretor
        order by ipc desc, repasses desc, label asc
        limit $15
        """,
        *_params_produtividade_oficial(intervalo, request),
        limit,
    )
    linhas_equipe = await conexao.fetch(
        f"""
        {_sql_produtividade_oficial()}
        select
            ha.equipe as label,
            coalesce(sum(ro.repasses), 0)::numeric as value,
            coalesce(sum(ro.repasses), 0)::numeric as repasses,
            count(distinct concat_ws('|', ha.mes_referencia::text, ha.equipe))::numeric as base,
            count(distinct concat_ws('|', ha.mes_referencia::text, ha.equipe))::numeric as meses_ativos,
            case when count(distinct concat_ws('|', ha.mes_referencia::text, ha.equipe)) > 0
                 then coalesce(sum(ro.repasses), 0)::numeric / count(distinct concat_ws('|', ha.mes_referencia::text, ha.equipe))::numeric
                 else 0 end as ipc
        from hierarquia_ativa ha
        left join repasses_oficiais ro
          on ro.mes_referencia = ha.mes_referencia
         and lower(trim(ro.equipe)) = lower(trim(ha.equipe))
         and regexp_replace(regexp_replace(lower(trim(ro.corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g') = ha.corretor_match
        group by ha.equipe
        order by ipc desc, repasses desc, label asc
        limit $15
        """,
        *_params_produtividade_oficial(intervalo, request),
        limit,
    )
    return {
        "corretores": [_linha_para_dict(linha) for linha in linhas_corretor],
        "imobiliarias": [_linha_para_dict(linha) for linha in linhas_equipe],
    }


async def _mes_hierarquia_produtividade(conexao, intervalo: IntervaloDatas) -> date | None:
    return _inicio_mes(intervalo.fim)


async def _buscar_opcoes_kpi_segmentadas(
    conexao,
    campo: str,
    coluna: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, str]]:
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        SEGMENTED_FILTER_COLUMNS_KPI,
        3,
        ignorar={campo, "unidade"},
    )
    linhas = await conexao.fetch(
        f"""
        select distinct {coluna} as valor
          from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
         where data >= $1::date
           and data <= $2::date
           and {coluna} is not null
           and btrim({coluna}) <> ''
           {where_filtros}
         order by {coluna}
         limit ${3 + len(parametros_filtros)}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
        limit,
    )
    return [_opcao(linha["valor"]) for linha in linhas]


async def _buscar_opcoes_unidade_segmentadas(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, str]]:
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        FILTROS_BASE,
        3,
        ignorar={"unidade"},
    )
    linhas = await conexao.fetch(
        f"""
        select distinct unidade_nome as valor
          from {ESQUEMA_COMERCIAL}.comercial_base
         where coalesce(dt_ultima_conversao_lead, dt_visita_realizada, dt_cadastro_reserva, data_venda, dt_venda_finalizada)::date >= $1::date
           and coalesce(dt_ultima_conversao_lead, dt_visita_realizada, dt_cadastro_reserva, data_venda, dt_venda_finalizada)::date <= $2::date
           and unidade_nome is not null
           and btrim(unidade_nome) <> ''
           {where_filtros}
         order by unidade_nome
         limit ${3 + len(parametros_filtros)}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
        limit,
    )
    return [_opcao(linha["valor"]) for linha in linhas]


async def _buscar_opcoes_hierarquia_segmentadas(
    conexao,
    campo: str,
    intervalo: IntervaloDatas,
    limit: int,
) -> list[dict[str, str]]:
    expr = {
        "corretorAtivo": "coalesce(nullif(trim(f.nome), ''), 'Sem corretor')",
        "gestorCorretor": "coalesce(nullif(trim(f.gestor), ''), 'Sem gerente')",
        "coordenadorCorretor": "coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador')",
        "regiaoCorretor": "coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao')",
        "imobiliariaCorretor": "coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe')",
    }.get(campo)
    if not expr:
        return []
    mes = await _mes_hierarquia_produtividade(conexao, intervalo)
    if mes is None:
        return []
    linhas = await conexao.fetch(
        f"""
        select distinct {expr} as valor
         from {ESQUEMA_BANCO}.funcionario_acesso f
         where upper(trim(coalesce(f.tipo_funcionario, ''))) in ('CORRETOR', 'SDR')
           and (
                (
                    (f.data_inicio_vigencia is not null or f.data_fim_vigencia is not null)
                    and (f.data_inicio_vigencia is null or f.data_inicio_vigencia < ($1::date + interval '1 month')::date)
                    and (f.data_fim_vigencia is null or f.data_fim_vigencia >= $1::date)
                )
                or (
                    f.data_inicio_vigencia is null
                    and f.data_fim_vigencia is null
                    and coalesce(f.ativo, true) is true
                    and coalesce(f.ativo_negocio, true) is true
                    and coalesce(f.ativo_login, true) is true
                    and (
                        f.observacao is null
                        or f.observacao !~* 'status\\s*cv\\s*:'
                        or f.observacao ~* 'status\\s*cv\\s*:\\s*(ativo|active)(\\s|$|\\|)'
                    )
                )
           )
           and trim(coalesce(f.nome, '')) <> ''
         order by 1
         limit $2
        """,
        mes,
        limit,
    )
    return [_opcao(linha["valor"]) for linha in linhas if str(linha["valor"] or "").strip()]


async def _buscar_opcoes_hierarquia_oficial_segmentadas(
    conexao,
    campo: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, str]]:
    campo_expr = {
        "corretorAtivo": "corretor",
        "gestorCorretor": "gerente",
        "coordenadorCorretor": "coordenador",
        "regiaoCorretor": "regiao",
        "imobiliariaCorretor": "equipe",
    }.get(campo)
    if not campo_expr:
        return []
    filtros_request = _filtros_produtividade_oficial(request)
    filtros = {
        "hierarquia_corretores": [] if campo == "corretorAtivo" else filtros_request["hierarquia_corretores"],
        "hierarquia_equipes": [] if campo == "imobiliariaCorretor" else filtros_request["hierarquia_equipes"],
        "hierarquia_gerentes": [] if campo == "gestorCorretor" else filtros_request["hierarquia_gerentes"],
        "hierarquia_coordenadores": [] if campo == "coordenadorCorretor" else filtros_request["hierarquia_coordenadores"],
        "hierarquia_regioes": [] if campo == "regiaoCorretor" else filtros_request["hierarquia_regioes"],
    }
    params = [
        intervalo.inicio,
        intervalo.fim,
        filtros["hierarquia_corretores"],
        filtros["hierarquia_equipes"],
        filtros["hierarquia_gerentes"],
        filtros["hierarquia_coordenadores"],
        filtros["hierarquia_regioes"],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        limit,
    ]
    linhas = await conexao.fetch(
        f"""
        {_sql_produtividade_oficial()}
        select distinct {campo_expr} as valor
          from hierarquia_ativa
         where nullif(trim({campo_expr}), '') is not null
         order by 1
         limit $15
        """,
        *params,
    )
    return [_opcao(linha["valor"]) for linha in linhas if str(linha["valor"] or "").strip()]


async def _exigir_acesso(
    request: Request,
    usuario: dict[str, str],
    permissao: str = "dashboard.comercial.view",
) -> None:
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            permissao,
            "Voce nao possui acesso ao Dashboard Comercial.",
        )


PERMISSOES_DASHBOARD_MV_GERENCIAL = (
    "maquina.vendas.dashboard.manage",
    "dashboard.comercial.manage",
    "clientes.view.all",
    "clientes.manage.all",
    "metas.resultados.manage",
    "metas.resultados.gerenciais.manage",
    "metas.resultados.resultados.manage",
    "metas.resultados.admin",
    "administracao.view",
    "administracao.manage",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)


async def _exigir_acesso_maquina_vendas(request: Request, usuario: dict[str, str]) -> None:
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            usuario["identificador_usuario"],
            "maquina.vendas.dashboard.view",
            "Voce nao possui acesso ao Dashboard da Maquina de Vendas.",
        )


async def _usuario_pode_ver_dashboard_mv_gerencial(conexao, identificador_usuario: str) -> bool:
    for permissao in PERMISSOES_DASHBOARD_MV_GERENCIAL:
        if await usuario_possui_permissao(conexao, identificador_usuario, permissao):
            return True
    return False


async def _ids_time_comercial(conexao, identificador_usuario: str) -> list[str]:
    linhas = await conexao.fetch(
        f"""
        select subordinado_id::text as identificador_usuario
          from {ESQUEMA_COMERCIAL}.metas_hierarquia_comercial
         where gestor_id = $1::uuid
           and ativo = true
           and (data_inicio is null or data_inicio <= current_date)
           and (data_fim is null or data_fim >= current_date)
        """,
        identificador_usuario,
    )
    ids = [str(linha["identificador_usuario"]) for linha in linhas if linha["identificador_usuario"]]
    return [str(identificador_usuario), *ids] if ids else [str(identificador_usuario)]


async def _resolver_escopo_dashboard_mv(conexao, usuario: dict[str, str], request: Request) -> dict[str, Any]:
    identificador_usuario = str(usuario["identificador_usuario"])
    pode_ver_gerencial = await _usuario_pode_ver_dashboard_mv_gerencial(conexao, identificador_usuario)
    ids_time = await _ids_time_comercial(conexao, identificador_usuario)

    corretor_solicitado = str(request.query_params.get("corretor") or "").strip()
    if corretor_solicitado.lower() in IGNORAR_FILTROS:
        corretor_solicitado = ""

    if pode_ver_gerencial:
        ids_escopo = None
        tipo = "gerencial"
        rotulo = "Todos os corretores"
    elif len(ids_time) > 1:
        ids_escopo = ids_time
        tipo = "time"
        rotulo = "Meu time"
    else:
        ids_escopo = [identificador_usuario]
        tipo = "individual"
        rotulo = "Meus dados"

    if corretor_solicitado:
        if ids_escopo is not None and corretor_solicitado not in ids_escopo:
            raise HTTPException(status_code=403, detail="Corretor fora do seu escopo de visualizacao.")
        ids_escopo = [corretor_solicitado]
        tipo = "corretor"
        rotulo = "Corretor selecionado"

    return {
        "tipo": tipo,
        "rotulo": rotulo,
        "ids": ids_escopo,
        "pode_ver_gerencial": pode_ver_gerencial,
        "pode_filtrar_corretor": pode_ver_gerencial or len(ids_time) > 1,
        "usuario_id": identificador_usuario,
    }


def _filtro_escopo_sql(coluna: str, ids: list[str] | None, indice_parametro: int) -> tuple[str, list[Any]]:
    if ids is None:
        return "", []
    return f" and {coluna} = any(${indice_parametro}::uuid[])", [ids]


def _campo_json_numeric(caminho: str) -> str:
    return f"""
        case
          when nullif(s.payload_snapshot #>> '{{{caminho}}}', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          then (s.payload_snapshot #>> '{{{caminho}}}')::numeric
          else null
        end
    """


def _sql_base_reservas_dashboard_mv(filtro_escopo: str) -> str:
    incentivo_snapshot = _campo_json_numeric("calculo,resumo_operacao,incentivo_7lm")
    desconto_snapshot = _campo_json_numeric("calculo,resumo_operacao,desconto_imovel")
    valor_pago_snapshot = _campo_json_numeric("calculo,resumo_operacao,valor_total_pago_cliente")
    return f"""
        with base as (
            select
                r.identificador_reserva::text as identificador_reserva,
                r.identificador_imovel::text as identificador_imovel,
                r.identificador_cliente::text as identificador_cliente,
                r.identificador_simulacao::text as identificador_simulacao,
                r.status,
                r.reservado_por::text as corretor_id,
                coalesce(nullif(u.nome_completo, ''), 'Sem corretor') as corretor_nome,
                r.reservado_em,
                coalesce(r.reservado_em, r.data_hora_criacao) as data_operacao,
                c.nome_completo as cliente_nome,
                coalesce(nullif(i.titulo, ''), 'Imovel sem titulo') as imovel_titulo,
                coalesce(nullif(i.cidade, ''), 'Sem cidade') as cidade,
                coalesce(nullif(s.empreendimento, ''), nullif(i.bairro, ''), nullif(i.cidade, ''), 'Sem empreendimento') as empreendimento,
                coalesce(s.valor_total_operacao, i.valor, 0)::numeric as valor_negociado,
                coalesce(s.valor_imovel, i.valor, 0)::numeric as valor_imovel,
                coalesce(s.financiamento_caixa, 0)::numeric as financiamento_caixa,
                coalesce(s.entrada, 0)::numeric as entrada,
                coalesce(s.fgts, 0)::numeric as fgts,
                coalesce(s.subsidio, 0)::numeric as subsidio,
                coalesce(s.pro_soluto_total, 0)::numeric as pro_soluto_total,
                coalesce(
                    {incentivo_snapshot},
                    {desconto_snapshot},
                    greatest(coalesce(s.valor_imovel, i.valor, 0) - coalesce(s.valor_total_operacao, i.valor, 0), 0),
                    0
                )::numeric as incentivo_7lm,
                coalesce(
                    {valor_pago_snapshot},
                    s.valor_total_operacao,
                    i.valor,
                    0
                )::numeric as valor_pago_cliente,
                coalesce(
                    nullif(s.payload_snapshot #>> '{{calculo,resumo_operacao,parceiro_simulacao}}', ''),
                    nullif(s.payload_snapshot #>> '{{extra,payload,parceiro_simulacao}}', ''),
                    'sem_modalidade'
                ) as modalidade,
                s.status_simulacao
            from {ESQUEMA_COMERCIAL}.imovel_reserva r
            left join {ESQUEMA_COMERCIAL}.simulacao s
              on s.identificador_simulacao = r.identificador_simulacao
            left join {ESQUEMA_COMERCIAL}.imovel i
              on i.identificador_imovel = r.identificador_imovel
            left join {ESQUEMA_COMERCIAL}.cliente c
              on c.identificador_cliente = r.identificador_cliente
            left join sevenlm_connect.usuario u
              on u.identificador_usuario = r.reservado_por
            where coalesce(r.reservado_em, r.data_hora_criacao)::date >= $1::date
              and coalesce(r.reservado_em, r.data_hora_criacao)::date <= $2::date
              {filtro_escopo}
        )
    """


async def _buscar_funcionarios_ativos_dashboard_mv(
    conexao,
    intervalo: IntervaloDatas,
    escopo: dict[str, Any],
) -> float:
    filtro_escopo = ""
    parametros: list[Any] = [intervalo.inicio, intervalo.fim]
    if escopo.get("ids") is not None:
        filtro_escopo = "and f.identificador_usuario = any($3::uuid[])"
        parametros.append(escopo["ids"])

    valor = await conexao.fetchval(
        f"""
        with periodo as (
            select
                date_trunc('month', $1::date)::date as mes_inicio,
                date_trunc('month', $2::date)::date as mes_fim
        ),
        meses as (
            select generate_series(
                (select mes_inicio from periodo),
                (select mes_fim from periodo),
                interval '1 month'
            )::date as mes_referencia
        ),
        funcionarios_mes as (
            select
                m.mes_referencia,
                coalesce(
                    f.identificador_funcionario::text,
                    f.identificador_usuario::text,
                    nullif(trim(f.documento), ''),
                    nullif(lower(trim(f.email::text)), ''),
                    regexp_replace(lower(trim(f.nome)), '\\s+', ' ', 'g')
                ) as funcionario_key
            from meses m
            join {ESQUEMA_BANCO}.funcionario_acesso f
              on upper(trim(coalesce(f.tipo_funcionario, ''))) in ('CORRETOR', 'SDR')
             and (
                  (
                      (f.data_inicio_vigencia is not null or f.data_fim_vigencia is not null)
                      and (f.data_inicio_vigencia is null or f.data_inicio_vigencia < (m.mes_referencia + interval '1 month')::date)
                      and (f.data_fim_vigencia is null or f.data_fim_vigencia >= m.mes_referencia)
                  )
                  or (
                      f.data_inicio_vigencia is null
                      and f.data_fim_vigencia is null
                      and coalesce(f.ativo, true) is true
                      and coalesce(f.ativo_negocio, true) is true
                      and coalesce(f.ativo_login, true) is true
                      and (
                          f.observacao is null
                          or f.observacao !~* 'status\\s*cv\\s*:'
                          or f.observacao ~* 'status\\s*cv\\s*:\\s*(ativo|active)(\\s|$|\\|)'
                      )
                  )
              )
            where trim(coalesce(f.nome, '')) <> ''
              {filtro_escopo}
        )
        select count(distinct funcionario_key)::numeric
          from funcionarios_mes
         where funcionario_key is not null
        """,
        *parametros,
    )
    return float(valor or 0)


async def _buscar_kpis_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> dict[str, Any]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linha = await conexao.fetchrow(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            count(*)::numeric as total_operacoes,
            count(*) filter (where status = 'ATIVA')::numeric as reservas_ativas,
            count(*) filter (where status = 'PENDENTE_APROVACAO')::numeric as pendentes_aprovacao,
            count(*) filter (where status = 'CONVERTIDA')::numeric as vendas,
            count(*) filter (where status = 'LIBERADA')::numeric as reservas_liberadas,
            count(distinct identificador_imovel)::numeric as imoveis_movimentados,
            count(distinct corretor_id)::numeric as corretores_ativos,
            coalesce(sum(valor_negociado), 0)::numeric as valor_negociado_total,
            coalesce(sum(valor_pago_cliente), 0)::numeric as valor_pago_total,
            coalesce(avg(nullif(valor_negociado, 0)), 0)::numeric as ticket_medio,
            coalesce(sum(incentivo_7lm), 0)::numeric as incentivo_total,
            coalesce(avg(nullif(incentivo_7lm, 0)), 0)::numeric as incentivo_medio,
            coalesce(avg(nullif(financiamento_caixa, 0)), 0)::numeric as financiamento_medio,
            coalesce(avg(nullif(entrada, 0)), 0)::numeric as entrada_media,
            case when count(*) > 0
                 then (count(*) filter (where status = 'CONVERTIDA'))::numeric / count(*)::numeric * 100
                 else 0 end as taxa_conversao
        from base
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )

    filtro_simulacoes, parametros_simulacoes = _filtro_escopo_sql("s.identificador_corretor", escopo["ids"], 3)
    simulacoes = await conexao.fetchrow(
        f"""
        select
            count(*)::numeric as total_simulacoes,
            count(*) filter (where lower(coalesce(status_simulacao, '')) in ('ideal'))::numeric as simulacoes_ideais,
            count(*) filter (where lower(coalesce(status_simulacao, '')) in ('atenção', 'atencao'))::numeric as simulacoes_atencao,
            count(*) filter (where lower(coalesce(status_simulacao, '')) in ('inválida', 'invalida'))::numeric as simulacoes_invalidas
        from {ESQUEMA_COMERCIAL}.simulacao s
        where s.data_hora_criacao::date >= $1::date
          and s.data_hora_criacao::date <= $2::date
          {filtro_simulacoes}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_simulacoes,
    )

    dados = _linha_para_dict(linha)
    dados["corretores_ativos"] = await _buscar_funcionarios_ativos_dashboard_mv(conexao, intervalo, escopo)
    dados.update({f"simulacoes_{k}": v for k, v in _linha_para_dict(simulacoes).items()})
    return dados


async def _buscar_series_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            data_operacao::date as data,
            count(*)::numeric as operacoes,
            count(*) filter (where status = 'ATIVA')::numeric as reservas_ativas,
            count(*) filter (where status = 'PENDENTE_APROVACAO')::numeric as pendentes_aprovacao,
            count(*) filter (where status = 'CONVERTIDA')::numeric as vendas,
            coalesce(sum(valor_negociado), 0)::numeric as valor_negociado
        from base
        group by data_operacao::date
        order by data_operacao::date
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_status_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            status as label,
            count(*)::numeric as quantidade,
            coalesce(sum(valor_negociado), 0)::numeric as valor
        from base
        group by status
        order by quantidade desc, label
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_modalidades_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            modalidade as label,
            count(*)::numeric as quantidade,
            coalesce(sum(valor_negociado), 0)::numeric as valor
        from base
        group by modalidade
        order by quantidade desc, label
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_ranking_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            corretor_id,
            corretor_nome,
            count(*)::numeric as operacoes,
            count(*) filter (where status = 'ATIVA')::numeric as reservas_ativas,
            count(*) filter (where status = 'PENDENTE_APROVACAO')::numeric as pendentes_aprovacao,
            count(*) filter (where status = 'CONVERTIDA')::numeric as vendas,
            coalesce(sum(valor_negociado), 0)::numeric as valor_negociado,
            coalesce(avg(nullif(valor_negociado, 0)), 0)::numeric as ticket_medio,
            coalesce(avg(nullif(incentivo_7lm, 0)), 0)::numeric as incentivo_medio
        from base
        group by corretor_id, corretor_nome
        order by vendas desc, reservas_ativas desc, valor_negociado desc, corretor_nome
        limit 20
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_empreendimentos_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            empreendimento as label,
            count(*)::numeric as operacoes,
            count(*) filter (where status = 'CONVERTIDA')::numeric as vendas,
            coalesce(sum(valor_negociado), 0)::numeric as valor_negociado,
            coalesce(avg(nullif(incentivo_7lm, 0)), 0)::numeric as incentivo_medio
        from base
        group by empreendimento
        order by operacoes desc, valor_negociado desc, label
        limit 12
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_recentes_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo, parametros_escopo = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        {_sql_base_reservas_dashboard_mv(filtro_escopo)}
        select
            identificador_reserva,
            identificador_imovel,
            identificador_cliente,
            identificador_simulacao,
            status,
            data_operacao,
            corretor_id,
            corretor_nome,
            cliente_nome,
            imovel_titulo,
            cidade,
            empreendimento,
            valor_negociado,
            valor_pago_cliente,
            incentivo_7lm,
            modalidade,
            status_simulacao
        from base
        order by data_operacao desc nulls last
        limit 16
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_corretores_dashboard_mv(conexao, intervalo: IntervaloDatas, escopo: dict[str, Any]) -> list[dict[str, Any]]:
    filtro_escopo_r, parametros_escopo_r = _filtro_escopo_sql("r.reservado_por", escopo["ids"], 3)
    linhas = await conexao.fetch(
        f"""
        select
            dados.corretor_id as value,
            coalesce(nullif(u.nome_completo, ''), 'Sem corretor') as label
        from (
            select distinct r.reservado_por as corretor_id
              from {ESQUEMA_COMERCIAL}.imovel_reserva r
             where coalesce(r.reservado_em, r.data_hora_criacao)::date >= $1::date
               and coalesce(r.reservado_em, r.data_hora_criacao)::date <= $2::date
               and r.reservado_por is not null
               {filtro_escopo_r}
        ) dados
        left join sevenlm_connect.usuario u
          on u.identificador_usuario = dados.corretor_id
        order by label
        limit 200
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_escopo_r,
    )
    return [_linha_para_dict(linha) for linha in linhas]


@rotas_de_dashboard_comercial.get("/connect-comercial/dashboard-maquina-vendas")
async def dashboard_maquina_vendas(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso_maquina_vendas(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        escopo = await _resolver_escopo_dashboard_mv(conexao, usuario, request)
        return {
            "meta": {
                "periodo": {"inicio": intervalo.inicio, "fim": intervalo.fim},
                "escopo": {
                    "tipo": escopo["tipo"],
                    "rotulo": escopo["rotulo"],
                    "pode_ver_gerencial": escopo["pode_ver_gerencial"],
                    "pode_filtrar_corretor": escopo["pode_filtrar_corretor"],
                },
            },
            "kpis": await _buscar_kpis_dashboard_mv(conexao, intervalo, escopo),
            "series": await _buscar_series_dashboard_mv(conexao, intervalo, escopo),
            "status": await _buscar_status_dashboard_mv(conexao, intervalo, escopo),
            "modalidades": await _buscar_modalidades_dashboard_mv(conexao, intervalo, escopo),
            "ranking": await _buscar_ranking_dashboard_mv(conexao, intervalo, escopo),
            "empreendimentos": await _buscar_empreendimentos_dashboard_mv(conexao, intervalo, escopo),
            "recentes": await _buscar_recentes_dashboard_mv(conexao, intervalo, escopo),
            "corretores": await _buscar_corretores_dashboard_mv(conexao, intervalo, escopo),
        }


async def _buscar_resumo(conexao, intervalo: IntervaloDatas, request: Request) -> dict[str, Any]:
    where_filtros, parametros_filtros = _montar_where_dimensoes(request, FILTROS_KPI, 3)
    linha = await conexao.fetchrow(
        f"""
        select
            coalesce(sum(leads), 0)::numeric as total_leads,
            coalesce(sum(visitas), 0)::numeric as total_visitas,
            coalesce(sum(vendas), 0)::numeric as total_vendas,
            coalesce(sum(repasses), 0)::numeric as total_repasses,
            coalesce(sum(cancelamentos), 0)::numeric as total_cancelamentos,
            coalesce(sum(distratos), 0)::numeric as total_distratos,
            coalesce(sum(propostas_aprovadas), 0)::numeric as total_propostas_aprovadas,
            coalesce(sum(propostas_condicionadas), 0)::numeric as total_propostas_condicionadas,
            coalesce(sum(propostas_reprovadas), 0)::numeric as total_propostas_reprovadas,
            coalesce(sum(propostas_total), 0)::numeric as total_propostas,
            (coalesce(sum(propostas_aprovadas), 0) + coalesce(sum(propostas_condicionadas), 0))::numeric as total_propostas_geral,
            case when coalesce(sum(sla_finalizacao_count), 0) > 0
                 then sum(sla_finalizacao_sum) / sum(sla_finalizacao_count)
                 else 0 end as total_sla_finalizacao,
            case when coalesce(sum(sla_repasse_count), 0) > 0
                 then sum(sla_repasse_sum) / sum(sla_repasse_count)
                 else 0 end as total_sla_repasse,
            count(distinct nullif(corretor, ''))::numeric as total_corretores_ativos,
            count(distinct nullif(imobiliaria, ''))::numeric as total_imobiliarias_ativas
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
        where data >= $1::date
          and data <= $2::date
          {where_filtros}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    dados = _linha_para_dict(linha)
    metricas_funil = await _funil_metricas_diarias(conexao, request, intervalo)
    _aplicar_metricas_funil_resumo(dados, metricas_funil)
    repasses_fato_filtrado = float(dados.get("total_repasses") or 0)
    produtividade = await _buscar_produtividade_oficial_resumo(conexao, intervalo, request)
    corretores = float(produtividade.get("corretores_ativos") or 0)
    imobiliarias = float(produtividade.get("equipes_ativas") or 0)
    dados["total_repasses"] = repasses_fato_filtrado
    dados["total_repasses_fato"] = repasses_fato_filtrado
    dados["total_repasses_elegiveis"] = repasses_fato_filtrado
    dados["total_repasses_nao_elegiveis"] = 0
    dados["total_corretores_ativos"] = corretores
    dados["total_imobiliarias_ativas"] = imobiliarias
    dados["total_ipc"] = repasses_fato_filtrado
    dados["total_ipc_corretor"] = repasses_fato_filtrado / corretores if corretores else 0
    dados["total_ipc_imobiliaria"] = repasses_fato_filtrado / imobiliarias if imobiliarias else 0
    dados["ipc_corretores_ativos"] = corretores
    dados["ipc_imobiliarias_ativas"] = imobiliarias
    dados["meta_operacional"] = produtividade.get("meta_operacional", corretores)
    dados["performance_real"] = produtividade.get("performance_real", 0)
    dados["volume_total_eventos"] = produtividade.get("volume_total_eventos", 0)
    return dados


async def _buscar_tendencias(conexao, intervalo: IntervaloDatas, request: Request) -> list[dict[str, Any]]:
    where_filtros, parametros_filtros = _montar_where_dimensoes(request, FILTROS_KPI, 3)
    metricas_funil = await _funil_metricas_diarias(conexao, request, intervalo)
    linhas = await conexao.fetch(
        f"""
        select
            data,
            coalesce(sum(leads), 0)::numeric as leads,
            coalesce(sum(visitas), 0)::numeric as visitas,
            coalesce(sum(vendas), 0)::numeric as vendas,
            coalesce(sum(repasses), 0)::numeric as repasses,
            coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
            coalesce(sum(distratos), 0)::numeric as distratos,
            coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
            coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
            coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
            coalesce(sum(propostas_total), 0)::numeric as propostas_total,
            (coalesce(sum(propostas_aprovadas), 0) + coalesce(sum(propostas_condicionadas), 0))::numeric as propostas,
            coalesce(sum(sla_finalizacao_sum), 0)::numeric as sla_finalizacao_sum,
            coalesce(sum(sla_finalizacao_count), 0)::numeric as sla_finalizacao_base,
            coalesce(sum(sla_repasse_sum), 0)::numeric as sla_repasse_sum,
            coalesce(sum(sla_repasse_count), 0)::numeric as sla_repasse_base,
            count(distinct nullif(corretor, ''))::numeric as ipc_corretores_ativos,
            count(distinct nullif(imobiliaria, ''))::numeric as ipc_imobiliarias_ativas
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
        where data >= $1::date
          and data <= $2::date
          {where_filtros}
        group by data
        order by data
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    produtividade_por_dia = await _buscar_produtividade_oficial_tendencias(conexao, intervalo, request)
    tendencias: list[dict[str, Any]] = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        metricas_dia = metricas_funil.get(str(item.get("data")))
        if metricas_dia:
            _aplicar_metricas_funil_tendencia(item, metricas_dia)
        sla_finalizacao_base = float(item.pop("sla_finalizacao_base", 0) or 0)
        sla_repasse_base = float(item.pop("sla_repasse_base", 0) or 0)
        sla_finalizacao_sum = float(item.pop("sla_finalizacao_sum", 0) or 0)
        sla_repasse_sum = float(item.pop("sla_repasse_sum", 0) or 0)
        produtividade = produtividade_por_dia.get(str(item.get("data"))) or {}
        corretores = float(produtividade.get("ipc_corretores_ativos") or 0)
        imobiliarias = float(produtividade.get("ipc_imobiliarias_ativas") or 0)
        repasses = float(item.get("repasses") or 0)
        item["ipc_corretores_ativos"] = corretores
        item["ipc_imobiliarias_ativas"] = imobiliarias
        item["sla_finalizacao"] = sla_finalizacao_sum / sla_finalizacao_base if sla_finalizacao_base else 0
        item["sla_finalizacao_base"] = sla_finalizacao_base
        item["sla_repasse"] = sla_repasse_sum / sla_repasse_base if sla_repasse_base else 0
        item["sla_repasse_base"] = sla_repasse_base
        item["ipc_corretor"] = repasses / corretores if corretores else 0
        item["ipc_imobiliaria"] = repasses / imobiliarias if imobiliarias else 0
        tendencias.append(item)
    dias_existentes = {str(item.get("data")) for item in tendencias}
    for data_chave, produtividade in produtividade_por_dia.items():
        if data_chave in dias_existentes:
            continue
        item = {
            "data": produtividade["data"],
            "leads": 0,
            "visitas": 0,
            "vendas": 0,
            "repasses": 0,
            "cancelamentos": 0,
            "distratos": 0,
            "propostas_aprovadas": 0,
            "propostas_condicionadas": 0,
            "propostas_reprovadas": 0,
            "propostas_total": 0,
            "propostas": 0,
            "sla_finalizacao": 0,
            "sla_finalizacao_base": 0,
            "sla_repasse": 0,
            "sla_repasse_base": 0,
            "ipc_corretores_ativos": produtividade.get("ipc_corretores_ativos", 0),
            "ipc_imobiliarias_ativas": produtividade.get("ipc_imobiliarias_ativas", 0),
            "ipc_corretor": 0,
            "ipc_imobiliaria": 0,
        }
        metricas_dia = metricas_funil.get(data_chave)
        if metricas_dia:
            _aplicar_metricas_funil_tendencia(item, metricas_dia)
        tendencias.append(item)
        dias_existentes.add(data_chave)
    for data_chave, metricas_dia in metricas_funil.items():
        if data_chave in dias_existentes:
            continue
        item = {
            "data": metricas_dia["data"],
            "leads": 0,
            "visitas": 0,
            "vendas": 0,
            "repasses": 0,
            "cancelamentos": 0,
            "distratos": 0,
            "propostas_aprovadas": 0,
            "propostas_condicionadas": 0,
            "propostas_reprovadas": 0,
            "propostas_total": 0,
            "propostas": 0,
            "sla_finalizacao": 0,
            "sla_finalizacao_base": 0,
            "sla_repasse": 0,
            "sla_repasse_base": 0,
            "ipc_corretores_ativos": 0,
            "ipc_imobiliarias_ativas": 0,
            "ipc_corretor": 0,
            "ipc_imobiliaria": 0,
        }
        _aplicar_metricas_funil_tendencia(item, metricas_dia)
        tendencias.append(item)
        dias_existentes.add(data_chave)
    tendencias.sort(key=lambda item: str(item.get("data") or ""))
    return tendencias


def _where_reservas(request: Request, indice_parametro_inicial: int = 3) -> tuple[str, list[Any]]:
    return _montar_where_dimensoes(request, FILTROS_RESERVAS_BASE, indice_parametro_inicial)


def _sql_metas_reservas_padrao(coluna: str = "imobiliaria") -> str:
    partes = [
        f"when lower(trim({coluna})) = '{nome}' then {valor}"
        for nome, valor in METAS_RESERVAS_PADRAO.items()
    ]
    return "case " + " ".join(partes) + " else 0 end"


def _condicao_metrica_detalhe_reservas(metric: str) -> str:
    metric = str(metric or "reservas").strip()
    if metric == "vendidas":
        return "dt_contrato_contabilizado >= $1::date and dt_contrato_contabilizado < ($2::date + interval '1 day')"
    if metric == "canceladas":
        return "dt_cancelamento_reserva >= $1::date and dt_cancelamento_reserva < ($2::date + interval '1 day')"
    if metric == "repasses_assinados":
        return "dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')"
    if metric == "reservas_situacoes":
        return """
            $1::date is not null
            and $2::date is not null
            and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
            and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
        """
    if metric == "sla_expirado":
        return f"""
            $1::date is not null
            and $2::date is not null
            and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
            and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
            and ({RESERVA_SLA_LIMITE_SITUACAO_SQL}) is not null
            and {RESERVA_TEMPO_SITUACAO_SQL} > ({RESERVA_SLA_LIMITE_SITUACAO_SQL})
        """
    if metric == "repasse_nao":
        return f"""
            referencia_data_reserva >= $1::date
            and referencia_data_reserva < ($2::date + interval '1 day')
            and {RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL}
            and {RESERVA_REPASSE_NAO_SQL}
        """
    if metric == "prob_cair":
        return f"""
            referencia_data_reserva >= $1::date
            and referencia_data_reserva < ($2::date + interval '1 day')
            and {RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL}
            and {RESERVA_PROB_CAIR_SQL}
        """
    return "referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')"


def _sql_base_reservas() -> str:
    return f"""
        select
            idreserva,
            idrepasse,
            idlead,
            idprecadastro,
            reserva_situacao_nome,
            repasse_situacao_nome,
            dt_referencia_reserva,
            dt_referencia_reserva_data,
            dt_referencia_repasse,
            dt_referencia_repasse_data,
            dt_cadastro_reserva,
            dt_cancelamento_reserva,
            dt_contrato_contabilizado,
            dt_venda_finalizada,
            dt_assinatura_contrato,
            fl_cancelada,
            fl_venda_finalizada,
            fl_repasse_assinado,
            corretor_nome,
            corretor_nome_canonico,
            imobiliaria_nome,
            imobiliaria_nome_canonica,
            gestor_nome,
            lead_cidade,
            lead_origem_nome,
            empreendimento_nome,
            regiao_empreendimento,
            unidade_nome,
            cliente_documento,
            cliente_email,
            sla_finalizacao_dias,
            sla_repasse_dias,
            coalesce(dt_referencia_reserva, dt_cadastro_reserva) as referencia_data_reserva,
            coalesce(dt_referencia_reserva, dt_referencia_reserva_data::timestamp, dt_cadastro_reserva) as data_ultima_alteracao_situacao,
            reserva_campos_adicionais_data_qr as reserva_data_qr,
            reserva_campos_adicionais_reserva_kit_agehab as reserva_kit_agehab,
            reserva_campos_adicionais_reserva_kit_cef as reserva_kit_cef,
            reserva_campos_adicionais_reserva_obs_finalizacao as reserva_obs_finalizacao,
            reserva_campos_adicionais_reserva_repasse_no_mes as reserva_repasse_no_mes,
            repasse_campos_adicionais_repasse_data_envio_cehop as repasse_data_envio_cehop,
            repasse_campos_adicionais_repasse_data_conformidade_cehop as repasse_data_conformidade_cehop,
            repasse_campos_adicionais_repasse_data_da_inconformidade_cehop as repasse_data_inconformidade_cehop,
            repasse_campos_adicionais_repasse_data_do_reenvio_cehop as repasse_data_reenvio_cehop,
            repasse_campos_adicionais_repasse_probabilidade_de_assinatura as repasse_probabilidade_de_assinatura,
            0::numeric as mp_reserva,
            case
              when translate(lower(coalesce(reserva_campos_adicionais_reserva_repasse_no_mes, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'probabilidade de cair'
                then 'Sim'
              else 'Nao'
            end as probabilidade_cair
        from {ESQUEMA_COMERCIAL}.comercial_base
        where idreserva is not null
    """


async def _buscar_reservas_summary(conexao, intervalo: IntervaloDatas, request: Request) -> dict[str, Any]:
    where_filtros, parametros_filtros = _where_reservas(request, 3)
    linha = await conexao.fetchrow(
        f"""
        with base as (
            {_sql_base_reservas()}
              {where_filtros}
        )
        select
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
            )::numeric as total_reservas,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
            )::numeric as reservas_cadastradas,
            count(distinct idreserva) filter (
                where dt_contrato_contabilizado >= $1::date and dt_contrato_contabilizado < ($2::date + interval '1 day')
            )::numeric as reservas_vendidas,
            count(distinct idreserva) filter (
                where dt_contrato_contabilizado >= $1::date
                  and dt_contrato_contabilizado < ($2::date + interval '1 day')
                  and dt_assinatura_contrato is null
            )::numeric as venda_finalizada_mes_atual,
            count(distinct idreserva) filter (
                where dt_cancelamento_reserva >= $1::date and dt_cancelamento_reserva < ($2::date + interval '1 day')
            )::numeric as reservas_canceladas,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date
                  and referencia_data_reserva < ($2::date + interval '1 day')
                  and lower(coalesce(reserva_situacao_nome, '')) like '%distrato%'
            )::numeric as distratos,
            count(distinct idrepasse) filter (
                where dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')
            )::numeric as repasses_assinados,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date
                  and referencia_data_reserva < ($2::date + interval '1 day')
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
            )::numeric as reservas_situacoes,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date
                  and referencia_data_reserva < ($2::date + interval '1 day')
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
                  and translate(lower(coalesce(reserva_repasse_no_mes, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'nao'
            )::numeric as reservas_situacoes_mes_seguinte,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date
                  and referencia_data_reserva < ($2::date + interval '1 day')
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
	                  and probabilidade_cair = 'Sim'
	            )::numeric as reservas_situacoes_prob_cair,
	            count(distinct idreserva) filter (
	                where referencia_data_reserva >= $1::date
	                  and referencia_data_reserva < ($2::date + interval '1 day')
	                  and dt_contrato_contabilizado is not null
	            )::numeric as reservas_convertidas,
	            coalesce(sum(mp_reserva) filter (
	                where referencia_data_reserva >= $1::date
	                  and referencia_data_reserva < ($2::date + interval '1 day')
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
	                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
	            ), 0)::numeric as mp_reserva,
	            avg(extract(day from (now() - dt_cadastro_reserva))) filter (
                where dt_cadastro_reserva is not null
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
            )::numeric as sla_criado_medio,
            avg(sla_finalizacao_dias) filter (where sla_finalizacao_dias is not null)::numeric as sla_finalizacao_medio,
            avg(sla_repasse_dias) filter (where sla_repasse_dias is not null)::numeric as sla_repasse_medio
        from base
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    dados = _linha_para_dict(linha)
    total = float(dados.get("total_reservas") or 0)
    convertidas = float(dados.get("reservas_convertidas") or 0)
    reservas_situacoes = float(dados.get("reservas_situacoes") or 0)
    mes_seguinte = float(dados.get("reservas_situacoes_mes_seguinte") or 0)
    prob_cair = float(dados.get("reservas_situacoes_prob_cair") or 0)
    mp_reserva = float(dados.get("mp_reserva") or 0)
    repasses_assinados = float(dados.get("repasses_assinados") or 0)
    dados["reservas_situacoes_mes_seguinte"] = mes_seguinte
    dados["reservas_situacoes_prob_cair"] = prob_cair
    dados["reservas_situacoes_mes_atual"] = abs(reservas_situacoes - mes_seguinte - prob_cair)
    dados["mp_reserva"] = mp_reserva
    dados["prev_repasse"] = dados["reservas_situacoes_mes_atual"] + mp_reserva + repasses_assinados
    dados["conversao_reserva_venda"] = (convertidas / total * 100) if total else 0
    dados["periodo"] = {"inicio": intervalo.inicio, "fim": intervalo.fim}
    return dados


async def _buscar_reservas_trends(conexao, intervalo: IntervaloDatas, request: Request) -> list[dict[str, Any]]:
    where_filtros, parametros_filtros = _where_reservas(request, 3)
    linhas = await conexao.fetch(
        f"""
        with base as (
            {_sql_base_reservas()}
              {where_filtros}
        ),
        dias as (
            select generate_series($1::date, $2::date, interval '1 day')::date as data
        )
        select
            d.data,
            count(distinct b.idreserva) filter (
                where b.referencia_data_reserva >= d.data and b.referencia_data_reserva < (d.data + interval '1 day')
            )::numeric as reservas,
            count(distinct b.idreserva) filter (
                where b.dt_contrato_contabilizado >= d.data and b.dt_contrato_contabilizado < (d.data + interval '1 day')
            )::numeric as vendidas,
            count(distinct b.idreserva) filter (
                where b.dt_cancelamento_reserva >= d.data and b.dt_cancelamento_reserva < (d.data + interval '1 day')
            )::numeric as canceladas,
            count(distinct b.idrepasse) filter (
                where b.dt_assinatura_contrato >= d.data and b.dt_assinatura_contrato < (d.data + interval '1 day')
            )::numeric as repasses_assinados
        from dias d
        left join base b on true
        group by d.data
        order by d.data
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _buscar_reservas_breakdown(conexao, intervalo: IntervaloDatas, request: Request, eixo: str) -> list[dict[str, Any]]:
    coluna = EIXOS_RESERVAS.get(eixo)
    if not coluna:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Eixo invalido para reservas.")
    where_filtros, parametros_filtros = _where_reservas(request, 3)
    if eixo == "situacao":
        where_filtros_situacao, parametros_filtros_situacao = _where_reservas(request, 1)
        linhas = await conexao.fetch(
            f"""
            with base as (
                {_sql_base_reservas()}
                  {where_filtros_situacao}
            )
            select
                {coluna} as label,
                count(distinct idreserva) filter (
                    where lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                      and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                )::numeric as reservas,
                0::numeric as vendidas,
                0::numeric as canceladas,
                0::numeric as repasses_assinados,
                count(distinct idreserva) filter (
                    where lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                      and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                )::numeric as reservas_situacoes,
                count(distinct idreserva) filter (
                    where lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                      and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                      and ({RESERVA_SLA_LIMITE_SITUACAO_SQL}) is not null
                      and {RESERVA_TEMPO_SITUACAO_SQL} > ({RESERVA_SLA_LIMITE_SITUACAO_SQL})
                )::numeric as sla_expirado
            from base
            group by {coluna}
            order by reservas_situacoes desc, label asc
            limit 500
            """,
            *parametros_filtros_situacao,
        )
        itens = [_linha_para_dict(linha) for linha in linhas]
        for item in itens:
            reservas = float(item.get("reservas") or 0)
            vendidas = float(item.get("vendidas") or 0)
            item["conversao"] = (vendidas / reservas * 100) if reservas else 0
        return itens

    linhas = await conexao.fetch(
        f"""
        with base as (
            {_sql_base_reservas()}
              {where_filtros}
        )
        select
            {coluna} as label,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
            )::numeric as reservas,
            count(distinct idreserva) filter (
                where dt_contrato_contabilizado >= $1::date and dt_contrato_contabilizado < ($2::date + interval '1 day')
            )::numeric as vendidas,
            count(distinct idreserva) filter (
                where dt_cancelamento_reserva >= $1::date and dt_cancelamento_reserva < ($2::date + interval '1 day')
            )::numeric as canceladas,
            count(distinct idrepasse) filter (
                where dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')
            )::numeric as repasses_assinados,
            count(distinct idreserva) filter (
                where referencia_data_reserva >= $1::date
                  and referencia_data_reserva < ($2::date + interval '1 day')
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%cancel%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%distrato%'
                  and lower(coalesce(reserva_situacao_nome, '')) not like '%venda finalizada%'
            )::numeric as reservas_situacoes
        from base
        group by {coluna}
        order by reservas desc, vendidas desc, label asc
        limit 500
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    itens = [_linha_para_dict(linha) for linha in linhas]
    for item in itens:
        reservas = float(item.get("reservas") or 0)
        vendidas = float(item.get("vendidas") or 0)
        item["conversao"] = (vendidas / reservas * 100) if reservas else 0
        item["prev_repasse"] = float(item.get("reservas_situacoes") or 0) + float(item.get("repasses_assinados") or 0)
    return itens


async def _buscar_reservas_tabela(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
    page: int,
    limit: int,
    detail_axis: str = "",
    detail_value: str = "",
    detail_metric: str = "reservas",
) -> dict[str, Any]:
    parametros_detalhe: list[Any] = []
    condicoes_detalhe: list[str] = [_condicao_metrica_detalhe_reservas(detail_metric)]
    proximo_indice = 5
    eixo_sql = EIXOS_DETALHE_RESERVAS.get(str(detail_axis or "").strip())
    if eixo_sql and str(detail_value or "").strip():
        condicoes_detalhe.append(f"{eixo_sql} = ${proximo_indice}::text")
        parametros_detalhe.append(str(detail_value).strip())
        proximo_indice += 1
    where_filtros, parametros_filtros = _where_reservas(request, proximo_indice)
    offset = (page - 1) * limit
    condicao_detalhe = " and ".join(f"({condicao})" for condicao in condicoes_detalhe)
    linhas = await conexao.fetch(
        f"""
        with base as (
            {_sql_base_reservas()}
              {where_filtros}
        ),
        filtrada as (
            select *
            from base
            where {condicao_detalhe}
        )
        select
            count(*) over()::integer as total_count,
            idreserva,
            idrepasse,
            reserva_situacao_nome,
            repasse_situacao_nome,
            coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, '')) as imobiliaria,
            coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, '')) as corretor,
            cliente_documento,
            lead_cidade,
            empreendimento_nome,
            regiao_empreendimento,
            lead_origem_nome,
            dt_cadastro_reserva,
            data_ultima_alteracao_situacao,
            dt_cancelamento_reserva,
            dt_contrato_contabilizado,
            dt_assinatura_contrato,
            reserva_data_qr,
            reserva_kit_agehab,
            reserva_kit_cef,
            reserva_obs_finalizacao,
            reserva_repasse_no_mes,
            repasse_data_envio_cehop,
            repasse_data_conformidade_cehop,
            repasse_data_inconformidade_cehop,
            repasse_data_reenvio_cehop,
            repasse_probabilidade_de_assinatura,
            probabilidade_cair,
            mp_reserva,
            {RESERVA_TEMPO_SITUACAO_SQL}::integer as criado_ha,
            ({RESERVA_SLA_LIMITE_SITUACAO_SQL})::integer as sla_limite_dias,
            sla_finalizacao_dias,
            sla_repasse_dias,
            case when dt_assinatura_contrato is not null then 'Sim' else 'Nao' end as repasse_assinado
        from filtrada
        order by dt_cadastro_reserva desc nulls last, idreserva desc
        limit $3 offset $4
        """,
        intervalo.inicio,
        intervalo.fim,
        limit,
        offset,
        *parametros_detalhe,
        *parametros_filtros,
    )
    itens = [_linha_para_dict(linha) for linha in linhas]
    total = int(itens[0].get("total_count") or 0) if itens else 0
    for item in itens:
        item.pop("total_count", None)
    return {"items": itens, "pagination": {"page": page, "limit": limit, "total": total}}


async def _buscar_reservas_metas(conexao, intervalo: IntervaloDatas, request: Request) -> dict[str, Any]:
    where_filtros, parametros_filtros = _where_reservas(request, 3)
    linhas = await conexao.fetch(
        f"""
        with base as (
            {_sql_base_reservas()}
              {where_filtros}
        ),
        agregado as (
            select
                coalesce(nullif(regiao_empreendimento, ''), 'Sem regiao') as regiao,
                coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''), 'Sem imobiliaria') as imobiliaria,
                count(distinct idreserva) filter (
                    where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
                      and {RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL}
                )::numeric as reservas_situacoes,
                count(distinct idreserva) filter (
                    where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
                      and {RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL}
                      and {RESERVA_REPASSE_NAO_SQL}
                )::numeric as mes_seguinte,
                count(distinct idreserva) filter (
                    where referencia_data_reserva >= $1::date and referencia_data_reserva < ($2::date + interval '1 day')
                      and {RESERVAS_FLAG_SEC_VENDAS_CREDITO_SQL}
                      and {RESERVA_PROB_CAIR_SQL}
                )::numeric as prob_cair,
                (
                    count(distinct idrepasse) filter (
                        where coalesce(dt_referencia_repasse, referencia_data_reserva) >= $1::date
                          and coalesce(dt_referencia_repasse, referencia_data_reserva) < ($2::date + interval '1 day')
                          and {REPASSE_FLUXO_REPASSE_SQL}
                          and {REPASSE_PROB_SIM_TALVEZ_SQL}
                          and (
                            repasse_data_envio_cehop is null
                            or (repasse_data_inconformidade_cehop is not null and repasse_data_reenvio_cehop is null)
                          )
                    )
                    + count(distinct idrepasse) filter (
                        where coalesce(dt_referencia_repasse, referencia_data_reserva) >= $1::date
                          and coalesce(dt_referencia_repasse, referencia_data_reserva) < ($2::date + interval '1 day')
                          and {REPASSE_FLUXO_REPASSE_SQL}
                          and {REPASSE_PROB_SIM_TALVEZ_SQL}
                          and (
                            (
                              repasse_data_envio_cehop is not null
                              and repasse_data_conformidade_cehop is null
                              and repasse_data_inconformidade_cehop is null
                              and repasse_data_reenvio_cehop is null
                            )
                            or (
                              repasse_data_envio_cehop is not null
                              and repasse_data_inconformidade_cehop is not null
                              and repasse_data_reenvio_cehop is not null
                              and repasse_data_conformidade_cehop is null
                            )
                          )
                    )
                    + count(distinct idrepasse) filter (
                        where coalesce(dt_referencia_repasse, referencia_data_reserva) >= $1::date
                          and coalesce(dt_referencia_repasse, referencia_data_reserva) < ($2::date + interval '1 day')
                          and {REPASSE_FLUXO_REPASSE_SQL}
                          and {REPASSE_PROB_SIM_TALVEZ_SQL}
                          and repasse_data_conformidade_cehop is not null
                    )
                    + count(distinct idrepasse) filter (
                        where coalesce(dt_referencia_repasse, referencia_data_reserva) >= $1::date
                          and coalesce(dt_referencia_repasse, referencia_data_reserva) < ($2::date + interval '1 day')
                          and {REPASSE_MP_ATIVA_SQL}
                          and dt_assinatura_contrato is null
                          and not ({REPASSE_PROB_NAO_SQL})
                    )
                )::numeric as mp_reserva,
                count(distinct idrepasse) filter (
                    where dt_assinatura_contrato >= $1::date and dt_assinatura_contrato < ($2::date + interval '1 day')
                )::numeric as repasses_assinados
            from base
            group by 1, 2
        ),
        metas as (
            select
                split_part(hierarchy_value, '|||', 1) as regiao,
                split_part(hierarchy_value, '|||', 2) as imobiliaria,
                max(goal_value)::numeric as meta
            from {ESQUEMA_COMERCIAL}.dashboard_goals
            where kpi_id = 'reservas_prev_repasse'
              and hierarchy_level = 'imobiliaria'
            group by 1, 2
        )
        select
            a.regiao,
            a.imobiliaria,
            a.reservas_situacoes,
            a.mes_seguinte,
            a.prob_cair,
            abs(a.reservas_situacoes - a.mes_seguinte - a.prob_cair)::numeric as mes_atual,
            a.mp_reserva,
            a.repasses_assinados,
            (abs(a.reservas_situacoes - a.mes_seguinte - a.prob_cair) + a.mp_reserva + a.repasses_assinados)::numeric as prev_repasse,
            coalesce(m.meta, ({_sql_metas_reservas_padrao("a.imobiliaria")})::numeric, 0)::numeric as meta_ajustada,
            case when coalesce(m.meta, ({_sql_metas_reservas_padrao("a.imobiliaria")})::numeric, 0) > 0
                 then ((abs(a.reservas_situacoes - a.mes_seguinte - a.prob_cair) + a.mp_reserva + a.repasses_assinados) / coalesce(m.meta, ({_sql_metas_reservas_padrao("a.imobiliaria")})::numeric, 0) * 100)
                 else null end as alcancado_meta
        from agregado a
        left join metas m on m.regiao = a.regiao and m.imobiliaria = a.imobiliaria
        order by a.regiao asc, a.imobiliaria asc
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    itens = [_linha_para_dict(linha) for linha in linhas]
    totais_por_regiao: dict[str, dict[str, Any]] = {}
    for item in itens:
        regiao = str(item.get("regiao") or "Sem regiao")
        grupo = totais_por_regiao.setdefault(
            regiao,
            {
                "regiao": regiao,
                "imobiliaria": "Total",
                "reservas_situacoes": 0,
                "mes_seguinte": 0,
                "prob_cair": 0,
                "mes_atual": 0,
                "mp_reserva": 0,
                "repasses_assinados": 0,
                "prev_repasse": 0,
                "meta_ajustada": 0,
                "alcancado_meta": None,
                "is_total": True,
            },
        )
        for campo in (
            "reservas_situacoes",
            "mes_seguinte",
            "prob_cair",
            "mes_atual",
            "mp_reserva",
            "repasses_assinados",
            "prev_repasse",
            "meta_ajustada",
        ):
            grupo[campo] += float(item.get(campo) or 0)
    for grupo in totais_por_regiao.values():
        meta = float(grupo.get("meta_ajustada") or 0)
        grupo["alcancado_meta"] = (float(grupo.get("prev_repasse") or 0) / meta * 100) if meta else None
    return {"items": itens, "totalsByRegion": list(totais_por_regiao.values())}


async def _salvar_reservas_meta(conexao, payload: dict[str, Any]) -> dict[str, Any]:
    regiao = str(payload.get("regiao") or "").strip()
    imobiliaria = str(payload.get("imobiliaria") or "").strip()
    if not regiao or not imobiliaria:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Regiao e imobiliaria sao obrigatorias.")
    try:
        meta = Decimal(str(payload.get("meta")))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Meta invalida.") from exc
    hierarchy_value = f"{regiao}|||{imobiliaria}"
    linha = await conexao.fetchrow(
        f"""
        insert into {ESQUEMA_COMERCIAL}.dashboard_goals (
            kpi_id, goal_value, unit, target_type, quality_style, period_type,
            hierarchy_level, hierarchy_value, business_days_aware
        )
        values (
            'reservas_prev_repasse', $1::numeric, 'reservas', 'absolute', false, 'monthly',
            'imobiliaria', $2::text, false
        )
        on conflict (kpi_id, hierarchy_level, hierarchy_value)
        do update set
            goal_value = excluded.goal_value,
            unit = excluded.unit,
            target_type = excluded.target_type,
            quality_style = excluded.quality_style,
            business_days_aware = excluded.business_days_aware,
            updated_at = now()
        returning kpi_id, goal_value, hierarchy_level, hierarchy_value
        """,
        meta,
        hierarchy_value,
    )
    return _linha_para_dict(linha)


def _somar_eixo(items: list[dict[str, Any]]) -> float:
    return sum(float(item.get("value") or 0) for item in items)


def _status_auditoria(diferenca: float, tolerancia: float = 0.01) -> str:
    return "ok" if abs(float(diferenca or 0)) <= tolerancia else "divergente"


async def _auditar_card_expandido(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
    kpi: str,
    resumo: dict[str, Any],
    tendencias: list[dict[str, Any]],
) -> dict[str, Any]:
    config = EXPANDED_CARD_AUDIT_KPIS[kpi]
    valor_summary = float(resumo.get(config["summary"]) or 0)
    soma_tendencia = sum(float(item.get(config["trend"]) or 0) for item in tendencias)
    diff_tendencia = soma_tendencia - valor_summary

    eixos = [
        *SEGMENTED_OPERATION_FIELDS,
        *SEGMENTED_CORRETOR_FIELDS,
        *SEGMENTED_SDR_FIELDS,
    ]
    breakdowns = {
        eixo: await _breakdown_segmentado_eixo(conexao, eixo, kpi, intervalo, request, 1000)
        for eixo in eixos
    }
    totais_eixo = {
        eixo: {
            "total": _somar_eixo(items),
            "rows": len(items),
            "scope": (
                "corretor"
                if eixo in SEGMENTED_CORRETOR_FIELDS
                else ("sdr" if eixo in SEGMENTED_SDR_FIELDS else "operacao")
            ),
        }
        for eixo, items in breakdowns.items()
    }

    detalhe: dict[str, Any] = {}
    if kpi == "repasses":
        repasses_elegiveis = float(resumo.get("total_repasses_elegiveis") or 0)
        repasses_nao_elegiveis = float(resumo.get("total_repasses_nao_elegiveis") or 0)
        detalhe = {
            "fato_total": float(resumo.get("total_repasses_fato") or valor_summary),
            "atribuido_funcionarios": repasses_elegiveis,
            "sem_vinculo_funcionarios": repasses_nao_elegiveis,
        }
    elif kpi == "propostas":
        detalhe = {
            "aprovadas": float(resumo.get("total_propostas_aprovadas") or 0),
            "condicionadas": float(resumo.get("total_propostas_condicionadas") or 0),
            "reprovadas": float(resumo.get("total_propostas_reprovadas") or 0),
            "total": valor_summary,
        }
    elif kpi in {"ipc_corretor", "ipc_imobiliaria"}:
        detalhe = {
            "repasses_fato": float(resumo.get("total_repasses") or 0),
            "repasses_atribuidos_funcionarios": float(resumo.get("total_repasses_elegiveis") or 0),
            "repasses_sem_vinculo_funcionarios": float(resumo.get("total_repasses_nao_elegiveis") or 0),
            "corretores_ativos": float(resumo.get("ipc_corretores_ativos") or 0),
            "imobiliarias_ativas": float(resumo.get("ipc_imobiliarias_ativas") or 0),
        }
    elif kpi == "sla_f":
        detalhe = {
            "base_casos": sum(float(item.get("sla_finalizacao_base") or 0) for item in tendencias),
            "endpoint_especial": "sla-finalizacao-insights",
        }
    elif kpi == "sla_r":
        detalhe = {
            "base_casos": sum(float(item.get("sla_repasse_base") or 0) for item in tendencias),
            "endpoint_especial": "sla-repasse-insights",
        }

    return {
        "kpi": kpi,
        "summaryField": config["summary"],
        "trendField": config["trend"],
        "additive": config["additive"],
        "summaryValue": valor_summary,
        "trendTotal": soma_tendencia,
        "trendDifference": diff_tendencia,
        "trendStatus": _status_auditoria(diff_tendencia) if config["additive"] else "formula",
        "axisTotals": totais_eixo,
        "detail": detalhe,
    }


def _funil_etapa(valor: str | None) -> dict[str, Any]:
    etapa = FUNIL_ETAPA_POR_CHAVE.get(str(valor or "").strip().lower())
    if not etapa:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Etapa invalida.")
    return etapa


def _funil_filtros_base(request: Request, indice: int) -> tuple[str, list[Any]]:
    mapa = {
        nome: (coluna if "(" in coluna or "::" in coluna else f"b.{coluna}")
        for nome, coluna in FILTROS_BASE.items()
        if nome not in FUNIL_FILTROS_IGNORADOS
    }
    return _montar_where_dimensoes(request, mapa, indice)


def _funil_filtros_kpi(request: Request, indice: int, alias: str = "kd") -> tuple[str, list[Any]]:
    prefixo = f"{alias}." if alias else ""
    mapa = {
        nome: (coluna if "(" in coluna or "::" in coluna else f"{prefixo}{coluna}")
        for nome, coluna in FILTROS_KPI.items()
        if nome not in FUNIL_FILTROS_IGNORADOS
    }
    return _montar_where_dimensoes(request, mapa, indice)


FUNIL_DOCUMENTO_CLIENTE_SQL = (
    "nullif(regexp_replace(coalesce(b.cliente_documento, b.dim_lead_cliente_documento, ''), '\\D', '', 'g'), '')"
)
FUNIL_REFERENCIA_RESERVA_SQL = "b.dt_cadastro_reserva"


def _funil_sla_classificacao_sql(situacao: str, sla: str) -> str:
    return f"""case
        when {situacao} in ('Lead', 'Atendimento - SDR', 'Atendimento - IA')
            then case when {sla} > 3 then 'SLA Expirado' else 'Dentro do SLA' end
        when {situacao} in ('Agendamento', 'Visita')
            then case when {sla} > 7 then 'SLA Expirado' else 'Dentro do SLA' end
        when {situacao} = 'Repescagem'
            then case when {sla} > 90 then 'SLA Expirado' else 'Dentro do SLA' end
        when {situacao} = 'Base'
            then case when {sla} > 5 then 'SLA Expirado' else 'Dentro do SLA' end
        when {situacao} = 'Tratativa'
            then case when {sla} > 30 then 'SLA Expirado' else 'Dentro do SLA' end
        else null
    end"""


def _funil_restricao_numero_sql(expressao: str) -> str:
    normalizado = f"nullif(replace(trim(({expressao})::text), ',', '.'), '')"
    return f"""case
        when {normalizado} is null then null::numeric
        when {normalizado} ~ '^-?[0-9]+(\\.[0-9]+)?$' then {normalizado}::numeric
        else -1::numeric
    end"""


def _funil_restricao_classificacao_sql(restricao: str) -> str:
    return f"""case
        when {restricao} is null or {restricao} = 0 then 'Sem Restrição'
        when {restricao} between 100 and 300 then 'Restrição Baixa'
        else 'Restrição Acima'
    end"""


def _funil_select_final(situacao: str, sla: str, restricao: str) -> str:
    return f"""
        chave,
        data_evento,
        idlead,
        idprecadastro,
        idreserva,
        idrepasse,
        situacao,
        cidade,
        empreendimento,
        corretor,
        sdr,
        origem,
        sla,
        {_funil_sla_classificacao_sql(situacao, sla)} as sla_classificacao,
        restricao_lead,
        {_funil_restricao_classificacao_sql(restricao)} as restricao_classificacao
    """


def _funil_query_base(etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> tuple[str, list[Any]]:
    where_filtros, parametros = _funil_filtros_base(request, 3)
    if etapa["key"] == "vendas":
        restricao = _funil_restricao_numero_sql("b.fl_restricao_lead")
        sql = f"""
            with vendas_canonicas as (
                select distinct on ({_sql_venda_cliente_mes_chave('base')})
                    base.*
                from {ESQUEMA_COMERCIAL}.comercial_base base
                where base.idreserva is not null
                  and {_sql_venda_data_referencia('base')} >= $1::date
                  and {_sql_venda_data_referencia('base')} < ($2::date + interval '1 day')
                order by {_sql_venda_cliente_mes_chave('base')}, {_sql_venda_ordem_canonica('base')}
            ),
            detail_rows as (
                select
                    {_sql_venda_cliente_mes_chave('b')} as chave,
                    {_sql_venda_data_referencia('b')} as data_evento,
                    b.idlead::text as idlead,
                    b.idprecadastro::text as idprecadastro,
                    b.idreserva::text as idreserva,
                    b.idrepasse::text as idrepasse,
                    b.reserva_situacao_nome as situacao,
                    b.lead_cidade as cidade,
                    b.empreendimento_nome as empreendimento,
                    coalesce(nullif(b.corretor_nome_canonico, ''), nullif(b.corretor_nome, '')) as corretor,
                    b.sdr_nome as sdr,
                    b.lead_origem_nome as origem,
                    null::numeric as sla,
                    {restricao} as restricao_lead
                from vendas_canonicas b
                where b.idreserva is not null
                  {where_filtros}
            )
            select {_funil_select_final("situacao", "sla", "restricao_lead")}
            from detail_rows
        """
        return sql, [intervalo.inicio, intervalo.fim, *parametros]

    key_expr = {
        "lead": "b.idlead::text",
        "visita": "b.idlead::text",
        "vendas": "b.idreserva::text",
        "vendas_finalizadas": "b.idrepasse::text",
        "repasse": "b.idrepasse::text",
    }[etapa["key"]]
    date_expr = {
        "lead": "b.dt_ultima_conversao_lead",
        "visita": "b.dt_visita_realizada",
        "vendas": FUNIL_REFERENCIA_RESERVA_SQL,
        "vendas_finalizadas": "b.dt_cadastro_repasse",
        "repasse": "b.dt_assinatura_contrato",
    }[etapa["key"]]
    extra = {
        "lead": "b.idlead is not null",
        "visita": "b.idlead is not null and b.dt_visita_realizada is not null",
        "vendas": f"b.idreserva is not null and {FUNIL_REFERENCIA_RESERVA_SQL} is not null and not ({_sql_reserva_cancelada('b')})",
        "vendas_finalizadas": "b.idrepasse is not null and b.dt_cadastro_repasse is not null",
        "repasse": "b.idrepasse is not null and coalesce(b.fl_repasse_assinado, false) = true",
    }[etapa["key"]]
    restricao = _funil_restricao_numero_sql("b.fl_restricao_lead")
    sql = f"""
        with detail_rows as (
            select
                {key_expr} as chave,
                {date_expr} as data_evento,
                b.idlead::text as idlead,
                b.idprecadastro::text as idprecadastro,
                b.idreserva::text as idreserva,
                b.idrepasse::text as idrepasse,
                b.lead_situacao_nome as situacao,
                b.lead_cidade as cidade,
                b.empreendimento_nome as empreendimento,
                coalesce(nullif(b.corretor_nome_canonico, ''), nullif(b.corretor_nome, '')) as corretor,
                b.sdr_nome as sdr,
                b.lead_origem_nome as origem,
                null::numeric as sla,
                {restricao} as restricao_lead
            from {ESQUEMA_COMERCIAL}.comercial_base b
            where {date_expr} >= $1::date
              and {date_expr} < ($2::date + interval '1 day')
              and {extra}
              {where_filtros}
        )
        select {_funil_select_final("situacao", "sla", "restricao_lead")}
        from (
            select distinct on (chave) *
              from detail_rows
             order by chave, data_evento desc nulls last
        ) detail_rows
    """
    return sql, [intervalo.inicio, intervalo.fim, *parametros]


def _funil_query_historico(etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> tuple[str, list[Any]]:
    where_filtros, parametros = _funil_filtros_base(request, 5)
    dedupe_agendamento = etapa["key"] == "agendamento"
    distinct_clause = "distinct on (lh.idlead)" if dedupe_agendamento else ""
    order_clause = (
        "order by lh.idlead, lh.dt_referencia desc nulls last, lh.historico_status_key desc nulls last"
        if dedupe_agendamento
        else ""
    )
    lead_required_clause = "and lh.idlead is not null" if dedupe_agendamento else ""
    if not parametros:
        sql = f"""
            with detail_rows as (
                select {distinct_clause}
                    coalesce(lh.historico_status_key, concat_ws('|', lh.idlead::text, lh.dt_referencia::text, lh.situacao_para)) as chave,
                    lh.dt_referencia as data_evento,
                    lh.idlead::text as idlead,
                    null::text as idprecadastro,
                    null::text as idreserva,
                    null::text as idrepasse,
                    lh.situacao_para as situacao,
                    null::text as cidade,
                    null::text as empreendimento,
                    null::text as corretor,
                    null::text as sdr,
                    null::text as origem,
                    null::numeric as sla,
                    null::numeric as restricao_lead
                from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                where lh.dt_referencia >= $1::date
                  and lh.dt_referencia < ($2::date + interval '1 day')
                  and (
                        lh.situacao_para = any($3::text[])
                        or coalesce(lh.funil_status_grupo, lh.agendamento_status_grupo) = any($4::text[])
                        or lh.agendamento_status_grupo = any($4::text[])
                  )
                  {lead_required_clause}
                {order_clause}
            )
            select {_funil_select_final("situacao", "sla", "restricao_lead")}
            from detail_rows
        """
        return sql, [
            intervalo.inicio,
            intervalo.fim,
            list(etapa.get("statuses") or []),
            list(etapa.get("status_groups") or []),
        ]

    restricao = _funil_restricao_numero_sql("b.fl_restricao_lead")
    sql = f"""
        with detail_rows as (
            select {distinct_clause}
                coalesce(lh.historico_status_key, concat_ws('|', lh.idlead::text, lh.dt_referencia::text, lh.situacao_para)) as chave,
                lh.dt_referencia as data_evento,
                lh.idlead::text as idlead,
                b.idprecadastro::text as idprecadastro,
                b.idreserva::text as idreserva,
                b.idrepasse::text as idrepasse,
                coalesce(lh.situacao_para, b.lead_situacao_nome) as situacao,
                b.lead_cidade as cidade,
                b.empreendimento_nome as empreendimento,
                coalesce(nullif(b.corretor_nome_canonico, ''), nullif(b.corretor_nome, '')) as corretor,
                b.sdr_nome as sdr,
                b.lead_origem_nome as origem,
                null::numeric as sla,
                {restricao} as restricao_lead
            from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
            left join lateral (
                select b.*
                from {ESQUEMA_COMERCIAL}.comercial_base b
                where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                   or (lh.idlead is not null and b.idlead = lh.idlead)
                order by
                    case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                    b.dt_ultima_conversao_lead desc nulls last,
                    b.fato_jornada_comercial_key
                limit 1
            ) b on true
            where lh.dt_referencia >= $1::date
              and lh.dt_referencia < ($2::date + interval '1 day')
              and (
                    lh.situacao_para = any($3::text[])
                    or coalesce(lh.funil_status_grupo, lh.agendamento_status_grupo) = any($4::text[])
                    or lh.agendamento_status_grupo = any($4::text[])
              )
              {lead_required_clause}
              {where_filtros}
            {order_clause}
        )
        select {_funil_select_final("situacao", "sla", "restricao_lead")}
        from detail_rows
    """
    return sql, [
        intervalo.inicio,
        intervalo.fim,
        list(etapa.get("statuses") or []),
        list(etapa.get("status_groups") or []),
        *parametros,
    ]


def _funil_query_propostas(etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> tuple[str, list[Any]]:
    where_filtros, parametros = _funil_filtros_base(request, 4)
    data_resposta = "coalesce(b.dt_resposta_analise_precadastro, pc.dt_ultimo_historico_data)"
    if not parametros:
        sql = f"""
            with detail_rows as (
                select
                    pc.idprecadastro::text as chave,
                    pc.dt_ultimo_historico_data as data_evento,
                    null::text as idlead,
                    pc.idprecadastro::text as idprecadastro,
                    null::text as idreserva,
                    null::text as idrepasse,
                    pc.proposta_status_atual as situacao,
                    null::text as cidade,
                    null::text as empreendimento,
                    null::text as corretor,
                    null::text as sdr,
                    null::text as origem,
                    null::numeric as sla,
                    null::numeric as restricao_lead
                from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                where pc.dt_ultimo_historico_data >= $1::date
                  and pc.dt_ultimo_historico_data < ($2::date + interval '1 day')
                  and pc.idprecadastro is not null
                  and pc.proposta_status_atual = any($3::text[])
            )
            select {_funil_select_final("situacao", "sla", "restricao_lead")}
            from detail_rows
        """
        return sql, [intervalo.inicio, intervalo.fim, list(etapa.get("statuses") or [])]

    restricao = _funil_restricao_numero_sql("b.fl_restricao_lead")
    sql = f"""
        with detail_rows as (
            select distinct on (pc.idprecadastro)
                pc.idprecadastro::text as chave,
                {data_resposta} as data_evento,
                b.idlead::text as idlead,
                pc.idprecadastro::text as idprecadastro,
                b.idreserva::text as idreserva,
                b.idrepasse::text as idrepasse,
                pc.proposta_status_atual as situacao,
                b.lead_cidade as cidade,
                b.empreendimento_nome as empreendimento,
                coalesce(nullif(b.corretor_nome_canonico, ''), nullif(b.corretor_nome, '')) as corretor,
                b.sdr_nome as sdr,
                b.lead_origem_nome as origem,
                null::numeric as sla,
                {restricao} as restricao_lead
            from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
            left join lateral (
                select b.*
                from {ESQUEMA_COMERCIAL}.comercial_base b
                where b.idprecadastro = pc.idprecadastro
                   or (pc.journey_id is not null and b.journey_id = pc.journey_id)
                order by
                    case when b.idprecadastro = pc.idprecadastro then 1 else 2 end,
                    b.dt_resposta_analise_precadastro desc nulls last,
                    b.dt_ultima_conversao_lead desc nulls last,
                    b.fato_jornada_comercial_key
                limit 1
            ) b on true
            where {data_resposta} >= $1::date
              and {data_resposta} < ($2::date + interval '1 day')
              and pc.idprecadastro is not null
              and pc.proposta_status_atual = any($3::text[])
              {where_filtros}
            order by pc.idprecadastro, {data_resposta} desc nulls last
        )
        select {_funil_select_final("situacao", "sla", "restricao_lead")}
        from detail_rows
    """
    return sql, [intervalo.inicio, intervalo.fim, list(etapa.get("statuses") or []), *parametros]


def _funil_query(etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> tuple[str, list[Any]]:
    if etapa["source"] == "historico":
        return _funil_query_historico(etapa, request, intervalo)
    if etapa["source"] == "propostas":
        return _funil_query_propostas(etapa, request, intervalo)
    return _funil_query_base(etapa, request, intervalo)


def _funil_count_query(etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> tuple[str, list[Any]]:
    if etapa["source"] == "historico":
        where_filtros, parametros = _funil_filtros_base(request, 5)
        precisa_base = bool(parametros)
        join_base = ""
        if precisa_base:
            join_base = f"""
                left join lateral (
                    select b.*
                    from {ESQUEMA_COMERCIAL}.comercial_base b
                    where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                       or (lh.idlead is not null and b.idlead = lh.idlead)
                    order by
                        case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                        b.dt_ultima_conversao_lead desc nulls last,
                        b.fato_jornada_comercial_key
                    limit 1
                ) b on true
            """
        total_expr = "count(distinct lh.idlead)::bigint" if etapa["key"] == "agendamento" else "count(*)::bigint"
        lead_required_clause = "and lh.idlead is not null" if etapa["key"] == "agendamento" else ""
        sql = f"""
            select {total_expr} as total
              from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
              {join_base}
             where lh.dt_referencia >= $1::date
               and lh.dt_referencia < ($2::date + interval '1 day')
               and (
                    lh.situacao_para = any($3::text[])
                    or coalesce(lh.funil_status_grupo, lh.agendamento_status_grupo) = any($4::text[])
                    or lh.agendamento_status_grupo = any($4::text[])
               )
               {lead_required_clause}
               {where_filtros if precisa_base else ""}
        """
        return sql, [
            intervalo.inicio,
            intervalo.fim,
            list(etapa.get("statuses") or []),
            list(etapa.get("status_groups") or []),
            *parametros,
        ]

    if etapa["key"] == "prop_aprovada_condicionada":
        where_filtros, parametros = _funil_filtros_kpi(request, 3)
        sql = f"""
            select (
                coalesce(sum(kd.propostas_aprovadas), 0)
              + coalesce(sum(kd.propostas_condicionadas), 0)
            )::bigint as total
              from {ESQUEMA_COMERCIAL}.comercial_kpi_daily kd
             where kd.data >= $1::date
               and kd.data <= $2::date
               {where_filtros}
        """
        return sql, [intervalo.inicio, intervalo.fim, *parametros]

    if etapa["source"] == "propostas":
        where_filtros, parametros = _funil_filtros_base(request, 4)
        data_resposta = "coalesce(b.dt_resposta_analise_precadastro, pc.dt_ultimo_historico_data)"
        if not parametros:
            sql = f"""
                select count(distinct pc.idprecadastro)::bigint as total
                  from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                 where pc.dt_ultimo_historico_data >= $1::date
                   and pc.dt_ultimo_historico_data < ($2::date + interval '1 day')
                   and pc.idprecadastro is not null
                   and pc.proposta_status_atual = any($3::text[])
            """
            return sql, [intervalo.inicio, intervalo.fim, list(etapa.get("statuses") or [])]

        sql = f"""
            select count(distinct pc.idprecadastro)::bigint as total
              from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
              left join lateral (
                  select b.*
                  from {ESQUEMA_COMERCIAL}.comercial_base b
                  where b.idprecadastro = pc.idprecadastro
                     or (pc.journey_id is not null and b.journey_id = pc.journey_id)
                  order by
                      case when b.idprecadastro = pc.idprecadastro then 1 else 2 end,
                      b.dt_resposta_analise_precadastro desc nulls last,
                      b.dt_ultima_conversao_lead desc nulls last,
                      b.fato_jornada_comercial_key
                  limit 1
              ) b on true
             where {data_resposta} >= $1::date
               and {data_resposta} < ($2::date + interval '1 day')
               and pc.idprecadastro is not null
               and pc.proposta_status_atual = any($3::text[])
               {where_filtros}
        """
        return sql, [intervalo.inicio, intervalo.fim, list(etapa.get("statuses") or []), *parametros]

    if etapa["key"] == "vendas":
        where_filtros, parametros = _funil_filtros_base(request, 3)
        sql = f"""
            with vendas_canonicas as (
                select distinct on ({_sql_venda_cliente_mes_chave('base')})
                    base.*
                from {ESQUEMA_COMERCIAL}.comercial_base base
                where base.idreserva is not null
                  and {_sql_venda_data_referencia('base')} >= $1::date
                  and {_sql_venda_data_referencia('base')} < ($2::date + interval '1 day')
                order by {_sql_venda_cliente_mes_chave('base')}, {_sql_venda_ordem_canonica('base')}
            )
            select count(*)::bigint as total
              from vendas_canonicas b
             where b.idreserva is not null
               {where_filtros}
        """
        return sql, [intervalo.inicio, intervalo.fim, *parametros]

    where_filtros, parametros = _funil_filtros_base(request, 3)
    key_expr = {
        "lead": "b.idlead",
        "visita": "b.idlead",
        "vendas": "b.idreserva",
        "vendas_finalizadas": "b.idrepasse",
        "repasse": "b.idrepasse",
    }[etapa["key"]]
    date_expr = {
        "lead": "b.dt_ultima_conversao_lead",
        "visita": "b.dt_visita_realizada",
        "vendas": FUNIL_REFERENCIA_RESERVA_SQL,
        "vendas_finalizadas": "b.dt_cadastro_repasse",
        "repasse": "b.dt_assinatura_contrato",
    }[etapa["key"]]
    extra = {
        "lead": "b.idlead is not null",
        "visita": "b.idlead is not null and b.dt_visita_realizada is not null",
        "vendas": f"b.idreserva is not null and {FUNIL_REFERENCIA_RESERVA_SQL} is not null and not ({_sql_reserva_cancelada('b')})",
        "vendas_finalizadas": "b.idrepasse is not null and b.dt_cadastro_repasse is not null",
        "repasse": "b.idrepasse is not null and coalesce(b.fl_repasse_assinado, false) = true",
    }[etapa["key"]]
    sql = f"""
        select count(distinct {key_expr})::bigint as total
          from {ESQUEMA_COMERCIAL}.comercial_base b
         where {date_expr} >= $1::date
           and {date_expr} < ($2::date + interval '1 day')
           and {extra}
           {where_filtros}
    """
    return sql, [intervalo.inicio, intervalo.fim, *parametros]


async def _funil_valor(conexao, etapa: dict[str, Any], request: Request, intervalo: IntervaloDatas) -> int:
    sql, parametros = _funil_count_query(etapa, request, intervalo)
    linha = await conexao.fetchrow(sql, *parametros)
    return int(linha["total"] or 0)


async def _funil_sla_transicoes_leve(conexao, request: Request, intervalo: IntervaloDatas) -> dict[str, float]:
    where_filtros, parametros = _funil_filtros_base(request, 3)
    resultados: dict[str, float] = {}

    async def buscar(chave: str, sql: str, *extras: Any) -> None:
        valor = await conexao.fetchval(sql, intervalo.inicio, intervalo.fim, *extras)
        if valor is not None:
            resultados[chave] = float(valor)

    await buscar(
        "lead",
        f"""
        with atuais as (
            select distinct on (b.idlead)
                b.idlead,
                b.dt_ultima_conversao_lead as data_evento
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_ultima_conversao_lead >= $1::date
               and b.dt_ultima_conversao_lead < ($2::date + interval '1 day')
               and b.idlead is not null
               {where_filtros}
             order by b.idlead, b.dt_ultima_conversao_lead desc nulls last
        ),
        pares as (
            select a.data_evento, min(lh.dt_referencia) as proxima_data
              from atuais a
              join {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                on lh.idlead = a.idlead
               and lh.dt_referencia >= a.data_evento
               and (
                    lh.situacao_para in ('Atendimento - IA', 'Atendimento - SDR')
                    or coalesce(lh.funil_status_grupo, '') = 'ATENDIMENTO'
               )
             group by a.idlead, a.data_evento
        )
        select round(avg(extract(epoch from (proxima_data::timestamp - data_evento::timestamp)) / 86400)::numeric, 1)
          from pares
         where proxima_data is not null
        """,
        *parametros,
    )

    await buscar(
        "atendimento",
        f"""
        with atuais as (
            select lh.idlead, lh.dt_referencia as data_evento
              from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
              left join lateral (
                  select b.*
                    from {ESQUEMA_COMERCIAL}.comercial_base b
                   where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                      or (lh.idlead is not null and b.idlead = lh.idlead)
                   order by
                      case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                      b.dt_ultima_conversao_lead desc nulls last,
                      b.fato_jornada_comercial_key
                   limit 1
              ) b on true
             where lh.dt_referencia >= $1::date
               and lh.dt_referencia < ($2::date + interval '1 day')
               and lh.idlead is not null
               and (
                    lh.situacao_para in ('Atendimento - IA', 'Atendimento - SDR')
                    or coalesce(lh.funil_status_grupo, '') = 'ATENDIMENTO'
               )
               {where_filtros}
        ),
        pares as (
            select a.data_evento, min(lh.dt_referencia) as proxima_data
              from atuais a
              join {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                on lh.idlead = a.idlead
               and lh.dt_referencia >= a.data_evento
               and (
                    coalesce(lh.funil_status_grupo, '') in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.situacao_para in ('Agendado', 'Agendado - IA', 'Agendamento', 'Agendamento - IA')
               )
             group by a.idlead, a.data_evento
        )
        select round(avg(extract(epoch from (proxima_data::timestamp - data_evento::timestamp)) / 86400)::numeric, 1)
          from pares
         where proxima_data is not null
        """,
        *parametros,
    )

    await buscar(
        "agendamento",
        f"""
        with atuais as (
            select distinct on (lh.idlead)
                lh.idlead,
                lh.dt_referencia as data_evento
              from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
              left join lateral (
                  select b.*
                    from {ESQUEMA_COMERCIAL}.comercial_base b
                   where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                      or (lh.idlead is not null and b.idlead = lh.idlead)
                   order by
                      case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                      b.dt_ultima_conversao_lead desc nulls last,
                      b.fato_jornada_comercial_key
                   limit 1
              ) b on true
             where lh.dt_referencia >= $1::date
               and lh.dt_referencia < ($2::date + interval '1 day')
               and lh.idlead is not null
               and (
                    coalesce(lh.funil_status_grupo, '') in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.situacao_para in ('Agendado', 'Agendado - IA', 'Agendamento', 'Agendamento - IA')
               )
               {where_filtros}
             order by lh.idlead, lh.dt_referencia desc nulls last, lh.historico_status_key desc nulls last
        ),
        pares as (
            select a.data_evento, min(b.dt_visita_realizada) as proxima_data
              from atuais a
              join {ESQUEMA_COMERCIAL}.comercial_base b
                on b.idlead = a.idlead
               and b.dt_visita_realizada >= a.data_evento
             group by a.idlead, a.data_evento
        )
        select round(avg(extract(epoch from (proxima_data::timestamp - data_evento::timestamp)) / 86400)::numeric, 1)
          from pares
         where proxima_data is not null
        """,
        *parametros,
    )

    await buscar(
        "visita",
        f"""
        with atuais as (
            select distinct on (b.idlead)
                b.idlead,
                b.dt_visita_realizada as data_evento
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_visita_realizada >= $1::date
               and b.dt_visita_realizada < ($2::date + interval '1 day')
               and b.idlead is not null
               {where_filtros}
             order by b.idlead, b.dt_visita_realizada desc nulls last
        ),
        pares as (
            select a.data_evento, min(lh.dt_referencia) as proxima_data
              from atuais a
              join {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                on lh.idlead = a.idlead
               and lh.dt_referencia >= a.data_evento
               and (lh.situacao_para = 'Proposta' or coalesce(lh.funil_status_grupo, '') = 'PROPOSTA')
             group by a.idlead, a.data_evento
        )
        select round(avg(extract(epoch from (proxima_data::timestamp - data_evento::timestamp)) / 86400)::numeric, 1)
          from pares
         where proxima_data is not null
        """,
        *parametros,
    )

    await buscar(
        "vendas",
        f"""
        with vendas_canonicas as (
            select distinct on ({_sql_venda_cliente_mes_chave('base')})
                base.*
            from {ESQUEMA_COMERCIAL}.comercial_base base
            where base.idreserva is not null
              and {_sql_venda_data_referencia('base')} >= $1::date
              and {_sql_venda_data_referencia('base')} < ($2::date + interval '1 day')
            order by {_sql_venda_cliente_mes_chave('base')}, {_sql_venda_ordem_canonica('base')}
        )
        select round(avg(extract(epoch from (b.dt_cadastro_repasse::timestamp - {_sql_venda_data_referencia('b')}::timestamp)) / 86400)::numeric, 1)
          from vendas_canonicas b
         where b.idreserva is not null
           and b.dt_cadastro_repasse is not null
           and b.dt_cadastro_repasse >= {_sql_venda_data_referencia('b')}
           {where_filtros}
        """,
        *parametros,
    )

    await buscar(
        "vendas_finalizadas",
        f"""
        select round(avg(extract(epoch from (b.dt_assinatura_contrato::timestamp - b.dt_cadastro_repasse::timestamp)) / 86400)::numeric, 1)
          from {ESQUEMA_COMERCIAL}.comercial_base b
         where b.dt_cadastro_repasse >= $1::date
           and b.dt_cadastro_repasse < ($2::date + interval '1 day')
           and b.idrepasse is not null
           and b.dt_assinatura_contrato is not null
           and b.dt_assinatura_contrato >= b.dt_cadastro_repasse
           {where_filtros}
        """,
        *parametros,
    )

    return resultados


async def _funil_sla_transicoes(conexao, request: Request, intervalo: IntervaloDatas) -> dict[str, float]:
    return await _funil_sla_transicoes_leve(conexao, request, intervalo)


async def _funil_metricas_laterais(conexao, request: Request, intervalo: IntervaloDatas) -> list[dict[str, Any]]:
    where_kpi, parametros = _funil_filtros_kpi(request, 3)
    linha = await conexao.fetchrow(
        f"""
        select
            coalesce(sum(kd.cancelamentos), 0)::numeric as cancelados,
            coalesce(sum(kd.distratos), 0)::numeric as distratos
          from {ESQUEMA_COMERCIAL}.comercial_kpi_daily kd
         where kd.data >= $1::date
           and kd.data <= $2::date
           {where_kpi}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros,
    )
    return [
        {
            "key": "cancelados",
            "label": "CANCELADO",
            "value": float(linha["cancelados"] if linha else 0),
            "outsideConversion": True,
            "rule": "Indicador lateral: cancelamentos no periodo pelos filtros gerais; nao entra no calculo de conversao do funil.",
        },
        {
            "key": "distratos",
            "label": "DISTRATO",
            "value": float(linha["distratos"] if linha else 0),
            "outsideConversion": True,
            "rule": "Indicador lateral: distratos no periodo pelos filtros gerais; nao entra no calculo de conversao do funil.",
        },
    ]


async def _funil_metricas_diarias(conexao, request: Request, intervalo: IntervaloDatas) -> dict[str, dict[str, Any]]:
    where_filtros, parametros = _funil_filtros_base(request, 3)
    where_kpi, parametros_kpi = _funil_filtros_kpi(request, 3 + len(parametros))
    usar_base_para_filtros = bool(parametros)
    historico_join_base = ""
    if usar_base_para_filtros:
        historico_join_base = f"""
              left join lateral (
                  select b.*
                  from {ESQUEMA_COMERCIAL}.comercial_base b
                  where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                     or (lh.idlead is not null and b.idlead = lh.idlead)
                  order by
                      case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                      b.dt_ultima_conversao_lead desc nulls last,
                      b.fato_jornada_comercial_key
                  limit 1
              ) b on true
        """
    linhas = await conexao.fetch(
        f"""
        with dias as (
            select generate_series($1::date, $2::date, interval '1 day')::date as data
        ),
        base_eventos as (
            select
                b.dt_ultima_conversao_lead::date as data,
                count(distinct b.idlead)::numeric as leads,
                0::numeric as visitas,
                0::numeric as vendas,
                0::numeric as vendas_finalizadas,
                0::numeric as repasses
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_ultima_conversao_lead >= $1::date
               and b.dt_ultima_conversao_lead < ($2::date + interval '1 day')
               and b.idlead is not null
               {where_filtros}
             group by 1
            union all
            select
                b.dt_visita_realizada::date as data,
                0::numeric as leads,
                count(distinct b.idlead)::numeric as visitas,
                0::numeric as vendas,
                0::numeric as vendas_finalizadas,
                0::numeric as repasses
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_visita_realizada >= $1::date
               and b.dt_visita_realizada < ($2::date + interval '1 day')
               and b.idlead is not null
               {where_filtros}
             group by 1
            union all
            select
                {_sql_venda_data_referencia('b')}::date as data,
                0::numeric as leads,
                0::numeric as visitas,
                count(*)::numeric as vendas,
                0::numeric as vendas_finalizadas,
                0::numeric as repasses
              from (
                  select distinct on ({_sql_venda_cliente_mes_chave('base')})
                      base.*
                  from {ESQUEMA_COMERCIAL}.comercial_base base
                  where base.idreserva is not null
                    and {_sql_venda_data_referencia('base')} >= $1::date
                    and {_sql_venda_data_referencia('base')} < ($2::date + interval '1 day')
                  order by {_sql_venda_cliente_mes_chave('base')}, {_sql_venda_ordem_canonica('base')}
              ) b
             where b.idreserva is not null
               {where_filtros}
             group by 1
            union all
            select
                b.dt_cadastro_repasse::date as data,
                0::numeric as leads,
                0::numeric as visitas,
                0::numeric as vendas,
                count(distinct b.idrepasse)::numeric as vendas_finalizadas,
                0::numeric as repasses
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_cadastro_repasse >= $1::date
               and b.dt_cadastro_repasse < ($2::date + interval '1 day')
               and b.idrepasse is not null
               {where_filtros}
             group by 1
            union all
            select
                b.dt_assinatura_contrato::date as data,
                0::numeric as leads,
                0::numeric as visitas,
                0::numeric as vendas,
                0::numeric as vendas_finalizadas,
                count(distinct b.idrepasse)::numeric as repasses
              from {ESQUEMA_COMERCIAL}.comercial_base b
             where b.dt_assinatura_contrato >= $1::date
               and b.dt_assinatura_contrato < ($2::date + interval '1 day')
               and b.idrepasse is not null
               and coalesce(b.fl_repasse_assinado, false) is true
               {where_filtros}
             group by 1
        ),
        base_diaria as (
            select
                data,
                coalesce(sum(leads), 0)::numeric as leads,
                coalesce(sum(visitas), 0)::numeric as visitas,
                coalesce(sum(vendas), 0)::numeric as vendas,
                coalesce(sum(vendas_finalizadas), 0)::numeric as vendas_finalizadas,
                coalesce(sum(repasses), 0)::numeric as repasses
              from base_eventos
             group by data
        ),
        historico_diario as (
            select
                lh.dt_referencia::date as data,
                count(*) filter (
                    where coalesce(lh.funil_status_grupo, '') = 'ATENDIMENTO'
                       or lh.situacao_para in ('Atendimento - IA', 'Atendimento - SDR')
                )::numeric as atendimentos,
                count(*) filter (
                    where coalesce(lh.funil_status_grupo, '') = 'PROPOSTA'
                       or lh.situacao_para = 'Proposta'
                )::numeric as proposta_funil
              from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
              {historico_join_base}
             where lh.dt_referencia >= $1::date
               and lh.dt_referencia < ($2::date + interval '1 day')
               and (
                    lh.situacao_para in (
                        'Atendimento - IA',
                        'Atendimento - SDR',
                        'Agendado',
                        'Agendado - IA',
                        'Agendamento',
                        'Agendamento - IA',
                        'Proposta'
                    )
                    or lh.funil_status_grupo in ('ATENDIMENTO', 'PROPOSTA', 'AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
               )
               {where_filtros}
             group by 1
        ),
        agendamentos_diario as (
            select
                ultimos.dt_referencia::date as data,
                count(*)::numeric as agendamentos
            from (
                select distinct on (lh.idlead)
                    lh.idlead,
                    lh.dt_referencia,
                    lh.historico_status_key
                from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                {historico_join_base}
                where lh.dt_referencia >= $1::date
                  and lh.dt_referencia < ($2::date + interval '1 day')
                  and lh.idlead is not null
                  and (
                       coalesce(lh.funil_status_grupo, '') in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                    or lh.situacao_para in ('Agendado', 'Agendado - IA', 'Agendamento', 'Agendamento - IA')
                    or lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                  )
                  {where_filtros}
                order by lh.idlead, lh.dt_referencia desc nulls last, lh.historico_status_key desc nulls last
            ) ultimos
            group by 1
        ),
        propostas_diarias as (
            select
                kd.data::date as data,
                coalesce(sum(kd.propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                coalesce(sum(kd.propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                coalesce(sum(kd.propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                (coalesce(sum(kd.propostas_aprovadas), 0) + coalesce(sum(kd.propostas_condicionadas), 0))::numeric as prop_aprovada_condicionada
              from {ESQUEMA_COMERCIAL}.comercial_kpi_daily kd
             where kd.data >= $1::date
               and kd.data <= $2::date
               {where_kpi}
             group by 1
        )
        select
            dias.data,
            coalesce(base_diaria.leads, 0)::numeric as leads,
            coalesce(historico_diario.atendimentos, 0)::numeric as atendimentos,
            coalesce(agendamentos_diario.agendamentos, 0)::numeric as agendamentos,
            coalesce(base_diaria.visitas, 0)::numeric as visitas,
            coalesce(historico_diario.proposta_funil, 0)::numeric as proposta_funil,
            coalesce(propostas_diarias.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
            coalesce(propostas_diarias.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
            coalesce(propostas_diarias.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
            coalesce(propostas_diarias.prop_aprovada_condicionada, 0)::numeric as prop_aprovada_condicionada,
            coalesce(base_diaria.vendas, 0)::numeric as vendas,
            coalesce(base_diaria.vendas_finalizadas, 0)::numeric as vendas_finalizadas,
            coalesce(base_diaria.repasses, 0)::numeric as repasses
          from dias
          left join base_diaria on base_diaria.data = dias.data
          left join historico_diario on historico_diario.data = dias.data
          left join agendamentos_diario on agendamentos_diario.data = dias.data
          left join propostas_diarias on propostas_diarias.data = dias.data
         order by dias.data
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros,
        *parametros_kpi,
    )
    return {str(linha["data"]): _linha_para_dict(linha) for linha in linhas}


def _aplicar_metricas_funil_resumo(dados: dict[str, Any], metricas_diarias: dict[str, dict[str, Any]]) -> None:
    def total(campo: str) -> float:
        return sum(float(item.get(campo) or 0) for item in metricas_diarias.values())

    dados["total_leads"] = total("leads")
    dados["total_atendimentos"] = total("atendimentos")
    dados["total_agendamentos"] = total("agendamentos")
    dados["total_visitas"] = total("visitas")
    dados["total_proposta_funil"] = total("proposta_funil")
    dados["total_propostas_aprovadas"] = total("propostas_aprovadas")
    dados["total_propostas_condicionadas"] = total("propostas_condicionadas")
    dados["total_propostas_reprovadas"] = total("propostas_reprovadas")
    dados["total_prop_aprovada_condicionada"] = total("prop_aprovada_condicionada")
    dados["total_propostas"] = dados["total_prop_aprovada_condicionada"]
    dados["total_propostas_geral"] = dados["total_prop_aprovada_condicionada"]
    dados["total_vendas"] = total("vendas")
    dados["total_vendas_finalizadas"] = total("vendas_finalizadas")
    dados["total_repasses"] = total("repasses")


def _aplicar_metricas_funil_tendencia(item: dict[str, Any], metricas: dict[str, Any]) -> None:
    item["leads"] = float(metricas.get("leads") or 0)
    item["atendimentos"] = float(metricas.get("atendimentos") or 0)
    item["agendamentos"] = float(metricas.get("agendamentos") or 0)
    item["visitas"] = float(metricas.get("visitas") or 0)
    item["proposta_funil"] = float(metricas.get("proposta_funil") or 0)
    item["propostas_aprovadas"] = float(metricas.get("propostas_aprovadas") or 0)
    item["propostas_condicionadas"] = float(metricas.get("propostas_condicionadas") or 0)
    item["propostas_reprovadas"] = float(metricas.get("propostas_reprovadas") or 0)
    item["prop_aprovada_condicionada"] = float(metricas.get("prop_aprovada_condicionada") or 0)
    item["propostas_total"] = item["prop_aprovada_condicionada"]
    item["propostas"] = item["prop_aprovada_condicionada"]
    item["vendas"] = float(metricas.get("vendas") or 0)
    item["vendas_finalizadas"] = float(metricas.get("vendas_finalizadas") or 0)
    item["repasses"] = float(metricas.get("repasses") or 0)


async def _funil_detalhe(
    conexao,
    etapa: dict[str, Any],
    request: Request,
    intervalo: IntervaloDatas,
    page: int,
    limit: int,
    sort_by: str,
    sort_dir: str,
) -> dict[str, Any]:
    sql, parametros = _funil_query(etapa, request, intervalo)
    mapa_sort = {
        "data_evento": "data_evento",
        "chave": "chave",
        "idlead": "idlead",
        "idprecadastro": "idprecadastro",
        "idreserva": "idreserva",
        "idrepasse": "idrepasse",
        "situacao": "situacao",
        "cidade": "cidade",
        "empreendimento": "empreendimento",
        "corretor": "corretor",
        "sdr": "sdr",
    }
    coluna = mapa_sort.get(sort_by, "data_evento")
    direcao = "asc" if str(sort_dir).lower() == "asc" else "desc"
    offset = max(page - 1, 0) * limit
    indice_limit = len(parametros) + 1
    indice_offset = len(parametros) + 2
    total = await _funil_valor(conexao, etapa, request, intervalo)
    linhas = await conexao.fetch(
        f"""
        with base as ({sql})
        select *
          from base
         order by {coluna} {direcao} nulls last
         limit ${indice_limit}
        offset ${indice_offset}
        """,
        *parametros,
        limit,
        offset,
    )
    rows = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        rows.append(item)
    return {
        "stage": etapa["label"],
        "stageKey": etapa["key"],
        "rows": rows,
        "total": total,
        "visualTotal": total,
        "auditOk": True,
        "page": page,
        "limit": limit,
    }


async def _funil_historico_entidade(
    conexao,
    request: Request,
    idlead: str | None,
    idprecadastro: str | None,
    idreserva: str | None,
    idrepasse: str | None,
) -> dict[str, Any]:
    def inteiro_ou_nulo(valor: str | None) -> int | None:
        texto = str(valor or "").strip()
        if not texto or not texto.isdigit():
            return None
        return int(texto)

    lead_id = inteiro_ou_nulo(idlead)
    proposta_id = inteiro_ou_nulo(idprecadastro)
    reserva_id = inteiro_ou_nulo(idreserva)
    repasse_id = inteiro_ou_nulo(idrepasse)

    if not any((lead_id, proposta_id, reserva_id, repasse_id)):
        return {"lead": [], "proposta": [], "reserva": [], "total": 0}

    lead_rows = []
    proposta_rows = []
    reserva_rows = []

    if lead_id is not None:
        linhas = await conexao.fetch(
            f"""
            with eventos as (
                select
                    lh.idlead,
                    lh.referencia_data,
                    lh.situacao_de,
                    lh.situacao_para,
                    lead(lh.situacao_para) over (
                        partition by lh.idlead
                        order by lh.referencia_data asc nulls last, lh.historico_status_key
                    ) as situacao_proxima,
                    lead(lh.referencia_data) over (
                        partition by lh.idlead
                        order by lh.referencia_data asc nulls last, lh.historico_status_key
                    ) as proxima_data
                from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                where lh.idlead = $1
            )
            select
                'lead'::text as tipo,
                idlead::text as entidade_id,
                referencia_data,
                situacao_de as situacao_anterior,
                situacao_para as situacao,
                situacao_proxima,
                case
                    when proxima_data is null or referencia_data is null then 0::numeric
                    else round((extract(epoch from (proxima_data - referencia_data)) / 3600)::numeric, 2)
                end as tempo_horas
            from eventos
            order by referencia_data desc nulls last
            limit 200
            """,
            lead_id,
        )
        lead_rows = [_linha_para_dict(linha) for linha in linhas]

    if proposta_id is not None:
        linhas = await conexao.fetch(
            f"""
            with eventos as (
                select
                    ph.idprecadastro,
                    ph.idreserva,
                    ph.idrepasse,
                    ph.referencia_data,
                    ph.situacao_de,
                    ph.situacao_para,
                    ph.proposta_status_grupo,
                    lead(ph.situacao_para) over (
                        partition by ph.idprecadastro
                        order by ph.referencia_data asc nulls last, ph.historico_status_key
                    ) as situacao_proxima,
                    lead(ph.referencia_data) over (
                        partition by ph.idprecadastro
                        order by ph.referencia_data asc nulls last, ph.historico_status_key
                    ) as proxima_data
                from {ESQUEMA_COMERCIAL}.comercial_propostas_historico ph
                where ph.idprecadastro = $1
            )
            select
                'proposta'::text as tipo,
                idprecadastro::text as entidade_id,
                idreserva::text as idreserva,
                idrepasse::text as idrepasse,
                referencia_data,
                situacao_de as situacao_anterior,
                coalesce(proposta_status_grupo, situacao_para) as situacao,
                situacao_proxima,
                case
                    when proxima_data is null or referencia_data is null then 0::numeric
                    else round((extract(epoch from (proxima_data - referencia_data)) / 3600)::numeric, 2)
                end as tempo_horas
            from eventos
            order by referencia_data desc nulls last
            limit 200
            """,
            proposta_id,
        )
        proposta_rows = [_linha_para_dict(linha) for linha in linhas]

    if reserva_id is not None:
        where_filtros, parametros = _funil_filtros_base(request, 2)
        linhas = await conexao.fetch(
            f"""
            select *
            from (
                select distinct on (b.idreserva)
                    'reserva'::text as tipo,
                    b.idreserva::text as entidade_id,
                    b.idlead::text as idlead,
                    b.idprecadastro::text as idprecadastro,
                    b.idrepasse::text as idrepasse,
                    coalesce(b.dt_referencia_reserva, b.dt_cadastro_reserva) as referencia_data,
                    b.lead_situacao_nome as situacao_anterior,
                    coalesce(b.reserva_situacao_nome, b.repasse_situacao_nome, b.precadastro_situacao_nome) as situacao,
                    b.repasse_situacao_nome as situacao_proxima,
                    0::numeric as tempo_horas,
                    b.empreendimento_nome as empreendimento,
                    coalesce(nullif(b.corretor_nome_canonico, ''), nullif(b.corretor_nome, '')) as corretor,
                    b.sdr_nome as sdr
                from {ESQUEMA_COMERCIAL}.comercial_base b
                where b.idreserva = $1
                  {where_filtros}
                order by b.idreserva, coalesce(b.dt_referencia_reserva, b.dt_cadastro_reserva) desc nulls last
            ) reserva_contexto
            """,
            reserva_id,
            *parametros,
        )
        reserva_rows = [_linha_para_dict(linha) for linha in linhas]

    return {
        "lead": lead_rows,
        "proposta": proposta_rows,
        "reserva": reserva_rows,
        "total": len(lead_rows) + len(proposta_rows) + len(reserva_rows),
        "identifiers": {
            "idlead": lead_id,
            "idprecadastro": proposta_id,
            "idreserva": reserva_id,
            "idrepasse": repasse_id,
        },
    }


def _dias_uteis(inicio: date, fim: date) -> int:
    if inicio > fim:
        return 0
    atual = inicio
    total = 0
    while atual <= fim:
        if atual.weekday() < 5:
            total += 1
        atual += timedelta(days=1)
    return total


def _intervalo_trimestre(referencia: date) -> IntervaloDatas:
    mes_inicio = ((referencia.month - 1) // 3) * 3 + 1
    inicio = date(referencia.year, mes_inicio, 1)
    mes_fim = mes_inicio + 2
    if mes_fim == 12:
        fim = date(referencia.year, 12, 31)
    else:
        fim = date(referencia.year, mes_fim + 1, 1) - timedelta(days=1)
    return IntervaloDatas(inicio=inicio, fim=fim)


def _intervalo_mes(referencia: date) -> IntervaloDatas:
    inicio = date(referencia.year, referencia.month, 1)
    if referencia.month == 12:
        fim = date(referencia.year, 12, 31)
    else:
        fim = date(referencia.year, referencia.month + 1, 1) - timedelta(days=1)
    return IntervaloDatas(inicio=inicio, fim=fim)


async def _funil_payload(conexao, request: Request, intervalo: IntervaloDatas) -> dict[str, Any]:
    etapas = []
    avisos = []
    slas = await _funil_sla_transicoes(conexao, request, intervalo)
    for etapa in FUNIL_ETAPAS:
        valor = await _funil_valor(conexao, etapa, request, intervalo)
        if etapa["source"] == "historico" and valor == 0:
            avisos.append({
                "stage": etapa["label"],
                "message": "Sem eventos historicos oficiais para a etapa no periodo selecionado.",
            })
        etapas.append({**etapa, "value": valor, "detailCount": valor, "sourceAvailable": True, "slaAverage": slas.get(etapa["key"])})
    lead = float(etapas[0]["value"] or 0)
    for indice, etapa in enumerate(etapas):
        anterior = float(etapas[indice - 1]["value"] or 0) if indice else 0
        etapa["conversionFromPrevious"] = round((float(etapa["value"]) / anterior) * 100, 2) if indice and anterior else None
        etapa["conversionFromLead"] = 100 if indice == 0 else (round((float(etapa["value"]) / lead) * 100, 2) if lead else None)
        etapa["auditOk"] = etapa["value"] == etapa["detailCount"]
    return {
        "period": {"startDate": intervalo.inicio.isoformat(), "endDate": intervalo.fim.isoformat()},
        "stages": etapas,
        "warnings": avisos,
        "externalMetrics": await _funil_metricas_laterais(conexao, request, intervalo),
        "audit": {"ok": all(etapa["auditOk"] for etapa in etapas), "checkedAt": datetime.utcnow().isoformat()},
        "meta": {"source": "connect_comercial"},
    }


async def _funil_goals_payload(conexao, request: Request, intervalo: IntervaloDatas, meta_repasse: float) -> dict[str, Any]:
    payload_atual = await _funil_payload(conexao, request, intervalo)
    intervalo_tri = _intervalo_trimestre(intervalo.fim)
    payload_tri = await _funil_payload(conexao, request, intervalo_tri)
    etapas_atual = payload_atual["stages"]
    etapas_tri = payload_tri["stages"]
    tri_por_chave = {etapa["key"]: etapa for etapa in etapas_tri}
    repasse_tri = float(next((etapa["value"] for etapa in etapas_tri if etapa["key"] == "repasse"), 0) or 0)
    intervalo_mes = _intervalo_mes(intervalo.fim)
    hoje = min(date.today(), intervalo_mes.fim)
    dias_decorridos = max(_dias_uteis(intervalo_mes.inicio, hoje), 1)
    dias_total = max(_dias_uteis(intervalo_mes.inicio, intervalo_mes.fim), dias_decorridos)
    dias_restantes = max(dias_total - dias_decorridos, 0)
    rows = []
    quarter_rows = []
    for etapa in etapas_atual:
        atual = float(etapa["value"] or 0)
        etapa_tri = tri_por_chave.get(etapa["key"], {})
        qtd_tri = float(etapa_tri.get("value") or 0)
        conversao_repasse = (repasse_tri / qtd_tri) if qtd_tri else None
        meta_dinamica = meta_repasse if etapa["key"] == "repasse" else (
            meta_repasse / conversao_repasse if conversao_repasse else None
        )
        conversao_atual = etapa.get("conversionFromPrevious")
        tendencia = (atual / dias_decorridos) * dias_total
        gap = None if meta_dinamica is None else meta_dinamica - atual
        necessidade = None if gap is None or dias_restantes <= 0 else gap / dias_restantes
        base = {
            "key": etapa["key"],
            "label": etapa["label"],
            "order": etapa["order"],
            "sourceAvailable": etapa.get("sourceAvailable", True),
        }
        quarter_rows.append({
            **base,
            "quarterActual": qtd_tri,
            "actual": qtd_tri,
            "slaAverage": etapa_tri.get("slaAverage"),
            "conversionFromPrevious": etapa_tri.get("conversionFromPrevious"),
            "conversionFromLead": etapa_tri.get("conversionFromLead"),
            "conversionToRepasse": round(conversao_repasse * 100, 2) if conversao_repasse is not None else None,
            "dynamicGoal": round(meta_dinamica, 1) if meta_dinamica is not None else None,
        })
        rows.append({
            **base,
            "actual": atual,
            "quarterActual": qtd_tri,
            "conversionToRepasse": round(conversao_repasse * 100, 2) if conversao_repasse is not None else None,
            "conversionFromPrevious": conversao_atual,
            "conversionFromLead": etapa.get("conversionFromLead"),
            "slaAverage": etapa.get("slaAverage"),
            "dynamicGoal": round(meta_dinamica, 1) if meta_dinamica is not None else None,
            "attainment": round((atual / meta_dinamica) * 100, 1) if meta_dinamica else None,
            "trend": round(tendencia, 1),
            "trendAttainment": round((tendencia / meta_dinamica) * 100, 1) if meta_dinamica else None,
            "gap": round(gap, 1) if gap is not None else None,
            "dailyNeed": round(necessidade, 2) if necessidade is not None else None,
            "dailyNeedLabel": "Mes Finalizado" if dias_restantes <= 0 else None,
        })
    return {
        "period": {"startDate": intervalo.inicio.isoformat(), "endDate": intervalo.fim.isoformat(), "today": hoje.isoformat()},
        "quarterPeriod": {"startDate": intervalo_tri.inicio.isoformat(), "endDate": intervalo_tri.fim.isoformat()},
        "monthPeriod": {"startDate": intervalo_mes.inicio.isoformat(), "endDate": intervalo_mes.fim.isoformat()},
        "metaRepasse": meta_repasse,
        "businessDays": {"elapsed": dias_decorridos, "total": dias_total, "remaining": dias_restantes},
        "quarterRows": quarter_rows,
        "rows": rows,
        "warnings": payload_atual["warnings"] + [
            aviso for aviso in payload_tri["warnings"]
            if aviso not in payload_atual["warnings"]
        ],
        "meta": {
            "source": "connect_comercial_meta_dinamica_tri",
            "rule": "Meta REPASSE informada; etapas anteriores = meta REPASSE / conversao historica da etapa ate REPASSE no trimestre.",
        },
    }


async def _auditar_cards_expandidos(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
) -> dict[str, Any]:
    resumo = await _buscar_resumo(conexao, intervalo, request)
    tendencias = await _buscar_tendencias(conexao, intervalo, request)
    cards = [
        await _auditar_card_expandido(conexao, intervalo, request, kpi, resumo, tendencias)
        for kpi in EXPANDED_CARD_AUDIT_KPIS
    ]

    propostas_status = {}
    for status_label, status_kpi in PROPOSTAS_AUDIT_STATUS_KPIS.items():
        eixo_operacao = await _breakdown_segmentado_eixo(
            conexao,
            "corretorOperacao",
            status_kpi,
            intervalo,
            request,
            1000,
        )
        propostas_status[status_label] = {
            "kpi": status_kpi,
            "corretorOperacaoTotal": _somar_eixo(eixo_operacao),
            "rows": len(eixo_operacao),
        }

    return {
        "summary": {
            "total_repasses": resumo.get("total_repasses", 0),
            "total_repasses_fato": resumo.get("total_repasses_fato", resumo.get("total_repasses", 0)),
            "total_repasses_elegiveis": resumo.get("total_repasses_elegiveis", 0),
            "total_repasses_nao_elegiveis": resumo.get("total_repasses_nao_elegiveis", 0),
            "total_ipc_corretor": resumo.get("total_ipc_corretor", 0),
            "total_ipc_imobiliaria": resumo.get("total_ipc_imobiliaria", 0),
            "ipc_corretores_ativos": resumo.get("ipc_corretores_ativos", 0),
            "ipc_imobiliarias_ativas": resumo.get("ipc_imobiliarias_ativas", 0),
        },
        "cards": cards,
        "propostasStatus": propostas_status,
        "meta": {
            "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
            "notes": [
                "Totais principais usam o fato comercial mais atualizado.",
                "Eixos de corretor ativo usam somente a base vigente de funcionarios.",
                "Diferencas entre total do fato e total atribuido ficam em campos de auditoria.",
            ],
        },
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/funnel")
async def funil_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _funil_payload(conexao, request, intervalo)


@rotas_de_dashboard_comercial.get("/v1/dashboard/funnel/detail")
async def funil_dashboard_detail(
    request: Request,
    stage: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    sortBy: str = Query("data_evento"),
    sortDir: str = Query("desc"),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    etapa = _funil_etapa(stage)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _funil_detalhe(conexao, etapa, request, intervalo, page, limit, sortBy, sortDir)


@rotas_de_dashboard_comercial.get("/v1/dashboard/funnel/history")
async def funil_dashboard_history(
    request: Request,
    idlead: str | None = Query(None, max_length=40),
    idprecadastro: str | None = Query(None, max_length=40),
    idreserva: str | None = Query(None, max_length=40),
    idrepasse: str | None = Query(None, max_length=40),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _funil_historico_entidade(conexao, request, idlead, idprecadastro, idreserva, idrepasse)


@rotas_de_dashboard_comercial.get("/v1/dashboard/funnel/goals")
async def funil_dashboard_goals(
    request: Request,
    metaRepasse: float = Query(45, ge=0),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _funil_goals_payload(conexao, request, intervalo, float(metaRepasse))


@rotas_de_dashboard_comercial.get("/v1/dashboard/funnel/audit")
async def funil_dashboard_audit(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        payload = await _funil_payload(conexao, request, intervalo)
        checks = []
        for etapa in payload["stages"]:
            detalhe = await _funil_detalhe(conexao, etapa, request, intervalo, 1, 1, "data_evento", "desc")
            visual = int(etapa.get("value") or 0)
            detail = int(detalhe.get("total") or 0)
            checks.append({
                "stage": etapa["label"],
                "visual": visual,
                "detail": detail,
                "diff": visual - detail,
                "ok": visual == detail,
                "source": etapa.get("source"),
            })
        return {
            "period": payload["period"],
            "ok": all(item["ok"] for item in checks),
            "checks": checks,
            "warnings": payload.get("warnings", []),
        }


@rotas_de_dashboard_comercial.get("/v1/dashboard/summary")
async def resumo_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_resumo(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/trends")
async def tendencias_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_tendencias(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/overview")
async def visao_geral_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    anterior = _intervalo_anterior(intervalo)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return {
            "summary": await _buscar_resumo(conexao, intervalo, request),
            "trends": await _buscar_tendencias(conexao, intervalo, request),
            "previousSummary": await _buscar_resumo(conexao, anterior, request),
            "previousTrends": await _buscar_tendencias(conexao, anterior, request),
        }


@rotas_de_dashboard_comercial.get("/v1/dashboard/expanded-cards-audit")
async def auditoria_cards_expandidos_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _auditar_cards_expandidos(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/summary")
async def resumo_reservas_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_reservas_summary(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/trends")
async def tendencias_reservas_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_reservas_trends(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/breakdown")
async def breakdown_reservas_dashboard(
    request: Request,
    axis: str = Query("regiao"),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        if axis == "all":
            return {
                "byAxis": {
                    eixo: await _buscar_reservas_breakdown(conexao, intervalo, request, eixo)
                    for eixo in EIXOS_RESERVAS
                }
            }
        return {"items": await _buscar_reservas_breakdown(conexao, intervalo, request, axis)}


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/table")
async def tabela_reservas_dashboard(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    detailAxis: str = Query("", max_length=40),
    detailValue: str = Query("", max_length=220),
    detailMetric: str = Query("reservas", max_length=60),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_reservas_tabela(
            conexao,
            intervalo,
            request,
            page,
            limit,
            detailAxis,
            detailValue,
            detailMetric,
        )


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/filters")
async def filtros_reservas_dashboard(
    request: Request,
    limit: int = Query(160, ge=1, le=500),
    fields: str = Query("", max_length=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        resposta: dict[str, Any] = {}
        campos = {
            "regiao": "regiao_empreendimento",
            "empreendimento": "empreendimento_nome",
            "origem": "lead_origem_nome",
            "corretor": "coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''))",
            "imobiliaria": "coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''))",
            "situacao": "reserva_situacao_nome",
            "situacaoAtual": "reserva_situacao_nome",
            "idReserva": "idreserva::text",
            "repasseNoMes": "reserva_campos_adicionais_reserva_repasse_no_mes",
            "agente": "null::text",
            "cidade": "lead_cidade",
        }
        campos_solicitados = {
            campo.strip()
            for campo in str(fields or "").split(",")
            if campo.strip() in campos
        }
        itens_campos = [
            (nome, coluna)
            for nome, coluna in campos.items()
            if not campos_solicitados or nome in campos_solicitados
        ]

        for nome, coluna in itens_campos:
            where_filtros, parametros_filtros = _where_reservas(request, 3)
            data_reserva_sql = "coalesce(dt_referencia_reserva, dt_cadastro_reserva)"
            linhas = await conexao.fetch(
                f"""
                select distinct {coluna} as valor
                from {ESQUEMA_COMERCIAL}.comercial_base
                where idreserva is not null
                  and {data_reserva_sql} >= $1::date
                  and {data_reserva_sql} < ($2::date + interval '1 day')
                  and {coluna} is not null
                  and btrim({coluna}) <> ''
                  {where_filtros}
                order by valor
                limit ${3 + len(parametros_filtros)}
                """,
                intervalo.inicio,
                intervalo.fim,
                *parametros_filtros,
                limit,
            )
            resposta[nome] = [{"value": linha["valor"], "label": linha["valor"]} for linha in linhas]
        return resposta


@rotas_de_dashboard_comercial.get("/v1/dashboard/reservas/metas")
async def metas_reservas_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _buscar_reservas_metas(conexao, intervalo, request)


@rotas_de_dashboard_comercial.put("/v1/dashboard/reservas/metas")
async def atualizar_meta_reservas_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario, "dashboard.comercial.manage")
    payload = await request.json()
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _salvar_reservas_meta(conexao, payload)


def _expressao_kpi(kpi: str) -> str:
    return KPI_SQL.get(str(kpi or "").strip(), KPI_SQL["leads"])


def _pessoa_funcionario_por_campo(campo: str) -> str | None:
    if campo in CORRETOR_FUNCIONARIO_FIELDS or campo in SEGMENTED_CORRETOR_FIELDS:
        return "corretor"
    if campo in SDR_FUNCIONARIO_FIELDS or campo in SEGMENTED_SDR_FIELDS:
        return "sdr"
    return None


def _condicao_funcionario_pessoa(alias: str, pessoa: str) -> str:
    if pessoa == "sdr":
        return f"coalesce({alias}.imobiliaria, '') ilike '%Canal Virtual%'"
    return (
        f"upper(trim(coalesce({alias}.cargo, ''))) = 'CORRETOR' "
        f"and coalesce({alias}.imobiliaria, '') not ilike '%Canal Virtual%'"
    )


def _condicao_funcionario_ativo_intervalo_sql(alias: str, inicio_expr: str, fim_expr: str) -> str:
    return f"""
    (
        coalesce({alias}.ativo_negocio, true) is true
        and (coalesce({alias}.ativo, false) is true or coalesce({alias}.ativo_login, false) is true)
        and ({alias}.data_inicio_vigencia is null or {alias}.data_inicio_vigencia <= {fim_expr}::date)
        and ({alias}.data_fim_vigencia is null or {alias}.data_fim_vigencia >= {inicio_expr}::date)
    )
    """


def _normalizar_nome_sql(expr: str) -> str:
    return (
        "regexp_replace("
        f"regexp_replace(lower(trim(coalesce(nullif(trim({expr}), ''), 'Sem informacao'))), "
        "'\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), "
        "'\\s+', ' ', 'g')"
    )


def _valor_breakdown_pessoa_sql(kpi: str) -> str:
    kpi_normalizado = str(kpi or "").strip()
    return {
        "leads": "coalesce(sum(leads), 0)::numeric",
        "visitas": "coalesce(sum(visitas), 0)::numeric",
        "agendamentos": "coalesce(sum(agendamentos), 0)::numeric",
        "vendas": "coalesce(sum(vendas), 0)::numeric",
        "vendas_geradas": "coalesce(sum(vendas), 0)::numeric",
        "repasses": "coalesce(sum(repasses), 0)::numeric",
        "propostas": "coalesce(sum(propostas_total), 0)::numeric",
        "propostas_total": "coalesce(sum(propostas_total), 0)::numeric",
        "pastas_aprovadas": "coalesce(sum(propostas_aprovadas), 0)::numeric",
        "pastas_condicionadas": "coalesce(sum(propostas_condicionadas), 0)::numeric",
        "pastas_reprovadas": "coalesce(sum(propostas_reprovadas), 0)::numeric",
        "pastas_com_respostas": "coalesce(sum(propostas_total), 0)::numeric",
        "cancelamentos": "coalesce(sum(cancelamentos), 0)::numeric",
        "distratos": "coalesce(sum(distratos), 0)::numeric",
        "sla_f": (
            "case when coalesce(sum(sla_finalizacao_count), 0) > 0 "
            "then coalesce(sum(sla_finalizacao_sum), 0)::numeric / sum(sla_finalizacao_count)::numeric else 0 end"
        ),
        "sla_r": (
            "case when coalesce(sum(sla_repasse_count), 0) > 0 "
            "then coalesce(sum(sla_repasse_sum), 0)::numeric / sum(sla_repasse_count)::numeric else 0 end"
        ),
    }.get(kpi_normalizado, "coalesce(sum(leads), 0)::numeric")


async def _buscar_opcoes_funcionarios_comerciais(
    conexao,
    campo: str,
    intervalo: IntervaloDatas,
    limit: int,
) -> list[dict[str, str]]:
    pessoa = _pessoa_funcionario_por_campo(campo)
    if not pessoa:
        return []
    expr = {
        "corretor": "coalesce(nullif(trim(f.nome), ''), 'Sem corretor')",
        "sdr": "coalesce(nullif(trim(f.nome), ''), 'Sem SDR')",
        "gestor": "coalesce(nullif(trim(f.gestor), ''), 'Sem gerente')",
        "coordenador": "coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador')",
        "regiao": "coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao')",
        "imobiliaria": "coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe')",
    }
    campo_expr = {
        "corretor": expr["corretor"],
        "corretorOperacao": expr["corretor"],
        "corretorAtivo": expr["corretor"],
        "gestorCorretor": expr["gestor"],
        "coordenadorCorretor": expr["coordenador"],
        "regiaoCorretor": expr["regiao"],
        "imobiliariaCorretor": expr["imobiliaria"],
        "sdr": expr["sdr"],
        "sdrOperacao": expr["sdr"],
        "sdrAtivo": expr["sdr"],
        "gestorSdr": expr["gestor"],
        "coordenadorSdr": expr["coordenador"],
        "regiaoSdr": expr["regiao"],
        "imobiliariaSdr": expr["imobiliaria"],
    }.get(campo)
    if not campo_expr:
        return []
    linhas = await conexao.fetch(
        f"""
        select distinct {campo_expr} as valor
          from {ESQUEMA_BANCO}.funcionario_acesso f
         where {_condicao_funcionario_pessoa("f", pessoa)}
           and trim(coalesce(f.nome, '')) <> ''
         order by 1
         limit $1
        """,
        limit,
    )
    return [_opcao(linha["valor"]) for linha in linhas if str(linha["valor"] or "").strip()]


async def _buscar_opcoes_funcionarios_vigentes(
    conexao,
    campo: str,
    intervalo: IntervaloDatas,
    limit: int,
) -> list[dict[str, str]]:
    return await _buscar_opcoes_funcionarios_comerciais(conexao, campo, intervalo, limit)


async def _breakdown_funcionario_pessoa_eixo(
    conexao,
    eixo: str,
    kpi: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
    mapa_filtros: dict[str, str],
) -> list[dict[str, Any]]:
    pessoa = _pessoa_funcionario_por_campo(eixo)
    if not pessoa:
        return []
    coluna_fato = "sdr" if pessoa == "sdr" else "corretor"
    expr_funcionario = {
        "corretor": ("coalesce(nullif(trim(f.nome), ''), 'Sem corretor')", "Sem corretor"),
        "corretorOperacao": ("coalesce(nullif(trim(f.nome), ''), 'Sem corretor')", "Sem corretor"),
        "corretorAtivo": ("coalesce(nullif(trim(f.nome), ''), 'Sem corretor')", "Sem corretor"),
        "gestorCorretor": ("coalesce(nullif(trim(f.gestor), ''), 'Sem gerente')", "Sem gerente"),
        "coordenadorCorretor": ("coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador')", "Sem coordenador"),
        "regiaoCorretor": ("coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao')", "Sem regiao"),
        "imobiliariaCorretor": ("coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe')", "Sem equipe"),
        "sdr": ("coalesce(nullif(trim(f.nome), ''), 'Sem SDR')", "Sem SDR"),
        "sdrOperacao": ("coalesce(nullif(trim(f.nome), ''), 'Sem SDR')", "Sem SDR"),
        "sdrAtivo": ("coalesce(nullif(trim(f.nome), ''), 'Sem SDR')", "Sem SDR"),
        "gestorSdr": ("coalesce(nullif(trim(f.gestor), ''), 'Sem gerente')", "Sem gerente"),
        "coordenadorSdr": ("coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador')", "Sem coordenador"),
        "regiaoSdr": ("coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao')", "Sem regiao"),
        "imobiliariaSdr": ("coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe')", "Sem equipe"),
    }.get(eixo)
    if not expr_funcionario:
        return []
    label_funcionario_sql, rotulo_sem_pessoa = expr_funcionario
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        mapa_filtros,
        4,
        ignorar=set(),
    )
    pessoa_match_fato = _normalizar_nome_sql(f"{coluna_fato}")
    pessoa_match_funcionario = _normalizar_nome_sql("f.nome")
    valor_sql = _valor_breakdown_pessoa_sql(kpi)
    linhas = await conexao.fetch(
        f"""
        with base_funcionarios as (
            select distinct
                {label_funcionario_sql} as label,
                {pessoa_match_funcionario} as pessoa_match
              from {ESQUEMA_BANCO}.funcionario_acesso f
             where {_condicao_funcionario_pessoa("f", pessoa)}
               and trim(coalesce(f.nome, '')) <> ''
        ),
        fatos_periodo as (
            select
                coalesce(nullif(trim({coluna_fato}), ''), $3::text) as label_fato,
                {pessoa_match_fato} as pessoa_match,
                coalesce(sum(leads), 0)::numeric as leads,
                coalesce(sum(visitas), 0)::numeric as visitas,
                coalesce(sum(vendas), 0)::numeric as vendas,
                coalesce(sum(repasses), 0)::numeric as repasses,
                coalesce(sum(propostas_total), 0)::numeric as propostas_total,
                coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                coalesce(sum(distratos), 0)::numeric as distratos,
                coalesce(sum(sla_finalizacao_sum), 0)::numeric as sla_finalizacao_sum,
                coalesce(sum(sla_finalizacao_count), 0)::numeric as sla_finalizacao_count,
                coalesce(sum(sla_repasse_sum), 0)::numeric as sla_repasse_sum,
                coalesce(sum(sla_repasse_count), 0)::numeric as sla_repasse_count
              from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
             where data >= $1::date
               and data <= $2::date
               {where_filtros}
             group by 1, 2
        ),
        linhas_ativas as (
            select
                bf.label,
                coalesce(fp.leads, 0)::numeric as leads,
                coalesce(fp.visitas, 0)::numeric as visitas,
                coalesce(fp.vendas, 0)::numeric as vendas,
                coalesce(fp.repasses, 0)::numeric as repasses,
                coalesce(fp.propostas_total, 0)::numeric as propostas_total,
                coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
                coalesce(fp.distratos, 0)::numeric as distratos,
                coalesce(fp.sla_finalizacao_sum, 0)::numeric as sla_finalizacao_sum,
                coalesce(fp.sla_finalizacao_count, 0)::numeric as sla_finalizacao_count,
                coalesce(fp.sla_repasse_sum, 0)::numeric as sla_repasse_sum,
                coalesce(fp.sla_repasse_count, 0)::numeric as sla_repasse_count
              from base_funcionarios bf
              left join fatos_periodo fp
                on fp.pessoa_match = bf.pessoa_match
        ),
        linhas_inativas as (
            select
                'Inativos/Outros'::text as label,
                coalesce(sum(fp.leads), 0)::numeric as leads,
                coalesce(sum(fp.visitas), 0)::numeric as visitas,
                coalesce(sum(fp.vendas), 0)::numeric as vendas,
                coalesce(sum(fp.repasses), 0)::numeric as repasses,
                coalesce(sum(fp.propostas_total), 0)::numeric as propostas_total,
                coalesce(sum(fp.propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                coalesce(sum(fp.propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                coalesce(sum(fp.propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                coalesce(sum(fp.cancelamentos), 0)::numeric as cancelamentos,
                coalesce(sum(fp.distratos), 0)::numeric as distratos,
                coalesce(sum(fp.sla_finalizacao_sum), 0)::numeric as sla_finalizacao_sum,
                coalesce(sum(fp.sla_finalizacao_count), 0)::numeric as sla_finalizacao_count,
                coalesce(sum(fp.sla_repasse_sum), 0)::numeric as sla_repasse_sum,
                coalesce(sum(fp.sla_repasse_count), 0)::numeric as sla_repasse_count
              from fatos_periodo fp
             where not exists (
                   select 1
                     from base_funcionarios bf
                    where bf.pessoa_match = fp.pessoa_match
             )
            having (
                coalesce(sum(fp.leads), 0)
              + coalesce(sum(fp.visitas), 0)
              + coalesce(sum(fp.vendas), 0)
              + coalesce(sum(fp.repasses), 0)
              + coalesce(sum(fp.propostas_total), 0)
              + coalesce(sum(fp.cancelamentos), 0)
              + coalesce(sum(fp.distratos), 0)
            ) <> 0
        ),
        linhas as (
            select * from linhas_ativas
            union all
            select * from linhas_inativas
        )
        select
            label,
            {valor_sql} as value,
            coalesce(sum(leads), 0)::numeric as count,
            greatest(
                coalesce(sum(leads), 0),
                coalesce(sum(visitas), 0),
                coalesce(sum(vendas), 0),
                coalesce(sum(repasses), 0),
                coalesce(sum(propostas_total), 0),
                coalesce(sum(cancelamentos), 0),
                coalesce(sum(distratos), 0)
            )::int as case_count
        from linhas
        group by label
        having {valor_sql} <> 0
        order by value desc, label asc
        limit ${4 + len(parametros_filtros)}
        """,
        intervalo.inicio,
        intervalo.fim,
        rotulo_sem_pessoa,
        *parametros_filtros,
        limit,
    )
    total = sum(float(linha["value"] or 0) for linha in linhas)
    itens = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        valor = float(item.get("value") or 0)
        item["share"] = (valor / total * 100) if total else 0
        itens.append(item)
    return itens


def _agendamento_axis_expr(eixo: str) -> str | None:
    return {
        "regiaoOperacao": "b.regiao_empreendimento",
        "regiaoCorretor": "b.regiao_empreendimento",
        "regiaoSdr": "b.regiao_empreendimento",
        "imobiliariaOperacao": "coalesce(nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''))",
        "imobiliariaCorretor": "coalesce(nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''))",
        "imobiliariaSdr": "coalesce(nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''))",
        "corretorOperacao": "coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''))",
        "corretorAtivo": "coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''))",
        "sdrOperacao": "b.sdr_nome",
        "sdrAtivo": "b.sdr_nome",
        "origem": "b.lead_origem_nome",
        "empreendimento": "b.empreendimento_nome",
        "unidade": "b.unidade_nome",
        "gestorCorretor": "b.gestor_nome",
        "coordenadorCorretor": "b.gestor_nome",
        "gestorSdr": "b.gestor_nome",
        "coordenadorSdr": "b.gestor_nome",
    }.get(eixo)


async def _breakdown_agendamentos_eixo(
    conexao,
    eixo: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, Any]]:
    eixo_expr = _agendamento_axis_expr(eixo)
    if not eixo_expr:
        return []
    mapa = {
        nome: (coluna if "(" in coluna or "::" in coluna else f"b.{coluna}")
        for nome, coluna in FILTROS_BASE.items()
    }
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        mapa,
        3,
        ignorar={eixo},
    )
    indice_limit = 3 + len(parametros_filtros)
    linhas = await conexao.fetch(
        f"""
        with ultimos as (
            select distinct on (lh.idlead)
                lh.idlead,
                coalesce(nullif(trim({eixo_expr}), ''), 'Sem informacao') as label
            from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
            left join lateral (
                select b.*
                from {ESQUEMA_COMERCIAL}.comercial_base b
                where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                   or (lh.idlead is not null and b.idlead = lh.idlead)
                order by
                    case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                    b.dt_ultima_conversao_lead desc nulls last,
                    b.fato_jornada_comercial_key
                limit 1
            ) b on true
            where lh.dt_referencia >= $1::date
              and lh.dt_referencia < ($2::date + interval '1 day')
              and lh.idlead is not null
              and (
                   coalesce(lh.funil_status_grupo, '') in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                or lh.situacao_para in ('Agendado', 'Agendado - IA', 'Agendamento', 'Agendamento - IA')
                or lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
              )
              {where_filtros}
            order by lh.idlead, lh.dt_referencia desc nulls last, lh.historico_status_key desc nulls last
        )
        select
            label,
            count(*)::numeric as value,
            count(*)::numeric as count,
            count(*)::int as case_count
        from ultimos
        group by label
        having count(*) > 0
        order by value desc, label asc
        limit ${indice_limit}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
        limit,
    )
    total = sum(float(linha["value"] or 0) for linha in linhas)
    itens = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        valor = float(item.get("value") or 0)
        item["share"] = (valor / total * 100) if total else 0
        itens.append(item)
    return itens


async def _breakdown_eixo(conexao, eixo: str, kpi: str, intervalo: IntervaloDatas, request: Request) -> list[dict[str, Any]]:
    if str(kpi or "").strip() == "agendamentos":
        return await _breakdown_agendamentos_eixo(conexao, eixo, intervalo, request, 50)
    if eixo in FUNCIONARIO_PESSOA_FIELDS and str(kpi or "").strip() not in {"ipc", "ipc_corretor", "ipc_imobiliaria"}:
        return await _breakdown_funcionario_pessoa_eixo(conexao, eixo, kpi, intervalo, request, 50, FILTROS_KPI)
    if str(kpi or "").strip() in {"repasses", "ipc", "ipc_corretor", "ipc_imobiliaria"}:
        return await _breakdown_produtividade_oficial_eixo(conexao, eixo, kpi, intervalo, request, 50)

    coluna = EIXOS_BREAKDOWN[eixo]
    where_filtros, parametros_filtros = _montar_where_dimensoes(request, FILTROS_KPI, 3)
    expr = _expressao_kpi(kpi)
    linhas = await conexao.fetch(
        f"""
        select
            coalesce(nullif({coluna}, ''), 'Em branco / Nulo') as label,
            coalesce({expr}, 0)::numeric as value,
            coalesce(sum(leads), 0)::numeric as count,
            coalesce(sum(propostas_total), 0)::numeric as case_count
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
        where data >= $1::date
          and data <= $2::date
          {where_filtros}
        group by coalesce(nullif({coluna}, ''), 'Em branco / Nulo')
        order by value desc, label asc
        limit 50
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
    )
    total = sum(float(linha["value"] or 0) for linha in linhas)
    itens = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        valor = float(item.get("value") or 0)
        item["share"] = (valor / total * 100) if total else 0
        itens.append(item)
    return itens


@rotas_de_dashboard_comercial.get("/v1/dashboard/breakdown")
async def breakdown_dashboard(
    request: Request,
    kpi: str = Query("leads"),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        por_eixo = {}
        for eixo in EIXOS_BREAKDOWN:
            por_eixo[eixo] = await _breakdown_eixo(conexao, eixo, kpi, intervalo, request)
        return {"byAxis": por_eixo}


@rotas_de_dashboard_comercial.get("/v1/dashboard/filters")
async def filtros_dashboard(
    request: Request,
    limit: int = Query(120, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        resposta: dict[str, Any] = {}
        for nome, coluna in FILTROS_KPI.items():
            if nome in FUNCIONARIO_PESSOA_FIELDS or nome in SEGMENTED_CORRETOR_FIELDS or nome in SEGMENTED_SDR_FIELDS:
                resposta[nome] = await _buscar_opcoes_funcionarios_vigentes(
                    conexao,
                    nome,
                    intervalo,
                    limit,
                )
                continue
            linhas = await conexao.fetch(
                f"""
                select distinct {coluna} as valor
                from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
                where data >= $1::date
                  and data <= $2::date
                  and {coluna} is not null
                  and btrim({coluna}) <> ''
                order by {coluna}
                limit $3
                """,
                intervalo.inicio,
                intervalo.fim,
                limit,
            )
            resposta[nome] = [{"value": linha["valor"], "label": linha["valor"]} for linha in linhas]
        resposta["meta"] = [
            {"value": "leads", "label": "Leads"},
            {"value": "visitas", "label": "Visitas"},
            {"value": "propostas", "label": "Propostas"},
            {"value": "vendas", "label": "Reservas"},
            {"value": "repasses", "label": "Repasses"},
            {"value": "cancelamentos", "label": "Cancelamentos"},
            {"value": "distratos", "label": "Distratos"},
        ]
        return resposta


@rotas_de_dashboard_comercial.get("/v1/dashboard/filters/search")
async def pesquisar_filtro_dashboard(
    request: Request,
    field: str = Query(...),
    q: str = Query(""),
    limit: int = Query(50, ge=1, le=100),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    campos_busca_reserva = {"situacao", "situacaoAtual", "status", "idReserva", "repasseNoMes", "agente"}
    if field in campos_busca_reserva:
        coluna_reserva = FILTROS_RESERVAS_BASE.get(field)
        if not coluna_reserva:
            raise HTTPException(status_code=422, detail="Filtro invalido.")
        intervalo = _intervalo_datas(request)
        termo = f"%{q.strip()}%"
        where_filtros, parametros_filtros = _montar_where_dimensoes(
            request,
            FILTROS_RESERVAS_BASE,
            4,
            ignorar={field},
        )
        data_reserva_sql = "coalesce(dt_referencia_reserva, dt_cadastro_reserva)"
        pool = _obter_pool(request)
        async with pool.acquire() as conexao:
            linhas = await conexao.fetch(
                f"""
                select distinct {coluna_reserva} as valor
                from {ESQUEMA_COMERCIAL}.comercial_base
                where idreserva is not null
                  and {data_reserva_sql} >= $1::date
                  and {data_reserva_sql} < ($2::date + interval '1 day')
                  and {coluna_reserva} is not null
                  and btrim({coluna_reserva}) <> ''
                  and ($3 = '%%' or {coluna_reserva} ilike $3)
                  {where_filtros}
                order by valor
                limit ${4 + len(parametros_filtros)}
                """,
                intervalo.inicio,
                intervalo.fim,
                termo,
                *parametros_filtros,
                limit,
            )
        return {"field": field, "q": q, "options": [{"value": linha["valor"], "label": linha["valor"]} for linha in linhas]}

    coluna = FILTROS_KPI.get(field)
    if not coluna:
        raise HTTPException(status_code=422, detail="Filtro invalido.")
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    termo = f"%{q.strip()}%"
    async with pool.acquire() as conexao:
        if field in FUNCIONARIO_PESSOA_FIELDS or field in SEGMENTED_CORRETOR_FIELDS or field in SEGMENTED_SDR_FIELDS:
            opcoes = await _buscar_opcoes_funcionarios_vigentes(
                conexao,
                field,
                intervalo,
                limit,
            )
            termo_limpo = q.strip().lower()
            if termo_limpo:
                opcoes = [opcao for opcao in opcoes if termo_limpo in opcao["label"].lower()]
            return {"field": field, "q": q, "options": opcoes[:limit]}
        linhas = await conexao.fetch(
            f"""
            select distinct {coluna} as valor
            from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
            where data >= $1::date
              and data <= $2::date
              and {coluna} is not null
              and btrim({coluna}) <> ''
              and ($3 = '%%' or {coluna} ilike $3)
            order by {coluna}
            limit $4
            """,
            intervalo.inicio,
            intervalo.fim,
            termo,
            limit,
        )
    return {"field": field, "q": q, "options": [{"value": linha["valor"], "label": linha["valor"]} for linha in linhas]}


@rotas_de_dashboard_comercial.get("/v1/leads")
async def listar_leads_dashboard(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    status_filtro: str = Query("todos", alias="status"),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    where_filtros, parametros_filtros = _montar_where_dimensoes(request, FILTROS_BASE, 5)
    status_sql = ""
    parametros_status: list[Any] = []
    indice_status = 5 + len(parametros_filtros)
    if status_filtro and status_filtro.lower() not in IGNORAR_FILTROS:
        status_sql = f" and lead_situacao_nome ilike ${indice_status}"
        parametros_status.append(f"%{status_filtro}%")

    offset = (page - 1) * limit
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            select
                coalesce(idlead::text, journey_id, fato_jornada_comercial_key) as id_lead,
                lead_situacao_nome as situacao,
                lead_cidade as cidade,
                sdr_nome as sdr,
                corretor_nome as corretor,
                lead_origem_nome as origem,
                empreendimento_nome,
                regiao_empreendimento as empreendimento_reduzido,
                sla_finalizacao_dias,
                sla_repasse_dias,
                dt_ultima_conversao_lead
            from {ESQUEMA_COMERCIAL}.comercial_base
            where coalesce(dt_ultima_conversao_lead, dt_visita_realizada, dt_cadastro_reserva, data_venda, dt_venda_finalizada)
                  >= $1::date
              and coalesce(dt_ultima_conversao_lead, dt_visita_realizada, dt_cadastro_reserva, data_venda, dt_venda_finalizada)
                  < ($2::date + interval '1 day')
              {where_filtros}
              {status_sql}
            order by coalesce(dt_ultima_conversao_lead, dt_visita_realizada, dt_cadastro_reserva, data_venda, dt_venda_finalizada) desc nulls last
            limit $3 offset $4
            """,
            intervalo.inicio,
            intervalo.fim,
            limit,
            offset,
            *parametros_filtros,
            *parametros_status,
        )
    return {"page": page, "limit": limit, "rows": [_linha_para_dict(linha) for linha in linhas]}


@rotas_de_dashboard_comercial.get("/v1/dashboard/goals")
async def listar_metas_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            select
                id::text,
                kpi_id,
                goal_value,
                unit,
                target_type,
                quality_style,
                period_type,
                hierarchy_level,
                hierarchy_value,
                business_days_aware,
                updated_at
            from {ESQUEMA_COMERCIAL}.dashboard_goals
            order by kpi_id, hierarchy_level, hierarchy_value
            """
        )
    return [_linha_para_dict(linha) for linha in linhas]


@rotas_de_dashboard_comercial.put("/v1/dashboard/goals/{kpi_id}")
async def atualizar_meta_dashboard(
    kpi_id: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario, "dashboard.comercial.manage")
    payload = await request.json()
    try:
        valor = Decimal(str(payload.get("goalValue", "0")))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Valor de meta invalido.") from exc
    if valor < 0:
        raise HTTPException(status_code=422, detail="Valor de meta nao pode ser negativo.")

    target_type = str(payload.get("targetType") or "absolute")
    period_type = str(payload.get("periodType") or "monthly")
    hierarchy_level = str(payload.get("hierarchyLevel") or "all")
    hierarchy_value = str(payload.get("hierarchyValue") or "")
    business_days_aware = bool(payload.get("businessDaysAware", True))
    quality_style = target_type in {"ratio_limit", "days_max"}
    unit = "dias" if target_type == "days_max" else "total"

    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        linha = await conexao.fetchrow(
            f"""
            insert into {ESQUEMA_COMERCIAL}.dashboard_goals (
                kpi_id,
                goal_value,
                unit,
                target_type,
                quality_style,
                period_type,
                hierarchy_level,
                hierarchy_value,
                business_days_aware
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            on conflict (kpi_id, hierarchy_level, hierarchy_value)
            do update set
                goal_value = excluded.goal_value,
                unit = excluded.unit,
                target_type = excluded.target_type,
                quality_style = excluded.quality_style,
                period_type = excluded.period_type,
                business_days_aware = excluded.business_days_aware,
                updated_at = now()
            returning
                id::text,
                kpi_id,
                goal_value,
                unit,
                target_type,
                quality_style,
                period_type,
                hierarchy_level,
                hierarchy_value,
                business_days_aware,
                updated_at
            """,
            kpi_id,
            valor,
            unit,
            target_type,
            quality_style,
            period_type,
            hierarchy_level,
            hierarchy_value,
            business_days_aware,
        )
    return _linha_para_dict(linha)


@rotas_de_dashboard_comercial.post("/v1/dashboard/refresh-data")
async def atualizar_dados_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario, "dashboard.comercial.manage")
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        existe_log = await conexao.fetchval(
            "select to_regclass($1)",
            f"{ESQUEMA_COMERCIAL}.dashboard_comercial_sync_log",
        )
        if not existe_log:
            return {
                "status": "sem_execucao",
                "message": "A rotina horaria ainda nao registrou nenhuma sincronizacao.",
            }

        linha = await conexao.fetchrow(
            f"""
            select
                status,
                started_at,
                finished_at,
                duration_seconds,
                table_counts,
                message
            from {ESQUEMA_COMERCIAL}.dashboard_comercial_sync_log
            order by id desc
            limit 1
            """
        )
    dados = _linha_para_dict(linha)
    return {
        "status": dados.get("status", "sem_execucao"),
        "message": dados.get("message") or "Sincronizacao horaria do Dashboard Comercial.",
        "lastSync": dados,
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/bottlenecks")
async def gargalos_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    return {"items": [], "summary": {"total": 0}}


@rotas_de_dashboard_comercial.get("/v1/dashboard/ipc-insights")
async def insights_ipc_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        resumo = await _buscar_resumo(conexao, intervalo, request)
        rankings = await _buscar_produtividade_oficial_rankings(conexao, intervalo, request)
    return {
        "summary": {
            "repasses": resumo.get("total_repasses", 0),
            "repassesFato": resumo.get("total_repasses_fato", resumo.get("total_repasses", 0)),
            "repassesAtribuidos": resumo.get("total_repasses_elegiveis", 0),
            "repassesSemVinculo": resumo.get("total_repasses_nao_elegiveis", 0),
            "corretores": resumo.get("total_corretores_ativos", 0),
            "imobiliarias": resumo.get("total_imobiliarias_ativas", 0),
            "ipcCorretor": resumo.get("total_ipc_corretor", 0),
            "prevIpcCorretor": 0,
            "ipcImobiliaria": resumo.get("total_ipc_imobiliaria", 0),
            "prevIpcImobiliaria": 0,
        },
        "rankings": rankings,
    }


CORRETORES_CONSOLIDADO_SORT = {
    "corretor": "corretor",
    "gerente": "gerente",
    "gestor": "gerente",
    "coordenador": "coordenador",
    "regiao": "regiao",
    "equipe": "equipe",
    "imobiliaria": "equipe",
    "meses_ativos": "meses_ativos",
    "leads": "leads",
    "visitas": "visitas",
    "agendamentos": "agendamentos",
    "propostas_aprovadas": "propostas_aprovadas",
    "propostas_condicionadas": "propostas_condicionadas",
    "propostas_reprovadas": "propostas_reprovadas",
    "propostas": "propostas",
    "pendente_comercial": "0::numeric",
    "pendente_credito": "0::numeric",
    "vendas": "vendas",
    "vendas_finalizadas": "0::numeric",
    "repasses": "repasses",
    "distratos": "distratos",
    "cancelamentos": "cancelamentos",
    "ipc": "ipc",
}

CORRETORES_DIARIO_SORT = {
    **CORRETORES_CONSOLIDADO_SORT,
    "data": "data",
}

CORRETORES_DIARIO_INDICADORES = [
    {"key": "visitas", "label": "VISITA"},
    {"key": "agendamentos", "label": "AGENDAMENTOS"},
    {"key": "propostas_aprovadas", "label": "PASTAS APROVADAS"},
    {"key": "propostas_condicionadas", "label": "PASTAS CONDICIONADAS"},
    {"key": "propostas_reprovadas", "label": "PASTAS REPROVADAS"},
    {"key": "propostas", "label": "PASTAS COM RESPOSTAS"},
    {"key": "pendente_comercial", "label": "PENDENTE COMERCIAL"},
    {"key": "pendente_credito", "label": "PENDENTE CREDITO"},
    {"key": "vendas", "label": "VENDA"},
    {"key": "vendas_finalizadas", "label": "VENDA FINALIZADA"},
    {"key": "repasses", "label": "REPASSE"},
    {"key": "distratos", "label": "DISTRATOS"},
    {"key": "cancelamentos", "label": "CANCELAMENTOS"},
    {"key": "total", "label": "TOTAL"},
]

CORRETORES_DETALHE_INDICADORES = {
    "leads": {
        "label": "LEADS",
        "date": "dt_ultima_conversao_lead",
        "condition": "dt_ultima_conversao_lead is not null",
        "key": "coalesce(idlead::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idlead",
    },
    "visitas": {
        "label": "VISITA",
        "date": "dt_visita_realizada",
        "condition": "dt_visita_realizada is not null",
        "key": "coalesce(idlead::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idlead",
    },
    "agendamentos": {
        "label": "AGENDAMENTOS",
        "date": "dt_referencia",
        "condition": "agendamento_status_grupo in ('AGENDAMENTO','AGENDAMENTO_IA','AGENDADO_IA')",
        "key": "coalesce(historico_status_key, idlead::text, journey_id)",
        "entity": "idlead",
    },
    "propostas": {
        "label": "PASTAS COM RESPOSTAS",
        "date": f"""(
            select pc.dt_ultimo_historico_data
            from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
            where pc.idprecadastro = b.idprecadastro
              and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
            order by pc.dt_ultimo_historico_data desc nulls last
            limit 1
        )""",
        "condition": "detalhe_proposta_data is not null and detalhe_proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')",
        "key": "coalesce(idprecadastro::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idprecadastro",
    },
    "propostas_aprovadas": {
        "label": "PASTAS APROVADAS",
        "date": f"""(
            select pc.dt_ultimo_historico_data
            from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
            where pc.idprecadastro = b.idprecadastro
              and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
            order by pc.dt_ultimo_historico_data desc nulls last
            limit 1
        )""",
        "condition": "detalhe_proposta_data is not null and detalhe_proposta_status_atual = 'APROVADA'",
        "key": "coalesce(idprecadastro::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idprecadastro",
    },
    "propostas_condicionadas": {
        "label": "PASTAS CONDICIONADAS",
        "date": f"""(
            select pc.dt_ultimo_historico_data
            from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
            where pc.idprecadastro = b.idprecadastro
              and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
            order by pc.dt_ultimo_historico_data desc nulls last
            limit 1
        )""",
        "condition": "detalhe_proposta_data is not null and detalhe_proposta_status_atual = 'CONDICIONADA'",
        "key": "coalesce(idprecadastro::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idprecadastro",
    },
    "propostas_reprovadas": {
        "label": "PASTAS REPROVADAS",
        "date": f"""(
            select pc.dt_ultimo_historico_data
            from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
            where pc.idprecadastro = b.idprecadastro
              and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
            order by pc.dt_ultimo_historico_data desc nulls last
            limit 1
        )""",
        "condition": "detalhe_proposta_data is not null and detalhe_proposta_status_atual = 'REPROVADA'",
        "key": "coalesce(idprecadastro::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idprecadastro",
    },
    "vendas": {
        "label": "VENDA",
        "date": "dt_cadastro_reserva",
        "condition": (
            "idreserva is not null and dt_cadastro_reserva is not null and not ("
            f"translate(lower(coalesce(reserva_situacao_nome, '')), '{SQL_NORMALIZE_ACCENTS_FROM}', '{SQL_NORMALIZE_ACCENTS_TO}') like 'cancel%'"
            ")"
        ),
        "key": "idreserva::text",
        "entity": "idreserva",
    },
    "vendas_finalizadas": {
        "label": "VENDA FINALIZADA",
        "date": "dt_venda_finalizada",
        "condition": "dt_venda_finalizada is not null",
        "key": "coalesce(idreserva::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idreserva",
    },
    "repasses": {
        "label": "REPASSE",
        "date": "dt_assinatura_contrato",
        "condition": "dt_assinatura_contrato is not null",
        "key": "coalesce(idrepasse::text, idreserva::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idrepasse",
    },
    "cancelamentos": {
        "label": "CANCELAMENTOS",
        "date": "dt_cancelamento_reserva",
        "condition": "dt_cancelamento_reserva is not null",
        "key": "coalesce(idreserva::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idreserva",
    },
    "distratos": {
        "label": "DISTRATOS",
        "date": f"""(
            select cd.referencia_data
            from {ESQUEMA_COMERCIAL}.comercial_distratos cd
            where (cd.idreserva is not null and cd.idreserva = b.idreserva)
               or (cd.idrepasse is not null and cd.idrepasse = b.idrepasse)
               or (cd.idprecadastro is not null and cd.idprecadastro = b.idprecadastro)
               or (cd.idlead is not null and cd.idlead = b.idlead)
            order by cd.referencia_data desc nulls last
            limit 1
        )""",
        "condition": "detalhe_distrato_data is not null",
        "key": "coalesce(idreserva::text, idrepasse::text, journey_id, journey_key, fato_jornada_comercial_key)",
        "entity": "idreserva",
    },
}


def _ordenacao_corretor(sort: str, order: str, mapa: dict[str, str], padrao: str) -> str:
    coluna = mapa.get(str(sort or "").strip(), padrao)
    direcao = "desc" if str(order or "").lower() == "desc" else "asc"
    desempate = "corretor asc"
    if coluna == "corretor":
        desempate = "data desc" if "data" in mapa else "repasses desc"
    elif "data" in mapa and coluna != "data":
        desempate = "data desc, corretor asc"
    return f"{coluna} {direcao}, {desempate}"


def _paginacao(page: int, page_size: int) -> tuple[int, int, int]:
    pagina = max(int(page or 1), 1)
    tamanho = min(max(int(page_size or 50), 1), 500)
    return pagina, tamanho, (pagina - 1) * tamanho


def _resposta_paginada(linhas: list[Any], page: int, page_size: int) -> dict[str, Any]:
    itens = [_linha_para_dict(linha) for linha in linhas]
    total = int(itens[0].get("total_count") or 0) if itens else 0
    for item in itens:
        item.pop("total_count", None)
    return {
        "items": itens,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "pages": (total + page_size - 1) // page_size if page_size else 0,
        },
    }


def _valor_numero(valor: Any) -> float:
    if valor is None:
        return 0.0
    if isinstance(valor, Decimal):
        return float(valor)
    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


def _metricas_diarias_corretor(item: dict[str, Any]) -> dict[str, float]:
    metricas = {
        "visitas": _valor_numero(item.get("visitas")),
        "agendamentos": _valor_numero(item.get("agendamentos")),
        "propostas_aprovadas": _valor_numero(item.get("propostas_aprovadas")),
        "propostas_condicionadas": _valor_numero(item.get("propostas_condicionadas")),
        "propostas_reprovadas": _valor_numero(item.get("propostas_reprovadas")),
        "propostas": _valor_numero(item.get("propostas")),
        "pendente_comercial": _valor_numero(item.get("pendente_comercial")),
        "pendente_credito": _valor_numero(item.get("pendente_credito")),
        "vendas": _valor_numero(item.get("vendas")),
        "vendas_finalizadas": _valor_numero(item.get("vendas_finalizadas")),
        "repasses": _valor_numero(item.get("repasses")),
        "distratos": _valor_numero(item.get("distratos")),
        "cancelamentos": _valor_numero(item.get("cancelamentos")),
    }
    metricas["total"] = sum(metricas.values())
    return metricas


def _texto_normalizado(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _somar_itens(itens: list[dict[str, Any]], campo: str) -> float:
    return sum(_valor_numero(item.get(campo)) for item in itens)


def _agrupar_auditoria_hierarquia(
    itens: list[dict[str, Any]],
    campo: str,
    rotulo_sem_valor: str,
) -> list[dict[str, Any]]:
    grupos: dict[str, dict[str, Any]] = {}
    for item in itens:
        label = str(item.get(campo) or rotulo_sem_valor).strip() or rotulo_sem_valor
        grupo = grupos.setdefault(
            label,
            {
                "nome": label,
                "corretores": 0,
                "corretores_com_producao": 0,
                "corretores_sem_producao": 0,
                "repasses": 0.0,
                "leads": 0.0,
                "agendamentos": 0.0,
                "visitas": 0.0,
                "propostas": 0.0,
                "vendas": 0.0,
                "alertas": {},
            },
        )
        grupo["corretores"] += 1
        if _valor_numero(item.get("producao_total")) > 0:
            grupo["corretores_com_producao"] += 1
        else:
            grupo["corretores_sem_producao"] += 1
        for campo_metrica in ("repasses", "leads", "agendamentos", "visitas", "propostas", "vendas"):
            grupo[campo_metrica] += _valor_numero(item.get(campo_metrica))
        for alerta in item.get("alertas", []):
            grupo["alertas"][alerta] = grupo["alertas"].get(alerta, 0) + 1

    resultado = []
    for grupo in grupos.values():
        grupo["alertas"] = [
            {"tipo": tipo, "total": total}
            for tipo, total in sorted(grupo["alertas"].items())
        ]
        resultado.append(grupo)
    resultado.sort(key=lambda item: (-item["corretores"], item["nome"]))
    return resultado


def _mismatches_opcoes(nome: str, auditoria: set[str], opcoes: set[str]) -> dict[str, Any] | None:
    somente_auditoria = sorted(auditoria - opcoes)
    somente_filtros = sorted(opcoes - auditoria)
    if not somente_auditoria and not somente_filtros:
        return None
    return {
        "tipo": f"filtros_{nome}",
        "somente_auditoria": somente_auditoria,
        "somente_filtros": somente_filtros,
        "total_somente_auditoria": len(somente_auditoria),
        "total_somente_filtros": len(somente_filtros),
    }


async def _auditar_corretores_comerciais(
    conexao,
    intervalo: IntervaloDatas,
    request: Request,
) -> dict[str, Any]:
    linhas = await conexao.fetch(
        f"""
        {_sql_corretor_analytics_base()},
        ativos_periodo as (
            select
                corretor_identity_key,
                corretor_match,
                count(distinct mes_referencia)::numeric as meses_ativos,
                min(mes_referencia)::date as primeiro_mes_ativo,
                max(mes_referencia)::date as ultimo_mes_ativo
            from hierarquia_ativa
            group by corretor_identity_key, corretor_match
        ),
        corretores_periodo as (
            select
                fv.produtivo_key,
                fv.corretor_identity_key,
                fv.corretor_match,
                fv.equipe_match,
                fv.corretor,
                fv.identificador_funcionario,
                fv.documento,
                fv.email,
                fv.tipo_funcionario,
                fv.ativo,
                fv.ativo_negocio,
                fv.ativo_login,
                fv.data_inicio_vigencia,
                fv.data_fim_vigencia,
                fv.gerente,
                fv.coordenador,
                fv.regiao,
                fv.equipe,
                coalesce(ap.meses_ativos, 0)::numeric as meses_ativos,
                ap.primeiro_mes_ativo,
                ap.ultimo_mes_ativo
            from funcionarios_vinculo fv
            left join ativos_periodo ap
              on ap.corretor_identity_key = fv.corretor_identity_key
        ),
        fatos_periodo as (
            select
                corretor_identity_key,
                corretor_match,
                (array_agg(corretor order by corretor))[1] as corretor_fato,
                coalesce(sum(leads), 0)::numeric as leads,
                coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                coalesce(sum(visitas), 0)::numeric as visitas,
                coalesce(sum(propostas), 0)::numeric as propostas,
                coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                coalesce(sum(vendas), 0)::numeric as vendas,
                coalesce(sum(repasses), 0)::numeric as repasses,
                coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                coalesce(sum(distratos), 0)::numeric as distratos
            from fatos_diarios
            group by corretor_identity_key, corretor_match
        ),
        dup_nome as (
            select regexp_replace(regexp_replace(lower(trim(corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g') as chave
              from corretores_periodo
             group by 1
            having count(distinct produtivo_key) > 1
        ),
        dup_documento as (
            select lower(trim(documento)) as chave
              from corretores_periodo
             where nullif(trim(coalesce(documento, '')), '') is not null
             group by 1
            having count(distinct produtivo_key) > 1
        ),
        dup_email as (
            select lower(trim(email)) as chave
              from corretores_periodo
             where nullif(trim(coalesce(email, '')), '') is not null
             group by 1
            having count(distinct produtivo_key) > 1
        )
        select
            cp.*,
            coalesce(fp.leads, 0)::numeric as leads,
            coalesce(fp.agendamentos, 0)::numeric as agendamentos,
            coalesce(fp.visitas, 0)::numeric as visitas,
            coalesce(fp.propostas, 0)::numeric as propostas,
            coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
            coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
            coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
            coalesce(fp.vendas, 0)::numeric as vendas,
            coalesce(fp.repasses, 0)::numeric as repasses,
            coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
            coalesce(fp.distratos, 0)::numeric as distratos,
            (
                coalesce(fp.leads, 0)
              + coalesce(fp.agendamentos, 0)
              + coalesce(fp.visitas, 0)
              + coalesce(fp.propostas, 0)
              + coalesce(fp.vendas, 0)
              + coalesce(fp.repasses, 0)
              + coalesce(fp.cancelamentos, 0)
              + coalesce(fp.distratos, 0)
            )::numeric as producao_total,
            case when cp.meses_ativos > 0 then coalesce(fp.repasses, 0)::numeric / cp.meses_ativos else 0 end as ipc,
            exists (select 1 from dup_nome d where d.chave = regexp_replace(regexp_replace(lower(trim(cp.corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g')) as duplicado_nome,
            exists (select 1 from dup_documento d where d.chave = lower(trim(cp.documento))) as duplicado_documento,
            exists (select 1 from dup_email d where d.chave = lower(trim(cp.email))) as duplicado_email
        from corretores_periodo cp
        left join fatos_periodo fp
          on fp.corretor_identity_key = cp.corretor_identity_key
        order by cp.equipe, cp.gerente, cp.coordenador, cp.corretor
        """,
        *_params_corretor_analytics(intervalo, request),
    )

    fatos_sem_match_linhas = await conexao.fetch(
        f"""
        {_sql_corretor_analytics_base()}
        select
            fd.corretor,
            fd.corretor_identity_key,
            fd.corretor_match,
            coalesce(sum(fd.leads), 0)::numeric as leads,
            coalesce(sum(fd.agendamentos), 0)::numeric as agendamentos,
            coalesce(sum(fd.visitas), 0)::numeric as visitas,
            coalesce(sum(fd.propostas), 0)::numeric as propostas,
            coalesce(sum(fd.vendas), 0)::numeric as vendas,
            coalesce(sum(fd.repasses), 0)::numeric as repasses,
            coalesce(sum(fd.cancelamentos), 0)::numeric as cancelamentos,
            coalesce(sum(fd.distratos), 0)::numeric as distratos
        from fatos_diarios fd
        where not exists (
            select 1
              from funcionarios_vinculo fv
             where fv.corretor_identity_key = fd.corretor_identity_key
        )
        group by fd.corretor, fd.corretor_identity_key, fd.corretor_match
        having (
            coalesce(sum(fd.leads), 0)
          + coalesce(sum(fd.agendamentos), 0)
          + coalesce(sum(fd.visitas), 0)
          + coalesce(sum(fd.propostas), 0)
          + coalesce(sum(fd.vendas), 0)
          + coalesce(sum(fd.repasses), 0)
          + coalesce(sum(fd.cancelamentos), 0)
          + coalesce(sum(fd.distratos), 0)
        ) <> 0
        order by repasses desc, leads desc, corretor asc
        """,
        *_params_corretor_analytics(intervalo, request),
    )

    hierarquia: list[dict[str, Any]] = []
    for linha in linhas:
        item = _linha_para_dict(linha)
        alertas: list[str] = []
        if _texto_normalizado(item.get("gerente")) in {"", "sem gerente"}:
            alertas.append("sem_gestor")
        if _texto_normalizado(item.get("coordenador")) in {"", "sem coordenador"}:
            alertas.append("sem_coordenador")
        if _texto_normalizado(item.get("equipe")) in {"", "sem equipe"}:
            alertas.append("sem_equipe")
        if _texto_normalizado(item.get("regiao")) in {"", "sem regiao"}:
            alertas.append("sem_regiao")
        if _texto_normalizado(item.get("ativo_login")) in {"false", "0", "nao", "não", "n", "no", "bloqueado"}:
            alertas.append("login_inativo")
        if item.get("duplicado_nome"):
            alertas.append("duplicado_nome")
        if item.get("duplicado_documento"):
            alertas.append("duplicado_documento")
        if item.get("duplicado_email"):
            alertas.append("duplicado_email")
        if _valor_numero(item.get("producao_total")) == 0:
            alertas.append("sem_producao")
        item["alertas"] = alertas
        item["status_consistencia"] = "ok" if not alertas else "alerta"
        hierarquia.append(item)

    fatos_sem_match = [_linha_para_dict(linha) for linha in fatos_sem_match_linhas]
    for item in fatos_sem_match:
        item["producao_total"] = sum(
            _valor_numero(item.get(campo))
            for campo in ("leads", "visitas", "propostas", "vendas", "repasses", "cancelamentos", "distratos")
        )

    campos_filtro = {
        "corretorAtivo": ("corretor", "corretores"),
        "gestorCorretor": ("gerente", "gestores"),
        "coordenadorCorretor": ("coordenador", "coordenadores"),
        "regiaoCorretor": ("regiao", "regioes"),
        "imobiliariaCorretor": ("equipe", "equipes"),
    }
    mismatches: list[dict[str, Any]] = []
    for campo_filtro, (campo_item, nome_mismatch) in campos_filtro.items():
        opcoes = await _buscar_opcoes_hierarquia_oficial_segmentadas(
            conexao,
            campo_filtro,
            intervalo,
            request,
            1000,
        )
        valores_auditoria = {
            str(item.get(campo_item) or "").strip()
            for item in hierarquia
            if str(item.get(campo_item) or "").strip()
        }
        valores_filtro = {
            str(opcao.get("value") or "").strip()
            for opcao in opcoes
            if str(opcao.get("value") or "").strip()
        }
        mismatch = _mismatches_opcoes(nome_mismatch, valores_auditoria, valores_filtro)
        if mismatch:
            mismatches.append(mismatch)

    if fatos_sem_match:
        mismatches.append(
            {
                "tipo": "fatos_sem_funcionario_vinculado",
                "total": len(fatos_sem_match),
                "repasses": _somar_itens(fatos_sem_match, "repasses"),
                "items": fatos_sem_match,
            }
        )

    summary = {
        "corretores_ativos": len(hierarquia),
        "gestores": len({item.get("gerente") for item in hierarquia if item.get("gerente")}),
        "coordenadores": len({item.get("coordenador") for item in hierarquia if item.get("coordenador")}),
        "equipes": len({item.get("equipe") for item in hierarquia if item.get("equipe")}),
        "regioes": len({item.get("regiao") for item in hierarquia if item.get("regiao")}),
        "corretores_com_producao": sum(1 for item in hierarquia if _valor_numero(item.get("producao_total")) > 0),
        "corretores_sem_producao": sum(1 for item in hierarquia if _valor_numero(item.get("producao_total")) == 0),
        "corretores_com_alerta": sum(1 for item in hierarquia if item.get("alertas")),
        "repasses_atribuidos": _somar_itens(hierarquia, "repasses"),
        "repasses_sem_match": _somar_itens(fatos_sem_match, "repasses"),
        "leads_atribuidos": _somar_itens(hierarquia, "leads"),
        "visitas_atribuidas": _somar_itens(hierarquia, "visitas"),
        "propostas_atribuidas": _somar_itens(hierarquia, "propostas"),
        "vendas_atribuidas": _somar_itens(hierarquia, "vendas"),
    }

    return {
        "summary": summary,
        "hierarquia": hierarquia,
        "gestores": _agrupar_auditoria_hierarquia(hierarquia, "gerente", "Sem gerente"),
        "coordenadores": _agrupar_auditoria_hierarquia(hierarquia, "coordenador", "Sem coordenador"),
        "mismatches": mismatches,
        "meta": {
            "source": "sevenlm_connect.funcionario_acesso + comercial_kpi_daily + comercial_leads_historico",
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
            "rules": {
                "corretor": "tipo_funcionario = CORRETOR",
                "sdr": "tipo_funcionario = SDR",
                "vigencia": "quando data_inicio_vigencia/data_fim_vigencia existem, elas definem o ativo no periodo",
                "fallback_status": "sem datas de vigencia, aplica ativo/ativo_negocio/ativo_login e Status CV da observacao, igual Produtividade Gente/Cultura",
            },
        },
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/consolidado")
async def corretores_consolidado_dashboard(
    request: Request,
    search: str = Query("", max_length=120),
    sort: str = Query("repasses"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pagina, tamanho, offset = _paginacao(page, pageSize)
    ordenacao = _ordenacao_corretor(sort, order, CORRETORES_CONSOLIDADO_SORT, "repasses")
    pool = _obter_pool(request)

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            {_sql_corretor_analytics_base()},
            ativos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    count(distinct mes_referencia)::numeric as meses_ativos
                from hierarquia_ativa
                group by corretor_identity_key, corretor_match
            ),
            corretores_periodo as (
                select
                    fv.produtivo_key,
                    fv.corretor_identity_key,
                    fv.corretor_match,
                    fv.equipe_match,
                    fv.corretor,
                    fv.gerente,
                    fv.coordenador,
                    fv.regiao,
                    fv.equipe,
                    fv.identificador_funcionario,
                    fv.documento as funcionario_documento,
                    fv.email as funcionario_email,
                    fv.tipo_funcionario as funcionario_tipo,
                    fv.tipo_vinculo as funcionario_tipo_vinculo,
                    fv.ativo as funcionario_ativo,
                    fv.ativo_negocio as funcionario_ativo_negocio,
                    fv.ativo_login as funcionario_ativo_login,
                    coalesce(ap.meses_ativos, 0)::numeric as meses_ativos
                from funcionarios_vinculo fv
                left join ativos_periodo ap
                  on ap.corretor_identity_key = fv.corretor_identity_key
            ),
            fatos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    (array_agg(corretor order by corretor))[1] as corretor,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_diarios
                group by corretor_identity_key, corretor_match
            ),
            fatos_sem_match as (
                select
                    fp.*
                from fatos_periodo fp
                where not exists (
                    select 1
                      from corretores_periodo cp
                     where cp.corretor_identity_key = fp.corretor_identity_key
                )
            ),
            linhas_ativas as (
                select
                    cp.corretor_identity_key,
                    cp.corretor_match,
                    cp.corretor,
                    cp.gerente,
                    cp.coordenador,
                    cp.regiao,
                    cp.equipe,
                    cp.meses_ativos,
                    case when cp.meses_ativos > 0 then 1::numeric else 0::numeric end as base_ativa,
                    coalesce(fp.leads, 0)::numeric as leads,
                    coalesce(fp.agendamentos, 0)::numeric as agendamentos,
                    coalesce(fp.visitas, 0)::numeric as visitas,
                    coalesce(fp.propostas, 0)::numeric as propostas,
                    coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                    coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                    coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                    coalesce(fp.vendas, 0)::numeric as vendas,
                    coalesce(fp.repasses, 0)::numeric as repasses,
                    coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
                    coalesce(fp.distratos, 0)::numeric as distratos,
                    array[cp.corretor_identity_key]::text[] as corretor_identity_keys,
                    array[cp.corretor_match]::text[] as corretor_match_keys,
                    case when cp.meses_ativos > 0 then coalesce(fp.repasses, 0)::numeric / cp.meses_ativos else 0 end as ipc,
                    case when coalesce(fp.leads, 0) > 0 then coalesce(fp.visitas, 0)::numeric / fp.leads * 100 else 0 end as taxa_visita,
                    case when coalesce(fp.leads, 0) > 0 then coalesce(fp.vendas, 0)::numeric / fp.leads * 100 else 0 end as taxa_conversao_venda,
                    case when coalesce(fp.vendas, 0) > 0 then coalesce(fp.repasses, 0)::numeric / fp.vendas * 100 else 0 end as taxa_repasse_venda
                from corretores_periodo cp
                left join fatos_periodo fp
                  on fp.corretor_identity_key = cp.corretor_identity_key
            ),
            linhas_inativas as (
                select
                    'inativos/outros'::text as corretor_identity_key,
                    'inativos/outros'::text as corretor_match,
                    'Inativos/Outros'::text as corretor,
                    'Inativos/Outros'::text as gerente,
                    'Inativos/Outros'::text as coordenador,
                    'Inativos/Outros'::text as regiao,
                    'Inativos/Outros'::text as equipe,
                    0::numeric as meses_ativos,
                    0::numeric as base_ativa,
                    coalesce(sum(fp.leads), 0)::numeric as leads,
                    coalesce(sum(fp.agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(fp.visitas), 0)::numeric as visitas,
                    coalesce(sum(fp.propostas), 0)::numeric as propostas,
                    coalesce(sum(fp.propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(fp.propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(fp.propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(fp.vendas), 0)::numeric as vendas,
                    coalesce(sum(fp.repasses), 0)::numeric as repasses,
                    coalesce(sum(fp.cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(fp.distratos), 0)::numeric as distratos,
                    array_remove(array_agg(distinct fp.corretor_identity_key), null)::text[] as corretor_identity_keys,
                    array_remove(array_agg(distinct fp.corretor_match), null)::text[] as corretor_match_keys,
                    0::numeric as ipc,
                    case when coalesce(sum(fp.leads), 0) > 0 then coalesce(sum(fp.visitas), 0)::numeric / sum(fp.leads) * 100 else 0 end as taxa_visita,
                    case when coalesce(sum(fp.leads), 0) > 0 then coalesce(sum(fp.vendas), 0)::numeric / sum(fp.leads) * 100 else 0 end as taxa_conversao_venda,
                    case when coalesce(sum(fp.vendas), 0) > 0 then coalesce(sum(fp.repasses), 0)::numeric / sum(fp.vendas) * 100 else 0 end as taxa_repasse_venda
                from fatos_sem_match fp
                having (
                    coalesce(sum(fp.leads), 0)
                  + coalesce(sum(fp.agendamentos), 0)
                  + coalesce(sum(fp.visitas), 0)
                  + coalesce(sum(fp.propostas), 0)
                  + coalesce(sum(fp.vendas), 0)
                  + coalesce(sum(fp.repasses), 0)
                  + coalesce(sum(fp.cancelamentos), 0)
                  + coalesce(sum(fp.distratos), 0)
                ) <> 0
            ),
            linhas as (
                select * from linhas_ativas
                union all
                select * from linhas_inativas
            )
            select *, count(*) over()::int as total_count
              from linhas
             where (
                $15::text = ''
                or lower(corretor) like '%' || lower($15::text) || '%'
                or lower(gerente) like '%' || lower($15::text) || '%'
                or lower(coordenador) like '%' || lower($15::text) || '%'
                or lower(regiao) like '%' || lower($15::text) || '%'
                or lower(equipe) like '%' || lower($15::text) || '%'
             )
             order by {ordenacao}
             limit $16
            offset $17
            """,
            *_params_corretor_analytics(intervalo, request),
            search.strip(),
            tamanho,
            offset,
        )

    resposta = _resposta_paginada(linhas, pagina, tamanho)
    resposta["meta"] = {
        "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
        "startDate": intervalo.inicio,
        "endDate": intervalo.fim,
    }
    return resposta


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/audit")
async def corretores_auditoria_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        return await _auditar_corretores_comerciais(conexao, intervalo, request)


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/foguetes")
async def corretores_foguetes_dashboard(
    request: Request,
    search: str = Query("", max_length=120),
    sort: str = Query("repasses"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pagina, tamanho, offset = _paginacao(page, pageSize)
    ordenacao = _ordenacao_corretor(sort, order, CORRETORES_CONSOLIDADO_SORT, "repasses")
    pool = _obter_pool(request)

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            {_sql_corretor_analytics_base()},
            ativos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    count(distinct mes_referencia)::numeric as meses_ativos
                from hierarquia_ativa
                group by corretor_identity_key, corretor_match
            ),
            corretores_periodo as (
                select
                    fv.produtivo_key,
                    fv.corretor_identity_key,
                    fv.corretor_match,
                    fv.equipe_match,
                    fv.corretor,
                    fv.gerente,
                    fv.coordenador,
                    fv.regiao,
                    fv.equipe,
                    fv.identificador_funcionario,
                    fv.documento as funcionario_documento,
                    fv.email as funcionario_email,
                    fv.tipo_funcionario as funcionario_tipo,
                    fv.tipo_vinculo as funcionario_tipo_vinculo,
                    fv.ativo as funcionario_ativo,
                    fv.ativo_negocio as funcionario_ativo_negocio,
                    fv.ativo_login as funcionario_ativo_login,
                    coalesce(ap.meses_ativos, 0)::numeric as meses_ativos
                from funcionarios_vinculo fv
                left join ativos_periodo ap
                  on ap.corretor_identity_key = fv.corretor_identity_key
            ),
            fatos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    (array_agg(corretor order by corretor))[1] as corretor,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_diarios
                group by corretor_identity_key, corretor_match
            ),
            repasses_mes_anterior as (
                select
                    coalesce(fib.corretor_identity_key, 'nome:' || regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) as corretor_identity_key,
                    regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') as corretor_match,
                    sum(coalesce(repasses, 0))::numeric as repasses_mes_anterior
                from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
                left join fato_identity_bridge fib
                  on fib.corretor_match = regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                where data >= (select (date_trunc('month', fim) - interval '1 month')::date from periodo)
                  and data < (select date_trunc('month', fim)::date from periodo)
                  and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(cidade), ''), 'Sem regiao') = any($8::text[]))
                  and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(empreendimento_reduzido), ''), 'Sem regiao') = any($9::text[]))
                  and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe') = any($10::text[]))
                  and (
                    cardinality($11::text[]) = 0
                    or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                        select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                          from unnest($11::text[]) as filtro(valor)
                    )
                  )
                  and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(sdr), ''), 'Sem SDR') = any($12::text[]))
                  and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(origem), ''), 'Sem origem') = any($13::text[]))
                  and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(empreendimento), ''), 'Sem empreendimento') = any($14::text[]))
                group by 1, 2
                having sum(coalesce(repasses, 0)) >= 2
            ),
            linhas_ativas as (
                select
                    rma.corretor_identity_key,
                    rma.corretor_match,
                    coalesce(cp.corretor, fp.corretor, rma.corretor_match) as corretor,
                    coalesce(cp.gerente, 'Sem gerente') as gerente,
                    coalesce(cp.coordenador, 'Sem coordenador') as coordenador,
                    coalesce(cp.regiao, 'Sem regiao') as regiao,
                    coalesce(cp.equipe, 'Sem equipe') as equipe,
                    cp.identificador_funcionario,
                    cp.funcionario_documento,
                    cp.funcionario_email,
                    cp.funcionario_tipo,
                    cp.funcionario_tipo_vinculo,
                    cp.funcionario_ativo,
                    cp.funcionario_ativo_negocio,
                    cp.funcionario_ativo_login,
                    coalesce(cp.meses_ativos, 0)::numeric as meses_ativos,
                    case when coalesce(cp.meses_ativos, 0) > 0 then 1::numeric else 0::numeric end as base_ativa,
                    coalesce(fp.leads, 0)::numeric as leads,
                    coalesce(fp.agendamentos, 0)::numeric as agendamentos,
                    coalesce(fp.visitas, 0)::numeric as visitas,
                    coalesce(fp.propostas, 0)::numeric as propostas,
                    coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                    coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                    coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                    coalesce(fp.vendas, 0)::numeric as vendas,
                    coalesce(fp.repasses, 0)::numeric as repasses,
                    coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
                    coalesce(fp.distratos, 0)::numeric as distratos,
                    case when coalesce(cp.meses_ativos, 0) > 0 then coalesce(fp.repasses, 0)::numeric / cp.meses_ativos else 0 end as ipc,
                    case when coalesce(fp.leads, 0) > 0 then coalesce(fp.visitas, 0)::numeric / fp.leads * 100 else 0 end as taxa_visita,
                    case when coalesce(fp.leads, 0) > 0 then coalesce(fp.vendas, 0)::numeric / fp.leads * 100 else 0 end as taxa_conversao_venda,
                    case when coalesce(fp.vendas, 0) > 0 then coalesce(fp.repasses, 0)::numeric / fp.vendas * 100 else 0 end as taxa_repasse_venda
                from repasses_mes_anterior rma
                left join corretores_periodo cp
                  on cp.corretor_identity_key = rma.corretor_identity_key
                left join fatos_periodo fp
                  on fp.corretor_identity_key = rma.corretor_identity_key
            )
            select *, count(*) over()::int as total_count
              from linhas_ativas
             where (
                $15::text = ''
                or lower(corretor) like '%' || lower($15::text) || '%'
                or lower(gerente) like '%' || lower($15::text) || '%'
                or lower(coordenador) like '%' || lower($15::text) || '%'
                or lower(regiao) like '%' || lower($15::text) || '%'
                or lower(equipe) like '%' || lower($15::text) || '%'
             )
             order by {ordenacao}
             limit $16
            offset $17
            """,
            *_params_corretor_analytics(intervalo, request),
            search.strip(),
            tamanho,
            offset,
        )
        resumo = await conexao.fetchrow(
            f"""
            {_sql_corretor_analytics_base()},
            ativos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    count(distinct mes_referencia)::numeric as meses_ativos
                from hierarquia_ativa
                group by corretor_identity_key, corretor_match
            ),
            corretores_periodo as (
                select
                    fv.produtivo_key,
                    fv.corretor_identity_key,
                    fv.corretor_match,
                    fv.equipe_match,
                    fv.corretor,
                    fv.gerente,
                    fv.coordenador,
                    fv.regiao,
                    fv.equipe,
                    coalesce(ap.meses_ativos, 0)::numeric as meses_ativos
                from funcionarios_vinculo fv
                left join ativos_periodo ap
                  on ap.corretor_identity_key = fv.corretor_identity_key
            ),
            fatos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    (array_agg(corretor order by corretor))[1] as corretor,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_diarios
                group by corretor_identity_key, corretor_match
            ),
            repasses_mes_anterior as (
                select
                    coalesce(fib.corretor_identity_key, 'nome:' || regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) as corretor_identity_key,
                    regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') as corretor_match,
                    sum(coalesce(repasses, 0))::numeric as repasses_mes_anterior
                from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
                left join fato_identity_bridge fib
                  on fib.corretor_match = regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                where data >= (select (date_trunc('month', fim) - interval '1 month')::date from periodo)
                  and data < (select date_trunc('month', fim)::date from periodo)
                  and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(cidade), ''), 'Sem regiao') = any($8::text[]))
                  and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(empreendimento_reduzido), ''), 'Sem regiao') = any($9::text[]))
                  and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(imobiliaria), ''), 'Sem equipe') = any($10::text[]))
                  and (
                    cardinality($11::text[]) = 0
                    or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                        select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                          from unnest($11::text[]) as filtro(valor)
                    )
                  )
                  and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(sdr), ''), 'Sem SDR') = any($12::text[]))
                  and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(origem), ''), 'Sem origem') = any($13::text[]))
                  and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(empreendimento), ''), 'Sem empreendimento') = any($14::text[]))
                group by 1, 2
            ),
            linhas_foguetes as (
                select
                    rma.corretor_identity_key,
                    rma.corretor_match,
                    coalesce(cp.corretor, fp.corretor, rma.corretor_match) as corretor,
                    coalesce(fp.leads, 0)::numeric as leads,
                    coalesce(fp.agendamentos, 0)::numeric as agendamentos,
                    coalesce(fp.visitas, 0)::numeric as visitas,
                    coalesce(fp.propostas, 0)::numeric as propostas,
                    coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                    coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                    coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                    coalesce(fp.vendas, 0)::numeric as vendas,
                    coalesce(fp.repasses, 0)::numeric as repasses,
                    coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
                    coalesce(fp.distratos, 0)::numeric as distratos,
                    rma.repasses_mes_anterior
                from repasses_mes_anterior rma
                left join corretores_periodo cp
                  on cp.corretor_identity_key = rma.corretor_identity_key
                left join fatos_periodo fp
                  on fp.corretor_identity_key = rma.corretor_identity_key
                where rma.repasses_mes_anterior >= 2
            ),
            empreendimentos_diarios_foguetes as (
                select
                    lf.corretor_identity_key,
                    lf.corretor_match,
                    lf.corretor,
                    coalesce(nullif(trim(fd.empreendimento), ''), 'Sem empreendimento') as empreendimento,
                    coalesce(sum(fd.leads), 0)::numeric as leads,
                    coalesce(sum(fd.visitas), 0)::numeric as visitas,
                    coalesce(sum(fd.propostas), 0)::numeric as propostas,
                    coalesce(sum(fd.vendas), 0)::numeric as vendas,
                    0::numeric as vendas_finalizadas,
                    coalesce(sum(fd.repasses), 0)::numeric as repasses
                from fatos_diarios fd
                join linhas_foguetes lf
                  on lf.corretor_identity_key = fd.corretor_identity_key
                group by 1, 2, 3, 4
                having (
                    coalesce(sum(fd.leads), 0)
                  + coalesce(sum(fd.visitas), 0)
                  + coalesce(sum(fd.propostas), 0)
                  + coalesce(sum(fd.vendas), 0)
                  + coalesce(sum(fd.repasses), 0)
                ) > 0
            ),
            empreendimentos_convertidos_foguetes as (
                select
                    coalesce(fib.corretor_identity_key, 'nome:' || regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) as corretor_identity_key,
                    regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') as corretor_match,
                    (array_agg(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor') order by coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor')))[1] as corretor,
                    coalesce(nullif(trim(b.empreendimento_nome), ''), 'Sem empreendimento') as empreendimento,
                    0::numeric as leads,
                    0::numeric as visitas,
                    0::numeric as propostas,
                    count(distinct b.idreserva) filter (
                        where b.dt_cadastro_reserva >= (select inicio from periodo)
                          and b.dt_cadastro_reserva < (select fim_exclusivo from periodo)
                          and not ({_sql_reserva_cancelada('b')})
                    )::numeric as vendas,
                    count(distinct b.idreserva) filter (
                        where b.dt_venda_finalizada >= (select inicio from periodo)
                          and b.dt_venda_finalizada < (select fim_exclusivo from periodo)
                    )::numeric as vendas_finalizadas,
                    count(distinct b.idrepasse) filter (
                        where b.dt_assinatura_contrato >= (select inicio from periodo)
                          and b.dt_assinatura_contrato < (select fim_exclusivo from periodo)
                    )::numeric as repasses
                from {ESQUEMA_COMERCIAL}.comercial_base b
                left join fato_identity_bridge fib
                  on fib.corretor_match = regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                join linhas_foguetes lf
                  on lf.corretor_identity_key = coalesce(fib.corretor_identity_key, 'nome:' || regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g'))
                where (
                    (b.dt_cadastro_reserva >= (select inicio from periodo) and b.dt_cadastro_reserva < (select fim_exclusivo from periodo))
                    or (b.dt_venda_finalizada >= (select inicio from periodo) and b.dt_venda_finalizada < (select fim_exclusivo from periodo))
                    or (b.dt_assinatura_contrato >= (select inicio from periodo) and b.dt_assinatura_contrato < (select fim_exclusivo from periodo))
                )
                  and (cardinality($8::text[]) = 0 or coalesce(nullif(trim(b.lead_cidade), ''), 'Sem regiao') = any($8::text[]))
                  and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(b.regiao_empreendimento), ''), 'Sem regiao') = any($9::text[]))
                  and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(b.imobiliaria_nome_canonica), ''), nullif(trim(b.imobiliaria_nome), ''), 'Sem equipe') = any($10::text[]))
                  and (
                    cardinality($11::text[]) = 0
                    or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                        select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                          from unnest($11::text[]) as filtro(valor)
                    )
                  )
                  and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(b.sdr_nome), ''), 'Sem SDR') = any($12::text[]))
                  and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(b.lead_origem_nome), ''), 'Sem origem') = any($13::text[]))
                  and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(b.empreendimento_nome), ''), 'Sem empreendimento') = any($14::text[]))
                group by 1, 2, 4
                having (
                    count(distinct b.idreserva) filter (
                        where b.dt_cadastro_reserva >= (select inicio from periodo)
                          and b.dt_cadastro_reserva < (select fim_exclusivo from periodo)
                          and not ({_sql_reserva_cancelada('b')})
                    )
                  + count(distinct b.idrepasse) filter (
                        where b.dt_assinatura_contrato >= (select inicio from periodo)
                          and b.dt_assinatura_contrato < (select fim_exclusivo from periodo)
                    )
                  + count(distinct b.idreserva) filter (
                        where b.dt_venda_finalizada >= (select inicio from periodo)
                          and b.dt_venda_finalizada < (select fim_exclusivo from periodo)
                    )
                ) > 0
            ),
            empreendimentos_foguetes as (
                select
                    coalesce(d.corretor_identity_key, c.corretor_identity_key) as corretor_identity_key,
                    coalesce(d.corretor_match, c.corretor_match) as corretor_match,
                    coalesce(d.corretor, c.corretor) as corretor,
                    coalesce(d.empreendimento, c.empreendimento) as empreendimento,
                    coalesce(d.leads, 0)::numeric as leads,
                    coalesce(d.visitas, 0)::numeric as visitas,
                    coalesce(d.propostas, 0)::numeric as propostas,
                    greatest(coalesce(d.vendas, 0), coalesce(c.vendas, 0))::numeric as vendas,
                    greatest(coalesce(d.vendas_finalizadas, 0), coalesce(c.vendas_finalizadas, 0))::numeric as vendas_finalizadas,
                    greatest(coalesce(d.repasses, 0), coalesce(c.repasses, 0))::numeric as repasses
                from empreendimentos_diarios_foguetes d
                full join empreendimentos_convertidos_foguetes c
                  on c.corretor_identity_key = d.corretor_identity_key
                 and c.empreendimento = d.empreendimento
            ),
            fato_geral as (
                select
                    count(*)::numeric as corretores_com_fato,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_periodo
            ),
            foguetes_geral as (
                select
                    count(*)::numeric as corretores,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos,
                    coalesce(sum(repasses_mes_anterior), 0)::numeric as repasses_qualificacao
                from linhas_foguetes
            ),
            qualificacao as (
                select
                    count(*) filter (where repasses_mes_anterior > 0)::numeric as corretores_com_repasse_mes_anterior,
                    count(*) filter (where repasses_mes_anterior >= 2)::numeric as corretores_acima_corte_fato,
                    coalesce(sum(repasses_mes_anterior), 0)::numeric as repasses_mes_anterior_fato,
                    coalesce(sum(repasses_mes_anterior) filter (where repasses_mes_anterior >= 2), 0)::numeric as repasses_mes_anterior_acima_corte
                from repasses_mes_anterior
            )
            select
                fg.corretores_com_fato as fato_corretores_com_fato,
                fg.leads as fato_leads,
                fg.visitas as fato_visitas,
                fg.propostas as fato_propostas,
                fg.propostas_aprovadas as fato_propostas_aprovadas,
                fg.propostas_condicionadas as fato_propostas_condicionadas,
                fg.propostas_reprovadas as fato_propostas_reprovadas,
                fg.vendas as fato_vendas,
                fg.repasses as fato_repasses,
                fg.cancelamentos as fato_cancelamentos,
                fg.distratos as fato_distratos,
                fog.corretores as foguetes_corretores,
                fog.leads as foguetes_leads,
                fog.visitas as foguetes_visitas,
                fog.propostas as foguetes_propostas,
                fog.propostas_aprovadas as foguetes_propostas_aprovadas,
                fog.propostas_condicionadas as foguetes_propostas_condicionadas,
                fog.propostas_reprovadas as foguetes_propostas_reprovadas,
                fog.vendas as foguetes_vendas,
                fog.repasses as foguetes_repasses,
                fog.cancelamentos as foguetes_cancelamentos,
                fog.distratos as foguetes_distratos,
                fog.repasses_qualificacao as foguetes_repasses_qualificacao,
                greatest(fg.leads - fog.leads, 0)::numeric as diferenca_leads,
                greatest(fg.visitas - fog.visitas, 0)::numeric as diferenca_visitas,
                greatest(fg.propostas - fog.propostas, 0)::numeric as diferenca_propostas,
                greatest(fg.vendas - fog.vendas, 0)::numeric as diferenca_vendas,
                greatest(fg.repasses - fog.repasses, 0)::numeric as diferenca_repasses,
                q.corretores_com_repasse_mes_anterior,
                q.corretores_acima_corte_fato,
                q.repasses_mes_anterior_fato,
                q.repasses_mes_anterior_acima_corte,
                coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'empreendimento', empreendimento,
                            'leads', leads,
                            'visitas', visitas,
                            'propostas', propostas,
                            'vendas', vendas,
                            'vendas_finalizadas', vendas_finalizadas,
                            'repasses', repasses
                        )
                        order by vendas desc, repasses desc, propostas desc, empreendimento asc
                    )
                    from (
                        select
                            empreendimento,
                            coalesce(sum(leads), 0)::numeric as leads,
                            coalesce(sum(visitas), 0)::numeric as visitas,
                            coalesce(sum(propostas), 0)::numeric as propostas,
                            coalesce(sum(vendas), 0)::numeric as vendas,
                            coalesce(sum(vendas_finalizadas), 0)::numeric as vendas_finalizadas,
                            coalesce(sum(repasses), 0)::numeric as repasses
                        from empreendimentos_foguetes
                        group by empreendimento
                        order by vendas desc, repasses desc, propostas desc, empreendimento asc
                        limit 8
                    ) top_empreendimentos
                ), '[]'::jsonb) as top_empreendimentos,
                coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'corretor', corretor,
                            'corretor_match', corretor_match,
                            'empreendimento', empreendimento,
                            'leads', leads,
                            'visitas', visitas,
                            'propostas', propostas,
                            'vendas', vendas,
                            'vendas_finalizadas', vendas_finalizadas,
                            'repasses', repasses
                        )
                        order by corretor asc, vendas desc, repasses desc, empreendimento asc
                    )
                    from empreendimentos_foguetes
                ), '[]'::jsonb) as empreendimentos_foguetes,
                coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'corretor', corretor,
                            'corretor_match', corretor_match,
                            'equipe', equipe,
                            'gerente', gerente,
                            'regiao', regiao,
                            'ativo_hc', ativo_hc,
                            'virou_foguete', virou_foguete,
                            'repasses_mes_anterior', repasses_mes_anterior,
                            'vendas_periodo', vendas_periodo,
                            'repasses_periodo', repasses_periodo
                        )
                        order by repasses_mes_anterior desc, corretor asc
                    )
                    from (
                        select
                            coalesce(cp.corretor, rma.corretor_match) as corretor,
                            rma.corretor_identity_key,
                            rma.corretor_match,
                            coalesce(cp.equipe, 'Sem equipe') as equipe,
                            coalesce(cp.gerente, 'Sem gerente') as gerente,
                            coalesce(cp.regiao, 'Sem regiao') as regiao,
                            coalesce(cp.meses_ativos, 0) > 0 as ativo_hc,
                            rma.repasses_mes_anterior >= 2 as virou_foguete,
                            rma.repasses_mes_anterior,
                            coalesce(fp.vendas, 0)::numeric as vendas_periodo,
                            coalesce(fp.repasses, 0)::numeric as repasses_periodo
                        from repasses_mes_anterior rma
                        left join corretores_periodo cp
                          on cp.corretor_identity_key = rma.corretor_identity_key
                        left join fatos_periodo fp
                          on fp.corretor_identity_key = rma.corretor_identity_key
                        where rma.repasses_mes_anterior >= 2
                        order by rma.repasses_mes_anterior desc, coalesce(cp.corretor, rma.corretor_match) asc
                        limit 120
                    ) corretores_repasse
                ), '[]'::jsonb) as corretores_repasses_mes_anterior
            from fato_geral fg
            cross join foguetes_geral fog
            cross join qualificacao q
            """,
            *_params_corretor_analytics(intervalo, request),
        )

    resposta = _resposta_paginada(linhas, pagina, tamanho)
    resumo_dict = _linha_para_dict(resumo) if resumo else {}
    top_empreendimentos = resumo_dict.get("top_empreendimentos") or []
    if isinstance(top_empreendimentos, str):
        try:
            top_empreendimentos = json.loads(top_empreendimentos)
        except json.JSONDecodeError:
            top_empreendimentos = []
    empreendimentos_foguetes = resumo_dict.get("empreendimentos_foguetes") or []
    if isinstance(empreendimentos_foguetes, str):
        try:
            empreendimentos_foguetes = json.loads(empreendimentos_foguetes)
        except json.JSONDecodeError:
            empreendimentos_foguetes = []
    corretores_repasses_mes_anterior = resumo_dict.get("corretores_repasses_mes_anterior") or []
    if isinstance(corretores_repasses_mes_anterior, str):
        try:
            corretores_repasses_mes_anterior = json.loads(corretores_repasses_mes_anterior)
        except json.JSONDecodeError:
            corretores_repasses_mes_anterior = []
    resposta["summary"] = {
        "fato": {
            "corretores_com_fato": resumo_dict.get("fato_corretores_com_fato", 0),
            "leads": resumo_dict.get("fato_leads", 0),
            "visitas": resumo_dict.get("fato_visitas", 0),
            "propostas": resumo_dict.get("fato_propostas", 0),
            "propostas_aprovadas": resumo_dict.get("fato_propostas_aprovadas", 0),
            "propostas_condicionadas": resumo_dict.get("fato_propostas_condicionadas", 0),
            "propostas_reprovadas": resumo_dict.get("fato_propostas_reprovadas", 0),
            "vendas": resumo_dict.get("fato_vendas", 0),
            "repasses": resumo_dict.get("fato_repasses", 0),
            "cancelamentos": resumo_dict.get("fato_cancelamentos", 0),
            "distratos": resumo_dict.get("fato_distratos", 0),
        },
        "foguetes": {
            "corretores": resumo_dict.get("foguetes_corretores", 0),
            "leads": resumo_dict.get("foguetes_leads", 0),
            "visitas": resumo_dict.get("foguetes_visitas", 0),
            "propostas": resumo_dict.get("foguetes_propostas", 0),
            "propostas_aprovadas": resumo_dict.get("foguetes_propostas_aprovadas", 0),
            "propostas_condicionadas": resumo_dict.get("foguetes_propostas_condicionadas", 0),
            "propostas_reprovadas": resumo_dict.get("foguetes_propostas_reprovadas", 0),
            "vendas": resumo_dict.get("foguetes_vendas", 0),
            "repasses": resumo_dict.get("foguetes_repasses", 0),
            "cancelamentos": resumo_dict.get("foguetes_cancelamentos", 0),
            "distratos": resumo_dict.get("foguetes_distratos", 0),
            "repasses_qualificacao": resumo_dict.get("foguetes_repasses_qualificacao", 0),
        },
        "diferenca": {
            "leads": resumo_dict.get("diferenca_leads", 0),
            "visitas": resumo_dict.get("diferenca_visitas", 0),
            "propostas": resumo_dict.get("diferenca_propostas", 0),
            "vendas": resumo_dict.get("diferenca_vendas", 0),
            "repasses": resumo_dict.get("diferenca_repasses", 0),
        },
        "qualificacao": {
            "corte_repasses_mes_anterior": 2,
            "comparador": ">=",
            "corretores_com_repasse_mes_anterior": resumo_dict.get("corretores_com_repasse_mes_anterior", 0),
            "corretores_acima_corte_fato": resumo_dict.get("corretores_acima_corte_fato", 0),
            "repasses_mes_anterior_fato": resumo_dict.get("repasses_mes_anterior_fato", 0),
            "repasses_mes_anterior_acima_corte": resumo_dict.get("repasses_mes_anterior_acima_corte", 0),
        },
        "top_empreendimentos": top_empreendimentos if isinstance(top_empreendimentos, list) else [],
        "empreendimentos_foguetes": empreendimentos_foguetes if isinstance(empreendimentos_foguetes, list) else [],
        "corretores_repasses_mes_anterior": corretores_repasses_mes_anterior if isinstance(corretores_repasses_mes_anterior, list) else [],
    }
    resposta["meta"] = {
        "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
        "startDate": intervalo.inicio,
        "endDate": intervalo.fim,
        "qualification": "corretores com 2 ou mais repasses no periodo demarcado da regra",
        "qualificationStartDate": (intervalo.fim.replace(day=1) - timedelta(days=1)).replace(day=1),
        "qualificationEndDate": intervalo.fim.replace(day=1) - timedelta(days=1),
        "summaryNotes": [
            "Comparativo respeita filtros globais e nao aplica a busca textual da tabela.",
            "Fato geral soma todos os corretores presentes em comercial_kpi_daily no periodo filtrado.",
            "Foguetes soma corretores que passaram no corte de 2 ou mais repasses no periodo demarcado da regra.",
        ],
    }
    return resposta


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/foguetes/frequencia")
async def corretores_foguetes_frequencia_dashboard(
    request: Request,
    search: str = Query("", max_length=120),
    limit: int = Query(80, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            {_sql_corretor_analytics_base()},
            meses_analise as (
                select generate_series(
                    (select mes_inicio from periodo),
                    (select mes_fim from periodo),
                    interval '1 month'
                )::date as mes_referencia
            ),
            corretores_mes as (
                select
                    ha.mes_referencia,
                    ha.produtivo_key,
                    ha.corretor_identity_key,
                    ha.corretor_match,
                    ha.equipe_match,
                    ha.corretor,
                    ha.gerente,
                    ha.coordenador,
                    ha.regiao,
                    ha.equipe
                from hierarquia_ativa ha
            ),
            repasses_qualificacao_mes as (
                select
                    ma.mes_referencia,
                    coalesce(fib.corretor_identity_key, 'nome:' || regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) as corretor_identity_key,
                    regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') as corretor_match,
                    sum(coalesce(k.repasses, 0))::numeric as repasses_mes_anterior
                from meses_analise ma
                join {ESQUEMA_COMERCIAL}.comercial_kpi_daily k
                  on k.data >= (ma.mes_referencia - interval '1 month')::date
                 and k.data < ma.mes_referencia
                left join fato_identity_bridge fib
                  on fib.corretor_match = regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                where (cardinality($8::text[]) = 0 or coalesce(nullif(trim(k.cidade), ''), 'Sem regiao') = any($8::text[]))
                  and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(k.empreendimento_reduzido), ''), 'Sem regiao') = any($9::text[]))
                  and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(k.imobiliaria), ''), 'Sem equipe') = any($10::text[]))
                  and (
                    cardinality($11::text[]) = 0
                    or regexp_replace(regexp_replace(lower(trim(coalesce(nullif(trim(k.corretor), ''), 'Sem corretor'))), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g') in (
                        select regexp_replace(regexp_replace(lower(trim(valor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                          from unnest($11::text[]) as filtro(valor)
                    )
                  )
                  and (cardinality($12::text[]) = 0 or coalesce(nullif(trim(k.sdr), ''), 'Sem SDR') = any($12::text[]))
                  and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(k.origem), ''), 'Sem origem') = any($13::text[]))
                  and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(k.empreendimento), ''), 'Sem empreendimento') = any($14::text[]))
                group by ma.mes_referencia, 2, 3
            ),
            classificacao_mes as (
                select
                    cm.*,
                    coalesce(rqm.repasses_mes_anterior, 0)::numeric as repasses_mes_anterior,
                    (coalesce(rqm.repasses_mes_anterior, 0) >= 2) as virou_foguete
                from corretores_mes cm
                left join repasses_qualificacao_mes rqm
                  on rqm.mes_referencia = cm.mes_referencia
                 and rqm.corretor_identity_key = cm.corretor_identity_key
            ),
            frequencia as (
                select
                    produtivo_key,
                    corretor_identity_key,
                    corretor_match,
                    equipe_match,
                    (array_agg(corretor order by mes_referencia desc, corretor))[1] as corretor,
                    (array_agg(gerente order by mes_referencia desc, gerente))[1] as gerente,
                    (array_agg(coordenador order by mes_referencia desc, coordenador))[1] as coordenador,
                    (array_agg(regiao order by mes_referencia desc, regiao))[1] as regiao,
                    (array_agg(equipe order by mes_referencia desc, equipe))[1] as equipe,
                    count(distinct mes_referencia)::int as meses_ativos,
                    count(*) filter (where virou_foguete)::int as vezes_foguete,
                    coalesce(sum(repasses_mes_anterior) filter (where virou_foguete), 0)::numeric as repasses_qualificacao,
                    jsonb_agg(
                        jsonb_build_object(
                            'mes', to_char(mes_referencia, 'YYYY-MM'),
                            'virou_foguete', virou_foguete,
                            'repasses_mes_anterior', repasses_mes_anterior
                        )
                        order by mes_referencia
                    ) as meses
                from classificacao_mes
                group by produtivo_key, corretor_identity_key, corretor_match, equipe_match
            )
            select
                *,
                case when meses_ativos > 0 then vezes_foguete::numeric / meses_ativos else 0 end as frequencia_foguete,
                case
                  when vezes_foguete >= 4 or (meses_ativos > 0 and vezes_foguete::numeric / meses_ativos >= 0.75) then 'recorrente'
                  when vezes_foguete >= 2 or (meses_ativos > 0 and vezes_foguete::numeric / meses_ativos >= 0.40) then 'em_aceleracao'
                  when vezes_foguete = 1 then 'pontual'
                  else 'nao_foguete'
                end as classificacao_frequencia,
                count(*) over()::int as total_count
            from frequencia
            where vezes_foguete > 0
              and (
                $15::text = ''
                or lower(corretor) like '%' || lower($15::text) || '%'
                or lower(gerente) like '%' || lower($15::text) || '%'
                or lower(coordenador) like '%' || lower($15::text) || '%'
                or lower(regiao) like '%' || lower($15::text) || '%'
                or lower(equipe) like '%' || lower($15::text) || '%'
              )
            order by vezes_foguete desc, frequencia_foguete desc, repasses_qualificacao desc, corretor asc
            limit $16
            """,
            *_params_corretor_analytics(intervalo, request),
            search.strip(),
            limit,
        )

    itens = [_linha_para_dict(linha) for linha in linhas]
    total = int(itens[0].get("total_count") or 0) if itens else 0
    for item in itens:
        item.pop("total_count", None)
    return {
        "items": itens,
        "pagination": {"total": total, "limit": limit},
        "meta": {
            "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
            "rule": "Conta 1 vez por mes em que o corretor teve 2 ou mais repasses no mes anterior.",
        },
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/diario")
async def corretores_diario_dashboard(
    request: Request,
    search: str = Query("", max_length=120),
    sort: str = Query("corretor"),
    order: str = Query("asc"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pagina, tamanho, offset = _paginacao(page, pageSize)
    ordenacao = _ordenacao_corretor(sort, order, CORRETORES_CONSOLIDADO_SORT, "corretor")
    pool = _obter_pool(request)

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            {_sql_corretor_analytics_base()},
            dias as (
                select generate_series($1::date, $2::date, interval '1 day')::date as data
            ),
            ativos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    count(distinct mes_referencia)::numeric as meses_ativos
                from hierarquia_ativa
                group by corretor_identity_key, corretor_match
            ),
            corretores_periodo as (
                select
                    fv.produtivo_key,
                    fv.corretor_identity_key,
                    fv.corretor_match,
                    fv.equipe_match,
                    fv.corretor,
                    fv.gerente,
                    fv.coordenador,
                    fv.regiao,
                    fv.equipe,
                    coalesce(ap.meses_ativos, 0)::numeric as meses_ativos
                from funcionarios_vinculo fv
                left join ativos_periodo ap
                  on ap.corretor_identity_key = fv.corretor_identity_key
            ),
            fatos_periodo as (
                select
                    corretor_identity_key,
                    corretor_match,
                    (array_agg(corretor order by corretor))[1] as corretor,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_diarios
                group by corretor_identity_key, corretor_match
            ),
            fatos_sem_match as (
                select
                    fp.*
                from fatos_periodo fp
                where not exists (
                    select 1
                      from corretores_periodo cp
                     where cp.corretor_identity_key = fp.corretor_identity_key
                )
            ),
            fatos_diarios_corretor as (
                select
                    data,
                    mes_referencia,
                    corretor_identity_key,
                    corretor_match,
                    (array_agg(corretor order by corretor))[1] as corretor,
                    coalesce(sum(leads), 0)::numeric as leads,
                    coalesce(sum(agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(visitas), 0)::numeric as visitas,
                    coalesce(sum(propostas), 0)::numeric as propostas,
                    coalesce(sum(propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(vendas), 0)::numeric as vendas,
                    coalesce(sum(repasses), 0)::numeric as repasses,
                    coalesce(sum(cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(distratos), 0)::numeric as distratos
                from fatos_diarios
                group by data, mes_referencia, corretor_identity_key, corretor_match
            ),
            fatos_diarios_inativos as (
                select
                    fd.data,
                    coalesce(sum(fd.leads), 0)::numeric as leads,
                    coalesce(sum(fd.agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(fd.visitas), 0)::numeric as visitas,
                    coalesce(sum(fd.propostas), 0)::numeric as propostas,
                    coalesce(sum(fd.propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(fd.propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(fd.propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(fd.vendas), 0)::numeric as vendas,
                    coalesce(sum(fd.repasses), 0)::numeric as repasses,
                    coalesce(sum(fd.cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(fd.distratos), 0)::numeric as distratos
                from fatos_diarios fd
                where not exists (
                    select 1
                      from corretores_periodo cp
                     where cp.corretor_identity_key = fd.corretor_identity_key
                )
                group by fd.data
            ),
            entidades_ativas as (
                select
                    cp.produtivo_key as entidade_key,
                    cp.corretor_identity_key,
                    cp.corretor_match,
                    cp.equipe_match,
                    cp.corretor,
                    cp.gerente,
                    cp.coordenador,
                    cp.regiao,
                    cp.equipe,
                    cp.meses_ativos,
                    case when cp.meses_ativos > 0 then 1::numeric else 0::numeric end as base_ativa,
                    coalesce(fp.leads, 0)::numeric as leads,
                    coalesce(fp.agendamentos, 0)::numeric as agendamentos,
                    coalesce(fp.visitas, 0)::numeric as visitas,
                    coalesce(fp.propostas, 0)::numeric as propostas,
                    coalesce(fp.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                    coalesce(fp.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                    coalesce(fp.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                    coalesce(fp.vendas, 0)::numeric as vendas,
                    coalesce(fp.repasses, 0)::numeric as repasses,
                    coalesce(fp.cancelamentos, 0)::numeric as cancelamentos,
                    coalesce(fp.distratos, 0)::numeric as distratos
                from corretores_periodo cp
                left join fatos_periodo fp
                  on fp.corretor_identity_key = cp.corretor_identity_key
            ),
            entidades_inativas as (
                select
                    'inativos/outros'::text as entidade_key,
                    'inativos/outros'::text as corretor_identity_key,
                    'inativos/outros'::text as corretor_match,
                    'inativos/outros'::text as equipe_match,
                    'Inativos/Outros'::text as corretor,
                    'Inativos/Outros'::text as gerente,
                    'Inativos/Outros'::text as coordenador,
                    'Inativos/Outros'::text as regiao,
                    'Inativos/Outros'::text as equipe,
                    0::numeric as meses_ativos,
                    0::numeric as base_ativa,
                    coalesce(sum(fp.leads), 0)::numeric as leads,
                    coalesce(sum(fp.agendamentos), 0)::numeric as agendamentos,
                    coalesce(sum(fp.visitas), 0)::numeric as visitas,
                    coalesce(sum(fp.propostas), 0)::numeric as propostas,
                    coalesce(sum(fp.propostas_aprovadas), 0)::numeric as propostas_aprovadas,
                    coalesce(sum(fp.propostas_condicionadas), 0)::numeric as propostas_condicionadas,
                    coalesce(sum(fp.propostas_reprovadas), 0)::numeric as propostas_reprovadas,
                    coalesce(sum(fp.vendas), 0)::numeric as vendas,
                    coalesce(sum(fp.repasses), 0)::numeric as repasses,
                    coalesce(sum(fp.cancelamentos), 0)::numeric as cancelamentos,
                    coalesce(sum(fp.distratos), 0)::numeric as distratos
                from fatos_sem_match fp
                having (
                    coalesce(sum(fp.leads), 0)
                  + coalesce(sum(fp.agendamentos), 0)
                  + coalesce(sum(fp.visitas), 0)
                  + coalesce(sum(fp.propostas), 0)
                  + coalesce(sum(fp.vendas), 0)
                  + coalesce(sum(fp.repasses), 0)
                  + coalesce(sum(fp.cancelamentos), 0)
                  + coalesce(sum(fp.distratos), 0)
                ) <> 0
            ),
            entidades as (
                select * from entidades_ativas
                union all
                select * from entidades_inativas
            ),
            entidades_filtradas as (
                select *, count(*) over()::int as total_count
                  from entidades
                 where (
                    $15::text = ''
                    or lower(corretor) like '%' || lower($15::text) || '%'
                    or lower(gerente) like '%' || lower($15::text) || '%'
                    or lower(coordenador) like '%' || lower($15::text) || '%'
                    or lower(regiao) like '%' || lower($15::text) || '%'
                    or lower(equipe) like '%' || lower($15::text) || '%'
                 )
            ),
            entidades_paginadas as (
                select *
                  from entidades_filtradas
                 order by {ordenacao}
                 limit $16
                offset $17
            )
            select
                ep.entidade_key,
                ep.corretor_identity_key,
                ep.corretor_match,
                ep.corretor,
                ep.gerente,
                ep.coordenador,
                ep.regiao,
                ep.equipe,
                ep.meses_ativos,
                ep.base_ativa,
                ep.leads as leads_periodo,
                ep.agendamentos as agendamentos_periodo,
                ep.visitas as visitas_periodo,
                ep.propostas as propostas_periodo,
                ep.vendas as vendas_periodo,
                ep.repasses as repasses_periodo,
                dias.data,
                coalesce(fd.leads, fdi.leads, 0)::numeric as leads,
                coalesce(fd.agendamentos, fdi.agendamentos, 0)::numeric as agendamentos,
                coalesce(fd.visitas, fdi.visitas, 0)::numeric as visitas,
                coalesce(fd.propostas, fdi.propostas, 0)::numeric as propostas,
                coalesce(fd.propostas_aprovadas, fdi.propostas_aprovadas, 0)::numeric as propostas_aprovadas,
                coalesce(fd.propostas_condicionadas, fdi.propostas_condicionadas, 0)::numeric as propostas_condicionadas,
                coalesce(fd.propostas_reprovadas, fdi.propostas_reprovadas, 0)::numeric as propostas_reprovadas,
                coalesce(fd.vendas, fdi.vendas, 0)::numeric as vendas,
                coalesce(fd.repasses, fdi.repasses, 0)::numeric as repasses,
                coalesce(fd.cancelamentos, fdi.cancelamentos, 0)::numeric as cancelamentos,
                coalesce(fd.distratos, fdi.distratos, 0)::numeric as distratos,
                ep.total_count
              from entidades_paginadas ep
              cross join dias
              left join fatos_diarios_corretor fd
                on fd.data = dias.data
               and fd.corretor_identity_key = ep.corretor_identity_key
              left join fatos_diarios_inativos fdi
                on fdi.data = dias.data
               and ep.entidade_key = 'inativos/outros'
             order by {ordenacao}, dias.data
            """,
            *_params_corretor_analytics(intervalo, request),
            search.strip(),
            tamanho,
            offset,
        )

    dias = []
    data_cursor = intervalo.inicio
    while data_cursor <= intervalo.fim:
        dias.append(
            {
                "data": data_cursor.isoformat(),
                "dia": data_cursor.day,
                "mes": data_cursor.month,
                "ano": data_cursor.year,
            }
        )
        data_cursor += timedelta(days=1)

    itens_por_chave: dict[str, dict[str, Any]] = {}
    total = 0
    for linha in linhas:
        item_linha = _linha_para_dict(linha)
        total = int(item_linha.get("total_count") or total or 0)
        chave = str(item_linha.get("entidade_key") or item_linha.get("corretor") or "")
        if not chave:
            continue
        item = itens_por_chave.setdefault(
            chave,
            {
                "key": chave,
                "corretor_identity_key": item_linha.get("corretor_identity_key"),
                "corretor_match": item_linha.get("corretor_match"),
                "corretor": item_linha.get("corretor"),
                "gerente": item_linha.get("gerente"),
                "coordenador": item_linha.get("coordenador"),
                "regiao": item_linha.get("regiao"),
                "equipe": item_linha.get("equipe"),
                "meses_ativos": item_linha.get("meses_ativos"),
                "base_ativa": item_linha.get("base_ativa"),
                "leads": item_linha.get("leads_periodo"),
                "agendamentos": item_linha.get("agendamentos_periodo"),
                "visitas": item_linha.get("visitas_periodo"),
                "propostas": item_linha.get("propostas_periodo"),
                "vendas": item_linha.get("vendas_periodo"),
                "repasses": item_linha.get("repasses_periodo"),
                "indicadores": {
                    indicador["key"]: {
                        "key": indicador["key"],
                        "label": indicador["label"],
                        "valores": {},
                        "total": 0,
                    }
                    for indicador in CORRETORES_DIARIO_INDICADORES
                },
            },
        )
        data_chave = str(item_linha.get("data"))
        metricas = _metricas_diarias_corretor(item_linha)
        for indicador in CORRETORES_DIARIO_INDICADORES:
            indicador_item = item["indicadores"][indicador["key"]]
            valor = metricas[indicador["key"]]
            indicador_item["valores"][data_chave] = valor
            indicador_item["total"] += valor

    items = []
    for item in itens_por_chave.values():
        item["indicadores"] = [item["indicadores"][indicador["key"]] for indicador in CORRETORES_DIARIO_INDICADORES]
        items.append(item)

    return {
        "items": items,
        "dias": dias,
        "indicadores": CORRETORES_DIARIO_INDICADORES,
        "pagination": {
            "page": pagina,
            "pageSize": tamanho,
            "total": total,
            "pages": (total + tamanho - 1) // tamanho if tamanho else 0,
        },
        "meta": {
            "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
            "layout": "matrix",
        },
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/corretores/detalhes")
async def corretores_detalhes_dashboard(
    request: Request,
    corretor: str = Query("", max_length=180),
    corretorIdentity: str = Query("", max_length=240),
    corretorIdentities: str = Query("", max_length=12000),
    corretorMatches: str = Query("", max_length=12000),
    regiaoDetalhe: str = Query("", max_length=180),
    indicador: str = Query("leads", max_length=80),
    aba: str = Query("", max_length=40),
    data: str | None = Query(None, max_length=10),
    expectedTotal: float | None = Query(None),
    limit: int = Query(80, ge=1, le=300),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    corretor = str(corretor or "").strip()
    corretor_identity = str(corretorIdentity or "").strip()
    corretor_identities = [
        valor.strip()
        for valor in str(corretorIdentities or "").split(",")
        if valor.strip()
    ][:500]
    corretor_matches = [
        valor.strip()
        for valor in str(corretorMatches or "").split(",")
        if valor.strip()
    ][:500]
    regiaoDetalhe = str(regiaoDetalhe or "").strip()
    if not corretor_identity and not corretor and not regiaoDetalhe:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe corretor, corretorIdentity ou regiaoDetalhe para detalhamento.")
    intervalo = _intervalo_datas(request)
    data_filtro = _parse_data(data) if data else None
    indicador_config = CORRETORES_DETALHE_INDICADORES.get(str(indicador or "").strip())
    if not indicador_config:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Indicador invalido para detalhamento.")
    coluna_data_evento = indicador_config["date"]
    condicao_indicador = indicador_config["condition"]
    chave_detalhe = indicador_config.get("key") or "coalesce(fato_jornada_comercial_key, journey_key, journey_id)"
    aba = str(aba or "").strip() or "corretores"
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        FILTROS_BASE,
        23,
        ignorar={"corretor", "corretorOperacao", "corretorAtivo"},
    )
    parametros_analytics = _params_corretor_analytics(intervalo, request)
    parametros_hierarquia = parametros_analytics[2:7]
    parametros_foguetes = parametros_analytics[7:]
    pool = _obter_pool(request)
    funcionario_identity_sql = _sql_corretor_identity_funcionario("f")
    funcionario_match_sql = _sql_corretor_nome_match("f.nome")
    funcionario_email_sql = _sql_corretor_email_norm("f.email")
    base_identity_sql = """
    coalesce(
        'email:' || nullif(lower(trim(dim_corretor.email_norm::text)), ''),
        'id:' || nullif(coalesce(base_raw.idcorretor_canonico, base_raw.idcorretor_atual)::text, ''),
        'nome:' || regexp_replace(
            regexp_replace(
                lower(trim(coalesce(nullif(base_raw.corretor_nome_canonico, ''), nullif(base_raw.corretor_nome, ''), 'Sem corretor'))),
                '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$',
                '',
                'i'
            ),
            '\\s+',
            ' ',
            'g'
        )
    )
    """
    indicador_chave = str(indicador or "").strip()
    escopo_detalhe = "foguetes" if aba == "foguetes" else "corretores"
    ctes_qualificacao_foguetes = f"""
                meses_detalhe as (
                    select generate_series(
                        date_trunc('month', $1::date)::date,
                        date_trunc('month', $2::date)::date,
                        interval '1 month'
                    )::date as mes_referencia
                ),
                hierarquia_manual_detalhe as (
                    select
                        m.mes_referencia,
                        'nome:' || {_sql_corretor_nome_match("h.corretor")} as corretor_identity_key,
                        {_sql_corretor_nome_match("h.corretor")} as corretor_match,
                        coalesce(nullif(trim(h.equipe), ''), 'Sem equipe') as equipe,
                        coalesce(nullif(trim(h.gerente), ''), 'Sem gerente') as gerente,
                        coalesce(nullif(trim(h.coordenador), ''), 'Sem coordenador') as coordenador,
                        coalesce(nullif(trim(h.regiao), ''), 'Sem regiao') as regiao
                    from meses_detalhe m
                    join {ESQUEMA_COMERCIAL}.dashboard_gc_produtividade_historico_corretor_equipe h
                      on h.mes_referencia = m.mes_referencia
                     and h.ativo_no_mes is true
                    where trim(coalesce(h.corretor, '')) <> ''
                ),
                meses_com_hierarquia_manual_detalhe as (
                    select distinct mes_referencia
                    from hierarquia_manual_detalhe
                ),
                hierarquia_funcionario_detalhe as (
                    select
                        m.mes_referencia,
                        {_sql_corretor_identity_funcionario("f")} as corretor_identity_key,
                        {_sql_corretor_nome_match("f.nome")} as corretor_match,
                        coalesce(nullif(trim(f.imobiliaria), ''), 'Sem equipe') as equipe,
                        coalesce(nullif(trim(f.gestor), ''), 'Sem gerente') as gerente,
                        coalesce(nullif(trim(f.coordenador), ''), nullif(trim(f.gerente), ''), 'Sem coordenador') as coordenador,
                        coalesce(nullif(trim(f.regiao), ''), nullif(trim(f.regional), ''), 'Sem regiao') as regiao
                    from meses_detalhe m
                    join {ESQUEMA_BANCO}.funcionario_acesso f
                      on upper(trim(coalesce(f.tipo_funcionario, ''))) in ('CORRETOR', 'SDR')
                     and coalesce(f.ativo_negocio, true) is true
                     and (coalesce(f.ativo, false) is true or coalesce(f.ativo_login, false) is true)
                     and (f.data_inicio_vigencia is null or f.data_inicio_vigencia < (m.mes_referencia + interval '1 month')::date)
                     and (f.data_fim_vigencia is null or f.data_fim_vigencia >= m.mes_referencia)
                    where trim(coalesce(f.nome, '')) <> ''
                      and not exists (
                        select 1
                        from meses_com_hierarquia_manual_detalhe mm
                        where mm.mes_referencia = m.mes_referencia
                      )
                ),
                corretores_periodo_detalhe as (
                    select distinct corretor_identity_key, corretor_match
                    from (
                        select * from hierarquia_manual_detalhe
                        union all
                        select * from hierarquia_funcionario_detalhe
                    ) ha
                    where (
                        cardinality($16::text[]) = 0
                        or ha.corretor_match in (
                            select {_sql_corretor_nome_match("valor")}
                              from unnest($16::text[]) as filtro(valor)
                        )
                    )
                      and (cardinality($17::text[]) = 0 or ha.equipe = any($17::text[]))
                      and (cardinality($18::text[]) = 0 or ha.gerente = any($18::text[]))
                      and (cardinality($19::text[]) = 0 or ha.coordenador = any($19::text[]))
                      and (cardinality($20::text[]) = 0 or ha.regiao = any($20::text[]))
                ),
                fato_identity_bridge as (
                    select distinct on (corretor_match)
                        coalesce(
                            'email:' || nullif(lower(trim(dc.email_norm::text)), ''),
                            'id:' || nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual)::text, ''),
                            'nome:' || {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome)")}
                        ) as corretor_identity_key,
                        {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome)")} as corretor_match
                    from {ESQUEMA_COMERCIAL}.comercial_base b
                    left join dim_corretor dc
                      on dc.idcorretor_text = nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual)::text, '')
                    where trim(coalesce(b.corretor_nome_canonico, b.corretor_nome, '')) <> ''
                    order by
                        corretor_match,
                        case when dc.email_norm is not null then 1 else 2 end,
                        case when coalesce(b.idcorretor_canonico, b.idcorretor_atual) is not null then 1 else 2 end
                ),
                foguetes_qualificados as (
                    select
                        coalesce(
                            funcionario_qualificado.corretor_identity_key,
                            fib.corretor_identity_key,
                            'nome:' || {_sql_corretor_nome_match("k.corretor")}
                        ) as corretor_identity_key
                    from {ESQUEMA_COMERCIAL}.comercial_kpi_daily k
                    left join fato_identity_bridge fib
                      on fib.corretor_match = {_sql_corretor_nome_match("k.corretor")}
                    left join lateral (
                        select *
                        from funcionarios funcionario_candidato
                        where funcionario_candidato.corretor_identity_key = coalesce(fib.corretor_identity_key, 'nome:' || {_sql_corretor_nome_match("k.corretor")})
                           or funcionario_candidato.corretor_match = {_sql_corretor_nome_match("k.corretor")}
                        order by
                            case
                                when funcionario_candidato.corretor_identity_key = coalesce(fib.corretor_identity_key, 'nome:' || {_sql_corretor_nome_match("k.corretor")}) then 1
                                else 2
                            end,
                            coalesce(funcionario_candidato.funcionario_ativo, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_negocio, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_login, false) desc,
                            funcionario_candidato.funcionario_data_fim_vigencia desc nulls first,
                            funcionario_candidato.funcionario_data_inicio_vigencia desc nulls last
                        limit 1
                    ) funcionario_qualificado on true
                    where k.data >= date_trunc('month', $2::date)::date - interval '1 month'
                      and k.data < date_trunc('month', $2::date)::date
                      and (cardinality($9::text[]) = 0 or coalesce(nullif(trim(k.cidade), ''), 'Sem regiao') = any($9::text[]))
                      and (cardinality($10::text[]) = 0 or coalesce(nullif(trim(k.empreendimento_reduzido), ''), 'Sem regiao') = any($10::text[]))
                      and (cardinality($11::text[]) = 0 or coalesce(nullif(trim(k.imobiliaria), ''), 'Sem equipe') = any($11::text[]))
                      and (
                        cardinality($12::text[]) = 0
                        or {_sql_corretor_nome_match("k.corretor")} in (
                            select {_sql_corretor_nome_match("valor")}
                              from unnest($12::text[]) as filtro(valor)
                        )
                      )
                      and (cardinality($13::text[]) = 0 or coalesce(nullif(trim(k.sdr), ''), 'Sem SDR') = any($13::text[]))
                      and (cardinality($14::text[]) = 0 or coalesce(nullif(trim(k.origem), ''), 'Sem origem') = any($14::text[]))
                      and (cardinality($15::text[]) = 0 or coalesce(nullif(trim(k.empreendimento), ''), 'Sem empreendimento') = any($15::text[]))
                    group by 1
                    having sum(coalesce(k.repasses, 0)) >= 2
                ),
    """

    if indicador_chave == "agendamentos":
        async with pool.acquire() as conexao:
            linhas = await conexao.fetch(
                f"""
                with dim_corretor as (
                    select distinct on (idcorretor_text)
                        idcorretor_text,
                        email_norm,
                        corretor_match,
                        corretor_nome
                    from (
                        select
                            nullif(trim(idcorretor::text), '') as idcorretor_text,
                            {_sql_corretor_email_norm("email")} as email_norm,
                            {_sql_corretor_nome_match("nome_corretor")} as corretor_match,
                            coalesce(nullif(trim(nome_corretor), ''), nullif(trim(apelido), ''), nullif(trim(idcorretor::text), ''), 'Sem corretor') as corretor_nome
                        from {ESQUEMA_COMERCIAL}.dim_corretor
                        where nullif(trim(idcorretor::text), '') is not null
                    ) dc_base
                    order by idcorretor_text, case when email_norm is not null then 1 else 2 end, corretor_nome
                ),
                funcionarios as (
                    select
                        {funcionario_identity_sql} as corretor_identity_key,
                        {funcionario_match_sql} as corretor_match,
                        {funcionario_email_sql} as email_norm,
                        f.identificador_funcionario::text as funcionario_identificador,
                        f.identificador_usuario::text as funcionario_usuario_id,
                        f.identificador_equipe_vigencia::text as funcionario_equipe_vigencia_id,
                        f.nome as funcionario_nome,
                        f.email::text as funcionario_email,
                        f.documento as funcionario_documento,
                        f.tipo_funcionario as funcionario_tipo,
                        f.tipo_vinculo as funcionario_tipo_vinculo,
                        f.cargo as funcionario_cargo,
                        f.matricula as funcionario_matricula,
                        f.cnpj as funcionario_cnpj,
                        f.nome_empresa as funcionario_nome_empresa,
                        f.imobiliaria as funcionario_imobiliaria,
                        f.regiao as funcionario_regiao,
                        f.regional as funcionario_regional,
                        f.gestor as funcionario_gestor,
                        f.gestor_email::text as funcionario_gestor_email,
                        f.coordenador as funcionario_coordenador,
                        f.coordenador_email::text as funcionario_coordenador_email,
                        f.gerente as funcionario_gerente,
                        f.gerente_email::text as funcionario_gerente_email,
                        f.ativo as funcionario_ativo,
                        f.ativo_negocio as funcionario_ativo_negocio,
                        f.ativo_login as funcionario_ativo_login,
                        f.data_inicio_vigencia as funcionario_data_inicio_vigencia,
                        f.data_fim_vigencia as funcionario_data_fim_vigencia,
                        f.data_admissao as funcionario_data_admissao,
                        f.data_cadastro_usuario as funcionario_data_cadastro_usuario,
                        f.referencia_origem as funcionario_referencia_origem,
                        f.origem_planilha as funcionario_origem_planilha,
                        f.status_validacao as funcionario_status_validacao
                    from {ESQUEMA_BANCO}.funcionario_acesso f
                    where upper(trim(coalesce(f.tipo_funcionario, ''))) = 'CORRETOR'
                      and trim(coalesce(f.nome, '')) <> ''
                    order by
                        corretor_match,
                        coalesce(f.ativo, false) desc,
                        coalesce(f.ativo_negocio, false) desc,
                        coalesce(f.ativo_login, false) desc,
                        f.data_fim_vigencia desc nulls first,
                        f.data_inicio_vigencia desc nulls last,
                        f.data_hora_atualizado_em desc nulls last
                ),
                {ctes_qualificacao_foguetes}
                lead_agendamentos as (
                    select
                        coalesce(b.fato_jornada_comercial_key, 'lead-agendamento:' || lh.historico_status_key) as fato_jornada_comercial_key,
                        coalesce(b.journey_id, lh.journey_id) as journey_id,
                        b.journey_key,
                        coalesce(b.journey_anchor_type, lh.journey_anchor_type) as journey_anchor_type,
                        lh.idlead,
                        b.idprecadastro,
                        b.idreserva,
                        b.idrepasse,
                        coalesce(lh.idcorretor_atual, b.idcorretor_canonico, b.idcorretor_atual) as idcorretor_atual,
                        coalesce(lh.idgestor, b.idgestor) as idgestor,
                        coalesce(lh.idimobiliaria, b.idimobiliaria) as idimobiliaria,
                        coalesce(lh.idempreendimento, b.idempreendimento) as idempreendimento,
                        coalesce(lh.idunidade, b.idunidade) as idunidade,
                        coalesce(lh.idcorretor_atual, b.idcorretor_canonico, b.idcorretor_atual) as idcorretor_canonico,
                        b.idgestor_canonico,
                        b.idimobiliaria_canonico,
                        b.idempreendimento_canonico,
                        b.idunidade_canonico,
                        b.idcliente_canonico,
                        b.idcontrato_canonico,
                        coalesce(lh.situacao_para, b.lead_situacao_nome) as lead_situacao_nome,
                        b.precadastro_situacao_nome,
                        b.reserva_situacao_nome,
                        b.repasse_situacao_nome,
                        coalesce(lh.situacao_para, b.situacao_nome_canonica) as situacao_nome_canonica,
                        b.idsituacao_canonica,
                        b.idsituacao_anterior_canonica,
                        b.dt_ultima_conversao_lead,
                        b.dt_visita_realizada,
                        b.dt_resposta_analise_precadastro,
                        b.dt_cadastro_reserva,
                        b.dt_cancelamento_reserva,
                        b.dt_contrato_contabilizado,
                        b.data_venda,
                        b.dt_venda_finalizada,
                        b.dt_assinatura_contrato,
                        lh.dt_referencia as detalhe_proposta_data,
                        lh.agendamento_status_grupo as detalhe_proposta_status_atual,
                        lh.situacao_para as detalhe_proposta_situacao,
                        coalesce(dc.corretor_nome, b.corretor_nome_canonico, b.corretor_nome, 'Corretor ' || lh.idcorretor_atual::text) as corretor_nome_canonico,
                        coalesce(dc.corretor_nome, b.corretor_nome) as corretor_nome,
                        b.gestor_nome,
                        b.imobiliaria_nome,
                        b.imobiliaria_nome_dim,
                        b.imobiliaria_nome_canonica,
                        b.lead_cidade,
                        b.lead_estado,
                        b.lead_regiao,
                        b.lead_origem_nome,
                        b.sdr_nome,
                        b.empreendimento_nome,
                        b.regiao_empreendimento,
                        b.nome_empreendimento_reduzido,
                        b.unidade_nome,
                        lh.historico_status_key as detalhe_chave,
                        lh.dt_referencia as data_evento,
                        coalesce(
                            'email:' || nullif(lower(trim(dc.email_norm::text)), ''),
                            'id:' || nullif(lh.idcorretor_atual::text, ''),
                            'nome:' || coalesce(dc.corretor_match, {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, dc.corretor_nome)")})
                        ) as corretor_identity_key,
                        coalesce(dc.corretor_match, {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, 'Sem corretor')")}) as corretor_match_kpi,
                        coalesce(dc.corretor_match, {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, dc.corretor_nome)")}) as corretor_match,
                        dc.email_norm as corretor_dim_email_norm,
                        dc.corretor_nome as corretor_dim_nome,
                        lh.situacao_de as agendamento_situacao_de,
                        lh.situacao_para as agendamento_situacao_para,
                        lh.agendamento_status_grupo
                    from {ESQUEMA_COMERCIAL}.comercial_leads_historico lh
                    left join lateral (
                        select *
                        from {ESQUEMA_COMERCIAL}.comercial_base b
                        where (lh.journey_id is not null and b.journey_id = lh.journey_id)
                           or (lh.idlead is not null and b.idlead = lh.idlead)
                        order by
                            case when lh.journey_id is not null and b.journey_id = lh.journey_id then 1 else 2 end,
                            b.dt_ultima_conversao_lead desc nulls last,
                            b.fato_jornada_comercial_key
                        limit 1
                    ) b on true
                    left join dim_corretor dc
                      on dc.idcorretor_text = nullif(coalesce(lh.idcorretor_atual, b.idcorretor_canonico, b.idcorretor_atual)::text, '')
                    where lh.dt_referencia >= $1::date
                      and lh.dt_referencia < ($2::date + interval '1 day')
                      and lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
                      and ($4::date is null or lh.dt_referencia = $4::date)
                ),
                filtered as (
                    select distinct on (lead_agendamentos.data_evento, lead_agendamentos.idlead, coalesce(funcionarios.corretor_identity_key, lead_agendamentos.corretor_identity_key))
                        lead_agendamentos.*,
                        funcionarios.funcionario_identificador,
                        funcionarios.funcionario_usuario_id,
                        funcionarios.funcionario_equipe_vigencia_id,
                        funcionarios.funcionario_nome,
                        funcionarios.funcionario_email,
                        funcionarios.funcionario_documento,
                        funcionarios.funcionario_tipo,
                        funcionarios.funcionario_tipo_vinculo,
                        funcionarios.funcionario_cargo,
                        funcionarios.funcionario_matricula,
                        funcionarios.funcionario_cnpj,
                        funcionarios.funcionario_nome_empresa,
                        funcionarios.funcionario_imobiliaria,
                        funcionarios.funcionario_regiao,
                        funcionarios.funcionario_regional,
                        funcionarios.funcionario_gestor,
                        funcionarios.funcionario_gestor_email,
                        funcionarios.funcionario_coordenador,
                        funcionarios.funcionario_coordenador_email,
                        funcionarios.funcionario_gerente,
                        funcionarios.funcionario_gerente_email,
                        funcionarios.funcionario_ativo,
                        funcionarios.funcionario_ativo_negocio,
                        funcionarios.funcionario_ativo_login,
                        funcionarios.funcionario_data_inicio_vigencia,
                        funcionarios.funcionario_data_fim_vigencia,
                        funcionarios.funcionario_data_admissao,
                        funcionarios.funcionario_data_cadastro_usuario,
                        funcionarios.funcionario_referencia_origem,
                        funcionarios.funcionario_origem_planilha,
                        funcionarios.funcionario_status_validacao,
                        funcionarios.corretor_identity_key as funcionario_corretor_identity_key
                    from lead_agendamentos
                    left join lateral (
                        select *
                        from funcionarios funcionario_candidato
                        where funcionario_candidato.email_norm = lead_agendamentos.corretor_dim_email_norm
                           or funcionario_candidato.corretor_identity_key = lead_agendamentos.corretor_identity_key
                           or funcionario_candidato.corretor_match = lead_agendamentos.corretor_match
                        order by
                            case
                                when funcionario_candidato.email_norm = lead_agendamentos.corretor_dim_email_norm then 1
                                when funcionario_candidato.corretor_identity_key = lead_agendamentos.corretor_identity_key then 2
                                else 3
                            end,
                            coalesce(funcionario_candidato.funcionario_ativo, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_negocio, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_login, false) desc,
                            funcionario_candidato.funcionario_data_fim_vigencia desc nulls first,
                            funcionario_candidato.funcionario_data_inicio_vigencia desc nulls last
                        limit 1
                    ) funcionarios on true
                    where (
                        (
                          $8::text <> 'foguetes'
                          or exists (
                            select 1
                            from foguetes_qualificados fq
                            where fq.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, lead_agendamentos.corretor_identity_key)
                          )
                        )
                        and (
                        (
                          (cardinality($21::text[]) > 0 or cardinality($22::text[]) > 0)
                          and (
                            lead_agendamentos.corretor_identity_key = any($21::text[])
                            or funcionarios.corretor_identity_key = any($21::text[])
                            or ('nome:' || lead_agendamentos.corretor_match) = any($21::text[])
                            or lead_agendamentos.corretor_match = any($22::text[])
                            or lead_agendamentos.corretor_match_kpi = any($22::text[])
                            or funcionarios.corretor_match = any($22::text[])
                          )
                        )
                        or (
                        cardinality($21::text[]) = 0
                        and cardinality($22::text[]) = 0
                        and (
                        (
                          $7::text <> ''
                          and $7::text <> 'inativos/outros'
                          and (
                            lead_agendamentos.corretor_identity_key = $7::text
                            or funcionarios.corretor_identity_key = $7::text
                          )
                        )
                        or (
                          $7::text = 'inativos/outros'
                          and not exists (
                            select 1
                            from corretores_periodo_detalhe cpd
                            where cpd.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, lead_agendamentos.corretor_identity_key)
                               or cpd.corretor_match = lead_agendamentos.corretor_match_kpi
                               or cpd.corretor_match = lead_agendamentos.corretor_match
                          )
                        )
                        or (
                          $7::text = ''
                          and $3::text <> ''
                          and lead_agendamentos.corretor_match = regexp_replace(regexp_replace(lower(trim($3::text)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                        )
                        or (
                          $7::text = ''
                          and $3::text = ''
                          and $6::text <> ''
                          and coalesce(
                            nullif(trim(funcionarios.funcionario_regiao), ''),
                            nullif(trim(funcionarios.funcionario_regional), ''),
                            case when funcionarios.corretor_match is null then 'Inativos/Outros' else 'Sem regiao' end
                          ) = $6::text
                        )
                        )
                        )
                    )
                    )
                    {where_filtros}
                    order by lead_agendamentos.data_evento, lead_agendamentos.idlead, coalesce(funcionarios.corretor_identity_key, lead_agendamentos.corretor_identity_key), lead_agendamentos.detalhe_chave
                )
                select
                    filtered.*,
                    count(*) over()::int as total_count
                from filtered
                order by data_evento desc nulls last, idlead desc nulls last
                limit $5
                """,
                intervalo.inicio,
                intervalo.fim,
                corretor,
                data_filtro,
                limit,
                regiaoDetalhe,
                corretor_identity,
                aba,
                *parametros_foguetes,
                *parametros_hierarquia,
                corretor_identities,
                corretor_matches,
                *parametros_filtros,
            )

        itens = [_linha_para_dict(linha) for linha in linhas]
        total = int(itens[0].get("total_count") or 0) if itens else 0
        for item in itens:
            item.pop("total_count", None)
        return {
            "corretorIdentity": corretor_identity or None,
            "corretor": corretor or None,
            "regiao": regiaoDetalhe or None,
            "indicador": indicador_chave,
            "indicadorLabel": indicador_config["label"],
            "aba": aba,
            "data": data_filtro,
            "items": itens,
            "pagination": {"limit": limit, "total": total},
            "meta": {
                "source": "connect_comercial.comercial_leads_historico",
                "startDate": intervalo.inicio,
                "endDate": intervalo.fim,
                "audit": {
                    "expectedFromClick": expectedTotal,
                    "detailTotal": total,
                    "scope": escopo_detalhe,
                    "indicatorCondition": "agendamento_status_grupo in ('AGENDAMENTO','AGENDAMENTO_IA','AGENDADO_IA')",
                    "eventDateColumn": "dt_referencia",
                    "detailKey": "historico_status_key",
                    "detailEntity": indicador_config.get("entity"),
                },
                "notes": [
                    "Agendamentos usam historico de situacao do lead.",
                    "Status aceitos: AGENDAMENTO, AGENDAMENTO_IA e AGENDADO_IA.",
                ],
            },
        }

    if indicador_chave in {"propostas", "propostas_aprovadas", "propostas_condicionadas", "propostas_reprovadas"}:
        status_por_indicador = {
            "propostas": ("APROVADA", "CONDICIONADA", "REPROVADA"),
            "propostas_aprovadas": ("APROVADA",),
            "propostas_condicionadas": ("CONDICIONADA",),
            "propostas_reprovadas": ("REPROVADA",),
        }[indicador_chave]
        status_sql = ", ".join("'" + status_valor + "'" for status_valor in status_por_indicador)

        async with pool.acquire() as conexao:
            linhas = await conexao.fetch(
                f"""
                with dim_corretor as (
                    select distinct on (idcorretor_text)
                        idcorretor_text,
                        email_norm,
                        corretor_nome
                    from (
                        select
                            nullif(trim(idcorretor::text), '') as idcorretor_text,
                            {_sql_corretor_email_norm("email")} as email_norm,
                            coalesce(nullif(trim(nome_corretor), ''), nullif(trim(apelido), ''), nullif(trim(idcorretor::text), ''), 'Sem corretor') as corretor_nome
                        from {ESQUEMA_COMERCIAL}.dim_corretor
                        where nullif(trim(idcorretor::text), '') is not null
                    ) dc_base
                    order by idcorretor_text, case when email_norm is not null then 1 else 2 end, corretor_nome
                ),
                funcionarios as (
                    select
                        {funcionario_identity_sql} as corretor_identity_key,
                        {funcionario_match_sql} as corretor_match,
                        {funcionario_email_sql} as email_norm,
                        f.identificador_funcionario::text as funcionario_identificador,
                        f.identificador_usuario::text as funcionario_usuario_id,
                        f.identificador_equipe_vigencia::text as funcionario_equipe_vigencia_id,
                        f.nome as funcionario_nome,
                        f.email::text as funcionario_email,
                        f.documento as funcionario_documento,
                        f.tipo_funcionario as funcionario_tipo,
                        f.tipo_vinculo as funcionario_tipo_vinculo,
                        f.cargo as funcionario_cargo,
                        f.matricula as funcionario_matricula,
                        f.cnpj as funcionario_cnpj,
                        f.nome_empresa as funcionario_nome_empresa,
                        f.imobiliaria as funcionario_imobiliaria,
                        f.regiao as funcionario_regiao,
                        f.regional as funcionario_regional,
                        f.gestor as funcionario_gestor,
                        f.gestor_email::text as funcionario_gestor_email,
                        f.coordenador as funcionario_coordenador,
                        f.coordenador_email::text as funcionario_coordenador_email,
                        f.gerente as funcionario_gerente,
                        f.gerente_email::text as funcionario_gerente_email,
                        f.ativo as funcionario_ativo,
                        f.ativo_negocio as funcionario_ativo_negocio,
                        f.ativo_login as funcionario_ativo_login,
                        f.data_inicio_vigencia as funcionario_data_inicio_vigencia,
                        f.data_fim_vigencia as funcionario_data_fim_vigencia,
                        f.data_admissao as funcionario_data_admissao,
                        f.data_cadastro_usuario as funcionario_data_cadastro_usuario,
                        f.referencia_origem as funcionario_referencia_origem,
                        f.origem_planilha as funcionario_origem_planilha,
                        f.status_validacao as funcionario_status_validacao
                    from {ESQUEMA_BANCO}.funcionario_acesso f
                    where upper(trim(coalesce(f.tipo_funcionario, ''))) = 'CORRETOR'
                      and trim(coalesce(f.nome, '')) <> ''
                ),
                {ctes_qualificacao_foguetes}
                propostas as (
                    select
                        coalesce(b.fato_jornada_comercial_key, 'proposta:' || pc.idprecadastro::text) as fato_jornada_comercial_key,
                        coalesce(b.journey_id, pc.journey_id) as journey_id,
                        b.journey_key,
                        b.journey_anchor_type,
                        b.idlead,
                        pc.idprecadastro,
                        b.idreserva,
                        b.idrepasse,
                        coalesce(b.idcorretor_canonico, b.idcorretor_atual, pc.idcorretor_atual) as idcorretor_atual,
                        b.idgestor,
                        b.idimobiliaria,
                        b.idempreendimento,
                        b.idunidade,
                        coalesce(b.idcorretor_canonico, b.idcorretor_atual, pc.idcorretor_atual) as idcorretor_canonico,
                        b.idgestor_canonico,
                        b.idimobiliaria_canonico,
                        b.idempreendimento_canonico,
                        b.idunidade_canonico,
                        b.idcliente_canonico,
                        b.idcontrato_canonico,
                        b.lead_situacao_nome,
                        b.precadastro_situacao_nome,
                        b.reserva_situacao_nome,
                        b.repasse_situacao_nome,
                        b.situacao_nome_canonica,
                        b.idsituacao_canonica,
                        b.idsituacao_anterior_canonica,
                        b.dt_ultima_conversao_lead,
                        b.dt_visita_realizada,
                        b.dt_resposta_analise_precadastro,
                        b.dt_cadastro_reserva,
                        b.dt_cancelamento_reserva,
                        b.dt_contrato_contabilizado,
                        b.data_venda,
                        b.dt_venda_finalizada,
                        b.dt_assinatura_contrato,
                        pc.dt_ultimo_historico_data as detalhe_proposta_data,
                        pc.proposta_status_atual as detalhe_proposta_status_atual,
                        pc.situacao_ultimo_status as detalhe_proposta_situacao,
                        coalesce(b.corretor_nome_canonico, b.corretor_nome, dc.corretor_nome, 'Corretor ' || pc.idcorretor_atual::text) as corretor_nome_canonico,
                        coalesce(b.corretor_nome, dc.corretor_nome) as corretor_nome,
                        b.gestor_nome,
                        b.imobiliaria_nome,
                        b.imobiliaria_nome_dim,
                        b.imobiliaria_nome_canonica,
                        b.lead_cidade,
                        b.lead_estado,
                        b.lead_regiao,
                        b.lead_origem_nome,
                        b.sdr_nome,
                        b.empreendimento_nome,
                        b.regiao_empreendimento,
                        b.nome_empreendimento_reduzido,
                        b.unidade_nome,
                        pc.idprecadastro::text as detalhe_chave,
                        pc.dt_ultimo_historico_data as data_evento,
                        coalesce(
                            'email:' || nullif(lower(trim(dc.email_norm::text)), ''),
                            'id:' || nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual, pc.idcorretor_atual)::text, ''),
                            'nome:' || {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, dc.corretor_nome)")}
                        ) as corretor_identity_key,
                        {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, 'Sem corretor')")} as corretor_match_kpi,
                        {_sql_corretor_nome_match("coalesce(b.corretor_nome_canonico, b.corretor_nome, dc.corretor_nome)")} as corretor_match,
                        dc.email_norm as corretor_dim_email_norm,
                        dc.corretor_nome as corretor_dim_nome
                    from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                    left join lateral (
                        select *
                        from {ESQUEMA_COMERCIAL}.comercial_base b
                        where b.idprecadastro = pc.idprecadastro
                        order by b.data_venda desc nulls last, b.dt_ultima_conversao_lead desc nulls last
                        limit 1
                    ) b on true
                    left join dim_corretor dc
                      on dc.idcorretor_text = nullif(coalesce(b.idcorretor_canonico, b.idcorretor_atual, pc.idcorretor_atual)::text, '')
                    where pc.dt_ultimo_historico_data >= $1::date
                      and pc.dt_ultimo_historico_data < ($2::date + interval '1 day')
                      and pc.proposta_status_atual in ({status_sql})
                      and ($4::date is null or pc.dt_ultimo_historico_data = $4::date)
                ),
                filtered as (
                    select
                        propostas.*,
                        funcionarios.funcionario_identificador,
                        funcionarios.funcionario_usuario_id,
                        funcionarios.funcionario_equipe_vigencia_id,
                        funcionarios.funcionario_nome,
                        funcionarios.funcionario_email,
                        funcionarios.funcionario_documento,
                        funcionarios.funcionario_tipo,
                        funcionarios.funcionario_tipo_vinculo,
                        funcionarios.funcionario_cargo,
                        funcionarios.funcionario_matricula,
                        funcionarios.funcionario_cnpj,
                        funcionarios.funcionario_nome_empresa,
                        funcionarios.funcionario_imobiliaria,
                        funcionarios.funcionario_regiao,
                        funcionarios.funcionario_regional,
                        funcionarios.funcionario_gestor,
                        funcionarios.funcionario_gestor_email,
                        funcionarios.funcionario_coordenador,
                        funcionarios.funcionario_coordenador_email,
                        funcionarios.funcionario_gerente,
                        funcionarios.funcionario_gerente_email,
                        funcionarios.funcionario_ativo,
                        funcionarios.funcionario_ativo_negocio,
                        funcionarios.funcionario_ativo_login,
                        funcionarios.funcionario_data_inicio_vigencia,
                        funcionarios.funcionario_data_fim_vigencia,
                        funcionarios.funcionario_data_admissao,
                        funcionarios.funcionario_data_cadastro_usuario,
                        funcionarios.funcionario_referencia_origem,
                        funcionarios.funcionario_origem_planilha,
                        funcionarios.funcionario_status_validacao,
                        funcionarios.corretor_identity_key as funcionario_corretor_identity_key
                    from propostas
                    left join lateral (
                        select *
                        from funcionarios funcionario_candidato
                        where funcionario_candidato.email_norm = propostas.corretor_dim_email_norm
                           or funcionario_candidato.corretor_identity_key = propostas.corretor_identity_key
                           or funcionario_candidato.corretor_match = propostas.corretor_match
                        order by
                            case
                                when funcionario_candidato.email_norm = propostas.corretor_dim_email_norm then 1
                                when funcionario_candidato.corretor_identity_key = propostas.corretor_identity_key then 2
                                else 3
                            end,
                            coalesce(funcionario_candidato.funcionario_ativo, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_negocio, false) desc,
                            coalesce(funcionario_candidato.funcionario_ativo_login, false) desc,
                            funcionario_candidato.funcionario_data_fim_vigencia desc nulls first,
                            funcionario_candidato.funcionario_data_inicio_vigencia desc nulls last
                        limit 1
                    ) funcionarios on true
                    where (
                        (
                          $8::text <> 'foguetes'
                          or exists (
                            select 1
                            from foguetes_qualificados fq
                            where fq.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, propostas.corretor_identity_key)
                          )
                        )
                        and (
                        (
                          (cardinality($21::text[]) > 0 or cardinality($22::text[]) > 0)
                          and (
                            propostas.corretor_identity_key = any($21::text[])
                            or funcionarios.corretor_identity_key = any($21::text[])
                            or ('nome:' || propostas.corretor_match) = any($21::text[])
                            or propostas.corretor_match = any($22::text[])
                            or propostas.corretor_match_kpi = any($22::text[])
                            or funcionarios.corretor_match = any($22::text[])
                          )
                        )
                        or (
                        cardinality($21::text[]) = 0
                        and cardinality($22::text[]) = 0
                        and (
                        (
                          $7::text <> ''
                          and $7::text <> 'inativos/outros'
                          and (
                            propostas.corretor_identity_key = $7::text
                            or funcionarios.corretor_identity_key = $7::text
                          )
                        )
                        or (
                          $7::text = 'inativos/outros'
                          and not exists (
                            select 1
                            from corretores_periodo_detalhe cpd
                            where cpd.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, propostas.corretor_identity_key)
                               or cpd.corretor_match = propostas.corretor_match_kpi
                               or cpd.corretor_match = propostas.corretor_match
                          )
                        )
                        or (
                          $7::text = ''
                          and $3::text <> ''
                          and propostas.corretor_match = regexp_replace(regexp_replace(lower(trim($3::text)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                        )
                        or (
                          $7::text = ''
                          and $3::text = ''
                          and $6::text <> ''
                          and coalesce(
                            nullif(trim(funcionarios.funcionario_regiao), ''),
                            nullif(trim(funcionarios.funcionario_regional), ''),
                            case when funcionarios.corretor_match is null then 'Inativos/Outros' else 'Sem regiao' end
                          ) = $6::text
                        )
                        )
                        )
                    )
                    )
                    {where_filtros}
                )
                select
                    filtered.*,
                    count(*) over()::int as total_count
                from filtered
                order by data_evento desc nulls last, idprecadastro desc nulls last
                limit $5
                """,
                intervalo.inicio,
                intervalo.fim,
                corretor,
                data_filtro,
                limit,
                regiaoDetalhe,
                corretor_identity,
                aba,
                *parametros_foguetes,
                *parametros_hierarquia,
                corretor_identities,
                corretor_matches,
                *parametros_filtros,
            )

        itens = [_linha_para_dict(linha) for linha in linhas]
        total = int(itens[0].get("total_count") or 0) if itens else 0
        for item in itens:
            item.pop("total_count", None)
        return {
            "corretorIdentity": corretor_identity or None,
            "corretor": corretor or None,
            "regiao": regiaoDetalhe or None,
            "indicador": indicador_chave,
            "indicadorLabel": indicador_config["label"],
            "aba": aba,
            "data": data_filtro,
            "items": itens,
            "pagination": {"limit": limit, "total": total},
            "meta": {
                "source": "connect_comercial.comercial_propostas_consolidada",
                "startDate": intervalo.inicio,
                "endDate": intervalo.fim,
                "audit": {
                    "expectedFromClick": expectedTotal,
                    "detailTotal": total,
                    "scope": escopo_detalhe,
                    "indicatorCondition": condicao_indicador,
                    "eventDateColumn": "dt_ultimo_historico_data",
                    "detailKey": "idprecadastro",
                    "detailEntity": indicador_config.get("entity"),
                },
                "notes": [
                    "Detalhamento de propostas usa a consolidada oficial para fechar com o KPI.",
                    "comercial_base e dim_corretor enriquecem os campos quando houver vinculo.",
                ],
            },
        }

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            f"""
            with dim_corretor as (
                select distinct on (idcorretor_text)
                    idcorretor_text,
                    email_norm,
                    corretor_match,
                    corretor_nome
                from (
                    select
                        nullif(trim(idcorretor::text), '') as idcorretor_text,
                        {_sql_corretor_email_norm("email")} as email_norm,
                        {_sql_corretor_nome_match("nome_corretor")} as corretor_match,
                        coalesce(nullif(trim(nome_corretor), ''), nullif(trim(apelido), ''), nullif(trim(idcorretor::text), ''), 'Sem corretor') as corretor_nome
                    from {ESQUEMA_COMERCIAL}.dim_corretor
                    where nullif(trim(idcorretor::text), '') is not null
                ) dc_base
                order by
                    idcorretor_text,
                    case when email_norm is not null then 1 else 2 end,
                    corretor_nome
            ),
            funcionarios as (
                select
                    {funcionario_identity_sql} as corretor_identity_key,
                    {funcionario_match_sql} as corretor_match,
                    {funcionario_email_sql} as email_norm,
                    f.identificador_funcionario::text as funcionario_identificador,
                    f.identificador_usuario::text as funcionario_usuario_id,
                    f.identificador_equipe_vigencia::text as funcionario_equipe_vigencia_id,
                    f.nome as funcionario_nome,
                    f.email::text as funcionario_email,
                    f.documento as funcionario_documento,
                    f.tipo_funcionario as funcionario_tipo,
                    f.tipo_vinculo as funcionario_tipo_vinculo,
                    f.cargo as funcionario_cargo,
                    f.matricula as funcionario_matricula,
                    f.cnpj as funcionario_cnpj,
                    f.nome_empresa as funcionario_nome_empresa,
                    f.imobiliaria as funcionario_imobiliaria,
                    f.regiao as funcionario_regiao,
                    f.regional as funcionario_regional,
                    f.gestor as funcionario_gestor,
                    f.gestor_email::text as funcionario_gestor_email,
                    f.coordenador as funcionario_coordenador,
                    f.coordenador_email::text as funcionario_coordenador_email,
                    f.gerente as funcionario_gerente,
                    f.gerente_email::text as funcionario_gerente_email,
                    f.ativo as funcionario_ativo,
                    f.ativo_negocio as funcionario_ativo_negocio,
                    f.ativo_login as funcionario_ativo_login,
                    f.data_inicio_vigencia as funcionario_data_inicio_vigencia,
                    f.data_fim_vigencia as funcionario_data_fim_vigencia,
                    f.data_admissao as funcionario_data_admissao,
                    f.data_cadastro_usuario as funcionario_data_cadastro_usuario,
                    f.referencia_origem as funcionario_referencia_origem,
                    f.origem_planilha as funcionario_origem_planilha,
                    f.status_validacao as funcionario_status_validacao
                from {ESQUEMA_BANCO}.funcionario_acesso f
                where upper(trim(coalesce(f.tipo_funcionario, ''))) = 'CORRETOR'
                  and trim(coalesce(f.nome, '')) <> ''
                order by
                    corretor_match,
                    coalesce(f.ativo, false) desc,
                    coalesce(f.ativo_negocio, false) desc,
                    coalesce(f.ativo_login, false) desc,
                    f.data_fim_vigencia desc nulls first,
                    f.data_inicio_vigencia desc nulls last,
                    f.data_hora_atualizado_em desc nulls last
            ),
            {ctes_qualificacao_foguetes}
            base_raw as (
                select
                    fato_jornada_comercial_key,
                    journey_id,
                    journey_key,
                    journey_anchor_type,
                    idlead,
                    idprecadastro,
                    idreserva,
                    idrepasse,
                    idcorretor_atual,
                    idgestor,
                    idimobiliaria,
                    idempreendimento,
                    idunidade,
                    idempreendimento_canonico,
                    fonte_idempreendimento_canonico,
                    idunidade_canonico,
                    fonte_idunidade_canonico,
                    idcliente_canonico,
                    fonte_idcliente_canonico,
                    idcontrato_canonico,
                    fonte_idcontrato_canonico,
                    idcorretor_canonico,
                    fonte_idcorretor_canonico,
                    idgestor_canonico,
                    fonte_idgestor_canonico,
                    idimobiliaria_canonico,
                    fonte_idimobiliaria_canonico,
                    lead_situacao_nome,
                    precadastro_situacao_nome,
                    reserva_situacao_nome,
                    repasse_situacao_nome,
                    dim_lead_situacao_nome,
                    idsituacao_canonica,
                    fonte_idsituacao_canonica,
                    idsituacao_anterior_canonica,
                    fonte_idsituacao_anterior_canonica,
                    situacao_nome_canonica,
                    etapa_base_canonica,
                    dt_ultima_conversao_lead,
                    dt_visita_realizada,
                    dt_resposta_analise_precadastro,
                    dt_cadastro_reserva,
                    dt_cancelamento_reserva,
                    dt_contrato_contabilizado,
                    data_venda,
                    dt_venda_finalizada,
                    dt_assinatura_contrato,
                    sla_finalizacao_dias,
                    sla_repasse_dias,
                    fl_tem_resposta_analise_precadastro,
                    fl_cancelada,
                    fl_venda_finalizada,
                    fl_repasse_assinado,
                    corretor_nome,
                    corretor_nome_canonico,
                    gestor_nome,
                    imobiliaria_nome,
                    imobiliaria_nome_dim,
                    imobiliaria_nome_canonica,
                    lead_cidade,
                    lead_estado,
                    lead_regiao,
                    lead_origem_nome,
                    sdr_nome,
                    empreendimento_nome,
                    regiao_empreendimento,
                    unidade_nome,
                    bloco,
                    etapa,
                    fonte_cliente_nome,
                    cliente_documento,
                    cliente_email,
                    fonte_lead_cidade,
                    fonte_lead_estado,
                    dim_lead_cliente_nome,
                    dim_lead_cliente_email,
                    dim_lead_cliente_documento,
                    dim_lead_cidade,
                    dim_lead_estado,
                    dim_lead_regiao,
                    empreendimento_nome_lead,
                    empreendimento_nome_precadastro,
                    empreendimento_nome_reserva,
                    empreendimento_nome_repasse,
                    regiao_empreendimento_lead,
                    regiao_empreendimento_precadastro,
                    regiao_empreendimento_reserva,
                    regiao_empreendimento_repasse,
                    nome_empreendimento_reduzido,
                    dim_lead_origem_nome,
                    dim_lead_sdr_nome,
                    dim_lead_dt_lead,
                    dim_lead_dt_visita,
                    regiao_visita,
                    momento_agendamento,
                    fl_restricao_lead,
                    dt_consulta_cpf,
                    dt_cadastro_canonico,
                    dt_cadastro_canonico_data,
                    dt_referencia_reserva,
                    dt_referencia_reserva_data,
                    dt_referencia_repasse,
                    dt_referencia_repasse_data,
                    reserva_campos_adicionais_data_qr,
                    reserva_campos_adicionais_reserva_repasse_no_mes,
                    reserva_campos_adicionais_reserva_kit_cef,
                    reserva_campos_adicionais_reserva_kit_agehab,
                    reserva_campos_adicionais_reserva_kit_registro_entregue,
                    reserva_campos_adicionais_reserva_kit_agehab_ok,
                    reserva_campos_adicionais_reserva_data_kit_agehab,
                    reserva_campos_adicionais_reserva_obs_cef,
                    reserva_campos_adicionais_reserva_obs_agehab,
                    reserva_campos_adicionais_reserva_obs_finalizacao,
                    repasse_campos_adicionais_repasse_data_envio_cehop,
                    repasse_campos_adicionais_repasse_data_conformidade_cehop,
                    repasse_campos_adicionais_repasse_data_da_inconformidade_cehop,
                    repasse_campos_adicionais_repasse_data_do_reenvio_cehop,
                    repasse_campos_adicionais_repasse_probabilidade_de_assinatura,
                    repasse_campos_adicionais_repasse_kit_agehab_ok,
                    repasse_campos_adicionais_repasse_obs_sinal,
                    repasse_campos_adicionais_repasse_obs_prefeitura,
                    repasse_campos_adicionais_repasse_obs_cartorio,
                    repasse_campos_adicionais_repasse_obs_garantia,
                    (
                        select pc.dt_ultimo_historico_data
                        from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                        where pc.idprecadastro = b.idprecadastro
                          and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
                        order by pc.dt_ultimo_historico_data desc nulls last
                        limit 1
                    ) as detalhe_proposta_data,
                    (
                        select pc.proposta_status_atual
                        from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                        where pc.idprecadastro = b.idprecadastro
                          and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
                        order by pc.dt_ultimo_historico_data desc nulls last
                        limit 1
                    ) as detalhe_proposta_status_atual,
                    (
                        select pc.situacao_ultimo_status
                        from {ESQUEMA_COMERCIAL}.comercial_propostas_consolidada pc
                        where pc.idprecadastro = b.idprecadastro
                          and pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA')
                        order by pc.dt_ultimo_historico_data desc nulls last
                        limit 1
                    ) as detalhe_proposta_situacao,
                    (
                        select cd.referencia_data
                        from {ESQUEMA_COMERCIAL}.comercial_distratos cd
                        where (cd.idreserva is not null and cd.idreserva = b.idreserva)
                           or (cd.idrepasse is not null and cd.idrepasse = b.idrepasse)
                           or (cd.idprecadastro is not null and cd.idprecadastro = b.idprecadastro)
                           or (cd.idlead is not null and cd.idlead = b.idlead)
                        order by cd.referencia_data desc nulls last
                        limit 1
                    ) as detalhe_distrato_data,
                    (
                        select cd.situacao_para
                        from {ESQUEMA_COMERCIAL}.comercial_distratos cd
                        where (cd.idreserva is not null and cd.idreserva = b.idreserva)
                           or (cd.idrepasse is not null and cd.idrepasse = b.idrepasse)
                           or (cd.idprecadastro is not null and cd.idprecadastro = b.idprecadastro)
                           or (cd.idlead is not null and cd.idlead = b.idlead)
                        order by cd.referencia_data desc nulls last
                        limit 1
                    ) as detalhe_distrato_situacao,
                    {chave_detalhe} as detalhe_chave,
                    {coluna_data_evento} as data_evento,
                    coalesce(
                        dt_ultima_conversao_lead,
                        dt_visita_realizada,
                        dt_resposta_analise_precadastro,
                        dt_cadastro_reserva,
                        dt_contrato_contabilizado,
                        data_venda,
                        dt_venda_finalizada,
                        dt_assinatura_contrato,
                        dt_cancelamento_reserva
                    ) as data_referencia,
                    regexp_replace(
                        regexp_replace(
                            lower(trim(coalesce(nullif(corretor_nome_canonico, ''), nullif(corretor_nome, ''), 'Sem corretor'))),
                            '\\s*-\\s*(clt|pj)$',
                            '',
                            'i'
                        ),
                        '\\s+',
                        ' ',
                        'g'
                    ) as corretor_match
                from {ESQUEMA_COMERCIAL}.comercial_base b
            ),
            base as (
                select
                    base_raw.*,
                    dim_corretor.email_norm as corretor_dim_email_norm,
                    dim_corretor.corretor_nome as corretor_dim_nome,
                    {base_identity_sql} as corretor_identity_key
                from base_raw
                left join dim_corretor
                  on dim_corretor.idcorretor_text = nullif(coalesce(base_raw.idcorretor_canonico, base_raw.idcorretor_atual)::text, '')
            ),
            filtered as (
                select
                    base.*,
                    funcionarios.funcionario_identificador,
                    funcionarios.funcionario_usuario_id,
                    funcionarios.funcionario_equipe_vigencia_id,
                    funcionarios.funcionario_nome,
                    funcionarios.funcionario_email,
                    funcionarios.funcionario_documento,
                    funcionarios.funcionario_tipo,
                    funcionarios.funcionario_tipo_vinculo,
                    funcionarios.funcionario_cargo,
                    funcionarios.funcionario_matricula,
                    funcionarios.funcionario_cnpj,
                    funcionarios.funcionario_nome_empresa,
                    funcionarios.funcionario_imobiliaria,
                    funcionarios.funcionario_regiao,
                    funcionarios.funcionario_regional,
                    funcionarios.funcionario_gestor,
                    funcionarios.funcionario_gestor_email,
                    funcionarios.funcionario_coordenador,
                    funcionarios.funcionario_coordenador_email,
                    funcionarios.funcionario_gerente,
                    funcionarios.funcionario_gerente_email,
                    funcionarios.funcionario_ativo,
                    funcionarios.funcionario_ativo_negocio,
                    funcionarios.funcionario_ativo_login,
                    funcionarios.funcionario_data_inicio_vigencia,
                    funcionarios.funcionario_data_fim_vigencia,
                    funcionarios.funcionario_data_admissao,
                    funcionarios.funcionario_data_cadastro_usuario,
                    funcionarios.funcionario_referencia_origem,
                    funcionarios.funcionario_origem_planilha,
                    funcionarios.funcionario_status_validacao,
                    funcionarios.corretor_identity_key as funcionario_corretor_identity_key
                from base
                left join lateral (
                    select *
                      from funcionarios funcionario_candidato
                     where funcionario_candidato.email_norm = base.corretor_dim_email_norm
                        or funcionario_candidato.corretor_identity_key = base.corretor_identity_key
                        or funcionario_candidato.corretor_match = base.corretor_match
                     order by
                        case
                            when funcionario_candidato.email_norm = base.corretor_dim_email_norm then 1
                            when funcionario_candidato.corretor_identity_key = base.corretor_identity_key then 2
                            else 3
                        end,
                        coalesce(funcionario_candidato.funcionario_ativo, false) desc,
                        coalesce(funcionario_candidato.funcionario_ativo_negocio, false) desc,
                        coalesce(funcionario_candidato.funcionario_ativo_login, false) desc,
                        funcionario_candidato.funcionario_data_fim_vigencia desc nulls first,
                        funcionario_candidato.funcionario_data_inicio_vigencia desc nulls last
                     limit 1
                ) funcionarios on true
                where data_evento >= $1::date
                  and data_evento < ($2::date + interval '1 day')
                  and ({condicao_indicador})
                  and (
                    $4::date is null
                    or data_evento >= $4::date
                    and data_evento < ($4::date + interval '1 day')
                  )
                  and (
                    (
                      $8::text <> 'foguetes'
                      or exists (
                        select 1
                        from foguetes_qualificados fq
                        where fq.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, base.corretor_identity_key)
                      )
                    )
                    and (
                    (
                      (cardinality($21::text[]) > 0 or cardinality($22::text[]) > 0)
                      and (
                        base.corretor_identity_key = any($21::text[])
                        or funcionarios.corretor_identity_key = any($21::text[])
                        or ('nome:' || base.corretor_match) = any($21::text[])
                        or base.corretor_match = any($22::text[])
                        or funcionarios.corretor_match = any($22::text[])
                      )
                    )
                    or (
                    cardinality($21::text[]) = 0
                    and cardinality($22::text[]) = 0
                    and (
                    (
                      $7::text <> ''
                      and $7::text <> 'inativos/outros'
                      and (
                        base.corretor_identity_key = $7::text
                        or funcionarios.corretor_identity_key = $7::text
                      )
                    )
                    or (
                      $7::text = 'inativos/outros'
                      and not exists (
                        select 1
                        from corretores_periodo_detalhe cpd
                        where cpd.corretor_identity_key = coalesce(funcionarios.corretor_identity_key, base.corretor_identity_key)
                           or cpd.corretor_match = base.corretor_match
                      )
                    )
                    or (
                      $7::text = ''
                      and $3::text <> ''
                      and base.corretor_match = regexp_replace(regexp_replace(lower(trim($3::text)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                    )
                    or (
                      $7::text = ''
                      and $3::text = ''
                      and $6::text <> ''
                      and coalesce(
                        nullif(trim(funcionarios.funcionario_regiao), ''),
                        nullif(trim(funcionarios.funcionario_regional), ''),
                        case when funcionarios.corretor_match is null then 'Inativos/Outros' else 'Sem regiao' end
                      ) = $6::text
                    )
                    )
                    )
                  )
                  )
                  {where_filtros}
            ),
            deduped as (
                select distinct on (detalhe_chave)
                    *
                from filtered
                order by detalhe_chave, data_evento desc nulls last, idrepasse desc nulls last, idreserva desc nulls last, idprecadastro desc nulls last, idlead desc nulls last
            )
            select
                deduped.*,
                count(*) over()::int as total_count
            from deduped
            order by data_evento desc nulls last, idrepasse desc nulls last, idreserva desc nulls last, idprecadastro desc nulls last, idlead desc nulls last
            limit $5
            """,
            intervalo.inicio,
            intervalo.fim,
            corretor,
            data_filtro,
            limit,
            regiaoDetalhe,
            corretor_identity,
            aba,
            *parametros_foguetes,
            *parametros_hierarquia,
            corretor_identities,
            corretor_matches,
            *parametros_filtros,
        )

    itens = [_linha_para_dict(linha) for linha in linhas]
    total = int(itens[0].get("total_count") or 0) if itens else 0
    for item in itens:
        item.pop("total_count", None)
    return {
        "corretorIdentity": corretor_identity or None,
        "corretor": corretor or None,
        "regiao": regiaoDetalhe or None,
        "indicador": indicador,
        "indicadorLabel": indicador_config["label"],
        "aba": aba,
        "data": data_filtro,
        "items": itens,
        "pagination": {"limit": limit, "total": total},
        "meta": {
            "source": "connect_comercial.comercial_base",
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
            "audit": {
                "expectedFromClick": expectedTotal,
                "detailTotal": total,
                "scope": escopo_detalhe,
                "indicatorCondition": condicao_indicador,
                "eventDateColumn": coluna_data_evento,
                "detailKey": chave_detalhe,
                "detailEntity": indicador_config.get("entity"),
            },
            "notes": [
                "Detalhamento usa a base comercial granular por jornada.",
                "Campos adicionais externos ao comercial_base so aparecem quando existirem como colunas na fonte.",
            ],
        },
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/segmented/filters")
async def filtros_segmentados_dashboard(
    request: Request,
    lite: bool = Query(False),
    limit: int = Query(120, ge=1, le=1000),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    option_limit = min(limit, 120 if lite else 500)
    pool = _obter_pool(request)

    async with pool.acquire() as conexao:
        valores: dict[str, list[dict[str, str]]] = {}

        for campo in SEGMENTED_OPERATION_FIELDS:
            if campo == "unidade":
                valores[campo] = await _buscar_opcoes_unidade_segmentadas(
                    conexao,
                    intervalo,
                    request,
                    option_limit,
                )
                continue
            if campo in FUNCIONARIO_PESSOA_FIELDS:
                valores[campo] = await _buscar_opcoes_funcionarios_vigentes(
                    conexao,
                    campo,
                    intervalo,
                    option_limit,
                )
                continue
            coluna = SEGMENTED_FILTER_COLUMNS_KPI.get(campo)
            if coluna:
                valores[campo] = await _buscar_opcoes_kpi_segmentadas(
                    conexao,
                    campo,
                    coluna,
                    intervalo,
                    request,
                    option_limit,
                )

        for campo in SEGMENTED_CORRETOR_FIELDS:
            valores[campo] = await _buscar_opcoes_funcionarios_vigentes(
                conexao,
                campo,
                intervalo,
                option_limit,
            )

        for campo in SEGMENTED_SDR_FIELDS:
            valores[campo] = await _buscar_opcoes_funcionarios_vigentes(
                conexao,
                campo,
                intervalo,
                option_limit,
            )

    return {
        "operation": {
            "regiaoOperacao": _opcoes_com_todos(valores.get("regiaoOperacao", []), "todas", "Todas as regioes da operacao"),
            "imobiliariaOperacao": _opcoes_com_todos(valores.get("imobiliariaOperacao", []), "todas", "Todas as imobiliarias da operacao"),
            "corretorOperacao": _opcoes_com_todos(valores.get("corretorOperacao", []), "todos", "Todos os corretores da operacao"),
            "sdrOperacao": _opcoes_com_todos(valores.get("sdrOperacao", []), "todos", "Todos os SDRs da operacao"),
            "origem": _opcoes_com_todos(valores.get("origem", []), "todas", "Todas as origens"),
            "empreendimento": _opcoes_com_todos(valores.get("empreendimento", []), "todos", "Todos os empreendimentos"),
            "unidade": _opcoes_com_todos(valores.get("unidade", []), "todas", "Todas as unidades"),
        },
        "corretorAtivo": {
            "corretorAtivo": _opcoes_com_todos(valores.get("corretorAtivo", []), "todos", "Todos os corretores"),
            "gestorCorretor": _opcoes_com_todos(valores.get("gestorCorretor", []), "todas", "Todas as gerencias do corretor"),
            "coordenadorCorretor": _opcoes_com_todos(valores.get("coordenadorCorretor", []), "todas", "Todas as coordenacoes do corretor"),
            "regiaoCorretor": _opcoes_com_todos(valores.get("regiaoCorretor", []), "todas", "Todas as regioes do corretor"),
            "imobiliariaCorretor": _opcoes_com_todos(valores.get("imobiliariaCorretor", []), "todas", "Todas as imobiliarias do corretor"),
        },
        "sdrAtivo": {
            "sdrAtivo": _opcoes_com_todos(valores.get("sdrAtivo", []), "todos", "Todos os SDRs"),
            "gestorSdr": _opcoes_com_todos(valores.get("gestorSdr", []), "todas", "Todas as gerencias do SDR"),
            "coordenadorSdr": _opcoes_com_todos(valores.get("coordenadorSdr", []), "todas", "Todas as coordenacoes do SDR"),
            "regiaoSdr": _opcoes_com_todos(valores.get("regiaoSdr", []), "todas", "Todas as regioes do SDR"),
            "imobiliariaSdr": _opcoes_com_todos(valores.get("imobiliariaSdr", []), "todas", "Todas as imobiliarias do SDR"),
        },
        "meta": {
            "source": "comercial_kpi_daily + comercial_leads_historico/sevenlm_connect.funcionario_acesso",
            "fallback": False,
            "lite": lite,
            "limit": option_limit,
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
        },
    }


async def _breakdown_segmentado_eixo(
    conexao,
    eixo: str,
    kpi: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, Any]]:
    if str(kpi or "").strip() == "agendamentos":
        return await _breakdown_agendamentos_eixo(conexao, eixo, intervalo, request, limit)
    if eixo in FUNCIONARIO_PESSOA_FIELDS and str(kpi or "").strip() not in {"ipc", "ipc_corretor", "ipc_imobiliaria"}:
        return await _breakdown_funcionario_pessoa_eixo(conexao, eixo, kpi, intervalo, request, limit, SEGMENTED_FILTER_COLUMNS_KPI)
    if str(kpi or "").strip() in {"repasses", "ipc", "ipc_corretor", "ipc_imobiliaria"}:
        return await _breakdown_produtividade_oficial_eixo(conexao, eixo, kpi, intervalo, request, limit)

    coluna = SEGMENTED_FILTER_COLUMNS_KPI.get(eixo)
    if not coluna:
        return []
    where_filtros, parametros_filtros = _montar_where_dimensoes(
        request,
        SEGMENTED_FILTER_COLUMNS_KPI,
        3,
        ignorar={eixo},
    )
    expr = _expressao_kpi(kpi)
    linhas = await conexao.fetch(
        f"""
        select
            coalesce(nullif({coluna}, ''), 'Sem informacao') as label,
            coalesce({expr}, 0)::numeric as value,
            coalesce(sum(leads), 0)::numeric as count,
            greatest(
                coalesce(sum(leads), 0),
                coalesce(sum(visitas), 0),
                coalesce(sum(vendas), 0),
                coalesce(sum(repasses), 0),
                coalesce(sum(propostas_total), 0),
                coalesce(sum(cancelamentos), 0),
                coalesce(sum(distratos), 0)
            )::int as case_count
        from {ESQUEMA_COMERCIAL}.comercial_kpi_daily
        where data >= $1::date
          and data <= $2::date
          {where_filtros}
        group by coalesce(nullif({coluna}, ''), 'Sem informacao')
        having coalesce({expr}, 0) <> 0
        order by value desc, label asc
        limit ${3 + len(parametros_filtros)}
        """,
        intervalo.inicio,
        intervalo.fim,
        *parametros_filtros,
        limit,
    )
    return [_linha_para_dict(linha) for linha in linhas]


async def _breakdown_produtividade_oficial_eixo(
    conexao,
    eixo: str,
    kpi: str,
    intervalo: IntervaloDatas,
    request: Request,
    limit: int,
) -> list[dict[str, Any]]:
    kpi_normalizado = str(kpi or "").strip()
    eixo_hierarquia = {
        "corretorAtivo": "corretor",
        "corretorOperacao": "corretor",
        "corretor": "corretor",
        "gestorCorretor": "gerente",
        "gerencia": "gerente",
        "coordenadorCorretor": "coordenador",
        "coordenacao": "coordenador",
        "regiaoCorretor": "regiao",
        "regiaoOperacao": "regiao",
        "imobiliariaCorretor": "equipe",
        "imobiliariaOperacao": "equipe",
        "imobiliaria": "equipe",
    }.get(eixo)
    eixo_repasses = {
        "regiaoOperacao": "regiao",
        "imobiliariaOperacao": "equipe",
        "corretorOperacao": "corretor",
        "regiaoCorretor": "regiao",
        "imobiliariaCorretor": "equipe",
        "corretorAtivo": "corretor",
        "origem": "origem",
        "empreendimento": "empreendimento",
        "sdrOperacao": "sdr",
        "sdrAtivo": "sdr",
    }.get(eixo)

    if kpi_normalizado in {"ipc", "ipc_corretor", "ipc_imobiliaria"} and not eixo_hierarquia:
        return []

    params = [*_params_produtividade_oficial(intervalo, request), limit]
    if kpi_normalizado == "repasses" and eixo_repasses and not eixo_hierarquia:
        linhas = await conexao.fetch(
            f"""
            {_sql_produtividade_oficial()}
            select
                coalesce(nullif({eixo_repasses}, ''), 'Sem informacao') as label,
                coalesce(sum(repasses), 0)::numeric as value,
                coalesce(sum(repasses), 0)::numeric as count,
                coalesce(sum(repasses), 0)::int as case_count
            from repasses_fato_brutos
            group by coalesce(nullif({eixo_repasses}, ''), 'Sem informacao')
            having coalesce(sum(repasses), 0) <> 0
            order by value desc, label asc
            limit $15
            """,
            *params,
        )
        return [_linha_para_dict(linha) for linha in linhas]

    if eixo_hierarquia:
        valor_sql = (
            "case when count(distinct eixo.equipe_key) > 0 "
            "then coalesce(sum(ro.repasses), 0)::numeric / count(distinct eixo.equipe_key)::numeric else 0 end"
            if kpi_normalizado == "ipc_imobiliaria"
            else "case when count(distinct eixo.produtivo_key) > 0 "
            "then coalesce(sum(ro.repasses), 0)::numeric / count(distinct eixo.produtivo_key)::numeric else 0 end"
        )
        if kpi_normalizado == "repasses":
            valor_sql = "coalesce(sum(ro.repasses), 0)::numeric"
        valor_breakdown_sql = (
            "case when coalesce(ed.equipes, 0) > 0 then coalesce(ra.repasses, 0)::numeric / ed.equipes else 0 end"
            if kpi_normalizado == "ipc_imobiliaria"
            else "case when coalesce(ed.produtivos, 0) > 0 then coalesce(ra.repasses, 0)::numeric / ed.produtivos else 0 end"
        )
        if kpi_normalizado == "repasses":
            valor_breakdown_sql = "coalesce(ra.repasses, 0)::numeric"
        linhas = await conexao.fetch(
            f"""
            {_sql_produtividade_oficial()}
            , eixo as (
                select distinct
                    mes_referencia,
                    regexp_replace(regexp_replace(lower(trim(corretor)), '\\s*-\\s*(clt|pj)$', '', 'i'), '\\s+', ' ', 'g') as corretor_key,
                    lower(trim(equipe)) as equipe_key,
                    {eixo_hierarquia} as label,
                    concat_ws(
                        '|',
                        coalesce(nullif(trim(coordenador), ''), 'Sem coordenador'),
                        coalesce(nullif(trim(gerente), ''), 'Sem gerente'),
                        coalesce(nullif(trim(equipe), ''), 'Sem equipe'),
                        coalesce(nullif(trim(corretor_ativo_mes_key), ''), nullif(trim(corretor_hierarquia_key), ''), nullif(trim(corretor), ''), 'Sem corretor')
                    ) as produtivo_key
                from hierarquia_ativa
            ),
            eixo_unico as (
                select *
                  from (
                    select
                        eixo.*,
                        row_number() over (
                            partition by eixo.mes_referencia, eixo.corretor_key
                            order by eixo.label, eixo.produtivo_key
                        ) as ordem
                    from eixo
                  ) dados
                 where ordem = 1
            ),
            eixo_denominador as (
                select
                    coalesce(nullif(label, ''), 'Sem informacao') as label,
                    count(distinct produtivo_key)::numeric as produtivos,
                    count(distinct equipe_key)::numeric as equipes
                from eixo
                group by coalesce(nullif(label, ''), 'Sem informacao')
            ),
            repasses_atribuidos as (
                select
                    coalesce(nullif(eixo_unico.label, ''), 'Sem informacao') as label,
                    coalesce(sum(ro.repasses), 0)::numeric as repasses
                from repasses_oficiais ro
                join eixo_unico
                  on eixo_unico.mes_referencia = ro.mes_referencia
                 and eixo_unico.corretor_key = regexp_replace(regexp_replace(lower(trim(ro.corretor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')
                where ro.ativo_na_hierarquia
                group by coalesce(nullif(eixo_unico.label, ''), 'Sem informacao')
            ),
            breakdown_ativo as (
                select
                    ed.label,
                    {valor_breakdown_sql} as value,
                    ed.produtivos as count,
                    ed.produtivos::int as case_count
                from eixo_denominador ed
                left join repasses_atribuidos ra
                  on ra.label = ed.label
                where {valor_breakdown_sql} <> 0
            ),
            breakdown_inativos as (
                select
                    'Inativos/Outros'::text as label,
                    coalesce(sum(ro.repasses), 0)::numeric as value,
                    count(distinct regexp_replace(regexp_replace(lower(trim(ro.corretor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) filter (where coalesce(ro.repasses, 0) <> 0)::numeric as count,
                    count(distinct regexp_replace(regexp_replace(lower(trim(ro.corretor)), '\\s*-\\s*(clt|pj|desligado|demitido|inativo)$', '', 'i'), '\\s+', ' ', 'g')) filter (where coalesce(ro.repasses, 0) <> 0)::int as case_count
                from repasses_oficiais ro
                where not ro.ativo_na_hierarquia
                having coalesce(sum(ro.repasses), 0) <> 0
            )
            select
                label,
                value,
                count,
                case_count
            from breakdown_ativo
            union all
            select
                label,
                value,
                count,
                case_count
            from breakdown_inativos
            where $16::text = 'repasses'
            order by value desc, label asc
            limit $15
            """,
            *params,
            kpi_normalizado,
        )
        return [_linha_para_dict(linha) for linha in linhas]

    if not eixo_repasses:
        return []

    linhas = await conexao.fetch(
        f"""
        {_sql_produtividade_oficial()}
        select
            coalesce(nullif({eixo_repasses}, ''), 'Sem informacao') as label,
            coalesce(sum(repasses), 0)::numeric as value,
            coalesce(sum(repasses), 0)::numeric as count,
            coalesce(sum(repasses), 0)::int as case_count
        from repasses_fato_brutos
        group by coalesce(nullif({eixo_repasses}, ''), 'Sem informacao')
        having coalesce(sum(repasses), 0) <> 0
        order by value desc, label asc
        limit $15
        """,
        *params,
    )
    return [_linha_para_dict(linha) for linha in linhas]


@rotas_de_dashboard_comercial.get("/v1/dashboard/segmented/breakdown")
async def breakdown_segmentado_dashboard(
    request: Request,
    kpi: str = Query("leads"),
    limit: int = Query(20, ge=1, le=1000),
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    intervalo = _intervalo_datas(request)
    pool = _obter_pool(request)
    eixos = [
        *SEGMENTED_OPERATION_FIELDS,
        *SEGMENTED_CORRETOR_FIELDS,
        *SEGMENTED_SDR_FIELDS,
    ]
    async with pool.acquire() as conexao:
        por_eixo = {
            eixo: await _breakdown_segmentado_eixo(
                conexao,
                eixo,
                kpi,
                intervalo,
                request,
                limit,
            )
            for eixo in eixos
        }
    return {
        "byAxis": por_eixo,
        "meta": {
            "source": "comercial_kpi_daily",
            "fallback": True,
            "kpi": kpi,
            "startDate": intervalo.inicio,
            "endDate": intervalo.fim,
        },
    }


def _resposta_sla_vazia() -> dict[str, Any]:
    return {
        "summary": {"media": 0, "base": 0},
        "porCorretor": [],
        "maioresSla": [],
        "semAssinatura": [],
        "semAssinaturaPorSituacao": [],
    }


@rotas_de_dashboard_comercial.get("/v1/dashboard/sla-repasse-insights")
async def insights_sla_repasse_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    return _resposta_sla_vazia()


@rotas_de_dashboard_comercial.get("/v1/dashboard/sla-finalizacao-insights")
async def insights_sla_finalizacao_dashboard(
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    await _exigir_acesso(request, usuario)
    return _resposta_sla_vazia()
