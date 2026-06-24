import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDataUpdate } from './scripts/run-data-update.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
let dataRefreshInProgress = false;

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

const SEGMENTED_FILTER_COLUMNS = {
  regiaoOperacao: 'regiao_operacao',
  imobiliariaOperacao: 'imobiliaria_operacao_nome',
  corretorOperacao: 'corretor_operacao_nome',
  empreendimento: 'empreendimento_operacao_nome',
  unidade: 'unidade_operacao_nome',
  origem: 'origem_operacao_nome',
  sdrOperacao: 'sdr_operacao_nome',
  corretorAtivo: 'corretor_ativo_nome',
  gestorCorretor: 'gestor_corretor',
  coordenadorCorretor: 'coordenador_corretor',
  regiaoCorretor: 'regiao_corretor',
  imobiliariaCorretor: 'imobiliaria_corretor',
  sdrAtivo: 'sdr_ativo_nome',
  gestorSdr: 'gestor_sdr',
  coordenadorSdr: 'coordenador_sdr',
  regiaoSdr: 'regiao_sdr',
  imobiliariaSdr: 'imobiliaria_sdr',
};

const SEGMENTED_SDR_FILTER_FIELDS = new Set(['sdrOperacao', 'sdrAtivo', 'gestorSdr', 'coordenadorSdr', 'regiaoSdr', 'imobiliariaSdr']);
const SEGMENTED_SDR_AXIS_FIELDS = new Set(['sdrOperacao', 'sdrAtivo', 'gestorSdr', 'coordenadorSdr', 'regiaoSdr', 'imobiliariaSdr']);
const SEGMENTED_SDR_INDICATORS = new Set(['LEADS', 'VISITA', 'AGENDAMENTOS']);

const SEGMENTED_KPI_INDICATORS = {
  leads: ['LEADS'],
  visitas: ['VISITA'],
  agendamentos: ['AGENDAMENTOS'],
  propostas: ['PASTAS APROVADAS', 'PASTAS CONDICIONADAS', 'PASTAS REPROVADAS', 'PASTAS COM RESPOSTAS'],
  pastas_aprovadas: ['PASTAS APROVADAS'],
  pastas_condicionadas: ['PASTAS CONDICIONADAS'],
  pastas_reprovadas: ['PASTAS REPROVADAS'],
  pastas_com_respostas: ['PASTAS COM RESPOSTAS'],
  pendente_comercial: ['PENDENTE COMERCIAL'],
  pendente_credito: ['PENDENTE CREDITO'],
  vendas_geradas: ['VENDA GERADAS'],
  vendas: ['VENDA FINALIZADA'],
  repasses: ['REPASSE'],
  ipc: ['REPASSE'],
  ipc_corretor: ['REPASSE'],
  ipc_imobiliaria: ['REPASSE'],
  distratos: ['DISTRATOS'],
  cancelamentos: ['CANCELAMENTOS'],
};

const getSdrImobiliariaLookupSql = () => `
  SELECT
    imobiliaria_id,
    mes_referencia,
    MAX(imobiliaria_nome) AS imobiliaria_nome
  FROM (
    SELECT
      NULLIF(TRIM(dsi.idimobiliaria_sdr), '') AS imobiliaria_id,
      dsi.mes_referencia::date AS mes_referencia,
      NULLIF(TRIM(dsi.nome_imobiliaria), '') AS imobiliaria_nome
    FROM public.dim_sdr_imobiliaria dsi
    UNION ALL
    SELECT
      latest.imobiliaria_id,
      NULL::date AS mes_referencia,
      latest.imobiliaria_nome
    FROM (
      SELECT DISTINCT ON (NULLIF(TRIM(dsi.idimobiliaria_sdr), ''))
        NULLIF(TRIM(dsi.idimobiliaria_sdr), '') AS imobiliaria_id,
        NULLIF(TRIM(dsi.nome_imobiliaria), '') AS imobiliaria_nome,
        dsi.mes_referencia
      FROM public.dim_sdr_imobiliaria dsi
      WHERE NULLIF(TRIM(dsi.idimobiliaria_sdr), '') IS NOT NULL
        AND NULLIF(TRIM(dsi.nome_imobiliaria), '') IS NOT NULL
      ORDER BY NULLIF(TRIM(dsi.idimobiliaria_sdr), ''), dsi.mes_referencia DESC
    ) latest
    UNION ALL
    SELECT
      NULLIF(TRIM(d.idimobiliaria::text), '') AS imobiliaria_id,
      NULL::date AS mes_referencia,
      NULLIF(TRIM(d.nome_imobiliaria), '') AS imobiliaria_nome
    FROM public.dim_imobiliaria d
  ) base_imobiliaria
  WHERE imobiliaria_id IS NOT NULL
    AND imobiliaria_nome IS NOT NULL
  GROUP BY imobiliaria_id, mes_referencia
`;

const getSegmentedSdrImobiliariaNameExpr = (alias = 's', lookupAlias = null) => {
  const prefix = alias ? `${alias}.` : '';
  const rawExpr = `NULLIF(TRIM((${prefix}imobiliaria_sdr)::text), '')`;
  if (lookupAlias) {
    return `COALESCE(${lookupAlias}.imobiliaria_nome, ${rawExpr})`;
  }
  return `COALESCE(
    (
      SELECT COALESCE(NULLIF(TRIM(b.imobiliaria_nome_dim), ''), NULLIF(TRIM(b.imobiliaria_nome), ''))
      FROM public.comercial_base b
      WHERE (
        b.idimobiliaria_canonico::text = ${rawExpr}
        OR b.idimobiliaria::text = ${rawExpr}
      )
        AND COALESCE(NULLIF(TRIM(b.imobiliaria_nome_dim), ''), NULLIF(TRIM(b.imobiliaria_nome), '')) IS NOT NULL
      ORDER BY b.dt_ultima_conversao_lead DESC NULLS LAST
      LIMIT 1
    ),
    ${rawExpr}
  )`;
};

const getSegmentedOperationDimExpr = (field, alias = 's') => {
  const prefix = alias ? `${alias}.` : '';
  const sourceColumn = field === 'regiaoOperacao' ? 'regiao_operacao' : 'empreendimento_operacao_nome';
  const dimColumn = field === 'regiaoOperacao' ? 'regiao' : 'empreendimento';
  const rawExpr = `NULLIF(TRIM((${prefix}${sourceColumn})::text), '')`;
  const dimExpr = `(
      SELECT NULLIF(TRIM((d.${dimColumn})::text), '')
      FROM public.dim_empreendimento d
      WHERE d.idempreendimento = ${prefix}idempreendimento_operacao
      LIMIT 1
    )`;
  return field === 'empreendimento'
    ? `COALESCE(${dimExpr}, ${rawExpr})`
    : `COALESCE(${rawExpr}, ${dimExpr})`;
};

const getSegmentedFieldExpr = (field, alias = 's', lookupAlias = null) => {
  if (field === 'imobiliariaSdr') return getSegmentedSdrImobiliariaNameExpr(alias, lookupAlias);
  if (field === 'regiaoOperacao' || field === 'empreendimento') return getSegmentedOperationDimExpr(field, alias);
  const column = SEGMENTED_FILTER_COLUMNS[field];
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}${column}`;
};

const HIERARCHY_ACTIVE_SQL = `
  LOWER(COALESCE(h.ativo_negocio, '')) = 's'
  AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia <= CURRENT_DATE)
  AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= CURRENT_DATE)
`;

const hierarchyActiveAtDateSql = (dateExpr) => `
  LOWER(COALESCE(h.ativo_negocio, '')) = 's'
  AND (h.data_inicio_vigencia IS NULL OR h.data_inicio_vigencia::date <= ${dateExpr}::date)
  AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia::date >= ${dateExpr}::date)
`;

const HIERARCHY_IMOBILIARIA_KEY_SQL = `COALESCE(NULLIF(TRIM(h.imobiliaria_nome_dim), ''), NULLIF(TRIM(h.imobiliaria_nome), ''))`;
const HIERARCHY_CORRETOR_KEY_SQL = `
  COALESCE(
    NULLIF(TRIM(h.documento_norm), ''),
    NULLIF(TRIM(h.documento), ''),
    NULLIF(TRIM(h.email_norm), ''),
    NULLIF(TRIM(h.corretor_ativo_mes_key), ''),
    NULLIF(TRIM(h.corretor_ativo_nome), ''),
    NULLIF(TRIM(h.nome), '')
  )
`;
const EMPREENDIMENTO_JOIN_KEY_EXPR = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}idempreendimento_canonico, ${prefix}idempreendimento)`;
};

const getCorretorNomeExpr = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(NULLIF(TRIM(${prefix}corretor_nome_canonico), ''), NULLIF(TRIM(${prefix}corretor_nome), ''))`;
};

const getSdrNomeExpr = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(NULLIF(TRIM(${prefix}sdr_nome), ''), NULLIF(TRIM(${prefix}gestor_nome), ''))`;
};

const getSdrGestorExpr = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(NULLIF(TRIM(${prefix}gestor_nome), ''), NULLIF(TRIM(${prefix}sdr_nome), ''))`;
};

const getSdrAtivoMatchExpr = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  return `NULLIF(TRIM(${prefix}sdr_nome), '')`;
};

const sanitizeCorretorValue = (value) => {
  if (!value || value === BLANK_FILTER_VALUE) return value;
  return String(value).replace(/\s*-\s*(CLT|PJ)$/i, '').trim();
};

let baseColumns = null;
let empreendimentoDimReadyCache = null;
let empreendimentoDimReadyCacheTs = 0;
const EMPREENDIMENTO_DIM_CACHE_TTL_MS = 60 * 1000;

const DEFAULT_GOALS = [
  { kpi_id: 'leads', goal_value: 7000, unit: 'total', target_type: 'absolute', quality_style: false },
  { kpi_id: 'visitas', goal_value: 1300, unit: 'total', target_type: 'absolute', quality_style: false },
  { kpi_id: 'propostas', goal_value: 90, unit: 'total', target_type: 'absolute', quality_style: false },
  { kpi_id: 'vendas', goal_value: 80, unit: 'total', target_type: 'absolute', quality_style: false },
  { kpi_id: 'repasses', goal_value: 70, unit: 'total', target_type: 'absolute', quality_style: false },
  { kpi_id: 'cancelamentos', goal_value: 30, unit: 'total', target_type: 'absolute', quality_style: true },
  { kpi_id: 'distratos', goal_value: 5, unit: 'total', target_type: 'absolute', quality_style: true },
  { kpi_id: 'sla_f', goal_value: 8, unit: 'dias', target_type: 'days_max', quality_style: true },
  { kpi_id: 'sla_r', goal_value: 10, unit: 'dias', target_type: 'days_max', quality_style: true },
  { kpi_id: 'ipc', goal_value: 1.4, unit: 'total', target_type: 'absolute', quality_style: false },
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const FUNNEL_WORKFLOW_TABLE_CANDIDATES = [
  'public.leads_workflow',
  'public.comercial_leads_workflow',
  'connect_comercial.leads_workflow',
  'connect_comercial.comercial_leads_workflow',
];

const FUNNEL_STAGES = [
  { key: 'lead', label: 'LEAD', order: 1, source: 'base', aggregate: 'distinct', keyColumn: 'idlead', dateCandidates: ['data_conversao', 'lead_data_ultima_conversao', 'dt_ultima_conversao_lead', 'dt_lead'], rule: 'Lead com data de conversao no periodo.' },
  { key: 'atendimento', label: 'ATENDIMENTO', order: 2, source: 'workflow', aggregate: 'countrows', statuses: ['Atendimento - IA', 'Atendimento - SDR'], rule: 'Eventos de workflow em Atendimento - IA ou Atendimento - SDR.' },
  { key: 'agendamento', label: 'AGENDAMENTO', order: 3, source: 'workflow', aggregate: 'countrows', statuses: ['Agendado - IA', 'Agendamento', 'Agendamento - IA'], rule: 'Eventos de workflow em situacoes de agendamento.' },
  { key: 'visita', label: 'VISITA', order: 4, source: 'base', aggregate: 'distinct', keyColumn: 'idlead', dateCandidates: ['data_visita_realizada', 'dt_visita_realizada', 'dt_visita'], rule: 'Visitas efetivamente realizadas no periodo.' },
  { key: 'proposta', label: 'PROPOSTA', order: 5, source: 'workflow', aggregate: 'countrows', statuses: ['Proposta'], rule: 'Eventos de workflow na situacao Proposta.' },
  { key: 'prop_aprovada_condicionada', label: 'PROP. APROVADA / CONDICIONADA', order: 6, source: 'propostas', aggregate: 'distinct', keyColumn: 'idprecadastro', statuses: ['APROVADA', 'CONDICIONADA', 'CONDICIONADO', 'CONDICIONADO PENDENTE'], rule: 'Analises aprovadas ou condicionadas com resposta no periodo.' },
  { key: 'vendas', label: 'VENDAS', order: 7, source: 'base', aggregate: 'distinct', keyColumn: 'idreserva', dateCandidates: ['data_reserva', 'referencia_data_reserva', 'dt_cadastro_reserva', 'data_venda'], rule: 'Reservas iniciadas no periodo, independente do status posterior.' },
  { key: 'vendas_finalizadas', label: 'VENDAS FINALIZADAS', order: 8, source: 'base', aggregate: 'distinct', keyColumn: 'idreserva', dateCandidates: ['data_reserva', 'referencia_data_reserva', 'dt_cadastro_reserva', 'data_venda'], statusColumnCandidates: ['reserva_situacao', 'reserva_situacao_nome', 'situacao_reserva'], statusValue: 'Venda finalizada', rule: 'Reservas finalizadas, usando a data da reserva.' },
  { key: 'repasse', label: 'REPASSE', order: 9, source: 'base', aggregate: 'distinct', keyColumn: 'idrepasse', dateCandidates: ['data_assinatura_de_contrato', 'dt_assinatura_contrato', 'dt_repasse'], extraWhere: 'fl_repasse_assinado = true', rule: 'Contratos de repasse assinados no periodo.' },
];

const FUNNEL_STAGE_BY_KEY = new Map(FUNNEL_STAGES.flatMap((stage) => [
  [stage.key, stage],
  [stage.label, stage],
]));

let tableColumnsCache = new Map();
let workflowSourceCache = null;
let workflowSourceCacheTs = 0;
const FUNNEL_SCHEMA_CACHE_TTL_MS = 60 * 1000;

const isValidDateStr = (value) => {
  if (!DATE_REGEX.test(String(value ?? ''))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
};

const getDateRange = (query) => {
  const fallbackStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const fallbackEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  const start = query.startDate || fallbackStart;
  const end = query.endDate || fallbackEnd;

  if (!isValidDateStr(start) || !isValidDateStr(end)) {
    return { error: 'Formato de data invalido. Use YYYY-MM-DD.' };
  }

  if (start > end) {
    return { error: 'startDate nao pode ser maior que endDate.' };
  }

  return { start, end };
};

const getDayRangeSql = (columnExpr, startParam = '$1', endParam = '$2') => `
  ${columnExpr} >= ${startParam}::date
  AND ${columnExpr} < (${endParam}::date + INTERVAL '1 day')
`;

const parsePositiveInt = (value, fallback, max = 1000) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

const getPreviousPeriod = (start, end) => {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const rangeDays = Math.floor((endDate - startDate) / 86400000) + 1;
  const prevEnd = new Date(startDate);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (rangeDays - 1));
  const toStr = (d) => d.toISOString().split('T')[0];
  return { start: toStr(prevStart), end: toStr(prevEnd) };
};

const countBusinessDays = (startDate, endDate) => {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate) || startDate > endDate) return 0;
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  let count = 0;
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

const DASHBOARD_CACHE = new Map();
const CACHE_TTL_BY_ROUTE_MS = {
  '/api/v1/dashboard/overview': 2 * 60 * 1000,
  '/api/v1/dashboard/summary': 2 * 60 * 1000,
  '/api/v1/dashboard/trends': 3 * 60 * 1000,
  '/api/v1/dashboard/breakdown': 3 * 60 * 1000,
  '/api/v1/dashboard/segmented/breakdown': 3 * 60 * 1000,
  '/api/v1/dashboard/bottlenecks': 3 * 60 * 1000,
  '/api/v1/dashboard/sla-repasse-insights': 3 * 60 * 1000,
  '/api/v1/dashboard/sla-finalizacao-insights': 3 * 60 * 1000,
  '/api/v1/dashboard/filters': 60 * 1000,
  '/api/v1/dashboard/segmented/filters': 60 * 1000,
};

const getCacheTtlMs = (pathName) => CACHE_TTL_BY_ROUTE_MS[pathName] ?? 0;
const clearDashboardCache = () => {
  DASHBOARD_CACHE.clear();
};

const getObservedReferenceDate = (endDate) => {
  const today = new Date().toISOString().slice(0, 10);
  const normalizedEnd = String(endDate ?? '').slice(0, 10);
  if (!normalizedEnd) return today;
  return normalizedEnd > today ? today : normalizedEnd;
};

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  const ttlMs = getCacheTtlMs(req.path);
  if (!ttlMs) {
    return next();
  }

  const cacheKey = req.originalUrl;
  const now = Date.now();
  const cached = DASHBOARD_CACHE.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    res.set('X-Dashboard-Cache', 'HIT');
    return res.json(cached.payload);
  }

  if (cached) {
    DASHBOARD_CACHE.delete(cacheKey);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      DASHBOARD_CACHE.set(cacheKey, {
        payload: body,
        expiresAt: Date.now() + ttlMs,
      });
      res.set('X-Dashboard-Cache', 'MISS');
    }
    return originalJson(body);
  };

  return next();
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('âŒ Erro ao conectar no Postgres:', err);
  else console.log('✅ Postgres Conectado Data Mart:', res.rows[0].now);
});

const loadBaseColumns = async () => {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'comercial_base'
    `);
    baseColumns = new Set(result.rows.map((row) => row.column_name));
    console.log('✅ Colunas carregadas comercial_base:', baseColumns.size);
  } catch {
    console.warn('âš ï¸ Nao foi possivel carregar colunas de comercial_base. Seguindo sem validacao de colunas.');
    baseColumns = null;
  }
};

const hasEmpreendimentoDimReady = async () => {
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
};

const ensureGoalsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboard_goals (
      kpi_id TEXT PRIMARY KEY,
      goal_value NUMERIC NOT NULL,
      unit TEXT NOT NULL DEFAULT 'total',
      target_type TEXT NOT NULL DEFAULT 'absolute',
      quality_style BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const insertSql = `
    INSERT INTO dashboard_goals (kpi_id, goal_value, unit, target_type, quality_style)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (kpi_id) DO UPDATE SET
      goal_value = EXCLUDED.goal_value,
      unit = EXCLUDED.unit,
      target_type = EXCLUDED.target_type,
      quality_style = EXCLUDED.quality_style,
      updated_at = NOW()
  `;

  await Promise.all(
    DEFAULT_GOALS.map((goal) => pool.query(insertSql, [
      goal.kpi_id,
      goal.goal_value,
      goal.unit,
      goal.target_type,
      goal.quality_style,
    ]))
  );
};

const ensureDimImobiliariaTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.dim_imobiliaria (
      dim_imobiliaria_key TEXT,
      idimobiliaria BIGINT PRIMARY KEY,
      nome_imobiliaria TEXT,
      dt_referencia_imobiliaria TIMESTAMP,
      gold_process_ts TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dim_imobiliaria_nome
      ON public.dim_imobiliaria (nome_imobiliaria);
    CREATE TABLE IF NOT EXISTS public.dim_sdr_imobiliaria (
      idimobiliaria_sdr TEXT,
      nome_imobiliaria TEXT,
      mes_referencia DATE,
      PRIMARY KEY (idimobiliaria_sdr, mes_referencia)
    );
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.dim_sdr_imobiliaria'::regclass
          AND conname = 'dim_sdr_imobiliaria_pkey'
          AND cardinality(conkey) = 1
      ) THEN
        ALTER TABLE public.dim_sdr_imobiliaria DROP CONSTRAINT dim_sdr_imobiliaria_pkey;
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.dim_sdr_imobiliaria'::regclass
          AND conname = 'dim_sdr_imobiliaria_pkey'
      ) THEN
        ALTER TABLE public.dim_sdr_imobiliaria
          ADD CONSTRAINT dim_sdr_imobiliaria_pkey PRIMARY KEY (idimobiliaria_sdr, mes_referencia);
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_dim_sdr_imobiliaria_nome
      ON public.dim_sdr_imobiliaria (nome_imobiliaria);
  `);
};

loadBaseColumns();
ensureGoalsTable().then(() => {
  console.log('✅ Tabela dashboard_goals pronta');
}).catch((err) => {
  console.error('❌ Falha ao preparar dashboard_goals', err?.message);
});
ensureDimImobiliariaTable().then(() => {
  console.log('✅ Tabela dim_imobiliaria pronta');
}).catch((err) => {
  console.error('❌ Falha ao preparar dim_imobiliaria', err?.message);
});

const getEmpreendimentoReduzidoExpr = (alias = '') => {
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
};

const EMPREENDIMENTO_DIM_FILTER_COLUMNS = {
  empreendimento: 'empreendimento',
  empreendimentoReduzido: 'regiao',
};

const getEmpreendimentoDimExpr = (column, baseAlias = '') => `(
  SELECT d.${column}
  FROM public.dim_empreendimento d
  WHERE d.idempreendimento = ${EMPREENDIMENTO_JOIN_KEY_EXPR(baseAlias)}
  LIMIT 1
)`;

const getImobiliariaExpr = (alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (baseColumns?.has('imobiliaria_nome_dim') && baseColumns?.has('imobiliaria_nome')) {
    return `COALESCE(${prefix}imobiliaria_nome_dim, ${prefix}imobiliaria_nome, ${prefix}idimobiliaria::text)`;
  }
  if (baseColumns?.has('imobiliaria_nome_dim')) {
    return `COALESCE(${prefix}imobiliaria_nome_dim, ${prefix}idimobiliaria::text)`;
  }
  if (baseColumns?.has('imobiliaria_nome')) {
    return `COALESCE(${prefix}imobiliaria_nome, ${prefix}idimobiliaria::text)`;
  }
  return `(${prefix}idimobiliaria::text)`;
};

const pickBaseColumn = (preferred, fallback) => {
  if (baseColumns?.has(preferred)) {
    return preferred;
  }
  return fallback;
};

const KPI_DATE_COLUMNS = {
  lead: () => pickBaseColumn('dt_lead', 'dt_ultima_conversao_lead'),
  visita: () => pickBaseColumn('dt_visita', 'dt_visita_realizada'),
  venda: () => 'data_venda',
  repasse: () => pickBaseColumn('dt_repasse', 'dt_assinatura_contrato'),
};

const normalizeFiltersFromQuery = (query) => {
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

  // Generic normalization for all filterable fields to support multi-select (arrays)
  Object.keys(norm).forEach(key => {
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
        norm[key] = []; // Normalize 'todos' or empty to empty array for building query
      }
    } else if (!val) {
      norm[key] = [];
    }
  });

  if (Array.isArray(norm.corretor)) {
    norm.corretor = norm.corretor.map((value) => sanitizeCorretorValue(value));
  }

  return norm;
};

const normalizeSegmentedFiltersFromQuery = (query) => {
  const norm = {};

  Object.keys(SEGMENTED_FILTER_COLUMNS).forEach((key) => {
    const rawValue = query[key];
    if (Array.isArray(rawValue)) {
      norm[key] = rawValue
        .flatMap((item) => String(item ?? '').split(','))
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== 'todos' && item !== 'todas');
      return;
    }

    if (typeof rawValue === 'string' && rawValue.trim()) {
      norm[key] = rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== 'todos' && item !== 'todas');
      return;
    }

    norm[key] = [];
  });

  return norm;
};

const normalizeSegmentedIndicators = (query) => {
  const explicit = query.indicador ?? query.indicadores;
  const rawValues = explicit
    ? (Array.isArray(explicit) ? explicit : String(explicit).split(','))
    : SEGMENTED_KPI_INDICATORS[String(query.kpi || 'leads').trim().toLowerCase()];

  const indicators = (rawValues || SEGMENTED_KPI_INDICATORS.leads)
    .map((item) => String(item ?? '').trim().toUpperCase())
    .filter(Boolean)
    .filter((item) => item !== 'TODOS' && item !== 'TODAS');

  return indicators.length > 0 ? indicators : SEGMENTED_KPI_INDICATORS.leads;
};

const isSdrSegmentApplicable = (indicators) => indicators.some((indicator) => SEGMENTED_SDR_INDICATORS.has(indicator));

const buildSegmentedFilterWhere = (queryFilters, {
  startIndex = 1,
  alias = 's',
  excludeField = null,
  includeSdrFilters = false,
} = {}) => {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;

  const buildBlankExpr = (expr) => `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
  const buildSdrImobiliariaClause = (values) => {
    const rawExpr = `NULLIF(TRIM(COALESCE((${alias}.imobiliaria_sdr)::text, '')), '')`;
    const normalizedValues = (Array.isArray(values) ? values : [values])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
    const includeBlank = normalizedValues.includes(BLANK_FILTER_VALUE);
    const regularValues = normalizedValues.filter((item) => item !== BLANK_FILTER_VALUE);
    const clauses = [];

    if (regularValues.length > 0) {
      params.push(regularValues);
      clauses.push(`(
        ${rawExpr} = ANY($${parameterIndex})
        OR EXISTS (
          SELECT 1
          FROM (${getSdrImobiliariaLookupSql()}) lookup
          WHERE lookup.imobiliaria_id = ${rawExpr}
            AND (lookup.mes_referencia = ${alias}.mes_referencia OR lookup.mes_referencia IS NULL)
            AND lookup.imobiliaria_nome = ANY($${parameterIndex})
        )
      )`);
      parameterIndex += 1;
    }

    if (includeBlank) {
      clauses.push(`${rawExpr} IS NULL`);
    }

    return clauses.length > 1 ? `(${clauses.join(' OR ')})` : (clauses[0] || '');
  };
  const buildMixedFilterClause = (expr, values) => {
    const normalizedValues = (Array.isArray(values) ? values : [values])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
    const includeBlank = normalizedValues.includes(BLANK_FILTER_VALUE);
    const regularValues = normalizedValues.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR ${buildBlankExpr(expr)})`;
      parameterIndex += 1;
      return clause;
    }

    if (includeBlank) {
      return buildBlankExpr(expr);
    }

    if (regularValues.length > 1) {
      params.push(regularValues);
      const clause = `${expr} = ANY($${parameterIndex})`;
      parameterIndex += 1;
      return clause;
    }

    if (regularValues.length === 1) {
      params.push(regularValues[0]);
      const clause = `${expr} = $${parameterIndex}`;
      parameterIndex += 1;
      return clause;
    }

    return '';
  };

  Object.keys(SEGMENTED_FILTER_COLUMNS).forEach((field) => {
    if (field === excludeField) return;
    if (SEGMENTED_SDR_FILTER_FIELDS.has(field) && !includeSdrFilters) return;

    const value = queryFilters[field];
    if (!value || (Array.isArray(value) && value.length === 0)) return;

    const clause = field === 'imobiliariaSdr'
      ? buildSdrImobiliariaClause(value)
      : buildMixedFilterClause(getSegmentedFieldExpr(field, alias), value);
    if (clause) {
      where += ` AND ${clause}`;
    }
  });

  return { where, params };
};

const buildSegmentedHierarchyWhere = (queryFilters, {
  startIndex = 1,
} = {}) => {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;

  const buildBlankExpr = (expr) => `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
  const buildMixedFilterClause = (expr, values) => {
    const normalizedValues = (Array.isArray(values) ? values : [values])
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
    const includeBlank = normalizedValues.includes(BLANK_FILTER_VALUE);
    const regularValues = normalizedValues.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR ${buildBlankExpr(expr)})`;
      parameterIndex += 1;
      return clause;
    }

    if (includeBlank) return buildBlankExpr(expr);

    if (regularValues.length > 1) {
      params.push(regularValues);
      const clause = `${expr} = ANY($${parameterIndex})`;
      parameterIndex += 1;
      return clause;
    }

    if (regularValues.length === 1) {
      params.push(regularValues[0]);
      const clause = `${expr} = $${parameterIndex}`;
      parameterIndex += 1;
      return clause;
    }

    return '';
  };

  const hierarchyFilterExpressions = {
    corretorAtivo: 'COALESCE(h.corretor_ativo_nome, h.nome)',
    gestorCorretor: 'COALESCE(h.gestor_corretor, h.gestor_nome)',
    coordenadorCorretor: 'COALESCE(h.coordenador_corretor, h.coordenador_nome)',
    regiaoCorretor: 'h.regiao_corretor',
    imobiliariaCorretor: 'COALESCE(h.imobiliaria_corretor, h.imobiliaria_nome_dim, h.imobiliaria_nome)',
  };

  Object.entries(hierarchyFilterExpressions).forEach(([field, expr]) => {
    const value = queryFilters[field];
    if (!value || (Array.isArray(value) && value.length === 0)) return;

    const clause = buildMixedFilterClause(expr, value);
    if (clause) where += ` AND ${clause}`;
  });

  return { where, params };
};

const getSegmentedIpcHierarchyPeriodBase = async (start, end, filters) => {
  const effectiveEnd = getObservedReferenceDate(end);
  const { where, params } = buildSegmentedHierarchyWhere(filters, { startIndex: 3 });
  const result = await pool.query(`
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', $1::date)::date,
        DATE_TRUNC('month', $2::date)::date,
        '1 month'::interval
      )::date AS mes_referencia
    ),
    monthly_counts AS (
      SELECT
        m.mes_referencia,
        COUNT(DISTINCT ${HIERARCHY_CORRETOR_KEY_SQL}) FILTER (
          WHERE ${HIERARCHY_CORRETOR_KEY_SQL} IS NOT NULL
        )::int AS total_corretores,
        COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (
          WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL
        )::int AS total_imobiliarias
      FROM months m
      LEFT JOIN public.vw_hierarquia_cvcrm h
        ON h.mes_referencia = m.mes_referencia
       AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
       ${where}
      GROUP BY m.mes_referencia
    )
    SELECT
      COALESCE(SUM(total_corretores), 0)::int AS total_corretores,
      COALESCE(SUM(total_imobiliarias), 0)::int AS total_imobiliarias
    FROM monthly_counts
  `, [start, effectiveEnd, ...params]);

  const row = result.rows[0] || {};
  return {
    totalCorretores: Number(row.total_corretores) || 0,
    totalImobiliarias: Number(row.total_imobiliarias) || 0,
  };
};

const getSegmentedIpcHierarchyCountsByDate = async (start, end, filters) => {
  const { where, params } = buildSegmentedHierarchyWhere(filters, { startIndex: 3 });
  const result = await pool.query(`
    WITH days AS (
      SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS data
    ),
    h_filtered AS (
      SELECT *
      FROM public.vw_hierarquia_cvcrm h
      WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
        ${where}
    )
    SELECT
      d.data,
      COUNT(DISTINCT ${HIERARCHY_CORRETOR_KEY_SQL}) FILTER (
        WHERE ${HIERARCHY_CORRETOR_KEY_SQL} IS NOT NULL
      )::int AS total_corretores,
      COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (
        WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL
      )::int AS total_imobiliarias
    FROM days d
    LEFT JOIN h_filtered h
      ON h.mes_referencia = DATE_TRUNC('month', d.data)::date
    GROUP BY d.data
    ORDER BY d.data
  `, [start, end, ...params]);

  return new Map((result.rows ?? []).map((row) => {
    const dateKey = row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data).slice(0, 10);
    return [dateKey, {
      totalCorretores: Number(row.total_corretores) || 0,
      totalImobiliarias: Number(row.total_imobiliarias) || 0,
    }];
  }));
};

const sumSegmentedRepasses = async (start, end, filters) => {
  const { where, params } = buildSegmentedFilterWhere(filters, {
    startIndex: 3,
    alias: 's',
    includeSdrFilters: false,
  });
  const result = await pool.query(`
    SELECT SUM(COALESCE(s.valor_realizado, 1))::numeric AS total_repasses
    FROM public.comercial_indicador_segmentacao s
    WHERE s.data_evento BETWEEN $1::date AND $2::date
      AND s.indicador = 'REPASSE'
      ${where}
  `, [start, end, ...params]);

  return Number(result.rows?.[0]?.total_repasses) || 0;
};

const buildSegmentedIpcInsightsPayload = async ({ start, end, prevStart, prevEnd, filters }) => {
  const [
    currentRepasses,
    previousRepasses,
    currentHierarchy,
    previousHierarchy,
  ] = await Promise.all([
    sumSegmentedRepasses(start, end, filters),
    sumSegmentedRepasses(prevStart, prevEnd, filters),
    getSegmentedIpcHierarchyPeriodBase(start, end, filters),
    getSegmentedIpcHierarchyPeriodBase(prevStart, prevEnd, filters),
  ]);

  const rankingsQuery = ({ hierarchyLabel, factColumn, hierarchyWhere, factWhere }) => `
    WITH hierarchy_base AS (
      SELECT
        label,
        COUNT(DISTINCT mes_referencia)::int AS base
      FROM (
        SELECT
          h.mes_referencia::date AS mes_referencia,
          COALESCE(NULLIF(TRIM((${hierarchyLabel})::text), ''), 'Sem informação') AS label
        FROM public.vw_hierarquia_cvcrm h
        WHERE h.mes_referencia BETWEEN DATE_TRUNC('month', $1::date)::date AND DATE_TRUNC('month', $2::date)::date
          AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
          ${hierarchyWhere}
      ) hb
      GROUP BY label
    ),
    fact_data AS (
      SELECT
        COALESCE(NULLIF(TRIM((s.${factColumn})::text), ''), 'Sem informação') AS label,
        SUM(COALESCE(s.valor_realizado, 1))::numeric AS value
      FROM public.comercial_indicador_segmentacao s
      WHERE s.data_evento BETWEEN $1::date AND $2::date
        AND s.indicador = 'REPASSE'
        ${factWhere}
      GROUP BY 1
    )
    SELECT *
    FROM (
      SELECT
        hb.label,
        COALESCE(fd.value, 0)::numeric AS value,
        hb.base,
        CASE WHEN hb.base > 0 THEN COALESCE(fd.value, 0)::numeric / hb.base ELSE 0 END AS ipc
      FROM hierarchy_base hb
      LEFT JOIN fact_data fd ON fd.label = hb.label
      UNION ALL
      SELECT
        fd.label,
        fd.value::numeric AS value,
        0::int AS base,
        0::numeric AS ipc
      FROM fact_data fd
      WHERE NOT EXISTS (
        SELECT 1
        FROM hierarchy_base hb
        WHERE hb.label = fd.label
      )
    ) ranked
    ORDER BY value DESC, label ASC
    LIMIT 500
  `;

  const hCorretores = buildSegmentedHierarchyWhere(filters, { startIndex: 3 });
  const fCorretores = buildSegmentedFilterWhere(filters, {
    startIndex: 3 + hCorretores.params.length,
    alias: 's',
    includeSdrFilters: false,
  });
  const hImobiliarias = buildSegmentedHierarchyWhere(filters, { startIndex: 3 });
  const fImobiliarias = buildSegmentedFilterWhere(filters, {
    startIndex: 3 + hImobiliarias.params.length,
    alias: 's',
    includeSdrFilters: false,
  });

  const effectiveEnd = getObservedReferenceDate(end);
  const [corretoresResult, imobiliariasResult] = await Promise.all([
    pool.query(
      rankingsQuery({
        hierarchyLabel: 'COALESCE(h.corretor_ativo_nome, h.nome)',
        factColumn: 'corretor_ativo_nome',
        hierarchyWhere: hCorretores.where,
        factWhere: fCorretores.where,
      }),
      [start, effectiveEnd, ...hCorretores.params, ...fCorretores.params],
    ),
    pool.query(
      rankingsQuery({
        hierarchyLabel: 'COALESCE(h.imobiliaria_corretor, h.imobiliaria_nome_dim, h.imobiliaria_nome)',
        factColumn: 'imobiliaria_corretor',
        hierarchyWhere: hImobiliarias.where,
        factWhere: fImobiliarias.where,
      }),
      [start, effectiveEnd, ...hImobiliarias.params, ...fImobiliarias.params],
    ),
  ]);

  const ipcCorretor = currentHierarchy.totalCorretores > 0 ? currentRepasses / currentHierarchy.totalCorretores : 0;
  const prevIpcCorretor = previousHierarchy.totalCorretores > 0 ? previousRepasses / previousHierarchy.totalCorretores : 0;
  const ipcImobiliaria = currentHierarchy.totalImobiliarias > 0 ? currentRepasses / currentHierarchy.totalImobiliarias : 0;
  const prevIpcImobiliaria = previousHierarchy.totalImobiliarias > 0 ? previousRepasses / previousHierarchy.totalImobiliarias : 0;

  return {
    summary: {
      repasses: currentRepasses,
      corretores: currentHierarchy.totalCorretores,
      imobiliarias: currentHierarchy.totalImobiliarias,
      ipcCorretor: Number(ipcCorretor.toFixed(3)),
      prevIpcCorretor: Number(prevIpcCorretor.toFixed(3)),
      ipcImobiliaria: Number(ipcImobiliaria.toFixed(3)),
      prevIpcImobiliaria: Number(prevIpcImobiliaria.toFixed(3)),
    },
    rankings: {
      corretores: corretoresResult.rows.map((row) => ({
        label: row.label,
        value: Number(row.value) || 0,
        base: Number(row.base) || 0,
        ipc: Number(Number(row.ipc || 0).toFixed(3)),
        share: currentRepasses > 0 ? ((Number(row.value) || 0) / currentRepasses) * 100 : 0,
      })),
      imobiliarias: imobiliariasResult.rows.map((row) => ({
        label: row.label,
        value: Number(row.value) || 0,
        base: Number(row.base) || 0,
        ipc: Number(Number(row.ipc || 0).toFixed(3)),
        share: currentRepasses > 0 ? ((Number(row.value) || 0) / currentRepasses) * 100 : 0,
      })),
    },
    meta: {
      source: 'comercial_indicador_segmentacao',
      hierarchyReferenceMonth: `${String(end).slice(0, 7)}-01`,
    },
  };
};

const buildSegmentedSlaTopBreakdowns = async ({ start, end, filters, indicator }) => {
  const axes = [
    { key: 'operacao', column: 'corretor_operacao_nome' },
    { key: 'ativo', column: 'corretor_ativo_nome' },
    { key: 'gestorCorretor', column: 'gestor_corretor' },
    { key: 'coordenadorCorretor', column: 'coordenador_corretor' },
    { key: 'regiaoCorretor', column: 'regiao_corretor' },
    { key: 'imobiliariaCorretor', column: 'imobiliaria_corretor' },
  ];

  const { where, params } = buildSegmentedFilterWhere(filters, {
    startIndex: 4,
    alias: 's',
    includeSdrFilters: false,
  });

  const entries = await Promise.all(axes.map(async (axis) => {
    const result = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM((s.${axis.column})::text), ''), 'Sem informacao') AS label,
        COUNT(*)::int AS total,
        AVG(NULLIF(s.valor_realizado, 0))::numeric AS sla_medio
      FROM public.comercial_indicador_segmentacao s
      WHERE s.data_evento BETWEEN $1::date AND $2::date
        AND s.indicador = $3::text
        ${where}
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
      LIMIT 12
    `, [start, end, indicator, ...params]);

    return [axis.key, result.rows.map((row) => ({
      corretor: row.label,
      assinaturas: Number(row.total) || 0,
      slaMedio: row.sla_medio == null ? null : Number(Number(row.sla_medio).toFixed(1)),
    }))];
  }));

  return Object.fromEntries(entries);
};

const hasActiveSegmentedFiltersFromQuery = (query) => {
  const filters = normalizeSegmentedFiltersFromQuery(query);
  return Object.values(filters).some((value) => Array.isArray(value) && value.length > 0);
};

const SEGMENTED_SUMMARY_INDICATORS = [
  'LEADS',
  'VISITA',
  'AGENDAMENTOS',
  'PASTAS APROVADAS',
  'PASTAS CONDICIONADAS',
  'PASTAS REPROVADAS',
  'PASTAS COM RESPOSTAS',
  'VENDA GERADAS',
  'VENDA FINALIZADA',
  'REPASSE',
  'CANCELAMENTOS',
  'DISTRATOS',
  'SLA FINALIZACAO',
  'SLA REPASSE',
];

const sumSegmentedRows = (rows, indicator) => {
  const row = rows.find((item) => item.indicador === indicator);
  return Number(row?.total_valor) || 0;
};

const avgSegmentedRows = (rows, indicator) => {
  const row = rows.find((item) => item.indicador === indicator);
  return row?.avg_valor == null ? 0 : Number(Number(row.avg_valor).toFixed(2));
};

const buildSegmentedSummaryPayload = async (start, end, filters) => {
  const loadTotals = async (indicators, includeSdrFilters) => {
    if (!indicators.length) return [];
    const { where, params } = buildSegmentedFilterWhere(filters, {
      startIndex: 4,
      alias: 's',
      includeSdrFilters,
    });

    const result = await pool.query(`
      SELECT
        s.indicador,
        SUM(COALESCE(s.valor_realizado, 1))::numeric AS total_valor,
        AVG(NULLIF(s.valor_realizado, 0))::numeric AS avg_valor,
        COUNT(*)::int AS linhas
      FROM public.comercial_indicador_segmentacao s
      WHERE s.data_evento BETWEEN $1::date AND $2::date
        AND s.indicador = ANY($3::text[])
        ${where}
      GROUP BY s.indicador
    `, [start, end, indicators, ...params]);

    return result.rows;
  };

  const sdrIndicators = SEGMENTED_SUMMARY_INDICATORS.filter((indicator) => SEGMENTED_SDR_INDICATORS.has(indicator));
  const nonSdrIndicators = SEGMENTED_SUMMARY_INDICATORS.filter((indicator) => !SEGMENTED_SDR_INDICATORS.has(indicator));
  const [sdrRows, nonSdrRows] = await Promise.all([
    loadTotals(sdrIndicators, true),
    loadTotals(nonSdrIndicators, false),
  ]);
  const rows = [...sdrRows, ...nonSdrRows];

  const totalRepasses = sumSegmentedRows(rows, 'REPASSE');
  const { totalCorretores, totalImobiliarias } = await getSegmentedIpcHierarchyPeriodBase(start, end, filters);

  return {
    total_leads: sumSegmentedRows(rows, 'LEADS'),
    total_visitas: sumSegmentedRows(rows, 'VISITA'),
    total_agendamentos: sumSegmentedRows(rows, 'AGENDAMENTOS'),
    total_propostas: sumSegmentedRows(rows, 'PASTAS APROVADAS') + sumSegmentedRows(rows, 'PASTAS CONDICIONADAS') + sumSegmentedRows(rows, 'PASTAS REPROVADAS'),
    total_propostas_aprovadas: sumSegmentedRows(rows, 'PASTAS APROVADAS'),
    total_propostas_condicionadas: sumSegmentedRows(rows, 'PASTAS CONDICIONADAS'),
    total_propostas_reprovadas: sumSegmentedRows(rows, 'PASTAS REPROVADAS'),
    total_propostas_com_respostas: sumSegmentedRows(rows, 'PASTAS COM RESPOSTAS'),
    total_propostas_geral: sumSegmentedRows(rows, 'PASTAS APROVADAS') + sumSegmentedRows(rows, 'PASTAS CONDICIONADAS') + sumSegmentedRows(rows, 'PASTAS REPROVADAS'),
    total_vendas_geradas: sumSegmentedRows(rows, 'VENDA GERADAS'),
    total_vendas: sumSegmentedRows(rows, 'VENDA FINALIZADA'),
    total_cancelamentos: sumSegmentedRows(rows, 'CANCELAMENTOS'),
    total_distratos: sumSegmentedRows(rows, 'DISTRATOS'),
    total_repasses: totalRepasses,
    total_sla_finalizacao: avgSegmentedRows(rows, 'SLA FINALIZACAO'),
    total_sla_repasse: avgSegmentedRows(rows, 'SLA REPASSE'),
    total_ipc: totalCorretores > 0 ? Number((totalRepasses / totalCorretores).toFixed(2)) : 0,
    total_ipc_corretor: totalCorretores > 0 ? Number((totalRepasses / totalCorretores).toFixed(2)) : 0,
    total_ipc_imobiliaria: totalImobiliarias > 0 ? Number((totalRepasses / totalImobiliarias).toFixed(2)) : 0,
    total_corretores_ativos: totalCorretores,
    total_imobiliarias_ativas: totalImobiliarias,
    ipc_corretores_ativos: totalCorretores,
    ipc_imobiliarias_ativas: totalImobiliarias,
    meta: { source: 'comercial_indicador_segmentacao' },
  };
};

