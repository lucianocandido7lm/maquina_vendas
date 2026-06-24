BEGIN;

ALTER TABLE connect_comercial.simulacao
  ADD COLUMN IF NOT EXISTS cheque_moradia numeric(14,2);

UPDATE connect_comercial.simulacao
   SET cheque_moradia = 0
 WHERE cheque_moradia IS NULL;

ALTER TABLE connect_comercial.simulacao
  ALTER COLUMN cheque_moradia SET DEFAULT 0,
  ALTER COLUMN cheque_moradia SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_simulacao_cheque_moradia_nao_negativo'
  ) THEN
    ALTER TABLE connect_comercial.simulacao
      ADD CONSTRAINT ck_simulacao_cheque_moradia_nao_negativo
      CHECK (cheque_moradia >= 0);
  END IF;
END
$$;

COMMIT;
