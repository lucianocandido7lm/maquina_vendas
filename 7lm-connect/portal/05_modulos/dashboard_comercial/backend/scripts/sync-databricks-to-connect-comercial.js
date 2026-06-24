import { DBSQLClient } from '@databricks/sql';
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const moduleRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: '/opt/7lm-connect/portal/.env' });
dotenv.config({ path: '/etc/commercial-dashboard/env', override: false });
dotenv.config({ path: path.resolve(moduleRoot, 'backend/.env'), override: false });

const TARGET_SCHEMA = process.env.SEVENLM_CONNECT_COMERCIAL_SCHEMA || 'connect_comercial';
const CONNECT_SCHEMA = process.env.SEVENLM_CONNECT_SCHEMA || 'sevenlm_connect';
const DATABRICKS_CATALOG = process.env.DATABRICKS_CATALOG || 'data_platform_dev';
const DATABRICKS_SCHEMA = process.env.DATABRICKS_SCHEMA || 'gold_cvcrm';
const BATCH_SIZE = Number(process.env.COMMERCIAL_PIPELINE_BATCH_SIZE || 250);
const LOCK_ID = 740107113;
const DATABRICKS_TEMP_VIEWS = {
  comercialBase: 'pipeline_vw_bi_comercial_base',
  leadsHistorico: 'pipeline_vw_bi_leads_historico',
  propostasHistorico: 'pipeline_vw_bi_propostas_historico',
  propostasConsolidada: 'pipeline_vw_bi_propostas_consolidada',
  cancelamentos: 'pipeline_vw_bi_cancelamentos',
  distratos: 'pipeline_vw_bi_distratos',
};

const SOURCE_TABLES = [
  'comercial_base',
  'comercial_leads_historico',
  'comercial_propostas_historico',
  'comercial_propostas_consolidada',
  'comercial_cancelamentos',
  'comercial_distratos',
  'dim_corretor',
  'dim_empreendimento',
];

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;
const qualify = (schema, table) => `${quoteIdent(schema)}.${quoteIdent(table)}`;

const pgConfig = () => ({
  user: process.env.SEVENLM_CONNECT_DBUSER,
  host: process.env.SEVENLM_CONNECT_DBHOST || '127.0.0.1',
  database: process.env.SEVENLM_CONNECT_DBNAME,
  password: process.env.SEVENLM_CONNECT_DBPASS,
  port: Number(process.env.SEVENLM_CONNECT_DBPORT || 5432),
  application_name: '7lm_dashboard_comercial_databricks_direct',
});

const databricksConfig = () => ({
  token: process.env.DATABRICKS_TOKEN,
  host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
  path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH,
});

