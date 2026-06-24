BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_simulacao_prazo_total_max_80'
       AND conrelid = 'connect_comercial.simulacao'::regclass
  ) THEN
    ALTER TABLE connect_comercial.simulacao
      DROP CONSTRAINT ck_simulacao_prazo_total_max_80;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_simulacao_prazo_total_max_100'
       AND conrelid = 'connect_comercial.simulacao'::regclass
  ) THEN
    ALTER TABLE connect_comercial.simulacao
      DROP CONSTRAINT ck_simulacao_prazo_total_max_100;
  END IF;
END
$$;

ALTER TABLE connect_comercial.simulacao
  ADD CONSTRAINT ck_simulacao_prazo_total_max_100
  CHECK (
    meses_pre_entrega BETWEEN 0 AND 100
    AND meses_pos_entrega BETWEEN 0 AND 100
    AND (meses_pre_entrega + meses_pos_entrega) <= 100
  );

COMMIT;