const buildSegmentedDailySeries = async (start, end, filters) => {
  const loadSeries = async (indicators, includeSdrFilters) => {
    if (!indicators.length) return [];
    const { where, params } = buildSegmentedFilterWhere(filters, {
      startIndex: 4,
      alias: 's',
      includeSdrFilters,
    });

    const result = await pool.query(`
      SELECT
        s.data_evento::date AS data,
        s.indicador,
        SUM(COALESCE(s.valor_realizado, 1))::numeric AS total_valor,
        AVG(NULLIF(s.valor_realizado, 0))::numeric AS avg_valor,
        COUNT(*)::int AS linhas
      FROM public.comercial_indicador_segmentacao s
      WHERE s.data_evento BETWEEN $1::date AND $2::date
        AND s.indicador = ANY($3::text[])
        ${where}
      GROUP BY s.data_evento::date, s.indicador
      ORDER BY s.data_evento::date ASC
    `, [start, end, indicators, ...params]);

    return result.rows;
  };

  const sdrIndicators = SEGMENTED_SUMMARY_INDICATORS.filter((indicator) => SEGMENTED_SDR_INDICATORS.has(indicator));
  const nonSdrIndicators = SEGMENTED_SUMMARY_INDICATORS.filter((indicator) => !SEGMENTED_SDR_INDICATORS.has(indicator));
  const [sdrRows, nonSdrRows] = await Promise.all([
    loadSeries(sdrIndicators, true),
    loadSeries(nonSdrIndicators, false),
  ]);

  const byDate = new Map();
  [...sdrRows, ...nonSdrRows].forEach((row) => {
    const dateKey = row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data).slice(0, 10);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        data: dateKey,
        leads: 0,
        visitas: 0,
        agendamentos: 0,
        propostas: 0,
        propostas_aprovadas: 0,
        propostas_condicionadas: 0,
        propostas_reprovadas: 0,
        propostas_total: 0,
        vendas: 0,
        vendas_geradas: 0,
        repasses: 0,
        cancelamentos: 0,
        distratos: 0,
        sla_finalizacao: null,
        sla_finalizacao_sum: 0,
        sla_finalizacao_base: 0,
        sla_repasse: null,
        sla_repasse_sum: 0,
        sla_repasse_base: 0,
      });
    }

    const target = byDate.get(dateKey);
    const total = Number(row.total_valor) || 0;
    const avg = row.avg_valor == null ? null : Number(row.avg_valor);
    switch (row.indicador) {
      case 'LEADS': target.leads += total; break;
      case 'VISITA': target.visitas += total; break;
      case 'AGENDAMENTOS': target.agendamentos += total; break;
      case 'PASTAS APROVADAS': target.propostas_aprovadas += total; break;
      case 'PASTAS CONDICIONADAS': target.propostas_condicionadas += total; break;
      case 'PASTAS REPROVADAS': target.propostas_reprovadas += total; break;
      case 'VENDA GERADAS': target.vendas_geradas += total; break;
      case 'VENDA FINALIZADA': target.vendas += total; break;
      case 'REPASSE': target.repasses += total; break;
      case 'CANCELAMENTOS': target.cancelamentos += total; break;
      case 'DISTRATOS': target.distratos += total; break;
      case 'SLA FINALIZACAO':
        target.sla_finalizacao = avg == null ? null : Number(avg.toFixed(2));
        target.sla_finalizacao_sum = total;
        target.sla_finalizacao_base = Number(row.linhas) || 0;
        break;
      case 'SLA REPASSE':
        target.sla_repasse = avg == null ? null : Number(avg.toFixed(2));
        target.sla_repasse_sum = total;
        target.sla_repasse_base = Number(row.linhas) || 0;
        break;
      default:
        break;
    }
    target.propostas = target.propostas_aprovadas + target.propostas_condicionadas + target.propostas_reprovadas;
    target.propostas_total = target.propostas;
  });

  const hierarchyByDate = await getSegmentedIpcHierarchyCountsByDate(start, end, filters);

  return Array.from(byDate.values())
    .map((item) => {
      const hierarchy = hierarchyByDate.get(item.data) ?? {};
      const corretores = Number(hierarchy.totalCorretores) || 0;
      const imobiliarias = Number(hierarchy.totalImobiliarias) || 0;
      const repasses = Number(item.repasses) || 0;

      return {
        ...item,
        ipc_repasses: repasses,
        ipc_corretor: corretores > 0 ? Number((repasses / corretores).toFixed(2)) : null,
        ipc_imobiliaria: imobiliarias > 0 ? Number((repasses / imobiliarias).toFixed(2)) : null,
        ipc_corretores_ativos: corretores,
        ipc_imobiliarias_ativas: imobiliarias,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
};

const buildSegmentedOverviewPayload = async ({ start, end, prevStart, prevEnd, hasPrevious, filters }) => {
  const [summary, previousSummary, trends, previousTrends] = await Promise.all([
    buildSegmentedSummaryPayload(start, end, filters),
    hasPrevious ? buildSegmentedSummaryPayload(prevStart, prevEnd, filters) : Promise.resolve(null),
    buildSegmentedDailySeries(start, end, filters),
    hasPrevious ? buildSegmentedDailySeries(prevStart, prevEnd, filters) : Promise.resolve([]),
  ]);

  const series = {
    daily: trends,
    monthly: [],
    cumulativeDaily: trends,
    cumulativeMonthly: [],
  };
  const previousSeries = {
    daily: previousTrends,
    monthly: [],
    cumulativeDaily: previousTrends,
    cumulativeMonthly: [],
  };

  return {
    summary,
    trends,
    previousSummary,
    previousTrends,
    series,
    previousSeries,
    seriesMeta: {
      startDate: start,
      endDate: end,
      businessDays: trends.length,
      months: 0,
      recommendedView: 'daily',
      source: 'comercial_indicador_segmentacao',
    },
  };
};

const buildFilters = (queryFilters, { startIndex = 1, alias = '', useEmpreendimentoDim = false } = {}) => {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;
  const prefix = alias ? `${alias}.` : '';
  const empreendimentoReduzidoExpr = getEmpreendimentoReduzidoExpr(alias);
  const buildBlankExpr = (expr) => `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
  const buildMixedFilterClause = (expr, value) => {
    const values = Array.isArray(value) ? value : [value];
    const includeBlank = values.includes(BLANK_FILTER_VALUE);
    const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR ${buildBlankExpr(expr)})`;
      parameterIndex += 1;
      return clause;
    }

    if (includeBlank) {
      return buildBlankExpr(expr);
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

  Object.entries(FILTER_COLUMNS).forEach(([field, column]) => {
    let value = queryFilters[field];
    if (!value || value === FILTER_DEFAULTS[field]) return;
    
    // Handle "Todos" as []
    if (Array.isArray(value) && value.length === 0) return;
    if (Array.isArray(value) && value.includes('todos')) return;

    if (useEmpreendimentoDim && EMPREENDIMENTO_DIM_FILTER_COLUMNS[field]) {
      const dimColumn = EMPREENDIMENTO_DIM_FILTER_COLUMNS[field];
      const dimClause = buildMixedFilterClause(`d.${dimColumn}`, value);
      where += `
        AND EXISTS (
          SELECT 1
          FROM public.dim_empreendimento d
          WHERE d.idempreendimento = ${EMPREENDIMENTO_JOIN_KEY_EXPR(alias)}
            AND ${dimClause}
        )`;
      return;
    }

    if (field === 'empreendimentoReduzido') {
      const clause = buildMixedFilterClause(empreendimentoReduzidoExpr, value);
      where += ` AND ${clause}`;
      return;
    }

    if (baseColumns && !baseColumns.has(column)) return;

    const clause = buildMixedFilterClause(`${prefix}${column}`, value);
    where += ` AND ${clause}`;
  });

  {
    const value = queryFilters.imobiliaria;
    if (value && value !== FILTER_DEFAULTS.imobiliaria) {
      if (!(Array.isArray(value) && (value.length === 0 || value.includes('todas')))) {
        const values = Array.isArray(value) ? value : [value];
        const includeBlank = values.includes(BLANK_FILTER_VALUE);
        const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

        if (baseColumns && baseColumns.has('corretor_nome')) {
          if (includeBlank && regularValues.length > 0) {
            params.push(regularValues);
            where += `
              AND (
                ${prefix}corretor_nome IN (
                  SELECT nome
                  FROM public.vw_hierarquia_cvcrm h
                  WHERE ${HIERARCHY_ACTIVE_SQL}
                    AND ${HIERARCHY_IMOBILIARIA_KEY_SQL} = ANY($${parameterIndex})
                )
                OR NOT EXISTS (
                  SELECT 1
                  FROM public.vw_hierarquia_cvcrm h
                  WHERE h.nome = ${prefix}corretor_nome
                    AND ${HIERARCHY_ACTIVE_SQL}
                    AND NULLIF(TRIM(COALESCE(${HIERARCHY_IMOBILIARIA_KEY_SQL}, '')), '') IS NOT NULL
                )
              )`;
            parameterIndex += 1;
          } else if (includeBlank) {
            where += `
              AND NOT EXISTS (
                SELECT 1
                FROM public.vw_hierarquia_cvcrm h
                WHERE h.nome = ${prefix}corretor_nome
                  AND ${HIERARCHY_ACTIVE_SQL}
                  AND NULLIF(TRIM(COALESCE(${HIERARCHY_IMOBILIARIA_KEY_SQL}, '')), '') IS NOT NULL
              )`;
          } else if (regularValues.length > 0) {
            params.push(regularValues.length > 1 ? regularValues : regularValues[0]);
            where += `
              AND ${prefix}corretor_nome IN (
                SELECT nome
                FROM public.vw_hierarquia_cvcrm h
                WHERE ${HIERARCHY_ACTIVE_SQL}
                  AND ${HIERARCHY_IMOBILIARIA_KEY_SQL} ${regularValues.length > 1 ? `= ANY($${parameterIndex})` : `= $${parameterIndex}`}
              )`;
            parameterIndex += 1;
          }
        } else {
          const clause = buildMixedFilterClause(getImobiliariaExpr(alias), value);
          where += ` AND ${clause}`;
        }
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
              AND ${expr} = ANY($${parameterIndex})
          )
          OR NOT EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
          )
        )`;
        parameterIndex += 1;
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

      if (normalizedValues.length > 0) {
        params.push(normalizedValues.length > 1 ? normalizedValues : normalizedValues[0]);
        where += `
        AND EXISTS (
          SELECT 1
          FROM public.vw_hierarquia_cvcrm h
          WHERE h.nome = ${prefix}corretor_nome
            AND ${HIERARCHY_ACTIVE_SQL}
            AND ${expr} ${normalizedValues.length > 1 ? `= ANY($${parameterIndex})` : `= $${parameterIndex}`}
        )`;
        parameterIndex += 1;
      }
      return;
    }

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      where += `
        AND (
          ${prefix}corretor_nome IN (
            SELECT nome
            FROM public.vw_hierarquia_cvcrm h
            WHERE ${HIERARCHY_ACTIVE_SQL}
              AND h.${hierarchyColumn} = ANY($${parameterIndex})
          )
          OR NOT EXISTS (
            SELECT 1
            FROM public.vw_hierarquia_cvcrm h
            WHERE h.nome = ${prefix}corretor_nome
              AND ${HIERARCHY_ACTIVE_SQL}
              AND NULLIF(TRIM(COALESCE(h.${hierarchyColumn}, '')), '') IS NOT NULL
          )
        )`;
      parameterIndex += 1;
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

    params.push(regularValues.length > 1 ? regularValues : regularValues[0]);
    where += `
      AND ${prefix}corretor_nome IN (
        SELECT nome
        FROM public.vw_hierarquia_cvcrm h
        WHERE ${HIERARCHY_ACTIVE_SQL}
          AND h.${hierarchyColumn} ${regularValues.length > 1 ? `= ANY($${parameterIndex})` : `= $${parameterIndex}`}
      )`;
    parameterIndex += 1;
  });

  return { where, params };
};

const getTableColumns = async (client, qualifiedName) => {
  const cacheKey = qualifiedName;
  const cached = tableColumnsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < FUNNEL_SCHEMA_CACHE_TTL_MS) {
    return cached.columns;
  }

  const [schemaName, tableName] = qualifiedName.split('.');
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
  `, [schemaName, tableName]);
  const columns = new Set(result.rows.map((row) => row.column_name));
  tableColumnsCache.set(cacheKey, { columns, ts: Date.now() });
  return columns;
};

const pickAvailableColumn = (columns, candidates) => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
};

const getWorkflowSource = async (client) => {
  if (workflowSourceCache && (Date.now() - workflowSourceCacheTs) < FUNNEL_SCHEMA_CACHE_TTL_MS) {
    return workflowSourceCache;
  }

  for (const tableName of FUNNEL_WORKFLOW_TABLE_CANDIDATES) {
    const exists = await client.query('SELECT to_regclass($1) AS table_regclass', [tableName]);
    if (!exists.rows[0]?.table_regclass) continue;

    const columns = await getTableColumns(client, tableName);
    const dateColumn = pickAvailableColumn(columns, ['data', 'referencia_data_lead', 'created_at', 'dt_workflow']);
    const statusColumn = pickAvailableColumn(columns, ['lead_situacao', 'situacao', 'situacao_proxima']);
    const leadColumn = pickAvailableColumn(columns, ['idlead', 'lead_id']);
    if (dateColumn && statusColumn && leadColumn) {
      workflowSourceCache = { tableName, columns, dateColumn, statusColumn, leadColumn };
      workflowSourceCacheTs = Date.now();
      return workflowSourceCache;
    }
  }

  workflowSourceCache = null;
  workflowSourceCacheTs = Date.now();
  return null;
};

const getFunnelStage = (value) => FUNNEL_STAGE_BY_KEY.get(String(value ?? '').trim()) ?? null;

const getFunnelSlaClassificationSql = (situacaoExpr, slaExpr) => `
  CASE
    WHEN ${situacaoExpr} IN ('Lead', 'Atendimento - SDR', 'Atendimento - IA') THEN
      CASE WHEN ${slaExpr} > 3 THEN 'SLA Expirado' ELSE 'Dentro do SLA' END
    WHEN ${situacaoExpr} IN ('Agendamento', 'Visita') THEN
      CASE WHEN ${slaExpr} > 7 THEN 'SLA Expirado' ELSE 'Dentro do SLA' END
    WHEN ${situacaoExpr} = 'Repescagem' THEN
      CASE WHEN ${slaExpr} > 90 THEN 'SLA Expirado' ELSE 'Dentro do SLA' END
    WHEN ${situacaoExpr} = 'Base' THEN
      CASE WHEN ${slaExpr} > 5 THEN 'SLA Expirado' ELSE 'Dentro do SLA' END
    WHEN ${situacaoExpr} = 'Tratativa' THEN
      CASE WHEN ${slaExpr} > 30 THEN 'SLA Expirado' ELSE 'Dentro do SLA' END
    ELSE NULL
  END
`;

const getFunnelRestrictionClassificationSql = (restricaoExpr) => `
  CASE
    WHEN ${restricaoExpr} IS NULL OR ${restricaoExpr} = 0 THEN 'Sem Restrição'
    WHEN ${restricaoExpr} BETWEEN 100 AND 300 THEN 'Restrição Baixa'
    ELSE 'Restrição Acima'
  END
`;

const getFunnelRestrictionNumericSql = (expr) => `
  CASE
    WHEN NULLIF(REPLACE(TRIM((${expr})::text), ',', '.'), '') IS NULL THEN NULL::numeric
    WHEN NULLIF(REPLACE(TRIM((${expr})::text), ',', '.'), '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
      THEN NULLIF(REPLACE(TRIM((${expr})::text), ',', '.'), '')::numeric
    ELSE -1::numeric
  END
`;

const buildFunnelBaseFilter = async (client, filters, startIndex, alias = 'b') => {
  const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
  return buildFilters(filters, { startIndex, alias, useEmpreendimentoDim });
};

const buildFunnelBaseStageQuery = async (client, stage, filters, { countOnly = true, page = 1, limit = 50, sortBy = 'data_evento', sortDir = 'desc' } = {}) => {
  const columns = await getTableColumns(client, 'public.comercial_base');
  const dateColumn = pickAvailableColumn(columns, stage.dateCandidates ?? []);
  const keyColumn = columns.has(stage.keyColumn) ? stage.keyColumn : null;
  if (!dateColumn || !keyColumn) {
    return { unavailable: true, reason: `Coluna obrigatoria ausente para ${stage.label}.` };
  }

  const { where, params } = await buildFunnelBaseFilter(client, filters, 3, 'b');
  const clauses = [`${getDayRangeSql(`b.${dateColumn}`)}`, `b.${keyColumn} IS NOT NULL`];
  if (stage.extraWhere && (!stage.extraWhere.includes('fl_repasse_assinado') || columns.has('fl_repasse_assinado'))) {
    clauses.push(`b.${stage.extraWhere}`);
  }
  const statusColumn = pickAvailableColumn(columns, stage.statusColumnCandidates ?? []);
  if (stage.statusValue && statusColumn) {
    clauses.push(`b.${statusColumn} = $${params.length + 3}`);
    params.push(stage.statusValue);
  }
  const whereSql = `WHERE ${clauses.join(' AND ')} ${where}`;

  if (countOnly) {
    return {
      sql: `SELECT COUNT(DISTINCT b.${keyColumn})::bigint AS value FROM public.comercial_base b ${whereSql}`,
      params: [filters.start, filters.end, ...params],
      source: 'comercial_base',
      dateColumn,
      keyColumn,
    };
  }

  const sortColumns = {
    data_evento: 'data_evento',
    chave: 'chave',
    cidade: 'cidade',
    empreendimento: 'empreendimento',
    corretor: 'corretor',
    sdr: 'sdr',
  };
  const safeSort = sortColumns[sortBy] ?? 'data_evento';
  const safeDir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  const leadSituacaoExpr = columns.has('lead_situacao') ? 'b.lead_situacao' : 'NULL::text';
  const slaExpr = columns.has('sla') ? 'b.sla::numeric' : (columns.has('SLA') ? 'b."SLA"::numeric' : 'NULL::numeric');
  const restricaoExpr = columns.has('restricao_lead') ? getFunnelRestrictionNumericSql('b.restricao_lead') : 'NULL::numeric';

  return {
    sql: `
      WITH detail_rows AS (
        SELECT DISTINCT ON (b.${keyColumn})
          b.${keyColumn}::text AS chave,
          b.${dateColumn} AS data_evento,
          b.idlead::text AS idlead,
          ${columns.has('idprecadastro') ? 'b.idprecadastro::text' : 'NULL::text'} AS idprecadastro,
          ${columns.has('idreserva') ? 'b.idreserva::text' : 'NULL::text'} AS idreserva,
          ${columns.has('idrepasse') ? 'b.idrepasse::text' : 'NULL::text'} AS idrepasse,
          ${leadSituacaoExpr} AS situacao,
          ${columns.has('lead_cidade') ? 'b.lead_cidade' : 'NULL::text'} AS cidade,
          ${columns.has('empreendimento_nome') ? 'b.empreendimento_nome' : 'NULL::text'} AS empreendimento,
          ${columns.has('corretor_nome') ? getCorretorNomeExpr('b') : 'NULL::text'} AS corretor,
          ${columns.has('sdr_nome') ? getSdrNomeExpr('b') : 'NULL::text'} AS sdr,
          ${columns.has('lead_origem_nome') ? 'b.lead_origem_nome' : 'NULL::text'} AS origem,
          ${slaExpr} AS sla,
          ${getFunnelSlaClassificationSql(leadSituacaoExpr, slaExpr)} AS sla_classificacao,
          ${restricaoExpr} AS restricao_lead,
          ${getFunnelRestrictionClassificationSql(restricaoExpr)} AS restricao_classificacao
        FROM public.comercial_base b
        ${whereSql}
        ORDER BY b.${keyColumn}, b.${dateColumn} DESC NULLS LAST
      )
      SELECT *, COUNT(*) OVER()::bigint AS total_count
      FROM detail_rows
      ORDER BY ${safeSort} ${safeDir} NULLS LAST
      LIMIT $${params.length + 3} OFFSET $${params.length + 4}
    `,
    params: [filters.start, filters.end, ...params, limit, offset],
    source: 'comercial_base',
    dateColumn,
    keyColumn,
  };
};

const buildFunnelWorkflowStageQuery = async (client, stage, filters, { countOnly = true, page = 1, limit = 50, sortBy = 'data_evento', sortDir = 'desc' } = {}) => {
  const workflowSource = await getWorkflowSource(client);
  if (!workflowSource) {
    return { unavailable: true, reason: 'Fonte de workflow nao encontrada. Eventos de workflow nao foram substituidos por situacao atual.' };
  }

  const baseColumns = await getTableColumns(client, 'public.comercial_base');
  const { where, params } = await buildFunnelBaseFilter(client, filters, 4, 'b');
  const source = workflowSource;
  const workflowAlias = 'w';
  const statusParamIndex = 3;
  const baseJoin = baseColumns.has('idlead')
    ? `LEFT JOIN LATERAL (SELECT * FROM public.comercial_base b WHERE b.idlead::text = ${workflowAlias}.${source.leadColumn}::text LIMIT 1) b ON TRUE`
    : 'LEFT JOIN LATERAL (SELECT NULL::text AS idlead) b ON TRUE';

  if (countOnly) {
    return {
      sql: `
        SELECT COUNT(*)::bigint AS value
        FROM ${source.tableName} ${workflowAlias}
        ${baseJoin}
        WHERE ${getDayRangeSql(`${workflowAlias}.${source.dateColumn}`)}
          AND ${workflowAlias}.${source.statusColumn} = ANY($${statusParamIndex}::text[])
          ${where}
      `,
      params: [filters.start, filters.end, stage.statuses, ...params],
      source: source.tableName,
      dateColumn: source.dateColumn,
      keyColumn: source.leadColumn,
    };
  }

  const sortColumns = {
    data_evento: 'data_evento',
    chave: 'chave',
    cidade: 'cidade',
    empreendimento: 'empreendimento',
    corretor: 'corretor',
    sdr: 'sdr',
  };
  const safeSort = sortColumns[sortBy] ?? 'data_evento';
  const safeDir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  const slaExpr = baseColumns.has('sla') ? 'b.sla::numeric' : (baseColumns.has('SLA') ? 'b."SLA"::numeric' : 'NULL::numeric');
  const restricaoExpr = baseColumns.has('restricao_lead') ? getFunnelRestrictionNumericSql('b.restricao_lead') : 'NULL::numeric';

  return {
    sql: `
      WITH detail_rows AS (
        SELECT
          CONCAT(${workflowAlias}.${source.leadColumn}::text, '|', ${workflowAlias}.${source.dateColumn}::text, '|', ${workflowAlias}.${source.statusColumn}::text) AS chave,
          ${workflowAlias}.${source.dateColumn} AS data_evento,
          ${workflowAlias}.${source.leadColumn}::text AS idlead,
          ${baseColumns.has('idprecadastro') ? 'b.idprecadastro::text' : 'NULL::text'} AS idprecadastro,
          ${baseColumns.has('idreserva') ? 'b.idreserva::text' : 'NULL::text'} AS idreserva,
          ${baseColumns.has('idrepasse') ? 'b.idrepasse::text' : 'NULL::text'} AS idrepasse,
          ${workflowAlias}.${source.statusColumn}::text AS situacao,
          ${baseColumns.has('lead_cidade') ? 'b.lead_cidade' : 'NULL::text'} AS cidade,
          ${baseColumns.has('empreendimento_nome') ? 'b.empreendimento_nome' : 'NULL::text'} AS empreendimento,
          ${baseColumns.has('corretor_nome') ? getCorretorNomeExpr('b') : 'NULL::text'} AS corretor,
          ${baseColumns.has('sdr_nome') ? getSdrNomeExpr('b') : 'NULL::text'} AS sdr,
          ${baseColumns.has('lead_origem_nome') ? 'b.lead_origem_nome' : 'NULL::text'} AS origem,
          ${slaExpr} AS sla,
          ${getFunnelSlaClassificationSql(`${workflowAlias}.${source.statusColumn}`, slaExpr)} AS sla_classificacao,
          ${restricaoExpr} AS restricao_lead,
          ${getFunnelRestrictionClassificationSql(restricaoExpr)} AS restricao_classificacao
        FROM ${source.tableName} ${workflowAlias}
        ${baseJoin}
        WHERE ${getDayRangeSql(`${workflowAlias}.${source.dateColumn}`)}
          AND ${workflowAlias}.${source.statusColumn} = ANY($${statusParamIndex}::text[])
          ${where}
      )
      SELECT *, COUNT(*) OVER()::bigint AS total_count
      FROM detail_rows
      ORDER BY ${safeSort} ${safeDir} NULLS LAST
      LIMIT $${params.length + 4} OFFSET $${params.length + 5}
    `,
    params: [filters.start, filters.end, stage.statuses, ...params, limit, offset],
    source: source.tableName,
    dateColumn: source.dateColumn,
    keyColumn: source.leadColumn,
  };
};

const buildFunnelPropostasStageQuery = async (client, stage, filters, { countOnly = true, page = 1, limit = 50, sortBy = 'data_evento', sortDir = 'desc' } = {}) => {
  const propColumns = await getTableColumns(client, 'public.comercial_propostas_consolidada');
  const baseColumns = await getTableColumns(client, 'public.comercial_base');
  const dateColumn = pickAvailableColumn(propColumns, ['data_resposta_analise', 'dt_ultimo_historico_data', 'dt_ultimo_historico']);
  const keyColumn = propColumns.has('idprecadastro') ? 'idprecadastro' : null;
  const statusColumn = pickAvailableColumn(propColumns, ['resultado_da_analise', 'proposta_status_atual', 'proposta_status_consolidado_atual']);
  if (!dateColumn || !keyColumn || !statusColumn) {
    return { unavailable: true, reason: 'Colunas obrigatorias de propostas ausentes.' };
  }

  const { where, params } = await buildFunnelBaseFilter(client, filters, 4, 'b');
  const statusParamIndex = 3;
  if (countOnly) {
    return {
      sql: `
        SELECT COUNT(DISTINCT pc.${keyColumn})::bigint AS value
        FROM public.comercial_propostas_consolidada pc
        LEFT JOIN LATERAL (
          SELECT *
          FROM public.comercial_base b
          WHERE b.idprecadastro = pc.${keyColumn}
          LIMIT 1
        ) b ON TRUE
        WHERE ${getDayRangeSql(`pc.${dateColumn}`)}
          AND pc.${statusColumn} = ANY($${statusParamIndex}::text[])
          AND pc.${keyColumn} IS NOT NULL
          ${where}
      `,
      params: [filters.start, filters.end, stage.statuses, ...params],
      source: 'comercial_propostas_consolidada',
      dateColumn,
      keyColumn,
    };
  }

  const sortColumns = {
    data_evento: 'data_evento',
    chave: 'chave',
    cidade: 'cidade',
    empreendimento: 'empreendimento',
    corretor: 'corretor',
    sdr: 'sdr',
  };
  const safeSort = sortColumns[sortBy] ?? 'data_evento';
  const safeDir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  const leadSituacaoExpr = baseColumns.has('lead_situacao') ? 'b.lead_situacao' : 'NULL::text';
  const slaExpr = baseColumns.has('sla') ? 'b.sla::numeric' : (baseColumns.has('SLA') ? 'b."SLA"::numeric' : 'NULL::numeric');
  const restricaoExpr = baseColumns.has('restricao_lead') ? getFunnelRestrictionNumericSql('b.restricao_lead') : 'NULL::numeric';

  return {
    sql: `
      WITH detail_rows AS (
        SELECT DISTINCT ON (pc.${keyColumn})
          pc.${keyColumn}::text AS chave,
          pc.${dateColumn} AS data_evento,
          ${baseColumns.has('idlead') ? 'b.idlead::text' : 'NULL::text'} AS idlead,
          pc.${keyColumn}::text AS idprecadastro,
          ${baseColumns.has('idreserva') ? 'b.idreserva::text' : 'NULL::text'} AS idreserva,
          ${baseColumns.has('idrepasse') ? 'b.idrepasse::text' : 'NULL::text'} AS idrepasse,
          pc.${statusColumn}::text AS situacao,
          ${baseColumns.has('lead_cidade') ? 'b.lead_cidade' : 'NULL::text'} AS cidade,
          ${baseColumns.has('empreendimento_nome') ? 'b.empreendimento_nome' : 'NULL::text'} AS empreendimento,
          ${baseColumns.has('corretor_nome') ? getCorretorNomeExpr('b') : 'NULL::text'} AS corretor,
          ${baseColumns.has('sdr_nome') ? getSdrNomeExpr('b') : 'NULL::text'} AS sdr,
          ${baseColumns.has('lead_origem_nome') ? 'b.lead_origem_nome' : 'NULL::text'} AS origem,
          ${slaExpr} AS sla,
          ${getFunnelSlaClassificationSql(leadSituacaoExpr, slaExpr)} AS sla_classificacao,
          ${restricaoExpr} AS restricao_lead,
          ${getFunnelRestrictionClassificationSql(restricaoExpr)} AS restricao_classificacao
        FROM public.comercial_propostas_consolidada pc
        LEFT JOIN LATERAL (
          SELECT *
          FROM public.comercial_base b
          WHERE b.idprecadastro = pc.${keyColumn}
          LIMIT 1
        ) b ON TRUE
        WHERE ${getDayRangeSql(`pc.${dateColumn}`)}
          AND pc.${statusColumn} = ANY($${statusParamIndex}::text[])
          AND pc.${keyColumn} IS NOT NULL
          ${where}
        ORDER BY pc.${keyColumn}, pc.${dateColumn} DESC NULLS LAST
      )
      SELECT *, COUNT(*) OVER()::bigint AS total_count
      FROM detail_rows
      ORDER BY ${safeSort} ${safeDir} NULLS LAST
      LIMIT $${params.length + 4} OFFSET $${params.length + 5}
    `,
    params: [filters.start, filters.end, stage.statuses, ...params, limit, offset],
    source: 'comercial_propostas_consolidada',
    dateColumn,
    keyColumn,
  };
};

