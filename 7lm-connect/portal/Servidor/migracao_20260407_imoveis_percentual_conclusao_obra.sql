ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS percentual_conclusao_obra numeric(5,2);

UPDATE connect_comercial.imovel
   SET percentual_conclusao_obra = 0
 WHERE percentual_conclusao_obra IS NULL;

ALTER TABLE connect_comercial.imovel
  ALTER COLUMN percentual_conclusao_obra SET DEFAULT 0,
  ALTER COLUMN percentual_conclusao_obra SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_percentual_conclusao_obra'
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_percentual_conclusao_obra
      CHECK (percentual_conclusao_obra BETWEEN 0 AND 100);
  END IF;
END $$;