function requireConfig() {
  const required = [
    ['SEVENLM_CONNECT_DBUSER', process.env.SEVENLM_CONNECT_DBUSER],
    ['SEVENLM_CONNECT_DBNAME', process.env.SEVENLM_CONNECT_DBNAME],
    ['SEVENLM_CONNECT_DBPASS', process.env.SEVENLM_CONNECT_DBPASS],
    ['DATABRICKS_TOKEN', process.env.DATABRICKS_TOKEN],
    ['DATABRICKS_HOST or DATABRICKS_SERVER_HOSTNAME', process.env.DATABRICKS_HOST || process.env.DATABRICKS_SERVER_HOSTNAME],
    ['DATABRICKS_HTTP_PATH or DATABRICKS_PATH', process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Config ausente: ${missing.join(', ')}`);
  }
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
      order by ordinal_position
    `,
    [TARGET_SCHEMA, table],
  );
  if (rows.length === 0) {
    throw new Error(`Tabela destino ausente: ${TARGET_SCHEMA}.${table}`);
  }
  return rows.map((row) => row.column_name);
}

async function ensureRuntimeObjects(client) {
  await client.query(`create schema if not exists ${quoteIdent(TARGET_SCHEMA)}`);
  await client.query(`
    create table if not exists ${qualify(TARGET_SCHEMA, 'dashboard_comercial_sync_log')} (
      id bigserial primary key,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      status text not null,
      source_schema text not null,
      target_schema text not null,
      table_counts jsonb not null default '{}'::jsonb,
      duration_seconds numeric(12,3),
      message text
    )
  `);

  await client.query(`
    create table if not exists ${qualify(TARGET_SCHEMA, 'dim_corretor')} (
      idcorretor bigint,
      email text,
      nome_corretor text,
      apelido text
    )
  `);
  await client.query(`
    alter table ${qualify(TARGET_SCHEMA, 'dim_corretor')}
      add column if not exists idcorretor bigint,
      add column if not exists email text,
      add column if not exists nome_corretor text,
      add column if not exists apelido text
  `);

  await client.query(`
    create table if not exists ${qualify(TARGET_SCHEMA, 'comercial_leads_historico')} (
      historico_status_key text,
      journey_id text,
      journey_anchor_type text,
      idlead bigint,
      referencia_data timestamp,
      dt_referencia date,
      situacao_de text,
      situacao_para text,
      agendamento_status_grupo text,
      idcorretor_atual bigint,
      idgestor bigint,
      idimobiliaria bigint,
      idempreendimento bigint,
      idunidade bigint
    )
  `);
  await client.query(`
    alter table ${qualify(TARGET_SCHEMA, 'comercial_leads_historico')}
      add column if not exists historico_status_key text,
      add column if not exists journey_id text,
      add column if not exists journey_anchor_type text,
      add column if not exists idlead bigint,
      add column if not exists referencia_data timestamp,
      add column if not exists dt_referencia date,
      add column if not exists situacao_de text,
      add column if not exists situacao_para text,
      add column if not exists agendamento_status_grupo text,
      add column if not exists idcorretor_atual bigint,
      add column if not exists idgestor bigint,
      add column if not exists idimobiliaria bigint,
      add column if not exists idempreendimento bigint,
      add column if not exists idunidade bigint
  `);
  await client.query(`
    alter table ${qualify(TARGET_SCHEMA, 'comercial_kpi_daily')}
      add column if not exists agendamentos integer default 0
  `);

  for (const table of SOURCE_TABLES) {
    await client.query(`
      create table if not exists ${qualify(TARGET_SCHEMA, `${table}_staging`)}
      (like ${qualify(TARGET_SCHEMA, table)} including all)
    `);
  }
}

async function beginLog(client) {
  const { rows } = await client.query(
    `
      insert into ${qualify(TARGET_SCHEMA, 'dashboard_comercial_sync_log')}
        (status, source_schema, target_schema)
      values ('running', $1, $2)
      returning id
    `,
    [`${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}`, TARGET_SCHEMA],
  );
  return rows[0].id;
}

async function finishLog(client, logId, status, counts, startedAt, message) {
  const duration = (Date.now() - startedAt) / 1000;
  await client.query(
    `
      update ${qualify(TARGET_SCHEMA, 'dashboard_comercial_sync_log')}
      set finished_at = now(),
          status = $2,
          table_counts = $3::jsonb,
          duration_seconds = $4,
          message = $5
      where id = $1
    `,
    [logId, status, JSON.stringify(counts), duration, String(message || '').slice(0, 2000)],
  );
}

async function executeView(session, query, label) {
  let op;
  try {
    op = await session.executeStatement(query, { runAsync: true });
    const rows = [];
    do {
      const chunk = await op.fetchChunk({ maxRows: BATCH_SIZE });
      rows.push(...chunk);
    } while (await op.hasMoreRows());
    console.log(`Databricks ${label}: ${rows.length} linhas`);
    return rows;
  } finally {
    await op?.close().catch(() => {});
  }
}

async function executeDatabricksRows(session, query) {
  let op;
  try {
    op = await session.executeStatement(query, { runAsync: true });
    return await op.fetchAll();
  } finally {
    await op?.close().catch(() => {});
  }
}

async function executeDatabricksCommand(session, query) {
  let op;
  try {
    op = await session.executeStatement(query, { runAsync: true });
    await op.fetchAll();
  } finally {
    await op?.close().catch(() => {});
  }
}

async function getDatabricksViewDefinition(session, viewName) {
  const rows = await executeDatabricksRows(
    session,
    `
      select view_definition
      from system.information_schema.views
      where table_catalog = '${DATABRICKS_CATALOG}'
        and table_schema = '${DATABRICKS_SCHEMA}'
        and table_name = '${viewName}'
    `,
  );
  const definition = rows[0]?.view_definition;
  if (!definition) {
    throw new Error(`View Databricks sem definicao acessivel: ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.${viewName}`);
  }
  return definition;
}

function removeCorretoresAtivosDependency(definition) {
  let cleanDefinition = definition.replace(
    'coalesce(ie.coordenador, idoc.coordenador) AS coordenador_nome,\n    coalesce(ie.coordenador_documento, idoc.coordenador_documento) AS coordenador_documento,',
    'cast(null AS string) AS coordenador_nome,\n    cast(null AS string) AS coordenador_documento,',
  );

  const start = cleanDefinition.indexOf('\nLEFT JOIN (\n    SELECT email_norm');
  const end = cleanDefinition.indexOf('\nLEFT JOIN data_platform_dev.gold_cvcrm.dim_empreendimento_unidade deu_precadastro');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Nao foi possivel remover a dependencia de corretores_ativos da vw_bi_comercial_base');
  }
  cleanDefinition = cleanDefinition.slice(0, start) + cleanDefinition.slice(end);

  const forbiddenTokens = ['corretores_ativos', 'ie.', 'idoc.'].filter((token) => cleanDefinition.includes(token));
  if (forbiddenTokens.length) {
    throw new Error(`Definicao limpa ainda contem dependencia proibida: ${forbiddenTokens.join(', ')}`);
  }
  return cleanDefinition;
}

function replaceViewReferences(definition, replacements) {
  let replaced = definition;
  for (const [sourceView, targetView] of Object.entries(replacements)) {
    const fullName = `${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.${sourceView}`;
    const schemaName = `${DATABRICKS_SCHEMA}.${sourceView}`;
    replaced = replaced.replaceAll(fullName, targetView).replaceAll(schemaName, targetView);
  }
  return replaced;
}

async function prepareDatabricksSessionViews(session) {
  const baseDefinition = removeCorretoresAtivosDependency(
    await getDatabricksViewDefinition(session, 'vw_bi_comercial_base'),
  );
  await executeDatabricksCommand(
    session,
    `create or replace temporary view ${DATABRICKS_TEMP_VIEWS.comercialBase} as ${baseDefinition}`,
  );

  const viewMappings = [
    ['vw_bi_leads_historico', DATABRICKS_TEMP_VIEWS.leadsHistorico],
    ['vw_bi_propostas_historico', DATABRICKS_TEMP_VIEWS.propostasHistorico],
    ['vw_bi_propostas_consolidada', DATABRICKS_TEMP_VIEWS.propostasConsolidada],
    ['vw_bi_cancelamentos', DATABRICKS_TEMP_VIEWS.cancelamentos],
    ['vw_bi_distratos', DATABRICKS_TEMP_VIEWS.distratos],
  ];
  const replacements = {
    vw_bi_comercial_base: DATABRICKS_TEMP_VIEWS.comercialBase,
  };

  for (const [sourceView, tempView] of viewMappings) {
    const definition = replaceViewReferences(
      await getDatabricksViewDefinition(session, sourceView),
      replacements,
    );
    await executeDatabricksCommand(session, `create or replace temporary view ${tempView} as ${definition}`);
    replacements[sourceView] = tempView;
  }
}

function dedupeBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key == null || key === '') continue;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function dedupeBaseRows(rows) {
  return dedupeBy(rows, (row) => row.fato_jornada_comercial_key ?? row.journey_id ?? row.journey_key);
}

function maxDateValue(rows, column) {
  let max = null;
  for (const row of rows || []) {
    const value = row[column];
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!max || date > max) max = date;
  }
  return max ? max.toISOString() : null;
}

function baseFreshness(rows) {
  return {
    max_dt_cadastro_reserva: maxDateValue(rows, 'dt_cadastro_reserva'),
    max_dt_contrato_contabilizado: maxDateValue(rows, 'dt_contrato_contabilizado'),
    max_dt_assinatura_contrato: maxDateValue(rows, 'dt_assinatura_contrato'),
    max_data_venda: maxDateValue(rows, 'data_venda'),
  };
}

const isoDate = (date) => date.toISOString().slice(0, 10);

function monthWindowsBack(monthsBack = 37) {
  const now = new Date();
  const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const windows = [];
  for (let index = monthsBack; index >= 0; index -= 1) {
    const start = new Date(Date.UTC(firstOfNextMonth.getUTCFullYear(), firstOfNextMonth.getUTCMonth() - index - 1, 1));
    const end = new Date(Date.UTC(firstOfNextMonth.getUTCFullYear(), firstOfNextMonth.getUTCMonth() - index, 1));
    windows.push({ start: isoDate(start), end: isoDate(end) });
  }
  return windows;
}

function comercialBaseWindowPredicate(start, end) {
  const range = (expr) => `(${expr} >= date '${start}' and ${expr} < date '${end}')`;
  return `(
    ${range('coalesce(b.dt_lead, b.dt_ultima_conversao_lead)')}
    or ${range('coalesce(b.dt_visita, b.dt_visita_realizada)')}
    or ${range('b.dt_cadastro_reserva')}
    or ${range('b.dt_contrato_contabilizado')}
    or ${range('b.dt_venda_finalizada')}
    or ${range('coalesce(b.dt_repasse, b.dt_assinatura_contrato)')}
    or ${range('b.dt_cancelamento_reserva')}
    or ${range('b.data_venda')}
  )`;
}