const buildFunnelStageQuery = async (client, stage, filters, options = {}) => {
  if (stage.source === 'workflow') {
    return buildFunnelWorkflowStageQuery(client, stage, filters, options);
  }
  if (stage.source === 'propostas') {
    return buildFunnelPropostasStageQuery(client, stage, filters, options);
  }
  return buildFunnelBaseStageQuery(client, stage, filters, options);
};

const buildEmpreendimentoDimFilters = (queryFilters, { startIndex = 1, alias = 'd' } = {}) => {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;
  const prefix = alias ? `${alias}.` : '';

  const buildBlankExpr = (expr) => `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
  const buildMixedFilterClause = (expr, value) => {
    const values = Array.isArray(value) ? value : [value];
    const includeBlank = values.includes(BLANK_FILTER_VALUE);
    const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR ${buildBlankExpr(expr)})`;
      parameterIndex += 1;
      return clause;
    }

    if (includeBlank) {
      return buildBlankExpr(expr);
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

  Object.entries(EMPREENDIMENTO_DIM_FILTER_COLUMNS).forEach(([field, column]) => {
    const value = queryFilters[field];
    if (!value || value === FILTER_DEFAULTS[field]) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (Array.isArray(value) && value.includes('todos')) return;
    const clause = buildMixedFilterClause(`${prefix}${column}`, value);
    where += ` AND ${clause}`;
  });

  return { where, params };
};

const buildHierarchyOnlyFilters = (queryFilters, { startIndex = 1, alias = 'h', useEmpreendimentoDim = false } = {}) => {
  const params = [];
  let where = '';
  let parameterIndex = startIndex;
  const prefix = alias ? `${alias}.` : '';

  const buildMixedFilterClause = (expr, value) => {
    const values = Array.isArray(value) ? value : [value];
    const includeBlank = values.includes(BLANK_FILTER_VALUE);
    const regularValues = values.filter((item) => item !== BLANK_FILTER_VALUE);

    if (includeBlank && regularValues.length > 0) {
      params.push(regularValues);
      const clause = `(${expr} = ANY($${parameterIndex}) OR NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL)`;
      parameterIndex += 1;
      return clause;
    }
    if (includeBlank) return `NULLIF(TRIM(COALESCE((${expr})::text, '')), '') IS NULL`;
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

  const columns = {
    corretor: 'nome',
    gerencia: 'gestor_nome',
    coordenacao: 'coordenador_nome'
  };

  Object.entries(columns).forEach(([field, column]) => {
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
    where += ` AND ${buildMixedFilterClause(expr, value)}`;
  });

  const value = queryFilters.imobiliaria;
  if (value && value !== FILTER_DEFAULTS.imobiliaria) {
    if (!(Array.isArray(value) && (value.length === 0 || value.includes('todas')))) {
      where += ` AND ${buildMixedFilterClause(HIERARCHY_IMOBILIARIA_KEY_SQL, value)}`;
    }
  }

  // New logic: Filter hierarchy by transaction-level attributes (City, Project, etc.)
  // This ensures the denominator (Active Corretores) responds to regional filters.
  const transactionFilters = {
    cidade: 'lead_cidade',
    empreendimento: useEmpreendimentoDim ? 'd.empreendimento' : 'empreendimento_nome',
    origem: 'lead_origem_nome',
    empreendimentoReduzido: useEmpreendimentoDim ? 'd.regiao' : getEmpreendimentoReduzidoExpr('b_inner')
  };

  const activeTransactionFilters = Object.entries(transactionFilters).filter(([field]) => {
    const val = queryFilters[field];
    return val && val !== FILTER_DEFAULTS[field] && !(Array.isArray(val) && (val.length === 0 || val.includes('todos') || val.includes('todas')));
  });

  if (activeTransactionFilters.length > 0) {
    let subWhere = '1=1';
    activeTransactionFilters.forEach(([field, column]) => {
      const val = queryFilters[field];
      const clause = buildMixedFilterClause(column, val);
      subWhere += ` AND ${clause}`;
    });

    let dateLimit = '';
    // IMPORTANT: transaction filters MUST be date-limited to be performant.
    // If start/end are not provided, we fallback to a safe range or skip (to avoid scanning whole table)
    const effectiveStart = queryFilters.start || queryFilters.startDate;
    const effectiveEnd = queryFilters.end || queryFilters.endDate;

    if (effectiveStart && effectiveEnd) {
      params.push(effectiveStart, effectiveEnd);
      dateLimit = `AND (dt_assinatura_contrato::date BETWEEN $${parameterIndex} AND $${parameterIndex + 1} OR dt_cadastro_reserva::date BETWEEN $${parameterIndex} AND $${parameterIndex + 1})`;
      parameterIndex += 2;
    } else {
      // If no dates, we still apply the filter but it will be slower. 
      // However, most callers now pass dates.
      dateLimit = '';
    }

    const dimJoin = useEmpreendimentoDim
      ? `LEFT JOIN public.dim_empreendimento d ON d.idempreendimento = ${EMPREENDIMENTO_JOIN_KEY_EXPR('b_inner')}`
      : '';

    where += `
      AND h.nome IN (
        SELECT DISTINCT ${getCorretorNomeExpr('b_inner')}
        FROM public.comercial_base b_inner
        ${dimJoin}
        WHERE ${subWhere}
          ${dateLimit}
      )
    `;
  }

  return { where, params };
};

const buildDailyAggregateFilters = (queryFilters, { startIndex = 1, alias = 'd' } = {}) => {
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
};

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

// --- ROTAS DA API ---

// 1. Resumo do Dashboard
app.get('/api/v1/dashboard/summary', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const dateRange = getDateRange(req.query);

  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;
  const ipcReferenceDate = getObservedReferenceDate(end);

  try {
    if (hasActiveSegmentedFiltersFromQuery(req.query)) {
      const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);
      const payload = await buildSegmentedSummaryPayload(start, end, segmentedFilters);
      return res.json(payload);
    }

    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const leadDateCol = KPI_DATE_COLUMNS.lead();
    const visitaDateCol = KPI_DATE_COLUMNS.visita();
    const vendaDateCol = KPI_DATE_COLUMNS.venda();
    const repasseDateCol = KPI_DATE_COLUMNS.repasse();
    const hasActiveDimensionFilters = ['cidade', 'origem', 'sdr', 'corretor', 'gerencia', 'coordenacao', 'empreendimento', 'empreendimentoReduzido', 'unidade', 'imobiliaria']
      .some((key) => Array.isArray(filters[key]) ? filters[key].length > 0 : Boolean(filters[key] && filters[key] !== FILTER_DEFAULTS[key]));
    const { where, params } = buildFilters(filters, { startIndex: 3, useEmpreendimentoDim });
    const { where: whereBaseAlias, params: paramsBaseAlias } = buildFilters(filters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
    const { where: hierarchyWhere, params: hierarchyParams } = buildHierarchyOnlyFilters({...filters, start, end}, { startIndex: 3 + params.length, alias: 'h', useEmpreendimentoDim });
    const queryParams = [start, end, ...params];
    const queryParamsWithHierarchy = [start, end, ...params, ...hierarchyParams];
    const ipcReferenceDateParam = queryParamsWithHierarchy.length + 1;
    const queryParamsBaseAlias = [start, end, ...paramsBaseAlias];

    const useDailySummary = String(process.env.DASHBOARD_SUMMARY_USE_DAILY || 'false').toLowerCase() === 'true';
    if (useDailySummary) {
      const { where: dailyWhere, params: dailyParams } = buildDailyAggregateFilters(filters, { startIndex: 3, alias: 'k' });
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

      const hDaily = buildHierarchyOnlyFilters({ ...filters, start, end }, { startIndex: 1, alias: 'h', useEmpreendimentoDim });
      const hDailyPeriodEndParam = hDaily.params.length + 2;
      const hDailyPeriodStartParam = hDaily.params.length + 1;

      const [dailySummaryResult, ipcResult] = await Promise.all([
        pool.query(dailySummarySql, [start, end, ...dailyParams]),
        pool.query(`
          WITH months AS (
            SELECT generate_series(
              DATE_TRUNC('month', $${hDailyPeriodStartParam}::date)::date,
              DATE_TRUNC('month', $${hDailyPeriodEndParam}::date)::date,
              '1 month'::interval
            )::date AS mes_referencia
          ),
          monthly_counts AS (
            SELECT
              m.mes_referencia,
              COUNT(DISTINCT ${HIERARCHY_CORRETOR_KEY_SQL}) FILTER (
                WHERE ${HIERARCHY_CORRETOR_KEY_SQL} IS NOT NULL
              )::int AS total_corretores,
              COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (
                WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL
              )::int AS total_imobiliarias
            FROM months m
            LEFT JOIN public.vw_hierarquia_cvcrm h
              ON h.mes_referencia = m.mes_referencia
             AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
             ${hDaily.where}
            GROUP BY m.mes_referencia
          )
          SELECT
            COALESCE(SUM(total_corretores), 0)::int AS total_corretores,
            COALESCE(SUM(total_imobiliarias), 0)::int AS total_imobiliarias
          FROM monthly_counts
        `, [...hDaily.params, start, ipcReferenceDate]),
      ]);

      const row = dailySummaryResult.rows[0] || {};
      const ipcRow = ipcResult.rows[0] || {};
      const totalRepasses = Number(row.total_repasses) || 0;
      const totalCorretores = Number(ipcRow.total_corretores) || 0;
      const totalImobiliarias = Number(ipcRow.total_imobiliarias) || 0;
      const totalIpcCorretor = totalCorretores > 0 ? Number((totalRepasses / totalCorretores).toFixed(2)) : 0;
      const totalIpcImobiliaria = totalImobiliarias > 0 ? Number((totalRepasses / totalImobiliarias).toFixed(2)) : 0;

      return res.json({
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
      });
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
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', $1::date)::date,
          DATE_TRUNC('month', $${ipcReferenceDateParam}::date)::date,
          '1 month'::interval
        )::date AS mes_referencia
      ),
      monthly_counts AS (
        SELECT
          m.mes_referencia,
          COUNT(DISTINCT ${HIERARCHY_CORRETOR_KEY_SQL}) FILTER (
            WHERE ${HIERARCHY_CORRETOR_KEY_SQL} IS NOT NULL
          )::int AS total_corretores,
          COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (
            WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL
          )::int AS total_imobiliarias
        FROM months m
        LEFT JOIN public.vw_hierarquia_cvcrm h
          ON h.mes_referencia = m.mes_referencia
         AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
         ${hierarchyWhere}
        GROUP BY m.mes_referencia
      )
      SELECT 
         COUNT(DISTINCT idrepasse) as total_repasses,
         (SELECT COALESCE(SUM(total_corretores), 0)::int FROM monthly_counts) as total_corretores,
         (SELECT COALESCE(SUM(total_imobiliarias), 0)::int FROM monthly_counts) as total_imobiliarias
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
       pool.query(ipcSql, [...queryParamsWithHierarchy, ipcReferenceDate])
    ]);

    const row = summaryResult.rows[0] || {};
    const propostasRow = propostasResult.rows[0] || {};
    const cancelRow = cancelResult.rows[0] || {};
    const distratoRow = distratoResult.rows[0] || {};
    const ipcRow = ipcResult.rows[0] || {};

    let totalIpcCorretor = 0;
    let totalIpcImobiliaria = 0;
    if (ipcRow.total_corretores > 0) {
      totalIpcCorretor = Number((ipcRow.total_repasses / ipcRow.total_corretores).toFixed(2));
    }
    if (ipcRow.total_imobiliarias > 0) {
      totalIpcImobiliaria = Number((ipcRow.total_repasses / ipcRow.total_imobiliarias).toFixed(2));
    }
    
    res.json({
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
      total_ipc: totalIpcCorretor, // kept for retro-compatibility if needed elsewhere
      total_ipc_corretor: totalIpcCorretor,
      total_ipc_imobiliaria: totalIpcImobiliaria,
      total_corretores_ativos: Number(ipcRow.total_corretores) || 0,
      total_imobiliarias_ativas: Number(ipcRow.total_imobiliarias) || 0,
      ipc_corretores_ativos: Number(ipcRow.total_corretores) || 0,
      ipc_imobiliarias_ativas: Number(ipcRow.total_imobiliarias) || 0
    });
  } catch (err) {
    console.error('[summary] postgres_error', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });

    res.status(500).json({
      error: 'Erro ao invocar banco local',
      details: err?.message || 'Erro desconhecido no Postgres',
    });
  }
});

