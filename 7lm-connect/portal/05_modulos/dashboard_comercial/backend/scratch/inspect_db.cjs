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
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'comercial_propostas_consolidada'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in comercial_propostas_consolidada:');
    console.table(res.rows);

    const counts = await pool.query(`
      SELECT proposta_status_atual, COUNT(*) 
      FROM comercial_propostas_consolidada 
      WHERE dt_ultimo_historico_data BETWEEN '2024-01-01' AND '2024-12-31'
      GROUP BY 1;
    `);
    console.log('Status counts (all 2024):');
    console.table(counts.rows);
    
    const totals = await pool.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT idprecadastro) as total_ids,
        COUNT(DISTINCT idprecadastro) FILTER (WHERE proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')) as ids_in_scope
      FROM comercial_propostas_consolidada;
    `);
    console.log('Totals in table:');
    console.table(totals.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