async function fetchDatabricksRows() {
  const dbsql = new DBSQLClient();
  const conn = await dbsql.connect(databricksConfig());
  const session = await conn.openSession();

  try {
    await prepareDatabricksSessionViews(session);

    const baseRowsByKey = new Map();
    let baseRawTotal = 0;
    const fetchComercialBaseWindow = (predicate) => executeView(session, `
      select
        b.* except (
          reserva_campos_adicionais_data_qr,
          reserva_campos_adicionais_reserva_repasse_no_mes,
          reserva_campos_adicionais_reserva_kit_cef,
          reserva_campos_adicionais_reserva_kit_agehab,
          reserva_campos_adicionais_reserva_obs_finalizacao,
          repasse_campos_adicionais_repasse_data_envio_cehop,
          repasse_campos_adicionais_repasse_data_conformidade_cehop,
          repasse_campos_adicionais_repasse_data_da_inconformidade_cehop,
          repasse_campos_adicionais_repasse_data_do_reenvio_cehop,
          repasse_campos_adicionais_repasse_probabilidade_de_assinatura
        ),
        coalesce(car.reserva_campos_adicionais_data_qr, b.reserva_campos_adicionais_data_qr) as reserva_campos_adicionais_data_qr,
        coalesce(car.reserva_campos_adicionais_reserva_repasse_no_mes, b.reserva_campos_adicionais_reserva_repasse_no_mes) as reserva_campos_adicionais_reserva_repasse_no_mes,
        coalesce(car.reserva_campos_adicionais_reserva_kit_cef, b.reserva_campos_adicionais_reserva_kit_cef) as reserva_campos_adicionais_reserva_kit_cef,
        coalesce(car.reserva_campos_adicionais_reserva_kit_agehab, b.reserva_campos_adicionais_reserva_kit_agehab) as reserva_campos_adicionais_reserva_kit_agehab,
        coalesce(car.reserva_campos_adicionais_reserva_obs_finalizacao, b.reserva_campos_adicionais_reserva_obs_finalizacao) as reserva_campos_adicionais_reserva_obs_finalizacao,
        coalesce(cap.repasse_campos_adicionais_repasse_data_envio_cehop, b.repasse_campos_adicionais_repasse_data_envio_cehop) as repasse_campos_adicionais_repasse_data_envio_cehop,
        coalesce(cap.repasse_campos_adicionais_repasse_data_conformidade_cehop, b.repasse_campos_adicionais_repasse_data_conformidade_cehop) as repasse_campos_adicionais_repasse_data_conformidade_cehop,
        coalesce(cap.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop, b.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop) as repasse_campos_adicionais_repasse_data_da_inconformidade_cehop,
        coalesce(cap.repasse_campos_adicionais_repasse_data_do_reenvio_cehop, b.repasse_campos_adicionais_repasse_data_do_reenvio_cehop) as repasse_campos_adicionais_repasse_data_do_reenvio_cehop,
        coalesce(cap.repasse_campos_adicionais_repasse_probabilidade_de_assinatura, b.repasse_campos_adicionais_repasse_probabilidade_de_assinatura) as repasse_campos_adicionais_repasse_probabilidade_de_assinatura,
        dl.nome_lead as dim_lead_cliente_nome,
        b.cliente_email as dim_lead_cliente_email,
        b.cliente_documento as dim_lead_cliente_documento,
        dl.origem_nome as dim_lead_origem_nome,
        dl.cidade as dim_lead_cidade,
        dl.estado as dim_lead_estado,
        dl.regiao as dim_lead_regiao,
        dl.situacao_nome as dim_lead_situacao_nome,
        b.sdr_nome as dim_lead_sdr_nome,
        dl.dt_cadastro_lead as dim_lead_dt_lead,
        b.dt_visita as dim_lead_dt_visita
      from ${DATABRICKS_TEMP_VIEWS.comercialBase} b
      left join ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_lead dl on dl.idlead = b.idlead
      left join ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.cvcrm_campos_adicionais_reserva_wide car on car.idreserva = b.idreserva
      left join ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.cvcrm_campos_adicionais_repasse_wide cap on cap.idrepasse = b.idrepasse
      where ${predicate}
    `, 'comercial_base');

    for (const window of monthWindowsBack()) {
      const chunkRows = await fetchComercialBaseWindow(comercialBaseWindowPredicate(window.start, window.end));
      baseRawTotal += chunkRows.length;
      for (const row of chunkRows) {
        const key = row.fato_jornada_comercial_key ?? row.journey_id ?? row.journey_key;
        if (key == null || key === '') continue;
        if (!baseRowsByKey.has(key)) baseRowsByKey.set(key, row);
      }
      console.log(`comercial_base janela ${window.start}..${window.end}: acumulado=${baseRowsByKey.size}`);
    }
    const comercial_base = [...baseRowsByKey.values()];
    if (comercial_base.length !== baseRawTotal) {
      console.log(`Deduplicacao comercial_base: ${baseRawTotal} -> ${comercial_base.length}`);
    }
    baseRowsByKey.clear();

    const leadsHistoricoRaw = await executeView(session, `
      select
        lh.historico_status_key,
        lh.journey_id,
        lh.journey_anchor_type,
        lh.idlead,
        lh.referencia_data,
        lh.dt_referencia,
        lh.situacao_de,
        lh.situacao_para,
        lh.agendamento_status_grupo,
        coalesce(b.idcorretor_canonico, lh.idcorretor_canonico) as idcorretor_atual,
        coalesce(b.idgestor_canonico, lh.idgestor_canonico) as idgestor,
        coalesce(b.idimobiliaria_canonico, lh.idimobiliaria_canonico) as idimobiliaria,
        coalesce(b.idempreendimento_canonico, lh.idempreendimento_canonico) as idempreendimento,
        coalesce(b.idunidade_canonico, lh.idunidade_canonico) as idunidade
      from ${DATABRICKS_TEMP_VIEWS.leadsHistorico} lh
      left join ${DATABRICKS_TEMP_VIEWS.comercialBase} b on lh.journey_id = b.journey_id
      where lh.dt_referencia >= current_date() - interval 3 years
        and lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
        and lh.idlead is not null
    `, 'comercial_leads_historico');
    const comercial_leads_historico = dedupeBy(
      leadsHistoricoRaw,
      (row) => row.historico_status_key ?? `${row.dt_referencia}|${row.idlead}|${row.idcorretor_atual ?? ''}|${row.agendamento_status_grupo ?? ''}`,
    );

    const comercial_propostas_historico = await executeView(session, `
      select
        p.historico_status_key,
        p.journey_id,
        p.journey_anchor_type,
        p.idlead,
        p.idprecadastro,
        p.idreserva,
        p.idrepasse,
        p.referencia_data,
        p.situacao_de,
        p.situacao_para,
        p.proposta_status_grupo,
        coalesce(b.idcorretor_canonico, p.idcorretor_canonico) as idcorretor_atual,
        coalesce(b.idgestor_canonico, p.idgestor_canonico) as idgestor,
        coalesce(b.idimobiliaria_canonico, p.idimobiliaria_canonico) as idimobiliaria,
        coalesce(b.idempreendimento_canonico, p.idempreendimento_canonico) as idempreendimento,
        coalesce(b.idunidade_canonico, p.idunidade_canonico) as idunidade,
        dp.valor_total,
        dp.valor_aprovado,
        dp.valor_subsidio
      from ${DATABRICKS_TEMP_VIEWS.propostasHistorico} p
      left join ${DATABRICKS_TEMP_VIEWS.comercialBase} b on p.journey_id = b.journey_id
      left join ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_precadastro dp on dp.idprecadastro = p.idprecadastro
      where p.referencia_data >= current_date() - interval 3 years
    `, 'comercial_propostas_historico');

    const propostasConsolidadasRaw = await executeView(session, `
      select
        p.idprecadastro,
        p.journey_id,
        p.dt_ultimo_historico,
        p.dt_ultimo_historico_data,
        p.situacao_ultimo_status,
        p.proposta_status_atual,
        p.proposta_status_consolidado_atual,
        coalesce(b.idcorretor_canonico, p.idcorretor_canonico) as idcorretor_atual,
        coalesce(b.idgestor_canonico, p.idgestor_canonico) as idgestor,
        coalesce(b.idimobiliaria_canonico, p.idimobiliaria_canonico) as idimobiliaria,
        coalesce(b.idempreendimento_canonico, p.idempreendimento_canonico) as idempreendimento,
        coalesce(b.idunidade_canonico, p.idunidade_canonico) as idunidade,
        dp.valor_total,
        dp.valor_aprovado,
        dp.valor_subsidio
      from ${DATABRICKS_TEMP_VIEWS.propostasConsolidada} p
      left join ${DATABRICKS_TEMP_VIEWS.comercialBase} b on p.journey_id = b.journey_id
      left join ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_precadastro dp on dp.idprecadastro = p.idprecadastro
      where p.dt_ultimo_historico_data >= current_date() - interval 3 years
    `, 'comercial_propostas_consolidada');
    const comercial_propostas_consolidada = dedupeBy(propostasConsolidadasRaw, (row) => row.idprecadastro);

    const comercial_cancelamentos = await executeView(session, `
      select
        c.journey_id,
        c.idlead,
        c.idprecadastro,
        c.idreserva,
        c.idrepasse,
        c.data_cancelamento,
        coalesce(b.idcorretor_canonico, c.idcorretor_canonico) as idcorretor_atual,
        coalesce(b.idgestor_canonico, c.idgestor_canonico) as idgestor,
        coalesce(b.idimobiliaria_canonico, c.idimobiliaria_canonico) as idimobiliaria,
        coalesce(b.idempreendimento_canonico, c.idempreendimento_canonico) as idempreendimento,
        coalesce(b.idunidade_canonico, c.idunidade_canonico) as idunidade,
        coalesce(b.corretor_nome_canonico, b.corretor_nome) as corretor_nome,
        b.gestor_nome,
        b.empreendimento_nome,
        b.regiao_empreendimento
      from ${DATABRICKS_TEMP_VIEWS.cancelamentos} c
      left join ${DATABRICKS_TEMP_VIEWS.comercialBase} b on c.journey_id = b.journey_id
      where c.data_cancelamento >= current_date() - interval 3 years
    `, 'comercial_cancelamentos');

    const comercial_distratos = await executeView(session, `
      select
        d.journey_id,
        d.idlead,
        d.idprecadastro,
        d.idreserva,
        d.idrepasse,
        d.referencia_data,
        d.situacao_de,
        d.situacao_para,
        coalesce(b.idcorretor_canonico, d.idcorretor_canonico) as idcorretor_atual,
        coalesce(b.idgestor_canonico, d.idgestor_canonico) as idgestor,
        coalesce(b.idimobiliaria_canonico, d.idimobiliaria_canonico) as idimobiliaria,
        coalesce(b.idempreendimento_canonico, d.idempreendimento_canonico) as idempreendimento,
        coalesce(b.idunidade_canonico, d.idunidade_canonico) as idunidade,
        coalesce(b.corretor_nome_canonico, b.corretor_nome) as corretor_nome,
        b.gestor_nome,
        b.empreendimento_nome,
        b.regiao_empreendimento
      from ${DATABRICKS_TEMP_VIEWS.distratos} d
      left join ${DATABRICKS_TEMP_VIEWS.comercialBase} b on d.journey_id = b.journey_id
      where d.referencia_data >= current_date() - interval 3 years
    `, 'comercial_distratos');

    const dim_empreendimento = await executeView(session, `
      select * from ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_empreendimento
    `, 'dim_empreendimento');

    const dim_corretor = await executeView(session, `
      select distinct
        cast(idcorretor as bigint) as idcorretor,
        cast(email as string) as email,
        cast(nome_corretor as string) as nome_corretor,
        cast(apelido as string) as apelido
      from ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_corretor
      where idcorretor is not null
    `, 'dim_corretor');

    return {
      comercial_base,
      comercial_leads_historico,
      comercial_propostas_historico,
      comercial_propostas_consolidada,
      comercial_cancelamentos,
      comercial_distratos,
      dim_corretor,
      dim_empreendimento,
    };
  } finally {
    await session.close().catch(() => {});
    await conn.close().catch(() => {});
  }
}

