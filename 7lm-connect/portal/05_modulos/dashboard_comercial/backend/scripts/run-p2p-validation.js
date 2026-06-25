import { DBSQLClient } from '@databricks/sql';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const env = {
  databricksCatalog: process.env.DATABRICKS_CATALOG || 'data_platform_dev',
  databricksGoldSchema: process.env.DATABRICKS_SCHEMA || 'gold_cvcrm',
  databricksSilverSchema: process.env.DATABRICKS_SILVER_SCHEMA || 'silver_cvcrm',
  databricksBronzeSchema: process.env.DATABRICKS_BRONZE_SCHEMA || 'bronze',
  includeBronzeChecks: String(process.env.VALIDATION_INCLUDE_BRONZE || 'false').toLowerCase() === 'true',
  databricksToken: process.env.DATABRICKS_TOKEN,
  databricksHost: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
  databricksPath: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH,
  apiBaseUrl: process.env.VALIDATION_API_BASE_URL || '',
  outDir: process.env.VALIDATION_OUTPUT_DIR || path.resolve(__dirname, '../reports'),
};

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function defaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: formatDate(start), end: formatDate(end) };
}

function getRange() {
  const fallback = defaultRange();
  const start = process.env.VALIDATION_START_DATE || fallback.start;
  const end = process.env.VALIDATION_END_DATE || fallback.end;

  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('VALIDATION_START_DATE e VALIDATION_END_DATE devem estar no formato YYYY-MM-DD.');
  }
  if (start > end) {
    throw new Error('VALIDATION_START_DATE nao pode ser maior que VALIDATION_END_DATE.');
  }

  return { start, end };
}

function quoteDate(dateText) {
  return `DATE '${dateText}'`;
}

