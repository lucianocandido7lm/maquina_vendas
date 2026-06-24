"""
Repositorio do modulo de comissionamento.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
import re
from typing import Any

from servicos.comissionamento_preview import enriquecer_preview


def _serializar(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return valor


def _json_objeto(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str):
        try:
            carregado = json.loads(valor)
            return carregado if isinstance(carregado, dict) else {"valor": carregado}
        except json.JSONDecodeError:
            return {"valor": valor}
    if valor in (None, ""):
        return {}
    return {"valor": _serializar(valor)}


def _detalhes_evento(valor: Any) -> dict[str, Any]:
    detalhes = _json_objeto(valor)
    if "valor" in detalhes and len(detalhes) == 1:
        return {"detalhes": detalhes["valor"]}
    return detalhes


def _json_lista(valor: Any) -> list[Any]:
    if isinstance(valor, list):
        return valor
    if isinstance(valor, str):
        try:
            carregado = json.loads(valor)
            return carregado if isinstance(carregado, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _texto_chave(valor: Any) -> str:
    return " ".join(str(valor or "").strip().lower().split())


def _email_chave(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _documento_chave(valor: Any) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def _uuid_texto(valor: Any) -> str:
    return str(valor) if valor not in (None, "") else ""


def _chave_identidade(*valores: Any) -> str:
    for valor in valores:
        texto = str(valor or "").strip()
        if texto:
            return texto
    return "sem-identidade"


def _resultado_id_produtivo(papel: str, identidade: dict[str, Any]) -> str:
    chave = _chave_identidade(
        identidade.get("identificador_usuario"),
        identidade.get("identificador_funcionario"),
        _documento_chave(identidade.get("documento")),
        _email_chave(identidade.get("email")),
        _texto_chave(identidade.get("nome")),
    )
    resumo = hashlib.md5(f"{papel}:{chave}".encode("utf-8")).hexdigest()
    return f"prod-2026-06-{papel}-{resumo[:16]}"


def _codigo_comissao(ciclo_id: Any, resultado_id: Any) -> str:
    ciclo_texto = str(ciclo_id or "ciclo")
    ano_mes = re.search(r"(20\d{2})\D?([01]\d)", ciclo_texto)
    ciclo = f"{ano_mes.group(1)}{ano_mes.group(2)}" if ano_mes else re.sub(r"[^0-9A-Za-z]+", "", ciclo_texto).upper()[-8:]
    ciclo = ciclo or "CICLO"
    resumo = hashlib.md5(str(resultado_id or "").encode("utf-8")).hexdigest()[:6].upper()
    return f"COM-{ciclo}-{resumo}"


def _eh_lider(nome: Any = None, cargo: Any = None, perfil: Any = None) -> bool:
    if "vago" in _texto_chave(nome):
        return False
    texto = _texto_chave(f"{cargo or ''} {perfil or ''}")
    if not texto:
        return False
    termos = (
        "gerente",
        "gestor",
        "coordenador",
        "head",
        "lider",
    )
    return any(termo in texto for termo in termos)


def _validacao_lideranca(papel: str, identidade: dict[str, Any]) -> dict[str, Any]:
    nome = _texto_chave(identidade.get("nome"))
    cargo = _texto_chave(identidade.get("cargo"))
    perfil = _texto_chave(identidade.get("perfil_acesso"))
    origem = identidade.get("origem_identidade")
    motivos: list[str] = []
    fonte = origem or "indefinida"
    if any(termo in cargo for termo in ("gerente", "gestor", "coordenador", "head", "lider")):
        fonte = "cargo"
        motivos.append(f"cargo={identidade.get('cargo')}")
    if any(termo in perfil for termo in ("gerente", "gestor", "coordenador", "head")):
        fonte = "perfil_acesso"
        motivos.append(f"perfil={identidade.get('perfil_acesso')}")
    if origem == "dashboard_hierarquia" and motivos:
        motivos.append("tambem aparece como gerente/coordenador na hierarquia mensal")
    if not motivos and origem:
        motivos.append(f"origem_identidade={origem}")
    return {
        "validado": bool(motivos),
        "papel": papel,
        "fonte": fonte,
        "motivos": motivos,
    }


def _preferir_texto(*valores: Any, padrao: str = "") -> str:
    for valor in valores:
        texto = str(valor or "").strip()
        if texto:
            return texto
    return padrao


def _valor_faixa_regra_01(faixa: dict[str, Any] | None) -> Any:
    if not isinstance(faixa, dict):
        return None
    for campo in ("valor_bonus", "valor_faixa", "valor_calculado", "valor"):
        if faixa.get(campo) is not None:
            return faixa.get(campo)
    return None


def _faixa_ativa_regra_01(faixas: list[dict[str, Any]], faixa_aplicada: Any) -> dict[str, Any] | None:
    chave_aplicada = _texto_chave(faixa_aplicada)
    if chave_aplicada:
        for faixa in faixas:
            if _texto_chave(faixa.get("rotulo") or faixa.get("label") or faixa.get("faixa") or faixa.get("id")) == chave_aplicada:
                return faixa
    for faixa in faixas:
        if bool(faixa.get("ativa")):
            return faixa
    return None


def _normalizar_regra_01_publicada(regra_publicada: dict[str, Any], regra_atual: list[dict[str, Any]]) -> list[dict[str, Any]]:
    regra_01 = _json_objeto(regra_publicada.get("regra_01"))
    if not regra_01:
        return regra_atual
    base = dict(regra_atual[0]) if regra_atual else {}
    faixas_base = base.get("faixas") or []
    faixas_publicadas = regra_01.get("faixas") if isinstance(regra_01.get("faixas"), list) else []
    if faixas_publicadas:
        por_rotulo = {
            _texto_chave(item.get("rotulo") or item.get("label") or item.get("faixa") or item.get("id")): item
            for item in faixas_base
            if isinstance(item, dict)
        }
        faixas = [
            {
                **por_rotulo.get(_texto_chave(item.get("rotulo") or item.get("label") or item.get("faixa") or item.get("id")), {}),
                **item,
                **({"valor_faixa": item.get("valor_bonus")} if item.get("valor_bonus") is not None else {}),
            }
            for item in faixas_publicadas
            if isinstance(item, dict)
        ]
    elif bool(regra_01.get("substituir_faixas")):
        faixas = []
    else:
        faixas = faixas_base
    faixa_aplicada = regra_01.get("faixa_aplicada") or base.get("faixa_aplicada")
    faixa_ativa = _faixa_ativa_regra_01(faixas, faixa_aplicada)
    valor_calculado = _valor_faixa_regra_01(faixa_ativa)
    if valor_calculado is None:
        valor_calculado = regra_01.get("valor_calculado", base.get("valor_calculado", 0))
    fonte_base = str(base.get("fonte_realizado") or "")
    usar_base_oficial = fonte_base.startswith("resultados_metas") or fonte_base.startswith("comercial_kpi_daily")
    fonte_realizado = base.get("fonte_realizado") if usar_base_oficial else regra_01.get("fonte_realizado", "regra_publicada")
    return [
        {
            **base,
            "meta_id": base.get("meta_id") or f"{regra_publicada.get('comissionado_id')}-r01-publicada",
            "nome": base.get("nome") or "Vendas do ciclo",
            "indicador": regra_01.get("indicador") or base.get("indicador") or "vendas",
            "objetivo": regra_01.get("objetivo", base.get("objetivo", 0)),
            "realizado": base.get("realizado", regra_01.get("realizado", 0)) if usar_base_oficial else regra_01.get("realizado", base.get("realizado", 0)),
            "percentual_atingimento": regra_01.get("percentual_atingimento", base.get("percentual_atingimento", 0)),
            "faixa_aplicada": faixa_aplicada,
            "valor_faixa": _serializar(Decimal(str(valor_calculado or 0))),
            "valor_calculado": _serializar(Decimal(str(valor_calculado or 0))),
            "faixas": faixas,
            "fonte_realizado": fonte_realizado,
            "linhas_fonte": base.get("linhas_fonte", regra_01.get("linhas_fonte")),
            "corretores_fonte": base.get("corretores_fonte", regra_01.get("corretores_fonte")),
            "criterio_vinculo": base.get("criterio_vinculo", regra_01.get("criterio_vinculo")),
            "versao_publicada": regra_publicada.get("versao"),
        }
    ]


def _normalizar_ips_publicados(regra_publicada: dict[str, Any], ips_atuais: list[dict[str, Any]]) -> list[dict[str, Any]]:
    regra_02 = _json_objeto(regra_publicada.get("regra_02"))
    ips = _json_lista(regra_publicada.get("regra_02_ips"))
    removidos = set(_json_lista(regra_publicada.get("regra_02_ips_removidos")))
    if not ips:
        if bool(regra_02.get("substituir_ips")):
            return []
        return [ip for ip in ips_atuais if ip.get("ip_id") not in removidos]
    normalizados = []
    atuais_por_indicador = {
        str(item.get("indicador") or ""): item
        for item in ips_atuais
        if isinstance(item, dict) and item.get("indicador")
    }
    for posicao, ip in enumerate(ips, start=1):
        ip_id = ip.get("ip_id") or f"{regra_publicada.get('comissionado_id')}-ip-publicado-{posicao}"
        if ip_id in removidos:
            continue
        ip_atual = atuais_por_indicador.get(str(ip.get("indicador") or ""))
        fonte_atual = str((ip_atual or {}).get("fonte_realizado") or "")
        usar_atual_oficial = fonte_atual.startswith("resultados_metas") or fonte_atual.startswith("comercial_kpi_daily")
        alvo = Decimal(str(ip.get("alvo") or 0))
        realizado_valor = (ip_atual or {}).get("realizado") if usar_atual_oficial else ip.get("realizado")
        realizado = Decimal(str(realizado_valor or 0))
        operador = str(ip.get("operador") or ">=")
        if operador == ">":
            atingiu = realizado > alvo
        elif operador == "<":
            atingiu = realizado < alvo
        elif operador == "<=":
            atingiu = realizado <= alvo
        elif operador in {"=", "=="}:
            atingiu = realizado == alvo
        else:
            atingiu = realizado >= alvo
        normalizados.append(
            {
                **ip,
                "ip_id": ip_id,
                "operador": operador,
                "atingiu": bool(ip.get("atingiu", atingiu)),
                "valor_bonus": _serializar(Decimal(str(ip.get("valor_bonus") or 0))),
                "realizado": _serializar(realizado),
                "fonte_realizado": (ip_atual or {}).get("fonte_realizado") if usar_atual_oficial else ip.get("fonte_realizado", "regra_publicada"),
                "linhas_fonte": (ip_atual or {}).get("linhas_fonte", ip.get("linhas_fonte")),
                "corretores_fonte": (ip_atual or {}).get("corretores_fonte", ip.get("corretores_fonte")),
                "criterio_vinculo": (ip_atual or {}).get("criterio_vinculo", ip.get("criterio_vinculo")),
                "versao_publicada": regra_publicada.get("versao"),
            }
        )
    return normalizados


def _valor_regra_01(registro: dict[str, Any]) -> Decimal:
    regras = registro.get("regra_01") or []
    regra = regras[0] if regras and isinstance(regras[0], dict) else {}
    faixas = regra.get("faixas") if isinstance(regra.get("faixas"), list) else []
    faixa_ativa = _faixa_ativa_regra_01([item for item in faixas if isinstance(item, dict)], regra.get("faixa_aplicada"))
    valor_faixa = _valor_faixa_regra_01(faixa_ativa)
    if valor_faixa is not None:
        return Decimal(str(valor_faixa or 0))
    return Decimal(str(regra.get("valor_calculado") or regra.get("valor_faixa") or registro.get("valor_bruto") or 0))


def _bonus_ips(registro: dict[str, Any]) -> Decimal:
    return sum(Decimal(str(ip.get("valor_bonus") or 0)) for ip in registro.get("regra_02_ips") or [])


def _recalcular_valores_publicados(registro: dict[str, Any]) -> dict[str, Any]:
    valor_bruto = _valor_regra_01(registro)
    desconto_distrato = Decimal(str(registro.get("desconto_distrato") or 0))
    bonus_ips = _bonus_ips(registro)
    valor_liquido = valor_bruto - desconto_distrato + bonus_ips
    valores = {
        **(registro.get("valores") or {}),
        "bruto": _serializar(valor_bruto),
        "distratos": _serializar(desconto_distrato),
        "bonus_ips": _serializar(bonus_ips),
        "liquido": _serializar(valor_liquido),
    }
    return {
        **registro,
        "valor_bruto": _serializar(valor_bruto),
        "valor_liquido": _serializar(valor_liquido),
        "valores": valores,
    }


def _aplicar_regras_e_hierarquia_publicadas(
    preview: dict[str, Any],
    regras: dict[str, dict[str, dict[str, Any]]],
    equipes: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    registros = []
    for item in preview.get("registros", []):
        por_id = regras.get(str(item.get("id") or ""), {})
        por_nome = regras.get(_texto_chave(item.get("nome")), {})
        publicadas = {**por_nome, **por_id}
        registro = dict(item)
        if "regra_01" in publicadas:
            registro["regra_01"] = _normalizar_regra_01_publicada(publicadas["regra_01"], registro.get("regra_01") or [])
        if "regra_02" in publicadas:
            registro["regra_02_ips"] = _normalizar_ips_publicados(publicadas["regra_02"], registro.get("regra_02_ips") or [])
        if publicadas:
            registro = _recalcular_valores_publicados(registro)
        equipe = equipes.get(str(item.get("id") or "")) or equipes.get(_texto_chave(item.get("nome")))
        if equipe:
            registro["equipe"] = equipe
            registro["pessoas_vinculadas"] = equipe
        registros.append(registro)
    resumo = {
        **(preview.get("resumo") or {}),
        "valor_bruto_total": _serializar(sum(Decimal(str(item.get("valor_bruto") or 0)) for item in registros)),
        "desconto_distrato_total": _serializar(sum(Decimal(str(item.get("desconto_distrato") or 0)) for item in registros)),
        "valor_liquido_total": _serializar(sum(Decimal(str(item.get("valor_liquido") or 0)) for item in registros)),
        "bonus_ips_total": _serializar(sum(Decimal(str((item.get("valores") or {}).get("bonus_ips") or 0)) for item in registros)),
    }
    return {**preview, "resumo": resumo, "registros": registros}


async def buscar_preview_ciclo(conexao, esquema: str, ciclo_id: str) -> dict[str, Any] | None:
    ciclo = await conexao.fetchrow(
        f"""
        select
            ciclo_id,
            mes,
            ano,
            rotulo,
            origem,
            status,
            prazo_envio_financeiro,
            prazo_nf_dias
        from {esquema}.ciclos
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    if not ciclo:
        return None

    linhas = await conexao.fetch(
        f"""
        select
            resultado_id as id,
            ciclo_id,
            funcao,
            cidade,
            nome,
            tipo_comissionado,
            valor_bruto,
            desconto_distrato,
            valor_liquido,
            status,
            status_nf,
            status_financeiro,
            status_pagamento,
            exige_nf,
            origem,
            identificador_usuario::text as identificador_usuario,
            identificador_funcionario::text as identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade,
            validacao_lideranca
        from {esquema}.resultados
        where ciclo_id = $1
        order by resultado_id
        """,
        ciclo_id,
    )

    registros = [serializar_linha_resultado(linha) for linha in linhas]

    valor_bruto_total = sum(Decimal(str(item["valor_bruto"])) for item in registros)
    desconto_distrato_total = sum(Decimal(str(item["desconto_distrato"])) for item in registros)
    valor_liquido_total = sum(Decimal(str(item["valor_liquido"])) for item in registros)

    configuracao = await obter_configuracao_ciclo(conexao, esquema, ciclo_id)
    preview = {
        "ciclo": {chave: _serializar(valor) for chave, valor in dict(ciclo).items()},
        "configuracao": configuracao,
        "resumo": {
            "quantidade_comissionados": len(registros),
            "valor_bruto_total": _serializar(valor_bruto_total),
            "desconto_distrato_total": _serializar(desconto_distrato_total),
            "valor_liquido_total": _serializar(valor_liquido_total),
            "pendentes_nf": sum(1 for item in registros if item["status_nf"] == "pendente_nf"),
            "prontos_financeiro": sum(1 for item in registros if item["status"] == "pronto_financeiro"),
        },
        "registros": registros,
    }
    enriquecido = await enriquecer_preview(conexao, esquema, preview)
    regras = await listar_regras_publicadas_ativas(conexao, esquema, ciclo_id)
    equipes = await listar_equipes_snapshot_por_ciclo(conexao, esquema, ciclo_id)
    return _aplicar_regras_e_hierarquia_publicadas(enriquecido, regras, equipes)


