CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sevenlm_connect.dashboard_gc_vaga_manual (
  identificador_vaga uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL,
  equipe text NOT NULL,
  cargo text,
  quantidade_vagas integer NOT NULL DEFAULT 1,
  data_abertura date NOT NULL,
  data_fechamento date,
  prazo_desejado date,
  status_vaga text NOT NULL DEFAULT 'EM_ANDAMENTO',
  tipo_solicitacao text,
  prioridade text,
  recrutadora text,
  solicitante text,
  localidade text,
  modalidade text,
  substituicao_de text,
  motivo_abertura text,
  identificador_equipe_vigencia uuid,
  diretor_aprovador text,
  diretor_aprovador_email text,
  aprovador_usuario uuid,
  data_hora_solicitacao timestamptz NOT NULL DEFAULT NOW(),
  data_aprovacao timestamptz,
  data_inicio_andamento timestamptz,
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
  ADD COLUMN IF NOT EXISTS quantidade_vagas integer,
  ADD COLUMN IF NOT EXISTS status_vaga text,
  ADD COLUMN IF NOT EXISTS prazo_desejado date,
  ADD COLUMN IF NOT EXISTS tipo_solicitacao text,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS recrutadora text,
  ADD COLUMN IF NOT EXISTS solicitante text,
  ADD COLUMN IF NOT EXISTS localidade text,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS substituicao_de text,
  ADD COLUMN IF NOT EXISTS motivo_abertura text,
  ADD COLUMN IF NOT EXISTS identificador_equipe_vigencia uuid,
  ADD COLUMN IF NOT EXISTS diretor_aprovador text,
  ADD COLUMN IF NOT EXISTS diretor_aprovador_email text,
  ADD COLUMN IF NOT EXISTS aprovador_usuario uuid,
  ADD COLUMN IF NOT EXISTS data_hora_solicitacao timestamptz,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS data_inicio_andamento timestamptz;

UPDATE sevenlm_connect.dashboard_gc_vaga_manual
   SET data_hora_solicitacao = COALESCE(data_hora_criacao, NOW())
 WHERE data_hora_solicitacao IS NULL;

UPDATE sevenlm_connect.dashboard_gc_vaga_manual
   SET quantidade_vagas = 1
 WHERE quantidade_vagas IS NULL
    OR quantidade_vagas < 1
    OR quantidade_vagas > 999;

UPDATE sevenlm_connect.dashboard_gc_vaga_manual
   SET status_vaga = CASE
         WHEN data_fechamento IS NOT NULL AND data_fechamento <= CURRENT_DATE THEN 'FECHADA'
         ELSE 'EM_ANDAMENTO'
       END
 WHERE status_vaga IS NULL
    OR status_vaga NOT IN (
      'PENDENTE_APROVACAO',
      'EM_ANDAMENTO',
      'TRIAGEM',
      'ENTREVISTAS',
      'PROPOSTA',
      'FECHADA',
      'CANCELADA',
      'CONGELADA',
      'REPROVADA'
    );

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  ALTER COLUMN quantidade_vagas SET DEFAULT 1,
  ALTER COLUMN quantidade_vagas SET NOT NULL,
  ALTER COLUMN status_vaga SET DEFAULT 'EM_ANDAMENTO',
  ALTER COLUMN status_vaga SET NOT NULL,
  ALTER COLUMN data_hora_solicitacao SET DEFAULT NOW(),
  ALTER COLUMN data_hora_solicitacao SET NOT NULL;

ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
  DROP CONSTRAINT IF EXISTS ck_dashboard_gc_vaga_manual_status;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_dashboard_gc_vaga_manual_status'
       AND conrelid = 'sevenlm_connect.dashboard_gc_vaga_manual'::regclass
  ) THEN
    ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
      ADD CONSTRAINT ck_dashboard_gc_vaga_manual_status
      CHECK (status_vaga IN (
        'PENDENTE_APROVACAO',
        'EM_ANDAMENTO',
        'TRIAGEM',
        'ENTREVISTAS',
        'PROPOSTA',
        'FECHADA',
        'CANCELADA',
        'CONGELADA',
        'REPROVADA'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_dashboard_gc_vaga_manual_equipe_vigencia'
       AND conrelid = 'sevenlm_connect.dashboard_gc_vaga_manual'::regclass
  ) THEN
    ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
      ADD CONSTRAINT fk_dashboard_gc_vaga_manual_equipe_vigencia
      FOREIGN KEY (identificador_equipe_vigencia)
      REFERENCES sevenlm_connect.funcionario_equipe_vigencia(identificador_equipe_vigencia)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_dashboard_gc_vaga_manual_aprovador_usuario'
       AND conrelid = 'sevenlm_connect.dashboard_gc_vaga_manual'::regclass
  ) THEN
    ALTER TABLE sevenlm_connect.dashboard_gc_vaga_manual
      ADD CONSTRAINT fk_dashboard_gc_vaga_manual_aprovador_usuario
      FOREIGN KEY (aprovador_usuario)
      REFERENCES sevenlm_connect.usuario(identificador_usuario)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_manual_status_vaga
  ON sevenlm_connect.dashboard_gc_vaga_manual (status_vaga, data_abertura DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_vaga_manual_aprovacao
  ON sevenlm_connect.dashboard_gc_vaga_manual (status_vaga, aprovador_usuario, data_hora_solicitacao DESC);

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
