import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.resolve(ROOT_DIR, 'backend');
const BACKEND_ENV_PATH = path.resolve(BACKEND_DIR, '.env');
const REPORTS_DIR = path.resolve(BACKEND_DIR, 'reports');

dotenv.config({ path: BACKEND_ENV_PATH });

const API_BASE_URL = (process.env.VALIDATION_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, '');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

let baseColumns = null;
let empreendimentoDimReadyCache = null;
let empreendimentoDimReadyCacheTs = 0;
const EMPREENDIMENTO_DIM_CACHE_TTL_MS = 60 * 1000;
const COMBINATION_CACHE = new Map();

const FILTER_DEFAULTS = {
  cidade: 'todas',
  corretor: 'todos',
  empreendimento: 'todos',
  unidade: 'todos',
  imobiliaria: 'todas',
  gerencia: 'todas',
  coordenacao: 'todas',
  sdr: 'todos',
  origem: 'todas',
  empreendimentoReduzido: 'todos',
};

const BLANK_FILTER_VALUE = '__blank__';
const BLANK_FILTER_LABEL = 'Em branco / Nulo';

const FILTER_COLUMNS = {
  cidade: 'lead_cidade',
  empreendimento: 'empreendimento_nome',
  unidade: 'unidade_nome',
  origem: 'lead_origem_nome',
  sdr: 'sdr_nome',
  empreendimentoReduzido: 'regiao_empreendimento',
};

const HIERARCHY_FILTER_COLUMNS = {
  corretor: 'nome',
  gerencia: 'gestor_nome',
  coordenacao: 'coordenador_nome',
};

const HIERARCHY_ACTIVE_SQL = `
  LOWER(COALESCE(h.ativo_negocio, '')) = 's'
  AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
  AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
`;

function hierarchyImobiliariaKeySql(alias = 'h') {
  return `COALESCE(NULLIF(TRIM(${alias}.imobiliaria_nome_dim), ''), NULLIF(TRIM(${alias}.imobiliaria_nome), ''))`;
}

function hierarchyActiveAtDateSql(dateExpr) {
  return `
    LOWER(COALESCE(h.ativo_negocio, '')) = 's'
    AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia::date <= ${dateExpr}::date)
    AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia::date >= ${dateExpr}::date)
  `;
}

const PERIOD_KEYS = [
  'dia',
  'ontem',
  'semana',
  'semana_anterior',
  'mes',
  'mes_anterior',
  'trimestre',
  'trimestre_anterior',
  'ano',
  'ano_anterior',
];

