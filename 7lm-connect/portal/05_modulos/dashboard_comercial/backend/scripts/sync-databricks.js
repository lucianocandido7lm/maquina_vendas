import { DBSQLClient } from '@databricks/sql';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DATABRICKS_CATALOG = process.env.DATABRICKS_CATALOG || 'data_platform_dev';
const DATABRICKS_SCHEMA = process.env.DATABRICKS_SCHEMA || 'gold_cvcrm';
const BASE_WINDOW_3Y_SQL = `
  COALESCE(dt_lead, dt_ultima_conversao_lead) >= current_date() - interval 3 years
  OR COALESCE(dt_visita, dt_visita_realizada) >= current_date() - interval 3 years
  OR dt_cadastro_reserva >= current_date() - interval 3 years
  OR dt_contrato_contabilizado >= current_date() - interval 3 years
  OR COALESCE(dt_repasse, dt_assinatura_contrato) >= current_date() - interval 3 years
  OR dt_cancelamento_reserva >= current_date() - interval 3 years
  OR data_venda >= current_date() - interval 3 years
`;

async function ensureComercialBaseColumns(client) {
  await client.query(`
    ALTER TABLE IF EXISTS comercial_base
      ADD COLUMN IF NOT EXISTS data_venda TIMESTAMP;
  `);
}

async function ensureSegmentacaoTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS comercial_indicador_segmentacao (
      indicador TEXT,
      data_evento DATE,
      mes_referencia DATE,
      entidade_id TEXT,
      valor_realizado NUMERIC,
      idcorretor_operacao BIGINT,
      corretor_operacao_nome TEXT,
      idimobiliaria_operacao BIGINT,
      imobiliaria_operacao_nome TEXT,
      regiao_operacao TEXT,
      idempreendimento_operacao BIGINT,
      empreendimento_operacao_nome TEXT,
      idunidade_operacao BIGINT,
      unidade_operacao_nome TEXT,
      sdr_operacao_nome TEXT,
      origem_operacao_nome TEXT,
      corretor_ativo_nome TEXT,
      gestor_corretor TEXT,
      coordenador_corretor TEXT,
      regiao_corretor TEXT,
      imobiliaria_corretor TEXT,
      fl_corretor_ativo_mes BOOLEAN,
      sdr_ativo_nome TEXT,
      gestor_sdr TEXT,
      coordenador_sdr TEXT,
      regiao_sdr TEXT,
      imobiliaria_sdr TEXT,
      fl_sdr_ativo_mes BOOLEAN,
      fl_indicador_sdr_aplicavel BOOLEAN
    );

    CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_data_indicador
      ON comercial_indicador_segmentacao (data_evento, indicador);
    CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_mes_indicador
      ON comercial_indicador_segmentacao (mes_referencia, indicador);
    CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_corretor_operacao
      ON comercial_indicador_segmentacao (idcorretor_operacao, mes_referencia);
    CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_corretor_ativo
      ON comercial_indicador_segmentacao (corretor_ativo_nome, mes_referencia);
    CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_sdr_ativo
      ON comercial_indicador_segmentacao (sdr_ativo_nome, mes_referencia)
      WHERE fl_indicador_sdr_aplicavel IS TRUE;

    CREATE TABLE IF NOT EXISTS dim_imobiliaria (
      dim_imobiliaria_key TEXT,
      idimobiliaria BIGINT PRIMARY KEY,
      nome_imobiliaria TEXT,
      dt_referencia_imobiliaria TIMESTAMP,
      gold_process_ts TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dim_imobiliaria_nome
      ON dim_imobiliaria (nome_imobiliaria);

    CREATE TABLE IF NOT EXISTS dim_sdr_imobiliaria (
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
      ON dim_sdr_imobiliaria (nome_imobiliaria);
  `);
}

async function ensureHierarchyTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hierarquia_cvcrm (
      documento TEXT,
      nome TEXT,
      gestor_documento TEXT,
      gestor_nome TEXT,
      coordenador_documento TEXT,
      coordenador_nome TEXT,
      imobiliaria_nome TEXT,
      imobiliaria_nome_dim TEXT,
      ativo_negocio TEXT,
      data_inicio_vigencia DATE,
      data_fim_vigencia DATE
    );

    ALTER TABLE IF EXISTS hierarquia_cvcrm
      ADD COLUMN IF NOT EXISTS mes_referencia DATE,
      ADD COLUMN IF NOT EXISTS email_norm TEXT,
      ADD COLUMN IF NOT EXISTS documento_norm TEXT,
      ADD COLUMN IF NOT EXISTS corretor_ativo_nome TEXT,
      ADD COLUMN IF NOT EXISTS gestor_corretor TEXT,
      ADD COLUMN IF NOT EXISTS coordenador_corretor TEXT,
      ADD COLUMN IF NOT EXISTS regiao_corretor TEXT,
      ADD COLUMN IF NOT EXISTS imobiliaria_corretor TEXT,
      ADD COLUMN IF NOT EXISTS corretor_hierarquia_key TEXT,
      ADD COLUMN IF NOT EXISTS corretor_ativo_mes_key TEXT,
      ADD COLUMN IF NOT EXISTS data_inicio_vigencia_data DATE,
      ADD COLUMN IF NOT EXISTS data_fim_vigencia_data DATE;

    CREATE INDEX IF NOT EXISTS idx_hierarquia_cvcrm_mes_documento
      ON hierarquia_cvcrm (mes_referencia, documento_norm);
    CREATE INDEX IF NOT EXISTS idx_hierarquia_cvcrm_mes_corretor
      ON hierarquia_cvcrm (mes_referencia, corretor_ativo_nome);

    CREATE TABLE IF NOT EXISTS hierarquia_sdr (
      nome TEXT,
      ativo_negocio TEXT,
      data_inicio_vigencia DATE,
      data_fim_vigencia DATE
    );

    ALTER TABLE IF EXISTS hierarquia_sdr
      ADD COLUMN IF NOT EXISTS mes_referencia DATE,
      ADD COLUMN IF NOT EXISTS email_norm TEXT,
      ADD COLUMN IF NOT EXISTS documento_norm TEXT,
      ADD COLUMN IF NOT EXISTS sdr_ativo_nome TEXT,
      ADD COLUMN IF NOT EXISTS gestor_sdr TEXT,
      ADD COLUMN IF NOT EXISTS coordenador_sdr TEXT,
      ADD COLUMN IF NOT EXISTS regiao_sdr TEXT,
      ADD COLUMN IF NOT EXISTS imobiliaria_sdr TEXT,
      ADD COLUMN IF NOT EXISTS sdr_hierarquia_key TEXT,
      ADD COLUMN IF NOT EXISTS sdr_ativo_mes_key TEXT,
      ADD COLUMN IF NOT EXISTS data_inicio_vigencia_data DATE,
      ADD COLUMN IF NOT EXISTS data_fim_vigencia_data DATE;

    CREATE INDEX IF NOT EXISTS idx_hierarquia_sdr_mes_sdr
      ON hierarquia_sdr (mes_referencia, sdr_ativo_nome);

    CREATE OR REPLACE VIEW public.vw_hierarquia_cvcrm AS
    SELECT
      documento::text AS documento,
      nome::text AS nome,
      gestor_documento::text AS gestor_documento,
      gestor_nome::text AS gestor_nome,
      coordenador_documento::text AS coordenador_documento,
      coordenador_nome::text AS coordenador_nome,
      imobiliaria_nome::text AS imobiliaria_nome,
      imobiliaria_nome_dim::text AS imobiliaria_nome_dim,
      ativo_negocio::text AS ativo_negocio,
      data_inicio_vigencia::date AS data_inicio_vigencia,
      data_fim_vigencia::date AS data_fim_vigencia,
      mes_referencia::date AS mes_referencia,
      email_norm::text AS email_norm,
      documento_norm::text AS documento_norm,
      COALESCE(corretor_ativo_nome, nome)::text AS corretor_ativo_nome,
      COALESCE(gestor_corretor, gestor_nome)::text AS gestor_corretor,
      COALESCE(coordenador_corretor, coordenador_nome)::text AS coordenador_corretor,
      regiao_corretor::text AS regiao_corretor,
      COALESCE(imobiliaria_corretor, imobiliaria_nome_dim, imobiliaria_nome)::text AS imobiliaria_corretor,
      corretor_hierarquia_key::text AS corretor_hierarquia_key,
      corretor_ativo_mes_key::text AS corretor_ativo_mes_key,
      COALESCE(data_inicio_vigencia_data, data_inicio_vigencia)::date AS data_inicio_vigencia_data,
      COALESCE(data_fim_vigencia_data, data_fim_vigencia)::date AS data_fim_vigencia_data
    FROM public.hierarquia_cvcrm;

    CREATE OR REPLACE VIEW public.vw_hierarquia_sdr AS
    SELECT
      nome::text AS nome,
      ativo_negocio::text AS ativo_negocio,
      data_inicio_vigencia::date AS data_inicio_vigencia,
      data_fim_vigencia::date AS data_fim_vigencia,
      mes_referencia::date AS mes_referencia,
      email_norm::text AS email_norm,
      documento_norm::text AS documento_norm,
      COALESCE(sdr_ativo_nome, nome)::text AS sdr_ativo_nome,
      gestor_sdr::text AS gestor_sdr,
      coordenador_sdr::text AS coordenador_sdr,
      regiao_sdr::text AS regiao_sdr,
      imobiliaria_sdr::text AS imobiliaria_sdr,
      sdr_hierarquia_key::text AS sdr_hierarquia_key,
      sdr_ativo_mes_key::text AS sdr_ativo_mes_key,
      COALESCE(data_inicio_vigencia_data, data_inicio_vigencia)::date AS data_inicio_vigencia_data,
      COALESCE(data_fim_vigencia_data, data_fim_vigencia)::date AS data_fim_vigencia_data
    FROM public.hierarquia_sdr;
  `);
}

