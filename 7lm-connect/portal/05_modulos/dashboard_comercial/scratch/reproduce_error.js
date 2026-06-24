import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

const EVENT_TO_BASE_JOIN = `
  (
    (b.idreserva IS NOT NULL AND b.idreserva = EVENT.idreserva)
    OR (b.idlead IS NOT NULL AND b.idlead = EVENT.idlead)
    OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = EVENT.idprecadastro)
  )
`;

async function test() {
  const start = '2026-05-01';
  const end = '2026-05-31';
  const cidade = 'Abadia de Goiás';

  const whereBaseAlias = `AND b.lead_cidade = $3`;
  const queryParamsBaseAlias = [start, end, cidade];

  const cancelSql = `
    SELECT COUNT(DISTINCT cc.idreserva) as total_cancelamentos 
    FROM comercial_cancelamentos cc
    LEFT JOIN LATERAL (
      SELECT *
      FROM comercial_base b
      WHERE ${EVENT_TO_BASE_JOIN.replaceAll('EVENT', 'cc')}
      LIMIT 1
    ) b ON TRUE
    WHERE cc.data_cancelamento::date BETWEEN $1 AND $2
    ${whereBaseAlias}
  `;

  console.log('Running query:', cancelSql);
  try {
    const res = await pool.query(cancelSql, queryParamsBaseAlias);
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  }
  await pool.end();
}

test();
