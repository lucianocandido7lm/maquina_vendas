"""
Sincroniza a base de produtividade do Dashboard G&C para o banco do portal.

A fonte lida pelo servidor vem do banco de dados interno informado em
Servidor_dados.txt/.dashboard_comercial_source.env. A carga promove os dados em
uma transacao para impedir que a tela veja dados parciais.
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


LOCK_ID = 740107415
BATCH_SIZE = 5000
DEFAULT_MONTHS_BACK = 24
SOURCE_SCHEMA = "public"
RAW_REPASSES_SOURCE = "databricks_comercial_base"

KPI_COLUMNS = [
    "data",
    "cidade",
    "origem",
    "empreendimento",
    "empreendimento_reduzido",
    "sdr",
    "corretor",
    "gerencia",
    "coordenacao",
    "imobiliaria",
    "leads",
    "visitas",
    "vendas",
    "repasses",
    "sla_finalizacao_sum",
    "sla_finalizacao_count",
    "sla_repasse_sum",
    "sla_repasse_count",
    "propostas_aprovadas",
    "propostas_condicionadas",
    "propostas_reprovadas",
    "propostas_total",
    "cancelamentos",
    "distratos",
]

HIER_COLUMNS = [
    "coordenador_documento",
    "coordenador_nome",
    "mes_referencia",
    "corretor_ativo_nome",
    "gestor_corretor",
    "coordenador_corretor",
    "regiao_corretor",
    "imobiliaria_corretor",
    "corretor_hierarquia_key",
    "corretor_ativo_mes_key",
    "coordenador_email",
    "tipo_corretor",
    "gerente_documento",
    "gerente_email",
    "gerente_nome",
    "ativo_negocio",
    "data_inicio_vigencia",
    "data_fim_vigencia",
    "data_inicio_vigencia_data",
    "data_fim_vigencia_data",
    "ativo",
    "ativo_login",
    "referencia",
    "dt_admissao",
    "dt_demissao",
]

HIER_INACTIVE_VALUES_SQL = "('false','0','nao','n','no','inativo','inactive','desativado','desligado')"


def _quote_ident(valor: str) -> str:
    return '"' + str(valor).replace('"', '""') + '"'


def _qualificar(schema: str, tabela: str) -> str:
    return f"{_quote_ident(schema)}.{_quote_ident(tabela)}"


def _ler_arquivo_env(caminho: Path) -> dict[str, str]:
    valores: dict[str, str] = {}
    if not caminho.exists():
        return valores
    for linha_bruta in caminho.read_text(encoding="utf-8", errors="replace").splitlines():
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
        os.getenv("SEVENLM_CONNECT_DASHBOARD_GC_SOURCE_ENV"),
        os.getenv("DASHBOARD_GC_SOURCE_ENV"),
        os.getenv("SEVENLM_CONNECT_DASHBOARD_COMERCIAL_SOURCE_ENV"),
        os.getenv("DASHBOARD_COMERCIAL_SOURCE_ENV"),
    ):
        if valor:
            candidatos.append(Path(valor).expanduser())

    candidatos.extend(
        [
            PORTAL_ROOT / ".dashboard_gc_source.env",
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
        "user": pegar("DASHBOARD_GC_SOURCE_DBUSER", "DASHBOARD_COMERCIAL_SOURCE_DBUSER", "DB_USER"),
        "password": pegar("DASHBOARD_GC_SOURCE_DBPASS", "DASHBOARD_COMERCIAL_SOURCE_DBPASS", "DB_PASSWORD"),
        "host": pegar("DASHBOARD_GC_SOURCE_DBHOST", "DASHBOARD_COMERCIAL_SOURCE_DBHOST", "DB_HOST"),
        "port": int(pegar("DASHBOARD_GC_SOURCE_DBPORT", "DASHBOARD_COMERCIAL_SOURCE_DBPORT", "DB_PORT", padrao="5432") or 5432),
        "database": pegar("DASHBOARD_GC_SOURCE_DBNAME", "DASHBOARD_COMERCIAL_SOURCE_DBNAME", "DB_NAME"),
        "schema": pegar(
            "DASHBOARD_GC_SOURCE_SCHEMA",
            "DASHBOARD_COMERCIAL_SOURCE_SCHEMA",
            "DB_SCHEMA",
            obrigatorio=False,
            padrao=SOURCE_SCHEMA,
        )
        or SOURCE_SCHEMA,
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
        server_settings={"application_name": "7lm_dashboard_gc_produtividade_source"},
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
        server_settings={"application_name": "7lm_dashboard_gc_produtividade_target"},
    )


async def _garantir_tabelas_destino(destino: asyncpg.Connection, schema_destino: str) -> None:
    await destino.execute(f"create schema if not exists {_quote_ident(schema_destino)}")
    await destino.execute(
        f"""
        create table if not exists {_qualificar(schema_destino, "dashboard_gc_produtividade_kpi_daily")} (
          data date not null,
          cidade text,
          origem text,
          empreendimento text,
          empreendimento_reduzido text,
          sdr text,
          corretor text,
          gerencia text,
          coordenacao text,
          imobiliaria text,
          leads integer not null default 0,
          visitas integer not null default 0,
          vendas integer not null default 0,
          repasses integer not null default 0,
          sla_finalizacao_sum numeric,
          sla_finalizacao_count integer not null default 0,
          sla_repasse_sum numeric,
          sla_repasse_count integer not null default 0,
          propostas_aprovadas integer not null default 0,
          propostas_condicionadas integer not null default 0,
          propostas_reprovadas integer not null default 0,
          propostas_total integer not null default 0,
          cancelamentos integer not null default 0,
          distratos integer not null default 0,
          data_hora_sync timestamptz not null default now()
        );

        create index if not exists idx_dashboard_gc_prod_kpi_data
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_kpi_daily")} (data desc);

        create index if not exists idx_dashboard_gc_prod_kpi_lideranca
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_kpi_daily")} (coordenacao, gerencia, imobiliaria, corretor);

        create table if not exists {_qualificar(schema_destino, "dashboard_gc_produtividade_hierarquia")} (
          coordenador_documento text,
          coordenador_nome text,
          mes_referencia date not null,
          corretor_ativo_nome text,
          gestor_corretor text,
          coordenador_corretor text,
          regiao_corretor text,
          imobiliaria_corretor text,
          corretor_hierarquia_key text,
          corretor_ativo_mes_key text,
          coordenador_email text,
          tipo_corretor text,
          gerente_documento text,
          gerente_email text,
          gerente_nome text,
          ativo_negocio text,
          data_inicio_vigencia date,
          data_fim_vigencia date,
          data_inicio_vigencia_data date,
          data_fim_vigencia_data date,
          ativo text,
          ativo_login text,
          referencia text,
          dt_admissao date,
          dt_demissao date,
          data_hora_sync timestamptz not null default now()
        );

        alter table {_qualificar(schema_destino, "dashboard_gc_produtividade_hierarquia")}
          add column if not exists ativo_negocio text,
          add column if not exists data_inicio_vigencia date,
          add column if not exists data_fim_vigencia date,
          add column if not exists data_inicio_vigencia_data date,
          add column if not exists data_fim_vigencia_data date,
          add column if not exists ativo text,
          add column if not exists ativo_login text,
          add column if not exists referencia text,
          add column if not exists dt_admissao date,
          add column if not exists dt_demissao date;

        create index if not exists idx_dashboard_gc_prod_hier_mes
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_hierarquia")} (mes_referencia desc);

        create index if not exists idx_dashboard_gc_prod_hier_lideranca
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_hierarquia")} (coordenador_nome, gerente_nome, imobiliaria_corretor, corretor_ativo_nome);

        create table if not exists {_qualificar(schema_destino, "dashboard_gc_produtividade_sync_log")} (
          id bigserial primary key,
          started_at timestamptz not null default now(),
          finished_at timestamptz,
          status text not null,
          source_schema text not null default 'public',
          target_schema text not null default '{schema_destino}',
          table_counts jsonb not null default '{{}}'::jsonb,
          duration_seconds numeric(12,3),
          message text
        );

        create index if not exists idx_dashboard_gc_prod_sync_log_status
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_sync_log")} (started_at desc, status);

        create table if not exists {_qualificar(schema_destino, "dashboard_gc_produtividade_repasses_importados")} (
          chave_registro text primary key,
          reserva text,
          data_assinatura date not null,
          mes_referencia date not null,
          situacao_repasse text,
          regiao text,
          empreendimento text,
          imobiliaria text,
          corretor text,
          cliente text,
          documento_cliente text,
          fonte_arquivo text not null,
          data_hora_importacao timestamptz not null default now()
        );

        create index if not exists idx_dashboard_gc_prod_rep_imp_mes
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_repasses_importados")} (mes_referencia, imobiliaria, corretor);

        create index if not exists idx_dashboard_gc_prod_rep_imp_corretor
          on {_qualificar(schema_destino, "dashboard_gc_produtividade_repasses_importados")} (corretor, data_assinatura);
        """
    )


async def _registrar_inicio(destino: asyncpg.Connection, schema_destino: str, schema_fonte: str) -> int:
    return int(
        await destino.fetchval(
            f"""
            insert into {_qualificar(schema_destino, "dashboard_gc_produtividade_sync_log")}
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
        update {_qualificar(schema_destino, "dashboard_gc_produtividade_sync_log")}
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


