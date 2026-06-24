CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_forecast_manual (
  identificador_forecast uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia smallint NOT NULL,
  ano_referencia smallint NOT NULL,
  chave_gestor text NOT NULL,
  gestor text NOT NULL,
  equipes text[] NOT NULL DEFAULT '{}'::text[],
  equipe_resumo text,
  forecast integer NOT NULL,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dashboard_gc_forecast_mes CHECK (mes_referencia BETWEEN 1 AND 12),
  CONSTRAINT ck_dashboard_gc_forecast_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
  CONSTRAINT ck_dashboard_gc_forecast_valor CHECK (forecast >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dashboard_gc_forecast_manual_vigente
  ON sevenlm_connect.dashboard_gc_forecast_manual (ano_referencia, mes_referencia, chave_gestor)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_forecast_manual_periodo
  ON sevenlm_connect.dashboard_gc_forecast_manual (ano_referencia, mes_referencia, gestor)
  WHERE ativo = true;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_forecast_manual_historico (
  identificador_historico uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_forecast uuid REFERENCES sevenlm_connect.dashboard_gc_forecast_manual(identificador_forecast) ON DELETE CASCADE,
  acao text NOT NULL,
  mes_referencia smallint NOT NULL,
  ano_referencia smallint NOT NULL,
  chave_gestor text NOT NULL,
  gestor text NOT NULL,
  equipes text[] NOT NULL DEFAULT '{}'::text[],
  equipe_resumo text,
  forecast_anterior integer,
  forecast_novo integer NOT NULL,
  observacao text,
  usuario_responsavel uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_evento timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dashboard_gc_forecast_hist_acao CHECK (acao IN ('CRIACAO', 'ALTERACAO', 'INATIVACAO')),
  CONSTRAINT ck_dashboard_gc_forecast_hist_mes CHECK (mes_referencia BETWEEN 1 AND 12),
  CONSTRAINT ck_dashboard_gc_forecast_hist_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
  CONSTRAINT ck_dashboard_gc_forecast_hist_valor CHECK (forecast_novo >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_forecast_hist_periodo
  ON sevenlm_connect.dashboard_gc_forecast_manual_historico (ano_referencia, mes_referencia, data_hora_evento DESC);
