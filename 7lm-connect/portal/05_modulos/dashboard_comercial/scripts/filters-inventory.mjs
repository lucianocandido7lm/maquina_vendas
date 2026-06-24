import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_ENV_PATH = path.resolve(ROOT_DIR, 'backend', '.env');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'backend', 'reports');

dotenv.config({ path: BACKEND_ENV_PATH });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

const FILTER_QUERIES = {
  cidade: `
    SELECT DISTINCT
      NULLIF(TRIM(lead_cidade), '') AS value
    FROM comercial_base
    WHERE NULLIF(TRIM(lead_cidade), '') IS NOT NULL
    ORDER BY 1
  `,
  corretor: `
    SELECT DISTINCT
      NULLIF(TRIM(nome), '') AS value
    FROM public.vw_hierarquia_cvcrm h
    WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
      AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
      AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
      AND NULLIF(TRIM(nome), '') IS NOT NULL
    ORDER BY 1
  `,
  coordenacao: `
    SELECT DISTINCT
      NULLIF(TRIM(coordenador_nome), '') AS value
    FROM public.vw_hierarquia_cvcrm h
    WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
      AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
      AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
      AND NULLIF(TRIM(coordenador_nome), '') IS NOT NULL
    ORDER BY 1
  `,
  gerencia: `
    SELECT DISTINCT
      NULLIF(TRIM(gestor_nome), '') AS value
    FROM public.vw_hierarquia_cvcrm h
    WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
      AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
      AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
      AND NULLIF(TRIM(gestor_nome), '') IS NOT NULL
    ORDER BY 1
  `,
  sdr: `
    SELECT DISTINCT
      NULLIF(TRIM(nome), '') AS value
    FROM public.vw_hierarquia_sdr h
    WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
      AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
      AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
      AND NULLIF(TRIM(nome), '') IS NOT NULL
    ORDER BY 1
  `,
  origem: `
    SELECT DISTINCT
      NULLIF(TRIM(lead_origem_nome), '') AS value
    FROM comercial_base
    WHERE NULLIF(TRIM(lead_origem_nome), '') IS NOT NULL
    ORDER BY 1
  `,
  empreendimento: `
    SELECT DISTINCT
      NULLIF(TRIM(empreendimento_nome), '') AS value
    FROM comercial_base
    WHERE NULLIF(TRIM(empreendimento_nome), '') IS NOT NULL
    ORDER BY 1
  `,
  empreendimentoReduzido: `
    SELECT DISTINCT
      NULLIF(TRIM(regiao_empreendimento), '') AS value
    FROM comercial_base
    WHERE NULLIF(TRIM(regiao_empreendimento), '') IS NOT NULL
    ORDER BY 1
  `,
  imobiliaria: `
    SELECT DISTINCT
      NULLIF(TRIM(COALESCE(imobiliaria_nome_dim, imobiliaria_nome, idimobiliaria::text)), '') AS value
    FROM comercial_base
    WHERE NULLIF(TRIM(COALESCE(imobiliaria_nome_dim, imobiliaria_nome, idimobiliaria::text)), '') IS NOT NULL
    ORDER BY 1
  `,
};

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

async function fetchFilterValues() {
  const results = {};

  for (const [key, sql] of Object.entries(FILTER_QUERIES)) {
    const { rows } = await pool.query(sql);
    const values = rows
      .map((row) => String(row.value ?? '').trim())
      .filter((value) => value.length > 0);
    results[key] = values;
  }

  return results;
}

function buildReportPayload(values) {
  const timestamp = new Date().toISOString();
  const counts = Object.fromEntries(
    Object.entries(values).map(([key, list]) => [key, Array.isArray(list) ? list.length : 0]),
  );

  return {
    generatedAt: timestamp,
    counts,
    filters: values,
  };
}

async function writeReport(report) {
  await ensureReportsDir();
  const filename = `filters-inventory-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.resolve(REPORTS_DIR, filename);
  await fs.writeFile(filepath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filepath;
}

async function main() {
  try {
    const values = await fetchFilterValues();
    const report = buildReportPayload(values);
    const filepath = await writeReport(report);
    console.log(JSON.stringify({
      status: 'ok',
      report: filepath,
      counts: report.counts,
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error?.message || String(error) }));
  process.exitCode = 1;
});