// 2. Série Temporal para Gráficos
app.get('/api/v1/dashboard/trends', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const dateRange = getDateRange(req.query);

  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;

  try {
    if (hasActiveSegmentedFiltersFromQuery(req.query)) {
      const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);
      const rows = await buildSegmentedDailySeries(start, end, segmentedFilters);
      return res.json(rows);
    }

    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const { where, params } = buildDailyAggregateFilters(filters, { startIndex: 3, alias: 'k' });
    const { where: hierarchyWhere, params: hierarchyParams } = buildHierarchyOnlyFilters({...filters, start, end}, { startIndex: 3 + params.length, alias: 'h', useEmpreendimentoDim });
    const queryParams = [start, end, ...params, ...hierarchyParams];

    const q = `
      WITH days AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as data
      ),
      kpi AS (
        SELECT
          k.data,
          SUM(k.leads) AS leads,
          SUM(k.visitas) AS visitas,
          SUM(k.propostas_aprovadas + k.propostas_condicionadas + k.propostas_reprovadas) AS propostas,
          SUM(k.propostas_aprovadas) AS propostas_aprovadas,
          SUM(k.propostas_condicionadas) AS propostas_condicionadas,
          SUM(k.propostas_reprovadas) AS propostas_reprovadas,
          SUM(k.propostas_aprovadas + k.propostas_condicionadas + k.propostas_reprovadas) AS propostas_total,
          SUM(k.vendas) AS vendas,
          SUM(k.repasses) AS repasses,
          SUM(k.cancelamentos) AS cancelamentos,
          SUM(k.distratos) AS distratos,
          SUM(k.sla_finalizacao_sum) AS sla_f_sum,
          SUM(k.sla_finalizacao_count) AS sla_f_count,
          SUM(k.sla_repasse_sum) AS sla_r_sum,
          SUM(k.sla_repasse_count) AS sla_r_count
        FROM comercial_kpi_daily k
        WHERE k.data BETWEEN $1::date AND $2::date
        ${where}
        GROUP BY 1
      ),
      hierarchy_daily AS (
        SELECT
          d.data,
          COUNT(DISTINCT h.documento) AS corretores,
          COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL) AS imobiliarias
        FROM days d
        LEFT JOIN public.vw_hierarquia_cvcrm h
          ON ${hierarchyActiveAtDateSql('d.data')}
          ${hierarchyWhere}
        GROUP BY d.data
      )
      SELECT
        d.data,
        COALESCE(k.leads, 0) AS leads,
        COALESCE(k.visitas, 0) AS visitas,
        COALESCE(k.propostas, 0) AS propostas,
        COALESCE(k.propostas_aprovadas, 0) AS propostas_aprovadas,
        COALESCE(k.propostas_condicionadas, 0) AS propostas_condicionadas,
        COALESCE(k.propostas_reprovadas, 0) AS propostas_reprovadas,
        COALESCE(k.propostas_total, 0) AS propostas_total,
        COALESCE(k.vendas, 0) AS vendas,
        COALESCE(k.repasses, 0) AS repasses,
        COALESCE(k.cancelamentos, 0) AS cancelamentos,
        COALESCE(k.distratos, 0) AS distratos,
        CASE WHEN COALESCE(k.sla_f_count, 0) > 0 THEN (k.sla_f_sum / k.sla_f_count) ELSE NULL END AS sla_finalizacao,
        CASE WHEN COALESCE(k.sla_r_count, 0) > 0 THEN (k.sla_r_sum / k.sla_r_count) ELSE NULL END AS sla_repasse,
        COALESCE(k.sla_f_count, 0) AS sla_finalizacao_base,
        COALESCE(k.sla_r_count, 0) AS sla_repasse_base,
        CASE WHEN COALESCE(hd.corretores, 0) > 0 THEN (COALESCE(k.repasses, 0)::numeric / hd.corretores) ELSE NULL END AS ipc_corretor,
        CASE WHEN COALESCE(hd.imobiliarias, 0) > 0 THEN (COALESCE(k.repasses, 0)::numeric / hd.imobiliarias) ELSE NULL END AS ipc_imobiliaria,
        COALESCE(hd.corretores, 0) AS ipc_corretores_ativos,
        COALESCE(hd.imobiliarias, 0) AS ipc_imobiliarias_ativas
      FROM days d
      LEFT JOIN kpi k ON k.data = d.data
      LEFT JOIN hierarchy_daily hd ON hd.data = d.data
      ORDER BY d.data ASC
    `;

    const { rows } = await pool.query(q, queryParams);
    res.json(rows.map((row) => ({
      data: row.data.toISOString().split('T')[0],
      leads: Number(row.leads) || 0,
      visitas: Number(row.visitas) || 0,
      propostas: Number(row.propostas) || 0,
      propostas_aprovadas: Number(row.propostas_aprovadas) || 0,
      propostas_condicionadas: Number(row.propostas_condicionadas) || 0,
      propostas_reprovadas: Number(row.propostas_reprovadas) || 0,
      propostas_total: Number(row.propostas_total) || 0,
      vendas: Number(row.vendas) || 0,
      repasses: Number(row.repasses) || 0,
      cancelamentos: Number(row.cancelamentos) || 0,
      distratos: Number(row.distratos) || 0,
      sla_finalizacao: row.sla_finalizacao == null ? null : Number(Number(row.sla_finalizacao).toFixed(2)),
      sla_repasse: row.sla_repasse == null ? null : Number(Number(row.sla_repasse).toFixed(2)),
      sla_finalizacao_base: Number(row.sla_finalizacao_base) || 0,
      sla_repasse_base: Number(row.sla_repasse_base) || 0,
      ipc_corretor: row.ipc_corretor == null ? null : Number(Number(row.ipc_corretor).toFixed(2)),
      ipc_imobiliaria: row.ipc_imobiliaria == null ? null : Number(Number(row.ipc_imobiliaria).toFixed(2)),
      ipc_corretores_ativos: Number(row.ipc_corretores_ativos) || 0,
      ipc_imobiliarias_ativas: Number(row.ipc_imobiliarias_ativas) || 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tendências' });
  }
});

app.get('/api/v1/dashboard/overview', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;
  const prevStart = String(req.query.prevStartDate || '').trim();
  const prevEnd = String(req.query.prevEndDate || '').trim();

  const hasPrevious = Boolean(prevStart && prevEnd);
  if ((prevStart || prevEnd) && (!isValidDateStr(prevStart) || !isValidDateStr(prevEnd) || prevStart > prevEnd)) {
    return res.status(400).json({ error: 'prevStartDate/prevEndDate invalidos. Use YYYY-MM-DD e prevStartDate <= prevEndDate.' });
  }

  try {
    if (hasActiveSegmentedFiltersFromQuery(req.query)) {
      const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);
      const payload = await buildSegmentedOverviewPayload({
        start,
        end,
        prevStart,
        prevEnd,
        hasPrevious,
        filters: segmentedFilters,
      });
      return res.json(payload);
    }

    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const aggregateStartIndex = hasPrevious ? 5 : 3;
    const { where, params } = buildDailyAggregateFilters(filters, { startIndex: aggregateStartIndex, alias: 'd' });
    const hasActiveDimensionFilters = ['cidade', 'origem', 'sdr', 'corretor', 'gerencia', 'coordenacao', 'empreendimento', 'empreendimentoReduzido', 'unidade', 'imobiliaria']
      .some((key) => Array.isArray(filters[key]) ? filters[key].length > 0 : Boolean(filters[key] && filters[key] !== FILTER_DEFAULTS[key]));
    const { where: whereBaseAlias, params: paramsBaseAlias } = buildFilters(filters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });

    const getPropostasDaily = async (rangeStart, rangeEnd) => {
      const propostasSql = `
        SELECT
          pc.dt_ultimo_historico_data::date AS data,
          COUNT(DISTINCT pc.idprecadastro) FILTER (
            WHERE pc.proposta_status_atual = 'APROVADA'
          ) AS propostas_aprovadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (
            WHERE pc.proposta_status_atual = 'CONDICIONADA'
          ) AS propostas_condicionadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (
            WHERE pc.proposta_status_atual = 'REPROVADA'
          ) AS propostas_reprovadas,
          COUNT(DISTINCT pc.idprecadastro) FILTER (
            WHERE pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
          ) AS propostas_total
        FROM comercial_propostas_consolidada pc
        ${hasActiveDimensionFilters ? 'LEFT JOIN comercial_base b ON b.idprecadastro = pc.idprecadastro' : ''}
        WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
        ${hasActiveDimensionFilters ? whereBaseAlias : ''}
        GROUP BY 1
        ORDER BY 1
      `;
      const queryParams = hasActiveDimensionFilters
        ? [rangeStart, rangeEnd, ...paramsBaseAlias]
        : [rangeStart, rangeEnd];
      const result = await pool.query(propostasSql, queryParams);
      return result.rows.map((row) => ({
        data: row.data instanceof Date ? row.data : new Date(`${row.data}T00:00:00Z`),
        propostas_aprovadas: Number(row.propostas_aprovadas) || 0,
        propostas_condicionadas: Number(row.propostas_condicionadas) || 0,
        propostas_reprovadas: Number(row.propostas_reprovadas) || 0,
        propostas_total: Number(row.propostas_total) || 0,
      }));
    };

    const periodCase = hasPrevious ? `CASE WHEN d.data BETWEEN $1::date AND $2::date THEN 'current' WHEN d.data BETWEEN $3::date AND $4::date THEN 'previous' END` : `'current'`;
    const dateWindowClause = hasPrevious
      ? `(d.data BETWEEN $1::date AND $2::date OR d.data BETWEEN $3::date AND $4::date)`
      : `(d.data BETWEEN $1::date AND $2::date)`;

    const query = `
      SELECT
        d.data,
        ${periodCase} AS period_type,
        SUM(d.leads) AS leads,
        SUM(d.visitas) AS visitas,
        SUM(d.vendas) AS vendas,
        SUM(d.repasses) AS repasses,
        SUM(d.propostas_aprovadas) AS propostas_aprovadas,
        SUM(d.propostas_condicionadas) AS propostas_condicionadas,
        SUM(d.propostas_reprovadas) AS propostas_reprovadas,
        SUM(d.propostas_total) AS propostas_total,
        SUM(d.cancelamentos) AS cancelamentos,
        SUM(d.distratos) AS distratos,
        SUM(d.sla_finalizacao_sum) AS sla_f_sum,
        SUM(d.sla_finalizacao_count) AS sla_f_count,
        SUM(d.sla_repasse_sum) AS sla_r_sum,
        SUM(d.sla_repasse_count) AS sla_r_count
      FROM comercial_kpi_daily d
      WHERE ${dateWindowClause}
      ${where}
      GROUP BY d.data, period_type
      ORDER BY d.data ASC
    `;

    const queryParams = hasPrevious
      ? [start, end, prevStart, prevEnd, ...params]
      : [start, end, ...params];

    const [mainResult, propostasAtual, propostasAnterior] = await Promise.all([
      pool.query(query, queryParams),
      getPropostasDaily(start, end),
      hasPrevious ? getPropostasDaily(prevStart, prevEnd) : Promise.resolve([]),
    ]);

    const rows = mainResult.rows ?? [];
    const rowIndex = new Map();
    const registerRow = (row) => {
      const dateKey = row.data.toISOString().split('T')[0];
      const periodType = (row.period_type || 'current');
      rowIndex.set(`${dateKey}::${periodType}`, row);
    };
    rows.forEach(registerRow);

    const mergePropostas = (entries, periodType) => {
      entries.forEach((entry) => {
        const dateKey = entry.data.toISOString().split('T')[0];
        const key = `${dateKey}::${periodType}`;
        let target = rowIndex.get(key);
        if (!target) {
          target = {
            data: new Date(`${dateKey}T00:00:00Z`),
            period_type: periodType,
            leads: 0,
            visitas: 0,
            vendas: 0,
            repasses: 0,
            propostas_aprovadas: 0,
            propostas_condicionadas: 0,
            propostas_reprovadas: 0,
            propostas_total: 0,
            cancelamentos: 0,
            distratos: 0,
            sla_f_sum: 0,
            sla_f_count: 0,
            sla_r_sum: 0,
            sla_r_count: 0,
          };
          rowIndex.set(key, target);
          rows.push(target);
        }
        target.propostas_aprovadas = entry.propostas_aprovadas;
        target.propostas_condicionadas = entry.propostas_condicionadas;
        target.propostas_reprovadas = entry.propostas_reprovadas;
        target.propostas_total = entry.propostas_total;
        target.propostas = entry.propostas_total;
      });
    };

    mergePropostas(propostasAtual, 'current');
    if (hasPrevious) {
      mergePropostas(propostasAnterior, 'previous');
    }

    rows.sort((a, b) => {
      const timeDiff = a.data - b.data;
      if (timeDiff !== 0) return timeDiff;
      const aType = a.period_type || 'current';
      const bType = b.period_type || 'current';
      return aType.localeCompare(bType);
    });

    const buildSeriesFromRows = (sourceRows, periodType) => sourceRows
      .filter((r) => (r.period_type || 'current') === periodType)
      .map((r) => {
        const slaFCount = Number(r.sla_f_count) || 0;
        const slaRCount = Number(r.sla_r_count) || 0;
        const slaFSum = Number(r.sla_f_sum) || 0;
        const slaRSum = Number(r.sla_r_sum) || 0;
        return {
          data: r.data.toISOString().split('T')[0],
          leads: Number(r.leads) || 0,
          visitas: Number(r.visitas) || 0,
          propostas: Number(r.propostas_total) || 0,
          propostas_aprovadas: Number(r.propostas_aprovadas) || 0,
          propostas_condicionadas: Number(r.propostas_condicionadas) || 0,
          propostas_reprovadas: Number(r.propostas_reprovadas) || 0,
          propostas_total: Number(r.propostas_total) || 0,
          vendas: Number(r.vendas) || 0,
          repasses: Number(r.repasses) || 0,
          cancelamentos: Number(r.cancelamentos) || 0,
          distratos: Number(r.distratos) || 0,
          sla_finalizacao: slaFCount > 0 ? Number((slaFSum / slaFCount).toFixed(2)) : null,
          sla_finalizacao_sum: slaFSum,
          sla_finalizacao_base: slaFCount,
          sla_repasse: slaRCount > 0 ? Number((slaRSum / slaRCount).toFixed(2)) : null,
          sla_repasse_sum: slaRSum,
          sla_repasse_base: slaRCount,
        };
      });
    const buildSeries = (periodType) => buildSeriesFromRows(rows, periodType);

    const getDailySeriesForRange = async (rangeStart, rangeEnd) => {
      const rangeFilters = buildDailyAggregateFilters(filters, { startIndex: 3, alias: 'd' });
      const rangeQuery = `
        SELECT
          d.data,
          'current' AS period_type,
          SUM(d.leads) AS leads,
          SUM(d.visitas) AS visitas,
          SUM(d.vendas) AS vendas,
          SUM(d.repasses) AS repasses,
          SUM(d.propostas_aprovadas) AS propostas_aprovadas,
          SUM(d.propostas_condicionadas) AS propostas_condicionadas,
          SUM(d.propostas_reprovadas) AS propostas_reprovadas,
          SUM(d.propostas_total) AS propostas_total,
          SUM(d.cancelamentos) AS cancelamentos,
          SUM(d.distratos) AS distratos,
          SUM(d.sla_finalizacao_sum) AS sla_f_sum,
          SUM(d.sla_finalizacao_count) AS sla_f_count,
          SUM(d.sla_repasse_sum) AS sla_r_sum,
          SUM(d.sla_repasse_count) AS sla_r_count
        FROM comercial_kpi_daily d
        WHERE d.data BETWEEN $1::date AND $2::date
        ${rangeFilters.where}
        GROUP BY d.data
        ORDER BY d.data ASC
      `;
      const [rangeResult, rangePropostas] = await Promise.all([
        pool.query(rangeQuery, [rangeStart, rangeEnd, ...rangeFilters.params]),
        getPropostasDaily(rangeStart, rangeEnd),
      ]);

      const rangeRows = rangeResult.rows ?? [];
      const rangeIndex = new Map();
      rangeRows.forEach((row) => {
        const dateKey = row.data.toISOString().split('T')[0];
        rangeIndex.set(dateKey, row);
      });

      rangePropostas.forEach((entry) => {
        const dateKey = entry.data.toISOString().split('T')[0];
        let target = rangeIndex.get(dateKey);
        if (!target) {
          target = {
            data: new Date(`${dateKey}T00:00:00Z`),
            period_type: 'current',
            leads: 0,
            visitas: 0,
            vendas: 0,
            repasses: 0,
            propostas_aprovadas: 0,
            propostas_condicionadas: 0,
            propostas_reprovadas: 0,
            propostas_total: 0,
            cancelamentos: 0,
            distratos: 0,
            sla_f_sum: 0,
            sla_f_count: 0,
            sla_r_sum: 0,
            sla_r_count: 0,
          };
          rangeIndex.set(dateKey, target);
          rangeRows.push(target);
        }
        target.propostas_aprovadas = entry.propostas_aprovadas;
        target.propostas_condicionadas = entry.propostas_condicionadas;
        target.propostas_reprovadas = entry.propostas_reprovadas;
        target.propostas_total = entry.propostas_total;
      });

      rangeRows.sort((a, b) => a.data - b.data);
      return buildSeriesFromRows(rangeRows, 'current');
    };

    const trends = buildSeries('current');
    const previousTrends = hasPrevious ? buildSeries('previous') : [];

    const sumBy = (items, key) => items.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
    const avgByBase = (items, valueKey, baseKey) => {
      const val = items.reduce((acc, item) => acc + ((Number(item[valueKey]) || 0) * (Number(item[baseKey]) || 0)), 0);
      const base = items.reduce((acc, item) => acc + (Number(item[baseKey]) || 0), 0);
      return base > 0 ? Number((val / base).toFixed(2)) : 0;
    };

    const getHierarchyDailyCounts = async (rangeStart, rangeEnd) => {
      const hierarchyFilters = buildHierarchyOnlyFilters({...filters, start: rangeStart, end: rangeEnd}, { startIndex: 3, alias: 'h', useEmpreendimentoDim });
      const hierarchyQuery = `
        WITH days AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS data
        ),
        h_filtered AS (
          SELECT *
          FROM public.vw_hierarquia_cvcrm h
          WHERE 1=1 ${hierarchyFilters.where}
        )
        SELECT
          d.data,
          COUNT(DISTINCT h.documento) AS corretores,
          COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FILTER (WHERE ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL) AS imobiliarias
        FROM days d
        LEFT JOIN h_filtered h
          ON ${hierarchyActiveAtDateSql('d.data')}
        GROUP BY d.data
        ORDER BY d.data ASC
      `;
      const result = await pool.query(hierarchyQuery, [rangeStart, rangeEnd, ...hierarchyFilters.params]);
      return new Map((result.rows ?? []).map((row) => {
        const key = row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data).slice(0, 10);
        return [key, {
          corretores: Number(row.corretores) || 0,
          imobiliarias: Number(row.imobiliarias) || 0,
        }];
      }));
    };

    const hFiltersCurrent = buildHierarchyOnlyFilters({...filters, start, end}, { startIndex: 1, alias: 'h', useEmpreendimentoDim });
    const hCorretoresQuery = `SELECT COUNT(DISTINCT documento) AS count FROM public.vw_hierarquia_cvcrm h WHERE ${hierarchyActiveAtDateSql(`$${hFiltersCurrent.params.length + 1}::date`)} ${hFiltersCurrent.where}`;
    const hImobsQuery = `SELECT COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) AS count FROM public.vw_hierarquia_cvcrm h WHERE ${hierarchyActiveAtDateSql(`$${hFiltersCurrent.params.length + 1}::date`)} AND ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL ${hFiltersCurrent.where}`;
    const currentHierarchyReferenceDate = getObservedReferenceDate(end);

    const selectedEndYear = Number(String(end).slice(0, 4));
    const currentYearStart = `${selectedEndYear}-01-01`;
    const currentYearEnd = end;
    const previousYearStart = `${selectedEndYear - 1}-01-01`;
    const previousYearEnd = `${selectedEndYear - 1}-12-31`;

    const hierarchyCache = new Map();
    const getHierarchyDailyCountsMemoized = async (rangeStart, rangeEnd) => {
      const cacheKey = `${rangeStart}::${rangeEnd}`;
      if (hierarchyCache.has(cacheKey)) return hierarchyCache.get(cacheKey);
      const promise = getHierarchyDailyCounts(rangeStart, rangeEnd);
      hierarchyCache.set(cacheKey, promise);
      return promise;
    };

    const seriesCache = new Map();
    const getDailySeriesForRangeMemoized = async (rangeStart, rangeEnd) => {
      const cacheKey = `${rangeStart}::${rangeEnd}`;
      if (seriesCache.has(cacheKey)) return seriesCache.get(cacheKey);
      const promise = getDailySeriesForRange(rangeStart, rangeEnd);
      seriesCache.set(cacheKey, promise);
      return promise;
    };

    const isCurrentSameAsAnnual = start === currentYearStart && end === currentYearEnd;
    const isPreviousSameAsAnnual = hasPrevious && prevStart === previousYearStart && prevEnd === previousYearEnd;

    const [
      hCurCorretoresRes,
      hCurImobsRes,
      hPrevCorretoresRes,
      hPrevImobsRes,
      currentHierarchyByDate,
      previousHierarchyByDate,
      currentAnnualRows,
      previousAnnualRows,
      currentAnnualHierarchyByDate,
      previousAnnualHierarchyByDate,
    ] = await Promise.all([
      pool.query(hCorretoresQuery, [...hFiltersCurrent.params, currentHierarchyReferenceDate]),
      pool.query(hImobsQuery, [...hFiltersCurrent.params, currentHierarchyReferenceDate]),
      hasPrevious ? pool.query(hCorretoresQuery, [...hFiltersCurrent.params, prevEnd]) : Promise.resolve({ rows: [{ count: 0 }] }),
      hasPrevious ? pool.query(hImobsQuery, [...hFiltersCurrent.params, prevEnd]) : Promise.resolve({ rows: [{ count: 0 }] }),
      getHierarchyDailyCountsMemoized(start, end),
      hasPrevious ? getHierarchyDailyCountsMemoized(prevStart, prevEnd) : Promise.resolve(new Map()),
      isCurrentSameAsAnnual ? Promise.resolve(trends) : getDailySeriesForRangeMemoized(currentYearStart, currentYearEnd),
      isPreviousSameAsAnnual ? Promise.resolve(previousTrends) : getDailySeriesForRangeMemoized(previousYearStart, previousYearEnd),
      isCurrentSameAsAnnual ? getHierarchyDailyCountsMemoized(start, end) : getHierarchyDailyCountsMemoized(currentYearStart, currentYearEnd),
      isPreviousSameAsAnnual ? getHierarchyDailyCountsMemoized(prevStart, prevEnd) : getHierarchyDailyCountsMemoized(previousYearStart, previousYearEnd),
    ]);

    const currentCorretores = Number(hCurCorretoresRes.rows?.[0]?.count) || 0;
    const currentImobs = Number(hCurImobsRes.rows?.[0]?.count) || 0;
    const previousCorretores = Number(hPrevCorretoresRes.rows?.[0]?.count) || 0;
    const previousImobs = Number(hPrevImobsRes.rows?.[0]?.count) || 0;

    const enrichIpc = (items, hierarchyByDate, fallbackCorretores, fallbackImobs) => items.map((item) => {
      const bases = hierarchyByDate.get(item.data) ?? {};
      const corretores = Number(bases.corretores) || Number(fallbackCorretores) || 0;
      const imobiliarias = Number(bases.imobiliarias) || Number(fallbackImobs) || 0;
      const repasses = Number(item.repasses) || 0;
      return {
        ...item,
        ipc_repasses: repasses,
        ipc_corretor: corretores > 0 ? Number((repasses / corretores).toFixed(2)) : null,
        ipc_imobiliaria: imobiliarias > 0 ? Number((repasses / imobiliarias).toFixed(2)) : null,
        ipc_corretores_ativos: corretores,
        ipc_imobiliarias_ativas: imobiliarias,
      };
    });

    const currentTrends = enrichIpc(trends, currentHierarchyByDate, currentCorretores, currentImobs);
    const previousTrendsEnriched = hasPrevious
      ? enrichIpc(previousTrends, previousHierarchyByDate, previousCorretores, previousImobs)
      : [];
    const currentAnnualTrends = enrichIpc(currentAnnualRows, currentAnnualHierarchyByDate, currentCorretores, currentImobs);
    const previousAnnualTrends = enrichIpc(previousAnnualRows, previousAnnualHierarchyByDate, previousCorretores, previousImobs);

    const monthKey = (dateKey) => String(dateKey || '').slice(0, 7);
    const formatMonthLabel = (periodKey) => {
      const [year, month] = String(periodKey).split('-');
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
    };
    const roundNullable = (value, digits = 2) => (
      value == null || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(digits))
    );
    const buildMonthlySeries = (items) => {
      const groups = new Map();
      items.forEach((item) => {
        const key = monthKey(item.data);
        if (!key) return;
        if (!groups.has(key)) {
          groups.set(key, {
            period: key,
            label: formatMonthLabel(key),
            startDate: item.data,
            endDate: item.data,
            leads: 0,
            visitas: 0,
            propostas: 0,
            propostas_aprovadas: 0,
            propostas_condicionadas: 0,
            propostas_reprovadas: 0,
            propostas_total: 0,
            vendas: 0,
            repasses: 0,
            cancelamentos: 0,
            distratos: 0,
            sla_finalizacao_sum: 0,
            sla_finalizacao_base: 0,
            sla_repasse_sum: 0,
            sla_repasse_base: 0,
            ipc_repasses: 0,
            ipc_corretores_ativos: 0,
            ipc_imobiliarias_ativas: 0,
          });
        }
        const target = groups.get(key);
        target.endDate = item.data;
        ['leads', 'visitas', 'propostas', 'propostas_aprovadas', 'propostas_condicionadas', 'propostas_reprovadas', 'propostas_total', 'vendas', 'repasses', 'cancelamentos', 'distratos'].forEach((field) => {
          target[field] += Number(item[field]) || 0;
        });
        target.sla_finalizacao_sum += Number(item.sla_finalizacao_sum) || 0;
        target.sla_finalizacao_base += Number(item.sla_finalizacao_base) || 0;
        target.sla_repasse_sum += Number(item.sla_repasse_sum) || 0;
        target.sla_repasse_base += Number(item.sla_repasse_base) || 0;
        target.ipc_repasses += Number(item.ipc_repasses ?? item.repasses) || 0;
        target.ipc_corretores_ativos = Number(item.ipc_corretores_ativos) || target.ipc_corretores_ativos;
        target.ipc_imobiliarias_ativas = Number(item.ipc_imobiliarias_ativas) || target.ipc_imobiliarias_ativas;
      });
      return Array.from(groups.values()).map((item) => ({
        ...item,
        data: item.period,
        sla_finalizacao: item.sla_finalizacao_base > 0 ? roundNullable(item.sla_finalizacao_sum / item.sla_finalizacao_base) : null,
        sla_repasse: item.sla_repasse_base > 0 ? roundNullable(item.sla_repasse_sum / item.sla_repasse_base) : null,
        ipc_corretor: item.ipc_corretores_ativos > 0 ? roundNullable(item.ipc_repasses / item.ipc_corretores_ativos) : null,
        ipc_imobiliaria: item.ipc_imobiliarias_ativas > 0 ? roundNullable(item.ipc_repasses / item.ipc_imobiliarias_ativas) : null,
      }));
    };
    const buildCumulativeSeries = (items, granularity) => {
      const acc = {
        leads: 0,
        visitas: 0,
        propostas: 0,
        propostas_aprovadas: 0,
        propostas_condicionadas: 0,
        propostas_reprovadas: 0,
        propostas_total: 0,
        vendas: 0,
        repasses: 0,
        cancelamentos: 0,
        distratos: 0,
        sla_finalizacao_sum: 0,
        sla_finalizacao_base: 0,
        sla_repasse_sum: 0,
        sla_repasse_base: 0,
        ipc_repasses: 0,
        ipc_corretores_ativos: 0,
        ipc_imobiliarias_ativas: 0,
      };
      const corretoresByMonth = new Map();
      const imobiliariasByMonth = new Map();
      const addIpcBase = (map, currentTotal, item, field) => {
        const value = Number(item[field]) || 0;
        if (granularity === 'day') {
          const month = String(item.data ?? item.period ?? '').slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(month)) return currentTotal;
          const previousValue = Number(map.get(month)) || 0;
          if (value > previousValue) {
            map.set(month, value);
            return currentTotal + (value - previousValue);
          }
          return currentTotal;
        }
        return currentTotal + value;
      };
      return items.map((item, index) => {
        ['leads', 'visitas', 'propostas', 'propostas_aprovadas', 'propostas_condicionadas', 'propostas_reprovadas', 'propostas_total', 'vendas', 'repasses', 'cancelamentos', 'distratos'].forEach((field) => {
          acc[field] += Number(item[field]) || 0;
        });
        acc.sla_finalizacao_sum += Number(item.sla_finalizacao_sum) || 0;
        acc.sla_finalizacao_base += Number(item.sla_finalizacao_base) || 0;
        acc.sla_repasse_sum += Number(item.sla_repasse_sum) || 0;
        acc.sla_repasse_base += Number(item.sla_repasse_base) || 0;
        acc.ipc_repasses += Number(item.ipc_repasses ?? item.repasses) || 0;
        acc.ipc_corretores_ativos = addIpcBase(corretoresByMonth, acc.ipc_corretores_ativos, item, 'ipc_corretores_ativos');
        acc.ipc_imobiliarias_ativas = addIpcBase(imobiliariasByMonth, acc.ipc_imobiliarias_ativas, item, 'ipc_imobiliarias_ativas');
        const corretores = Number(acc.ipc_corretores_ativos) || 0;
        const imobiliarias = Number(acc.ipc_imobiliarias_ativas) || 0;
        return {
          ...item,
          ...acc,
          data: item.data,
          label: item.label ?? item.period ?? item.data,
          period: item.period ?? item.data,
          granularity,
          index: index + 1,
          sla_finalizacao: acc.sla_finalizacao_base > 0 ? roundNullable(acc.sla_finalizacao_sum / acc.sla_finalizacao_base) : null,
          sla_repasse: acc.sla_repasse_base > 0 ? roundNullable(acc.sla_repasse_sum / acc.sla_repasse_base) : null,
          ipc_corretor: corretores > 0 ? roundNullable(acc.ipc_repasses / corretores) : null,
          ipc_imobiliaria: imobiliarias > 0 ? roundNullable(acc.ipc_repasses / imobiliarias) : null,
          ipc_corretores_ativos: corretores,
          ipc_imobiliarias_ativas: imobiliarias,
        };
      });
    };

    const monthlySeries = buildMonthlySeries(currentAnnualTrends);
    const previousMonthlySeries = buildMonthlySeries(previousAnnualTrends);
    const currentPeriodMonthlySeries = buildMonthlySeries(currentTrends);
    const previousPeriodMonthlySeries = buildMonthlySeries(previousTrendsEnriched);
    const currentPeriodCorretores = sumBy(currentPeriodMonthlySeries, 'ipc_corretores_ativos');
    const currentPeriodImobs = sumBy(currentPeriodMonthlySeries, 'ipc_imobiliarias_ativas');
    const previousPeriodCorretores = sumBy(previousPeriodMonthlySeries, 'ipc_corretores_ativos');
    const previousPeriodImobs = sumBy(previousPeriodMonthlySeries, 'ipc_imobiliarias_ativas');
    const series = {
      daily: currentTrends,
      monthly: monthlySeries,
      cumulativeDaily: buildCumulativeSeries(currentTrends, 'day'),
      cumulativeMonthly: buildCumulativeSeries(monthlySeries, 'month'),
    };
    const previousSeries = {
      daily: previousTrendsEnriched,
      monthly: previousMonthlySeries,
      cumulativeDaily: buildCumulativeSeries(previousTrendsEnriched, 'day'),
      cumulativeMonthly: buildCumulativeSeries(previousMonthlySeries, 'month'),
    };

    const summary = {
      total_leads: sumBy(currentTrends, 'leads'),
      total_visitas: sumBy(currentTrends, 'visitas'),
      total_propostas_aprovadas: sumBy(currentTrends, 'propostas_aprovadas'),
      total_propostas_condicionadas: sumBy(currentTrends, 'propostas_condicionadas'),
      total_propostas_reprovadas: sumBy(currentTrends, 'propostas_reprovadas'),
      total_propostas_geral: sumBy(currentTrends, 'propostas_total'),
      total_propostas: sumBy(currentTrends, 'propostas_total'),
      total_vendas: sumBy(currentTrends, 'vendas'),
      total_repasses: sumBy(currentTrends, 'repasses'),
      total_cancelamentos: sumBy(currentTrends, 'cancelamentos'),
      total_distratos: sumBy(currentTrends, 'distratos'),
      total_sla_finalizacao: avgByBase(currentTrends, 'sla_finalizacao', 'sla_finalizacao_base'),
      total_sla_repasse: avgByBase(currentTrends, 'sla_repasse', 'sla_repasse_base'),
      total_ipc: currentPeriodCorretores > 0 ? Number((sumBy(currentTrends, 'repasses') / currentPeriodCorretores).toFixed(2)) : 0,
      total_ipc_corretor: currentPeriodCorretores > 0 ? Number((sumBy(currentTrends, 'repasses') / currentPeriodCorretores).toFixed(2)) : 0,
      total_ipc_imobiliaria: currentPeriodImobs > 0 ? Number((sumBy(currentTrends, 'repasses') / currentPeriodImobs).toFixed(2)) : 0,
      total_corretores_ativos: currentPeriodCorretores,
      total_imobiliarias_ativas: currentPeriodImobs,
      ipc_corretores_ativos: currentPeriodCorretores,
      ipc_imobiliarias_ativas: currentPeriodImobs,
    };

    const previousSummary = hasPrevious ? {
      total_leads: sumBy(previousTrendsEnriched, 'leads'),
      total_visitas: sumBy(previousTrendsEnriched, 'visitas'),
      total_propostas_aprovadas: sumBy(previousTrendsEnriched, 'propostas_aprovadas'),
      total_propostas_condicionadas: sumBy(previousTrendsEnriched, 'propostas_condicionadas'),
      total_propostas_reprovadas: sumBy(previousTrendsEnriched, 'propostas_reprovadas'),
      total_propostas_geral: sumBy(previousTrendsEnriched, 'propostas_total'),
      total_propostas: sumBy(previousTrendsEnriched, 'propostas_total'),
      total_vendas: sumBy(previousTrendsEnriched, 'vendas'),
      total_repasses: sumBy(previousTrendsEnriched, 'repasses'),
      total_cancelamentos: sumBy(previousTrendsEnriched, 'cancelamentos'),
      total_distratos: sumBy(previousTrendsEnriched, 'distratos'),
      total_sla_finalizacao: avgByBase(previousTrendsEnriched, 'sla_finalizacao', 'sla_finalizacao_base'),
      total_sla_repasse: avgByBase(previousTrendsEnriched, 'sla_repasse', 'sla_repasse_base'),
      total_ipc: previousPeriodCorretores > 0 ? Number((sumBy(previousTrendsEnriched, 'repasses') / previousPeriodCorretores).toFixed(2)) : 0,
      total_ipc_corretor: previousPeriodCorretores > 0 ? Number((sumBy(previousTrendsEnriched, 'repasses') / previousPeriodCorretores).toFixed(2)) : 0,
      total_ipc_imobiliaria: previousPeriodImobs > 0 ? Number((sumBy(previousTrendsEnriched, 'repasses') / previousPeriodImobs).toFixed(2)) : 0,
      total_corretores_ativos: previousPeriodCorretores,
      total_imobiliarias_ativas: previousPeriodImobs,
      ipc_corretores_ativos: previousPeriodCorretores,
      ipc_imobiliarias_ativas: previousPeriodImobs,
    } : null;

    return res.json({
      summary,
      trends: currentTrends,
      previousSummary,
      previousTrends: previousTrendsEnriched,
      series,
      previousSeries,
      seriesMeta: {
        startDate: start,
        endDate: end,
        businessDays: trends.length,
        months: monthlySeries.length,
        recommendedView: monthlySeries.length > 3 ? 'monthly' : 'daily',
      },
    });
  } catch (err) {
    console.error('[overview] error', {
      message: err?.message || String(err),
      stack: err?.stack,
      query: req?.query,
    });

    // Fallback resiliente: consolida via endpoints existentes para evitar 500 na UI.
    try {
      const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}`;
      const buildParams = (s, e) => {
        const p = new URLSearchParams();
        Object.entries(req.query || {}).forEach(([k, v]) => {
          if (v == null) return;
          if (k === 'startDate' || k === 'endDate' || k === 'prevStartDate' || k === 'prevEndDate') return;
          if (Array.isArray(v)) {
            p.set(k, v.join(','));
          } else {
            p.set(k, String(v));
          }
        });
        p.set('startDate', s);
        p.set('endDate', e);
        return p.toString();
      };

      const curQs = buildParams(start, end);
      const requests = [
        fetch(`${baseUrl}/api/v1/dashboard/summary?${curQs}`),
        fetch(`${baseUrl}/api/v1/dashboard/trends?${curQs}`),
      ];
      if (hasPrevious) {
        const prevQs = buildParams(prevStart, prevEnd);
        requests.push(fetch(`${baseUrl}/api/v1/dashboard/summary?${prevQs}`));
        requests.push(fetch(`${baseUrl}/api/v1/dashboard/trends?${prevQs}`));
      }

      const [summaryRes, trendsRes, prevSummaryRes, prevTrendsRes] = await Promise.all(requests);
      if (!summaryRes.ok || !trendsRes.ok || (hasPrevious && (!prevSummaryRes?.ok || !prevTrendsRes?.ok))) {
        throw new Error('fallback overview consolidation failed');
      }

      const summary = await summaryRes.json();
      const trends = await trendsRes.json();
      const previousSummary = hasPrevious ? await prevSummaryRes.json() : null;
      const previousTrends = hasPrevious ? await prevTrendsRes.json() : [];

      return res.json({ summary, trends, previousSummary, previousTrends });
    } catch (fallbackErr) {
      console.error('[overview] fallback_error', {
        message: fallbackErr?.message || String(fallbackErr),
        stack: fallbackErr?.stack,
      });
      return res.status(500).json({ error: 'Erro ao consolidar dados do overview' });
    }
  }
});

// 3. Endpoint Breakdown
app.get('/api/v1/dashboard/breakdown', async (req, res) => {
  const { kpi = 'leads' } = req.query;
  const propostaStatusRaw = String(req.query.propostaStatus || 'TODAS').toUpperCase();
  const propostaStatus = ['APROVADA', 'CONDICIONADA', 'REPROVADA', 'TODAS'].includes(propostaStatusRaw)
    ? propostaStatusRaw
    : 'TODAS';
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const dateRange = getDateRange(req.query);

  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;

  const availableColumns = baseColumns ?? new Set();
  const imobiliariaExpr = availableColumns.has('imobiliaria_nome_dim') && availableColumns.has('imobiliaria_nome')
    ? 'COALESCE(imobiliaria_nome_dim, imobiliaria_nome, idimobiliaria::text)'
    : (availableColumns.has('imobiliaria_nome_dim')
      ? 'COALESCE(imobiliaria_nome_dim, idimobiliaria::text)'
      : (availableColumns.has('imobiliaria_nome')
        ? 'COALESCE(imobiliaria_nome, idimobiliaria::text)'
        : (availableColumns.has('idimobiliaria') ? 'idimobiliaria::text' : null)));

  try {
    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const axisColumns = {
      cidade: 'lead_cidade',
      empreendimento: useEmpreendimentoDim ? getEmpreendimentoDimExpr('empreendimento') : 'empreendimento_nome',
      origem: 'lead_origem_nome',
      corretor: 'corretor_nome',
      corretorAtivo: 'corretor_nome',
      sdr: 'sdr_nome',
      sdrAtivo: 'sdr_nome',
      gerencia: 'gestor_nome',
      coordenacao: 'coordenador_nome',
      empreendimentoReduzido: useEmpreendimentoDim ? getEmpreendimentoDimExpr('regiao') : getEmpreendimentoReduzidoExpr()
    };
    if (imobiliariaExpr) axisColumns.imobiliaria = imobiliariaExpr;
    const hasActiveDimensionFilters = ['cidade', 'origem', 'sdr', 'corretor', 'gerencia', 'coordenacao', 'empreendimento', 'empreendimentoReduzido', 'unidade', 'imobiliaria']
      .some((key) => Array.isArray(filters[key]) ? filters[key].length > 0 : Boolean(filters[key] && filters[key] !== FILTER_DEFAULTS[key]));
    const { where, params } = buildFilters(filters, { startIndex: 3, useEmpreendimentoDim });
    const { where: whereBaseAlias, params: paramsBaseAlias } = buildFilters(filters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
    const queryParams = [start, end, ...params];
    const queryParamsBaseAlias = [start, end, ...paramsBaseAlias];
    const byAxis = { 
      cidade: [], 
      empreendimento: [], 
      corretor: [], 
      corretorAtivo: [],
      sdr: [],
      sdrAtivo: [],
      origem: [], 
      empreendimentoReduzido: [], 
      imobiliaria: [] 
    };

    let dateCol = 'dt_ultima_conversao_lead';
    let baseTable = 'comercial_base';
    let countField = 'COUNT(DISTINCT idlead)';
    let caseCountField = 'COUNT(DISTINCT idlead)';
    const isEventKpi = kpi === 'cancelamentos' || kpi === 'distratos';
    if (kpi === 'vendas') {
      dateCol = KPI_DATE_COLUMNS.venda();
      countField = 'COUNT(DISTINCT idreserva)';
      caseCountField = 'COUNT(DISTINCT idreserva)';
    }
    if (kpi === 'visitas') { dateCol = 'dt_visita_realizada'; }
    if (kpi === 'propostas') {
      dateCol = 'dt_ultimo_historico_data';
    }
    if (kpi === 'repasses' || kpi === 'ipc' || kpi === 'ipc_corretor' || kpi === 'ipc_imobiliaria') {
      dateCol = 'dt_assinatura_contrato';
      countField = 'COUNT(DISTINCT idrepasse) FILTER (WHERE fl_repasse_assinado = true)';
      caseCountField = 'COUNT(DISTINCT idrepasse) FILTER (WHERE fl_repasse_assinado = true)';
    }
    if (kpi === 'sla_f') {
      dateCol = 'dt_contrato_contabilizado';
      countField = `AVG(${SLA_FINALIZACAO_EXPR})`;
      caseCountField = `COUNT(*) FILTER (WHERE (${SLA_FINALIZACAO_EXPR}) IS NOT NULL)`;
    }
    if (kpi === 'sla_r') {
      dateCol = 'dt_assinatura_contrato';
      countField = `AVG(${SLA_REPASSE_EXPR})`;
      caseCountField = `COUNT(*) FILTER (WHERE (${SLA_REPASSE_EXPR}) IS NOT NULL)`;
    }

    await Promise.all(Object.entries(axisColumns).map(async ([axis, col]) => {
      let q;
      const coordenacaoLabelExpr = (corretorExpr, dateExpr = '$2::date') => `
        (
          SELECT h.coordenador_nome
          FROM public.vw_hierarquia_cvcrm h
          WHERE LOWER(TRIM(h.nome)) = LOWER(TRIM(COALESCE(${corretorExpr}, '')))
            AND ${hierarchyActiveAtDateSql(dateExpr)}
            AND NULLIF(TRIM(COALESCE(h.coordenador_nome, '')), '') IS NOT NULL
          LIMIT 1
        )
      `;
      const corretorAtivoLabelExpr = (corretorExpr, dateExpr = '$2::date') => `
        (
          SELECT h.nome
          FROM public.vw_hierarquia_cvcrm h
          WHERE LOWER(TRIM(h.nome)) = LOWER(TRIM(COALESCE(${corretorExpr}, '')))
            AND ${hierarchyActiveAtDateSql(dateExpr)}
          LIMIT 1
        )
      `;
      const sdrAtivoLabelExpr = (sdrExpr, dateExpr = '$2::date') => `
        (
          SELECT h.nome
          FROM public.vw_hierarquia_sdr h
          WHERE LOWER(TRIM(h.nome)) = LOWER(TRIM(COALESCE(${sdrExpr}, '')))
            AND ${hierarchyActiveAtDateSql(dateExpr)}
          LIMIT 1
        )
      `;
      if (kpi === 'ipc' || kpi === 'ipc_corretor' || kpi === 'ipc_imobiliaria') {
        const axisExpr = (() => {
          if (axis === 'empreendimentoReduzido') return "COALESCE(k.empreendimento_reduzido, 'Sem informação')";
          if (axis === 'imobiliaria') return "COALESCE(k.imobiliaria, 'Sem informação')";
          if (axis === 'corretor' || axis === 'corretorAtivo') return "COALESCE(k.corretor, 'Sem informação')";
          if (axis === 'coordenacao') return coordenacaoLabelExpr('k.corretor');
          if (axis === 'sdr' || axis === 'sdrAtivo') return "COALESCE(k.sdr, 'Sem informação')";
          return `COALESCE(k.${axisColumns[axis] || axis}, 'Sem informação')`;
        })();

        const { where: dailyWhere, params: dailyParams } = buildDailyAggregateFilters(filters, { startIndex: 3, alias: 'k' });
        const localParams = [start, end, ...dailyParams];

        q = `
          WITH axis_data AS (
            SELECT
              ${axisExpr} AS label,
              SUM(k.repasses)::int AS value,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(k.corretor, '')), ''))::int AS base,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(k.imobiliaria, '')), ''))::int AS "baseImobiliaria"
            FROM comercial_kpi_daily k
            WHERE k.data BETWEEN $1::date AND $2::date
              ${dailyWhere}
            GROUP BY 1
          )
          SELECT
            label,
            value,
            base,
            "baseImobiliaria",
            CASE WHEN base > 0 THEN (value::numeric / base) ELSE 0 END AS ipc,
            CASE WHEN "baseImobiliaria" > 0 THEN (value::numeric / "baseImobiliaria") ELSE 0 END AS "ipcImobiliaria"
          FROM axis_data
          WHERE value > 0
        `;
        const { rows } = await pool.query(`${q} ORDER BY 2 DESC LIMIT 20`, localParams);
        byAxis[axis === 'gerencia' ? 'gerencia' : (axis === 'coordenacao' ? 'coordenacao' : axis)] = rows.map((row) => ({
          ...row,
          value: Number(row.value) || 0,
          base: Number(row.base) || 0,
          baseImobiliaria: Number(row.baseImobiliaria) || 0,
          ipc: row.ipc == null ? null : Number(Number(row.ipc).toFixed(2)),
          ipcImobiliaria: row.ipcImobiliaria == null ? null : Number(Number(row.ipcImobiliaria).toFixed(2)),
        }));
        return;
      } else if (isEventKpi) {
        const eventTable = kpi === 'cancelamentos' ? 'comercial_cancelamentos' : 'comercial_distratos';
        const eventAlias = kpi === 'cancelamentos' ? 'cc' : 'cd';
        const eventDateCol = kpi === 'cancelamentos' ? 'data_cancelamento' : 'referencia_data';

          const targetCol = (() => {
            if (axis === 'cidade') return 'b.lead_cidade';
            if (axis === 'empreendimento') return useEmpreendimentoDim ? getEmpreendimentoDimExpr('empreendimento', 'b') : `${eventAlias}.empreendimento_nome`;
            if (axis === 'empreendimentoReduzido') return useEmpreendimentoDim ? getEmpreendimentoDimExpr('regiao', 'b') : getEmpreendimentoReduzidoExpr('b');
            if (axis === 'imobiliaria') return getImobiliariaExpr('b');
            if (axis === 'coordenacao') return coordenacaoLabelExpr(getCorretorNomeExpr(eventAlias));
            if (axis === 'corretor') return getCorretorNomeExpr(eventAlias);
            if (axis === 'corretorAtivo') return corretorAtivoLabelExpr(getCorretorNomeExpr(eventAlias));
            if (axis === 'sdr') return getSdrGestorExpr('b');
            if (axis === 'sdrAtivo') return sdrAtivoLabelExpr(getSdrAtivoMatchExpr('b'));
            if (col === 'corretor_nome' || col === 'gestor_nome' || col === 'empreendimento_nome' || col === 'regiao_empreendimento') {
              return `${eventAlias}.${col}`;
            }
          return `b.${col}`;
        })();

        q = `
          SELECT
            COALESCE(${targetCol}, 'Sem informacao') AS label,
            COUNT(DISTINCT ${eventAlias}.idreserva)::int as value
          FROM ${eventTable} ${eventAlias}
          LEFT JOIN LATERAL (
            SELECT *
            FROM comercial_base b
            WHERE ${EVENT_TO_BASE_JOIN.replaceAll('EVENT', eventAlias)}
            LIMIT 1
          ) b ON TRUE
          WHERE ${eventAlias}.${eventDateCol}::date BETWEEN $1 AND $2
          ${whereBaseAlias}
        `;
      } else {
        const isPropostas = kpi === 'propostas';
        if (isPropostas) {
          const statusClause = propostaStatus === 'TODAS'
            ? `pc.proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')`
            : `pc.proposta_status_atual = '${propostaStatus}'`;
          const targetCol = (() => {
            if (axis === 'cidade') return 'b.lead_cidade';
            if (axis === 'empreendimento') return useEmpreendimentoDim ? getEmpreendimentoDimExpr('empreendimento', 'b') : 'b.empreendimento_nome';
            if (axis === 'empreendimentoReduzido') return useEmpreendimentoDim ? getEmpreendimentoDimExpr('regiao', 'b') : getEmpreendimentoReduzidoExpr('b');
            if (axis === 'imobiliaria') return getImobiliariaExpr('b');
            if (axis === 'coordenacao') return coordenacaoLabelExpr(getCorretorNomeExpr('b'));
            if (axis === 'corretor') return getCorretorNomeExpr('b');
            if (axis === 'corretorAtivo') return corretorAtivoLabelExpr(getCorretorNomeExpr('b'));
            if (axis === 'sdr') return getSdrGestorExpr('b');
            if (axis === 'sdrAtivo') return sdrAtivoLabelExpr(getSdrAtivoMatchExpr('b'));
            return `b.${col}`;
          })();
          q = `
            SELECT
              COALESCE(${targetCol}, 'Sem informacao') AS label,
              COUNT(DISTINCT pc.idprecadastro)::numeric as value,
              COUNT(DISTINCT pc.idprecadastro)::int as case_count
            FROM comercial_propostas_consolidada pc
            LEFT JOIN LATERAL (
              SELECT *
              FROM comercial_base b
              WHERE b.idprecadastro = pc.idprecadastro
              LIMIT 1
            ) b ON TRUE
            WHERE pc.dt_ultimo_historico_data BETWEEN $1 AND $2
              AND ${statusClause}
            ${hasActiveDimensionFilters ? whereBaseAlias : ''}
          `;
        } else {
          const targetCol = (() => {
            if (axis === 'coordenacao') return coordenacaoLabelExpr(getCorretorNomeExpr());
            if (axis === 'corretor') return getCorretorNomeExpr();
            if (axis === 'corretorAtivo') return corretorAtivoLabelExpr(getCorretorNomeExpr());
            if (axis === 'sdr') return getSdrGestorExpr();
            if (axis === 'sdrAtivo') return sdrAtivoLabelExpr(getSdrAtivoMatchExpr());
            return col;
          })();
          q = `
            SELECT 
              COALESCE(${targetCol}, 'Sem informacao') AS label, 
              ${countField}::numeric as value,
              ${caseCountField}::int as case_count
            FROM ${baseTable}
            WHERE ${dateCol}::date BETWEEN $1 AND $2
          `;
          q += where;
        }
      }
      if (kpi === 'ipc' || kpi === 'ipc_corretor' || kpi === 'ipc_imobiliaria') {
        // Redundant where removed - it is already included in line 1086
      }
      q += ` GROUP BY 1 ORDER BY 2 DESC LIMIT 20`;

      const queryArgs = isEventKpi
        ? queryParamsBaseAlias
        : (kpi === 'propostas'
          ? (hasActiveDimensionFilters ? queryParamsBaseAlias : [start, end])
          : (baseTable === 'comercial_base' ? queryParams : [start, end]));
      const effectiveArgs = queryArgs;
      const { rows } = await pool.query(q, effectiveArgs);
      
      const normalizedRows = (kpi === 'ipc' || kpi === 'ipc_corretor' || kpi === 'ipc_imobiliaria')
        ? rows.map((row) => ({
          ...row,
          value: Number(row.value) || 0,
          base: Number(row.base) || 0,
          baseImobiliaria: Number(row.baseImobiliaria) || 0,
          ipc: row.ipc == null ? null : Number(Number(row.ipc).toFixed(2)),
          ipcImobiliaria: row.ipcImobiliaria == null ? null : Number(Number(row.ipcImobiliaria).toFixed(2)),
        }))
        : rows;

      if(axis === 'empreendimentoReduzido') byAxis.empreendimentoReduzido = normalizedRows;
      else if(axis === 'gerencia') byAxis.gerencia = normalizedRows;
      else if(axis === 'coordenacao') byAxis.coordenacao = normalizedRows;
      else if(axis === 'corretorAtivo') byAxis.corretorAtivo = normalizedRows;
      else if(axis === 'sdrAtivo') byAxis.sdrAtivo = normalizedRows;
      else if(axis === 'sdr') byAxis.sdr = normalizedRows;
      else byAxis[axis] = normalizedRows;
    }));

    if ((byAxis.corretorAtivo ?? []).length === 0 && (byAxis.corretor ?? []).length > 0) {
      byAxis.corretorAtivo = byAxis.corretor;
    }
    if ((byAxis.sdrAtivo ?? []).length === 0 && (byAxis.sdr ?? []).length > 0) {
      byAxis.sdrAtivo = byAxis.sdr;
    }

    res.json({ byAxis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar breakdown' });
  }
});