async def listar_regras_publicadas_ativas(conexao, esquema: str, ciclo_id: str) -> dict[str, dict[str, dict[str, Any]]]:
    existe = await conexao.fetchval(
        """
        select to_regclass($1)
        """,
        f"{esquema}.regras_publicadas",
    )
    if not existe:
        return {}
    linhas = await conexao.fetch(
        f"""
        select
            ciclo_id,
            comissionado_id,
            comissionado_nome,
            regra_tipo,
            versao,
            regra_01,
            regra_02,
            regra_02_ips,
            regra_02_ips_removidos,
            payload,
            motivo,
            comentario,
            publicado_por::text as publicado_por,
            publicado_em
        from {esquema}.regras_publicadas
        where ciclo_id = $1 and ativo = true
        order by comissionado_id, regra_tipo, versao desc
        """,
        ciclo_id,
    )
    regras: dict[str, dict[str, dict[str, Any]]] = {}
    for linha in linhas:
        item = {chave: _serializar(valor) for chave, valor in dict(linha).items()}
        for chave in (str(item.get("comissionado_id") or ""), _texto_chave(item.get("comissionado_nome"))):
            if not chave:
                continue
            regras.setdefault(chave, {})[str(item["regra_tipo"])] = item
    return regras


async def salvar_publicacao_regra(
    conexao,
    esquema: str,
    *,
    ciclo_id: str,
    comissionado_id: str,
    comissionado_nome: str | None,
    regra_tipo: str,
    regra_01: dict[str, Any],
    regra_02: dict[str, Any],
    regra_02_ips: list[dict[str, Any]],
    regra_02_ips_removidos: list[str],
    payload: dict[str, Any],
    motivo: str | None,
    comentario: str | None,
    usuario_id: str | None,
) -> dict[str, Any]:
    await conexao.execute(
        f"""
        update {esquema}.regras_publicadas
        set ativo = false
        where ciclo_id = $1 and comissionado_id = $2 and regra_tipo = $3 and ativo = true
        """,
        ciclo_id,
        comissionado_id,
        regra_tipo,
    )
    versao = await conexao.fetchval(
        f"""
        select coalesce(max(versao), 0) + 1
        from {esquema}.regras_publicadas
        where ciclo_id = $1 and comissionado_id = $2 and regra_tipo = $3
        """,
        ciclo_id,
        comissionado_id,
        regra_tipo,
    )
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.regras_publicadas (
            ciclo_id,
            comissionado_id,
            comissionado_nome,
            regra_tipo,
            versao,
            regra_01,
            regra_02,
            regra_02_ips,
            regra_02_ips_removidos,
            payload,
            motivo,
            comentario,
            publicado_por
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13::uuid)
        returning
            regra_publicada_id::text as id,
            ciclo_id,
            comissionado_id,
            regra_tipo,
            versao,
            ativo,
            publicado_em
        """,
        ciclo_id,
        comissionado_id,
        comissionado_nome,
        regra_tipo,
        versao,
        json.dumps(regra_01),
        json.dumps(regra_02),
        json.dumps(regra_02_ips),
        json.dumps(regra_02_ips_removidos),
        json.dumps(payload),
        motivo,
        comentario,
        usuario_id,
    )
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def obter_configuracao_ciclo(conexao, esquema: str, ciclo_id: str) -> dict[str, Any]:
    existe = await conexao.fetchval("select to_regclass($1)", f"{esquema}.configuracoes_ciclo")
    if not existe:
        return {
            "ciclo_id": ciclo_id,
            "objetivo_repasse_geral": 0,
            "payload": {},
            "fonte": "default_sem_tabela",
        }
    linha = await conexao.fetchrow(
        f"""
        select
            ciclo_id,
            objetivo_repasse_geral,
            payload,
            atualizado_por::text as atualizado_por,
            criado_em,
            atualizado_em
        from {esquema}.configuracoes_ciclo
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    if not linha:
        return {
            "ciclo_id": ciclo_id,
            "objetivo_repasse_geral": 0,
            "payload": {},
            "fonte": "default",
        }
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def salvar_configuracao_ciclo(
    conexao,
    esquema: str,
    *,
    ciclo_id: str,
    objetivo_repasse_geral: Any,
    payload: dict[str, Any] | None = None,
    usuario_id: str | None = None,
) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.configuracoes_ciclo (
            ciclo_id,
            objetivo_repasse_geral,
            payload,
            atualizado_por
        )
        values ($1, $2::numeric, $3::jsonb, $4::uuid)
        on conflict (ciclo_id) do update
        set objetivo_repasse_geral = excluded.objetivo_repasse_geral,
            payload = excluded.payload,
            atualizado_por = excluded.atualizado_por,
            atualizado_em = now()
        returning
            ciclo_id,
            objetivo_repasse_geral,
            payload,
            atualizado_por::text as atualizado_por,
            criado_em,
            atualizado_em
        """,
        ciclo_id,
        objetivo_repasse_geral,
        json.dumps(payload or {}),
        usuario_id,
    )
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def listar_equipes_snapshot_por_ciclo(conexao, esquema: str, ciclo_id: str) -> dict[str, list[dict[str, Any]]]:
    existe = await conexao.fetchval(
        "select to_regclass($1)",
        f"{esquema}.hierarquia_snapshot",
    )
    if not existe:
        return {}
    linhas = await conexao.fetch(
        f"""
        select
            comissionado_id,
            comissionado_nome,
            comissionado_usuario_id::text as comissionado_usuario_id,
            comissionado_funcionario_id::text as comissionado_funcionario_id,
            comissionado_cargo,
            comissionado_perfil,
            comissionado_origem_identidade,
            corretor_nome,
            corretor_tipo,
            corretor_documento,
            corretor_email,
            corretor_usuario_id::text as corretor_usuario_id,
            corretor_funcionario_id::text as corretor_funcionario_id,
            corretor_cargo,
            corretor_status,
            corretor_origem_identidade,
            regiao_corretor,
            imobiliaria_corretor,
            papel,
            gestor_nome,
            coordenador_nome,
            ativo,
            ativo_negocio,
            vinculo_origem
        from {esquema}.hierarquia_snapshot
        where ciclo_id = $1
        order by papel, comissionado_nome, corretor_nome
        """,
        ciclo_id,
    )
    equipes: dict[str, list[dict[str, Any]]] = {}
    vistos: set[tuple[str, str]] = set()
    for linha in linhas:
        item = dict(linha)
        pessoa_id = _preferir_texto(
            item.get("corretor_usuario_id"),
            item.get("corretor_funcionario_id"),
            _documento_chave(item.get("corretor_documento")),
            _email_chave(item.get("corretor_email")),
            item.get("corretor_nome"),
            item.get("corretor_tipo"),
        )
        pessoa = {
            "id": pessoa_id,
            "nome": item.get("corretor_nome") or "-",
            "funcao": item.get("corretor_cargo") or item.get("corretor_tipo") or "Corretor",
            "cidade": item.get("regiao_corretor") or item.get("imobiliaria_corretor") or "-",
            "tipo_comissionado": item.get("corretor_tipo") or "Vinculado",
            "email": item.get("corretor_email"),
            "documento": item.get("corretor_documento"),
            "usuario_id": item.get("corretor_usuario_id"),
            "funcionario_id": item.get("corretor_funcionario_id"),
            "origem_identidade": item.get("corretor_origem_identidade"),
            "vinculo_origem": item.get("vinculo_origem") or "hierarquia",
            "lider_papel": item.get("papel"),
            "gestor_nome": item.get("gestor_nome"),
            "coordenador_nome": item.get("coordenador_nome"),
            "ativo": bool(item.get("ativo")),
            "ativo_negocio": bool(item.get("ativo_negocio")),
            "status": item.get("corretor_status") or "vinculado",
            "valor_bruto": 0,
            "desconto_distrato": 0,
            "valor_liquido": 0,
            "exige_nf": False,
        }
        for chave in (str(item.get("comissionado_id") or ""), _texto_chave(item.get("comissionado_nome"))):
            if chave:
                assinatura = (chave, pessoa_id)
                if assinatura in vistos:
                    continue
                vistos.add(assinatura)
                equipes.setdefault(chave, []).append(pessoa)
    return equipes


def _indexar_identidades(funcionarios: list[dict[str, Any]], usuarios: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    indices: dict[str, dict[str, dict[str, Any]]] = {
        "usuario": {},
        "funcionario": {},
        "documento": {},
        "email": {},
        "nome": {},
    }
    for item in funcionarios:
        identidade = dict(item)
        identidade["origem_identidade"] = "funcionario_acesso"
        for chave, valor in (
            ("usuario", _uuid_texto(identidade.get("identificador_usuario"))),
            ("funcionario", _uuid_texto(identidade.get("identificador_funcionario"))),
            ("documento", _documento_chave(identidade.get("documento"))),
            ("email", _email_chave(identidade.get("email"))),
            ("nome", _texto_chave(identidade.get("nome"))),
        ):
            if valor and valor not in indices[chave]:
                indices[chave][valor] = identidade
    for item in usuarios:
        identidade = {
            "identificador_usuario": item.get("identificador_usuario"),
            "identificador_funcionario": None,
            "documento": None,
            "email": item.get("email"),
            "nome": item.get("nome"),
            "cargo": item.get("perfil_acesso"),
            "perfil_acesso": item.get("perfil_acesso"),
            "tipo_funcionario": "USUARIO",
            "tipo_vinculo": None,
            "regiao": None,
            "regional": None,
            "imobiliaria": None,
            "ativo": item.get("ativo"),
            "ativo_negocio": item.get("ativo"),
            "origem_identidade": "usuario",
        }
        for chave, valor in (
            ("usuario", _uuid_texto(identidade.get("identificador_usuario"))),
            ("email", _email_chave(identidade.get("email"))),
            ("nome", _texto_chave(identidade.get("nome"))),
        ):
            if valor and valor not in indices[chave]:
                indices[chave][valor] = identidade
    return indices


def _resolver_identidade(
    indices: dict[str, dict[str, dict[str, Any]]],
    *,
    nome: Any = None,
    documento: Any = None,
    email: Any = None,
) -> dict[str, Any]:
    identidade = (
        indices["documento"].get(_documento_chave(documento))
        or indices["email"].get(_email_chave(email))
        or indices["nome"].get(_texto_chave(nome))
    )
    if identidade:
        return dict(identidade)
    return {
        "identificador_usuario": None,
        "identificador_funcionario": None,
        "documento": documento,
        "email": email,
        "nome": nome,
        "cargo": None,
        "perfil_acesso": None,
        "tipo_funcionario": None,
        "tipo_vinculo": None,
        "regiao": None,
        "regional": None,
        "imobiliaria": None,
        "ativo": True,
        "ativo_negocio": True,
        "origem_identidade": "dashboard_hierarquia",
    }


def _lider_para_resultado(papel: str, identidade: dict[str, Any]) -> dict[str, Any]:
    return {
        "resultado_id": _resultado_id_produtivo(papel, identidade),
        "funcao": _preferir_texto(identidade.get("cargo"), identidade.get("perfil_acesso"), papel.title(), padrao=papel.title()),
        "cidade": _preferir_texto(identidade.get("regiao"), identidade.get("regional"), identidade.get("imobiliaria"), padrao="Operacional"),
        "nome": _preferir_texto(identidade.get("nome"), padrao="Comissionado sem nome"),
        "tipo_comissionado": "PJ_AUTONOMO",
        "status_nf": "pendente_nf",
        "exige_nf": True,
        "identificador_usuario": identidade.get("identificador_usuario"),
        "identificador_funcionario": identidade.get("identificador_funcionario"),
        "documento": identidade.get("documento"),
        "email": identidade.get("email"),
        "cargo": identidade.get("cargo"),
        "perfil_acesso": identidade.get("perfil_acesso"),
        "papel_comissionamento": papel,
        "origem_identidade": identidade.get("origem_identidade"),
        "validacao_lideranca": _validacao_lideranca(papel, identidade),
    }


async def gerar_snapshot_hierarquia_ciclo(conexao, esquema: str, ciclo_id: str) -> dict[str, Any]:
    if ciclo_id == "2026-06":
        await conexao.execute(
            f"""
            insert into {esquema}.ciclos (
                ciclo_id,
                mes,
                ano,
                rotulo,
                origem,
                status,
                prazo_envio_financeiro,
                prazo_nf_dias
            )
            values ($1, 6, 2026, 'Junho/2026', 'banco_producao', 'calculado', date '2026-07-15', 2)
            on conflict (ciclo_id) do update
            set origem = excluded.origem,
                status = case when {esquema}.ciclos.status = 'calculado_seed' then excluded.status else {esquema}.ciclos.status end,
                atualizado_em = now()
            """,
            ciclo_id,
        )

    ciclo = await conexao.fetchrow(
        f"""
        select ciclo_id, mes, ano
        from {esquema}.ciclos
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    if not ciclo:
        return {"status": "ciclo_nao_encontrado", "ciclo_id": ciclo_id, "linhas": 0}

    referencia = f"{int(ciclo['ano']):04d}-{int(ciclo['mes']):02d}"
    funcionarios = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select
                identificador_funcionario,
                identificador_usuario,
                nome,
                documento,
                email,
                cargo,
                perfil_acesso_padrao as perfil_acesso,
                tipo_funcionario,
                tipo_vinculo,
                regional,
                regiao,
                imobiliaria,
                ativo,
                ativo_negocio,
                gestor,
                gestor_documento,
                gestor_email,
                coordenador,
                coordenador_documento,
                coordenador_email,
                gerente,
                gerente_documento,
                gerente_email
            from sevenlm_connect.funcionario_acesso
            where coalesce(ativo, true) = true
              and coalesce(ativo_negocio, true) = true
            """
        )
    ]
    usuarios = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select
                u.identificador_usuario,
                u.nome_completo as nome,
                u.correio_eletronico as email,
                coalesce(string_agg(distinct p.nome_perfil, ', ' order by p.nome_perfil), '') as perfil_acesso,
                coalesce(u.indicador_ativo, true) as ativo
            from sevenlm_connect.usuario u
            left join sevenlm_connect.usuario_perfil up on up.identificador_usuario = u.identificador_usuario
            left join sevenlm_connect.perfil p on p.identificador_perfil = up.identificador_perfil
            where coalesce(u.indicador_ativo, true) = true
            group by u.identificador_usuario, u.nome_completo, u.correio_eletronico, u.indicador_ativo
            """
        )
    ]
    indices = _indexar_identidades(funcionarios, usuarios)
    dashboard = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select *
            from connect_comercial.dashboard_gc_produtividade_hierarquia
            where left(coalesce(mes_referencia::text, referencia::text, ''::text), 7) = $1
              and lower(coalesce(nullif(trim(ativo::text), ''), 'true')) in ('true', 't', '1', 'sim', 's', 'yes', 'y', 'ativo', 'active')
              and lower(coalesce(nullif(trim(ativo_negocio::text), ''), 'true')) in ('true', 't', '1', 'sim', 's', 'yes', 'y', 'ativo', 'active')
            """,
            referencia,
        )
    ]

    lideres: dict[str, dict[str, Any]] = {}

    def adicionar_lider(papel: str, identidade: dict[str, Any]) -> None:
        if not _eh_lider(identidade.get("nome"), identidade.get("cargo"), identidade.get("perfil_acesso")):
            return
        resultado = _lider_para_resultado(papel, identidade)
        chave = _chave_identidade(
            _uuid_texto(resultado.get("identificador_usuario")),
            _uuid_texto(resultado.get("identificador_funcionario")),
            _documento_chave(resultado.get("documento")),
            _email_chave(resultado.get("email")),
            _texto_chave(resultado.get("nome")),
        )
        atual = lideres.get(chave)
        if not atual or atual.get("origem_identidade") != "funcionario_acesso":
            lideres[chave] = resultado

    for h in dashboard:
        for papel, nome, documento, email in (
            ("gestor", h.get("gerente_nome"), h.get("gerente_documento"), h.get("gerente_email")),
            ("coordenador", h.get("coordenador_nome"), h.get("coordenador_documento"), h.get("coordenador_email")),
        ):
            if _texto_chave(nome) and "vago" not in _texto_chave(nome):
                adicionar_lider(papel, _resolver_identidade(indices, nome=nome, documento=documento, email=email))

    for funcionario in funcionarios:
        if _eh_lider(funcionario.get("nome"), funcionario.get("cargo"), funcionario.get("perfil_acesso")):
            papel = "coordenador" if "coord" in _texto_chave(funcionario.get("cargo")) else "gestor"
            adicionar_lider(papel, {**funcionario, "origem_identidade": "funcionario_acesso"})

    for usuario in usuarios:
        if _eh_lider(usuario.get("nome"), usuario.get("perfil_acesso"), usuario.get("perfil_acesso")):
            adicionar_lider("gestor", _resolver_identidade(indices, nome=usuario.get("nome"), email=usuario.get("email")))

    por_nome: dict[str, dict[str, Any]] = {}
    for item in lideres.values():
        chave_nome = _texto_chave(item.get("nome"))
        atual = por_nome.get(chave_nome)
        if not atual or atual.get("origem_identidade") != "funcionario_acesso":
            por_nome[chave_nome] = item
    resultados = list(por_nome.values())
    ids_resultados = [item["resultado_id"] for item in resultados]
    await conexao.execute(
        f"""
        delete from {esquema}.resultados
        where ciclo_id = $1
          and origem = 'banco_producao_identidade'
          and not (resultado_id = any($2::text[]))
        """,
        ciclo_id,
        ids_resultados,
    )
    await conexao.executemany(
        f"""
        insert into {esquema}.resultados (
            resultado_id,
            ciclo_id,
            funcao,
            cidade,
            nome,
            tipo_comissionado,
            valor_bruto,
            desconto_distrato,
            status,
            status_nf,
            status_financeiro,
            status_pagamento,
            exige_nf,
            origem,
            identificador_usuario,
            identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade,
            validacao_lideranca
        )
        values (
            $1, $2, $3, $4, $5, $6, 0, 0, 'calculado', $7, 'nao_enviado', 'nao_enviado', $8,
            'banco_producao_identidade', $9::uuid, $10::uuid, $11, $12, $13, $14, $15, $16, $17::jsonb
        )
        on conflict (resultado_id) do update
        set funcao = excluded.funcao,
            cidade = excluded.cidade,
            nome = excluded.nome,
            tipo_comissionado = excluded.tipo_comissionado,
            status_nf = case
                when {esquema}.resultados.status in ('calculado', 'calculado_seed') then excluded.status_nf
                else {esquema}.resultados.status_nf
            end,
            exige_nf = excluded.exige_nf,
            origem = excluded.origem,
            identificador_usuario = excluded.identificador_usuario,
            identificador_funcionario = excluded.identificador_funcionario,
            documento = excluded.documento,
            email = excluded.email,
            cargo = excluded.cargo,
            perfil_acesso = excluded.perfil_acesso,
            papel_comissionamento = excluded.papel_comissionamento,
            origem_identidade = excluded.origem_identidade,
            validacao_lideranca = excluded.validacao_lideranca,
            atualizado_em = now()
        """,
        [
            (
                item["resultado_id"],
                ciclo_id,
                item["funcao"],
                item["cidade"],
                item["nome"],
                item["tipo_comissionado"],
                item["status_nf"],
                item["exige_nf"],
                item["identificador_usuario"],
                item["identificador_funcionario"],
                item["documento"],
                item["email"],
                item["cargo"],
                item["perfil_acesso"],
                item["papel_comissionamento"],
                item["origem_identidade"],
                json.dumps(item["validacao_lideranca"], ensure_ascii=False),
            )
            for item in resultados
        ],
    )

    await conexao.execute(f"delete from {esquema}.hierarquia_snapshot where ciclo_id = $1", ciclo_id)
    linhas_snapshot: list[tuple[Any, ...]] = []

    def adicionar_snapshot(
        *,
        papel: str,
        lider_nome: Any,
        lider_documento: Any,
        lider_email: Any,
        vinculado_nome: Any,
        vinculado_documento: Any = None,
        vinculado_email: Any = None,
        vinculado_tipo: Any = None,
        vinculado_key: Any = None,
        regiao: Any = None,
        imobiliaria: Any = None,
        gestor_nome: Any = None,
        gestor_documento: Any = None,
        gestor_email: Any = None,
        coordenador_nome: Any = None,
        coordenador_documento: Any = None,
        coordenador_email: Any = None,
        origem_json: Any = None,
        vinculo_origem: str = "dashboard_hierarquia",
    ) -> None:
        if not _texto_chave(lider_nome) or "vago" in _texto_chave(lider_nome):
            return
        if not _texto_chave(vinculado_nome) or _texto_chave(vinculado_nome) == _texto_chave(lider_nome):
            return
        lider = _resolver_identidade(indices, nome=lider_nome, documento=lider_documento, email=lider_email)
        if not _eh_lider(lider.get("nome"), lider.get("cargo"), lider.get("perfil_acesso")):
            return
        vinculado = _resolver_identidade(indices, nome=vinculado_nome, documento=vinculado_documento, email=vinculado_email)
        comissionado_id = _resultado_id_produtivo(papel, lider)
        linhas_snapshot.append(
            (
                ciclo_id,
                referencia,
                papel,
                comissionado_id,
                _preferir_texto(lider.get("nome"), lider_nome),
                _preferir_texto(lider.get("documento"), lider_documento),
                _preferir_texto(lider.get("email"), lider_email),
                gestor_nome,
                gestor_documento,
                gestor_email,
                coordenador_nome,
                coordenador_documento,
                coordenador_email,
                _preferir_texto(vinculado.get("nome"), vinculado_nome),
                _preferir_texto(vinculado_tipo, vinculado.get("tipo_funcionario"), vinculado.get("cargo"), padrao="Vinculado"),
                _preferir_texto(vinculado_key, vinculado.get("documento"), vinculado.get("email"), vinculado_nome),
                None,
                _preferir_texto(regiao, vinculado.get("regiao"), vinculado.get("regional")),
                _preferir_texto(imobiliaria, vinculado.get("imobiliaria")),
                bool(vinculado.get("ativo", True)),
                bool(vinculado.get("ativo_negocio", True)),
                json.dumps(origem_json or {}, default=str),
                lider.get("identificador_usuario"),
                lider.get("identificador_funcionario"),
                lider.get("cargo"),
                lider.get("perfil_acesso"),
                lider.get("origem_identidade"),
                vinculado.get("identificador_usuario"),
                vinculado.get("identificador_funcionario"),
                _preferir_texto(vinculado.get("documento"), vinculado_documento),
                _preferir_texto(vinculado.get("email"), vinculado_email),
                vinculado.get("cargo"),
                "ativo" if bool(vinculado.get("ativo", True)) else "inativo",
                vinculado.get("origem_identidade"),
                vinculo_origem,
            )
        )

    for h in dashboard:
        for papel, lider_nome, lider_documento, lider_email in (
            ("gestor", h.get("gerente_nome"), h.get("gerente_documento"), h.get("gerente_email")),
            ("coordenador", h.get("coordenador_nome"), h.get("coordenador_documento"), h.get("coordenador_email")),
        ):
            adicionar_snapshot(
                papel=papel,
                lider_nome=lider_nome,
                lider_documento=lider_documento,
                lider_email=lider_email,
                vinculado_nome=h.get("corretor_ativo_nome"),
                vinculado_tipo=h.get("tipo_corretor"),
                vinculado_key=h.get("corretor_hierarquia_key") or h.get("corretor_ativo_mes_key"),
                regiao=h.get("regiao_corretor"),
                imobiliaria=h.get("imobiliaria_corretor"),
                gestor_nome=h.get("gerente_nome"),
                gestor_documento=h.get("gerente_documento"),
                gestor_email=h.get("gerente_email"),
                coordenador_nome=h.get("coordenador_nome"),
                coordenador_documento=h.get("coordenador_documento"),
                coordenador_email=h.get("coordenador_email"),
                origem_json=h,
                vinculo_origem="dashboard_hierarquia",
            )

    for vinculado in funcionarios:
        for papel, lider_nome, lider_documento, lider_email in (
            ("gestor", vinculado.get("gestor"), vinculado.get("gestor_documento"), vinculado.get("gestor_email")),
            ("coordenador", vinculado.get("coordenador"), vinculado.get("coordenador_documento"), vinculado.get("coordenador_email")),
            ("gestor", vinculado.get("gerente"), vinculado.get("gerente_documento"), vinculado.get("gerente_email")),
        ):
            adicionar_snapshot(
                papel=papel,
                lider_nome=lider_nome,
                lider_documento=lider_documento,
                lider_email=lider_email,
                vinculado_nome=vinculado.get("nome"),
                vinculado_documento=vinculado.get("documento"),
                vinculado_email=vinculado.get("email"),
                vinculado_tipo=vinculado.get("tipo_funcionario"),
                vinculado_key=vinculado.get("documento") or vinculado.get("email"),
                regiao=vinculado.get("regiao") or vinculado.get("regional"),
                imobiliaria=vinculado.get("imobiliaria"),
                gestor_nome=vinculado.get("gestor") or vinculado.get("gerente"),
                gestor_documento=vinculado.get("gestor_documento") or vinculado.get("gerente_documento"),
                gestor_email=vinculado.get("gestor_email") or vinculado.get("gerente_email"),
                coordenador_nome=vinculado.get("coordenador"),
                coordenador_documento=vinculado.get("coordenador_documento"),
                coordenador_email=vinculado.get("coordenador_email"),
                origem_json=vinculado,
                vinculo_origem="funcionario_acesso",
            )

    comando = "INSERT 0 0"
    if linhas_snapshot:
        comando = await conexao.executemany(
            f"""
            insert into {esquema}.hierarquia_snapshot (
                ciclo_id,
                mes_referencia,
                papel,
                comissionado_id,
                comissionado_nome,
                comissionado_documento,
                comissionado_email,
                gestor_nome,
                gestor_documento,
                gestor_email,
                coordenador_nome,
                coordenador_documento,
                coordenador_email,
                corretor_nome,
                corretor_tipo,
                corretor_hierarquia_key,
                corretor_ativo_mes_key,
                regiao_corretor,
                imobiliaria_corretor,
                ativo,
                ativo_negocio,
                origem_json,
                comissionado_usuario_id,
                comissionado_funcionario_id,
                comissionado_cargo,
                comissionado_perfil,
                comissionado_origem_identidade,
                corretor_usuario_id,
                corretor_funcionario_id,
                corretor_documento,
                corretor_email,
                corretor_cargo,
                corretor_status,
                corretor_origem_identidade,
                vinculo_origem
            )
            values (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19,
                $20, $21, $22::jsonb,
                $23::uuid, $24::uuid, $25, $26, $27,
                $28::uuid, $29::uuid, $30, $31, $32, $33, $34, $35
            )
            on conflict do nothing
            """,
            linhas_snapshot,
        )

    linhas = len(linhas_snapshot)
    resultados_total = await conexao.fetchval(
        f"select count(*) from {esquema}.resultados where ciclo_id = $1",
        ciclo_id,
    )
    vinculados_distintos = await conexao.fetchval(
        f"""
        select count(distinct coalesce(corretor_usuario_id::text, corretor_funcionario_id::text, corretor_documento, corretor_email, corretor_nome))
        from {esquema}.hierarquia_snapshot
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    total_gestores = await conexao.fetchval(
        f"select count(distinct comissionado_id) from {esquema}.hierarquia_snapshot where ciclo_id = $1 and papel = 'gestor'",
        ciclo_id,
    )
    total_coordenadores = await conexao.fetchval(
        f"select count(distinct comissionado_id) from {esquema}.hierarquia_snapshot where ciclo_id = $1 and papel = 'coordenador'",
        ciclo_id,
    )
    return {
        "status": "snapshot_gerado",
        "ciclo_id": ciclo_id,
        "referencia": referencia,
        "linhas": linhas,
        "resultados": resultados_total or 0,
        "vinculados_distintos": vinculados_distintos or 0,
        "gestores": total_gestores or 0,
        "coordenadores": total_coordenadores or 0,
        "origens": ["funcionario_acesso", "usuario", "dashboard_hierarquia"],
        "detalhe": comando,
    }