async def _copiar_consulta(
    fonte: asyncpg.Connection,
    destino: asyncpg.Connection,
    *,
    consulta: str,
    tabela_destino: str,
    colunas: list[str],
    schema_destino: str,
) -> int:
    tabela_temp = f"tmp_{tabela_destino}"
    await destino.execute(
        f"""
        create temp table {_quote_ident(tabela_temp)}
        (like {_qualificar(schema_destino, tabela_destino)} including defaults)
        on commit drop
        """
    )

    inseridos = 0
    async with fonte.transaction(readonly=True):
        cursor = fonte.cursor(consulta, prefetch=BATCH_SIZE)
        lote: list[tuple[Any, ...]] = []
        async for linha in cursor:
            lote.append(tuple(linha[coluna] for coluna in colunas))
            if len(lote) >= BATCH_SIZE:
                await destino.copy_records_to_table(tabela_temp, records=lote, columns=colunas)
                inseridos += len(lote)
                lote.clear()
        if lote:
            await destino.copy_records_to_table(tabela_temp, records=lote, columns=colunas)
            inseridos += len(lote)

    lista_colunas = ", ".join(_quote_ident(coluna) for coluna in colunas)
    await destino.execute(f"truncate table {_qualificar(schema_destino, tabela_destino)}")
    await destino.execute(
        f"""
        insert into {_qualificar(schema_destino, tabela_destino)} ({lista_colunas})
        select {lista_colunas}
        from {_quote_ident(tabela_temp)}
        """
    )
    total_destino = int(await destino.fetchval(f"select count(*)::bigint from {_qualificar(schema_destino, tabela_destino)}"))
    if total_destino != inseridos:
        raise RuntimeError(f"Contagem divergente em {tabela_destino}: copiados={inseridos}, destino={total_destino}")
    return total_destino