// 3.1 Endpoint Breakdown segmentado pela Gold
app.get('/api/v1/dashboard/segmented/breakdown', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;
  const indicators = normalizeSegmentedIndicators(req.query);
  const sdrApplicable = isSdrSegmentApplicable(indicators);
  const filters = normalizeSegmentedFiltersFromQuery(req.query);
  const limit = parsePositiveInt(req.query.limit, 20, 1000);
  const { where, params } = buildSegmentedFilterWhere(filters, {
    startIndex: 4,
    alias: 's',
    includeSdrFilters: sdrApplicable,
  });

  const hFilters = buildSegmentedHierarchyWhere(filters, { startIndex: 4 + params.length });
  const hWhere = hFilters.where;
  const hParams = hFilters.params;

  const byAxis = Object.fromEntries(Object.keys(SEGMENTED_FILTER_COLUMNS).map((axis) => [axis, []]));
  const activeAxes = Object.entries(SEGMENTED_FILTER_COLUMNS)
    .filter(([axis]) => sdrApplicable || !SEGMENTED_SDR_AXIS_FIELDS.has(axis));

  const HIERARCHY_AXES_CONFIG = {
    corretorAtivo: { label: 'COALESCE(h.corretor_ativo_nome, h.nome)', col: 'corretor_ativo_nome' },
    imobiliariaCorretor: { label: 'COALESCE(h.imobiliaria_corretor, h.imobiliaria_nome_dim, h.imobiliaria_nome)', col: 'imobiliaria_corretor' },
    gestorCorretor: { label: 'COALESCE(h.gestor_corretor, h.gestor_nome)', col: 'gestor_corretor' },
    coordenadorCorretor: { label: 'COALESCE(h.coordenador_corretor, h.coordenador_nome)', col: 'coordenador_corretor' },
  };

  try {
    await Promise.all(activeAxes.map(async ([axis]) => {
      const isSdrImobiliariaAxis = axis === 'imobiliariaSdr';
      const hAxis = HIERARCHY_AXES_CONFIG[axis];
      const axisExpr = getSegmentedFieldExpr(axis, 's', isSdrImobiliariaAxis ? 'si' : null);

      let sql;
      let queryParams = [start, end, indicators, ...params];

      if (hAxis) {
        queryParams = [...queryParams, ...hParams];
        sql = `
          WITH hierarchy_base AS (
            SELECT DISTINCT ON (label) label
            FROM (
              SELECT ${hAxis.label} AS label
              FROM public.vw_hierarquia_cvcrm h
              WHERE h.mes_referencia = DATE_TRUNC('month', $2::date)::date
                AND LOWER(COALESCE(h.ativo_negocio, '')) = 's'
                ${hWhere}
            ) sub
          ),
          fact_data AS (
            SELECT
              COALESCE(NULLIF(TRIM((s.${hAxis.col})::text), ''), 'Sem informacao') AS label,
              SUM(COALESCE(s.valor_realizado, 1))::numeric AS value,
              COUNT(*)::int AS case_count
            FROM public.comercial_indicador_segmentacao s
            WHERE s.data_evento BETWEEN $1::date AND $2::date
              AND s.indicador = ANY($3::text[])
              ${where}
            GROUP BY 1
          )
          SELECT
            hb.label,
            COALESCE(fd.value, 0) AS value,
            COALESCE(fd.case_count, 0) AS case_count
          FROM hierarchy_base hb
          LEFT JOIN fact_data fd ON fd.label = hb.label
          ORDER BY 2 DESC, 1 ASC
          LIMIT ${limit}
        `;
      } else {
        sql = `
          ${isSdrImobiliariaAxis ? `WITH sdr_imobiliaria_lookup AS (${getSdrImobiliariaLookupSql()})` : ''}
          SELECT
            COALESCE(NULLIF(TRIM((${axisExpr})::text), ''), 'Sem informacao') AS label,
            SUM(COALESCE(s.valor_realizado, 1))::numeric AS value,
            COUNT(*)::int AS case_count
          FROM public.comercial_indicador_segmentacao s
          ${isSdrImobiliariaAxis ? `
          LEFT JOIN LATERAL (
            SELECT lookup.imobiliaria_nome
            FROM sdr_imobiliaria_lookup lookup
            WHERE lookup.imobiliaria_id = NULLIF(TRIM((s.imobiliaria_sdr)::text), '')
              AND (lookup.mes_referencia = s.mes_referencia OR lookup.mes_referencia IS NULL)
            ORDER BY (lookup.mes_referencia IS NULL), lookup.imobiliaria_nome
            LIMIT 1
          ) si ON TRUE
          ` : ''}
          WHERE s.data_evento BETWEEN $1::date AND $2::date
            AND s.indicador = ANY($3::text[])
            ${SEGMENTED_SDR_AXIS_FIELDS.has(axis) ? 'AND s.fl_indicador_sdr_aplicavel IS TRUE' : ''}
            ${where}
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT ${limit}
        `;
      }
      const result = await pool.query(sql, queryParams);
      byAxis[axis] = result.rows.map((row) => ({
        label: row.label,
        value: Number(row.value) || 0,
        case_count: Number(row.case_count) || 0,
      }));
    }));

    return res.json({
      byAxis,
      meta: {
        source: 'comercial_indicador_segmentacao',
        indicators,
        sdrApplicable,
        startDate: start,
        endDate: end,
      },
    });
  } catch (err) {
    console.error('[segmented/breakdown] error', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar breakdown segmentado' });
  }
});

// 3.1 Gargalo por Etapa
app.get('/api/v1/dashboard/bottlenecks', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = {
    ...normalized,
    gerencia: normalized.gerencia && normalized.gerencia !== FILTER_DEFAULTS.gerencia
      ? normalized.gerencia
      : normalized.coordenacao,
  };
  const dateRange = getDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ error: dateRange.error });

  const { start, end } = dateRange;

  try {
    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const { where, params } = buildFilters(filters, { startIndex: 3, useEmpreendimentoDim });
    const queryParams = [start, end, ...params];

    const q = `
      SELECT 
        AVG(CASE WHEN dt_visita_realizada >= dt_ultima_conversao_lead THEN EXTRACT(EPOCH FROM (dt_visita_realizada - dt_ultima_conversao_lead))/86400 END) as stage1,
        AVG(CASE WHEN dt_cadastro_reserva >= dt_visita_realizada THEN EXTRACT(EPOCH FROM (dt_cadastro_reserva - dt_visita_realizada))/86400 END) as stage2,
        AVG(CASE WHEN data_venda >= dt_cadastro_reserva THEN EXTRACT(EPOCH FROM (data_venda - dt_cadastro_reserva))/86400 END) as stage3,
        AVG(CASE WHEN dt_assinatura_contrato >= data_venda THEN EXTRACT(EPOCH FROM (dt_assinatura_contrato - data_venda))/86400 END) as stage4
      FROM comercial_base
      WHERE (
        dt_ultima_conversao_lead::date BETWEEN $1 AND $2 OR
        dt_visita_realizada::date BETWEEN $1 AND $2 OR
        dt_cadastro_reserva::date BETWEEN $1 AND $2 OR
        data_venda::date BETWEEN $1 AND $2 OR
        dt_assinatura_contrato::date BETWEEN $1 AND $2
      )
      ${where}
    `;

    const { rows } = await pool.query(q, queryParams);
    const result = rows[0];

    res.json({
      bottlenecks: [
        { id: 'lead_to_visita', label: 'Lead → Visita', value: result.stage1 == null ? 0 : Number(Number(result.stage1).toFixed(1)) },
        { id: 'visita_to_proposta', label: 'Visita → Proposta', value: result.stage2 == null ? 0 : Number(Number(result.stage2).toFixed(1)) },
        { id: 'proposta_to_venda', label: 'Proposta → Venda', value: result.stage3 == null ? 0 : Number(Number(result.stage3).toFixed(1)) },
        { id: 'venda_to_repasse', label: 'Venda → Repasse', value: result.stage4 == null ? 0 : Number(Number(result.stage4).toFixed(1)) },
      ]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar gargalos' });
  }
});

