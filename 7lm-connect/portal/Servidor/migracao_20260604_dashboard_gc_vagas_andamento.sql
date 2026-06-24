CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_vaga_manual_andamento (
  identificador_andamento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_vaga uuid NOT NULL REFERENCES sevenlm_connect.dashboard_gc_vaga_manual(identificador_vaga) ON DELETE CASCADE,
  descricao text NOT NULL,
  status_vaga text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  criado_por_nome text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dashboard_gc_vaga_andamento_descricao
    CHECK (length(trim(descricao)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_andamento_vaga
  ON sevenlm_connect.dashboard_gc_vaga_manual_andamento (identificador_vaga, data_hora_criacao DESC);
