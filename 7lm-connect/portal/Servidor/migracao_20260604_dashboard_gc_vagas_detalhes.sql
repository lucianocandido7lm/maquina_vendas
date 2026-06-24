CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_vaga_manual (
  identificador_vaga uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL,
  equipe text NOT NULL,
  cargo text,
  quantidade_vagas integer NOT NULL DEFAULT 1,
  data_abertura date NOT NULL,
  data_fechamento date,
  status_vaga text NOT NULL DEFAULT 'EM_ANDAMENTO',
  observacao text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_dashboard_gc_vaga_manual_quantidade
    CHECK (quantidade_vagas BETWEEN 1 AND 999),
  CONSTRAINT ck_dashboard_gc_vaga_manual_datas
    CHECK (data_fechamento IS NULL OR data_fechamento >= data_abertura)
);

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS quantidade_vagas integer;

UPDATE sevenlm_connect.dashboard_gc_vaga_manual
   SET quantidade_vagas = 1
 WHERE quantidade_vagas IS NULL
    OR quantidade_vagas < 1
    OR quantidade_vagas > 999;

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ALTER COLUMN quantidade_vagas SET DEFAULT 1;

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ALTER COLUMN quantidade_vagas SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_dashboard_gc_vaga_manual_quantidade'
       AND conrelid = 'sevenlm_connect.dashboard_gc_vaga_manual'::regclass
  ) THEN
    ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
      ADD CONSTRAINT ck_dashboard_gc_vaga_manual_quantidade
      CHECK (quantidade_vagas BETWEEN 1 AND 999);
  END IF;
END $$;
