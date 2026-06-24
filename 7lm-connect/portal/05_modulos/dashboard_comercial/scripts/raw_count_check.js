
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'backend/.env' });

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const start = '2024-01-01';
  const end = '2024-12-31';
  
  console.log(`--- Contagens para o período ${start} a ${end} ---`);

  const { rows: summary } = await pool.query(`
    SELECT COUNT(DISTINCT idlead) as total FROM comercial_base 
    WHERE dt_ultima_conversao_lead::date BETWEEN $1 AND $2
  `, [start, end]);
  console.log(`Total Leads (Summary): ${summary[0].total}`);

  const axes = [
    { name: 'cidade', col: 'lead_cidade' },
    { name: 'corretor', col: 'corretor_nome' },
    { name: 'empreendimento', col: 'empreendimento_nome' },
    { name: 'gerencia', col: 'gestor_nome' },
    { name: 'coordenacao', col: 'coordenador_nome' }
  ];

  for (const axis of axes) {
    const { rows: breakdown } = await pool.query(`
      SELECT COALESCE(${axis.col}, 'Sem informação') as label, COUNT(DISTINCT idlead) as value
      FROM comercial_base
      WHERE dt_ultima_conversao_lead::date BETWEEN $1 AND $2
      GROUP BY 1
    `, [start, end]);
    
    const sum = breakdown.reduce((acc, curr) => acc + Number(curr.value), 0);
    console.log(`Soma Leads (${axis.name}): ${sum} (Rows: ${breakdown.length})`);
    
    if (sum !== Number(summary[0].total)) {
      console.log(`  ⚠️ DISCREPÂNCIA: ${sum - summary[0].total}`);
    }
  }

  await pool.end();
}

check().catch(console.error);