async def listar_ciclos(conexao, esquema: str) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            ciclo_id,
            mes,
            ano,
            rotulo,
            origem,
            status,
            prazo_envio_financeiro,
            prazo_nf_dias
        from {esquema}.ciclos
        order by ano desc, mes desc
        """
    )
    return [{chave: _serializar(valor) for chave, valor in dict(linha).items()} for linha in linhas]


async def buscar_resultado_por_id(conexao, esquema: str, resultado_id: str) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        select
            row_number() over (order by resultado_id) as indice,
            resultado_id as id,
            ciclo_id,
            funcao,
            cidade,
            nome,
            tipo_comissionado,
            valor_bruto,
            desconto_distrato,
            valor_liquido,
            status,
            status_nf,
            status_financeiro,
            status_pagamento,
            exige_nf,
            origem,
            identificador_usuario::text as identificador_usuario,
            identificador_funcionario::text as identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade,
            validacao_lideranca
        from {esquema}.resultados
        where resultado_id = $1
        """,
        resultado_id,
    )
    if not linha:
        return None
    registro = serializar_linha_resultado({chave: valor for chave, valor in dict(linha).items() if chave != "indice"})
    preview = await enriquecer_preview(conexao, esquema, {"registros": [registro]})
    regras = await listar_regras_publicadas_ativas(conexao, esquema, registro.get("ciclo_id"))
    equipes = await listar_equipes_snapshot_por_ciclo(conexao, esquema, registro.get("ciclo_id"))
    aplicado = _aplicar_regras_e_hierarquia_publicadas(preview, regras, equipes)
    return aplicado["registros"][0]


