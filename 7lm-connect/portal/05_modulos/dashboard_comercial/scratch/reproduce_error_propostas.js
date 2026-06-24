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

async function test() {
  const start = '2026-05-01';
  const end = '2026-05-31';
  const cidade = 'Abadia de Goiás';

  const whereBaseAlias = `AND b.lead_cidade = $3`;
  const queryParamsBaseAlias = [start, end, cidade];

  const propostasSql = `
      SELECT
        COUNT(DISTINCT pc.idprecadastro) FILTER (
          WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
            AND pc.proposta_status_atual = 'APROVADA'
        ) AS total_propostas_aprovadas
      FROM comercial_propostas_consolidada pc
      LEFT JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro
      WHERE 1=1
      ${whereBaseAlias}
    `;

  console.log('Running query:', propostasSql);
  try {
    const res = await pool.query(propostasSql, queryParamsBaseAlias);
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  }
  await pool.end();
}

test();
