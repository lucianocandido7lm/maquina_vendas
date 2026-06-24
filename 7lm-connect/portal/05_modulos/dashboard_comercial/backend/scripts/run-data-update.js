import { syncDatabricksToPostgres } from './sync-databricks.js';
import { aggregateData } from './aggregate-data.js';
import { fileURLToPath } from 'url';
import { runPreflightDatabricksAndStaging } from './preflight-checks.js';
import pg from 'pg';

const { Pool } = pg;

const ensureDimEmpreendimentoPromoted = async () => {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM public.dim_empreendimento_staging) AS staging_total,
        (SELECT COUNT(*)::bigint FROM public.dim_empreendimento) AS final_total
    `);
    const counts = rows[0] || {};
    const stagingTotal = Number(counts.staging_total || 0);
    const finalTotal = Number(counts.final_total || 0);
    if (stagingTotal > 0 && finalTotal === 0) {
      throw new Error(`Preflight falhou: dim_empreendimento staging=${stagingTotal} e final=${finalTotal} apos swap.`);
    }
  } finally {
    await pool.end();
  }
};

async function runDataUpdate() {
  console.log('🔄 Iniciando atualização completa de dados...');
  const syncStats = await syncDatabricksToPostgres({ promoteToFinalTables: false });
  // Run preflight checks comparing source and staging counts
  const preflight = await runPreflightDatabricksAndStaging();
  console.log('📋 Preflight:', preflight);
  // Validate staging matches exactly what was extracted in this same run.
  // Databricks source can change between extraction and preflight query.
  const expectedFromSync = {
    base: Number(syncStats?.comercial_base || 0),
    segmentacao: Number(syncStats?.comercial_indicador_segmentacao || 0),
    propostas: Number(syncStats?.propostas || 0),
    cancel: Number(syncStats?.cancelamentos || 0),
    distrato: Number(syncStats?.distratos || 0),
    dim_empreendimento: Number(syncStats?.dim_empreendimento || 0),
  };
  const diffs = [];
  for (const k of ['base', 'segmentacao', 'propostas', 'cancel', 'distrato', 'dim_empreendimento']) {
    const s = expectedFromSync[k] ?? 0;
    const t = preflight?.staging?.[k] ?? 0;
    if (s !== t) diffs.push({ table: k, source: s, staging: t });
  }
  if (diffs.length > 0) {
    console.error('❌ Preflight mismatch detected:', diffs);
    throw new Error('Preflight mismatch detected; aborting update.');
  }

  const duplicateChecks = [
    { table: 'corretores_ativos', count: Number(preflight?.source?.corretores_ativos_duplicados || 0) },
    { table: 'sdr_ativos', count: Number(preflight?.source?.sdr_ativos_duplicados || 0) },
  ].filter((item) => item.count > 0);
  if (duplicateChecks.length > 0) {
    console.error('❌ Hierarquia mensal com duplicidade:', duplicateChecks);
    throw new Error('Preflight detected duplicate active hierarchy keys; aborting update.');
  }

  // If preflight OK, proceed to swap and aggregation
  // perform swap: promote staging tables into production
  try {
    const { swapStaging } = await import('./swap-staging.js');
    await swapStaging();
    await ensureDimEmpreendimentoPromoted();
  } catch (err) {
    console.error('❌ Swap failed:', err?.message || err);
    throw err;
  }

  await aggregateData();
  console.log('✅ Atualização completa finalizada.');
  return {
    syncedAt: new Date().toISOString(),
    syncStats,
  };
}

export { runDataUpdate };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDataUpdate().catch(() => {
    process.exitCode = 1;
  });
}
