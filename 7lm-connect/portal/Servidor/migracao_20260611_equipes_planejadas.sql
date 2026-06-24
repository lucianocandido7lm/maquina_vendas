ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ALTER COLUMN data_inicio_vigencia DROP NOT NULL;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  DROP CONSTRAINT IF EXISTS ck_funcionario_equipe_vigencia_status;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ADD CONSTRAINT ck_funcionario_equipe_vigencia_status
  CHECK (status_equipe IN ('ATIVO', 'INATIVO', 'PLANEJADA'));

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ADD COLUMN IF NOT EXISTS hc_planejado integer NOT NULL DEFAULT 0;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ADD COLUMN IF NOT EXISTS foco_planejado jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  DROP CONSTRAINT IF EXISTS ck_funcionario_equipe_vigencia_hc_planejado;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ADD CONSTRAINT ck_funcionario_equipe_vigencia_hc_planejado
  CHECK (hc_planejado >= 0 AND hc_planejado <= 999);

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  DROP CONSTRAINT IF EXISTS ck_funcionario_equipe_vigencia_foco_planejado;

ALTER TABLE sevenlm_connect.funcionario_equipe_vigencia
  ADD CONSTRAINT ck_funcionario_equipe_vigencia_foco_planejado
  CHECK (jsonb_typeof(foco_planejado) = 'array');
