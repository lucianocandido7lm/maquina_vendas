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

const env = {
  databricksCatalog: process.env.DATABRICKS_CATALOG || 'data_platform_dev',
  databricksGoldSchema: process.env.DATABRICKS_SCHEMA || 'gold_cvcrm',
  databricksToken: process.env.DATABRICKS_TOKEN,
  databricksHost: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
  databricksPath: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH,
  outDir: process.env.VALIDATION_OUTPUT_DIR || path.resolve(__dirname, '../reports'),
};

const BASE_TABLE_DBX = `${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_comercial_base`;
const BASE_TABLE_PG = 'public.comercial_base';
const SEGMENTED_TABLE_DBX = `${env.databricksCatalog}.${env.databricksGoldSchema}.vw_bi_comercial_indicador_segmentacao`;
const SEGMENTED_TABLE_PG = 'public.comercial_indicador_segmentacao';

const FIELDS = [
  'fonte_cliente_nome','cliente_documento','cliente_email','lead_cidade','fonte_lead_cidade','lead_estado','fonte_lead_estado','lead_regiao','lead_origem_nome','sdr_nome',
  'idempreendimento_canonico','fonte_idempreendimento_canonico','idunidade_canonico','fonte_idunidade_canonico','idcliente_canonico','fonte_idcliente_canonico',
  'idcontrato_canonico','fonte_idcontrato_canonico','idmidia_canonico','fonte_idmidia_canonico','idtime_canonico','fonte_idtime_canonico','idgestor_time_canonico',
  'fonte_idgestor_time_canonico','idcorretor_canonico','fonte_idcorretor_canonico','idgestor_canonico','fonte_idgestor_canonico','idimobiliaria_canonico',
  'fonte_idimobiliaria_canonico','idsituacao_canonica','fonte_idsituacao_canonica','idsituacao_anterior_canonica','fonte_idsituacao_anterior_canonica',
  'situacao_nome_canonica','fonte_situacao_nome_canonica','unidade_nome_canonica','fonte_unidade_nome_canonica','corretor_nome_canonico','fonte_corretor_nome_canonico',
  'imobiliaria_nome_canonica','fonte_imobiliaria_nome_canonica','dt_cadastro_canonico','fonte_dt_cadastro_canonico','dt_cadastro_canonico_data',
  'fonte_dt_cadastro_canonico_data','etapa_base_canonica','lead_idempreendimento','precadastro_idempreendimento','precadastro_idunidade','empreendimento_nome_lead',
  'regiao_empreendimento_lead','empreendimento_nome_precadastro','regiao_empreendimento_precadastro','empreendimento_nome_reserva','regiao_empreendimento_reserva',
  'empreendimento_nome_repasse','regiao_empreendimento_repasse','empreendimento_nome','fonte_empreendimento_nome','regiao_empreendimento','fonte_regiao_empreendimento',
  'nome_empreendimento_reduzido','fonte_nome_empreendimento_reduzido'
];

const SEGMENTED_FIELDS = [
  'indicador',
  'data_evento',
  'mes_referencia',
  'entidade_id',
  'valor_realizado',
  'idcorretor_operacao',
  'corretor_operacao_nome',
  'idimobiliaria_operacao',
  'imobiliaria_operacao_nome',
  'regiao_operacao',
  'idempreendimento_operacao',
  'empreendimento_operacao_nome',
  'idunidade_operacao',
  'unidade_operacao_nome',
  'sdr_operacao_nome',
  'origem_operacao_nome',
  'corretor_ativo_nome',
  'gestor_corretor',
  'coordenador_corretor',
  'regiao_corretor',
  'imobiliaria_corretor',
  'fl_corretor_ativo_mes',
  'sdr_ativo_nome',
  'gestor_sdr',
  'coordenador_sdr',
  'regiao_sdr',
  'imobiliaria_sdr',
  'fl_sdr_ativo_mes',
  'fl_indicador_sdr_aplicavel',
];

const PERIODS = [
  {
    key: 'mes_atual',
    dbxWhere: `
      COALESCE(
        TO_DATE(dt_cadastro_canonico_data),
        TO_DATE(dt_cadastro_canonico),
        TO_DATE(dt_ultima_conversao_lead),
        TO_DATE(dt_cadastro_reserva),
        TO_DATE(dt_assinatura_contrato)
      ) >= DATE_TRUNC('month', CURRENT_DATE)
    `,
    pgWhere: `
      COALESCE(
        dt_cadastro_reserva::date,
        dt_ultima_conversao_lead::date,
        dt_assinatura_contrato::date
      ) >= DATE_TRUNC('month', CURRENT_DATE)
    `,
  },
  {
    key: 'ano_atual',
    dbxWhere: `
      COALESCE(
        TO_DATE(dt_cadastro_canonico_data),
        TO_DATE(dt_cadastro_canonico),
        TO_DATE(dt_ultima_conversao_lead),
        TO_DATE(dt_cadastro_reserva),
        TO_DATE(dt_assinatura_contrato)
      ) >= DATE_TRUNC('year', CURRENT_DATE)
    `,
    pgWhere: `
      COALESCE(
        dt_cadastro_reserva::date,
        dt_ultima_conversao_lead::date,
        dt_assinatura_contrato::date
      ) >= DATE_TRUNC('year', CURRENT_DATE)
    `,
  },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

async function getPostgresColumns(pool, tableName = 'comercial_base') {
  const r = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [tableName]);
  return new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));
}

