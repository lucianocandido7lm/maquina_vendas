BEGIN;

ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS meses_pre_entrega integer;

ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS meses_pos_entrega integer;

UPDATE connect_comercial.imovel
   SET meses_pre_entrega = 36
 WHERE meses_pre_entrega IS NULL;

UPDATE connect_comercial.imovel
   SET meses_pos_entrega = 24
 WHERE meses_pos_entrega IS NULL;

ALTER TABLE connect_comercial.imovel
  ALTER COLUMN meses_pre_entrega SET DEFAULT 36,
  ALTER COLUMN meses_pre_entrega SET NOT NULL,
  ALTER COLUMN meses_pos_entrega SET DEFAULT 24,
  ALTER COLUMN meses_pos_entrega SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_meses_pre_entrega'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_meses_pre_entrega CHECK (meses_pre_entrega BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_meses_pos_entrega'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_meses_pos_entrega CHECK (meses_pos_entrega BETWEEN 0 AND 360);
  END IF;
END
$$;

COMMIT;