async function truncateStaging(client) {
  for (const table of SOURCE_TABLES) {
    await client.query(`truncate ${qualify(TARGET_SCHEMA, `${table}_staging`)}`);
  }
}

async function insertRows(client, table, rows) {
  const columns = await getColumns(client, table);
  if (rows.length === 0) return 0;

  const insertColumns = columns.filter((column) => Object.prototype.hasOwnProperty.call(rows[0], column));
  if (insertColumns.length === 0) {
    throw new Error(`Nenhuma coluna compativel para ${TARGET_SCHEMA}.${table}`);
  }

  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const rowPlaceholders = insertColumns.map((column, columnIndex) => {
        values.push(row[column] ?? null);
        return `$${rowIndex * insertColumns.length + columnIndex + 1}`;
      });
      return `(${rowPlaceholders.join(', ')})`;
    });

    await client.query(
      `
        insert into ${qualify(TARGET_SCHEMA, `${table}_staging`)}
          (${insertColumns.map(quoteIdent).join(', ')})
        values ${placeholders.join(', ')}
      `,
      values,
    );
    inserted += batch.length;
  }

  return inserted;
}

async function promoteStaging(client) {
  for (const table of SOURCE_TABLES) {
    const columns = await getColumns(client, table);
    const staging = `${table}_staging`;
    const columnList = columns.map(quoteIdent).join(', ');

    const { rows: countRows } = await client.query(
      `select count(*)::bigint as total from ${qualify(TARGET_SCHEMA, staging)}`,
    );
    const stagingTotal = Number(countRows[0]?.total || 0);
    if (SOURCE_TABLES.includes(table) && stagingTotal <= 0) {
      throw new Error(`Carga abortada: staging vazio para ${TARGET_SCHEMA}.${staging}`);
    }

    await client.query(`truncate ${qualify(TARGET_SCHEMA, table)}`);
    const result = await client.query(`
      insert into ${qualify(TARGET_SCHEMA, table)} (${columnList})
      select ${columnList}
      from ${qualify(TARGET_SCHEMA, staging)}
    `);
    if (Number(result.rowCount || 0) !== stagingTotal) {
      throw new Error(`Promocao divergente em ${table}: staging=${stagingTotal}, inserted=${result.rowCount}`);
    }
  }
}

