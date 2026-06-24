import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function swapStaging() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    // Use transactional promotion: truncate + insert from staging
    await client.query('BEGIN');

    // Ensure staging tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS comercial_base_staging (LIKE comercial_base INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS comercial_indicador_segmentacao_staging (LIKE comercial_indicador_segmentacao INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS comercial_propostas_historico_staging (LIKE comercial_propostas_historico INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS comercial_propostas_consolidada_staging (LIKE comercial_propostas_consolidada INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS comercial_cancelamentos_staging (LIKE comercial_cancelamentos INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS comercial_distratos_staging (LIKE comercial_distratos INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS dim_empreendimento_staging (LIKE dim_empreendimento INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS dim_imobiliaria_staging (LIKE dim_imobiliaria INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS dim_sdr_imobiliaria_staging (LIKE dim_sdr_imobiliaria INCLUDING ALL);
    `);

    const promoteTable = async (targetTable, stagingTable) => {
      const rowCountResult = await client.query(`SELECT COUNT(*)::bigint AS total FROM public.${stagingTable}`);
      const stagingTotal = Number(rowCountResult.rows[0]?.total || 0);

      await client.query(`TRUNCATE public.${targetTable}`);
      const insertResult = await client.query(`
        INSERT INTO public.${targetTable}
        SELECT *
        FROM public.${stagingTable}
      `);

      const insertedTotal = Number(insertResult.rowCount || 0);
      const finalCountResult = await client.query(`SELECT COUNT(*)::bigint AS total FROM public.${targetTable}`);
      const finalTotal = Number(finalCountResult.rows[0]?.total || 0);

      console.log(`ℹ️ Swap check ${targetTable}: staging=${stagingTotal}, inserted=${insertedTotal}, final=${finalTotal}`);

      if (stagingTotal > 0 && insertedTotal === 0) {
        throw new Error(`Promocao sem linhas para ${targetTable}; staging possui ${stagingTotal}`);
      }

      if (stagingTotal > 0 && finalTotal === 0) {
        throw new Error(`Promocao invalida para ${targetTable}; staging=${stagingTotal} e final=${finalTotal}`);
      }
      if (stagingTotal !== insertedTotal || stagingTotal !== finalTotal) {
        throw new Error(`Promocao divergente para ${targetTable}; staging=${stagingTotal}, inserted=${insertedTotal}, final=${finalTotal}`);
      }
    };

    // Promote data atomically, preserving target table definitions and grants
    await promoteTable('comercial_base', 'comercial_base_staging');
    await client.query(`
      UPDATE comercial_base b
      SET sdr_nome = s.sdr_nome
      FROM comercial_base_staging s
      WHERE b.fato_jornada_comercial_key = s.fato_jornada_comercial_key
        AND b.sdr_nome IS DISTINCT FROM s.sdr_nome
    `);
    await promoteTable('comercial_indicador_segmentacao', 'comercial_indicador_segmentacao_staging');
    await promoteTable('comercial_propostas_historico', 'comercial_propostas_historico_staging');
    await promoteTable('comercial_propostas_consolidada', 'comercial_propostas_consolidada_staging');
    await promoteTable('comercial_cancelamentos', 'comercial_cancelamentos_staging');
    await promoteTable('comercial_distratos', 'comercial_distratos_staging');
    await promoteTable('dim_empreendimento', 'dim_empreendimento_staging');
    await promoteTable('dim_imobiliaria', 'dim_imobiliaria_staging');
    await promoteTable('dim_sdr_imobiliaria', 'dim_sdr_imobiliaria_staging');

    const dimCounts = await client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM public.dim_empreendimento_staging) AS staging_total,
        (SELECT COUNT(*)::bigint FROM public.dim_empreendimento) AS final_total,
        (SELECT COUNT(DISTINCT cidade) FROM public.dim_empreendimento WHERE NULLIF(TRIM(COALESCE(cidade,'')), '') IS NOT NULL) AS cidade_total,
        (SELECT COUNT(DISTINCT empreendimento) FROM public.dim_empreendimento WHERE NULLIF(TRIM(COALESCE(empreendimento,'')), '') IS NOT NULL) AS empreendimento_total,
        (SELECT COUNT(DISTINCT regiao) FROM public.dim_empreendimento WHERE NULLIF(TRIM(COALESCE(regiao,'')), '') IS NOT NULL) AS regiao_total,
        (SELECT COUNT(*)::bigint FROM public.dim_imobiliaria_staging) AS imobiliaria_staging_total,
        (SELECT COUNT(*)::bigint FROM public.dim_imobiliaria) AS imobiliaria_final_total,
        (SELECT COUNT(*)::bigint FROM public.dim_sdr_imobiliaria_staging) AS sdr_imobiliaria_staging_total,
        (SELECT COUNT(*)::bigint FROM public.dim_sdr_imobiliaria) AS sdr_imobiliaria_final_total
    `);
    const dimValidation = dimCounts.rows[0] || {};
    if (Number(dimValidation.staging_total || 0) > 0 && Number(dimValidation.final_total || 0) === 0) {
      throw new Error(`Dimensao dim_empreendimento vazia apos swap (staging=${dimValidation.staging_total}, final=${dimValidation.final_total})`);
    }

    await client.query('COMMIT');

    // Reset sequence after the transactional swap. Keep this best-effort outside
    // the swap transaction so a sequence issue cannot invalidate the data commit.
    await pool.query(`
      SELECT setval(
        pg_get_serial_sequence('comercial_base','fato_jornada_comercial_key'),
        COALESCE((SELECT MAX(fato_jornada_comercial_key::bigint) FROM public.comercial_base), 1),
        true
      )
    `).catch(() => {});

    const postCommitCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM public.comercial_base) AS comercial_base,
        (SELECT COUNT(*)::bigint FROM public.comercial_base_staging) AS comercial_base_staging,
        (SELECT COUNT(*)::bigint FROM public.comercial_indicador_segmentacao) AS comercial_indicador_segmentacao,
        (SELECT COUNT(*)::bigint FROM public.comercial_indicador_segmentacao_staging) AS comercial_indicador_segmentacao_staging
    `);
    const postCommit = postCommitCounts.rows[0] || {};
    if (postCommit.comercial_base !== postCommit.comercial_base_staging) {
      throw new Error(`Post-commit divergente para comercial_base; final=${postCommit.comercial_base}, staging=${postCommit.comercial_base_staging}`);
    }
    if (postCommit.comercial_indicador_segmentacao !== postCommit.comercial_indicador_segmentacao_staging) {
      throw new Error(`Post-commit divergente para comercial_indicador_segmentacao; final=${postCommit.comercial_indicador_segmentacao}, staging=${postCommit.comercial_indicador_segmentacao_staging}`);
    }

    console.log('✅ Swap staging -> production completed', dimValidation);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Swap failed, rolled back:', err?.message || err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  swapStaging().catch(() => process.exit(1));
}

export { swapStaging };
