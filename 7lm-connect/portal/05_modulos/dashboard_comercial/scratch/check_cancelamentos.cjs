
const { Pool } = require('pg');
const pool = new Pool({
  user: 'dviz_comercial',
  password: 'k9#Z$p2!mL9Q*vR5^tB8&nJ3',
  host: '10.108.0.3',
  port: 5432,
  database: 'db_app_comercial_dataviz'
});

async function run() {
  const start = '2026-04-01';
  const end = '2026-04-30';

  console.log(`Checking Cancelamentos for ${start} to ${end}`);

  try {
    // 1. Total in comercial_kpi_daily
    const kpiDailyRes = await pool.query(
      `SELECT SUM(cancelamentos) as total FROM comercial_kpi_daily WHERE data BETWEEN $1 AND $2`,
      [start, end]
    );
    console.log(`Total in comercial_kpi_daily: ${kpiDailyRes.rows[0].total}`);

    // 2. Total in comercial_cancelamentos
    const cancelRes = await pool.query(
      `SELECT COUNT(DISTINCT idreserva) as total FROM comercial_cancelamentos WHERE data_cancelamento::date BETWEEN $1 AND $2`,
      [start, end]
    );
    console.log(`Total in comercial_cancelamentos (distinct idreserva): ${cancelRes.rows[0].total}`);

    // 3. Breakdown by axis - base query
    const axis = 'corretor_nome';
    const rawBreakdownRes = await pool.query(`
      SELECT 
        COALESCE(cc.corretor_nome, 'Sem informacao') as label,
        COUNT(DISTINCT cc.idreserva) as value
      FROM comercial_cancelamentos cc
      WHERE cc.data_cancelamento::date BETWEEN $1 AND $2
      GROUP BY 1
    `, [start, end]);
    
    let sumRaw = 0;
    rawBreakdownRes.rows.forEach(r => sumRaw += Number(r.value));
    console.log(`Sum of grouped values (raw cc table): ${sumRaw}`);

    // 4. Breakdown with JOIN (matching server.js logic)
    // server.js uses buildFilters(filters, { startIndex: 3, alias: 'b' })
    // and LEFT JOIN comercial_base b ON ...
    const joinBreakdownRes = await pool.query(`
      SELECT
        COALESCE(b.corretor_nome, cc.corretor_nome, 'Sem informacao') AS label,
        COUNT(DISTINCT cc.idreserva)::int as value
      FROM comercial_cancelamentos cc
      LEFT JOIN comercial_base b ON (
        (b.idreserva IS NOT NULL AND b.idreserva = cc.idreserva)
        OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = cc.idprecadastro)
        OR (b.documento IS NOT NULL AND b.documento = cc.documento AND b.idempreendimento = cc.idempreendimento)
      )
      WHERE cc.data_cancelamento::date BETWEEN $1 AND $2
      GROUP BY 1
    `, [start, end]);

    let sumJoin = 0;
    joinBreakdownRes.rows.forEach(r => sumJoin += Number(r.value));
    console.log(`Sum of grouped values (with JOIN): ${sumJoin}`);

    // 5. Check if any duplicate reservoirs exist in Join results
    const duplicatesInJoinRes = await pool.query(`
      SELECT cc.idreserva, COUNT(b.idreserva) as matches
      FROM comercial_cancelamentos cc
      LEFT JOIN comercial_base b ON (
        (b.idreserva IS NOT NULL AND b.idreserva = cc.idreserva)
        OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = cc.idprecadastro)
        OR (b.documento IS NOT NULL AND b.documento = cc.documento AND b.idempreendimento = cc.idempreendimento)
      )
      WHERE cc.data_cancelamento::date BETWEEN $1 AND $2
      GROUP BY cc.idreserva
      HAVING COUNT(b.idreserva) > 1
      LIMIT 10
    `, [start, end]);
    
    if (duplicatesInJoinRes.rows.length > 0) {
      console.log(`Found ${duplicatesInJoinRes.rows.length} idreserva with multiple matches in comercial_base!`);
      duplicatesInJoinRes.rows.forEach(r => console.log(`IDReserva: ${r.idreserva}, Matches: ${r.matches}`));
    } else {
      console.log('No duplicate matches found in JOIN.');
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