async function recomputeKpiDaily(client) {
  const base = qualify(TARGET_SCHEMA, 'comercial_base');
  const kpi = qualify(TARGET_SCHEMA, 'comercial_kpi_daily');
  const leadsHistorico = qualify(TARGET_SCHEMA, 'comercial_leads_historico');
  const propostas = qualify(TARGET_SCHEMA, 'comercial_propostas_consolidada');
  const cancelamentos = qualify(TARGET_SCHEMA, 'comercial_cancelamentos');
  const distratos = qualify(TARGET_SCHEMA, 'comercial_distratos');
  const dimEmpreendimento = qualify(TARGET_SCHEMA, 'dim_empreendimento');
  const funcionario = qualify(CONNECT_SCHEMA, 'funcionario_acesso');

  await client.query(`truncate ${kpi}`);
  await client.query(`
    insert into ${kpi} (
      data, cidade, origem, empreendimento, empreendimento_reduzido, sdr,
      corretor, gerencia, coordenacao, imobiliaria,
      leads, agendamentos, visitas, vendas, repasses,
      sla_finalizacao_sum, sla_finalizacao_count,
      sla_repasse_sum, sla_repasse_count,
      propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
      cancelamentos, distratos
    )
    with base_dim as materialized (
      select
        b.*,
        coalesce(nullif(trim(d.cidade), ''), nullif(trim(b.fonte_lead_cidade), ''), b.lead_cidade) as cidade_dim,
        b.lead_origem_nome as origem_dim,
        coalesce(nullif(trim(d.empreendimento), ''), nullif(trim(b.fonte_empreendimento_nome), ''), nullif(trim(b.empreendimento_nome), '')) as empreendimento_dim,
        coalesce(
          nullif(trim(d.regiao), ''),
          nullif(trim(b.nome_empreendimento_reduzido), ''),
          nullif(trim(b.fonte_nome_empreendimento_reduzido), ''),
          nullif(trim(b.regiao_empreendimento), '')
        ) as empreendimento_reduzido_dim,
        b.sdr_nome as sdr_dim,
        coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), '')) as corretor_dim,
        h.gestor as gerencia_dim,
        h.coordenador as coordenacao_dim,
        h.imobiliaria as imobiliaria_dim
      from ${base} b
      left join lateral (
        select cidade, empreendimento, regiao
        from ${dimEmpreendimento} d
        where d.idempreendimento = coalesce(b.idempreendimento_canonico, b.idempreendimento)
        limit 1
      ) d on true
      left join lateral (
        select gestor, coordenador, imobiliaria
        from ${funcionario} h
        where upper(trim(coalesce(h.tipo_funcionario, ''))) = 'CORRETOR'
          and lower(trim(regexp_replace(coalesce(h.nome, ''), '\\s+-\\s+(CLT|PJ|DESLIGAD[OA]|DEMITID[OA]|INATIV[OA]).*$', '', 'i')))
              = lower(trim(regexp_replace(coalesce(coalesce(nullif(trim(b.corretor_nome_canonico), ''), nullif(trim(b.corretor_nome), '')), ''), '\\s+-\\s+(CLT|PJ|DESLIGAD[OA]|DEMITID[OA]|INATIV[OA]).*$', '', 'i')))
        order by
          coalesce(h.ativo_negocio, h.ativo, false) desc,
          h.ativo desc nulls last,
          h.data_inicio_vigencia desc nulls last,
          h.identificador_funcionario nulls last
        limit 1
      ) h on true
    ),
    base_por_precadastro as materialized (
      select distinct on (idprecadastro)
        idprecadastro, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where idprecadastro is not null
      order by idprecadastro, data_venda desc nulls last, dt_ultima_conversao_lead desc nulls last
    ),
    base_por_journey as materialized (
      select distinct on (journey_id)
        journey_id, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where journey_id is not null
      order by journey_id, dt_ultima_conversao_lead desc nulls last, fato_jornada_comercial_key
    ),
    base_por_lead as materialized (
      select distinct on (idlead)
        idlead, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where idlead is not null
      order by idlead, dt_ultima_conversao_lead desc nulls last, fato_jornada_comercial_key
    ),
    lead_events as (
      select distinct on (dt_ultima_conversao_lead::date, idlead)
        dt_ultima_conversao_lead::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where dt_ultima_conversao_lead is not null and idlead is not null
      order by dt_ultima_conversao_lead::date, idlead, fato_jornada_comercial_key
    ),
    visita_events as (
      select distinct on (dt_visita_realizada::date, idlead)
        dt_visita_realizada::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where dt_visita_realizada is not null and idlead is not null
      order by dt_visita_realizada::date, idlead, fato_jornada_comercial_key
    ),
    agendamento_events as (
      select distinct on (
        lh.dt_referencia,
        lh.idlead,
        coalesce(nullif(trim(coalesce(bj.corretor_dim, bl.corretor_dim)), ''), 'Corretor ' || lh.idcorretor_atual::text, 'Sem corretor')
      )
        lh.dt_referencia as data,
        coalesce(bj.cidade_dim, bl.cidade_dim) as cidade_dim,
        coalesce(bj.origem_dim, bl.origem_dim) as origem_dim,
        coalesce(bj.empreendimento_dim, bl.empreendimento_dim) as empreendimento_dim,
        coalesce(bj.empreendimento_reduzido_dim, bl.empreendimento_reduzido_dim) as empreendimento_reduzido_dim,
        coalesce(bj.sdr_dim, bl.sdr_dim) as sdr_dim,
        coalesce(nullif(trim(coalesce(bj.corretor_dim, bl.corretor_dim)), ''), 'Corretor ' || lh.idcorretor_atual::text, 'Sem corretor') as corretor_dim,
        coalesce(bj.gerencia_dim, bl.gerencia_dim) as gerencia_dim,
        coalesce(bj.coordenacao_dim, bl.coordenacao_dim) as coordenacao_dim,
        coalesce(bj.imobiliaria_dim, bl.imobiliaria_dim) as imobiliaria_dim
      from ${leadsHistorico} lh
      left join base_por_journey bj on lh.journey_id is not null and bj.journey_id = lh.journey_id
      left join base_por_lead bl on bj.journey_id is null and lh.idlead is not null and bl.idlead = lh.idlead
      where lh.dt_referencia is not null
        and lh.idlead is not null
        and lh.agendamento_status_grupo in ('AGENDAMENTO', 'AGENDAMENTO_IA', 'AGENDADO_IA')
      order by
        lh.dt_referencia,
        lh.idlead,
        coalesce(nullif(trim(coalesce(bj.corretor_dim, bl.corretor_dim)), ''), 'Corretor ' || lh.idcorretor_atual::text, 'Sem corretor'),
        lh.historico_status_key
    ),
    venda_events as (
      select distinct on (data_venda::date, idreserva)
        data_venda::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where data_venda is not null and idreserva is not null
      order by data_venda::date, idreserva, fato_jornada_comercial_key
    ),
    repasse_events as (
      select distinct on (dt_assinatura_contrato::date, idrepasse)
        dt_assinatura_contrato::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
      from base_dim
      where dt_assinatura_contrato is not null and idrepasse is not null and fl_repasse_assinado = true
      order by dt_assinatura_contrato::date, idrepasse, fato_jornada_comercial_key
    ),
    sla_finalizacao_events as (
      select
        dt_contrato_contabilizado::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
        sla_finalizacao_dias
      from base_dim
      where dt_contrato_contabilizado is not null and sla_finalizacao_dias is not null
    ),
    sla_repasse_events as (
      select
        dt_assinatura_contrato::date as data,
        cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim,
        corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
        sla_repasse_dias
      from base_dim
      where dt_assinatura_contrato is not null and sla_repasse_dias is not null
    ),
    funil_base as (
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             count(*)::int as leads, 0::int as agendamentos, 0::int as visitas, 0::int as vendas, 0::int as repasses,
             0::numeric as sla_finalizacao_sum, 0::int as sla_finalizacao_count,
             0::numeric as sla_repasse_sum, 0::int as sla_repasse_count
      from lead_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, count(*)::int, 0, 0, 0, 0, 0, 0, 0
      from agendamento_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, 0, count(*)::int, 0, 0, 0, 0, 0, 0
      from visita_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, 0, 0, count(*)::int, 0, 0, 0, 0, 0
      from venda_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, 0, 0, 0, count(*)::int, 0, 0, 0, 0
      from repasse_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, 0, 0, 0, 0, coalesce(sum(sla_finalizacao_dias), 0), count(*)::int, 0, 0
      from sla_finalizacao_events
      group by 1,2,3,4,5,6,7,8,9,10
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0, 0, 0, 0, 0, 0, 0, coalesce(sum(sla_repasse_dias), 0), count(*)::int
      from sla_repasse_events
      group by 1,2,3,4,5,6,7,8,9,10
    ),
    funil as (
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             sum(leads)::int as leads, sum(agendamentos)::int as agendamentos, sum(visitas)::int as visitas, sum(vendas)::int as vendas, sum(repasses)::int as repasses,
             sum(sla_finalizacao_sum) as sla_finalizacao_sum, sum(sla_finalizacao_count)::int as sla_finalizacao_count,
             sum(sla_repasse_sum) as sla_repasse_sum, sum(sla_repasse_count)::int as sla_repasse_count
      from funil_base
      group by 1,2,3,4,5,6,7,8,9,10
    ),
    propostas_agregadas as (
      select
        pc.dt_ultimo_historico_data as data,
        b.cidade_dim, b.origem_dim, b.empreendimento_dim, b.empreendimento_reduzido_dim, b.sdr_dim,
        b.corretor_dim, b.gerencia_dim, b.coordenacao_dim, b.imobiliaria_dim,
        count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'APROVADA')::int as propostas_aprovadas,
        count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'CONDICIONADA')::int as propostas_condicionadas,
        count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual = 'REPROVADA')::int as propostas_reprovadas,
        count(distinct pc.idprecadastro) filter (where pc.proposta_status_atual in ('APROVADA','CONDICIONADA','REPROVADA'))::int as propostas_total
      from ${propostas} pc
      left join base_por_precadastro b on b.idprecadastro = pc.idprecadastro
      where pc.dt_ultimo_historico_data is not null
      group by 1,2,3,4,5,6,7,8,9,10
    ),
    cancelamentos_agregados as (
      select
        cc.data_cancelamento::date as data,
        b.cidade_dim, b.origem_dim, b.empreendimento_dim, b.empreendimento_reduzido_dim, b.sdr_dim,
        b.corretor_dim, b.gerencia_dim, b.coordenacao_dim, b.imobiliaria_dim,
        count(distinct cc.idreserva)::int as cancelamentos
      from ${cancelamentos} cc
      left join lateral (
        select cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
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
        b.cidade_dim, b.origem_dim, b.empreendimento_dim, b.empreendimento_reduzido_dim, b.sdr_dim,
        b.corretor_dim, b.gerencia_dim, b.coordenacao_dim, b.imobiliaria_dim,
        count(distinct cd.idreserva)::int as distratos
      from ${distratos} cd
      left join lateral (
        select cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim
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
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             leads, agendamentos, visitas, vendas, repasses,
             sla_finalizacao_sum, sla_finalizacao_count, sla_repasse_sum, sla_repasse_count,
             0::int as propostas_aprovadas, 0::int as propostas_condicionadas, 0::int as propostas_reprovadas, 0::int as propostas_total,
             0::int as cancelamentos, 0::int as distratos
      from funil
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0,0,0,0,0,0,0,0,0,
             propostas_aprovadas, propostas_condicionadas, propostas_reprovadas, propostas_total,
             0,0
      from propostas_agregadas
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0,0,0,0,0,0,0,0,0,
             0,0,0,0,
             cancelamentos,0
      from cancelamentos_agregados
      union all
      select data, cidade_dim, origem_dim, empreendimento_dim, empreendimento_reduzido_dim, sdr_dim, corretor_dim, gerencia_dim, coordenacao_dim, imobiliaria_dim,
             0,0,0,0,0,0,0,0,0,
             0,0,0,0,
             0,distratos
      from distratos_agregados
    )
    select
      data,
      cidade_dim,
      origem_dim,
      empreendimento_dim,
      empreendimento_reduzido_dim,
      sdr_dim,
      corretor_dim,
      gerencia_dim,
      coordenacao_dim,
      imobiliaria_dim,
      sum(leads)::int,
      sum(agendamentos)::int,
      sum(visitas)::int,
      sum(vendas)::int,
      sum(repasses)::int,
      sum(sla_finalizacao_sum),
      sum(sla_finalizacao_count)::int,
      sum(sla_repasse_sum),
      sum(sla_repasse_count)::int,
      sum(propostas_aprovadas)::int,
      sum(propostas_condicionadas)::int,
      sum(propostas_reprovadas)::int,
      sum(propostas_total)::int,
      sum(cancelamentos)::int,
      sum(distratos)::int
    from linhas
    group by 1,2,3,4,5,6,7,8,9,10
  `);

  const { rows } = await client.query(`select count(*)::bigint as total from ${kpi}`);
  return Number(rows[0]?.total || 0);
}