function num(value) {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fixed(value, digits) {
  return Number(num(value).toFixed(digits));
}

async function withDatabricksSession(fn) {
  const client = new DBSQLClient();
  const conn = await client.connect({
    token: env.databricksToken,
    host: env.databricksHost,
    path: env.databricksPath,
  });
  const session = await conn.openSession({
    initialCatalog: env.databricksCatalog,
    initialSchema: env.databricksGoldSchema,
  });

  try {
    return await fn(session);
  } finally {
    await session.close().catch(() => {});
    await conn.close().catch(() => {});
  }
}

async function dbxQuery(session, sql) {
  const op = await session.executeStatement(sql, { runAsync: true });
  try {
    return await op.fetchAll();
  } finally {
    await op.close().catch(() => {});
  }
}

async function runDatabricksChecks(start, end) {
  return withDatabricksSession(async (session) => {
    const entities = [
      { table: 'leads', id: 'idlead' },
      { table: 'precadastros', id: 'idprecadastro' },
      { table: 'reservas', id: 'idreserva' },
      { table: 'repasses', id: 'idrepasse' },
    ];

    const layerStats = [];
    const layers = [
      { schema: env.databricksSilverSchema, name: 'silver' },
    ];

    if (env.includeBronzeChecks) {
      layers.unshift({ schema: env.databricksBronzeSchema, name: 'bronze' });
    }

    for (const layer of layers) {
      for (const e of entities) {
        const sql = `
          SELECT
            '${layer.name}.${e.table}' AS camada_entidade,
            COUNT(*) AS total_linhas,
            COUNT(DISTINCT ${e.id}) AS ids_distintos,
            MAX(dt_ingestion) AS max_dt_ingestion
          FROM ${env.databricksCatalog}.${layer.schema}.${e.table}
        `;

        try {
          const rows = await dbxQuery(session, sql);
          layerStats.push(rows[0]);
        } catch (err) {
          layerStats.push({
            camada_entidade: `${layer.name}.${e.table}`,
            total_linhas: null,
            ids_distintos: null,
            max_dt_ingestion: null,
            erro: err?.message || String(err),
          });
        }
      }
    }

    const qualityRows = await dbxQuery(session, `
      SELECT
        COUNT(*) AS jornadas,
        COUNT_IF(dt_ultima_conversao_lead IS NOT NULL) AS com_lead_conversao,
        COUNT_IF(dt_visita_realizada IS NOT NULL) AS com_visita,
        COUNT_IF(dt_cancelamento_reserva IS NOT NULL) AS com_cancelamento,
        COUNT_IF(dt_assinatura_contrato IS NOT NULL) AS com_assinatura,
        COUNT_IF(fl_repasse_assinado) AS repasse_flag_true,
        MIN(sla_finalizacao_dias) AS min_sla_f,
        MAX(sla_finalizacao_dias) AS max_sla_f,
        MIN(sla_repasse_dias) AS min_sla_r,
        MAX(sla_repasse_dias) AS max_sla_r
      FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.fato_jornada_comercial
    `);

    const kpiRows = await dbxQuery(session, `
      WITH base_summary AS (
        SELECT
          COUNT(DISTINCT CASE
            WHEN TO_DATE(COALESCE(dt_lead, dt_ultima_conversao_lead)) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND idlead IS NOT NULL THEN idlead END) AS leads,
          COUNT(DISTINCT CASE
            WHEN TO_DATE(dt_visita) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND idlead IS NOT NULL THEN idlead END) AS visitas,
          COUNT(DISTINCT CASE
            WHEN TO_DATE(dt_cadastro_reserva) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND idreserva IS NOT NULL
            THEN CONCAT(
              DATE_FORMAT(TO_DATE(dt_cadastro_reserva), 'yyyy-MM'),
              '|',
              COALESCE(
                CAST(idcliente_canonico AS STRING),
                NULLIF(REGEXP_REPLACE(COALESCE(cliente_documento, dim_lead_cliente_documento, ''), '\\\\D', ''), ''),
                CAST(idreserva AS STRING)
              )
            ) END) AS vendas,
          COUNT(DISTINCT CASE
            WHEN TO_DATE(COALESCE(dt_repasse, dt_assinatura_contrato)) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND fl_repasse_assinado = true THEN idrepasse END) AS repasses,
          AVG(CASE WHEN TO_DATE(dt_contrato_contabilizado) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)} THEN sla_finalizacao_dias END) AS sla_f,
          AVG(CASE WHEN TO_DATE(COALESCE(dt_repasse, dt_assinatura_contrato)) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)} THEN sla_repasse_dias END) AS sla_r
        FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_comercial_base
      ),
      propostas AS (
        SELECT
          COUNT(DISTINCT CASE
            WHEN dt_ultimo_historico_data BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND proposta_status_atual = 'APROVADA' THEN idprecadastro END) AS propostas_aprovadas,
          COUNT(DISTINCT CASE
            WHEN dt_ultimo_historico_data BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA') THEN idprecadastro END) AS propostas_total
        FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_propostas_consolidada
      ),
      eventos AS (
        SELECT
          (SELECT COUNT(DISTINCT idreserva)
           FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_cancelamentos
             WHERE TO_DATE(data_cancelamento) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}) AS cancelamentos,
          (SELECT COUNT(DISTINCT idreserva)
           FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_distratos
             WHERE TO_DATE(referencia_data) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}) AS distratos
      ),
      ipc AS (
        SELECT
          COUNT(DISTINCT CASE
            WHEN TO_DATE(COALESCE(dt_repasse, dt_assinatura_contrato)) BETWEEN ${quoteDate(start)} AND ${quoteDate(end)}
             AND fl_repasse_assinado = true THEN idrepasse END) AS repasses_assinados,
          (
            SELECT COUNT(DISTINCT documento)
            FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.corretores_ativos
            WHERE LOWER(COALESCE(ativo_negocio, '')) = 's'
              AND TO_DATE(mes_referencia) = CAST(DATE_TRUNC('month', ${quoteDate(end)}) AS DATE)
          ) AS corretores_ativos
        FROM ${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_comercial_base
      )
      SELECT
        b.leads,
        b.visitas,
        p.propostas_aprovadas,
        p.propostas_total,
        b.vendas,
        b.repasses,
        e.cancelamentos,
        e.distratos,
        ROUND(COALESCE(b.sla_f, 0), 1) AS sla_f,
        ROUND(COALESCE(b.sla_r, 0), 1) AS sla_r,
        ROUND(COALESCE(i.repasses_assinados / NULLIF(i.corretores_ativos, 0), 0), 2) AS ipc,
        i.repasses_assinados,
        i.corretores_ativos
      FROM base_summary b
      CROSS JOIN propostas p
      CROSS JOIN eventos e
      CROSS JOIN ipc i
    `);

    return {
      layerStats,
      quality: qualityRows[0] || {},
      kpis: kpiRows[0] || {},
    };
  });
}

async function runPostgresChecks(start, end) {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'comercial_base'
    `);
    const columns = new Set(columnsResult.rows.map((r) => r.column_name));
    const dateExpr = (canonicalCol, legacyCol) => {
      const hasCanonical = columns.has(canonicalCol);
      const hasLegacy = columns.has(legacyCol);

      if (hasCanonical && hasLegacy) return `COALESCE(${canonicalCol}, ${legacyCol})`;
      if (hasCanonical) return canonicalCol;
      if (hasLegacy) return legacyCol;
      return 'NULL';
    };

    const leadDateExpr = dateExpr('dt_lead', 'dt_ultima_conversao_lead');
    const visitaDateExpr = dateExpr('dt_visita', 'dt_visita_realizada');
    const vendaDateExpr = 'dt_cadastro_reserva';
    const repasseDateExpr = dateExpr('dt_repasse', 'dt_assinatura_contrato');

    const q = `
      WITH base_summary AS (
        SELECT
          COUNT(DISTINCT idlead) FILTER (WHERE ${leadDateExpr}::date BETWEEN $1 AND $2 AND idlead IS NOT NULL) AS leads,
          COUNT(DISTINCT idlead) FILTER (WHERE ${visitaDateExpr}::date BETWEEN $1 AND $2 AND idlead IS NOT NULL) AS visitas,
          COUNT(DISTINCT concat(to_char(date_trunc('month', dt_cadastro_reserva), 'YYYY-MM'), '|', coalesce(idcliente_canonico::text, nullif(regexp_replace(coalesce(cliente_documento, dim_lead_cliente_documento, ''), '\\D', '', 'g'), ''), idreserva::text))) FILTER (
            WHERE ${vendaDateExpr}::date BETWEEN $1 AND $2
              AND idreserva IS NOT NULL
          ) AS vendas,
          COUNT(DISTINCT idrepasse) FILTER (
            WHERE ${repasseDateExpr}::date BETWEEN $1 AND $2
              AND fl_repasse_assinado = true
          ) AS repasses,
          AVG(sla_finalizacao_dias) FILTER (WHERE dt_contrato_contabilizado::date BETWEEN $1 AND $2) AS sla_f,
          AVG(sla_repasse_dias) FILTER (WHERE ${repasseDateExpr}::date BETWEEN $1 AND $2) AS sla_r
        FROM comercial_base
      ),
      propostas AS (
        SELECT
          COUNT(DISTINCT idprecadastro) FILTER (
            WHERE dt_ultimo_historico_data BETWEEN $1 AND $2
              AND proposta_status_atual = 'APROVADA'
          ) AS propostas_aprovadas,
          COUNT(DISTINCT idprecadastro) FILTER (
            WHERE dt_ultimo_historico_data BETWEEN $1 AND $2
              AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
          ) AS propostas_total
        FROM comercial_propostas_consolidada
      ),
      eventos AS (
        SELECT
          (SELECT COUNT(DISTINCT idreserva) FROM comercial_cancelamentos WHERE data_cancelamento::date BETWEEN $1 AND $2) AS cancelamentos,
          (SELECT COUNT(DISTINCT idreserva) FROM comercial_distratos WHERE referencia_data::date BETWEEN $1 AND $2) AS distratos
      ),
      ipc AS (
        SELECT
          COUNT(DISTINCT b.idrepasse) FILTER (WHERE ${repasseDateExpr}::date BETWEEN $1 AND $2 AND b.fl_repasse_assinado = true) AS repasses_assinados,
          (
            SELECT COUNT(DISTINCT h.documento)
            FROM public.vw_hierarquia_cvcrm h
            WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
              AND h.mes_referencia = DATE_TRUNC('month', $2::date)::date
          ) AS corretores_ativos
        FROM comercial_base b
      )
      SELECT
        b.leads,
        b.visitas,
        p.propostas_aprovadas,
        p.propostas_total,
        b.vendas,
        b.repasses,
        e.cancelamentos,
        e.distratos,
        ROUND(COALESCE(b.sla_f, 0)::numeric, 1) AS sla_f,
        ROUND(COALESCE(b.sla_r, 0)::numeric, 1) AS sla_r,
        ROUND(COALESCE(i.repasses_assinados::numeric / NULLIF(i.corretores_ativos, 0), 0), 2) AS ipc,
        i.repasses_assinados,
        i.corretores_ativos
      FROM base_summary b
      CROSS JOIN propostas p
      CROSS JOIN eventos e
      CROSS JOIN ipc i
    `;

    const result = await pool.query(q, [start, end]);
    return result.rows[0] || {};
  } finally {
    await pool.end();
  }
}

async function runApiSmoke(start, end) {
  if (!env.apiBaseUrl) {
    return { skipped: true, reason: 'VALIDATION_API_BASE_URL nao informado' };
  }

  const base = env.apiBaseUrl.replace(/\/$/, '');
  const summaryUrl = `${base}/api/v1/dashboard/summary?startDate=${start}&endDate=${end}`;
  const filtersUrl = `${base}/api/v1/dashboard/filters?startDate=${start}&endDate=${end}`;

  let summaryResp;
  let filtersResp;

  try {
    summaryResp = await fetch(summaryUrl);
    filtersResp = await fetch(filtersUrl);
  } catch (err) {
    return {
      skipped: true,
      reason: `API indisponivel em ${base}: ${err?.message || String(err)}`,
    };
  }

  if (!summaryResp.ok) {
    throw new Error(`Falha no endpoint summary (${summaryResp.status})`);
  }
  const summary = await summaryResp.json();

  if (!filtersResp.ok) {
    throw new Error(`Falha no endpoint filters (${filtersResp.status})`);
  }
  const filters = await filtersResp.json();

  const pickOption = (options, excluded = ['todos', 'todas', '__blank__']) => {
    if (!Array.isArray(options)) return null;
    return options.find((item) => {
      const value = String(item?.value ?? '').trim();
      return value && !excluded.includes(value);
    }) ?? null;
  };

  const cityOption = pickOption(filters?.cidade, ['todas', '__blank__']);
  const empreendimentoOption = pickOption(filters?.empreendimento, ['todos', '__blank__']);
  const regiaoOption = pickOption(filters?.empreendimentoReduzido, ['todos', '__blank__']);

  const checks = [];

  if (cityOption) {
    const sampleUrl = `${summaryUrl}&cidade=${encodeURIComponent(cityOption.value)}`;
    const sampleResp = await fetch(sampleUrl);
    checks.push({
      field: 'cidade',
      value: cityOption.value,
      status: sampleResp.status,
      ok: sampleResp.ok,
    });
  }

  if (empreendimentoOption) {
    const sampleUrl = `${summaryUrl}&empreendimento=${encodeURIComponent(empreendimentoOption.value)}`;
    const sampleResp = await fetch(sampleUrl);
    checks.push({
      field: 'empreendimento',
      value: empreendimentoOption.value,
      status: sampleResp.status,
      ok: sampleResp.ok,
    });
  }

  if (regiaoOption) {
    const sampleUrl = `${summaryUrl}&empreendimentoReduzido=${encodeURIComponent(regiaoOption.value)}`;
    const sampleResp = await fetch(sampleUrl);
    checks.push({
      field: 'empreendimentoReduzido',
      value: regiaoOption.value,
      status: sampleResp.status,
      ok: sampleResp.ok,
    });
  }

  return {
    skipped: false,
    summary,
    checks,
    filterOptionCounts: {
      cidade: Array.isArray(filters?.cidade) ? filters.cidade.length : 0,
      empreendimento: Array.isArray(filters?.empreendimento) ? filters.empreendimento.length : 0,
      empreendimentoReduzido: Array.isArray(filters?.empreendimentoReduzido) ? filters.empreendimentoReduzido.length : 0,
    },
  };
}

function compareKpis(databricksKpi, postgresKpi, apiSummary) {
  const mapping = [
    { id: 'leads', dbx: 'leads', pg: 'leads', api: 'total_leads', tolerance: 0 },
    { id: 'visitas', dbx: 'visitas', pg: 'visitas', api: 'total_visitas', tolerance: 0 },
    { id: 'propostas_aprovadas', dbx: 'propostas_aprovadas', pg: 'propostas_aprovadas', api: 'total_propostas_aprovadas', tolerance: 0 },
    { id: 'propostas_total', dbx: 'propostas_total', pg: 'propostas_total', api: 'total_propostas_geral', tolerance: 0 },
    { id: 'vendas', dbx: 'vendas', pg: 'vendas', api: 'total_vendas', tolerance: 0 },
    { id: 'repasses', dbx: 'repasses', pg: 'repasses', api: 'total_repasses', tolerance: 0 },
    { id: 'cancelamentos', dbx: 'cancelamentos', pg: 'cancelamentos', api: 'total_cancelamentos', tolerance: 0 },
    { id: 'distratos', dbx: 'distratos', pg: 'distratos', api: 'total_distratos', tolerance: 0 },
    { id: 'sla_f', dbx: 'sla_f', pg: 'sla_f', api: 'total_sla_finalizacao', tolerance: 0.1 },
    { id: 'sla_r', dbx: 'sla_r', pg: 'sla_r', api: 'total_sla_repasse', tolerance: 0.1 },
    { id: 'ipc', dbx: 'ipc', pg: 'ipc', api: 'total_ipc', tolerance: 0.01 },
  ];

  return mapping.map((m) => {
    const vDbx = num(databricksKpi[m.dbx]);
    const vPg = num(postgresKpi[m.pg]);
    const vApi = apiSummary ? num(apiSummary[m.api]) : null;

    const diffDbxPg = Math.abs(vDbx - vPg);
    const diffPgApi = vApi == null ? null : Math.abs(vPg - vApi);

    const okDbxPg = diffDbxPg <= m.tolerance;
    const okPgApi = diffPgApi == null ? true : diffPgApi <= m.tolerance;

    return {
      kpi: m.id,
      dbx: vDbx,
      pg: vPg,
      api: vApi,
      diff_dbx_pg: fixed(diffDbxPg, 4),
      diff_pg_api: diffPgApi == null ? null : fixed(diffPgApi, 4),
      tolerance: m.tolerance,
      status: okDbxPg && okPgApi ? 'OK' : 'DIVERGENTE',
    };
  });
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Relatorio de Validacao P2P (Bronze -> Silver -> Gold -> Backend/API)');
  lines.push('');
  lines.push(`- Data de execucao: ${report.executedAt}`);
  lines.push(`- Janela: ${report.range.start} ate ${report.range.end}`);
  lines.push(`- Catalog/Gold: ${env.databricksCatalog}.${env.databricksGoldSchema}`);
  lines.push('');

  lines.push('## 1) Sanidade Bronze/Silver');
  lines.push('');
  lines.push('| Camada.Entidade | Total | Distintos | Max dt_ingestion | Status |');
  lines.push('|---|---:|---:|---|---|');
  report.databricks.layerStats.forEach((r) => {
    const status = r.erro ? `ERRO: ${r.erro}` : 'OK';
    lines.push(`| ${r.camada_entidade} | ${r.total_linhas ?? '-'} | ${r.ids_distintos ?? '-'} | ${r.max_dt_ingestion ?? '-'} | ${status} |`);
  });
  lines.push('');

  lines.push('## 2) Qualidade Gold Foundation');
  lines.push('');
  const q = report.databricks.quality;
  lines.push(`- Jornadas: ${q.jornadas ?? 0}`);
  lines.push(`- Com conversao lead: ${q.com_lead_conversao ?? 0}`);
  lines.push(`- Com visita: ${q.com_visita ?? 0}`);
  lines.push(`- Com cancelamento: ${q.com_cancelamento ?? 0}`);
  lines.push(`- Com assinatura: ${q.com_assinatura ?? 0}`);
  lines.push(`- min/max SLA Finalizacao: ${q.min_sla_f ?? '-'} / ${q.max_sla_f ?? '-'}`);
  lines.push(`- min/max SLA Repasse: ${q.min_sla_r ?? '-'} / ${q.max_sla_r ?? '-'}`);
  lines.push('');

  lines.push('## 3) Reconciliacao de KPIs');
  lines.push('');
  lines.push('| KPI | Databricks Gold | Postgres Backend | API Summary | Diff DBX-PG | Diff PG-API | Tolerancia | Status |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|');
  report.comparison.forEach((r) => {
    lines.push(`| ${r.kpi} | ${r.dbx} | ${r.pg} | ${r.api ?? '-'} | ${r.diff_dbx_pg} | ${r.diff_pg_api ?? '-'} | ${r.tolerance} | ${r.status} |`);
  });
  lines.push('');

  lines.push('## 4) Smoke test API');
  lines.push('');
  if (report.api.skipped) {
    lines.push(`- API: SKIPPED (${report.api.reason})`);
  } else {
    lines.push('- API summary: OK');
    lines.push(`- Contagem de opcoes: cidade=${report.api.filterOptionCounts?.cidade ?? 0}, empreendimento=${report.api.filterOptionCounts?.empreendimento ?? 0}, regiao=${report.api.filterOptionCounts?.empreendimentoReduzido ?? 0}`);
    if (!Array.isArray(report.api.checks) || report.api.checks.length === 0) {
      lines.push('- API filtros exemplo: SKIPPED (sem opcoes validas retornadas pelo endpoint)');
    } else {
      report.api.checks.forEach((check) => {
        lines.push(`- API filtro exemplo (${check.field}=${check.value}): status=${check.status}, ok=${check.ok}`);
      });
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const range = getRange();
  const databricks = await runDatabricksChecks(range.start, range.end);
  const postgres = await runPostgresChecks(range.start, range.end);
  const api = await runApiSmoke(range.start, range.end);

  const comparison = compareKpis(databricks.kpis, postgres, api.skipped ? null : api.summary);
  const hasDivergence = comparison.some((r) => r.status !== 'OK');

  const report = {
    executedAt: new Date().toISOString(),
    range,
    databricks,
    postgres,
    api,
    comparison,
    status: hasDivergence ? 'FAIL' : 'OK',
  };

  await fs.mkdir(env.outDir, { recursive: true });
  const stamp = report.executedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(env.outDir, `validation-p2p-${stamp}.json`);
  const mdPath = path.join(env.outDir, `validation-p2p-${stamp}.md`);
  const latestJsonPath = path.join(env.outDir, 'validation-p2p-latest.json');
  const latestMdPath = path.join(env.outDir, 'validation-p2p-latest.md');

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(mdPath, toMarkdown(report), 'utf8');
  await fs.writeFile(latestJsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(latestMdPath, toMarkdown(report), 'utf8');

  console.log(`\n[VALIDACAO P2P] Status: ${report.status}`);
  console.log(`[VALIDACAO P2P] JSON: ${jsonPath}`);
  console.log(`[VALIDACAO P2P] MD  : ${mdPath}`);
  console.log(`[VALIDACAO P2P] JSON (latest): ${latestJsonPath}`);
  console.log(`[VALIDACAO P2P] MD   (latest): ${latestMdPath}`);

  if (hasDivergence) {
    console.error('[VALIDACAO P2P] Divergencias encontradas nos KPIs.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[VALIDACAO P2P] Erro fatal:', err?.message || err);
  process.exitCode = 1;
});