async def _copiar_repasses_brutos_databricks(
    fonte: asyncpg.Connection,
    destino: asyncpg.Connection,
    *,
    schema_fonte: str,
    schema_destino: str,
    meses: int,
) -> int:
    tabela_destino = "dashboard_gc_produtividade_repasses_importados"
    colunas = [
        "chave_registro",
        "reserva",
        "data_assinatura",
        "mes_referencia",
        "situacao_repasse",
        "regiao",
        "empreendimento",
        "imobiliaria",
        "corretor",
        "cliente",
        "documento_cliente",
        "fonte_arquivo",
    ]
    tabela_temp = f"tmp_{tabela_destino}_{RAW_REPASSES_SOURCE}"
    tabela_qualificada = _qualificar(schema_destino, tabela_destino)

    await destino.execute(
        f"""
        create temp table {_quote_ident(tabela_temp)}
        (like {tabela_qualificada} including defaults)
        on commit drop
        """
    )

    consulta = f"""
        select
          md5(concat_ws(
            '|',
            '{RAW_REPASSES_SOURCE}',
            coalesce(idreserva::text, ''),
            coalesce(dt_assinatura_contrato::date::text, ''),
            coalesce(nullif(trim(imobiliaria_nome_canonica), ''), nullif(trim(imobiliaria_nome_dim), ''), nullif(trim(imobiliaria_nome), ''), ''),
            coalesce(nullif(trim(corretor_nome_canonico), ''), nullif(trim(corretor_nome), ''), '')
          )) as chave_registro,
          idreserva::text as reserva,
          dt_assinatura_contrato::date as data_assinatura,
          date_trunc('month', dt_assinatura_contrato)::date as mes_referencia,
          coalesce(nullif(trim(repasse_situacao_nome), ''), nullif(trim(reserva_situacao_nome), '')) as situacao_repasse,
          coalesce(
            nullif(trim(regiao_empreendimento_repasse), ''),
            nullif(trim(regiao_empreendimento_reserva), ''),
            nullif(trim(regiao_empreendimento), ''),
            nullif(trim(lead_regiao), '')
          ) as regiao,
          coalesce(
            nullif(trim(empreendimento_nome_repasse), ''),
            nullif(trim(empreendimento_nome_reserva), ''),
            nullif(trim(empreendimento_nome), ''),
            nullif(trim(empreendimento_nome_precadastro), ''),
            nullif(trim(empreendimento_nome_lead), '')
          ) as empreendimento,
          coalesce(nullif(trim(imobiliaria_nome_canonica), ''), nullif(trim(imobiliaria_nome_dim), ''), nullif(trim(imobiliaria_nome), ''), 'Sem equipe') as imobiliaria,
          coalesce(nullif(trim(corretor_nome_canonico), ''), nullif(trim(corretor_nome), ''), 'Sem corretor') as corretor,
          nullif(trim(dim_lead_cliente_nome), '') as cliente,
          coalesce(nullif(trim(cliente_documento), ''), nullif(trim(dim_lead_cliente_documento), '')) as documento_cliente,
          '{RAW_REPASSES_SOURCE}' as fonte_arquivo
        from {_qualificar(schema_fonte, "comercial_base")}
        where dt_assinatura_contrato is not null
          and dt_assinatura_contrato >= date_trunc('month', current_date)::date - ({int(meses)} || ' months')::interval
          and coalesce(fl_cancelada, false) = false
          and coalesce(repasse_situacao_nome, '') !~* '(distrato|cancel)'
          and coalesce(reserva_situacao_nome, '') !~* '(distrato|cancel)'
        order by dt_assinatura_contrato, imobiliaria, corretor, idreserva
    """

    inseridos = 0
    async with fonte.transaction(readonly=True):
        cursor = fonte.cursor(consulta, prefetch=BATCH_SIZE)
        lote: list[tuple[Any, ...]] = []
        async for linha in cursor:
            lote.append(tuple(linha[coluna] for coluna in colunas))
            if len(lote) >= BATCH_SIZE:
                await destino.copy_records_to_table(tabela_temp, records=lote, columns=colunas)
                inseridos += len(lote)
                lote.clear()
        if lote:
            await destino.copy_records_to_table(tabela_temp, records=lote, columns=colunas)
            inseridos += len(lote)

    await destino.execute(f"delete from {tabela_qualificada} where fonte_arquivo = $1", RAW_REPASSES_SOURCE)
    lista_colunas = ", ".join(_quote_ident(coluna) for coluna in colunas)
    await destino.execute(
        f"""
        insert into {tabela_qualificada} ({lista_colunas})
        select {lista_colunas}
          from {_quote_ident(tabela_temp)} origem
         where not exists (
               select 1
                 from {tabela_qualificada} manual
                where manual.fonte_arquivo <> $1
                  and manual.mes_referencia = origem.mes_referencia
         )
        on conflict (chave_registro) do update set
          reserva = excluded.reserva,
          data_assinatura = excluded.data_assinatura,
          mes_referencia = excluded.mes_referencia,
          situacao_repasse = excluded.situacao_repasse,
          regiao = excluded.regiao,
          empreendimento = excluded.empreendimento,
          imobiliaria = excluded.imobiliaria,
          corretor = excluded.corretor,
          cliente = excluded.cliente,
          documento_cliente = excluded.documento_cliente,
          fonte_arquivo = excluded.fonte_arquivo,
          data_hora_importacao = now()
        """,
        RAW_REPASSES_SOURCE,
    )
    return int(
        await destino.fetchval(
            f"select count(*)::bigint from {tabela_qualificada} where fonte_arquivo = $1",
            RAW_REPASSES_SOURCE,
        )
    )


