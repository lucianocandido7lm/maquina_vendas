import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

async function migrateIncremental() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log('ℹ️ Nenhuma migration SQL encontrada em db/migrations.');
      await client.query('COMMIT');
      return;
    }

    for (const filename of files) {
      const exists = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE filename = $1 LIMIT 1',
        [filename],
      );

      if (exists.rowCount > 0) {
        console.log(`⏭️ Migration ja aplicada: ${filename}`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`🛠️ Aplicando migration: ${filename}`);
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [filename]);
      console.log(`✅ Migration aplicada: ${filename}`);
    }

    await client.query('COMMIT');
    console.log('✅ Migrações incrementais finalizadas com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao aplicar migrações incrementais:', error?.message || error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateIncremental().catch(() => {
    process.exitCode = 1;
  });
}

export { migrateIncremental };