app.get('/api/v1/dashboard/ipc-insights', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const dateRange = getDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ error: dateRange.error });

  const { start, end } = dateRange;
  const repasseDateCol = KPI_DATE_COLUMNS.repasse();
  const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
  const { where, params } = buildFilters(normalized, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
  const queryParams = [start, end, ...params];

  try {
    const prevDateRange = getPreviousPeriod(start, end);
    const hasLegacyDimensionFilters = ['cidade', 'origem', 'sdr', 'corretor', 'gerencia', 'coordenacao', 'empreendimentoReduzido', 'imobiliaria']
      .some((key) => Array.isArray(normalized[key])
        ? normalized[key].length > 0
        : Boolean(normalized[key] && normalized[key] !== FILTER_DEFAULTS[key]));

    if (hasActiveSegmentedFiltersFromQuery(req.query) || !hasLegacyDimensionFilters) {
      const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);
      const payload = await buildSegmentedIpcInsightsPayload({
        start,
        end,
        prevStart: prevDateRange.start,
        prevEnd: prevDateRange.end,
        filters: segmentedFilters,
      });
      return res.json(payload);
    }

    const hFiltersCurrent = buildHierarchyOnlyFilters({...normalized, start, end}, { startIndex: 1, alias: 'h', useEmpreendimentoDim });
    const hCorretoresQuery = `SELECT COUNT(DISTINCT documento) FROM public.vw_hierarquia_cvcrm h WHERE ${hierarchyActiveAtDateSql(`$${hFiltersCurrent.params.length + 1}::date`)} ${hFiltersCurrent.where}`;
    const hImobsQuery = `SELECT COUNT(DISTINCT ${HIERARCHY_IMOBILIARIA_KEY_SQL}) FROM public.vw_hierarquia_cvcrm h WHERE ${hierarchyActiveAtDateSql(`$${hFiltersCurrent.params.length + 1}::date`)} AND ${HIERARCHY_IMOBILIARIA_KEY_SQL} IS NOT NULL ${hFiltersCurrent.where}`;

    const currentSummaryPromiseFull = (async () => {
      const repasses = await pool.query(`SELECT COUNT(DISTINCT idrepasse) FROM comercial_base b WHERE ${getDayRangeSql(`b.${repasseDateCol}`)} ${where}`, queryParams);
      const corretores = await pool.query(hCorretoresQuery, [...hFiltersCurrent.params, end]);
      const imobs = await pool.query(hImobsQuery, [...hFiltersCurrent.params, end]);
      return { 
        total_repasses: repasses.rows[0].count, 
        corretores: corretores.rows[0].count, 
        imobiliarias: imobs.rows[0].count 
      };
    })();

    const prevSummaryPromiseFull = (async () => {
      const repasses = await pool.query(`SELECT COUNT(DISTINCT idrepasse) FROM comercial_base b WHERE ${getDayRangeSql(`b.${repasseDateCol}`)} ${where}`, [prevDateRange.start, prevDateRange.end, ...params]);
      const corretores = await pool.query(hCorretoresQuery, [...hFiltersCurrent.params, prevDateRange.end]);
      const imobs = await pool.query(hImobsQuery, [...hFiltersCurrent.params, prevDateRange.end]);
      return { 
        total_repasses: repasses.rows[0].count, 
        corretores: corretores.rows[0].count, 
        imobiliarias: imobs.rows[0].count 
      };
    })();

    // 2. Rankings (keep these as they correctly handle base filters)
    const topCorretoresPromise = pool.query(`
      SELECT 
        COALESCE(corretor_nome, 'N/D') as label,
        COUNT(DISTINCT idrepasse) as value,
        1 as base, -- individual corretor base
        (COUNT(DISTINCT idrepasse))::numeric as ipc
      FROM comercial_base b
      WHERE ${getDayRangeSql(`b.${repasseDateCol}`)} ${where}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 15
    `, queryParams);

    const topImobiliariasPromise = pool.query(`
      SELECT 
        COALESCE(imobiliaria_nome_dim, imobiliaria_nome, 'N/D') as label,
        COUNT(DISTINCT idrepasse) as value,
        (
          SELECT COUNT(DISTINCT h_inner.documento)
          FROM public.vw_hierarquia_cvcrm h_inner
          WHERE COALESCE(NULLIF(TRIM(h_inner.imobiliaria_nome_dim), ''), NULLIF(TRIM(h_inner.imobiliaria_nome), ''))
                = COALESCE(imobiliaria_nome_dim, imobiliaria_nome)
            AND ${hierarchyActiveAtDateSql('$2::date').replaceAll('h.', 'h_inner.')}
        ) as base
      FROM comercial_base b
      WHERE ${getDayRangeSql(`b.${repasseDateCol}`)} ${where}
      GROUP BY 1, COALESCE(imobiliaria_nome_dim, imobiliaria_nome)
      ORDER BY 2 DESC
      LIMIT 15
    `, queryParams);

    const [cur, prv, corredores, imobs] = await Promise.all([
      currentSummaryPromiseFull, prevSummaryPromiseFull, topCorretoresPromise, topImobiliariasPromise
    ]);

    const ipcCorretor = cur.corretores > 0 ? (cur.total_repasses / cur.corretores) : 0;
    const prevIpcCorretor = prv.corretores > 0 ? (prv.total_repasses / prv.corretores) : 0;
    const ipcImobiliaria = cur.imobiliarias > 0 ? (cur.total_repasses / cur.imobiliarias) : 0;
    const prevIpcImobiliaria = prv.imobiliarias > 0 ? (prv.total_repasses / prv.imobiliarias) : 0;

    res.json({
      summary: {
        repasses: Number(cur.total_repasses),
        corretores: Number(cur.corretores),
        imobiliarias: Number(cur.imobiliarias),
        ipcCorretor: Number(ipcCorretor.toFixed(3)),
        prevIpcCorretor: Number(prevIpcCorretor.toFixed(3)),
        ipcImobiliaria: Number(ipcImobiliaria.toFixed(3)),
        prevIpcImobiliaria: Number(prevIpcImobiliaria.toFixed(3))
      },
      rankings: {
        corretores: corredores.rows.map(r => ({ ...r, share: (Number(r.value) / Number(cur.total_repasses)) * 100 })),
        imobiliarias: imobs.rows.map(r => ({ ...r, share: (Number(r.value) / Number(cur.total_repasses)) * 100 }))
      }
    });
  } catch (err) {
    console.error('[ipc-insights]', err);
    res.status(500).json({ error: 'Erro ao processar insights de IPC' });
  }
});

app.get('/api/v1/dashboard/sla-repasse-insights', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = {
    ...normalized,
    gerencia: normalized.gerencia && normalized.gerencia !== FILTER_DEFAULTS.gerencia
      ? normalized.gerencia
      : normalized.coordenacao,
  };
  const dateRange = getDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ error: dateRange.error });

  const { start, end } = dateRange;

  try {
    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const { where, params } = buildFilters(filters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
    const queryParams = [start, end, ...params];
    const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);

    const [summaryResult, topCorretoresResult, topSlaResult, pendingCasesResult, pendingStatusResult, segmentedTopBreakdowns] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date) AS contabilizados_periodo,
          COUNT(*) FILTER (
            WHERE b.dt_assinatura_contrato::date BETWEEN $1::date AND $2::date
              AND b.dt_contrato_contabilizado IS NOT NULL
              AND b.dt_assinatura_contrato IS NOT NULL
          ) AS com_assinatura,
          COUNT(*) FILTER (
            WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
              AND b.dt_contrato_contabilizado IS NOT NULL
              AND b.dt_assinatura_contrato IS NULL
          ) AS sem_assinatura
        FROM comercial_base b
        WHERE 1=1 ${where}
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          COUNT(DISTINCT b.idrepasse)::int AS assinaturas
        FROM comercial_base b
        WHERE b.dt_assinatura_contrato::date BETWEEN $1::date AND $2::date
          AND b.dt_assinatura_contrato IS NOT NULL
          ${where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 12
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          b.journey_id,
          b.idrepasse,
          b.dt_contrato_contabilizado::date AS dt_contrato_contabilizado,
          b.dt_assinatura_contrato::date AS dt_assinatura_contrato,
          ROUND((${SLA_REPASSE_EXPR})::numeric, 1) AS sla_dias,
          COALESCE(b.repasse_situacao_nome, 'Sem informacao') AS situacao_repasse
        FROM comercial_base b
        WHERE b.dt_assinatura_contrato::date BETWEEN $1::date AND $2::date
          AND (${SLA_REPASSE_EXPR}) IS NOT NULL
          ${where}
        ORDER BY sla_dias DESC NULLS LAST, b.dt_assinatura_contrato DESC
        LIMIT 12
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          b.journey_id,
          b.idrepasse,
          b.dt_contrato_contabilizado::date AS dt_contrato_contabilizado,
          COALESCE(b.repasse_situacao_nome, 'Sem informacao') AS situacao_repasse,
          ROUND(EXTRACT(EPOCH FROM (NOW() - b.dt_contrato_contabilizado)) / 86400.0, 1) AS dias_sem_assinatura
        FROM comercial_base b
        WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
          AND b.dt_contrato_contabilizado IS NOT NULL
          AND b.dt_assinatura_contrato IS NULL
          ${where}
        ORDER BY dias_sem_assinatura DESC NULLS LAST
        LIMIT 20
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.repasse_situacao_nome, 'Sem informacao') AS situacao_repasse,
          COUNT(*)::int AS total
        FROM comercial_base b
        WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
          AND b.dt_contrato_contabilizado IS NOT NULL
          AND b.dt_assinatura_contrato IS NULL
          ${where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `, queryParams),
      buildSegmentedSlaTopBreakdowns({
        start,
        end,
        filters: segmentedFilters,
        indicator: 'SLA REPASSE',
      }),
    ]);

    const summary = summaryResult.rows[0] || {};
    const contabilizados = Number(summary.contabilizados_periodo) || 0;
    const assinados = Number(summary.com_assinatura) || 0;
    const semAssinatura = Number(summary.sem_assinatura) || 0;

    return res.json({
      summary: {
        contabilizadosPeriodo: contabilizados,
        comAssinatura: assinados,
        semAssinatura,
        taxaAssinatura: contabilizados > 0 ? Number(((assinados / contabilizados) * 100).toFixed(1)) : 0,
      },
      topCorretoresAssinatura: topCorretoresResult.rows.map((row) => ({
        corretor: row.corretor,
        assinaturas: Number(row.assinaturas) || 0,
      })),
      topCorretoresSegmentados: segmentedTopBreakdowns,
      maioresSla: topSlaResult.rows.map((row) => ({
        corretor: row.corretor,
        journeyId: row.journey_id,
        idrepasse: row.idrepasse,
        dtContratoContabilizado: row.dt_contrato_contabilizado,
        dtAssinaturaContrato: row.dt_assinatura_contrato,
        slaDias: row.sla_dias == null ? null : Number(row.sla_dias),
        situacaoRepasse: row.situacao_repasse,
      })),
      semAssinaturaDetalhes: pendingCasesResult.rows.map((row) => ({
        corretor: row.corretor,
        journeyId: row.journey_id,
        idrepasse: row.idrepasse,
        dtContratoContabilizado: row.dt_contrato_contabilizado,
        diasSemAssinatura: row.dias_sem_assinatura == null ? null : Number(row.dias_sem_assinatura),
        situacaoRepasse: row.situacao_repasse,
      })),
      semAssinaturaPorSituacao: pendingStatusResult.rows.map((row) => ({
        situacaoRepasse: row.situacao_repasse,
        total: Number(row.total) || 0,
      })),
    });
  } catch (err) {
    console.error('[sla-repasse-insights] postgres_error', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    return res.status(500).json({ error: 'Erro ao buscar insights de SLA repasse' });
  }
});

console.log('register route: /api/v1/dashboard/sla-finalizacao-insights');
app.get('/api/v1/dashboard/sla-finalizacao-insights', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = {
    ...normalized,
    gerencia: normalized.gerencia && normalized.gerencia !== FILTER_DEFAULTS.gerencia
      ? normalized.gerencia
      : normalized.coordenacao,
  };
  const dateRange = getDateRange(req.query);
  if (dateRange.error) return res.status(400).json({ error: dateRange.error });

  const { start, end } = dateRange;

  try {
    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const { where, params } = buildFilters(filters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
    const queryParams = [start, end, ...params];
    const segmentedFilters = normalizeSegmentedFiltersFromQuery(req.query);

    const [summaryResult, topCorretoresResult, topSlaResult, pendingCasesResult, pendingStatusResult, segmentedTopBreakdowns] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date) AS reservas_periodo,
          COUNT(*) FILTER (WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date) AS contabilizacoes_periodo,
          COUNT(*) FILTER (
            WHERE b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date
              AND b.dt_contrato_contabilizado IS NOT NULL
          ) AS com_contabilizacao,
          COUNT(*) FILTER (
            WHERE b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date
              AND b.dt_contrato_contabilizado IS NULL
          ) AS sem_contabilizacao
        FROM comercial_base b
        WHERE 1=1 ${where}
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          COUNT(DISTINCT b.idreserva)::int AS assinaturas
        FROM comercial_base b
        WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
          AND b.dt_contrato_contabilizado IS NOT NULL
          ${where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 12
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          b.journey_id,
          b.idreserva,
          b.idreserva AS idrepasse,
          b.dt_cadastro_reserva::date AS dt_contrato_contabilizado,
          b.dt_contrato_contabilizado::date AS dt_assinatura_contrato,
          ROUND((${SLA_FINALIZACAO_EXPR})::numeric, 1) AS sla_dias,
          COALESCE(b.reserva_situacao_nome, 'Sem informacao') AS situacao_repasse
        FROM comercial_base b
        WHERE b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
          AND (${SLA_FINALIZACAO_EXPR}) IS NOT NULL
          ${where}
        ORDER BY sla_dias DESC NULLS LAST, b.dt_contrato_contabilizado DESC
        LIMIT 12
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.corretor_nome, 'Sem informacao') AS corretor,
          b.journey_id,
          b.idreserva,
          b.idreserva AS idrepasse,
          b.dt_cadastro_reserva::date AS dt_contrato_contabilizado,
          COALESCE(b.reserva_situacao_nome, 'Sem informacao') AS situacao_repasse,
          ROUND(EXTRACT(EPOCH FROM (NOW() - b.dt_cadastro_reserva)) / 86400.0, 1) AS dias_sem_assinatura
        FROM comercial_base b
        WHERE b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date
          AND b.dt_cadastro_reserva IS NOT NULL
          AND b.dt_contrato_contabilizado IS NULL
          ${where}
        ORDER BY dias_sem_assinatura DESC NULLS LAST
        LIMIT 20
      `, queryParams),
      pool.query(`
        SELECT
          COALESCE(b.reserva_situacao_nome, 'Sem informacao') AS situacao_repasse,
          COUNT(*)::int AS total
        FROM comercial_base b
        WHERE b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date
          AND b.dt_cadastro_reserva IS NOT NULL
          AND b.dt_contrato_contabilizado IS NULL
          ${where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `, queryParams),
      buildSegmentedSlaTopBreakdowns({
        start,
        end,
        filters: segmentedFilters,
        indicator: 'SLA FINALIZACAO',
      }),
    ]);

    const summary = summaryResult.rows[0] || {};
    const reservasPeriodo = Number(summary.reservas_periodo) || 0;
    const contabilizacoesPeriodo = Number(summary.contabilizacoes_periodo) || 0;
    const comContabilizacao = Number(summary.com_contabilizacao) || 0;
    const semContabilizacao = Number(summary.sem_contabilizacao) || 0;

    console.log('[sla-finalizacao-insights] ok', {
      periodo: { start, end },
      reservasPeriodo,
      contabilizacoesPeriodo,
      comContabilizacao,
      semContabilizacao,
      topCorretores: topCorretoresResult.rows.length,
      maioresSla: topSlaResult.rows.length,
      pendencias: pendingCasesResult.rows.length,
      pendenciasSituacao: pendingStatusResult.rows.length,
    });

    return res.json({
      summary: {
        contabilizadosPeriodo: reservasPeriodo,
        contabilizacoesPeriodo,
        comAssinatura: comContabilizacao,
        semAssinatura: semContabilizacao,
        taxaAssinatura: reservasPeriodo > 0 ? Number(((comContabilizacao / reservasPeriodo) * 100).toFixed(1)) : 0,
        taxaOperacional: reservasPeriodo > 0 ? Number(((contabilizacoesPeriodo / reservasPeriodo) * 100).toFixed(1)) : 0,
      },
      topCorretoresAssinatura: topCorretoresResult.rows.map((row) => ({
        corretor: row.corretor,
        assinaturas: Number(row.assinaturas) || 0,
      })),
      topCorretoresSegmentados: segmentedTopBreakdowns,
      maioresSla: topSlaResult.rows.map((row) => ({
        corretor: row.corretor,
        journeyId: row.journey_id,
        idreserva: row.idreserva,
        idrepasse: row.idrepasse,
        dtContratoContabilizado: row.dt_contrato_contabilizado,
        dtAssinaturaContrato: row.dt_assinatura_contrato,
        slaDias: row.sla_dias == null ? null : Number(row.sla_dias),
        situacaoRepasse: row.situacao_repasse,
      })),
      semAssinaturaDetalhes: pendingCasesResult.rows.map((row) => ({
        corretor: row.corretor,
        journeyId: row.journey_id,
        idreserva: row.idreserva,
        idrepasse: row.idrepasse,
        dtContratoContabilizado: row.dt_contrato_contabilizado,
        diasSemAssinatura: row.dias_sem_assinatura == null ? null : Number(row.dias_sem_assinatura),
        situacaoRepasse: row.situacao_repasse,
      })),
      semAssinaturaPorSituacao: pendingStatusResult.rows.map((row) => ({
        situacaoRepasse: row.situacao_repasse,
        total: Number(row.total) || 0,
      })),
    });
  } catch (err) {
    console.error('[sla-finalizacao-insights] postgres_error', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    return res.status(500).json({ error: 'Erro ao buscar insights de SLA finalizacao' });
  }
});

// 4. Filtros segmentados pela Gold
app.get('/api/v1/dashboard/segmented/filters', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const { start, end } = dateRange;
  const indicators = normalizeSegmentedIndicators(req.query);
  const sdrApplicable = isSdrSegmentApplicable(indicators);
  const filters = normalizeSegmentedFiltersFromQuery(req.query);
  const lite = String(req.query.lite || 'false').toLowerCase() === 'true';
  const optionLimit = parsePositiveInt(req.query.limit, lite ? 120 : 500, 1000);
  const addBlankOption = (items) => [{ value: BLANK_FILTER_VALUE, label: BLANK_FILTER_LABEL }, ...items];

  const makeOptions = (items, allValue, allLabel) => [
    { value: allValue, label: allLabel },
    ...addBlankOption(items.map((value) => ({ value, label: value }))),
  ];

  try {
    const getSegmentedOptions = async (field) => {
      if (!sdrApplicable && SEGMENTED_SDR_AXIS_FIELDS.has(field)) {
        return [];
      }

      const localFilters = { ...filters, [field]: [] };
      const { where, params } = buildSegmentedFilterWhere(localFilters, {
        startIndex: 4,
        alias: 's',
        excludeField: field,
        includeSdrFilters: sdrApplicable,
      });
      const isSdrImobiliariaField = field === 'imobiliariaSdr';
      const fieldExpr = getSegmentedFieldExpr(field, 's', isSdrImobiliariaField ? 'si' : null);

      const sql = `
        ${isSdrImobiliariaField ? `WITH sdr_imobiliaria_lookup AS (${getSdrImobiliariaLookupSql()})` : ''}
        SELECT DISTINCT (${fieldExpr})::text AS value
        FROM public.comercial_indicador_segmentacao s
        ${isSdrImobiliariaField ? `
        LEFT JOIN LATERAL (
          SELECT lookup.imobiliaria_nome
          FROM sdr_imobiliaria_lookup lookup
          WHERE lookup.imobiliaria_id = NULLIF(TRIM((s.imobiliaria_sdr)::text), '')
            AND (lookup.mes_referencia = s.mes_referencia OR lookup.mes_referencia IS NULL)
          ORDER BY (lookup.mes_referencia IS NULL), lookup.imobiliaria_nome
          LIMIT 1
        ) si ON TRUE
        ` : ''}
        WHERE s.data_evento BETWEEN $1::date AND $2::date
          AND s.indicador = ANY($3::text[])
          ${SEGMENTED_SDR_AXIS_FIELDS.has(field) ? 'AND s.fl_indicador_sdr_aplicavel IS TRUE' : ''}
          ${where}
          AND NULLIF(TRIM(COALESCE((${fieldExpr})::text, '')), '') IS NOT NULL
        ORDER BY 1
        LIMIT ${optionLimit}
      `;
      const result = await pool.query(sql, [start, end, indicators, ...params]);
      return result.rows.map((row) => row.value);
    };

    const entries = await Promise.all(
      Object.keys(SEGMENTED_FILTER_COLUMNS).map(async (field) => [
        field,
        await getSegmentedOptions(field),
      ])
    );
    const values = Object.fromEntries(entries);

    return res.json({
      operation: {
        regiaoOperacao: makeOptions(values.regiaoOperacao || [], 'todas', 'Todas as regiões da operação'),
        imobiliariaOperacao: makeOptions(values.imobiliariaOperacao || [], 'todas', 'Todas as imobiliárias da operação'),
        corretorOperacao: makeOptions(values.corretorOperacao || [], 'todos', 'Todos os corretores da operação'),
        empreendimento: makeOptions(values.empreendimento || [], 'todos', 'Todos os empreendimentos'),
        unidade: makeOptions(values.unidade || [], 'todos', 'Todas as unidades'),
        origem: makeOptions(values.origem || [], 'todas', 'Todas as origens'),
        sdrOperacao: makeOptions(values.sdrOperacao || [], 'todos', 'Todos os SDRs da operação'),
      },
      corretorAtivo: {
        corretorAtivo: makeOptions(values.corretorAtivo || [], 'todos', 'Todos os corretores ativos'),
        gestorCorretor: makeOptions(values.gestorCorretor || [], 'todas', 'Todas as gerências do corretor'),
        coordenadorCorretor: makeOptions(values.coordenadorCorretor || [], 'todas', 'Todas as coordenações do corretor'),
        regiaoCorretor: makeOptions(values.regiaoCorretor || [], 'todas', 'Todas as regiões do corretor'),
        imobiliariaCorretor: makeOptions(values.imobiliariaCorretor || [], 'todas', 'Todas as imobiliárias do corretor'),
      },
      sdrAtivo: {
        sdrAtivo: makeOptions(values.sdrAtivo || [], 'todos', 'Todos os SDRs ativos'),
        gestorSdr: makeOptions(values.gestorSdr || [], 'todas', 'Todas as gerências do SDR'),
        coordenadorSdr: makeOptions(values.coordenadorSdr || [], 'todas', 'Todas as coordenações do SDR'),
        regiaoSdr: makeOptions(values.regiaoSdr || [], 'todas', 'Todas as regiões do SDR'),
        imobiliariaSdr: makeOptions(values.imobiliariaSdr || [], 'todas', 'Todas as imobiliárias do SDR'),
      },
      meta: {
        source: 'comercial_indicador_segmentacao',
        indicators,
        sdrApplicable,
        lite,
        limit: optionLimit,
        startDate: start,
        endDate: end,
      },
    });
  } catch (err) {
    console.error('[segmented/filters] error', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar filtros segmentados' });
  }
});