async def sincronizar(caminho_env: str | None = None, meses: int = DEFAULT_MONTHS_BACK) -> dict[str, Any]:
    inicio = time.monotonic()
    fonte_config = _carregar_configuracao_fonte(caminho_env)
    schema_fonte = fonte_config["schema"] or SOURCE_SCHEMA
    schema_destino = ESQUEMA_COMERCIAL
    fonte: asyncpg.Connection | None = None
    destino: asyncpg.Connection | None = None
    log_id: int | None = None
    contagens: dict[str, Any] = {}

    try:
        fonte = await _conectar_fonte(fonte_config)
        destino = await _conectar_destino()
        await _garantir_tabelas_destino(destino, schema_destino)

        lock_ok = await destino.fetchval("select pg_try_advisory_lock($1)", LOCK_ID)
        if not lock_ok:
            return {"status": "skipped", "message": "Outra sincronizacao ja esta em execucao."}

        log_id = await _registrar_inicio(destino, schema_destino, schema_fonte)
        try:
            async with destino.transaction():
                kpi_sql = f"""
                    select {", ".join(_quote_ident(coluna) for coluna in KPI_COLUMNS)}
                      from {_qualificar(schema_fonte, "comercial_kpi_daily")}
                     where data >= date_trunc('month', current_date)::date - ({int(meses)} || ' months')::interval
                     order by data, coordenacao, gerencia, imobiliaria, corretor
                """
                hierarquia_select = [
                    _quote_ident(coluna)
                    for coluna in HIER_COLUMNS
                ]
                hierarquia_select[HIER_COLUMNS.index("data_inicio_vigencia")] = (
                    "coalesce(data_inicio_vigencia, data_inicio_vigencia_data, dt_admissao, mes_referencia)::date "
                    "as data_inicio_vigencia"
                )
                hierarquia_select[HIER_COLUMNS.index("data_inicio_vigencia_data")] = (
                    "coalesce(data_inicio_vigencia_data, data_inicio_vigencia, dt_admissao, mes_referencia)::date "
                    "as data_inicio_vigencia_data"
                )
                hierarquia_select[HIER_COLUMNS.index("data_fim_vigencia")] = f"""
                    coalesce(
                      data_fim_vigencia,
                      data_fim_vigencia_data,
                      dt_demissao,
                      case
                        when lower(coalesce(ativo, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                          or lower(coalesce(ativo_login, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                          or lower(coalesce(ativo_negocio, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                        then mes_referencia
                      end
                    )::date as data_fim_vigencia
                """.strip()
                hierarquia_select[HIER_COLUMNS.index("data_fim_vigencia_data")] = f"""
                    coalesce(
                      data_fim_vigencia_data,
                      data_fim_vigencia,
                      dt_demissao,
                      case
                        when lower(coalesce(ativo, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                          or lower(coalesce(ativo_login, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                          or lower(coalesce(ativo_negocio, 'true')) in {HIER_INACTIVE_VALUES_SQL}
                        then mes_referencia
                      end
                    )::date as data_fim_vigencia_data
                """.strip()

                hierarquia_sql = f"""
                    select {", ".join(hierarquia_select)}
                      from {_qualificar(schema_fonte, "hierarquia_cvcrm")}
                     where mes_referencia >= date_trunc('month', current_date)::date - ({int(meses)} || ' months')::interval
                     order by mes_referencia, coordenador_nome, gerente_nome, imobiliaria_corretor, corretor_ativo_nome
                """
                contagens["dashboard_gc_produtividade_kpi_daily"] = await _copiar_consulta(
                    fonte,
                    destino,
                    consulta=kpi_sql,
                    tabela_destino="dashboard_gc_produtividade_kpi_daily",
                    colunas=KPI_COLUMNS,
                    schema_destino=schema_destino,
                )
                contagens["dashboard_gc_produtividade_hierarquia"] = await _copiar_consulta(
                    fonte,
                    destino,
                    consulta=hierarquia_sql,
                    tabela_destino="dashboard_gc_produtividade_hierarquia",
                    colunas=HIER_COLUMNS,
                    schema_destino=schema_destino,
                )
                contagens["dashboard_gc_produtividade_repasses_importados_databricks"] = await _copiar_repasses_brutos_databricks(
                    fonte,
                    destino,
                    schema_fonte=schema_fonte,
                    schema_destino=schema_destino,
                    meses=meses,
                )

                if contagens["dashboard_gc_produtividade_kpi_daily"] <= 0:
                    raise RuntimeError("Carga abortada: comercial_kpi_daily sem dados no recorte.")
                if contagens["dashboard_gc_produtividade_hierarquia"] <= 0:
                    raise RuntimeError("Carga abortada: hierarquia_cvcrm sem dados no recorte.")

            duracao = time.monotonic() - inicio
            await _registrar_fim(destino, schema_destino, log_id, "success", contagens, duracao, "OK")
            return {"status": "success", "counts": contagens, "duration_seconds": round(duracao, 3)}
        except Exception as exc:
            duracao = time.monotonic() - inicio
            if log_id is not None:
                await _registrar_fim(destino, schema_destino, log_id, "error", contagens, duracao, str(exc))
            raise
        finally:
            await destino.execute("select pg_advisory_unlock($1)", LOCK_ID)
    finally:
        if fonte is not None:
            await fonte.close()
        if destino is not None:
            await destino.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sincroniza a produtividade do Dashboard G&C.")
    parser.add_argument("--env", help="Caminho opcional para arquivo de ambiente da fonte.")
    parser.add_argument("--meses", type=int, default=DEFAULT_MONTHS_BACK, help="Quantidade de meses do recorte sincronizado.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    resultado = asyncio.run(sincronizar(args.env, args.meses))
    print(json.dumps(resultado, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
