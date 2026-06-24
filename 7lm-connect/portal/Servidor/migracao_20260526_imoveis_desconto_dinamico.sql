BEGIN;

ALTER TABLE connect_comercial.imovel
  ADD COLUMN IF NOT EXISTS valor_desconto_minimo numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto_maximo numeric(14,2) NOT NULL DEFAULT 50000;

UPDATE connect_comercial.imovel
   SET valor_desconto_minimo = 0
 WHERE valor_desconto_minimo IS NULL;

UPDATE connect_comercial.imovel
   SET valor_desconto_maximo = 50000
 WHERE valor_desconto_maximo IS NULL;

ALTER TABLE connect_comercial.imovel
  ALTER COLUMN valor_desconto_minimo SET DEFAULT 0,
  ALTER COLUMN valor_desconto_minimo SET NOT NULL,
  ALTER COLUMN valor_desconto_maximo SET DEFAULT 50000,
  ALTER COLUMN valor_desconto_maximo SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_valor_desconto_minimo'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_valor_desconto_minimo
      CHECK (valor_desconto_minimo >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_valor_desconto_maximo'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_valor_desconto_maximo
      CHECK (valor_desconto_maximo >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_imovel_valor_desconto_faixa'
       AND conrelid = 'connect_comercial.imovel'::regclass
  ) THEN
    ALTER TABLE connect_comercial.imovel
      ADD CONSTRAINT ck_imovel_valor_desconto_faixa
      CHECK (valor_desconto_maximo >= valor_desconto_minimo);
  END IF;
END $$;

COMMIT;