async function ensureConsolidadaNaming(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.comercial_propostas_consolidada') AS consolidada,
      to_regclass('public.comercial_propostas_consolidado') AS consolidado,
      to_regclass('public.comercial_propostas_consolidada_staging') AS consolidada_staging,
      to_regclass('public.comercial_propostas_consolidado_staging') AS consolidado_staging
  `);

  const row = result.rows[0] || {};

  if (!row.consolidada && row.consolidado) {
    console.log('♻️ Renomeando tabela legado: comercial_propostas_consolidado -> comercial_propostas_consolidada');
    await client.query('ALTER TABLE comercial_propostas_consolidado RENAME TO comercial_propostas_consolidada');
  }

  if (!row.consolidada_staging && row.consolidado_staging) {
    console.log('♻️ Renomeando staging legado: comercial_propostas_consolidado_staging -> comercial_propostas_consolidada_staging');
    await client.query('ALTER TABLE comercial_propostas_consolidado_staging RENAME TO comercial_propostas_consolidada_staging');
  }
}

async function ensureConsolidadaColumns(client) {
  await client.query(`
    ALTER TABLE IF EXISTS comercial_propostas_consolidada
      ADD COLUMN IF NOT EXISTS dt_ultimo_historico TIMESTAMP,
      ADD COLUMN IF NOT EXISTS dt_ultimo_historico_data DATE,
      ADD COLUMN IF NOT EXISTS proposta_status_atual TEXT,
      ADD COLUMN IF NOT EXISTS proposta_status_consolidado_atual TEXT;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'dt_ultimo_status'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'dt_ultimo_historico'
      ) THEN
        ALTER TABLE comercial_propostas_consolidada RENAME COLUMN dt_ultimo_status TO dt_ultimo_historico;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'dt_ultimo_status_data'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'dt_ultimo_historico_data'
      ) THEN
        ALTER TABLE comercial_propostas_consolidada RENAME COLUMN dt_ultimo_status_data TO dt_ultimo_historico_data;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'proposta_status_consolidado'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'comercial_propostas_consolidada'
          AND column_name = 'proposta_status_consolidado_atual'
      ) THEN
        ALTER TABLE comercial_propostas_consolidada RENAME COLUMN proposta_status_consolidado TO proposta_status_consolidado_atual;
      END IF;
    END
    $$;
  `);
}

function toEpoch(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

function anchorPriority(anchorType) {
  if (anchorType === 'repasse') return 1;
  if (anchorType === 'reserva') return 2;
  if (anchorType === 'precadastro') return 3;
  if (anchorType === 'lead') return 4;
  return 9;
}

function dedupeBaseRows(rows) {
  const byTuple = new Map();

  for (const row of rows) {
    const key = row.idrepasse != null
      ? `repasse:${row.idrepasse}`
      : row.idreserva != null
        ? `reserva:${row.idreserva}`
        : row.idprecadastro != null
          ? `precadastro:${row.idprecadastro}`
          : row.idlead != null
            ? `lead:${row.idlead}`
            : `journey:${String(row.journey_id ?? '')}`;

    const current = byTuple.get(key);
    if (!current) {
      byTuple.set(key, row);
      continue;
    }

    const rowEntityRank = row.idrepasse != null ? 4 : row.idreserva != null ? 3 : row.idprecadastro != null ? 2 : row.idlead != null ? 1 : 0;
    const currentEntityRank = current.idrepasse != null ? 4 : current.idreserva != null ? 3 : current.idprecadastro != null ? 2 : current.idlead != null ? 1 : 0;

    if (rowEntityRank > currentEntityRank) {
      byTuple.set(key, row);
      continue;
    }
    if (rowEntityRank < currentEntityRank) {
      continue;
    }

    const rowRef = row.idrepasse != null
      ? Math.max(toEpoch(row.dt_referencia_repasse), toEpoch(row.dt_ultima_referencia))
      : row.idreserva != null
        ? Math.max(toEpoch(row.dt_referencia_reserva), toEpoch(row.dt_ultima_referencia))
        : row.idprecadastro != null
          ? Math.max(toEpoch(row.dt_referencia_precadastro), toEpoch(row.dt_ultima_referencia))
          : Math.max(toEpoch(row.dt_referencia_lead), toEpoch(row.dt_ultima_referencia));
    const currentRef = current.idrepasse != null
      ? Math.max(toEpoch(current.dt_referencia_repasse), toEpoch(current.dt_ultima_referencia))
      : current.idreserva != null
        ? Math.max(toEpoch(current.dt_referencia_reserva), toEpoch(current.dt_ultima_referencia))
        : current.idprecadastro != null
          ? Math.max(toEpoch(current.dt_referencia_precadastro), toEpoch(current.dt_ultima_referencia))
          : Math.max(toEpoch(current.dt_referencia_lead), toEpoch(current.dt_ultima_referencia));

    if (rowRef > currentRef) {
      byTuple.set(key, row);
      continue;
    }
    if (rowRef < currentRef) {
      continue;
    }

    const rowLastRef = toEpoch(row.dt_ultima_referencia);
    const currentLastRef = toEpoch(current.dt_ultima_referencia);
    if (rowLastRef > currentLastRef) {
      byTuple.set(key, row);
      continue;
    }
    if (rowLastRef < currentLastRef) {
      continue;
    }

    const rowAnchor = anchorPriority(row.journey_anchor_type);
    const currentAnchor = anchorPriority(current.journey_anchor_type);
    if (rowAnchor < currentAnchor) {
      byTuple.set(key, row);
      continue;
    }
    if (rowAnchor > currentAnchor) {
      continue;
    }

    const rowJourney = String(row.journey_id ?? '');
    const currentJourney = String(current.journey_id ?? '');
    if (rowJourney > currentJourney) {
      byTuple.set(key, row);
    }
  }

  return Array.from(byTuple.values());
}

async function syncDatabricksToPostgres(options = {}) {
  const promoteToFinalTables = options.promoteToFinalTables !== false;
  console.log("🚀 Iniciando Sincronização Databricks ➔ Postgres (REFACTOR GOLD) ...");

  const dbsql = new DBSQLClient();
  const databricksConfig = {
    token: process.env.DATABRICKS_TOKEN,
    host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST,
    path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH
  };

  const pgPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("🔗 Conectando ao Databricks...");
    const conn = await dbsql.connect(databricksConfig);
    const session = await conn.openSession();

    console.log("📥 Extraindo histórico completo do Databricks...");

    const executeView = async (query, label) => {
      try {
        const op = await session.executeStatement(query, { runAsync: true });
        const rows = await op.fetchAll();
        await op.close();
        console.log(`✅ ${label}: capturados ${rows.length} registros.`);
        return rows;
      } catch (error) {
        console.error(`❌ Erro ao buscar ${label}:`, error);
        throw error;
      }
    };

    // Pega tudo dos últimos 3 anos considerando TODAS as datas de KPI
    // (evita perder jornadas antigas com evento recente de venda/repasse/cancelamento)
    const baseRowsRaw = await executeView(`
      SELECT * FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base
      WHERE ${BASE_WINDOW_3Y_SQL}
    `, 'Base comercial (vw_bi_comercial_base)');
    const baseRows = dedupeBaseRows(baseRowsRaw);
    if (baseRows.length !== baseRowsRaw.length) {
      console.log(`♻️ Deduplicacao de jornada aplicada no sync: ${baseRowsRaw.length} -> ${baseRows.length}`);
    }

    const segmentacaoRows = await executeView(`
      SELECT *
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_indicador_segmentacao
      WHERE data_evento >= current_date() - interval 3 years
    `, 'Indicadores segmentados (vw_bi_comercial_indicador_segmentacao)');

    const propostasRows = await executeView(`
      SELECT
        p.historico_status_key,
        p.journey_id,
        p.journey_anchor_type,
        p.idlead,
        p.idprecadastro,
        p.idreserva,
        p.idrepasse,
        p.referencia_data,
        p.situacao_de,
        p.situacao_para,
        p.proposta_status_grupo,
        COALESCE(b.idcorretor_canonico, p.idcorretor_canonico) AS idcorretor_atual,
        COALESCE(b.idgestor_canonico, p.idgestor_canonico) AS idgestor,
        COALESCE(b.idimobiliaria_canonico, p.idimobiliaria_canonico) AS idimobiliaria,
        COALESCE(b.idempreendimento_canonico, p.idempreendimento_canonico) AS idempreendimento,
        COALESCE(b.idunidade_canonico, p.idunidade_canonico) AS idunidade
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_propostas_historico p
      LEFT JOIN ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base b ON (p.journey_id = b.journey_id)
      WHERE p.referencia_data >= current_date() - interval 3 years
    `, 'Propostas Histórico');

    const propostasConsolidadasRows = await executeView(`
      SELECT
        p.idprecadastro,
        p.journey_id,
        p.dt_ultimo_historico,
        p.dt_ultimo_historico_data,
        p.situacao_ultimo_status,
        p.proposta_status_atual,
        p.proposta_status_consolidado_atual,
        COALESCE(b.idcorretor_canonico, p.idcorretor_canonico) AS idcorretor_atual,
        COALESCE(b.idgestor_canonico, p.idgestor_canonico) AS idgestor,
        COALESCE(b.idimobiliaria_canonico, p.idimobiliaria_canonico) AS idimobiliaria,
        COALESCE(b.idempreendimento_canonico, p.idempreendimento_canonico) AS idempreendimento,
        COALESCE(b.idunidade_canonico, p.idunidade_canonico) AS idunidade
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_propostas_consolidada p
      LEFT JOIN ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base b ON (p.journey_id = b.journey_id)
      WHERE p.dt_ultimo_historico_data >= current_date() - interval 3 years
    `, 'Propostas Consolidadas');

    const cancelRows = await executeView(`
      SELECT
        c.journey_id,
        c.idlead,
        c.idprecadastro,
        c.idreserva,
        c.idrepasse,
        c.data_cancelamento,
        COALESCE(b.idcorretor_canonico, c.idcorretor_canonico) AS idcorretor_atual,
        COALESCE(b.idgestor_canonico, c.idgestor_canonico) AS idgestor,
        COALESCE(b.idimobiliaria_canonico, c.idimobiliaria_canonico) AS idimobiliaria,
        COALESCE(b.idempreendimento_canonico, c.idempreendimento_canonico) AS idempreendimento,
        COALESCE(b.idunidade_canonico, c.idunidade_canonico) AS idunidade,
        COALESCE(b.corretor_nome_canonico, b.corretor_nome) AS corretor_nome,
        b.gestor_nome,
        b.empreendimento_nome,
        b.regiao_empreendimento
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_cancelamentos c
      LEFT JOIN ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base b ON (c.journey_id = b.journey_id)
      WHERE c.data_cancelamento >= current_date() - interval 3 years
    `, 'Cancelamentos');

    const distratoRows = await executeView(`
      SELECT
        d.journey_id,
        d.idlead,
        d.idprecadastro,
        d.idreserva,
        d.idrepasse,
        d.referencia_data,
        d.situacao_de,
        d.situacao_para,
        COALESCE(b.idcorretor_canonico, d.idcorretor_canonico) AS idcorretor_atual,
        COALESCE(b.idgestor_canonico, d.idgestor_canonico) AS idgestor,
        COALESCE(b.idimobiliaria_canonico, d.idimobiliaria_canonico) AS idimobiliaria,
        COALESCE(b.idempreendimento_canonico, d.idempreendimento_canonico) AS idempreendimento,
        COALESCE(b.idunidade_canonico, d.idunidade_canonico) AS idunidade,
        COALESCE(b.corretor_nome_canonico, b.corretor_nome) AS corretor_nome,
        b.gestor_nome,
        b.empreendimento_nome,
        b.regiao_empreendimento
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_distratos d
      LEFT JOIN ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.vw_bi_comercial_base b ON (d.journey_id = b.journey_id)
      WHERE d.referencia_data >= current_date() - interval 3 years
    `, 'Distratos');

    const dimEmpreendimentoRows = await executeView(`
      SELECT * FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_empreendimento
    `, 'Dim Empreendimento');

    const dimImobiliariaRows = await executeView(`
      SELECT
        CAST(dim_imobiliaria_key AS STRING) AS dim_imobiliaria_key,
        CAST(idimobiliaria AS BIGINT) AS idimobiliaria,
        CAST(nome_imobiliaria AS STRING) AS nome_imobiliaria,
        CAST(dt_referencia_imobiliaria AS TIMESTAMP) AS dt_referencia_imobiliaria,
        CAST(gold_process_ts AS TIMESTAMP) AS gold_process_ts
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_imobiliaria
      WHERE idimobiliaria IS NOT NULL
    `, 'Dim Imobiliaria');

    const dimSdrImobiliariaRows = await executeView(`
      SELECT
        CAST(s.imobiliaria AS STRING) AS idimobiliaria_sdr,
        MAX(CAST(d.nome_imobiliaria AS STRING)) AS nome_imobiliaria,
        CAST(s.mes_referencia AS DATE) AS mes_referencia
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.sdr_ativos s
      LEFT JOIN ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.dim_imobiliaria d
        ON d.idimobiliaria = s.referencia
      WHERE s.imobiliaria IS NOT NULL
      GROUP BY CAST(s.imobiliaria AS STRING), CAST(s.mes_referencia AS DATE)
    `, 'Dim SDR Imobiliaria');

    const hierarquiaRows = await executeView(`
      SELECT DISTINCT
        CAST(documento AS STRING) AS documento,
        CAST(COALESCE(corretor_ativo_nome, nome) AS STRING) AS nome,
        CAST(gestor_documento AS STRING) AS gestor_documento,
        CAST(COALESCE(gestor_corretor, gestor) AS STRING) AS gestor_nome,
        CAST(coordenador_documento AS STRING) AS coordenador_documento,
        CAST(COALESCE(coordenador_corretor, coordenador) AS STRING) AS coordenador_nome,
        CAST(COALESCE(imobiliaria_corretor, imobiliaria) AS STRING) AS imobiliaria_nome,
        CAST(COALESCE(imobiliaria_corretor, imobiliaria) AS STRING) AS imobiliaria_nome_dim,
        CAST(ativo_negocio AS STRING) AS ativo_negocio,
        CAST(data_inicio_vigencia_data AS DATE) AS data_inicio_vigencia,
        CAST(data_fim_vigencia_data AS DATE) AS data_fim_vigencia,
        CAST(mes_referencia AS DATE) AS mes_referencia,
        CAST(email_norm AS STRING) AS email_norm,
        CAST(documento_norm AS STRING) AS documento_norm,
        CAST(COALESCE(corretor_ativo_nome, nome) AS STRING) AS corretor_ativo_nome,
        CAST(COALESCE(gestor_corretor, gestor) AS STRING) AS gestor_corretor,
        CAST(COALESCE(coordenador_corretor, coordenador) AS STRING) AS coordenador_corretor,
        CAST(regiao_corretor AS STRING) AS regiao_corretor,
        CAST(COALESCE(imobiliaria_corretor, imobiliaria) AS STRING) AS imobiliaria_corretor,
        CAST(corretor_hierarquia_key AS STRING) AS corretor_hierarquia_key,
        CAST(corretor_ativo_mes_key AS STRING) AS corretor_ativo_mes_key,
        CAST(data_inicio_vigencia_data AS DATE) AS data_inicio_vigencia_data,
        CAST(data_fim_vigencia_data AS DATE) AS data_fim_vigencia_data
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.corretores_ativos
      WHERE documento IS NOT NULL OR corretor_ativo_nome IS NOT NULL OR nome IS NOT NULL
    `, 'Hierarquia Corretores');

    const hierarquiaSdrRows = await executeView(`
      SELECT DISTINCT
        CAST(COALESCE(sdr_ativo_nome, sdr) AS STRING) AS nome,
        CAST(ativo_negocio AS STRING) AS ativo_negocio,
        CAST(data_inicio_vigencia_data AS DATE) AS data_inicio_vigencia,
        CAST(data_fim_vigencia_data AS DATE) AS data_fim_vigencia,
        CAST(mes_referencia AS DATE) AS mes_referencia,
        CAST(email_norm AS STRING) AS email_norm,
        CAST(documento_norm AS STRING) AS documento_norm,
        CAST(COALESCE(sdr_ativo_nome, sdr) AS STRING) AS sdr_ativo_nome,
        CAST(gestor_sdr AS STRING) AS gestor_sdr,
        CAST(coordenador_sdr AS STRING) AS coordenador_sdr,
        CAST(regiao_sdr AS STRING) AS regiao_sdr,
        CAST(imobiliaria_sdr AS STRING) AS imobiliaria_sdr,
        CAST(sdr_hierarquia_key AS STRING) AS sdr_hierarquia_key,
        CAST(sdr_ativo_mes_key AS STRING) AS sdr_ativo_mes_key,
        CAST(data_inicio_vigencia_data AS DATE) AS data_inicio_vigencia_data,
        CAST(data_fim_vigencia_data AS DATE) AS data_fim_vigencia_data
      FROM ${DATABRICKS_CATALOG}.${DATABRICKS_SCHEMA}.sdr_ativos
      WHERE sdr IS NOT NULL OR sdr_ativo_nome IS NOT NULL
    `, 'Hierarquia SDRs');

    await session.close();
    await conn.close();

    console.log("📤 Preparando carga segura no Postgres (STAGING)...");
    const client = await pgPool.connect();

    try {
      await ensureConsolidadaNaming(client);
      await ensureConsolidadaColumns(client);
      await ensureComercialBaseColumns(client);
      await ensureSegmentacaoTables(client);
      await ensureHierarchyTables(client);

      await client.query('BEGIN');

      // Ensure staging tables exist and are empty
      await client.query(`
        DROP TABLE IF EXISTS comercial_base_staging;
        DROP TABLE IF EXISTS comercial_indicador_segmentacao_staging;
        DROP TABLE IF EXISTS comercial_propostas_historico_staging;
        DROP TABLE IF EXISTS comercial_propostas_consolidada_staging;
        DROP TABLE IF EXISTS comercial_cancelamentos_staging;
        DROP TABLE IF EXISTS comercial_distratos_staging;
        DROP TABLE IF EXISTS dim_empreendimento_staging;
        DROP TABLE IF EXISTS dim_imobiliaria_staging;
        DROP TABLE IF EXISTS dim_sdr_imobiliaria_staging;

        CREATE TABLE comercial_base_staging (LIKE comercial_base INCLUDING ALL);
        CREATE TABLE comercial_indicador_segmentacao_staging (LIKE comercial_indicador_segmentacao INCLUDING ALL);
        CREATE TABLE comercial_propostas_historico_staging (LIKE comercial_propostas_historico INCLUDING ALL);
        CREATE TABLE comercial_propostas_consolidada_staging (LIKE comercial_propostas_consolidada INCLUDING ALL);
        CREATE TABLE comercial_cancelamentos_staging (LIKE comercial_cancelamentos INCLUDING ALL);
        CREATE TABLE comercial_distratos_staging (LIKE comercial_distratos INCLUDING ALL);
        CREATE TABLE dim_empreendimento_staging (LIKE dim_empreendimento INCLUDING ALL);
        CREATE TABLE dim_imobiliaria_staging (LIKE dim_imobiliaria INCLUDING ALL);
        CREATE TABLE dim_sdr_imobiliaria_staging (LIKE dim_sdr_imobiliaria INCLUDING ALL);
      `);

      await client.query('TRUNCATE hierarquia_cvcrm;');
      await client.query('TRUNCATE hierarquia_sdr;');

      // 1. INSERTS NA COMERCIAL_BASE_STAGING
      for (const row of baseRows) {
        const baseValues = [
          row.fato_jornada_comercial_key, row.journey_id, row.journey_key, row.journey_anchor_type,
          row.idlead, row.idprecadastro, row.idreserva, row.idrepasse,
          row.idcorretor_canonico ?? row.idcorretor_atual,
          row.idgestor_canonico ?? row.idgestor,
          row.idimobiliaria_canonico ?? row.idimobiliaria,
          row.idempreendimento_canonico ?? row.idempreendimento,
          row.idunidade_canonico ?? row.idunidade,
          row.lead_situacao_nome,
          row.precadastro_situacao_nome, row.reserva_situacao_nome, row.repasse_situacao_nome,
          row.dt_lead ?? row.dt_ultima_conversao_lead,
          row.dt_visita ?? row.dt_visita_realizada,
          row.dt_resposta_analise_precadastro,
          row.dt_cadastro_reserva, row.dt_cancelamento_reserva, row.dt_contrato_contabilizado,
          row.data_venda,
          row.dt_repasse ?? row.dt_assinatura_contrato,
          row.sla_finalizacao_dias,
          row.sla_repasse_dias, Boolean(row.fl_tem_resposta_analise_precadastro), Boolean(row.fl_cancelada),
          Boolean(row.fl_venda_finalizada), Boolean(row.fl_repasse_assinado),
          row.corretor_nome_canonico ?? row.corretor_nome,
          row.gestor_nome,
          row.imobiliaria_nome_canonica ?? row.imobiliaria_nome,
          row.imobiliaria_nome_dim,
          row.lead_cidade, row.lead_estado,
          row.lead_regiao, row.lead_origem_nome, row.sdr_nome, row.empreendimento_nome, row.regiao_empreendimento,
          row.unidade_nome_canonica ?? row.unidade_nome,
          row.bloco, row.etapa,
          row.fonte_cliente_nome,
          row.cliente_documento,
          row.cliente_email,
          row.fonte_lead_cidade,
          row.fonte_lead_estado,
          row.idempreendimento_canonico,
          row.fonte_idempreendimento_canonico,
          row.idunidade_canonico,
          row.fonte_idunidade_canonico,
          row.idcliente_canonico,
          row.fonte_idcliente_canonico,
          row.idcontrato_canonico,
          row.fonte_idcontrato_canonico,
          row.idmidia_canonico,
          row.fonte_idmidia_canonico,
          row.idtime_canonico,
          row.fonte_idtime_canonico,
          row.idgestor_time_canonico,
          row.fonte_idgestor_time_canonico,
          row.idcorretor_canonico,
          row.fonte_idcorretor_canonico,
          row.idgestor_canonico,
          row.fonte_idgestor_canonico,
          row.idimobiliaria_canonico,
          row.fonte_idimobiliaria_canonico,
          row.idsituacao_canonica,
          row.fonte_idsituacao_canonica,
          row.idsituacao_anterior_canonica,
          row.fonte_idsituacao_anterior_canonica,
          row.situacao_nome_canonica,
          row.fonte_situacao_nome_canonica,
          row.unidade_nome_canonica,
          row.fonte_unidade_nome_canonica,
          row.corretor_nome_canonico,
          row.fonte_corretor_nome_canonico,
          row.imobiliaria_nome_canonica,
          row.fonte_imobiliaria_nome_canonica,
          row.dt_cadastro_canonico,
          row.fonte_dt_cadastro_canonico,
          row.dt_cadastro_canonico_data,
          row.fonte_dt_cadastro_canonico_data,
          row.etapa_base_canonica,
          row.lead_idempreendimento,
          row.precadastro_idempreendimento,
          row.precadastro_idunidade,
          row.empreendimento_nome_lead,
          row.regiao_empreendimento_lead,
          row.empreendimento_nome_precadastro,
          row.regiao_empreendimento_precadastro,
          row.empreendimento_nome_reserva,
          row.regiao_empreendimento_reserva,
          row.empreendimento_nome_repasse,
          row.regiao_empreendimento_repasse,
          row.fonte_empreendimento_nome,
          row.fonte_regiao_empreendimento,
          row.nome_empreendimento_reduzido,
          row.fonte_nome_empreendimento_reduzido,
        ];

        await client.query(`
          INSERT INTO comercial_base_staging (
              fato_jornada_comercial_key, journey_id, journey_key, journey_anchor_type, 
              idlead, idprecadastro, idreserva, idrepasse, idcorretor_atual, idgestor, 
              idimobiliaria, idempreendimento, idunidade, lead_situacao_nome, 
              precadastro_situacao_nome, reserva_situacao_nome, repasse_situacao_nome, 
              dt_ultima_conversao_lead, dt_visita_realizada, dt_resposta_analise_precadastro, 
              dt_cadastro_reserva, dt_cancelamento_reserva, dt_contrato_contabilizado,
              data_venda, dt_assinatura_contrato, sla_finalizacao_dias,
              sla_repasse_dias, fl_tem_resposta_analise_precadastro, fl_cancelada, 
              fl_venda_finalizada, fl_repasse_assinado, corretor_nome, gestor_nome, 
              imobiliaria_nome, imobiliaria_nome_dim, lead_cidade, lead_estado, 
              lead_regiao, lead_origem_nome, sdr_nome, empreendimento_nome, regiao_empreendimento, 
              unidade_nome, bloco, etapa,
              fonte_cliente_nome, cliente_documento, cliente_email,
              fonte_lead_cidade, fonte_lead_estado,
              idempreendimento_canonico, fonte_idempreendimento_canonico,
              idunidade_canonico, fonte_idunidade_canonico,
              idcliente_canonico, fonte_idcliente_canonico,
              idcontrato_canonico, fonte_idcontrato_canonico,
              idmidia_canonico, fonte_idmidia_canonico,
              idtime_canonico, fonte_idtime_canonico,
              idgestor_time_canonico, fonte_idgestor_time_canonico,
              idcorretor_canonico, fonte_idcorretor_canonico,
              idgestor_canonico, fonte_idgestor_canonico,
              idimobiliaria_canonico, fonte_idimobiliaria_canonico,
              idsituacao_canonica, fonte_idsituacao_canonica,
              idsituacao_anterior_canonica, fonte_idsituacao_anterior_canonica,
              situacao_nome_canonica, fonte_situacao_nome_canonica,
              unidade_nome_canonica, fonte_unidade_nome_canonica,
              corretor_nome_canonico, fonte_corretor_nome_canonico,
              imobiliaria_nome_canonica, fonte_imobiliaria_nome_canonica,
              dt_cadastro_canonico, fonte_dt_cadastro_canonico,
              dt_cadastro_canonico_data, fonte_dt_cadastro_canonico_data,
              etapa_base_canonica,
              lead_idempreendimento, precadastro_idempreendimento, precadastro_idunidade,
              empreendimento_nome_lead, regiao_empreendimento_lead,
              empreendimento_nome_precadastro, regiao_empreendimento_precadastro,
              empreendimento_nome_reserva, regiao_empreendimento_reserva,
              empreendimento_nome_repasse, regiao_empreendimento_repasse,
              fonte_empreendimento_nome,
              fonte_regiao_empreendimento,
              nome_empreendimento_reduzido, fonte_nome_empreendimento_reduzido
          ) VALUES (${baseValues.map((_, i) => `$${i + 1}`).join(', ')})
        `, baseValues);
      }

      // 1.1. INSERTS INDICADORES SEGMENTADOS -> staging
      for (const row of segmentacaoRows) {
        const segmentacaoValues = [
          row.indicador,
          row.data_evento,
          row.mes_referencia,
          row.entidade_id,
          row.valor_realizado,
          row.idcorretor_operacao,
          row.corretor_operacao_nome,
          row.idimobiliaria_operacao,
          row.imobiliaria_operacao_nome,
          row.regiao_operacao,
          row.idempreendimento_operacao,
          row.empreendimento_operacao_nome,
          row.idunidade_operacao,
          row.unidade_operacao_nome,
          row.sdr_operacao_nome,
          row.origem_operacao_nome,
          row.corretor_ativo_nome,
          row.gestor_corretor,
          row.coordenador_corretor,
          row.regiao_corretor,
          row.imobiliaria_corretor,
          row.fl_corretor_ativo_mes,
          row.sdr_ativo_nome,
          row.gestor_sdr,
          row.coordenador_sdr,
          row.regiao_sdr,
          row.imobiliaria_sdr,
          row.fl_sdr_ativo_mes,
          row.fl_indicador_sdr_aplicavel,
        ];

        await client.query(`
          INSERT INTO comercial_indicador_segmentacao_staging (
            indicador, data_evento, mes_referencia, entidade_id, valor_realizado,
            idcorretor_operacao, corretor_operacao_nome,
            idimobiliaria_operacao, imobiliaria_operacao_nome, regiao_operacao,
            idempreendimento_operacao, empreendimento_operacao_nome,
            idunidade_operacao, unidade_operacao_nome,
            sdr_operacao_nome, origem_operacao_nome,
            corretor_ativo_nome, gestor_corretor, coordenador_corretor,
            regiao_corretor, imobiliaria_corretor, fl_corretor_ativo_mes,
            sdr_ativo_nome, gestor_sdr, coordenador_sdr, regiao_sdr,
            imobiliaria_sdr, fl_sdr_ativo_mes, fl_indicador_sdr_aplicavel
          ) VALUES (${segmentacaoValues.map((_, i) => `$${i + 1}`).join(', ')})
        `, segmentacaoValues);
      }

      // 2. INSERTS PROPOSTAS -> staging
      for (const row of propostasRows) {
        await client.query(`
          INSERT INTO comercial_propostas_historico_staging (
            historico_status_key, journey_id, journey_anchor_type, idlead, idprecadastro,
            idreserva, idrepasse, referencia_data, situacao_de, situacao_para, proposta_status_grupo,
            idcorretor_atual, idgestor, idimobiliaria, idempreendimento, idunidade
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [
          row.historico_status_key, row.journey_id, row.journey_anchor_type, row.idlead, row.idprecadastro,
          row.idreserva, row.idrepasse, row.referencia_data, row.situacao_de, row.situacao_para, 
          row.proposta_status_grupo,
          row.idcorretor_canonico ?? row.idcorretor_atual,
          row.idgestor_canonico ?? row.idgestor,
          row.idimobiliaria_canonico ?? row.idimobiliaria,
          row.idempreendimento_canonico ?? row.idempreendimento,
          row.idunidade_canonico ?? row.idunidade
        ]);
      }

      // 2.1. INSERTS PROPOSTAS CONSOLIDADAS -> staging
      for (const row of propostasConsolidadasRows) {
        await client.query(`
          INSERT INTO comercial_propostas_consolidada_staging (
            idprecadastro, journey_id, dt_ultimo_historico,
            dt_ultimo_historico_data, situacao_ultimo_status, proposta_status_atual,
            proposta_status_consolidado_atual, idcorretor_atual, idgestor, idimobiliaria,
            idempreendimento, idunidade
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          row.idprecadastro,
          row.journey_id,
          row.dt_ultimo_historico,
          row.dt_ultimo_historico_data,
          row.situacao_ultimo_status,
          row.proposta_status_atual,
          row.proposta_status_consolidado_atual,
          row.idcorretor_canonico ?? row.idcorretor_atual,
          row.idgestor_canonico ?? row.idgestor,
          row.idimobiliaria_canonico ?? row.idimobiliaria,
          row.idempreendimento_canonico ?? row.idempreendimento,
          row.idunidade_canonico ?? row.idunidade
        ]);
      }

      // 3. INSERTS CANCELAMENTOS -> staging
      for (const row of cancelRows) {
         await client.query(`
          INSERT INTO comercial_cancelamentos_staging (
            journey_id, idlead, idprecadastro, idreserva, idrepasse, data_cancelamento,
            idcorretor_atual, idgestor, idimobiliaria, idempreendimento, idunidade,
            corretor_nome, gestor_nome, empreendimento_nome, regiao_empreendimento
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          row.journey_id, row.idlead, row.idprecadastro, row.idreserva, row.idrepasse, row.data_cancelamento,
          row.idcorretor_canonico ?? row.idcorretor_atual,
          row.idgestor_canonico ?? row.idgestor,
          row.idimobiliaria_canonico ?? row.idimobiliaria,
          row.idempreendimento_canonico ?? row.idempreendimento,
          row.idunidade_canonico ?? row.idunidade,
          row.corretor_nome, row.gestor_nome, row.empreendimento_nome, row.regiao_empreendimento
        ]);
      }

      // 4. INSERTS DISTRATOS -> staging
      for (const row of distratoRows) {
         await client.query(`
           INSERT INTO comercial_distratos_staging (
            journey_id, idlead, idprecadastro, idreserva, idrepasse, referencia_data,
            situacao_de, situacao_para, idcorretor_atual, idgestor, idimobiliaria, idempreendimento, idunidade,
            corretor_nome, gestor_nome, empreendimento_nome, regiao_empreendimento
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [
          row.journey_id, row.idlead, row.idprecadastro, row.idreserva, row.idrepasse, row.referencia_data,
          row.situacao_de, row.situacao_para,
          row.idcorretor_canonico ?? row.idcorretor_atual,
          row.idgestor_canonico ?? row.idgestor,
          row.idimobiliaria_canonico ?? row.idimobiliaria,
          row.idempreendimento_canonico ?? row.idempreendimento,
          row.idunidade_canonico ?? row.idunidade,
          row.corretor_nome, row.gestor_nome, row.empreendimento_nome, row.regiao_empreendimento
        ]);
      }

      // 5. INSERTS HIERARQUIA
      for (const row of hierarquiaRows) {
        await client.query(`
          INSERT INTO hierarquia_cvcrm (
            documento, nome, gestor_documento, gestor_nome, coordenador_documento, coordenador_nome,
            imobiliaria_nome, imobiliaria_nome_dim, ativo_negocio, data_inicio_vigencia, data_fim_vigencia,
            mes_referencia, email_norm, documento_norm, corretor_ativo_nome, gestor_corretor,
            coordenador_corretor, regiao_corretor, imobiliaria_corretor, corretor_hierarquia_key,
            corretor_ativo_mes_key, data_inicio_vigencia_data, data_fim_vigencia_data
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        `, [
          row.documento,
          row.nome,
          row.gestor_documento,
          row.gestor_nome,
          row.coordenador_documento,
          row.coordenador_nome,
          row.imobiliaria_nome,
          row.imobiliaria_nome_dim,
          row.ativo_negocio,
          row.data_inicio_vigencia,
          row.data_fim_vigencia,
          row.mes_referencia,
          row.email_norm,
          row.documento_norm,
          row.corretor_ativo_nome,
          row.gestor_corretor,
          row.coordenador_corretor,
          row.regiao_corretor,
          row.imobiliaria_corretor,
          row.corretor_hierarquia_key,
          row.corretor_ativo_mes_key,
          row.data_inicio_vigencia_data,
          row.data_fim_vigencia_data,
        ]);
      }

      // 5.1. INSERTS HIERARQUIA SDR
      for (const row of hierarquiaSdrRows) {
        await client.query(`
          INSERT INTO hierarquia_sdr (
            nome, ativo_negocio, data_inicio_vigencia, data_fim_vigencia,
            mes_referencia, email_norm, documento_norm, sdr_ativo_nome, gestor_sdr,
            coordenador_sdr, regiao_sdr, imobiliaria_sdr, sdr_hierarquia_key,
            sdr_ativo_mes_key, data_inicio_vigencia_data, data_fim_vigencia_data
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [
          row.nome,
          row.ativo_negocio,
          row.data_inicio_vigencia,
          row.data_fim_vigencia,
          row.mes_referencia,
          row.email_norm,
          row.documento_norm,
          row.sdr_ativo_nome,
          row.gestor_sdr,
          row.coordenador_sdr,
          row.regiao_sdr,
          row.imobiliaria_sdr,
          row.sdr_hierarquia_key,
          row.sdr_ativo_mes_key,
          row.data_inicio_vigencia_data,
          row.data_fim_vigencia_data
        ]);
      }

      // 6. INSERTS DIM_EMPREENDIMENTO
      for (const row of dimEmpreendimentoRows) {
        await client.query(`
          INSERT INTO dim_empreendimento_staging (
            dim_empreendimento_key, idempreendimento, idunidade_origem, idtipo_empreendimento,
            tipo_empreendimento, empreendimento, empreendimento_reduzido, cidade, regiao,
            qt_unidades_empreendimento, dt_entrega_empreendimento, dt_referencia_empreendimento,
            dt_ultima_referencia_empreendimento, dt_ultima_ingestao_empreendimento, gold_process_ts
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          row.dim_empreendimento_key,
          row.idempreendimento,
          row.idunidade_origem,
          row.idtipo_empreendimento,
          row.tipo_empreendimento,
          row.empreendimento,
          row.empreendimento_reduzido,
          row.cidade,
          row.regiao,
          row.qt_unidades_empreendimento,
          row.dt_entrega_empreendimento,
          row.dt_referencia_empreendimento,
          row.dt_ultima_referencia_empreendimento,
          row.dt_ultima_ingestao_empreendimento,
          row.gold_process_ts,
        ]);
      }

      // 6.1 INSERTS DIM_IMOBILIARIA
      for (const row of dimImobiliariaRows) {
        await client.query(`
          INSERT INTO dim_imobiliaria_staging (
            dim_imobiliaria_key, idimobiliaria, nome_imobiliaria,
            dt_referencia_imobiliaria, gold_process_ts
          ) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (idimobiliaria) DO UPDATE SET
            dim_imobiliaria_key = EXCLUDED.dim_imobiliaria_key,
            nome_imobiliaria = EXCLUDED.nome_imobiliaria,
            dt_referencia_imobiliaria = EXCLUDED.dt_referencia_imobiliaria,
            gold_process_ts = EXCLUDED.gold_process_ts
        `, [
          row.dim_imobiliaria_key,
          row.idimobiliaria,
          row.nome_imobiliaria,
          row.dt_referencia_imobiliaria,
          row.gold_process_ts,
        ]);
      }

      // 6.2 INSERTS DIM_SDR_IMOBILIARIA
      for (const row of dimSdrImobiliariaRows) {
        await client.query(`
          INSERT INTO dim_sdr_imobiliaria_staging (
            idimobiliaria_sdr, nome_imobiliaria, mes_referencia
          ) VALUES ($1,$2,$3)
          ON CONFLICT (idimobiliaria_sdr, mes_referencia) DO UPDATE SET
            nome_imobiliaria = EXCLUDED.nome_imobiliaria,
            mes_referencia = EXCLUDED.mes_referencia
        `, [
          row.idimobiliaria_sdr,
          row.nome_imobiliaria,
          row.mes_referencia,
        ]);
      }

      if (promoteToFinalTables) {
        // 7. PROMOCAO STAGING -> TABELAS FINAIS
        // A API e as validacoes leem das tabelas finais; sem esta etapa os dados
        // ficam apenas em staging e o backend retorna zero apos truncate.
        await client.query(`
          INSERT INTO comercial_base SELECT * FROM comercial_base_staging;
          INSERT INTO comercial_indicador_segmentacao SELECT * FROM comercial_indicador_segmentacao_staging;
          INSERT INTO comercial_propostas_historico SELECT * FROM comercial_propostas_historico_staging;
          INSERT INTO comercial_propostas_consolidada SELECT * FROM comercial_propostas_consolidada_staging;
          INSERT INTO comercial_cancelamentos SELECT * FROM comercial_cancelamentos_staging;
          INSERT INTO comercial_distratos SELECT * FROM comercial_distratos_staging;
          INSERT INTO dim_empreendimento SELECT * FROM dim_empreendimento_staging;
          INSERT INTO dim_imobiliaria SELECT * FROM dim_imobiliaria_staging;
          INSERT INTO dim_sdr_imobiliaria SELECT * FROM dim_sdr_imobiliaria_staging;
        `);
      } else {
        console.log('⏭️ Promocao staging -> finais ignorada (pipeline usa swap-staging).');
      }

      await client.query('COMMIT');
      console.log("✅ Carga STAGING concluída no Postgres.");
    } catch (e) {
      await client.query('ROLLBACK');
      console.error("❌ Erro ao carregar staging:", e);
      throw e;
    } finally {
      client.release();
    }

    console.log("🏁 Sincronização Databricks -> Postgres concluída com sucesso!");
    return {
      comercial_base: baseRows.length,
      comercial_indicador_segmentacao: segmentacaoRows.length,
      propostas: propostasRows.length,
      cancelamentos: cancelRows.length,
      distratos: distratoRows.length,
      hierarquia: hierarquiaRows.length,
      hierarquia_sdr: hierarquiaSdrRows.length,
      dim_empreendimento: dimEmpreendimentoRows.length,
    };
  } catch (error) {
    console.error("❌ Falha Global:", error);
    throw error;
  } finally {
    await pgPool.end();
  }
}

export { syncDatabricksToPostgres };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDatabricksToPostgres().catch(() => {
    process.exitCode = 1;
  });
}
