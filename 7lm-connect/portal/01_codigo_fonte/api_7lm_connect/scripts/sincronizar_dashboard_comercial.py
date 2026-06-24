"""
Sincroniza o data mart do Dashboard Comercial para o banco do 7LM Connect.

A fonte e somente leitura. A carga no destino usa tabelas temporarias e
promocao transacional para evitar que o dashboard veja dados parciais.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import asyncpg


API_DIR = Path(__file__).resolve().parents[1]
PORTAL_ROOT = API_DIR.parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from configuracoes import (  # noqa: E402
    ESQUEMA_COMERCIAL,
    NOME_BANCO,
    PORTA_BANCO,
    SENHA_BANCO,
    SERVIDOR_BANCO,
    USUARIO_BANCO,
)


TABELAS_SINCRONIZADAS = (
    "comercial_base",
    "comercial_propostas_historico",
    "comercial_propostas_consolidada",
    "comercial_cancelamentos",
    "comercial_distratos",
    "dim_corretor",
    "dim_empreendimento",
    "hierarquia_cvcrm",
)

TABELAS_CRITICAS = {
    "comercial_base",
    "comercial_propostas_historico",
    "comercial_propostas_consolidada",
    "dim_corretor",
    "dim_empreendimento",
    "hierarquia_cvcrm",
}

LOCK_ID = 740107013
BATCH_SIZE = 5000


def _quote_ident(valor: str) -> str:
    return '"' + str(valor).replace('"', '""') + '"'


def _qualificar(schema: str, tabela: str) -> str:
    return f"{_quote_ident(schema)}.{_quote_ident(tabela)}"


def _ler_arquivo_env(caminho: Path) -> dict[str, str]:
    valores: dict[str, str] = {}
    if not caminho.exists():
        return valores
    for linha_bruta in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha_bruta.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valores[chave.strip()] = valor.strip().strip("'").strip('"')
    return valores


def _carregar_configuracao_fonte(caminho_informado: str | None = None) -> dict[str, Any]:
    candidatos: list[Path] = []
    for valor in (
        caminho_informado,
        os.getenv("SEVENLM_CONNECT_DASHBOARD_COMERCIAL_SOURCE_ENV"),
        os.getenv("DASHBOARD_COMERCIAL_SOURCE_ENV"),
    ):
        if valor:
            candidatos.append(Path(valor).expanduser())

    candidatos.extend(
        [
            PORTAL_ROOT / ".dashboard_comercial_source.env",
            PORTAL_ROOT / "Servidor" / "Servidor_dados.txt",
        ]
    )

    arquivo_env: dict[str, str] = {}
    for caminho in candidatos:
        if caminho.exists():
            arquivo_env = _ler_arquivo_env(caminho)
            break

    def pegar(*nomes: str, obrigatorio: bool = True, padrao: str | None = None) -> str | None:
        for nome in nomes:
            valor = os.getenv(nome)
            if valor:
                return valor
            valor = arquivo_env.get(nome)
            if valor:
                return valor
        if obrigatorio:
            raise RuntimeError(f"Configuracao da fonte ausente: {'/'.join(nomes)}")
        return padrao

    return {
        "user": pegar("DASHBOARD_COMERCIAL_SOURCE_DBUSER", "DB_USER"),
        "password": pegar("DASHBOARD_COMERCIAL_SOURCE_DBPASS", "DB_PASSWORD"),
        "host": pegar("DASHBOARD_COMERCIAL_SOURCE_DBHOST", "DB_HOST"),
        "port": int(pegar("DASHBOARD_COMERCIAL_SOURCE_DBPORT", "DB_PORT", padrao="5432") or 5432),
        "database": pegar("DASHBOARD_COMERCIAL_SOURCE_DBNAME", "DB_NAME"),
        "schema": pegar(
            "DASHBOARD_COMERCIAL_SOURCE_SCHEMA",
            "DB_SCHEMA",
            obrigatorio=False,
            padrao="public",
        )
        or "public",
    }


async def _conectar_fonte(config: dict[str, Any]) -> asyncpg.Connection:
    return await asyncpg.connect(
        user=config["user"],
        password=config["password"],
        host=config["host"],
        port=config["port"],
        database=config["database"],
        timeout=30,
        command_timeout=300,
        server_settings={"application_name": "7lm_dashboard_comercial_sync_source"},
    )


async def _conectar_destino() -> asyncpg.Connection:
    return await asyncpg.connect(
        user=USUARIO_BANCO,
        password=SENHA_BANCO,
        host=SERVIDOR_BANCO,
        port=PORTA_BANCO,
        database=NOME_BANCO,
        timeout=30,
        command_timeout=300,
        server_settings={"application_name": "7lm_dashboard_comercial_sync_target"},
    )


async def _colunas(conn: asyncpg.Connection, schema: str, tabela: str) -> list[dict[str, Any]]:
    linhas = await conn.fetch(
        """
        select
            a.attname as nome,
            pg_catalog.format_type(a.atttypid, a.atttypmod) as tipo,
            a.attnotnull as obrigatoria,
            a.attnum as ordem
        from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1
          and c.relname = $2
          and a.attnum > 0
          and not a.attisdropped
        order by a.attnum
        """,
        schema,
        tabela,
    )
    return [dict(linha) for linha in linhas]


async def _tabela_existe(conn: asyncpg.Connection, schema: str, tabela: str) -> bool:
    return bool(await conn.fetchval("select to_regclass($1)", f"{schema}.{tabela}"))


async def _garantir_tabela_destino(
    destino: asyncpg.Connection,
    schema_destino: str,
    tabela: str,
    colunas_fonte: list[dict[str, Any]],
) -> None:
    await destino.execute(f"create schema if not exists {_quote_ident(schema_destino)}")

    qualificada = _qualificar(schema_destino, tabela)
    if not await _tabela_existe(destino, schema_destino, tabela):
        definicoes = ", ".join(
            f"{_quote_ident(coluna['nome'])} {coluna['tipo']}"
            for coluna in colunas_fonte
        )
        await destino.execute(f"create table {qualificada} ({definicoes})")

    colunas_destino = {coluna["nome"] for coluna in await _colunas(destino, schema_destino, tabela)}
    for coluna in colunas_fonte:
        if coluna["nome"] in colunas_destino:
            continue
        await destino.execute(
            f"alter table {qualificada} add column {_quote_ident(coluna['nome'])} {coluna['tipo']}"
        )


async def _garantir_log(destino: asyncpg.Connection, schema_destino: str) -> None:
    await destino.execute(f"create schema if not exists {_quote_ident(schema_destino)}")
    await destino.execute(
        f"""
        create table if not exists {_qualificar(schema_destino, "dashboard_comercial_sync_log")} (
            id bigserial primary key,
            started_at timestamptz not null default now(),
            finished_at timestamptz,
            status text not null,
            source_schema text not null,
            target_schema text not null,
            table_counts jsonb not null default '{{}}'::jsonb,
            duration_seconds numeric(12,3),
            message text
        )
        """
    )


async def _registrar_inicio(
    destino: asyncpg.Connection,
    schema_destino: str,
    schema_fonte: str,
) -> int:
    await _garantir_log(destino, schema_destino)
    return int(
        await destino.fetchval(
            f"""
            insert into {_qualificar(schema_destino, "dashboard_comercial_sync_log")}
                (status, source_schema, target_schema)
            values ('running', $1, $2)
            returning id
            """,
            schema_fonte,
            schema_destino,
        )
    )


async def _registrar_fim(
    destino: asyncpg.Connection,
    schema_destino: str,
    log_id: int,
    status: str,
    contagens: dict[str, Any],
    duracao: float,
    mensagem: str,
) -> None:
    await destino.execute(
        f"""
        update {_qualificar(schema_destino, "dashboard_comercial_sync_log")}
           set finished_at = now(),
               status = $2,
               table_counts = $3::jsonb,
               duration_seconds = $4,
               message = $5
         where id = $1
        """,
        log_id,
        status,
        json.dumps(contagens, ensure_ascii=True, default=str),
        duracao,
        mensagem[:2000],
    )


async def _copiar_tabela(
    fonte: asyncpg.Connection,
    destino: asyncpg.Connection,
    schema_fonte: str,
    schema_destino: str,
    tabela: str,
) -> dict[str, int]:
    colunas_fonte = await _colunas(fonte, schema_fonte, tabela)
    if not colunas_fonte:
        raise RuntimeError(f"Tabela fonte sem colunas ou inexistente: {schema_fonte}.{tabela}")

    await _garantir_tabela_destino(destino, schema_destino, tabela, colunas_fonte)
    colunas_destino = {coluna["nome"] for coluna in await _colunas(destino, schema_destino, tabela)}
    nomes_colunas = [coluna["nome"] for coluna in colunas_fonte if coluna["nome"] in colunas_destino]
    if not nomes_colunas:
        raise RuntimeError(f"Nenhuma coluna compativel para {tabela}")

    total_fonte = int(await fonte.fetchval(f"select count(*)::bigint from {_qualificar(schema_fonte, tabela)}"))
    if tabela in TABELAS_CRITICAS and total_fonte <= 0:
        raise RuntimeError(f"Carga abortada: tabela critica vazia na fonte ({tabela})")

    tabela_temp = f"tmp_sync_{tabela}"
    lista_colunas = ", ".join(_quote_ident(coluna) for coluna in nomes_colunas)
    await destino.execute(
        f"""
        create temp table {_quote_ident(tabela_temp)}
        (like {_qualificar(schema_destino, tabela)} including defaults)
        on commit drop
        """
    )

    inseridos = 0
    consulta = f"select {lista_colunas} from {_qualificar(schema_fonte, tabela)}"
    async with fonte.transaction(readonly=True):
        cursor = fonte.cursor(consulta, prefetch=BATCH_SIZE)
        lote: list[tuple[Any, ...]] = []
        async for linha in cursor:
            lote.append(tuple(linha[coluna] for coluna in nomes_colunas))
            if len(lote) >= BATCH_SIZE:
                await destino.copy_records_to_table(
                    tabela_temp,
                    records=lote,
                    columns=nomes_colunas,
                )
                inseridos += len(lote)
                lote.clear()
        if lote:
            await destino.copy_records_to_table(
                tabela_temp,
                records=lote,
                columns=nomes_colunas,
            )
            inseridos += len(lote)

    total_stage = int(await destino.fetchval(f"select count(*)::bigint from {_quote_ident(tabela_temp)}"))
    if total_stage != total_fonte or inseridos != total_fonte:
        raise RuntimeError(
            f"Contagem divergente em staging para {tabela}: fonte={total_fonte}, "
            f"copiados={inseridos}, staging={total_stage}"
        )

    await destino.execute(f"truncate table {_qualificar(schema_destino, tabela)}")
    await destino.execute(
        f"""
        insert into {_qualificar(schema_destino, tabela)} ({lista_colunas})
        select {lista_colunas}
        from {_quote_ident(tabela_temp)}
        """
    )

    total_destino = int(
        await destino.fetchval(f"select count(*)::bigint from {_qualificar(schema_destino, tabela)}")
    )
    if total_destino != total_fonte:
        raise RuntimeError(
            f"Contagem divergente no destino para {tabela}: fonte={total_fonte}, destino={total_destino}"
        )

    return {"source": total_fonte, "target": total_destino}


async def _recalcular_kpi_daily_destino(destino: asyncpg.Connection, schema_destino: str) -> dict[str, Any]:
    base = _qualificar(schema_destino, "comercial_base")
    kpi = _qualificar(schema_destino, "comercial_kpi_daily")
    propostas = _qualificar(schema_destino, "comercial_propostas_consolidada")
    cancelamentos = _qualificar(schema_destino, "comercial_cancelamentos")
    distratos = _qualificar(schema_destino, "comercial_distratos")
    dim_empreendimento = _qualificar(schema_destino, "dim_empreendimento")
    hierarquia = _qualificar(schema_destino, "hierarquia_cvcrm")

    await destino.execute(f"truncate table {kpi}")
    await destino.execute(
        f"""
        insert into {kpi} (
            data, cidade, origem, empreendimento, empreendimento_reduzido, sdr,
            corretor, gerencia, coordenacao, imobiliaria,
            leads, visitas, vendas, repasses,
            sla_finalizacao_sum, sla_finalizacao_count,
            sla_repasse_sum, sla_repasse_count,
            propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
            cancelamentos, distratos
        )
        with base_dim as materialized (
            select
                b.*,
                coalesce(nullif(trim(d.cidade), ''), nullif(trim(b.fonte_lead_cidade), ''), b.lead_cidade) as cidade,
                b.lead_origem_nome as origem,
                coalesce(
                    nullif(trim(d.empreendimento), ''),
                    nullif(trim(b.fonte_empreendimento_nome), ''),
                    nullif(trim(b.empreendimento_nome), '')
                ) as empreendimento,
                coalesce(
                    nullif(trim(d.regiao), ''),
                    nullif(trim(b.nome_empreendimento_reduzido), ''),
                    nullif(trim(b.fonte_nome_empreendimento_reduzido), ''),
                    nullif(trim(b.regiao_empreendimento), '')
                ) as empreendimento_reduzido,
                b.sdr_nome as sdr,
                coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), '')) as corretor,
                coalesce(nullif(trim(h.gestor_nome), ''), nullif(trim(b.gestor_nome), '')) as gerencia,
                h.coordenador_nome as coordenacao,
                coalesce(
                    nullif(trim(h.imobiliaria_nome_dim), ''),
                    nullif(trim(h.imobiliaria_nome), ''),
                    nullif(trim(b.imobiliaria_nome_dim), ''),
                    nullif(trim(b.imobiliaria_nome), '')
                ) as imobiliaria
            from {base} b
            left join lateral (
                select cidade, empreendimento, regiao
                from {dim_empreendimento} d
                where d.idempreendimento = coalesce(b.idempreendimento_canonico, b.idempreendimento)
                limit 1
            ) d on true
            left join lateral (
                select gestor_nome, coordenador_nome, imobiliaria_nome, imobiliaria_nome_dim
                from {hierarquia} h
                where h.nome = coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), ''))
                  and lower(coalesce(h.ativo_negocio, '')) = 's'
                  and (h.data_inicio_vigencia is null or h.data_inicio_vigencia <= current_date)
                  and (h.data_fim_vigencia is null or h.data_fim_vigencia >= current_date)
                order by h.data_inicio_vigencia desc nulls last
                limit 1
            ) h on true
        ),
        base_por_precadastro as materialized (
            select distinct on (idprecadastro)
                idprecadastro, cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria
            from base_dim
            where idprecadastro is not null
            order by idprecadastro, data_venda desc nulls last, dt_ultima_conversao_lead desc nulls last
        ),
        lead_events as (
            select distinct on (dt_ultima_conversao_lead::date, idlead)
                dt_ultima_conversao_lead::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria
            from base_dim
            where dt_ultima_conversao_lead is not null
              and idlead is not null
            order by dt_ultima_conversao_lead::date, idlead, fato_jornada_comercial_key
        ),
        visita_events as (
            select distinct on (dt_visita_realizada::date, idlead)
                dt_visita_realizada::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria
            from base_dim
            where dt_visita_realizada is not null
              and idlead is not null
            order by dt_visita_realizada::date, idlead, fato_jornada_comercial_key
        ),
        venda_events as (
            select distinct on (data_venda::date, idreserva)
                data_venda::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria
            from base_dim
            where data_venda is not null
              and idreserva is not null
            order by data_venda::date, idreserva, fato_jornada_comercial_key
        ),
        repasse_events as (
            select distinct on (dt_assinatura_contrato::date, idrepasse)
                dt_assinatura_contrato::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria
            from base_dim
            where dt_assinatura_contrato is not null
              and idrepasse is not null
              and fl_repasse_assinado = true
            order by dt_assinatura_contrato::date, idrepasse, fato_jornada_comercial_key
        ),
        sla_finalizacao_events as (
            select
                dt_contrato_contabilizado::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria,
                sla_finalizacao_dias
            from base_dim
            where dt_contrato_contabilizado is not null
              and sla_finalizacao_dias is not null
        ),
        sla_repasse_events as (
            select
                dt_assinatura_contrato::date as data,
                cidade, origem, empreendimento, empreendimento_reduzido, sdr,
                corretor, gerencia, coordenacao, imobiliaria,
                sla_repasse_dias
            from base_dim
            where dt_assinatura_contrato is not null
              and sla_repasse_dias is not null
        ),
        funil_base as (
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   count(*)::int as leads, 0::int as visitas, 0::int as vendas, 0::int as repasses,
                   0::numeric as sla_finalizacao_sum, 0::int as sla_finalizacao_count,
                   0::numeric as sla_repasse_sum, 0::int as sla_repasse_count
            from lead_events
            group by 1,2,3,4,5,6,7,8,9,10

            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0, count(*)::int, 0, 0, 0, 0, 0, 0
            from visita_events
            group by 1,2,3,4,5,6,7,8,9,10

            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0, 0, count(*)::int, 0, 0, 0, 0, 0
            from venda_events
            group by 1,2,3,4,5,6,7,8,9,10

            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0, 0, 0, count(*)::int, 0, 0, 0, 0
            from repasse_events
            group by 1,2,3,4,5,6,7,8,9,10

            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0, 0, 0, 0, coalesce(sum(sla_finalizacao_dias), 0), count(*)::int, 0, 0
            from sla_finalizacao_events
            group by 1,2,3,4,5,6,7,8,9,10

            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0, 0, 0, 0, 0, 0, coalesce(sum(sla_repasse_dias), 0), count(*)::int
            from sla_repasse_events
            group by 1,2,3,4,5,6,7,8,9,10
        ),
        funil as (
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   sum(leads)::int as leads, sum(visitas)::int as visitas, sum(vendas)::int as vendas, sum(repasses)::int as repasses,
                   sum(sla_finalizacao_sum) as sla_finalizacao_sum, sum(sla_finalizacao_count)::int as sla_finalizacao_count,
                   sum(sla_repasse_sum) as sla_repasse_sum, sum(sla_repasse_count)::int as sla_repasse_count
            from funil_base
            group by 1,2,3,4,5,6,7,8,9,10
        ),
        propostas_agregadas as (
            select
                pc.dt_ultimo_historico_data as data,
                b.cidade, b.origem, b.empreendimento, b.empreendimento_reduzido, b.sdr,
                b.corretor, b.gerencia, b.coordenacao, b.imobiliaria,
                count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'APROVADA')::int as propostas_aprovadas,
                count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'CONDICIONADA')::int as propostas_condicionadas,
                count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'REPROVADA')::int as propostas_reprovadas,
                count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA'))::int as propostas_total
            from {propostas} pc
            left join base_por_precadastro b on b.idprecadastro = pc.idprecadastro
            where pc.dt_ultimo_historico_data is not null
            group by 1,2,3,4,5,6,7,8,9,10
        ),
        cancelamentos_agregados as (
            select
                cc.data_cancelamento::date as data,
                b.cidade, b.origem, b.empreendimento, b.empreendimento_reduzido, b.sdr,
                b.corretor, b.gerencia, b.coordenacao, b.imobiliaria,
                count(distinct cc.idreserva)::int as cancelamentos
            from {cancelamentos} cc
            left join lateral (
                select cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria
                from base_dim b
                where (b.idreserva is not null and b.idreserva = cc.idreserva)
                   or (b.idlead is not null and b.idlead = cc.idlead)
                   or (b.idprecadastro is not null and b.idprecadastro = cc.idprecadastro)
                order by b.data_venda desc nulls last, b.dt_ultima_conversao_lead desc nulls last
                limit 1
            ) b on true
            where cc.data_cancelamento is not null
            group by 1,2,3,4,5,6,7,8,9,10
        ),
        distratos_agregados as (
            select
                cd.referencia_data::date as data,
                b.cidade, b.origem, b.empreendimento, b.empreendimento_reduzido, b.sdr,
                b.corretor, b.gerencia, b.coordenacao, b.imobiliaria,
                count(distinct cd.idreserva)::int as distratos
            from {distratos} cd
            left join lateral (
                select cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria
                from base_dim b
                where (b.idreserva is not null and b.idreserva = cd.idreserva)
                   or (b.idlead is not null and b.idlead = cd.idlead)
                   or (b.idprecadastro is not null and b.idprecadastro = cd.idprecadastro)
                order by b.data_venda desc nulls last, b.dt_ultima_conversao_lead desc nulls last
                limit 1
            ) b on true
            where cd.referencia_data is not null
            group by 1,2,3,4,5,6,7,8,9,10
        ),
        linhas as (
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   leads, visitas, vendas, repasses,
                   sla_finalizacao_sum, sla_finalizacao_count, sla_repasse_sum, sla_repasse_count,
                   0::int as propostas_aprovadas, 0::int as propostas_condicionadas, 0::int as propostas_reprovadas, 0::int as propostas_total,
                   0::int as cancelamentos, 0::int as distratos
            from funil
            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0,0,0,0,0,0,0,0,
                   propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
                   0,0
            from propostas_agregadas
            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0,0,0,0,0,0,0,0,
                   0,0,0,0,
                   cancelamentos,0
            from cancelamentos_agregados
            union all
            select data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
                   0,0,0,0,0,0,0,0,
                   0,0,0,0,
                   0,distratos
            from distratos_agregados
        )
        select
            data, cidade, origem, empreendimento, empreendimento_reduzido, sdr, corretor, gerencia, coordenacao, imobiliaria,
            sum(leads)::int, sum(visitas)::int, sum(vendas)::int, sum(repasses)::int,
            sum(sla_finalizacao_sum), sum(sla_finalizacao_count)::int,
            sum(sla_repasse_sum), sum(sla_repasse_count)::int,
            sum(propostas_aprovadas)::int, sum(propostas_condicionadas)::int, sum(propostas_reprovadas)::int, sum(propostas_total)::int,
            sum(cancelamentos)::int, sum(distratos)::int
        from linhas
        group by 1,2,3,4,5,6,7,8,9,10
        """
    )
    total = int(await destino.fetchval(f"select count(*)::bigint from {kpi}"))
    return {"derived": True, "target": total}


async def sincronizar(caminho_fonte: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    if os.getenv("ALLOW_LEGACY_DASHBOARD_COMERCIAL_SYNC") != "1":
        raise RuntimeError(
            "Sincronizacao legada via Postgres intermediario desativada. "
            "Use o pipeline oficial Databricks -> connect_comercial: "
            "cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial && "
            "npm run data:update:connect"
        )

    inicio = time.perf_counter()
    config_fonte = _carregar_configuracao_fonte(caminho_fonte)
    schema_fonte = str(config_fonte.get("schema") or "public")
    schema_destino = ESQUEMA_COMERCIAL

    fonte = await _conectar_fonte(config_fonte)
    destino = await _conectar_destino()
    log_id: int | None = None
    contagens: dict[str, Any] = {}

    try:
        log_id = await _registrar_inicio(destino, schema_destino, schema_fonte)
        lock_ok = await destino.fetchval("select pg_try_advisory_lock($1)", LOCK_ID)
        if not lock_ok:
            raise RuntimeError("Outra sincronizacao do Dashboard Comercial ja esta em execucao.")

        if dry_run:
            for tabela in TABELAS_SINCRONIZADAS:
                contagens[tabela] = {
                    "source": int(
                        await fonte.fetchval(f"select count(*)::bigint from {_qualificar(schema_fonte, tabela)}")
                    )
                }
            return {"status": "dry_run", "tables": contagens}

        async with destino.transaction():
            for tabela in TABELAS_SINCRONIZADAS:
                contagens[tabela] = await _copiar_tabela(
                    fonte,
                    destino,
                    schema_fonte,
                    schema_destino,
                    tabela,
                )
            contagens["comercial_kpi_daily"] = await _recalcular_kpi_daily_destino(
                destino,
                schema_destino,
            )

        duracao = time.perf_counter() - inicio
        await _registrar_fim(
            destino,
            schema_destino,
            log_id,
            "success",
            contagens,
            duracao,
            "Sincronizacao concluida com sucesso.",
        )
        return {"status": "success", "duration_seconds": round(duracao, 3), "tables": contagens}
    except Exception as exc:
        duracao = time.perf_counter() - inicio
        if log_id is not None:
            await _registrar_fim(
                destino,
                schema_destino,
                log_id,
                "error",
                contagens,
                duracao,
                str(exc),
            )
        raise
    finally:
        try:
            await destino.execute("select pg_advisory_unlock($1)", LOCK_ID)
        except Exception:
            pass
        await fonte.close()
        await destino.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Sincroniza Dashboard Comercial para o 7LM Connect.")
    parser.add_argument("--source-env", help="Arquivo .env com DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME.")
    parser.add_argument("--dry-run", action="store_true", help="Apenas valida conexao e contagens da fonte.")
    args = parser.parse_args()

    resultado = asyncio.run(sincronizar(caminho_fonte=args.source_env, dry_run=args.dry_run))
    print(json.dumps(resultado, ensure_ascii=True, indent=2, default=str))


if __name__ == "__main__":
    main()
