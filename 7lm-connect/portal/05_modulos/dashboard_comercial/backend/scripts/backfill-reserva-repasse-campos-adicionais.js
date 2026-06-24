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
const DATABRICKS_CATALOG = process.env.DATABRICKS_CATALOG || 'data_platform_dev';
const DATABRICKS_SCHEMA = process.env.DATABRICKS_SCHEMA || 'gold_cvcrm';

const quoteIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;
const qualify = (schema, table) => `${quoteIdent(schema)}.${quoteIdent(table)}`;

const pgConfig = () => ({
  user: process.env.SEVENLM_CONNECT_DBUSER,
  host: process.env.SEVENLM_CONNECT_DBHOST || '127.0.0.1',
  database: process.env.SEVENLM_CONNECT_DBNAME,
  password: process.env.SEVENLM_CONNECT_DBPASS,
  port: Number(process.env.SEVENLM_CONNECT_DBPORT || 5432),
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

async function executeDatabricks(session, query, label) {
  let op;
  try {
    op = await session.executeStatement(query, { runAsync: true });
    const rows = await op.fetchAll();
    console.log(`Databricks ${label}: ${rows.length} linhas`);
    return rows;
  } finally {
    await op?.close().catch(() => {});
  }
}

async function fetchDatabricksRows() {
  const dbsql = new DBSQLClient();
  const conn = await dbsql.connect(databricksConfig());
  const session = await conn.openSession();

  try {
    const reservas = await executeDatabricks(session, `
      select
        idreserva,
        max(reserva_campos_adicionais_data_qr) as reserva_campos_adicionais_data_qr,
        max(reserva_campos_adicionais_reserva_repasse_no_mes) as reserva_campos_adicionais_reserva_repasse_no_mes,
        max(reserva_campos_adicionais_reserva_kit_cef) as reserva_campos_adicionais_reserva_kit_cef,
        max(reserva_campos_adicionais_reserva_kit_agehab) as reserva_campos_adicionais_reserva_kit_agehab,
        max(reserva_campos_adicionais_reserva_obs_finalizacao) as reserva_campos_adicionais_reserva_obs_finalizacao
      from ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.cvcrm_campos_adicionais_reserva_wide
      where idreserva is not null
        and (
          reserva_campos_adicionais_data_qr is not null
          or reserva_campos_adicionais_reserva_repasse_no_mes is not null
          or reserva_campos_adicionais_reserva_kit_cef is not null
          or reserva_campos_adicionais_reserva_kit_agehab is not null
          or reserva_campos_adicionais_reserva_obs_finalizacao is not null
        )
      group by idreserva
    `, 'campos_adicionais_reserva');

    const repasses = await executeDatabricks(session, `
      select
        idrepasse,
        max(repasse_campos_adicionais_repasse_data_envio_cehop) as repasse_campos_adicionais_repasse_data_envio_cehop,
        max(repasse_campos_adicionais_repasse_data_conformidade_cehop) as repasse_campos_adicionais_repasse_data_conformidade_cehop,
        max(repasse_campos_adicionais_repasse_data_da_inconformidade_cehop) as repasse_campos_adicionais_repasse_data_da_inconformidade_cehop,
        max(repasse_campos_adicionais_repasse_data_do_reenvio_cehop) as repasse_campos_adicionais_repasse_data_do_reenvio_cehop,
        max(repasse_campos_adicionais_repasse_probabilidade_de_assinatura) as repasse_campos_adicionais_repasse_probabilidade_de_assinatura
      from ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.cvcrm_campos_adicionais_repasse_wide
      where idrepasse is not null
        and (
          repasse_campos_adicionais_repasse_data_envio_cehop is not null
          or repasse_campos_adicionais_repasse_data_conformidade_cehop is not null
          or repasse_campos_adicionais_repasse_data_da_inconformidade_cehop is not null
          or repasse_campos_adicionais_repasse_data_do_reenvio_cehop is not null
          or repasse_campos_adicionais_repasse_probabilidade_de_assinatura is not null
        )
      group by idrepasse
    `, 'campos_adicionais_repasse');

    return { reservas, repasses };
  } finally {
    await session.close().catch(() => {});
    await conn.close().catch(() => {});
  }
}

async function updateReservas(client, rows) {
  let touched = 0;
  const table = qualify(TARGET_SCHEMA, 'comercial_base');

  for (const row of rows) {
    const result = await client.query(
      `
        update ${table}
        set
          reserva_campos_adicionais_data_qr = $2,
          reserva_campos_adicionais_reserva_repasse_no_mes = $3,
          reserva_campos_adicionais_reserva_kit_cef = $4,
          reserva_campos_adicionais_reserva_kit_agehab = $5,
          reserva_campos_adicionais_reserva_obs_finalizacao = $6
        where idreserva = $1
          and (
            reserva_campos_adicionais_data_qr is distinct from $2
            or reserva_campos_adicionais_reserva_repasse_no_mes is distinct from $3
            or reserva_campos_adicionais_reserva_kit_cef is distinct from $4
            or reserva_campos_adicionais_reserva_kit_agehab is distinct from $5
            or reserva_campos_adicionais_reserva_obs_finalizacao is distinct from $6
          )
      `,
      [
        row.idreserva,
        row.reserva_campos_adicionais_data_qr ?? null,
        row.reserva_campos_adicionais_reserva_repasse_no_mes ?? null,
        row.reserva_campos_adicionais_reserva_kit_cef ?? null,
        row.reserva_campos_adicionais_reserva_kit_agehab ?? null,
        row.reserva_campos_adicionais_reserva_obs_finalizacao ?? null,
      ],
    );
    touched += result.rowCount || 0;
  }

  return touched;
}

async function updateRepasses(client, rows) {
  let touched = 0;
  const table = qualify(TARGET_SCHEMA, 'comercial_base');

  for (const row of rows) {
    const result = await client.query(
      `
        update ${table}
        set
          repasse_campos_adicionais_repasse_data_envio_cehop = $2,
          repasse_campos_adicionais_repasse_data_conformidade_cehop = $3,
          repasse_campos_adicionais_repasse_data_da_inconformidade_cehop = $4,
          repasse_campos_adicionais_repasse_data_do_reenvio_cehop = $5,
          repasse_campos_adicionais_repasse_probabilidade_de_assinatura = $6
        where idrepasse = $1
          and (
            repasse_campos_adicionais_repasse_data_envio_cehop is distinct from $2
            or repasse_campos_adicionais_repasse_data_conformidade_cehop is distinct from $3
            or repasse_campos_adicionais_repasse_data_da_inconformidade_cehop is distinct from $4
            or repasse_campos_adicionais_repasse_data_do_reenvio_cehop is distinct from $5
            or repasse_campos_adicionais_repasse_probabilidade_de_assinatura is distinct from $6
          )
      `,
      [
        row.idrepasse,
        row.repasse_campos_adicionais_repasse_data_envio_cehop ?? null,
        row.repasse_campos_adicionais_repasse_data_conformidade_cehop ?? null,
        row.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop ?? null,
        row.repasse_campos_adicionais_repasse_data_do_reenvio_cehop ?? null,
        row.repasse_campos_adicionais_repasse_probabilidade_de_assinatura ?? null,
      ],
    );
    touched += result.rowCount || 0;
  }

  return touched;
}

async function main() {
  requireConfig();
  const { reservas, repasses } = await fetchDatabricksRows();
  const pool = new Pool(pgConfig());
  const client = await pool.connect();

  try {
    await client.query('begin');
    const reservasAtualizadas = await updateReservas(client, reservas);
    const repassesAtualizados = await updateRepasses(client, repasses);
    await client.query('commit');

    const { rows: verificacao } = await client.query(
      `
        select
          count(*) filter (where nullif(trim(reserva_campos_adicionais_reserva_repasse_no_mes), '') is not null)::integer as repasse_no_mes,
          count(*) filter (where nullif(trim(reserva_campos_adicionais_data_qr::text), '') is not null)::integer as data_qr,
          count(*) filter (where nullif(trim(repasse_campos_adicionais_repasse_probabilidade_de_assinatura), '') is not null)::integer as probabilidade_assinatura,
          count(*) filter (where nullif(trim(repasse_campos_adicionais_repasse_data_envio_cehop::text), '') is not null)::integer as envio_cehop
        from ${qualify(TARGET_SCHEMA, 'comercial_base')}
        where coalesce(dt_cadastro_reserva, dt_assinatura_contrato, dt_contrato_contabilizado) >= date '2024-01-01'
      `,
    );

    console.log(JSON.stringify({
      reservasFonte: reservas.length,
      repassesFonte: repasses.length,
      reservasAtualizadas,
      repassesAtualizados,
      verificacao: verificacao[0],
    }, null, 2));
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
