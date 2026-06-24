const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const start = '2026-05-01';
  const end = '2026-05-31';
  try {
    const res = await pool.query(`
      SELECT proposta_status_atual, COUNT(DISTINCT idprecadastro) as count
      FROM comercial_propostas_consolidada
      WHERE dt_ultimo_historico_data BETWEEN $1 AND $2
      GROUP BY 1
      ORDER BY 2 DESC;
    `, [start, end]);
    console.log(`Status counts for ${start} to ${end}:`);
    console.table(res.rows);

    const totalInScope = await pool.query(`
      SELECT COUNT(DISTINCT idprecadastro)
      FROM comercial_propostas_consolidada
      WHERE dt_ultimo_historico_data BETWEEN $1 AND $2
        AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA');
    `, [start, end]);
    console.log('Total in scope (A/C/R):', totalInScope.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
