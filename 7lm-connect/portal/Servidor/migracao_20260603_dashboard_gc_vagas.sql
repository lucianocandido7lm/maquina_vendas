CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_vaga_manual (
  identificador_vaga uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL,
  equipe text NOT NULL,
  data_abertura date NOT NULL,
  data_fechamento date,
  observacao text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dashboard_gc_vaga_manual_datas
    CHECK (data_fechamento IS NULL OR data_fechamento >= data_abertura)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dashboard_gc_vaga_manual_protocolo
  ON sevenlm_connect.dashboard_gc_vaga_manual (lower(protocolo));

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_manual_status
  ON sevenlm_connect.dashboard_gc_vaga_manual (data_fechamento, data_abertura DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_manual_equipe
  ON sevenlm_connect.dashboard_gc_vaga_manual (equipe);
