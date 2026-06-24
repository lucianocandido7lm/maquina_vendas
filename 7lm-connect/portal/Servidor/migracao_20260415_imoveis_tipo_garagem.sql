ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS tipo_garagem text;

UPDATE connect_comercial.imovel
   SET tipo_garagem = lower(btrim(coalesce(tipo_garagem, 'carro')));

UPDATE connect_comercial.imovel
   SET tipo_garagem = 'carro'
 WHERE tipo_garagem IS NULL
    OR tipo_garagem = ''
    OR tipo_garagem NOT IN ('carro', 'moto');

ALTER TABLE connect_comercial.imovel
  ALTER COLUMN tipo_garagem SET DEFAULT 'carro';

ALTER TABLE connect_comercial.imovel
  ALTER COLUMN tipo_garagem SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_tipo_garagem'
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_tipo_garagem
      CHECK (tipo_garagem IN ('carro', 'moto'));
  END IF;
END
$$;