async function run({ dryRun = false } = {}) {
  requireConfig();
  const startedAt = Date.now();
  const counts = {};
  const pool = new Pool(pgConfig());
  const client = await pool.connect();
  let logId = null;

  try {
    await ensureRuntimeObjects(client);
    logId = await beginLog(client);

    const lock = await client.query('select pg_try_advisory_lock($1) as locked', [LOCK_ID]);
    if (!lock.rows[0]?.locked) {
      throw new Error('Outra carga direta Databricks -> connect_comercial ja esta em execucao.');
    }

    const rowsByTable = await fetchDatabricksRows();
    for (const table of SOURCE_TABLES) {
      counts[table] = { source: rowsByTable[table]?.length || 0 };
    }
    counts.comercial_base.freshness = baseFreshness(rowsByTable.comercial_base);

    if (dryRun) {
      await finishLog(client, logId, 'dry_run', counts, startedAt, 'Dry-run concluido sem escrita.');
      return { status: 'dry_run', tables: counts };
    }

    await client.query('begin');
    try {
      await truncateStaging(client);
      for (const table of SOURCE_TABLES) {
        counts[table].staging = await insertRows(client, table, rowsByTable[table] || []);
        if (counts[table].staging !== counts[table].source) {
          throw new Error(`Divergencia staging em ${table}: source=${counts[table].source}, staging=${counts[table].staging}`);
        }
      }
      await promoteStaging(client);
      counts.comercial_kpi_daily = { target: await recomputeKpiDaily(client), derived: true };
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }

    await finishLog(client, logId, 'success', counts, startedAt, 'Carga direta Databricks -> connect_comercial concluida.');
    return { status: 'success', tables: counts };
  } catch (error) {
    if (logId) {
      await finishLog(client, logId, 'error', counts, startedAt, error?.message || String(error)).catch(() => {});
    }
    throw error;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
    await pool.end();
  }
}

const dryRun = process.argv.includes('--dry-run');

run({ dryRun })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
