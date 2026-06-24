import { DBSQLClient } from '@databricks/sql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABRICKS_CATALOG = process.env.DATABRICKS_CATALOG || 'data_platform_dev';
const DATABRICKS_SCHEMA = process.env.DATABRICKS_SCHEMA || 'gold_cvcrm';
const BASE_WINDOW_3Y_SQL = `
  COALESCE(dt_lead, dt_ultima_conversao_lead) >= current_date() - interval 3 years
  OR COALESCE(dt_visita, dt_visita_realizada) >= current_date() - interval 3 years
  OR dt_cadastro_reserva >= current_date() - interval 3 years
  OR dt_contrato_contabilizado >= current_date() - interval 3 years
  OR COALESCE(dt_repasse, dt_assinatura_contrato) >= current_date() - interval 3 years
  OR dt_cancelamento_reserva >= current_date() - interval 3 years
  OR data_venda >= current_date() - interval 3 years
`;

export async function runPreflightDatabricksAndStaging() {
  const dbsql = new DBSQLClient();
  const databricksConfig = {
    token: process.env.DATABRICKS_TOKEN,
    host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
    path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH
  };

  const queries = {
    base: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base WHERE ${BASE_WINDOW_3Y_SQL}`,
    segmentacao: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_indicador_segmentacao WHERE data_evento >= current_date() - interval 3 years`,
    propostas: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_propostas_historico WHERE referencia_data >= current_date() - interval 3 years`,
    propostas_consolidadas: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_propostas_consolidada WHERE dt_ultimo_historico_data >= current_date() - interval 3 years`,
    cancel: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_cancelamentos WHERE data_cancelamento >= current_date() - interval 3 years`,
    distrato: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_distratos WHERE referencia_data >= current_date() - interval 3 years`,
    dim_empreendimento: `SELECT COUNT(1) AS c FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_empreendimento`,
    corretores_ativos_duplicados: `
      SELECT COUNT(1) AS c
      FROM (
        SELECT COALESCE(corretor_ativo_mes_key, CONCAT(COALESCE(documento_norm, documento, email_norm, email, nome), '::', CAST(mes_referencia AS STRING))) AS k
        FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.corretores_ativos
        WHERE mes_referencia IS NOT NULL
        GROUP BY 1
        HAVING COUNT(*) > 1
      )
    `,
    sdr_ativos_duplicados: `
      SELECT COUNT(1) AS c
      FROM (
        SELECT COALESCE(sdr_ativo_mes_key, CONCAT(COALESCE(documento_norm, documento_sdr, email_norm, email_sdr, sdr_ativo_nome, sdr), '::', CAST(mes_referencia AS STRING))) AS k
        FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.sdr_ativos
        WHERE mes_referencia IS NOT NULL
        GROUP BY 1
        HAVING COUNT(*) > 1
      )
    `
  };

  const result = {};
  let conn;
  try {
    conn = await dbsql.connect(databricksConfig);
    const session = await conn.openSession();
    for (const [k, q] of Object.entries(queries)) {
      const op = await session.executeStatement(q, { runAsync: true });
      const rows = await op.fetchAll();
      await op.close();
      result[k] = Number(rows[0]?.c ?? 0);
    }
    await session.close();
    await conn.close();

    // Now check staging counts in Postgres
    const pool = new pg.Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: { rejectUnauthorized: false }
    });
    const stagingCounts = {};
    const r1 = await pool.query('SELECT COUNT(1) as c FROM comercial_base_staging'); stagingCounts.base = Number(r1.rows[0].c || 0);
    const rSeg = await pool.query('SELECT COUNT(1) as c FROM comercial_indicador_segmentacao_staging'); stagingCounts.segmentacao = Number(rSeg.rows[0].c || 0);
    const r2 = await pool.query('SELECT COUNT(1) as c FROM comercial_propostas_historico_staging'); stagingCounts.propostas = Number(r2.rows[0].c || 0);
    const r3 = await pool.query('SELECT COUNT(1) as c FROM comercial_propostas_consolidada_staging'); stagingCounts.propostas_consolidadas = Number(r3.rows[0].c || 0);
    const r4 = await pool.query('SELECT COUNT(1) as c FROM comercial_cancelamentos_staging'); stagingCounts.cancel = Number(r4.rows[0].c || 0);
    const r5 = await pool.query('SELECT COUNT(1) as c FROM comercial_distratos_staging'); stagingCounts.distrato = Number(r5.rows[0].c || 0);
    const r6 = await pool.query('SELECT COUNT(1) as c FROM dim_empreendimento_staging'); stagingCounts.dim_empreendimento = Number(r6.rows[0].c || 0);
    await pool.end();

    return { source: result, staging: stagingCounts };
  } catch (err) {
    if (conn) await conn.close().catch(() => {});
    console.error('Preflight error:', err?.message || err);
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreflightDatabricksAndStaging().then((r) => {
    console.log('Preflight result:', r);
  }).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
