BEGIN;

DO $$
DECLARE
  v_dono text;
BEGIN
  SELECT pg_get_userbyid(nspowner)
    INTO v_dono
    FROM pg_namespace
   WHERE nspname = 'sevenlm_connect';

  IF v_dono IS NULL THEN
    RAISE EXCEPTION 'Schema sevenlm_connect nao encontrado para herdar o proprietario.';
  END IF;

  IF to_regnamespace('connect_comercial') IS NULL THEN
    EXECUTE format('CREATE SCHEMA connect_comercial AUTHORIZATION %I', v_dono);
  ELSE
    EXECUTE format('ALTER SCHEMA connect_comercial OWNER TO %I', v_dono);
  END IF;

  IF to_regnamespace('connect_financeiro') IS NULL THEN
    EXECUTE format('CREATE SCHEMA connect_financeiro AUTHORIZATION %I', v_dono);
  ELSE
    EXECUTE format('ALTER SCHEMA connect_financeiro OWNER TO %I', v_dono);
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('sevenlm_connect.imovel') IS NOT NULL
     AND to_regclass('connect_comercial.imovel') IS NULL THEN
    EXECUTE 'ALTER TABLE sevenlm_connect.imovel SET SCHEMA connect_comercial';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('sevenlm_connect.imovel_midia') IS NOT NULL
     AND to_regclass('connect_comercial.imovel_midia') IS NULL THEN
    EXECUTE 'ALTER TABLE sevenlm_connect.imovel_midia SET SCHEMA connect_comercial';
  END IF;
END
$$;

COMMIT;