async function run() {
  await fs.mkdir(env.outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outJson = path.join(env.outDir, `validation-canonical-fields-${timestamp}.json`);
  const outMd = path.join(env.outDir, `validation-canonical-fields-${timestamp}.md`);

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const pgColumns = await getPostgresColumns(pool, 'comercial_base');
    const pgSegmentedColumns = await getPostgresColumns(pool, 'comercial_indicador_segmentacao');

    const results = await withDatabricksSession(async (session) => {
      const all = [];
      for (const period of PERIODS) {
        for (const field of FIELDS) {
          const dbxRows = await dbxQuery(session, `
            SELECT
              COUNT(*) AS total,
              COUNT_IF(${field} IS NOT NULL) AS preenchidos
            FROM ${BASE_TABLE_DBX}
            WHERE ${period.dbxWhere}
          `);
          const dbx = dbxRows[0] || { total: 0, preenchidos: 0 };

          let pg = null;
          let status = 'OK';
          if (pgColumns.has(field.toLowerCase())) {
            const pgRows = await pool.query(`
              SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ${field} IS NOT NULL) AS preenchidos
              FROM ${BASE_TABLE_PG}
              WHERE ${period.pgWhere}
            `);
            pg = pgRows.rows[0] || { total: 0, preenchidos: 0 };
          } else {
            status = 'MISSING_IN_POSTGRES';
          }

          all.push({
            period: period.key,
            field,
            dbx_total: toNum(dbx.total),
            dbx_preenchidos: toNum(dbx.preenchidos),
            pg_total: pg ? toNum(pg.total) : null,
            pg_preenchidos: pg ? toNum(pg.preenchidos) : null,
            status,
          });
        }

        const segmentedDbxWhere = period.key === 'mes_atual'
          ? `data_evento >= DATE_TRUNC('month', CURRENT_DATE)`
          : `data_evento >= DATE_TRUNC('year', CURRENT_DATE)`;
        const segmentedPgWhere = period.key === 'mes_atual'
          ? `data_evento >= DATE_TRUNC('month', CURRENT_DATE)`
          : `data_evento >= DATE_TRUNC('year', CURRENT_DATE)`;

        for (const field of SEGMENTED_FIELDS) {
          const dbxRows = await dbxQuery(session, `
            SELECT
              COUNT(*) AS total,
              COUNT_IF(${field} IS NOT NULL) AS preenchidos
            FROM ${SEGMENTED_TABLE_DBX}
            WHERE ${segmentedDbxWhere}
          `);
          const dbx = dbxRows[0] || { total: 0, preenchidos: 0 };

          let pg = null;
          let status = 'OK';
          if (pgSegmentedColumns.has(field.toLowerCase())) {
            const pgRows = await pool.query(`
              SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ${field} IS NOT NULL) AS preenchidos
              FROM ${SEGMENTED_TABLE_PG}
              WHERE ${segmentedPgWhere}
            `);
            pg = pgRows.rows[0] || { total: 0, preenchidos: 0 };
          } else {
            status = 'MISSING_IN_POSTGRES';
          }

          all.push({
            period: period.key,
            table: 'comercial_indicador_segmentacao',
            field,
            dbx_total: toNum(dbx.total),
            dbx_preenchidos: toNum(dbx.preenchidos),
            pg_total: pg ? toNum(pg.total) : null,
            pg_preenchidos: pg ? toNum(pg.preenchidos) : null,
            status,
          });
        }
      }
      return all;
    });

    const missing = [...new Set(results.filter((r) => r.status === 'MISSING_IN_POSTGRES').map((r) => r.field))].sort();

    const payload = {
      executedAt: new Date().toISOString(),
      databricksBase: BASE_TABLE_DBX,
      postgresBase: BASE_TABLE_PG,
      periods: PERIODS.map((p) => p.key),
      totalFields: FIELDS.length,
      missingInPostgres: missing,
      results,
    };

    const lines = [];
    lines.push('# Validacao de Campos Canonicos (Databricks x Postgres)');
    lines.push('');
    lines.push(`- Data de execucao: ${payload.executedAt}`);
    lines.push(`- Databricks: ${BASE_TABLE_DBX}`);
    lines.push(`- Postgres: ${BASE_TABLE_PG}`);
    lines.push(`- Campos avaliados: ${FIELDS.length}`);
    lines.push(`- Campos ausentes no Postgres: ${missing.length}`);
    lines.push('');
    if (missing.length > 0) {
      lines.push('## Campos ausentes no Postgres');
      lines.push('');
      for (const f of missing) lines.push(`- ${f}`);
      lines.push('');
    }

    for (const period of PERIODS.map((p) => p.key)) {
      lines.push(`## Periodo: ${period}`);
      lines.push('');
      lines.push('| Campo | DBX preenchidos/total | PG preenchidos/total | Status |');
      lines.push('|---|---:|---:|---|');
      for (const row of results.filter((r) => r.period === period)) {
        const dbxTxt = `${row.dbx_preenchidos}/${row.dbx_total}`;
        const pgTxt = row.pg_total == null ? '-' : `${row.pg_preenchidos}/${row.pg_total}`;
        lines.push(`| ${row.table ? `${row.table}.` : ''}${row.field} | ${dbxTxt} | ${pgTxt} | ${row.status} |`);
      }
      lines.push('');
    }

    await fs.writeFile(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await fs.writeFile(outMd, `${lines.join('\n')}\n`, 'utf8');

    console.log(`[CANONICAL VALIDATION] JSON: ${outJson}`);
    console.log(`[CANONICAL VALIDATION] MD  : ${outMd}`);

    process.exitCode = missing.length > 0 ? 1 : 0;
  } finally {
    await pool.end().catch(() => {});
  }
}

run().catch((err) => {
  console.error('[CANONICAL VALIDATION] erro:', err?.message || err);
  process.exitCode = 1;
});
