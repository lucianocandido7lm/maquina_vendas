BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = U&'imovel_pr\00F3prio'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = 'imovel_proprio'
  ) THEN
    EXECUTE 'ALTER TABLE connect_comercial.cliente RENAME COLUMN ' || quote_ident(U&'imovel_pr\00F3prio') || ' TO imovel_proprio';
  ELSIF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = 'imovel_proprio'
  ) THEN
    ALTER TABLE connect_comercial.cliente ADD COLUMN imovel_proprio boolean;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = U&'ve\00EDculo'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = 'veiculo'
  ) THEN
    EXECUTE 'ALTER TABLE connect_comercial.cliente RENAME COLUMN ' || quote_ident(U&'ve\00EDculo') || ' TO veiculo';
  ELSIF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'connect_comercial'
       AND table_name = 'cliente'
       AND column_name = 'veiculo'
  ) THEN
    ALTER TABLE connect_comercial.cliente ADD COLUMN veiculo boolean;
  END IF;
END
$$;

COMMIT;