// 4. Filtros
app.get('/api/v1/dashboard/filters', async (req, res) => {
  try {
    if (!baseColumns || !baseColumns.has('sdr_nome')) {
      await loadBaseColumns();
    }

    const dateRange = getDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ error: dateRange.error });
    }

    const { start, end } = dateRange;
    const normalized = normalizeFiltersFromQuery(req.query);
    const baseFilters = { ...normalized, start, end };

    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();

    const lite = String(req.query.lite || 'false').toLowerCase() === 'true';
    const optionLimit = parsePositiveInt(req.query.limit, lite ? 120 : 500, 1000);

    const withoutField = (field) => ({ ...baseFilters, [field]: [] });

    const dateWindowSql = `(
      b.dt_ultima_conversao_lead::date BETWEEN $1::date AND $2::date
      OR b.dt_visita_realizada::date BETWEEN $1::date AND $2::date
      OR b.data_venda::date BETWEEN $1::date AND $2::date
      OR b.dt_cancelamento_reserva::date BETWEEN $1::date AND $2::date
      OR b.dt_assinatura_contrato::date BETWEEN $1::date AND $2::date
      OR b.dt_cadastro_reserva::date BETWEEN $1::date AND $2::date
      OR b.dt_contrato_contabilizado::date BETWEEN $1::date AND $2::date
    )`;

    const getBaseOptions = async (field, expr) => {
      const localFilters = withoutField(field);
      const { where, params } = buildFilters(localFilters, { startIndex: 3, alias: 'b', useEmpreendimentoDim });
      const sql = `
        SELECT DISTINCT (${expr})::text AS value
        FROM comercial_base b
        WHERE ${dateWindowSql}
          ${where}
          AND NULLIF(TRIM(COALESCE(((${expr})::text), '')), '') IS NOT NULL
        ORDER BY 1
        LIMIT ${optionLimit}
      `;
      const { rows } = await pool.query(sql, [start, end, ...params]);
      return rows.map((r) => r.value);
    };

    const getHierarchyOptions = async (field, expr, viewName = 'public.vw_hierarquia_cvcrm', joinCol = 'corretor_nome') => {
      const localFilters = withoutField(field);
      const h = buildHierarchyOnlyFilters(localFilters, { startIndex: 1, alias: 'h', useEmpreendimentoDim, joinCol });
      const activeDateParamIndex = h.params.length + 1;
      const sql = `
        SELECT DISTINCT (${expr})::text AS value
        FROM ${viewName} h
        WHERE ${hierarchyActiveAtDateSql(`$${activeDateParamIndex}::date`)}
          ${h.where}
          AND NULLIF(TRIM(COALESCE(((${expr})::text), '')), '') IS NOT NULL
        ORDER BY 1
        LIMIT ${optionLimit}
      `;
      const { rows } = await pool.query(sql, [...h.params, end]);
      return rows.map((r) => r.value);
    };

    const [
      cidades,
      corretores,
      empreendimentos,
      imobiliarias,
      regioesEmpreendimento,
      origens,
      gestores,
      coordenadores,
      sdrs,
    ] = await Promise.all([
      getBaseOptions('cidade', 'b.lead_cidade'),
      getHierarchyOptions('corretor', 'h.nome'),
      getBaseOptions('empreendimento', useEmpreendimentoDim ? getEmpreendimentoDimExpr('empreendimento', 'b') : 'b.empreendimento_nome'),
      getHierarchyOptions('imobiliaria', HIERARCHY_IMOBILIARIA_KEY_SQL),
      getBaseOptions('empreendimentoReduzido', useEmpreendimentoDim ? getEmpreendimentoDimExpr('regiao', 'b') : getEmpreendimentoReduzidoExpr('b')),
      getBaseOptions('origem', 'b.lead_origem_nome'),
      getHierarchyOptions('gerencia', 'h.gestor_nome'),
      getHierarchyOptions('coordenacao', 'h.coordenador_nome'),
      getHierarchyOptions('sdr', 'h.nome', 'public.vw_hierarquia_sdr', 'sdr_nome'),
    ]);

    const addBlankOption = (items) => [{ value: BLANK_FILTER_VALUE, label: BLANK_FILTER_LABEL }, ...items];

    res.json({
      cidade: [{ value: 'todas', label: 'Todas as cidades' }, ...addBlankOption(cidades.map(v => ({ value: v, label: v })))],
      corretor: [{ value: 'todos', label: 'Todos os corretores' }, ...addBlankOption(corretores.map(v => ({ value: v, label: v })))],
      coordenacao: [{ value: 'todas', label: 'Todas as coordenações' }, ...addBlankOption(coordenadores.map(v => ({ value: v, label: v })))],
      gerencia: [{ value: 'todas', label: 'Todas as gerências' }, ...addBlankOption(gestores.map(v => ({ value: v, label: v })))],
      sdr: [{ value: 'todos', label: 'Todos os SDRs' }, ...addBlankOption(sdrs.map(v => ({ value: v, label: v })))],
      empreendimento: [{ value: 'todos', label: 'Todos os empreendimentos' }, ...addBlankOption(empreendimentos.map(v => ({ value: v, label: v })))],
      imobiliaria: [{ value: 'todas', label: 'Todas as imobiliárias' }, ...addBlankOption(imobiliarias.map(v => ({ value: v, label: v })))],
      empreendimentoReduzido: [{ value: 'todos', label: 'Todas as Regiões' }, ...addBlankOption(regioesEmpreendimento.map(v => ({ value: v, label: v })))],
      origem: [{ value: 'todas', label: 'Todas as origens' }, ...addBlankOption(origens.map(v => ({ value: v, label: v })))],
      meta: {
        lite,
        limit: optionLimit,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar filtros' });
  }
});

app.get('/api/v1/dashboard/filters/search', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const field = String(req.query.field || '').trim();
  const term = String(req.query.q || '').trim();
  const limit = parsePositiveInt(req.query.limit, 40, 200);
  const useEmpreendimentoDim = await hasEmpreendimentoDimReady();

  const fieldConfig = {
    cidade: { expr: 'lead_cidade', from: 'comercial_base b' },
    empreendimento: useEmpreendimentoDim ? { expr: 'd.empreendimento', from: 'dim_empreendimento d', empreendimentoDimOnly: true } : { expr: 'empreendimento_nome', from: 'comercial_base b' },
    origem: { expr: 'lead_origem_nome', from: 'comercial_base b' },
    empreendimentoReduzido: useEmpreendimentoDim ? { expr: 'd.regiao', from: 'dim_empreendimento d', empreendimentoDimOnly: true } : { expr: getEmpreendimentoReduzidoExpr('b'), from: 'comercial_base b' },
    corretor: { expr: 'h.nome', from: 'public.vw_hierarquia_cvcrm h', hierarchyOnly: true },
    gerencia: { expr: 'h.gestor_nome', from: 'public.vw_hierarquia_cvcrm h', hierarchyOnly: true },
    coordenacao: { expr: 'h.coordenador_nome', from: 'public.vw_hierarquia_cvcrm h', hierarchyOnly: true },
    imobiliaria: { expr: HIERARCHY_IMOBILIARIA_KEY_SQL, from: 'public.vw_hierarquia_cvcrm h', hierarchyOnly: true },
    sdr: { expr: 'h.nome', from: 'public.vw_hierarquia_sdr h', hierarchyOnly: true },
  };

  const config = fieldConfig[field];
  if (!config) {
    return res.status(400).json({ error: 'field invalido para busca incremental de filtros.' });
  }

  try {
    const params = [];
    let where = '';

    if (config.hierarchyOnly) {
      const h = buildHierarchyOnlyFilters({...filters, start: req.query.startDate, end: req.query.endDate}, { startIndex: 1, alias: 'h', useEmpreendimentoDim });
      where += ` AND ${hierarchyActiveAtDateSql('CURRENT_DATE')} ${h.where}`;
      params.push(...h.params);
    } else if (config.empreendimentoDimOnly) {
      const d = buildEmpreendimentoDimFilters(filters, { startIndex: 1, alias: 'd' });
      where += ` ${d.where}`;
      params.push(...d.params);
    } else {
      const b = buildFilters(filters, { startIndex: 1, alias: 'b', useEmpreendimentoDim });
      where += ` ${b.where}`;
      params.push(...b.params);
    }

    if (term.length >= 2) {
      params.push(`%${term}%`);
      where += ` AND ${config.expr} ILIKE $${params.length}`;
    }

    const sql = `
      SELECT DISTINCT ${config.expr}::text AS value
      FROM ${config.from}
      WHERE NULLIF(TRIM(COALESCE(${config.expr}::text, '')), '') IS NOT NULL
      ${where}
      ORDER BY 1
      LIMIT ${limit}
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({
      field,
      q: term,
      options: rows.map((r) => ({ value: r.value, label: r.value })),
    });
  } catch (err) {
    console.error('[filters/search] error', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar opcoes incrementais de filtros.' });
  }
});

app.get('/api/v1/leads', async (req, res) => {
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized };
  const dateRange = getDateRange(req.query);

  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  const offset = (page - 1) * limit;
  const status = String(req.query.status ?? 'todos').trim().toLowerCase();
  const { start, end } = dateRange;

  try {
    const useEmpreendimentoDim = await hasEmpreendimentoDimReady();
    const { where, params, parameterIndex } = buildFilters(filters, { startIndex: 3, useEmpreendimentoDim });
    const statusClauses = {
      novo: `b.dt_ultima_conversao_lead::date BETWEEN $1 AND $2`,
      'em-contato': `b.dt_visita_realizada::date BETWEEN $1 AND $2`,
      'proposta-emitida': `pc.dt_ultimo_historico_data BETWEEN $1 AND $2`,
      'venda-finalizada': `b.data_venda::date BETWEEN $1 AND $2`,
      cancelado: `b.dt_cancelamento_reserva::date BETWEEN $1 AND $2`,
      distratado: `d.referencia_data::date BETWEEN $1 AND $2`,
      'repasse-concluido': `b.dt_assinatura_contrato::date BETWEEN $1 AND $2`,
    };

    const defaultSituationExpr = `
      CASE
        WHEN d.idreserva IS NOT NULL AND d.referencia_data::date BETWEEN $1 AND $2 THEN 'Distratado'
        WHEN b.dt_cancelamento_reserva::date BETWEEN $1 AND $2 THEN 'Cancelado'
        WHEN b.dt_assinatura_contrato::date BETWEEN $1 AND $2 THEN 'Repasse concluido'
        WHEN b.data_venda::date BETWEEN $1 AND $2 THEN 'Venda finalizada'
        WHEN pc.dt_ultimo_historico_data BETWEEN $1 AND $2 THEN 'Proposta emitida'
        WHEN b.dt_visita_realizada::date BETWEEN $1 AND $2 THEN 'Em contato'
        WHEN b.dt_ultima_conversao_lead::date BETWEEN $1 AND $2 THEN 'Novo'
        ELSE 'Nao informado'
      END
    `;

    const explicitSituationExpr = {
      novo: `'Novo'`,
      'em-contato': `'Em contato'`,
      'proposta-emitida': `'Proposta emitida'`,
      'venda-finalizada': `'Venda finalizada'`,
      cancelado: `'Cancelado'`,
      distratado: `'Distratado'`,
      'repasse-concluido': `'Repasse concluido'`,
    };

    const statusClause = statusClauses[status];
    const situationExpr = explicitSituationExpr[status] ?? defaultSituationExpr;
    const statusWhere = statusClause ? ` AND ${statusClause}` : '';

    const sql = `
      SELECT
        b.idlead AS id_lead,
        b.idprecadastro AS id_precadastro,
        b.idreserva AS id_reserva,
        b.idrepasse AS id_repasse,
        ${situationExpr} AS situacao,
        b.lead_cidade AS cidade,
        COALESCE(h.coordenador_nome, 'Sem Gestor') AS coordenacao,
        COALESCE(${getCorretorNomeExpr('b')}, 'Sem corretor') AS corretor,
        COALESCE(${getSdrNomeExpr('b')}, 'Sem SDR') AS sdr,
        COALESCE(b.lead_origem_nome, 'Sem origem') AS origem,
        COALESCE(
          ${useEmpreendimentoDim ? getEmpreendimentoDimExpr('regiao', 'b') : 'NULL'},
          ${getEmpreendimentoReduzidoExpr('b')}
        ) AS empreendimento_reduzido,
        b.dt_ultima_conversao_lead::date AS dt_lead_conversao,
        b.dt_visita_realizada::date AS dt_visita_realizada,
        b.dt_resposta_analise_precadastro::date AS dt_resposta_analise_precadastro,
        b.data_venda::date AS data_venda,
        b.dt_contrato_contabilizado::date AS dt_contrato_contabilizado,
        b.dt_assinatura_contrato::date AS dt_assinatura_contrato,
        b.sla_finalizacao_dias,
        b.sla_repasse_dias,
        COALESCE(
          b.dt_assinatura_contrato,
          b.data_venda,
          b.dt_contrato_contabilizado,
          b.dt_cancelamento_reserva,
          d.referencia_data,
          pc.dt_ultimo_historico,
          b.dt_visita_realizada,
          b.dt_ultima_conversao_lead
        )::date AS data_referencia
      FROM comercial_base b
      LEFT JOIN comercial_propostas_consolidada pc ON pc.idprecadastro = b.idprecadastro
      LEFT JOIN comercial_distratos d ON d.idreserva = b.idreserva
      LEFT JOIN public.vw_hierarquia_cvcrm h ON h.nome = b.corretor_nome
        AND ${hierarchyActiveAtDateSql('CURRENT_DATE')}
      WHERE 1 = 1
        ${where}
        AND (
          b.dt_ultima_conversao_lead::date BETWEEN $1 AND $2
          OR b.dt_visita_realizada::date BETWEEN $1 AND $2
          OR pc.dt_ultimo_historico_data BETWEEN $1 AND $2
          OR b.data_venda::date BETWEEN $1 AND $2
          OR b.dt_cancelamento_reserva::date BETWEEN $1 AND $2
          OR d.referencia_data::date BETWEEN $1 AND $2
          OR b.dt_assinatura_contrato::date BETWEEN $1 AND $2
        )
        ${statusWhere}
      ORDER BY data_referencia DESC NULLS LAST, b.idlead DESC NULLS LAST
      LIMIT $${parameterIndex}
      OFFSET $${parameterIndex + 1}
    `;

    const queryParams = [start, end, ...params, limit, offset];
    const result = await pool.query(sql, queryParams);

    return res.json({
      page,
      limit,
      rows: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao buscar leads',
      details: error.message,
    });
  }
});

app.post('/api/v1/dashboard/refresh-data', async (_req, res) => {
  if (dataRefreshInProgress) return res.status(409).json({ error: 'Atualização em andamento' });
  dataRefreshInProgress = true;
  try {
    const result = await runDataUpdate();
    clearDashboardCache();
    return res.json({ message: 'Concluído', ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Falha' });
  } finally {
    dataRefreshInProgress = false;
  }
});

app.get('/api/v1/dashboard/funnel', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized, start: dateRange.start, end: dateRange.end };
  let client;

  try {
    client = await pool.connect();
    const stages = [];
    const warnings = [];

    for (const stage of FUNNEL_STAGES) {
      const query = await buildFunnelStageQuery(client, stage, filters, { countOnly: true });
      if (query.unavailable) {
        warnings.push({ stage: stage.label, message: query.reason });
        stages.push({
          ...stage,
          value: 0,
          detailCount: 0,
          conversionFromPrevious: null,
          conversionFromLead: null,
          sourceAvailable: false,
          source: stage.source,
          warning: query.reason,
        });
        continue;
      }

      const result = await client.query(query.sql, query.params);
      const value = Number(result.rows[0]?.value) || 0;
      stages.push({
        ...stage,
        value,
        detailCount: value,
        conversionFromPrevious: null,
        conversionFromLead: null,
        sourceAvailable: true,
        source: query.source,
        dateColumn: query.dateColumn,
        keyColumn: query.keyColumn,
      });
    }

    const leadValue = Number(stages[0]?.value) || 0;
    stages.forEach((stage, index) => {
      const previous = index > 0 ? Number(stages[index - 1]?.value) || 0 : null;
      stage.conversionFromPrevious = index > 0 && previous > 0
        ? Number(((stage.value / previous) * 100).toFixed(2))
        : null;
      stage.conversionFromLead = index > 0 && leadValue > 0
        ? Number(((stage.value / leadValue) * 100).toFixed(2))
        : (index === 0 ? 100 : null);
      stage.auditOk = stage.value === stage.detailCount;
    });

    return res.json({
      period: { startDate: dateRange.start, endDate: dateRange.end },
      stages,
      warnings,
      audit: {
        ok: stages.every((stage) => stage.auditOk),
        checkedAt: new Date().toISOString(),
      },
      meta: {
        source: 'runtime_sql',
        workflowFallback: warnings.length > 0 ? 'blocked' : 'none',
      },
    });
  } catch (err) {
    console.error('[funnel] postgres_error', { message: err?.message, code: err?.code, detail: err?.detail });
    return res.status(500).json({ error: 'Erro ao buscar funil', details: err?.message || 'Erro desconhecido no Postgres' });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/v1/dashboard/funnel/detail', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const stage = getFunnelStage(req.query.stage ?? req.query.etapa);
  if (!stage) {
    return res.status(400).json({ error: 'Etapa invalida.' });
  }

  const page = parsePositiveInt(req.query.page, 1, 100000);
  const limit = parsePositiveInt(req.query.limit, 50, 500);
  const sortBy = String(req.query.sortBy || 'data_evento');
  const sortDir = String(req.query.sortDir || 'desc');
  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized, start: dateRange.start, end: dateRange.end };
  let client;

  try {
    client = await pool.connect();
    const query = await buildFunnelStageQuery(client, stage, filters, {
      countOnly: false,
      detail: true,
      page,
      limit,
      sortBy,
      sortDir,
    });

    if (query.unavailable) {
      return res.status(200).json({
        stage: stage.label,
        rows: [],
        total: 0,
        page,
        limit,
        warning: query.reason,
      });
    }

    const result = await client.query(query.sql, query.params);
    const total = Number(result.rows[0]?.total_count) || 0;
    return res.json({
      stage: stage.label,
      rows: result.rows.map((row) => {
        const cleanRow = { ...row };
        delete cleanRow.total_count;
        return cleanRow;
      }),
      total,
      page,
      limit,
      source: query.source,
      dateColumn: query.dateColumn,
      keyColumn: query.keyColumn,
    });
  } catch (err) {
    console.error('[funnel/detail] postgres_error', { message: err?.message, code: err?.code, detail: err?.detail });
    return res.status(500).json({ error: 'Erro ao buscar detalhe do funil', details: err?.message || 'Erro desconhecido no Postgres' });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/v1/dashboard/funnel/goals', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const metaRepasse = Number(req.query.metaRepasse ?? req.query.repasseGoal ?? 45);
  if (!Number.isFinite(metaRepasse) || metaRepasse < 0) {
    return res.status(400).json({ error: 'metaRepasse invalida.' });
  }

  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized, start: dateRange.start, end: dateRange.end };
  let client;

  try {
    client = await pool.connect();
    const stages = [];
    const warnings = [];

    for (const stage of FUNNEL_STAGES) {
      const query = await buildFunnelStageQuery(client, stage, filters, { countOnly: true });
      if (query.unavailable) {
        warnings.push({ stage: stage.label, message: query.reason });
        stages.push({ ...stage, value: 0, sourceAvailable: false });
        continue;
      }
      const result = await client.query(query.sql, query.params);
      stages.push({ ...stage, value: Number(result.rows[0]?.value) || 0, sourceAvailable: true });
    }

    const repasseValue = Number(stages.find((stage) => stage.key === 'repasse')?.value) || 0;
    const today = getObservedReferenceDate(dateRange.end);
    const elapsedBusinessDays = Math.max(countBusinessDays(dateRange.start, today), 1);
    const totalBusinessDays = Math.max(countBusinessDays(dateRange.start, dateRange.end), elapsedBusinessDays);
    const remainingBusinessDays = Math.max(totalBusinessDays - elapsedBusinessDays, 0);

    const rows = stages.map((stage) => {
      const conversionToRepasse = stage.value > 0 ? repasseValue / stage.value : null;
      const dynamicGoal = stage.key === 'repasse'
        ? metaRepasse
        : (conversionToRepasse && conversionToRepasse > 0 ? metaRepasse / conversionToRepasse : null);
      const trend = elapsedBusinessDays > 0 ? (stage.value / elapsedBusinessDays) * totalBusinessDays : null;
      const gap = dynamicGoal == null ? null : dynamicGoal - stage.value;
      const dailyNeed = gap == null || remainingBusinessDays <= 0 ? null : gap / remainingBusinessDays;
      return {
        key: stage.key,
        label: stage.label,
        order: stage.order,
        actual: stage.value,
        conversionToRepasse: conversionToRepasse == null ? null : Number((conversionToRepasse * 100).toFixed(2)),
        dynamicGoal: dynamicGoal == null ? null : Number(dynamicGoal.toFixed(1)),
        attainment: dynamicGoal && dynamicGoal > 0 ? Number(((stage.value / dynamicGoal) * 100).toFixed(1)) : null,
        trend: trend == null ? null : Number(trend.toFixed(1)),
        gap: gap == null ? null : Number(gap.toFixed(1)),
        dailyNeed: dailyNeed == null ? null : Number(dailyNeed.toFixed(2)),
        sourceAvailable: stage.sourceAvailable,
      };
    });

    return res.json({
      period: { startDate: dateRange.start, endDate: dateRange.end, today },
      metaRepasse,
      businessDays: { elapsed: elapsedBusinessDays, total: totalBusinessDays, remaining: remainingBusinessDays },
      rows,
      warnings,
      meta: { source: 'funnel_runtime_conversion' },
    });
  } catch (err) {
    console.error('[funnel/goals] postgres_error', { message: err?.message, code: err?.code, detail: err?.detail });
    return res.status(500).json({ error: 'Erro ao buscar metas do funil', details: err?.message || 'Erro desconhecido no Postgres' });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/v1/dashboard/funnel/audit', async (req, res) => {
  const dateRange = getDateRange(req.query);
  if (dateRange.error) {
    return res.status(400).json({ error: dateRange.error });
  }

  const normalized = normalizeFiltersFromQuery(req.query);
  const filters = { ...normalized, start: dateRange.start, end: dateRange.end };
  let client;

  try {
    client = await pool.connect();
    const checks = [];

    for (const stage of FUNNEL_STAGES) {
      const visualQuery = await buildFunnelStageQuery(client, stage, filters, { countOnly: true });
      const detailQuery = await buildFunnelStageQuery(client, stage, filters, { countOnly: false, page: 1, limit: 1 });
      if (visualQuery.unavailable || detailQuery.unavailable) {
        checks.push({
          stage: stage.label,
          visual: 0,
          detail: 0,
          diff: 0,
          ok: false,
          warning: visualQuery.reason || detailQuery.reason,
        });
        continue;
      }

      const [visualResult, detailResult] = await Promise.all([
        client.query(visualQuery.sql, visualQuery.params),
        client.query(detailQuery.sql, detailQuery.params),
      ]);
      const visual = Number(visualResult.rows[0]?.value) || 0;
      const detail = Number(detailResult.rows[0]?.total_count) || 0;
      checks.push({
        stage: stage.label,
        visual,
        detail,
        diff: visual - detail,
        ok: visual === detail,
        source: visualQuery.source,
      });
    }

    return res.json({
      period: { startDate: dateRange.start, endDate: dateRange.end },
      ok: checks.every((check) => check.ok),
      checks,
    });
  } catch (err) {
    console.error('[funnel/audit] postgres_error', { message: err?.message, code: err?.code, detail: err?.detail });
    return res.status(500).json({ error: 'Erro ao auditar funil', details: err?.message || 'Erro desconhecido no Postgres' });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/v1/dashboard/goals', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT kpi_id, goal_value, unit, target_type, quality_style, updated_at
      FROM dashboard_goals
      ORDER BY kpi_id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar metas', err?.message);
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
});

app.put('/api/v1/dashboard/goals/:kpiId', async (req, res) => {
  const { kpiId } = req.params;
  const goalValue = Number(req.body?.goalValue);

  if (!kpiId) {
    return res.status(400).json({ error: 'kpiId é obrigatório' });
  }

  if (!Number.isFinite(goalValue) || goalValue < 0) {
    return res.status(400).json({ error: 'goalValue inválido' });
  }

  try {
    const existing = await pool.query('SELECT kpi_id, unit, target_type, quality_style FROM dashboard_goals WHERE kpi_id = $1', [kpiId]);
    const fallback = DEFAULT_GOALS.find((item) => item.kpi_id === kpiId) || {
      kpi_id: kpiId,
      unit: 'total',
      target_type: 'absolute',
      quality_style: false,
    };
    const current = existing.rows[0] || fallback;

    const result = await pool.query(`
      INSERT INTO dashboard_goals (kpi_id, goal_value, unit, target_type, quality_style, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (kpi_id)
      DO UPDATE SET
        goal_value = EXCLUDED.goal_value,
        unit = EXCLUDED.unit,
        target_type = EXCLUDED.target_type,
        quality_style = EXCLUDED.quality_style,
        updated_at = NOW()
      RETURNING kpi_id, goal_value, unit, target_type, quality_style, updated_at
    `, [
      kpiId,
      goalValue,
      current.unit,
      current.target_type,
      current.quality_style,
    ]);

    clearDashboardCache();

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar meta', err?.message);
    return res.status(500).json({ error: 'Erro ao salvar meta' });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`✅ Servidor rodando na porta ${process.env.PORT || 3001}`);
});
