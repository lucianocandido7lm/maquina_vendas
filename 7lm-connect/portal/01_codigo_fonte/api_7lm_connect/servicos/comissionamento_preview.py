"""
Montagem do contrato operacional do preview de comissionamento.

O MVP ainda usa o seed de maio/2026 como referencia inicial. Esta camada
centraliza os campos calculados exibidos pelo frontend para evitar regra critica
espalhada no navegador.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from configuracoes import ESQUEMA_COMERCIAL
from servicos.comissionamento_indicadores import (
    buscar_meta_colaborador,
    buscar_realizado_lideranca,
)


INDICADORES_CONFIGURAVEIS = (
    "leads",
    "visitas",
    "propostas_aprovadas",
    "propostas_total",
    "vendas",
    "repasses",
    "cancelamentos",
    "distratos",
    "ipc",
    "sobrepreco_medio",
)

FAIXAS_REGRA_01 = (
    {"rotulo": "0% a 39,99%", "minimo": 0, "maximo": 39.99, "multiplicador": Decimal("0.00")},
    {"rotulo": "40% a 59,99%", "minimo": 40, "maximo": 59.99, "multiplicador": Decimal("0.35")},
    {"rotulo": "60% a 79,99%", "minimo": 60, "maximo": 79.99, "multiplicador": Decimal("0.60")},
    {"rotulo": "80% a 94,99%", "minimo": 80, "maximo": 94.99, "multiplicador": Decimal("0.80")},
    {"rotulo": "95% a 104,99%", "minimo": 95, "maximo": 104.99, "multiplicador": Decimal("1.00")},
    {"rotulo": "105% a 109,99%", "minimo": 105, "maximo": 109.99, "multiplicador": Decimal("1.05")},
    {"rotulo": "110% a 114,99%", "minimo": 110, "maximo": 114.99, "multiplicador": Decimal("1.10")},
    {"rotulo": "115% a 119,99%", "minimo": 115, "maximo": 119.99, "multiplicador": Decimal("1.15")},
    {"rotulo": "120% a 129,99%", "minimo": 120, "maximo": 129.99, "multiplicador": Decimal("1.20")},
    {"rotulo": "130% a 139,99%", "minimo": 130, "maximo": 139.99, "multiplicador": Decimal("1.30")},
    {"rotulo": "+ que 140%", "minimo": 140, "maximo": None, "multiplicador": Decimal("1.40")},
)

REGRAS_RASCUNHO_PADRAO = (
    {
        "id": "regra-01-escada-mvp",
        "tipo": "regra_01",
        "nome": "Escada de atingimento",
        "versao": 1,
        "status": "rascunho",
        "vigencia_inicio": "2026-06",
        "indicador": "vendas",
        "campos_editaveis": (
            "indicador",
            "objetivo",
            "peso",
            "faixas.rotulo",
            "faixas.minimo",
            "faixas.maximo",
            "faixas.valor",
        ),
        "faixas": FAIXAS_REGRA_01,
    },
    {
        "id": "regra-02-ips-mvp",
        "tipo": "regra_02",
        "nome": "IPs e bonus",
        "versao": 1,
        "status": "rascunho",
        "vigencia_inicio": "2026-06",
        "indicador": "ipc",
        "campos_editaveis": (
            "nome",
            "indicador",
            "tipo_comissao",
            "operador",
            "alvo",
            "valor_bonus",
            "data_inicial",
            "data_fim",
            "periodo_corte",
        ),
        "tipos_comissao": ("numero", "percentual", "decimal", "moeda"),
    },
)


def _decimal(valor: Any) -> Decimal:
    return Decimal(str(valor or 0))


def _moeda(valor: Decimal) -> float:
    return float(valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _numero(valor: Decimal, casas: str = "0.01") -> float:
    return float(valor.quantize(Decimal(casas), rounding=ROUND_HALF_UP))


def _uuid_ou_none(valor: Any) -> str | None:
    if not valor:
        return None
    try:
        return str(UUID(str(valor)))
    except (TypeError, ValueError):
        return None


def _periodo_ciclo(registro: dict[str, Any]) -> tuple[int, int]:
    ciclo_id = str(registro.get("ciclo_id") or "")
    try:
        ano, mes = ciclo_id.split("-", 1)
        return int(ano), int(mes)
    except (TypeError, ValueError):
        return 2026, 6


async def _buscar_meta_colaborador(
    conexao,
    usuario_id: str,
    ano: int,
    mes: int,
    codigos_indicador: tuple[str, ...],
):
    return await conexao.fetchrow(
        f"""
        select
            m.id,
            m.meta_valor as valor_meta,
            i.codigo as indicador
        from {ESQUEMA_COMERCIAL}.metas_colaboradores m
        join {ESQUEMA_COMERCIAL}.indicadores_meta i on i.id = m.indicador_id
        where m.usuario_id = $1::uuid
          and m.ano_referencia = $2
          and m.mes_referencia = $3
          and m.ativo = true
          and upper(i.codigo) = any($4::text[])
        order by m.updated_at desc
        limit 1
        """,
        usuario_id,
        ano,
        mes,
        list(codigos_indicador),
    )


async def _buscar_resultado_meta(
    conexao,
    usuario_id: str,
    ano: int,
    mes: int,
    codigos_indicador: tuple[str, ...],
):
    return await conexao.fetchrow(
        f"""
        select
            r.id,
            r.valor_realizado,
            i.codigo as indicador
        from {ESQUEMA_COMERCIAL}.resultados_metas r
        join {ESQUEMA_COMERCIAL}.indicadores_meta i on i.id = r.indicador_id
        where r.usuario_id = $1::uuid
          and r.ano_referencia = $2
          and r.mes_referencia = $3
          and upper(i.codigo) = any($4::text[])
        order by r.updated_at desc
        limit 1
        """,
        usuario_id,
        ano,
        mes,
        list(codigos_indicador),
    )


def _codigos_indicador(indicador: str) -> tuple[str, ...]:
    mapa = {
        "vendas": ("VENDAS", "VENDAS_FINALIZADAS"),
        "propostas_aprovadas": ("PROPOSTAS_APROVADAS", "PROPOSTAS"),
        "propostas_total": ("PROPOSTAS_TOTAL", "PROPOSTAS"),
        "sobrepreco_medio": ("SOBREPRECO_MEDIO", "SOBREPRECO"),
    }
    normalizado = str(indicador or "").strip().lower()
    return mapa.get(normalizado, (normalizado.upper(),))


def _faixa_por_percentual(percentual: Decimal) -> dict[str, Any]:
    for faixa in FAIXAS_REGRA_01:
        maximo = faixa["maximo"]
        if percentual >= Decimal(str(faixa["minimo"])) and (
            maximo is None or percentual <= Decimal(str(maximo))
        ):
            return faixa
    return FAIXAS_REGRA_01[0]


def _proxima_faixa(percentual: Decimal) -> dict[str, Any] | None:
    for faixa in FAIXAS_REGRA_01:
        minimo = Decimal(str(faixa["minimo"]))
        if percentual < minimo:
            return {
                "rotulo": faixa["rotulo"],
                "faltam_percentuais": _numero(minimo - percentual),
            }
    return None





async def _montar_regra_01(registro: dict[str, Any], conexao, esquema: str, identidade: dict[str, Any]) -> list[dict[str, Any]]:
    valor_bruto = _decimal(registro.get("valor_bruto"))
    pessoa_id = _uuid_ou_none(identidade.get("pessoa_id"))
    criterio_vinculo = identidade.get("criterio_vinculo")

    ano, mes = _periodo_ciclo(registro)
    realizado_oficial = await buscar_realizado_lideranca(conexao, registro, str(registro.get("ciclo_id") or "2026-06"))
    usuario_meta = realizado_oficial.usuario_id or pessoa_id
    if not usuario_meta:
        return [{
            "status_calculo": "sem_vinculo",
            "indicador": "vendas",
            "realizado": _numero(realizado_oficial.valor("vendas"), "0.01"),
            "fonte_realizado": realizado_oficial.fonte,
            "linhas_fonte": realizado_oficial.linhas_fonte,
            "corretores_fonte": realizado_oficial.corretores_fonte,
            "criterio_vinculo": realizado_oficial.criterio_vinculo or criterio_vinculo,
        }]

    meta = await buscar_meta_colaborador(conexao, usuario_meta, ano, mes, _codigos_indicador("vendas"))
    realizado_fallback = realizado_oficial.valor("vendas")
    if not meta:
        return [{
            "status_calculo": "sem_meta",
            "indicador": "vendas",
            "realizado": _numero(realizado_fallback, "0.01"),
            "fonte_realizado": realizado_oficial.fonte,
            "linhas_fonte": realizado_oficial.linhas_fonte,
            "corretores_fonte": realizado_oficial.corretores_fonte,
            "criterio_vinculo": realizado_oficial.criterio_vinculo,
        }]

    objetivo = _decimal(meta["valor_meta"])
    if objetivo == 0:
        return [{
            "status_calculo": "sem_meta",
            "indicador": "vendas",
            "objetivo": 0,
            "realizado": _numero(realizado_fallback, "0.01"),
            "fonte_realizado": realizado_oficial.fonte,
            "linhas_fonte": realizado_oficial.linhas_fonte,
            "corretores_fonte": realizado_oficial.corretores_fonte,
            "criterio_vinculo": realizado_oficial.criterio_vinculo,
        }]

    realizado_row = await _buscar_resultado_meta(conexao, pessoa_id, ano, mes, _codigos_indicador("vendas"))
    realizado = _decimal(realizado_row["valor_realizado"]) if realizado_row else realizado_fallback
    if not realizado_row and realizado_oficial.linhas_fonte <= 0:
        return [{"status_calculo": "sem_realizado", "indicador": "vendas", "fonte_realizado": realizado_oficial.fonte}]
    percentual = (realizado / objetivo) * Decimal("100")
    faixa = _faixa_por_percentual(percentual)
    valor_calculado = valor_bruto * faixa["multiplicador"]

    return [
        {
            "meta_id": f"{registro['id']}-r01-vendas",
            "status_calculo": "ok",
            "nome": "Vendas do ciclo",
            "indicador": "vendas",
            "objetivo": _numero(objetivo, "0.01"),
            "realizado": _numero(realizado, "0.01"),
            "peso": 1,
            "percentual_atingimento": _numero(percentual),
            "faixa_aplicada": faixa["rotulo"],
            "valor_faixa": _moeda(valor_bruto * faixa["multiplicador"]),
            "valor_calculado": _moeda(valor_calculado),
            "proxima_faixa": _proxima_faixa(percentual),
            "faixas": [
                {
                    "rotulo": item["rotulo"],
                    "minimo": item["minimo"],
                    "maximo": item["maximo"],
                    "realizado_atual": _numero(realizado, "0.01"),
                    "objetivo_base": _numero(objetivo, "0.01"),
                    "necessario_minimo": _numero(objetivo * Decimal(str(item["minimo"])) / Decimal("100"), "0.01"),
                    "necessario_maximo": (
                        None
                        if item["maximo"] is None
                        else _numero(objetivo * Decimal(str(item["maximo"])) / Decimal("100"), "0.01")
                    ),
                    "faltam_para_minimo": _numero(max((objetivo * Decimal(str(item["minimo"])) / Decimal("100")) - realizado, Decimal("0")), "0.01"),
                    "multiplicador": _numero(item["multiplicador"], "0.01"),
                    "valor_faixa": _moeda(valor_bruto * item["multiplicador"]),
                    "valor_bonus": _moeda(valor_bruto * item["multiplicador"]),
                    "ativa": item["rotulo"] == faixa["rotulo"],
                }
                for item in FAIXAS_REGRA_01
            ],
            "fonte_realizado": "resultados_metas" if realizado_row else realizado_oficial.fonte,
            "linhas_fonte": realizado_oficial.linhas_fonte,
            "corretores_fonte": realizado_oficial.corretores_fonte,
            "criterio_vinculo": realizado_oficial.criterio_vinculo,
        }
    ]


async def _montar_ips(registro: dict[str, Any], conexao, esquema: str, identidade: dict[str, Any]) -> list[dict[str, Any]]:
    pessoa_id = _uuid_ou_none(identidade.get("pessoa_id"))
    realizado_oficial = await buscar_realizado_lideranca(conexao, registro, str(registro.get("ciclo_id") or "2026-06"))
    usuario_meta = realizado_oficial.usuario_id or pessoa_id
    if not usuario_meta:
        return [
            {
                "ip_id": f"{registro['id']}-ip-sem-vinculo-{indicador}",
                "status_calculo": "sem_vinculo",
                "nome": nome,
                "indicador": indicador,
                "realizado": _numero(realizado_oficial.valor(indicador)),
                "fonte_realizado": realizado_oficial.fonte,
                "linhas_fonte": realizado_oficial.linhas_fonte,
                "corretores_fonte": realizado_oficial.corretores_fonte,
                "criterio_vinculo": realizado_oficial.criterio_vinculo,
            }
            for nome, indicador in (
                ("IPC minimo 1,20", "ipc"),
                ("Sobrepreco medio acima de R$ 3.500", "sobrepreco_medio"),
                ("Repasses ate dia 20", "repasses"),
                ("Visitas qualificadas", "visitas"),
            )
        ]

    definicoes = (
        ("IPC minimo 1,20", "ipc", ">=", Decimal("1.20"), Decimal("450")),
        ("Sobrepreco medio acima de R$ 3.500", "sobrepreco_medio", ">=", Decimal("3500"), Decimal("550")),
        ("Repasses ate dia 20", "repasses", ">=", Decimal("5"), Decimal("350")),
        ("Visitas qualificadas", "visitas", ">=", Decimal("24"), Decimal("250")),
    )

    ips = []
    ano, mes = _periodo_ciclo(registro)
    for posicao, (nome, indicador, operador, alvo, bonus) in enumerate(definicoes, start=1):
        realizado_row = await _buscar_resultado_meta(conexao, usuario_meta, ano, mes, _codigos_indicador(indicador))
        realizado = _decimal(realizado_row["valor_realizado"]) if realizado_row else realizado_oficial.valor(indicador)
        if not realizado_row and realizado_oficial.linhas_fonte <= 0:
            ips.append({
                "ip_id": f"{registro['id']}-ip-{posicao}",
                "status_calculo": "sem_realizado",
                "nome": nome,
                "indicador": indicador,
                "fonte_realizado": realizado_oficial.fonte,
            })
            continue

        atingiu = realizado >= alvo
        ips.append(
            {
                "ip_id": f"{registro['id']}-ip-{posicao}",
                "status_calculo": "ok",
                "nome": nome,
                "indicador": indicador,
                "tipo_comissao": "numero",
                "operador": operador,
                "alvo": _numero(alvo),
                "realizado": _numero(realizado),
                "atingiu": atingiu,
                "valor_bonus": _moeda(bonus if atingiu else Decimal("0")),
                "data_inicial": "2026-06-01",
                "data_fim": "2026-06-20" if indicador == "repasses" else "2026-06-30",
                "periodo_corte": "2026-06",
                "fonte_realizado": "resultados_metas" if realizado_row else realizado_oficial.fonte,
                "linhas_fonte": realizado_oficial.linhas_fonte,
                "corretores_fonte": realizado_oficial.corretores_fonte,
                "criterio_vinculo": realizado_oficial.criterio_vinculo,
            }
        )
    return ips


def _montar_fluxo(registro: dict[str, Any]) -> dict[str, Any]:
    status_aprovacao = str(registro.get("status") or "calculado").strip().lower()
    status_nf = str(registro.get("status_nf") or ("pendente_nf" if registro.get("exige_nf") else "nao_aplicavel")).strip().lower()
    status_financeiro = str(registro.get("status_financeiro") or "nao_enviado").strip().lower()
    status_pagamento = str(registro.get("status_pagamento") or "nao_enviado").strip().lower()
    exige_nf = bool(registro.get("exige_nf"))

    acoes_permitidas: list[str] = []
    proxima_acao = "sem_acao"
    etapa_ui = "secretaria"

    if status_aprovacao in {"calculado_seed", "calculado", "calculada", "pendente_secretaria", "em_revisao_secretaria", "revisao_necessaria", "rejeitada"}:
        etapa_ui = "secretaria"
        proxima_acao = "enviar_head"
        acoes_permitidas = ["enviar_head", "solicitar_ajuste"]
    elif status_aprovacao in {"aprovado_secretaria", "aguardando_head_comercial"}:
        etapa_ui = "head"
        proxima_acao = "aprovar_head"
        acoes_permitidas = ["aprovar_head", "rejeitar", "solicitar_ajuste"]
    elif exige_nf and (
        status_aprovacao in {"aprovado_marcelo", "aprovada_head_comercial", "aguardando_nf", "nf_em_validacao"}
        or status_nf in {"solicitada", "nf_solicitada", "recebida", "nf_recebida"}
    ):
        etapa_ui = "nf"
        proxima_acao = "reenviar_lembrete_nf"
        acoes_permitidas = ["reenviar_lembrete_nf"] if status_nf in {"solicitada", "nf_solicitada"} else []
    elif (
        status_aprovacao in {"pronto_financeiro", "pronta_para_envio_pagamento", "enviado_financeiro", "enviada_pagamento"}
        or status_financeiro in {"pronta_para_envio_pagamento", "pacote_enviado", "enviado_financeiro"}
        or status_pagamento in {"aguardando_pagamento", "paga", "pago"}
    ):
        etapa_ui = "pagamento"
        proxima_acao = "acompanhar_pagamento"
        acoes_permitidas = []

    if status_pagamento in {"paga", "pago"}:
        etapa_ui = "pagamento"
        proxima_acao = "sem_acao"
        acoes_permitidas = []

    return {
        "status_aprovacao": status_aprovacao,
        "status_nf": status_nf,
        "status_financeiro": status_financeiro,
        "status_pagamento": status_pagamento,
        "etapa_ui": etapa_ui,
        "proxima_acao": proxima_acao,
        "acoes_permitidas": acoes_permitidas,
        "bloqueios": [],
        "etapas": [
            {"id": "secretaria", "label": "Calculada/Revisão"},
            {"id": "head", "label": "Aprovação Comercial"},
            {"id": "nf", "label": "Aguardando NF"},
            {"id": "pagamento", "label": "Pagamento"},
        ],
    }


async def enriquecer_registro(registro: dict[str, Any], conexao, esquema: str) -> dict[str, Any]:
    from servicos.validador_comissionamento import resolver_identidade
    identidade = await resolver_identidade(registro)
    
    valor_bruto = _decimal(registro.get("valor_bruto"))
    distratos = _decimal(registro.get("desconto_distrato"))
    regra_01 = await _montar_regra_01(registro, conexao, esquema, identidade)
    regra_02_ips = await _montar_ips(registro, conexao, esquema, identidade)
    bonus_ips = sum(
        (_decimal(ip.get("valor_bonus", 0)) for ip in regra_02_ips if ip.get("status_calculo") == "ok"),
        Decimal("0"),
    )
    valor_liquido = _decimal(registro.get("valor_liquido")) or (valor_bruto - distratos)

    enriquecido = {
        **registro,
        "comissionado": {
            "id": registro.get("id"),
            "nome": registro.get("nome"),
            "tipo": registro.get("tipo_comissionado") or "PJ_AUTONOMO",
            "funcao": registro.get("funcao"),
            "cargo": registro.get("cargo") or registro.get("funcao"),
            "cidade": registro.get("cidade"),
            "localidade": registro.get("cidade"),
            "regiao": registro.get("cidade"),
            "perfil_acesso": registro.get("perfil_acesso"),
            "papel_comissionamento": registro.get("papel_comissionamento"),
            "origem_identidade": registro.get("origem_identidade"),
            "usuario_id": registro.get("identificador_usuario"),
            "funcionario_id": registro.get("identificador_funcionario"),
            "pessoa_id_oficial": identidade.get("pessoa_id"),
            "criterio_vinculo": identidade.get("criterio_vinculo"),
        },
        "valores": {
            "bruto": _moeda(valor_bruto),
            "distratos": _moeda(distratos),
            "bonus_ips": _moeda(bonus_ips),
            "liquido": _moeda(valor_liquido),
        },
        "regra_01": regra_01,
        "regra_02_ips": regra_02_ips,
        "fluxo": _montar_fluxo(registro),
        "timeline": [
            {"etapa": "Calculo", "status": "concluido", "quando": "2026-06-10", "responsavel": "Sistema"},
            {"etapa": "Secretaria", "status": "em_revisao", "quando": None, "responsavel": "Secretaria de Vendas"},
            {"etapa": "Aprovação Comercial", "status": "aguardando_nf" if registro.get("status") == "aprovado_marcelo" else "aguardando", "quando": None, "responsavel": "Diretoria Comercial"},
        ],
    }
    enriquecido["bloqueios"] = enriquecido["fluxo"]["bloqueios"]
    enriquecido["proxima_acao"] = enriquecido["fluxo"]["proxima_acao"]
    return enriquecido


async def enriquecer_preview(conexao, esquema: str, preview: dict[str, Any]) -> dict[str, Any]:
    registros = []
    for registro in preview.get("registros", []):
        reg = await enriquecer_registro(registro, conexao, esquema)
        registros.append(reg)
    
    resumo = dict(preview.get("resumo") or {})
    resumo.update(
        {
            "pendentes_secretaria": sum(
                1
                for item in registros
                if item["fluxo"]["status_aprovacao"]
                in {"calculado_seed", "calculado", "pendente_secretaria", "revisao_necessaria", "rejeitada"}
            ),
            "pendentes_marcelo": sum(
                1
                for item in registros
                if item["fluxo"]["status_aprovacao"] in {"aprovado_secretaria", "aguardando_head_comercial"}
            ),
            "etapa_nf": sum(1 for item in registros if item["fluxo"]["status_nf"] == "solicitada"),
            "bloqueados_nf": 0,
            "enviados_financeiro": sum(1 for item in registros if item["fluxo"]["status_financeiro"] == "enviado_financeiro"),
            "pagos": sum(1 for item in registros if item["fluxo"]["status_pagamento"] == "pago"),
            "bonus_ips_total": _moeda(sum((_decimal(item["valores"]["bonus_ips"]) for item in registros), Decimal("0"))),
        }
    )
    return {
        **preview,
        "resumo": resumo,
        "registros": registros,
        "indicadores": list(INDICADORES_CONFIGURAVEIS),
        "regras": list(REGRAS_RASCUNHO_PADRAO),
    }


def listar_regras_rascunho(vigencia: str | None = None) -> dict[str, Any]:
    return {
        "vigencia": vigencia or "2026-06",
        "status": "rascunho",
        "indicadores": list(INDICADORES_CONFIGURAVEIS),
        "regras": list(REGRAS_RASCUNHO_PADRAO),
        "mensagem": "Rascunho de regras do MVP. Publicacao definitiva exige motor auditavel.",
    }