async def buscar_resultado_linha(conexao, esquema: str, resultado_id: str):
    return await conexao.fetchrow(
        f"""
        select
            resultado_id as id,
            ciclo_id,
            funcao,
            cidade,
            nome,
            tipo_comissionado,
            valor_bruto,
            desconto_distrato,
            valor_liquido,
            status,
            status_nf,
            status_financeiro,
            status_pagamento,
            exige_nf,
            origem,
            identificador_usuario::text as identificador_usuario,
            identificador_funcionario::text as identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade,
            validacao_lideranca
        from {esquema}.resultados
        where resultado_id = $1
        """,
        resultado_id,
    )


def serializar_linha_resultado(linha) -> dict[str, Any]:
    registro = {chave: _serializar(valor) for chave, valor in dict(linha).items()}
    registro["codigo_comissao"] = registro.get("codigo_comissao") or _codigo_comissao(
        registro.get("ciclo_id"),
        registro.get("id") or registro.get("resultado_id"),
    )
    return registro


async def enriquecer_registro_unico(conexao, esquema: str, registro: dict[str, Any]) -> dict[str, Any]:
    preview = await enriquecer_preview(conexao, esquema, {"registros": [registro]})
    return preview["registros"][0]


async def atualizar_status_resultado(
    conexao,
    esquema: str,
    resultado_id: str,
    *,
    status: str | None = None,
    status_nf: str | None = None,
    status_financeiro: str | None = None,
    status_pagamento: str | None = None,
) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        update {esquema}.resultados
        set
            status = coalesce($2, status),
            status_nf = coalesce($3, status_nf),
            status_financeiro = coalesce($4, status_financeiro),
            status_pagamento = coalesce($5, status_pagamento),
            atualizado_em = now()
        where resultado_id = $1
        returning
            resultado_id as id,
            ciclo_id,
            funcao,
            cidade,
            nome,
            tipo_comissionado,
            valor_bruto,
            desconto_distrato,
            valor_liquido,
            status,
            status_nf,
            status_financeiro,
            status_pagamento,
            exige_nf,
            origem,
            identificador_usuario::text as identificador_usuario,
            identificador_funcionario::text as identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade
        """,
        resultado_id,
        status,
        status_nf,
        status_financeiro,
        status_pagamento,
    )
    if not linha:
        return None
    return await enriquecer_registro_unico(conexao, esquema, serializar_linha_resultado(linha))


async def buscar_resposta_idempotente(conexao, esquema: str, chave: str | None, rota: str) -> dict[str, Any] | None:
    if not chave:
        return None
    linha = await conexao.fetchrow(
        f"""
        select resposta_json
        from {esquema}.idempotency_keys
        where chave = $1 and rota = $2
        """,
        chave,
        rota,
    )
    if not linha:
        return None
    return _json_objeto(linha["resposta_json"])


async def salvar_resposta_idempotente(
    conexao,
    esquema: str,
    *,
    chave: str | None,
    rota: str,
    usuario_id: str | None,
    resposta: dict[str, Any],
) -> None:
    if not chave:
        return
    await conexao.execute(
        f"""
        insert into {esquema}.idempotency_keys (chave, rota, usuario_id, resposta_json)
        values ($1, $2, $3::uuid, $4::jsonb)
        on conflict (chave) do nothing
        """,
        chave,
        rota,
        usuario_id,
        json.dumps(resposta),
    )


async def registrar_evento_comissionamento(
    conexao,
    esquema: str,
    *,
    tipo_evento: str,
    usuario_id: str | None,
    sessao_id: str | None,
    endereco_ip: str,
    agente_do_usuario: str,
    antes: dict[str, Any] | None = None,
    depois: dict[str, Any] | None = None,
    comentario: str | None = None,
    regra: str | None = None,
    campo: str | None = None,
    documento_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    antes = antes or {}
    depois = depois or {}
    ciclo_id = depois.get("ciclo_id") or antes.get("ciclo_id")
    resultado_id = depois.get("id") or antes.get("id") or depois.get("resultado_id") or antes.get("resultado_id")
    nome = depois.get("nome") or antes.get("nome")
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.eventos (
            ciclo_id,
            resultado_id,
            comissionado_id,
            comissionado_nome,
            tipo_evento,
            status_anterior,
            status_novo,
            status_nf_anterior,
            status_nf_novo,
            status_financeiro_anterior,
            status_financeiro_novo,
            status_pagamento_anterior,
            status_pagamento_novo,
            regra,
            campo,
            valor_anterior,
            valor_novo,
            documento_id,
            comentario,
            payload_antes,
            payload_depois,
            idempotency_key,
            usuario_id,
            sessao_id,
            endereco_ip,
            agente_do_usuario
        )
        values (
            $1, $2, $2, $3, $4,
            $5, $6, $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17::uuid, $18,
            $19::jsonb, $20::jsonb, $21, $22::uuid, $23::uuid, $24, $25
        )
        returning evento_id::text as id, criado_em
        """,
        ciclo_id,
        resultado_id,
        nome,
        tipo_evento,
        antes.get("status"),
        depois.get("status"),
        antes.get("status_nf"),
        depois.get("status_nf"),
        antes.get("status_financeiro"),
        depois.get("status_financeiro"),
        antes.get("status_pagamento"),
        depois.get("status_pagamento"),
        regra,
        campo,
        antes.get("valor_liquido"),
        depois.get("valor_liquido"),
        documento_id,
        comentario,
        json.dumps(antes),
        json.dumps(depois),
        idempotency_key,
        usuario_id,
        sessao_id,
        endereco_ip,
        agente_do_usuario,
    )
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def salvar_documento_nf(
    conexao,
    esquema: str,
    *,
    resultado: dict[str, Any],
    nome_arquivo: str,
    content_type: str,
    conteudo: bytes | None,
    tamanho_bytes: int,
    numero_nf: str,
    data_emissao: date,
    valor_nf: Decimal,
    observacao: str | None,
    usuario_id: str | None,
) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.documentos (
            resultado_id,
            ciclo_id,
            tipo_documento,
            nome_arquivo,
            content_type,
            tamanho_bytes,
            numero_nf,
            data_emissao,
            valor_nf,
        observacao,
        conteudo,
        usuario_id
    )
        values ($1, $2, 'nota_fiscal', $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)
        returning
            documento_id::text,
            resultado_id,
            ciclo_id,
            tipo_documento,
            nome_arquivo,
            content_type,
            tamanho_bytes,
            numero_nf,
            data_emissao,
            valor_nf,
            observacao,
            status_documento,
            criado_em
        """,
        resultado["id"],
        resultado["ciclo_id"],
        nome_arquivo,
        content_type,
        tamanho_bytes if tamanho_bytes is not None else len(conteudo or b""),
        numero_nf,
        data_emissao,
        valor_nf,
        observacao,
        conteudo,
        usuario_id,
    )
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def listar_eventos_auditoria_comissionamento(
    conexao,
    *,
    ciclo_id: str | None = None,
    resultado_id: str | None = None,
    limite: int = 200,
) -> list[dict[str, Any]]:
    filtros_proprios = ["1=1"]
    parametros_proprios: list[Any] = []
    if ciclo_id:
        parametros_proprios.append(ciclo_id)
        filtros_proprios.append(f"ciclo_id = ${len(parametros_proprios)}")
    if resultado_id:
        parametros_proprios.append(resultado_id)
        filtros_proprios.append(f"resultado_id = ${len(parametros_proprios)}")
    parametros_proprios.append(limite)
    linhas_proprias = await conexao.fetch(
        f"""
        select
            e.evento_id::text as id,
            e.ciclo_id,
            e.resultado_id,
            e.comissionado_nome,
            e.tipo_evento,
            e.status_anterior,
            e.status_novo,
            e.status_nf_anterior,
            e.status_nf_novo,
            e.status_financeiro_anterior,
            e.status_financeiro_novo,
            e.status_pagamento_anterior,
            e.status_pagamento_novo,
            e.regra,
            e.campo,
            e.valor_anterior,
            e.valor_novo,
            e.documento_id::text as documento_id,
            d.numero_nf,
            d.data_emissao as nf_data_emissao,
            d.nome_arquivo as nf_nome_arquivo,
            d.observacao as nf_observacao,
            e.comentario,
            e.payload_antes,
            e.payload_depois,
            e.usuario_id::text as usuario_id,
            coalesce(u.nome_completo, e.usuario_id::text, 'Sistema') as usuario_nome,
            u.correio_eletronico::text as usuario_email,
            perfis.usuario_perfil,
            notif.correlation_id,
            notif.templates_email,
            notif.destinatarios_email,
            notif.status_envio_email,
            e.criado_em
        from comissionamento.eventos e
        left join sevenlm_connect.usuario u
          on u.identificador_usuario = e.usuario_id
        left join lateral (
            select string_agg(p.nome_perfil, ', ' order by p.nome_perfil) as usuario_perfil
            from sevenlm_connect.usuario_perfil up
            join sevenlm_connect.perfil p
              on p.identificador_perfil = up.identificador_perfil
            where up.identificador_usuario = e.usuario_id
        ) perfis on true
        left join comissionamento.documentos d
          on d.documento_id = e.documento_id
        left join lateral (
            select
                max(ne.correlation_id) as correlation_id,
                string_agg(distinct f.template_codigo || ' v' || f.template_versao::text, ', ') as templates_email,
                string_agg(distinct f.destinatario_email, ', ') as destinatarios_email,
                string_agg(distinct f.status, ', ') as status_envio_email
            from comissionamento.notificacao_eventos ne
            left join comissionamento.notificacao_fila_envio f
              on f.evento_id = ne.evento_id
            where ne.evento_negocio_id = e.evento_id::text
               or ne.idempotency_key = e.idempotency_key
        ) notif on true
        where {' and '.join(filtros_proprios).replace('ciclo_id', 'e.ciclo_id').replace('resultado_id', 'e.resultado_id')}
        order by e.criado_em desc
        limit ${len(parametros_proprios)}
        """,
        *parametros_proprios,
    )
    eventos_proprios = [
        {
            "id": linha["id"],
            "tipo_evento": linha["tipo_evento"],
            "ciclo_id": linha["ciclo_id"],
            "resultado_id": linha["resultado_id"],
            "codigo_comissao": _codigo_comissao(linha["ciclo_id"], linha["resultado_id"]),
            "comissionado_nome": linha["comissionado_nome"],
            "etapa_anterior": linha["status_anterior"],
            "etapa_nova": linha["status_novo"],
            "status_nf_anterior": linha["status_nf_anterior"],
            "status_nf": linha["status_nf_novo"],
            "status_financeiro_anterior": linha["status_financeiro_anterior"],
            "status_financeiro": linha["status_financeiro_novo"],
            "status_pagamento_anterior": linha["status_pagamento_anterior"],
            "status_pagamento": linha["status_pagamento_novo"],
            "regra": linha["regra"],
            "campo": linha["campo"],
            "valor_anterior": _serializar(linha["valor_anterior"]),
            "valor_novo": _serializar(linha["valor_novo"]),
            "documento_id": linha["documento_id"],
            "nf_numero": linha["numero_nf"],
            "nf_data_emissao": _serializar(linha["nf_data_emissao"]),
            "nf_nome_arquivo": linha["nf_nome_arquivo"],
            "nf_observacao": linha["nf_observacao"],
            "comentario": linha["comentario"],
            "payload": {
                "antes": _json_objeto(linha["payload_antes"]),
                "depois": _json_objeto(linha["payload_depois"]),
            },
            "responsavel": linha["usuario_nome"] or "Sistema",
            "usuario_nome": linha["usuario_nome"] or "Sistema",
            "usuario_email": linha["usuario_email"],
            "usuario_perfil": linha["usuario_perfil"],
            "usuario_id": linha["usuario_id"],
            "correlation_id": linha["correlation_id"],
            "templates_email": linha["templates_email"],
            "destinatarios_email": linha["destinatarios_email"],
            "status_envio_email": linha["status_envio_email"],
            "criado_em": _serializar(linha["criado_em"]),
        }
        for linha in linhas_proprias
    ]
    if eventos_proprios:
        return eventos_proprios

    filtros = ["tipo_evento like 'comissionamento.%'"]
    parametros: list[Any] = []
    if ciclo_id:
        parametros.append(ciclo_id)
        filtros.append(f"(detalhes_evento->>'ciclo_id' = ${len(parametros)} or detalhes_evento->'payload'->>'ciclo_id' = ${len(parametros)})")
    if resultado_id:
        parametros.append(resultado_id)
        filtros.append(
            f"(detalhes_evento->>'resultado_id' = ${len(parametros)} "
            f"or detalhes_evento->>'comissionado_id' = ${len(parametros)} "
            f"or detalhes_evento->'payload'->>'resultado_id' = ${len(parametros)} "
            f"or detalhes_evento->'payload'->>'comissionado_id' = ${len(parametros)})"
        )
    parametros.append(limite)
    linhas = await conexao.fetch(
        f"""
        select
            identificador_evento::text as id,
            tipo_evento,
            descricao_evento,
            detalhes_evento,
            data_hora_evento,
            identificador_usuario::text as usuario_id
        from system.auditoria_evento
        where {' and '.join(filtros)}
        order by data_hora_evento desc
        limit ${len(parametros)}
        """,
        *parametros,
    )
    eventos: list[dict[str, Any]] = []
    for linha in linhas:
        detalhes = _detalhes_evento(linha["detalhes_evento"])
        payload = detalhes.get("payload") or detalhes
        eventos.append(
            {
                "id": linha["id"],
                "tipo_evento": detalhes.get("tipo_evento_ui") or linha["tipo_evento"].replace("comissionamento.", ""),
                "descricao": linha["descricao_evento"],
                "payload": payload,
                "ciclo_id": detalhes.get("ciclo_id") or payload.get("ciclo_id"),
                "resultado_id": detalhes.get("resultado_id") or detalhes.get("comissionado_id") or payload.get("resultado_id") or payload.get("comissionado_id"),
                "comissionado_nome": detalhes.get("comissionado_nome") or payload.get("comissionado_nome"),
                "regra": detalhes.get("regra") or payload.get("regra"),
                "campo": detalhes.get("campo") or payload.get("campo"),
                "valor_anterior": detalhes.get("valor_anterior") or payload.get("valor_anterior"),
                "valor_novo": detalhes.get("valor_novo") or payload.get("valor_novo"),
                "responsavel": detalhes.get("responsavel") or "Sistema",
                "usuario_id": linha["usuario_id"],
                "criado_em": _serializar(linha["data_hora_evento"]),
                "comentario": detalhes.get("comentario") or detalhes.get("motivo") or payload.get("comentario"),
            }
        )
    return eventos
