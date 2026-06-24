BEGIN;

CREATE SCHEMA IF NOT EXISTS connect_comercial;

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_gc_produtividade_kpi_daily (
  data date NOT NULL,
  cidade text,
  origem text,
  empreendimento text,
  empreendimento_reduzido text,
  sdr text,
  corretor text,
  gerencia text,
  coordenacao text,
  imobiliaria text,
  leads integer NOT NULL DEFAULT 0,
  visitas integer NOT NULL DEFAULT 0,
  vendas integer NOT NULL DEFAULT 0,
  repasses integer NOT NULL DEFAULT 0,
  sla_finalizacao_sum numeric,
  sla_finalizacao_count integer NOT NULL DEFAULT 0,
  sla_repasse_sum numeric,
  sla_repasse_count integer NOT NULL DEFAULT 0,
  propostas_aprovadas integer NOT NULL DEFAULT 0,
  propostas_condicionadas integer NOT NULL DEFAULT 0,
  propostas_reprovadas integer NOT NULL DEFAULT 0,
  propostas_total integer NOT NULL DEFAULT 0,
  cancelamentos integer NOT NULL DEFAULT 0,
  distratos integer NOT NULL DEFAULT 0,
  data_hora_sync timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_kpi_data
  ON connect_comercial.dashboard_gc_produtividade_kpi_daily (data DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_kpi_lideranca
  ON connect_comercial.dashboard_gc_produtividade_kpi_daily (coordenacao, gerencia, imobiliaria, corretor);

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_gc_produtividade_hierarquia (
  coordenador_documento text,
  coordenador_nome text,
  mes_referencia date NOT NULL,
  corretor_ativo_nome text,
  gestor_corretor text,
  coordenador_corretor text,
  regiao_corretor text,
  imobiliaria_corretor text,
  corretor_hierarquia_key text,
  corretor_ativo_mes_key text,
  coordenador_email text,
  tipo_corretor text,
  gerente_documento text,
  gerente_email text,
  gerente_nome text,
  ativo_negocio text,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  data_inicio_vigencia_data date,
  data_fim_vigencia_data date,
  ativo text,
  ativo_login text,
  referencia text,
  dt_admissao date,
  dt_demissao date,
  data_hora_sync timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE connect_comercial.dashboard_gc_produtividade_hierarquia
  ADD COLUMN IF NOT EXISTS ativo_negocio text,
  ADD COLUMN IF NOT EXISTS data_inicio_vigencia date,
  ADD COLUMN IF NOT EXISTS data_fim_vigencia date,
  ADD COLUMN IF NOT EXISTS data_inicio_vigencia_data date,
  ADD COLUMN IF NOT EXISTS data_fim_vigencia_data date,
  ADD COLUMN IF NOT EXISTS ativo text,
  ADD COLUMN IF NOT EXISTS ativo_login text,
  ADD COLUMN IF NOT EXISTS referencia text,
  ADD COLUMN IF NOT EXISTS dt_admissao date,
  ADD COLUMN IF NOT EXISTS dt_demissao date;

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_hier_mes
  ON connect_comercial.dashboard_gc_produtividade_hierarquia (mes_referencia DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_hier_lideranca
  ON connect_comercial.dashboard_gc_produtividade_hierarquia (coordenador_nome, gerente_nome, imobiliaria_corretor, corretor_ativo_nome);

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_gc_produtividade_sync_log (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz,
  status text NOT NULL,
  source_schema text NOT NULL DEFAULT 'public',
  target_schema text NOT NULL DEFAULT 'connect_comercial',
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds numeric(12,3),
  message text
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_sync_log_status
  ON connect_comercial.dashboard_gc_produtividade_sync_log (started_at DESC, status);

COMMIT;