const ENV_FILTER_KEYS = String(process.env.VALIDATION_FILTER_KEYS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const TARGET_FILTER_KEYS = ENV_FILTER_KEYS.length > 0 ? new Set(ENV_FILTER_KEYS) : null;

const ENV_FILTER_VALUES = String(process.env.VALIDATION_FILTER_VALUES || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const TARGET_FILTER_VALUES = ENV_FILTER_VALUES.length > 0 ? new Set(ENV_FILTER_VALUES) : null;

const ENV_PERIOD_KEYS = String(process.env.VALIDATION_PERIOD_KEYS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const TARGET_PERIOD_KEYS = ENV_PERIOD_KEYS.length > 0 ? new Set(ENV_PERIOD_KEYS) : null;

const BLANK_OPTION = { value: BLANK_FILTER_VALUE, label: BLANK_FILTER_LABEL };

const FILTER_KEYS = ['cidade', 'corretor', 'coordenacao', 'gerencia', 'sdr', 'origem', 'empreendimento', 'empreendimentoReduzido', 'imobiliaria'];
const PRIMARY_FILTER_KEYS = ['corretor', 'cidade', 'coordenacao', 'gerencia'];
const COMBINATION_PERIOD_KEYS = ['mes', 'mes_anterior'];

const FILTER_DIMENSION_MAP = {
  cidade: 'cidade',
  corretor: 'corretor',
  coordenacao: 'coordenacao',
  gerencia: 'gerencia',
  sdr: 'sdr',
  origem: 'origem',
  empreendimento: 'empreendimento',
  empreendimentoReduzido: 'empreendimentoReduzido',
  imobiliaria: 'imobiliaria',
};

const DEFAULT_BREAKDOWN_DIMENSIONS = new Set(['corretor', 'cidade', 'gerencia', 'coordenacao']);

const BLANK_LABELS_BY_DIMENSION = {
  cidade: ['Sem informacao', 'Em branco / Nulo'],
  corretor: ['Sem informacao', 'Em branco / Nulo'],
  coordenacao: ['Sem informacao', 'Em branco / Nulo'],
  gerencia: ['Sem informacao', 'Sem Gestor', 'Em branco / Nulo'],
  sdr: ['Sem informacao', 'Sem Gestor', 'Em branco / Nulo'],
  origem: ['Sem informacao', 'Nao Definido', 'Não Definido', 'Em branco / Nulo'],
  empreendimento: ['Sem informacao', 'Em branco / Nulo'],
  empreendimentoReduzido: ['Sem informacao', 'Em branco / Nulo'],
  imobiliaria: ['Sem informacao', '0', 'Em branco / Nulo'],
};

function normalizeOptionLabel(key, label) {
  const raw = String(label ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return raw;
  if ((key === 'gerencia' || key === 'coordenacao') && raw.toLowerCase() === 'sem gestor') {
    return 'Sem Gestor';
  }
  return raw;
}

function getBreakdownLabelCandidates(key, value) {
  if (value === BLANK_FILTER_VALUE || value === BLANK_FILTER_LABEL) {
    return BLANK_LABELS_BY_DIMENSION[key] || [BLANK_FILTER_LABEL, 'Sem informacao'];
  }
  const normalized = normalizeOptionLabel(key, value);
  if (!normalized) {
    return BLANK_LABELS_BY_DIMENSION[key] || [BLANK_FILTER_LABEL];
  }
  return [normalized, value];
}

const PERIOD_PRESETS = {
  get dia() { return { start: today(), end: today() }; },
  get ontem() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    const iso = toDateInputValue(date);
    return { start: iso, end: iso };
  },
  get semana() { return getWeekBounds(); },
  get semana_anterior() { return getWeekBounds(-7); },
  get mes() { return getMonthBounds(0); },
  get mes_anterior() { return getMonthBounds(-1); },
  get trimestre() { return getQuarterBounds(0); },
  get trimestre_anterior() { return getQuarterBounds(-1); },
  get ano() { return getYearBounds(0); },
  get ano_anterior() { return getYearBounds(-1); },
};

function today() {
  return toDateInputValue(new Date());
}

function toDateInputValue(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekBounds(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const weekday = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: toDateInputValue(monday), end: toDateInputValue(sunday) };
}

function getMonthBounds(offsetMonths = 0) {
  const now = new Date();
  now.setUTCMonth(now.getUTCMonth() + offsetMonths);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function getQuarterBounds(offsetQuarters = 0) {
  const now = new Date();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + offsetQuarters;
  const targetYear = now.getUTCFullYear() + Math.floor(currentQuarter / 4);
  const quarterIndex = ((currentQuarter % 4) + 4) % 4;
  const startMonth = quarterIndex * 3;
  const start = new Date(Date.UTC(targetYear, startMonth, 1));
  const end = new Date(Date.UTC(targetYear, startMonth + 3, 0));
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function getYearBounds(offsetYears = 0) {
  const now = new Date();
  const year = now.getUTCFullYear() + offsetYears;
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function computeComparisonRange(startDate, endDate, rule = 'anterior') {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const rangeDays = Math.floor((end - start) / 86400000) + 1;

  switch (rule) {
    case 'ontem': {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const iso = yesterday.toISOString().split('T')[0];
      return { start: iso, end: iso };
    }
    case 'mes_anterior': {
      const prevStart = new Date(start);
      prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
      const prevEnd = new Date(end);
      prevEnd.setUTCMonth(prevEnd.getUTCMonth() - 1);
      const isWholeMonth = start.getUTCDate() === 1 && new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getUTCDate() === end.getUTCDate();
      if (isWholeMonth) {
        const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
        const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
        return { start: first.toISOString().split('T')[0], end: last.toISOString().split('T')[0] };
      }
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    }
    case 'trimestre_anterior': {
      const prevStart = new Date(start);
      prevStart.setUTCMonth(prevStart.getUTCMonth() - 3);
      const prevEnd = new Date(end);
      prevEnd.setUTCMonth(prevEnd.getUTCMonth() - 3);
      const isWholeQuarter = start.getUTCDate() === 1 && start.getUTCMonth() % 3 === 0 && new Date(start.getUTCFullYear(), start.getUTCMonth() + 3, 0).getUTCDate() === end.getUTCDate();
      if (isWholeQuarter) {
        const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, 1));
        const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
        return { start: first.toISOString().split('T')[0], end: last.toISOString().split('T')[0] };
      }
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    }
    case 'ano_anterior': {
      const prevStart = new Date(start);
      prevStart.setUTCFullYear(prevStart.getUTCFullYear() - 1);
      const prevEnd = new Date(end);
      prevEnd.setUTCFullYear(prevEnd.getUTCFullYear() - 1);
      const isWholeYear = start.getUTCDate() === 1 && start.getUTCMonth() === 0 && end.getUTCDate() === 31 && end.getUTCMonth() === 11;
      if (isWholeYear) {
        const prevYear = start.getUTCFullYear() - 1;
        return { start: `${prevYear}-01-01`, end: `${prevYear}-12-31` };
      }
      return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
    }
    case 'anterior':
    default:
      return {
        start: shiftDate(startDate, -rangeDays),
        end: shiftDate(startDate, -1),
      };
  }
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

async function ensureBaseColumns() {
  if (baseColumns instanceof Set) return baseColumns;
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comercial_base'
  `);
  baseColumns = new Set(result.rows.map((row) => row.column_name));
  return baseColumns;
}

async function hasEmpreendimentoDimReady() {
  const now = Date.now();
  if (empreendimentoDimReadyCache !== null && (now - empreendimentoDimReadyCacheTs) < EMPREENDIMENTO_DIM_CACHE_TTL_MS) {
    return empreendimentoDimReadyCache;
  }
  try {
    const result = await pool.query(`
      SELECT
        to_regclass('public.dim_empreendimento') IS NOT NULL AS table_exists,
        (SELECT COUNT(*)::bigint FROM public.dim_empreendimento) AS total
    `);
    const row = result.rows[0] || {};
    empreendimentoDimReadyCache = Boolean(row.table_exists) && Number(row.total || 0) > 0;
  } catch {
    empreendimentoDimReadyCache = false;
  }
  empreendimentoDimReadyCacheTs = now;
  return empreendimentoDimReadyCache;
}

function sanitizeCorretorValue(value) {
  if (!value || value === BLANK_FILTER_VALUE) return value;
  return String(value).replace(/\s*-\s*(CLT|PJ)$/i, '').trim();
}

function getEmpreendimentoJoinKeyExpr(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}idempreendimento_canonico, ${prefix}idempreendimento)`;
}

function getEmpreendimentoDimExpr(column, baseAlias = '') {
  const prefix = baseAlias ? `${baseAlias}.` : '';
  return `(
    SELECT d.${column}
    FROM public.dim_empreendimento d
    WHERE d.idempreendimento = ${getEmpreendimentoJoinKeyExpr(baseAlias)}
    LIMIT 1
  )`;
}

function getEmpreendimentoReduzidoExpr(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `
    COALESCE(
      NULLIF(${prefix}regiao_empreendimento, ''),
      CASE
        WHEN UPPER(TRIM(COALESCE(${prefix}empreendimento_nome, ''))) LIKE 'RETOMADOS%' THEN 'Retomados'
        ELSE NULLIF(SUBSTRING(TRIM(SPLIT_PART(COALESCE(${prefix}empreendimento_nome, ''), '-', 1)) FROM '^[A-Za-z]+'), '')
      END
    )
  `;
}

function getImobiliariaExpr(alias = '', columns = baseColumns) {
  const prefix = alias ? `${alias}.` : '';
  if (columns?.has('imobiliaria_nome_dim') && columns?.has('imobiliaria_nome')) {
    return `COALESCE(${prefix}imobiliaria_nome_dim, ${prefix}imobiliaria_nome, ${prefix}idimobiliaria::text)`;
  }
  if (columns?.has('imobiliaria_nome_dim')) {
    return `COALESCE(${prefix}imobiliaria_nome_dim, ${prefix}idimobiliaria::text)`;
  }
  if (columns?.has('imobiliaria_nome')) {
    return `COALESCE(${prefix}imobiliaria_nome, ${prefix}idimobiliaria::text)`;
  }
  return `${prefix}idimobiliaria::text`;
}

const EMPREENDIMENTO_DIM_FILTER_COLUMNS = {
  empreendimento: 'empreendimento',
  empreendimentoReduzido: 'regiao',
};

function pickBaseColumn(preferred, fallback) {
  if (baseColumns?.has(preferred)) return preferred;
  return fallback;
}

const KPI_DATE_COLUMNS = {
  lead: () => pickBaseColumn('dt_lead', 'dt_ultima_conversao_lead'),
  visita: () => pickBaseColumn('dt_visita', 'dt_visita_realizada'),
  venda: () => 'data_venda',
  repasse: () => pickBaseColumn('dt_repasse', 'dt_assinatura_contrato'),
};

function getDayRangeSql(columnExpr, startParam = '$1', endParam = '$2') {
  return `
    ${columnExpr} >= ${startParam}::date
    AND ${columnExpr} < (${endParam}::date + INTERVAL '1 day')
  `;
}

function normalizeFiltersFromQuery(query) {
  const norm = {
    cidade: query.cidade,
    corretor: query.corretor,
    empreendimento: query.empreendimento,
    unidade: query.unidade,
    imobiliaria: query.imobiliaria,
    gerencia: query.gerencia,
    coordenacao: query.coordenacao,
    origem: query.origem,
    sdr: query.sdr,
    empreendimentoReduzido: query.empreendimentoReduzido,
  };

  Object.keys(norm).forEach((key) => {
    let val = norm[key];
    if (Array.isArray(val)) {
      const normalizedValues = val
        .flatMap((item) => String(item ?? '').split(','))
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== 'todos' && item !== 'todas');
      norm[key] = normalizedValues;
      return;
    }
    if (val && typeof val === 'string') {
      if (val.includes(',')) {
        norm[key] = val.split(',').map((item) => item.trim()).filter(Boolean);
      } else if (val !== 'todos' && val !== 'todas' && val !== '') {
        norm[key] = [val];
      } else {
        norm[key] = [];
      }
    } else if (!val) {
      norm[key] = [];
    }
  });

  if (Array.isArray(norm.corretor)) {
    norm.corretor = norm.corretor.map((value) => sanitizeCorretorValue(value));
  }

  return norm;
}

function buildMixedFilterClause(expr, value, params, parameterIndexRef) {
  const values = Array.isArray(value) ? value : [value];
  const includeBlank = values.includes(BLANK_FILTER_VALUE);
  const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

  if (includeBlank && regularValues.length > 0) {
    params.push(regularValues);
    const clause = `(${expr} = ANY($${parameterIndexRef.value}) OR NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL)`;
    parameterIndexRef.value += 1;
    return clause;
  }

  if (includeBlank) {
    return `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
  }

  if (regularValues.length > 1) {
    params.push(regularValues);
    const clause = `${expr} = ANY($${parameterIndexRef.value})`;
    parameterIndexRef.value += 1;
    return clause;
  }

  params.push(regularValues[0]);
  const clause = `${expr} = $${parameterIndexRef.value}`;
  parameterIndexRef.value += 1;
  return clause;
}

function buildFilters(queryFilters, { startIndex = 1, alias = '', useEmpreendimentoDim = false } = {}) {
  const params = [];
  let where = '';
  const parameterIndexRef = { value: startIndex };
  const prefix = alias ? `${alias}.` : '';
  const empreendimentoReduzidoExpr = getEmpreendimentoReduzidoExpr(alias);

  Object.entries(FILTER_COLUMNS).forEach(([field, column]) => {
    let value = queryFilters[field];
    if (!value || value === FILTER_DEFAULTS[field]) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (Array.isArray(value) && value.includes('todos')) return;

    if (useEmpreendimentoDim && EMPREENDIMENTO_DIM_FILTER_COLUMNS[field]) {
      const dimColumn = EMPREENDIMENTO_DIM_FILTER_COLUMNS[field];
      const clause = buildMixedFilterClause(`d.${dimColumn}`, value, params, parameterIndexRef);
      where += `
        AND EXISTS (
          SELECT 1
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = ${getEmpreendimentoJoinKeyExpr(alias)}
            AND ${clause}
        )`;
      return;
    }

    if (field === 'empreendimentoReduzido') {
      const clause = buildMixedFilterClause(empreendimentoReduzidoExpr, value, params, parameterIndexRef);
      where += ` AND ${clause}`;
      return;
    }

    if (baseColumns && !baseColumns.has(column)) return;
    const clause = buildMixedFilterClause(`${prefix}${column}`, value, params, parameterIndexRef);
    where += ` AND ${clause}`;
  });

  const valueImobiliaria = queryFilters.imobiliaria;
  if (valueImobiliaria && valueImobiliaria !== FILTER_DEFAULTS.imobiliaria) {
    if (!(Array.isArray(valueImobiliaria) && (valueImobiliaria.length === 0 || valueImobiliaria.includes('todas')))) {
      const values = Array.isArray(valueImobiliaria) ? valueImobiliaria : [valueImobiliaria];
      const includeBlank = values.includes(BLANK_FILTER_VALUE);
      const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

      if (baseColumns?.has('corretor_nome')) {
        const hierarchyKey = hierarchyImobiliariaKeySql('h');
        if (includeBlank && regularValues.length > 0) {
          params.push(regularValues);
          where += `
            AND (
              EXISTS (
                SELECT 1
                FROM public.vw_hierarquia_cvcrm h
                WHERE h.nome = ${prefix}corretor_nome
                  AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                  AND ${hierarchyKey} = ANY($${parameterIndexRef.value})
              )
              OR NOT EXISTS (
                SELECT 1
                FROM public.vw_hierarquia_cvcrm h
                WHERE h.nome = ${prefix}corretor_nome
                  AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                  AND NULLIF(TRIM(COALESCE(${hierarchyKey}, '')), '') IS NOT NULL
              )
            )`;
          parameterIndexRef.value += 1;
        } else if (includeBlank) {
          where += `
            AND NOT EXISTS (
              SELECT 1
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.nome = ${prefix}corretor_nome
                AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                AND NULLIF(TRIM(COALESCE(${hierarchyKey}, '')), '') IS NOT NULL
            )`;
        } else if (regularValues.length > 1) {
          params.push(regularValues);
          where += `
            AND EXISTS (
              SELECT 1
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.nome = ${prefix}corretor_nome
                AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                AND ${hierarchyKey} = ANY($${parameterIndexRef.value})
            )`;
          parameterIndexRef.value += 1;
        } else if (regularValues.length === 1) {
          params.push(regularValues[0]);
          where += `
            AND EXISTS (
              SELECT 1
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.nome = ${prefix}corretor_nome
                AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                AND ${hierarchyKey} = $${parameterIndexRef.value}
            )`;
          parameterIndexRef.value += 1;
        }
      } else {
        const clause = buildMixedFilterClause(getImobiliariaExpr(alias, baseColumns), valueImobiliaria, params, parameterIndexRef);
        where += ` AND ${clause}`;
      }
    }
  }

  Object.entries(HIERARCHY_FILTER_COLUMNS).forEach(([field, hierarchyColumn]) => {
    const value = queryFilters[field];
    if (!value || value === FILTER_DEFAULTS[field]) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (Array.isArray(value) && value.includes('todos')) return;
    if (baseColumns && !baseColumns.has('corretor_nome')) return;

    const values = Array.isArray(value) ? value : [value];
    const includeBlank = values.includes(BLANK_FILTER_VALUE);
    const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

    if (field === 'corretor') {
      const normalizedValues = regularValues.map((item) => sanitizeCorretorValue(item)?.toLowerCase()).filter(Boolean);
      const expr = `LOWER(REGEXP_REPLACE(h.${hierarchyColumn}, '\\s*-\\s*(CLT|PJ)$', '', 'ig'))`;

      if (includeBlank && normalizedValues.length > 0) {
        params.push(normalizedValues);
        where += `
          AND (
            EXISTS (
              SELECT 1
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.nome = ${prefix}corretor_nome
                AND ${HIERARCHY_ACTIVE_SQL}
                AND ${expr} = ANY($${parameterIndexRef.value})
            )
            OR NOT EXISTS (
              SELECT 1
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.nome = ${prefix}corretor_nome
                AND ${HIERARCHY_ACTIVE_SQL}
                AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
            )
          )`;
        parameterIndexRef.value += 1;
        return;
      }

      if (includeBlank) {
        where += `
          AND NOT EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
          )`;
        return;
      }

      if (normalizedValues.length > 1) {
        params.push(normalizedValues);
        where += `
          AND EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND ${expr} = ANY($${parameterIndexRef.value})
          )`;
        parameterIndexRef.value += 1;
      } else if (normalizedValues.length === 1) {
        params.push(normalizedValues[0]);
        where += `
          AND EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND ${expr} = $${parameterIndexRef.value}
          )`;
        parameterIndexRef.value += 1;
      }
      return;
    }

    const loweredValues = regularValues.map((item) => String(item).toLowerCase());

    if (includeBlank && loweredValues.length > 0) {
      params.push(loweredValues);
      where += `
        AND (
          EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND LOWER(COALESCE(h.${hierarchyColumn}, '')) = ANY($${parameterIndexRef.value})
          )
          OR NOT EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
          )
        )`;
      parameterIndexRef.value += 1;
      return;
    }

    if (includeBlank) {
      where += `
        AND NOT EXISTS (
          SELECT 1
          FROM public.vw_hierarquia_cvcrm h
          WHERE h.nome = ${prefix}corretor_nome
            AND ${HIERARCHY_ACTIVE_SQL}
            AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
        )`;
      return;
    }

    if (loweredValues.length > 1) {
      params.push(loweredValues);
      where += `
        AND EXISTS (
          SELECT 1
          FROM public.vw_hierarquia_cvcrm h
          WHERE h.nome = ${prefix}corretor_nome
            AND ${HIERARCHY_ACTIVE_SQL}
            AND LOWER(COALESCE(h.${hierarchyColumn}, '')) = ANY($${parameterIndexRef.value})
        )`;
      parameterIndexRef.value += 1;
    } else if (loweredValues.length === 1) {
      params.push(loweredValues[0]);
      where += `
        AND EXISTS (
          SELECT 1
          FROM public.vw_hierarquia_cvcrm h
          WHERE h.nome = ${prefix}corretor_nome
            AND ${HIERARCHY_ACTIVE_SQL}
            AND LOWER(COALESCE(h.${hierarchyColumn}, '')) = $${parameterIndexRef.value}
        )`;
      parameterIndexRef.value += 1;
    }
  });

  return { where, params, parameterIndex: parameterIndexRef.value };
}

function buildHierarchyOnlyFilters(queryFilters, { startIndex = 1, alias = 'h', useEmpreendimentoDim = false, joinCol = 'corretor_nome' } = {}) {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;
  const prefix = alias ? `${alias}.` : '';

  const buildClause = (expr, value) => {
    const values = Array.isArray(value) ? value : [value];
    const includeBlank = values.includes(BLANK_FILTER_VALUE);
    const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL)`;
      parameterIndex += 1;
      return clause;
    }
    if (includeBlank) {
      return `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
    }
    if (regularValues.length > 1) {
      params.push(regularValues);
      const clause = `${expr} = ANY($${parameterIndex})`;
      parameterIndex += 1;
      return clause;
    }
    params.push(regularValues[0]);
    const clause = `${expr} = $${parameterIndex}`;
    parameterIndex += 1;
    return clause;
  };

  const hierarchyColumns = {
    corretor: 'nome',
    gerencia: 'gestor_nome',
    coordenacao: 'coordenador_nome',
  };

  Object.entries(hierarchyColumns).forEach(([field, column]) => {
    let value = queryFilters[field];
    if (!value || value === FILTER_DEFAULTS[field]) return;
    if (Array.isArray(value) && (value.length === 0 || value.includes('todos'))) return;

    let expr = `${prefix}${column}`;
    if (field === 'corretor') {
      const normalizeInput = (input) => sanitizeCorretorValue(input)?.toLowerCase();
      if (Array.isArray(value)) {
        value = value.map((item) => (item === BLANK_FILTER_VALUE ? item : normalizeInput(item)));
      } else if (value !== BLANK_FILTER_VALUE) {
        value = normalizeInput(value);
      }
      expr = `LOWER(REGEXP_REPLACE(${prefix}${column}, '\\s*-\\s*(CLT|PJ)$', '', 'ig'))`;
    }

    where += ` AND ${buildClause(expr, value)}`;
  });

  const value = queryFilters.imobiliaria;
  if (value && value !== FILTER_DEFAULTS.imobiliaria) {
    if (!(Array.isArray(value) && (value.length === 0 || value.includes('todas')))) {
      where += ` AND ${buildClause(hierarchyImobiliariaKeySql(alias), value)}`;
    }
  }

  const transactionFilters = {
    cidade: 'lead_cidade',
    empreendimento: useEmpreendimentoDim ? 'd.empreendimento' : 'empreendimento_nome',
    origem: 'lead_origem_nome',
    empreendimentoReduzido: useEmpreendimentoDim ? 'd.regiao' : getEmpreendimentoReduzidoExpr('b_inner'),
  };

  Object.entries(transactionFilters).forEach(([field, column]) => {
    const val = queryFilters[field];
    if (!val || val === FILTER_DEFAULTS[field]) return;
    if (Array.isArray(val) && (val.length === 0 || val.includes('todos') || val.includes('todas'))) return;

    const clause = buildClause(column, val);

    let dateLimit = '';
    if (queryFilters.start && queryFilters.end) {
      params.push(queryFilters.start, queryFilters.end);
      dateLimit = `AND (dt_assinatura_contrato::date BETWEEN $${parameterIndex} AND $${parameterIndex + 1} OR dt_cadastro_reserva::date BETWEEN $${parameterIndex} AND $${parameterIndex + 1})`;
      parameterIndex += 2;
    }

    const dimJoin = useEmpreendimentoDim
      ? `LEFT JOIN public.dim_empreendimento d ON d.idempreendimento = ${getEmpreendimentoJoinKeyExpr('b_inner')}`
      : '';

    where += `
      AND EXISTS (
        SELECT 1 FROM comercial_base b_inner
        ${dimJoin}
        WHERE b_inner.${joinCol} = ${prefix}nome
          AND ${clause}
          ${dateLimit}
      )
    `;
  });

  return { where, params };
}

function buildEmpreendimentoDimFilters(queryFilters, { startIndex = 1, alias = 'd' } = {}) {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;

  const appendValues = (column, values) => {
    if (!values || (Array.isArray(values) && values.length === 0)) return;
    const normalized = (Array.isArray(values) ? values : [values])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .filter((item) => item !== 'todos' && item !== 'todas');
    if (normalized.length === 0) return;
    params.push(normalized);
    where += ` AND ${alias}.${column} = ANY($${parameterIndex})`;
    parameterIndex += 1;
  };

  appendValues('cidade', queryFilters.cidade);
  appendValues('empreendimento', queryFilters.empreendimento);
  appendValues('regiao', queryFilters.empreendimentoReduzido);

  return { where, params };
}

function buildDailyAggregateFilters(queryFilters, { startIndex = 1, alias = 'd' } = {}) {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;
  const prefix = alias ? `${alias}.` : '';

  const addInFilter = (column, values) => {
    if (values == null) return;
    const normalizedValues = Array.isArray(values) ? values : [values];
    const cleanedValues = normalizedValues
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .filter((item) => item !== 'todos' && item !== 'todas');
    if (cleanedValues.length === 0) return;
    params.push(cleanedValues);
    where += ` AND ${prefix}${column} = ANY($${parameterIndex})`;
    parameterIndex += 1;
  };

  addInFilter('cidade', queryFilters.cidade);
  addInFilter('origem', queryFilters.origem);
  addInFilter('empreendimento', queryFilters.empreendimento);
  addInFilter('empreendimento_reduzido', queryFilters.empreendimentoReduzido);
  addInFilter('sdr', queryFilters.sdr);
  addInFilter('corretor', queryFilters.corretor);
  addInFilter('gerencia', queryFilters.gerencia);
  addInFilter('coordenacao', queryFilters.coordenacao);
  addInFilter('imobiliaria', queryFilters.imobiliaria);

  return { where, params };
}

const EVENT_TO_BASE_JOIN = `
  (
    (b.idreserva IS NOT NULL AND b.idreserva = EVENT.idreserva)
    OR (b.idlead IS NOT NULL AND b.idlead = EVENT.idlead)
    OR (b.idprecadastro IS NOT NULL AND b.idprecadastro = EVENT.idprecadastro)
  )
`;

const SLA_FINALIZACAO_EXPR = `
  CASE
    WHEN dt_contrato_contabilizado IS NOT NULL
      AND dt_cadastro_reserva IS NOT NULL
      AND dt_contrato_contabilizado >= dt_cadastro_reserva
    THEN (dt_contrato_contabilizado::date - dt_cadastro_reserva::date)
    ELSE NULL
  END
`;

const SLA_REPASSE_EXPR = `
  CASE
    WHEN dt_assinatura_contrato IS NOT NULL
      AND dt_contrato_contabilizado IS NOT NULL
      AND dt_assinatura_contrato >= dt_contrato_contabilizado
    THEN (dt_assinatura_contrato::date - dt_contrato_contabilizado::date)
    ELSE NULL
  END
`;

async function loadLatestInventory() {
  const files = await fs.readdir(REPORTS_DIR).catch(() => []);
  const inventoryFiles = files.filter((name) => name.startsWith('filters-inventory-') && name.endsWith('.json'));
  if (!inventoryFiles.length) return null;
  inventoryFiles.sort((a, b) => (a > b ? -1 : 1));
  const latest = inventoryFiles[0];
  const content = await fs.readFile(path.resolve(REPORTS_DIR, latest), 'utf8');
  return JSON.parse(content);
}

async function ensureBackendServer() {
  const testRange = PERIOD_PRESETS.mes;
  const params = new URLSearchParams({ startDate: testRange.start, endDate: testRange.end });
  const url = `${API_BASE_URL}/api/v1/dashboard/summary?${params.toString()}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      return { process: null, alreadyRunning: true };
    }
  } catch {
    // spawn below
  }

  const child = spawn('node', ['backend/server.js'], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: 'ignore',
  });

  const waitUntil = Date.now() + 45000;
  while (Date.now() < waitUntil) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return { process: child, alreadyRunning: false };
      }
    } catch {
      // keep waiting
    }
  }

  throw new Error('Backend server did not respond in time');
}

function formatFiltersForParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.append(key, value.join(','));
    } else if (value !== FILTER_DEFAULTS[key]) {
      params.append(key, value);
    }
  });
  return params;
}

async function fetchSummaryFromApi({ start, end, filters }) {
  const params = formatFiltersForParams(filters ?? {});
  params.set('startDate', start);
  params.set('endDate', end);
  const url = `${API_BASE_URL}/api/v1/dashboard/summary?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`summary api ${response.status}: ${text}`);
  }
  return response.json();
}

async function fetchTrendsFromApi({ start, end, filters }) {
  const params = formatFiltersForParams(filters ?? {});
  params.set('startDate', start);
  params.set('endDate', end);
  const url = `${API_BASE_URL}/api/v1/dashboard/trends?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`trends api ${response.status}: ${text}`);
  }
  return response.json();
}

async function fetchBreakdownFromApi({ start, end, filters, dimension, kpi = 'leads' }) {
  const params = formatFiltersForParams(filters ?? {});
  params.set('startDate', start);
  params.set('endDate', end);
  params.set('dimension', dimension);
  params.set('kpi', kpi);
  params.set('limit', '10000');
  const url = `${API_BASE_URL}/api/v1/dashboard/breakdown?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`breakdown api ${dimension} ${response.status}: ${text}`);
  }
  return response.json();
}

async function computeSummarySql({ start, end, filters }) {
  const normalized = normalizeFiltersFromQuery(filters ?? {});
  const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
  const leadDateCol = KPI_DATE_COLUMNS.lead();
  const visitaDateCol = KPI_DATE_COLUMNS.visita();
  const vendaDateCol = KPI_DATE_COLUMNS.venda();
  const repasseDateCol = KPI_DATE_COLUMNS.repasse();
  const hasActiveDimensionFilters = ['cidade', 'origem', 'sdr', 'corretor', 'gerencia', 'coordenacao', 'empreendimento', 'empreendimentoReduzido', 'unidade', 'imobiliaria']
    .some((key) => Array.isArray(normalized[key]) ? normalized[key].length > 0 : Boolean(normalized[key] && normalized[key] !== FILTER_DEFAULTS[key]));

  const { where, params } = buildFilters(normalized, { startIndex: 3, useEmpreendimentoDim });
  const { where: whereBaseAlias, params: paramsBaseAlias } = buildFilters(normalized, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
  const { where: hierarchyWhere, params: hierarchyParams } = buildHierarchyOnlyFilters({ ...normalized, start, end }, { startIndex: 3 + params.length, alias: 'h', useEmpreendimentoDim });

  const queryParams = [start, end, ...params];
  const queryParamsBaseAlias = [start, end, ...paramsBaseAlias];
  const queryParamsWithHierarchy = [start, end, ...params, ...hierarchyParams];

  const useDailySummary = String(process.env.DASHBOARD_SUMMARY_USE_DAILY || 'false').toLowerCase() === 'true';
  if (useDailySummary) {
    const { where: dailyWhere, params: dailyParams } = buildDailyAggregateFilters(normalized, { startIndex: 3, alias: 'k' });
    const hDaily = buildHierarchyOnlyFilters({ ...normalized, start, end }, { startIndex: 1, alias: 'h', useEmpreendimentoDim });

    const dailySummarySql = `
      SELECT
        COALESCE(SUM(k.leads), 0)::bigint AS total_leads,
        COALESCE(SUM(k.visitas), 0)::bigint AS total_visitas,
        COALESCE(SUM(k.propostas_aprovadas), 0)::bigint AS total_propostas_aprovadas,
        COALESCE(SUM(k.propostas_condicionadas), 0)::bigint AS total_propostas_condicionadas,
        COALESCE(SUM(k.propostas_reprovadas), 0)::bigint AS total_propostas_reprovadas,
        COALESCE(SUM(k.propostas_aprovadas + k.propostas_condicionadas + k.propostas_reprovadas), 0)::bigint AS total_propostas_geral,
        COALESCE(SUM(k.vendas), 0)::bigint AS total_vendas,
        COALESCE(SUM(k.cancelamentos), 0)::bigint AS total_cancelamentos,
        COALESCE(SUM(k.distratos), 0)::bigint AS total_distratos,
        COALESCE(SUM(k.repasses), 0)::bigint AS total_repasses,
        CASE WHEN COALESCE(SUM(k.sla_finalizacao_count), 0) > 0
          THEN (COALESCE(SUM(k.sla_finalizacao_sum), 0) / NULLIF(SUM(k.sla_finalizacao_count), 0))
          ELSE NULL
        END AS avg_sla_finalizacao,
        CASE WHEN COALESCE(SUM(k.sla_repasse_count), 0) > 0
          THEN (COALESCE(SUM(k.sla_repasse_sum), 0) / NULLIF(SUM(k.sla_repasse_count), 0))
          ELSE NULL
        END AS avg_sla_repasse
      FROM comercial_kpi_daily k
      WHERE k.data BETWEEN $1::date AND $2::date
        ${dailyWhere}
    `;

    const ipcSql = `
      SELECT
        (
          SELECT COUNT(DISTINCT documento) FROM public.vw_hierarquia_cvcrm h
          WHERE ${hierarchyActiveAtDateSql(`$${hDaily.params.length + 1}::date`)}
            ${hDaily.where}
        ) AS total_corretores,
        (
          SELECT COUNT(DISTINCT ${hierarchyImobiliariaKeySql('h')}) FROM public.vw_hierarquia_cvcrm h
          WHERE ${hierarchyActiveAtDateSql(`$${hDaily.params.length + 1}::date`)}
            AND ${hierarchyImobiliariaKeySql('h')} IS NOT NULL
            ${hDaily.where}
        ) AS total_imobiliarias
    `;

    const [dailySummaryResult, ipcResult] = await Promise.all([
      pool.query(dailySummarySql, [start, end, ...dailyParams]),
      pool.query(ipcSql, [...hDaily.params, end]),
    ]);

    const row = dailySummaryResult.rows[0] || {};
    const ipcRow = ipcResult.rows[0] || {};
    const totalRepasses = Number(row.total_repasses) || 0;
    const totalCorretores = Number(ipcRow.total_corretores) || 0;
    const totalImobiliarias = Number(ipcRow.total_imobiliarias) || 0;
    const totalIpcCorretor = totalCorretores > 0 ? Number((totalRepasses / totalCorretores).toFixed(2)) : 0;
    const totalIpcImobiliaria = totalImobiliarias > 0 ? Number((totalRepasses / totalImobiliarias).toFixed(2)) : 0;

    return {
      total_leads: Number(row.total_leads) || 0,
      total_visitas: Number(row.total_visitas) || 0,
      total_propostas: Number(row.total_propostas_geral) || 0,
      total_propostas_aprovadas: Number(row.total_propostas_aprovadas) || 0,
      total_propostas_condicionadas: Number(row.total_propostas_condicionadas) || 0,
      total_propostas_reprovadas: Number(row.total_propostas_reprovadas) || 0,
      total_propostas_geral: Number(row.total_propostas_geral) || 0,
      total_vendas: Number(row.total_vendas) || 0,
      total_cancelamentos: Number(row.total_cancelamentos) || 0,
      total_distratos: Number(row.total_distratos) || 0,
      total_repasses: totalRepasses,
      total_sla_finalizacao: Number((Number(row.avg_sla_finalizacao) || 0).toFixed(2)),
      total_sla_repasse: Number((Number(row.avg_sla_repasse) || 0).toFixed(2)),
      total_ipc: totalIpcCorretor,
      total_ipc_corretor: totalIpcCorretor,
      total_ipc_imobiliaria: totalIpcImobiliaria,
      total_corretores_ativos: totalCorretores,
      total_imobiliarias_ativas: totalImobiliarias,
      ipc_corretores_ativos: totalCorretores,
      ipc_imobiliarias_ativas: totalImobiliarias,
    };
  }

  const summarySql = `
    SELECT 
      COUNT(DISTINCT idlead) FILTER (WHERE ${getDayRangeSql(leadDateCol)} AND idlead IS NOT NULL) as total_leads,
      COUNT(DISTINCT idlead) FILTER (WHERE ${getDayRangeSql(visitaDateCol)} AND idlead IS NOT NULL) as total_visitas,
      COUNT(DISTINCT idreserva) FILTER (WHERE ${getDayRangeSql(vendaDateCol)} AND idreserva IS NOT NULL) as total_vendas,
      COUNT(DISTINCT idrepasse) FILTER (WHERE ${getDayRangeSql(repasseDateCol)} AND fl_repasse_assinado = true) as total_repasses,
      AVG(sla_finalizacao_dias) FILTER (WHERE ${getDayRangeSql('dt_contrato_contabilizado')}) as avg_sla_finalizacao,
      AVG(sla_repasse_dias) FILTER (WHERE ${getDayRangeSql(repasseDateCol)}) as avg_sla_repasse
    FROM comercial_base
    WHERE 1=1 ${where}
  `;

  const propostasSql = `
    SELECT
      COUNT(DISTINCT pc.idprecadastro) FILTER (
        WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
          AND pc.proposta_status_atual = 'APROVADA'
      ) AS total_propostas_aprovadas,
      COUNT(DISTINCT pc.idprecadastro) FILTER (
        WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
          AND pc.proposta_status_atual = 'CONDICIONADA'
      ) AS total_propostas_condicionadas,
      COUNT(DISTINCT pc.idprecadastro) FILTER (
        WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
          AND pc.proposta_status_atual = 'REPROVADA'
      ) AS total_propostas_reprovadas,
      COUNT(DISTINCT pc.idprecadastro) FILTER (
        WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
          AND pc.proposta_status_atual IN ('APROVADA', 'CONDICIONADA', 'REPROVADA')
      ) AS total_propostas_geral
    FROM comercial_propostas_consolidada pc
    ${hasActiveDimensionFilters ? 'LEFT JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro' : ''}
    WHERE 1=1
    ${hasActiveDimensionFilters ? whereBaseAlias : ''}
  `;

  const cancelSql = `
    SELECT COUNT(DISTINCT cc.idreserva) as total_cancelamentos 
    FROM comercial_cancelamentos cc
    LEFT JOIN LATERAL (
      SELECT *
      FROM comercial_base b
      WHERE ${EVENT_TO_BASE_JOIN.replaceAll('EVENT', 'cc')}
      LIMIT 1
    ) b ON TRUE
    WHERE ${getDayRangeSql('cc.data_cancelamento')}
      ${whereBaseAlias}
  `;

  const distratoSql = `
    SELECT COUNT(DISTINCT cd.idreserva) as total_distratos 
    FROM comercial_distratos cd
    LEFT JOIN LATERAL (
      SELECT *
      FROM comercial_base b
      WHERE ${EVENT_TO_BASE_JOIN.replaceAll('EVENT', 'cd')}
      LIMIT 1
    ) b ON TRUE
    WHERE ${getDayRangeSql('cd.referencia_data')}
      ${whereBaseAlias}
  `;

  const ipcSql = `
    SELECT 
       COUNT(DISTINCT idrepasse) as total_repasses,
       (
          SELECT COUNT(DISTINCT documento) FROM public.vw_hierarquia_cvcrm h
          WHERE ${hierarchyActiveAtDateSql('$2::date')}
            ${hierarchyWhere}
       ) as total_corretores,
       (
          SELECT COUNT(DISTINCT ${hierarchyImobiliariaKeySql('h')}) FROM public.vw_hierarquia_cvcrm h
          WHERE ${hierarchyActiveAtDateSql('$2::date')}
            AND ${hierarchyImobiliariaKeySql('h')} IS NOT NULL
            ${hierarchyWhere}
       ) as total_imobiliarias
    FROM comercial_base
    WHERE ${getDayRangeSql(repasseDateCol)}
      AND fl_repasse_assinado = true
      ${where}
  `;

  const [summaryResult, propostasResult, cancelResult, distratoResult, ipcResult] = await Promise.all([
    pool.query(summarySql, queryParams),
    pool.query(propostasSql, hasActiveDimensionFilters ? queryParamsBaseAlias : [start, end]),
    pool.query(cancelSql, queryParamsBaseAlias),
    pool.query(distratoSql, queryParamsBaseAlias),
    pool.query(ipcSql, queryParamsWithHierarchy),
  ]);

  const row = summaryResult.rows[0] || {};
  const propostasRow = propostasResult.rows[0] || {};
  const cancelRow = cancelResult.rows[0] || {};
  const distratoRow = distratoResult.rows[0] || {};
  const ipcRow = ipcResult.rows[0] || {};

  const totalRepasses = Number(ipcRow.total_repasses) || 0;
  const totalCorretores = Number(ipcRow.total_corretores) || 0;
  const totalImobiliarias = Number(ipcRow.total_imobiliarias) || 0;
  const totalIpcCorretor = totalCorretores > 0 ? Number((totalRepasses / totalCorretores).toFixed(2)) : 0;
  const totalIpcImobiliaria = totalImobiliarias > 0 ? Number((totalRepasses / totalImobiliarias).toFixed(2)) : 0;

  return {
    total_leads: Number(row.total_leads) || 0,
    total_visitas: Number(row.total_visitas) || 0,
    total_propostas: Number(propostasRow.total_propostas_geral) || 0,
    total_propostas_aprovadas: Number(propostasRow.total_propostas_aprovadas) || 0,
    total_propostas_condicionadas: Number(propostasRow.total_propostas_condicionadas) || 0,
    total_propostas_reprovadas: Number(propostasRow.total_propostas_reprovadas) || 0,
    total_propostas_geral: Number(propostasRow.total_propostas_geral) || 0,
    total_vendas: Number(row.total_vendas) || 0,
    total_cancelamentos: Number(cancelRow.total_cancelamentos) || 0,
    total_distratos: Number(distratoRow.total_distratos) || 0,
    total_repasses: Number(row.total_repasses) || 0,
    total_sla_finalizacao: Number((Number(row.avg_sla_finalizacao) || 0).toFixed(2)),
    total_sla_repasse: Number((Number(row.avg_sla_repasse) || 0).toFixed(2)),
    total_ipc: totalIpcCorretor,
    total_ipc_corretor: totalIpcCorretor,
    total_ipc_imobiliaria: totalIpcImobiliaria,
    total_corretores_ativos: totalCorretores,
    total_imobiliarias_ativas: totalImobiliarias,
    ipc_corretores_ativos: totalCorretores,
    ipc_imobiliarias_ativas: totalImobiliarias,
  };
}

const SUMMARY_FIELD_CONFIG = {
  total_leads: { tolerance: 0, type: 'int' },
  total_visitas: { tolerance: 0, type: 'int' },
  total_propostas: { tolerance: 0, type: 'int' },
  total_propostas_aprovadas: { tolerance: 0, type: 'int' },
  total_propostas_condicionadas: { tolerance: 0, type: 'int' },
  total_propostas_reprovadas: { tolerance: 0, type: 'int' },
  total_propostas_geral: { tolerance: 0, type: 'int' },
  total_vendas: { tolerance: 0, type: 'int' },
  total_cancelamentos: { tolerance: 0, type: 'int' },
  total_distratos: { tolerance: 0, type: 'int' },
  total_repasses: { tolerance: 0, type: 'int' },
  total_sla_finalizacao: { tolerance: 0.1, type: 'float' },
  total_sla_repasse: { tolerance: 0.1, type: 'float' },
  total_ipc: { tolerance: 0.01, type: 'float' },
  total_ipc_corretor: { tolerance: 0.01, type: 'float' },
  total_ipc_imobiliaria: { tolerance: 0.01, type: 'float' },
  total_corretores_ativos: { tolerance: 0, type: 'int' },
  total_imobiliarias_ativas: { tolerance: 0, type: 'int' },
  ipc_corretores_ativos: { tolerance: 0, type: 'int' },
  ipc_imobiliarias_ativas: { tolerance: 0, type: 'int' },
};

function compareSummary(apiData, sqlData) {
  const discrepancies = [];
  let ok = true;

  Object.entries(SUMMARY_FIELD_CONFIG).forEach(([field, config]) => {
    const apiValue = Number(apiData?.[field] ?? 0);
    const sqlValue = Number(sqlData?.[field] ?? 0);
    const diff = apiValue - sqlValue;
    const absDiff = Math.abs(diff);
    const tolerance = config.tolerance ?? 0;
    if (Number.isNaN(apiValue) || Number.isNaN(sqlValue) || absDiff > tolerance) {
      ok = false;
      discrepancies.push({ field, api: apiValue, sql: sqlValue, diff });
    }
  });

  return { ok, discrepancies };
}

async function validateSummary({ start, end, filters }) {
  const [apiData, sqlData] = await Promise.all([
    fetchSummaryFromApi({ start, end, filters }),
    computeSummarySql({ start, end, filters }),
  ]);

  const comparison = compareSummary(apiData, sqlData);
  return {
    ok: comparison.ok,
    discrepancies: comparison.discrepancies,
    api: apiData,
    sql: sqlData,
  };
}

function sumTrendField(trends, field) {
  return trends.reduce((acc, item) => acc + Number(item?.[field] ?? 0), 0);
}

function weightedAverage(trends, valueField, baseField) {
  let numerator = 0;
  let denominator = 0;
  trends.forEach((item) => {
    const base = Number(item?.[baseField] ?? 0);
    if (!Number.isFinite(base) || base <= 0) return;
    const value = Number(item?.[valueField] ?? 0);
    numerator += value * base;
    denominator += base;
  });
  if (denominator === 0) return null;
  return Number((numerator / denominator).toFixed(2));
}

function pickLastNumber(trends, field) {
  for (let i = trends.length - 1; i >= 0; i -= 1) {
    const value = trends[i]?.[field];
    if (value == null) continue;
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

async function validateTrends({ start, end, filters, summary }) {
  const trends = await fetchTrendsFromApi({ start, end, filters });
  const issues = [];

  const metricChecks = [
    { name: 'total_leads', trendField: 'leads', tolerance: 0 },
    { name: 'total_visitas', trendField: 'visitas', tolerance: 0 },
    { name: 'total_propostas_geral', trendField: 'propostas_total', tolerance: 0 },
    { name: 'total_propostas_aprovadas', trendField: 'propostas_aprovadas', tolerance: 0 },
    { name: 'total_propostas_condicionadas', trendField: 'propostas_condicionadas', tolerance: 0 },
    { name: 'total_propostas_reprovadas', trendField: 'propostas_reprovadas', tolerance: 0 },
    { name: 'total_vendas', trendField: 'vendas', tolerance: 0 },
    { name: 'total_repasses', trendField: 'repasses', tolerance: 0 },
    { name: 'total_cancelamentos', trendField: 'cancelamentos', tolerance: 0 },
    { name: 'total_distratos', trendField: 'distratos', tolerance: 0 },
  ];

  metricChecks.forEach(({ name, trendField, tolerance }) => {
    const trendValue = sumTrendField(trends, trendField);
    const summaryValue = Number(summary?.[name] ?? 0);
    if (Math.abs(trendValue - summaryValue) > tolerance) {
      issues.push({ metric: name, expected: summaryValue, actual: trendValue, tolerance });
    }
  });

  const slaFinalizacaoTrend = weightedAverage(trends, 'sla_finalizacao', 'sla_finalizacao_base');
  const summarySlaFinalizacao = Number(summary?.total_sla_finalizacao ?? 0);
  if (slaFinalizacaoTrend !== null || summarySlaFinalizacao !== 0) {
    const diff = Math.abs((slaFinalizacaoTrend ?? 0) - summarySlaFinalizacao);
    if (diff > 0.2) {
      issues.push({ metric: 'total_sla_finalizacao', expected: summarySlaFinalizacao, actual: slaFinalizacaoTrend, tolerance: 0.2 });
    }
  }

  const slaRepasseTrend = weightedAverage(trends, 'sla_repasse', 'sla_repasse_base');
  const summarySlaRepasse = Number(summary?.total_sla_repasse ?? 0);
  if (slaRepasseTrend !== null || summarySlaRepasse !== 0) {
    const diff = Math.abs((slaRepasseTrend ?? 0) - summarySlaRepasse);
    if (diff > 0.2) {
      issues.push({ metric: 'total_sla_repasse', expected: summarySlaRepasse, actual: slaRepasseTrend, tolerance: 0.2 });
    }
  }

  const lastIpcCorretor = pickLastNumber(trends, 'ipc_corretor');
  const summaryIpcCorretor = Number(summary?.total_ipc_corretor ?? 0);
  if (lastIpcCorretor !== null || summaryIpcCorretor !== 0) {
    const diff = Math.abs((lastIpcCorretor ?? 0) - summaryIpcCorretor);
    if (diff > 0.05) {
      issues.push({ metric: 'total_ipc_corretor', expected: summaryIpcCorretor, actual: lastIpcCorretor, tolerance: 0.05 });
    }
  }

  const lastIpcImobiliaria = pickLastNumber(trends, 'ipc_imobiliaria');
  const summaryIpcImobiliaria = Number(summary?.total_ipc_imobiliaria ?? 0);
  if (lastIpcImobiliaria !== null || summaryIpcImobiliaria !== 0) {
    const diff = Math.abs((lastIpcImobiliaria ?? 0) - summaryIpcImobiliaria);
    if (diff > 0.05) {
      issues.push({ metric: 'total_ipc_imobiliaria', expected: summaryIpcImobiliaria, actual: lastIpcImobiliaria, tolerance: 0.05 });
    }
  }

  const lastIpcCorretoresAtivos = pickLastNumber(trends, 'ipc_corretores_ativos');
  const summaryCorretoresAtivos = Number(summary?.total_corretores_ativos ?? 0);
  if (lastIpcCorretoresAtivos !== null || summaryCorretoresAtivos !== 0) {
    if (Math.abs((lastIpcCorretoresAtivos ?? 0) - summaryCorretoresAtivos) > 0) {
      issues.push({ metric: 'total_corretores_ativos', expected: summaryCorretoresAtivos, actual: lastIpcCorretoresAtivos, tolerance: 0 });
    }
  }

  const lastIpcImobiliariasAtivas = pickLastNumber(trends, 'ipc_imobiliarias_ativas');
  const summaryImobiliariasAtivas = Number(summary?.total_imobiliarias_ativas ?? 0);
  if (lastIpcImobiliariasAtivas !== null || summaryImobiliariasAtivas !== 0) {
    if (Math.abs((lastIpcImobiliariasAtivas ?? 0) - summaryImobiliariasAtivas) > 0) {
      issues.push({ metric: 'total_imobiliarias_ativas', expected: summaryImobiliariasAtivas, actual: lastIpcImobiliariasAtivas, tolerance: 0 });
    }
  }

  return { ok: issues.length === 0, issues, api: trends };
}

async function validateBreakdowns({ start, end, filters, summary, dimensions }) {
  const leadsTotal = Number(summary?.total_leads ?? 0);
  const dimsToCheck = new Set(DEFAULT_BREAKDOWN_DIMENSIONS);
  Object.keys(filters || {}).forEach((key) => {
    const dim = FILTER_DIMENSION_MAP[key];
    if (dim) dimsToCheck.add(dim);
  });
  (dimensions || []).forEach((dim) => dimsToCheck.add(dim));

  const issues = [];
  const breakdownCache = {};

  for (const dimension of dimsToCheck) {
    try {
      const breakdown = await fetchBreakdownFromApi({ start, end, filters, dimension });
      breakdownCache[dimension] = breakdown;
      const rows = Array.isArray(breakdown?.byAxis?.[dimension]) ? breakdown.byAxis[dimension] : [];
      const sum = rows.reduce((acc, row) => acc + Number(row?.case_count ?? row?.value ?? 0), 0);
      if (Math.abs(sum - leadsTotal) > 0) {
        issues.push({ dimension, type: 'total_mismatch', expected: leadsTotal, actual: sum });
      }

      const filterValues = Object.entries(filters || {})
        .filter(([key]) => FILTER_DIMENSION_MAP[key] === dimension)
        .flatMap(([, value]) => value || []);

      if (filterValues.length > 0) {
        filterValues.forEach((filterValue) => {
          const candidates = getBreakdownLabelCandidates(dimension, filterValue).map((v) => String(v ?? '').trim().toLowerCase());
          const match = rows.find((row) => {
            const label = String(row?.label ?? '').trim().toLowerCase();
            return candidates.includes(label);
          });

          if (!match) {
            if (leadsTotal > 0) {
              issues.push({ dimension, type: 'missing_row', value: filterValue, expected: leadsTotal });
            }
            return;
          }

          const rowTotal = Number(match?.case_count ?? match?.value ?? 0);
          if (Math.abs(rowTotal - leadsTotal) > 0) {
            issues.push({ dimension, type: 'row_mismatch', value: filterValue, expected: leadsTotal, actual: rowTotal });
          }
        });
      }
    } catch (error) {
      issues.push({ dimension, type: 'api_error', message: error?.message || String(error) });
    }
  }

  return { ok: issues.length === 0, issues, api: breakdownCache };
}

function requiresDimJoin(key) {
  return key === 'empreendimento' || key === 'empreendimentoReduzido';
}

function getCombinationSelectExpr(key, { baseAlias = 'b', dimAlias = 'd', hierarchyAlias = null, useEmpreendimentoDim = false } = {}) {
  const basePrefix = baseAlias ? `${baseAlias}.` : '';
  switch (key) {
    case 'cidade':
      return `NULLIF(TRIM(${basePrefix}lead_cidade), '')`;
    case 'corretor':
      return `NULLIF(TRIM(${basePrefix}corretor_nome), '')`;
    case 'coordenacao':
      if (hierarchyAlias) {
        return `NULLIF(TRIM(${hierarchyAlias}.coordenador_nome), '')`;
      }
      return baseColumns?.has('coordenador_nome') ? `NULLIF(TRIM(${basePrefix}coordenador_nome), '')` : 'NULL';
    case 'gerencia':
      if (hierarchyAlias) {
        return `NULLIF(TRIM(${hierarchyAlias}.gestor_nome), '')`;
      }
      return baseColumns?.has('gestor_nome') ? `NULLIF(TRIM(${basePrefix}gestor_nome), '')` : 'NULL';
    case 'sdr':
      return baseColumns?.has('sdr_nome') ? `NULLIF(TRIM(${basePrefix}sdr_nome), '')` : 'NULL';
    case 'origem':
      return baseColumns?.has('lead_origem_nome') ? `NULLIF(TRIM(${basePrefix}lead_origem_nome), '')` : 'NULL';
    case 'empreendimento':
      if (useEmpreendimentoDim) {
        return `NULLIF(TRIM(${dimAlias}.empreendimento), '')`;
      }
      return baseColumns?.has('empreendimento_nome') ? `NULLIF(TRIM(${basePrefix}empreendimento_nome), '')` : 'NULL';
    case 'empreendimentoReduzido':
      if (useEmpreendimentoDim) {
        return `NULLIF(TRIM(${dimAlias}.regiao), '')`;
      }
      return `NULLIF(TRIM(${getEmpreendimentoReduzidoExpr(baseAlias)}), '')`;
    case 'imobiliaria':
      return `NULLIF(TRIM(${getImobiliariaExpr(baseAlias, baseColumns)}), '')`;
    default:
      return 'NULL';
  }
}

function normalizeCombinationValue(raw) {
  if (raw == null) return BLANK_FILTER_VALUE;
  const value = String(raw).trim();
  if (value.length === 0) return BLANK_FILTER_VALUE;
  if (value.toUpperCase() === 'NULL') return BLANK_FILTER_VALUE;
  return value;
}

function buildInventoryValueSets(inventory) {
  const sets = new Map();
  FILTER_KEYS.forEach((key) => {
    const list = Array.isArray(inventory?.filters?.[key]) ? inventory.filters[key] : [];
    const normalized = new Set(
      list
        .map((item) => String(item ?? '').trim())
        .filter((value) => value.length > 0),
    );
    normalized.add(BLANK_FILTER_VALUE);
    sets.set(key, normalized);
  });
  return sets;
}

async function fetchPairCombinations(keyA, keyB, inventorySets) {
  const pairKey = [keyA, keyB].sort().join('+');
  if (COMBINATION_CACHE.has(pairKey)) {
    return COMBINATION_CACHE.get(pairKey);
  }

  await ensureBaseColumns();
  const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
  const needsDim = requiresDimJoin(keyA) || requiresDimJoin(keyB);
  const needsHierarchy = [keyA, keyB].some((key) => key === 'coordenacao' || key === 'gerencia');

  const dimJoin = needsDim && useEmpreendimentoDim
    ? `LEFT JOIN public.dim_empreendimento d ON d.idempreendimento = ${getEmpreendimentoJoinKeyExpr('b')}`
    : '';

  const hierarchyJoin = needsHierarchy
    ? `LEFT JOIN public.vw_hierarquia_cvcrm h
        ON LOWER(REGEXP_REPLACE(h.nome, '\\s*-\\s*(CLT|PJ)$', '', 'ig')) = LOWER(REGEXP_REPLACE(b.corretor_nome, '\\s*-\\s*(CLT|PJ)$', '', 'ig'))
       AND ${HIERARCHY_ACTIVE_SQL}`
    : '';

  const exprA = getCombinationSelectExpr(keyA, { baseAlias: 'b', dimAlias: 'd', hierarchyAlias: needsHierarchy ? 'h' : null, useEmpreendimentoDim });
  const exprB = getCombinationSelectExpr(keyB, { baseAlias: 'b', dimAlias: 'd', hierarchyAlias: needsHierarchy ? 'h' : null, useEmpreendimentoDim });

  const sql = `
    SELECT DISTINCT
      ${exprA} AS value_a,
      ${exprB} AS value_b
    FROM comercial_base b
    ${dimJoin}
    ${hierarchyJoin}
  `;

  const allowedA = inventorySets.get(keyA) || new Set();
  const allowedB = inventorySets.get(keyB) || new Set();

  const { rows } = await pool.query(sql);
  const combos = [];

  rows.forEach((row) => {
    const valueA = normalizeCombinationValue(row.value_a);
    const valueB = normalizeCombinationValue(row.value_b);

    if (valueA !== BLANK_FILTER_VALUE && !allowedA.has(valueA)) return;
    if (valueB !== BLANK_FILTER_VALUE && !allowedB.has(valueB)) return;

    combos.push({ [keyA]: valueA, [keyB]: valueB });
  });

  COMBINATION_CACHE.set(pairKey, combos);
  return combos;
}

function buildSingleFilterTasks(inventory, inventorySets) {
  const tasks = [];
  const seen = new Set();

  FILTER_KEYS.forEach((filterKey) => {
    if (TARGET_FILTER_KEYS && !TARGET_FILTER_KEYS.has(filterKey)) {
      return;
    }

    const values = new Set(inventorySets.get(filterKey) || []);
    if (!values.has(BLANK_FILTER_VALUE)) {
      values.add(BLANK_FILTER_VALUE);
    }

    values.forEach((value) => {
      if (value === '' || value === 'todos' || value === 'todas') return;
      if (TARGET_FILTER_VALUES && !TARGET_FILTER_VALUES.has(String(value))) return;

      PERIOD_KEYS.forEach((periodKey) => {
        if (TARGET_PERIOD_KEYS && !TARGET_PERIOD_KEYS.has(periodKey)) return;
        const id = `single:${filterKey}:${value}:${periodKey}`;
        if (seen.has(id)) return;
        seen.add(id);
        tasks.push({
          id,
          phase: 'single',
          filters: { [filterKey]: [value] },
          periodKey,
          meta: { filterKey, values: [value] },
        });
      });
    });
  });

  return tasks;
}

async function buildCombinationTasks(inventory, inventorySets) {
  const tasks = [];
  const seen = new Set();
  const keys = FILTER_KEYS.filter((key) => !TARGET_FILTER_KEYS || TARGET_FILTER_KEYS.has(key));

  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const keyA = keys[i];
      const keyB = keys[j];
      if (!PRIMARY_FILTER_KEYS.includes(keyA) && !PRIMARY_FILTER_KEYS.includes(keyB)) {
        continue;
      }
      const pairId = [keyA, keyB].sort().join('+');
      const combos = await fetchPairCombinations(keyA, keyB, inventorySets);

      combos.forEach((combo) => {
        const valueA = combo[keyA];
        const valueB = combo[keyB];
        if (TARGET_FILTER_VALUES) {
          if (valueA !== BLANK_FILTER_VALUE && !TARGET_FILTER_VALUES.has(String(valueA))) return;
          if (valueB !== BLANK_FILTER_VALUE && !TARGET_FILTER_VALUES.has(String(valueB))) return;
        }

        COMBINATION_PERIOD_KEYS.forEach((periodKey) => {
          if (TARGET_PERIOD_KEYS && !TARGET_PERIOD_KEYS.has(periodKey)) return;
          const id = `combo:${pairId}:${valueA}|${valueB}:${periodKey}`;
          if (seen.has(id)) return;
          seen.add(id);
          tasks.push({
            id,
            phase: 'combo',
            filters: { [keyA]: [valueA], [keyB]: [valueB] },
            periodKey,
            meta: { pair: pairId, values: { [keyA]: valueA, [keyB]: valueB } },
          });
        });
      });
    }
  }

  return tasks;
}

async function buildValidationTasks(inventory) {
  const inventorySets = buildInventoryValueSets(inventory);
  const singleTasks = buildSingleFilterTasks(inventory, inventorySets);
  const combinationTasks = await buildCombinationTasks(inventory, inventorySets);
  const tasks = [...singleTasks, ...combinationTasks];
  tasks.sort((a, b) => a.id.localeCompare(b.id));
  return tasks;
}

async function main() {
  const inventory = await loadLatestInventory();
  if (!inventory) {
    throw new Error('Nenhum inventario de filtros encontrado. Execute scripts/filters-inventory.mjs primeiro.');
  }

  await ensureBaseColumns();
  await hasEmpreendimentoDimReady();

  const { process: backendProcess, alreadyRunning } = await ensureBackendServer();

  const summaryCounters = { total: 0, passed: 0, failed: 0 };
  const trendsCounters = { total: 0, passed: 0, failed: 0 };
  const breakdownCounters = { total: 0, passed: 0, failed: 0 };
  const filterCoverage = new Map();
  FILTER_KEYS.forEach((key) => filterCoverage.set(key, new Set()));
  const combinationCounters = new Map();
  const failures = [];
  const taskResults = [];

  try {
    console.log(JSON.stringify({ status: 'ready', apiBaseUrl: API_BASE_URL, counts: inventory.counts }));
    const tasks = await buildValidationTasks(inventory);
    console.log({ actualTaskCount: tasks.length, firstTasks: tasks.slice(0, 5) });
    const CONCURRENCY = 5;
    const totalTasks = tasks.length;
    let completedTasks = 0;

    console.log(JSON.stringify({ 
      status: 'starting_validation', 
      totalTasks, 
      concurrency: CONCURRENCY 
    }));

    const runTask = async (task) => {
      const preset = PERIOD_PRESETS[task.periodKey];
      if (!preset) return;
      const { start, end } = preset;
      const filters = task.filters;

      Object.entries(filters || {}).forEach(([key, values]) => {
        const set = filterCoverage.get(key);
        if (!set) return;
        (values || []).forEach((value) => set.add(value));
      });

      const taskRecord = {
        id: task.id,
        phase: task.phase,
        periodKey: task.periodKey,
        filters,
        range: { start, end },
        summary: null,
        trends: null,
        breakdown: null,
        summary: null
      };

      let summaryResult;
      summaryCounters.total += 1;
      try {
        summaryResult = await validateSummary({ start, end, filters });
        taskRecord.summary = summaryResult;
        if (summaryResult.ok) {
          summaryCounters.passed += 1;
        } else {
          summaryCounters.failed += 1;
          failures.push({ taskId: task.id, phase: 'summary', filters, periodKey: task.periodKey, range: { start, end }, discrepancies: summaryResult.discrepancies });
        }
      } catch (error) {
        const message = error?.message || String(error);
        summaryCounters.failed += 1;
        taskRecord.summary = { ok: false, error: message };
        failures.push({ taskId: task.id, phase: 'summary', filters, periodKey: task.periodKey, range: { start, end }, error: message });
        taskResults.push(taskRecord);
        if (task.phase === 'combo' && task.meta?.pair) {
          const counter = combinationCounters.get(task.meta.pair) || { total: 0, failures: 0 };
          counter.total += 1;
          counter.failures += 1;
          combinationCounters.set(task.meta.pair, counter);
        }
        return;
      }

      let trendsResult;
      trendsCounters.total += 1;
      try {
        trendsResult = await validateTrends({ start, end, filters, summary: summaryResult.api });
        taskRecord.trends = trendsResult;
        if (trendsResult.ok) {
          trendsCounters.passed += 1;
        } else {
          trendsCounters.failed += 1;
          failures.push({ taskId: task.id, phase: 'trends', filters, periodKey: task.periodKey, range: { start, end }, issues: trendsResult.issues });
        }
      } catch (error) {
        const message = error?.message || String(error);
        trendsCounters.failed += 1;
        taskRecord.trends = { ok: false, error: message };
        failures.push({ taskId: task.id, phase: 'trends', filters, periodKey: task.periodKey, range: { start, end }, error: message });
      }

      let breakdownResult;
      breakdownCounters.total += 1;
      try {
        breakdownResult = await validateBreakdowns({ start, end, filters, summary: summaryResult.api });
        taskRecord.breakdown = breakdownResult;
        if (breakdownResult.ok) {
          breakdownCounters.passed += 1;
        } else {
          breakdownCounters.failed += 1;
          failures.push({ taskId: task.id, phase: 'breakdown', filters, periodKey: task.periodKey, range: { start, end }, issues: breakdownResult.issues });
        }
      } catch (error) {
        const message = error?.message || String(error);
        breakdownCounters.failed += 1;
        taskRecord.breakdown = { ok: false, error: message };
        failures.push({ taskId: task.id, phase: 'breakdown', filters, periodKey: task.periodKey, range: { start, end }, error: message });
      }

      if (!taskRecord.trends) {
        taskRecord.trends = { ok: false, error: 'trends_not_executed' };
      }
      if (!taskRecord.breakdown) {
        taskRecord.breakdown = { ok: false, error: 'breakdown_not_executed' };
      }

      if (task.phase === 'combo' && task.meta?.pair) {
        const counter = combinationCounters.get(task.meta.pair) || { total: 0, failures: 0 };
        counter.total += 1;
        if (!(taskRecord.summary.ok && taskRecord.trends.ok && taskRecord.breakdown.ok)) {
          counter.failures += 1;
        }
        combinationCounters.set(task.meta.pair, counter);
      }

      taskResults.push(taskRecord);
    } // end of runTask

    // Worker pool for concurrency
    const pool_workers = [];
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      const promise = runTask(task).then(() => {
        pool_workers.splice(pool_workers.indexOf(promise), 1);
        if (i % 50 === 0 || i === tasks.length - 1) {
          console.log(`Progress: ${i + 1}/${tasks.length} tasks processed...`);
        }
      });
      
      pool_workers.push(promise);
      
      if (pool_workers.length >= CONCURRENCY) {
        await Promise.race(pool_workers);
      }
    }
    
    await Promise.all(pool_workers);

    const coverage = Object.fromEntries(Array.from(filterCoverage.entries()).map(([key, set]) => [key, set.size]));
    const combinations = Object.fromEntries(Array.from(combinationCounters.entries()).map(([pair, data]) => [pair, data]));

    const report = {
      generatedAt: new Date().toISOString(),
      apiBaseUrl: API_BASE_URL,
      totals: {
        tasks: taskResults.length,
        summary: summaryCounters,
        trends: trendsCounters,
        breakdown: breakdownCounters,
      },
      coverage,
      combinations,
      failures,
    };

    await ensureReportsDir();
    const reportFile = path.resolve(REPORTS_DIR, `filters-validation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({
      status: 'finished',
      totals: report.totals,
      coverage,
      combinations,
      report: reportFile,
    }));
  } finally {
    if (!alreadyRunning && backendProcess) {
      backendProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error?.message || String(error) }));
  process.exitCode = 1;
});
