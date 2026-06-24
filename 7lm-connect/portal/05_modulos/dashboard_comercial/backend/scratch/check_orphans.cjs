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
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'comercial_propostas_consolidada';
    `);
    console.log('Columns:', columns.rows.map(r => r.column_name).join(', '));

    const orphans = await pool.query(`
      SELECT COUNT(*) as count 
      FROM comercial_propostas_consolidada pc
      LEFT JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro
      WHERE b.idprecadastro IS NULL;
    `);
    console.log('Orphan proposals (no match in comercial_base):', orphans.rows[0].count);

    const matchWithFilters = await pool.query(`
      SELECT COUNT(*) as count 
      FROM comercial_propostas_consolidada pc
      LEFT JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro
      WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
        AND b.idprecadastro IS NULL;
    `);
    console.log('Orphan proposals in scope (A/C/R):', matchWithFilters.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
