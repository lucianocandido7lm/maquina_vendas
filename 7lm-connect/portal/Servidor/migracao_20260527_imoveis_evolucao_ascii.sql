DO $$
BEGIN
  IF to_regclass('connect_comercial.imovel_evolucao_obra') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'connect_comercial'
         AND table_name = 'imovel_evolucao_obra'
         AND column_name = U&'data_refer\00EAncia'
    ) AND NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'connect_comercial'
         AND table_name = 'imovel_evolucao_obra'
         AND column_name = 'data_referencia'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I RENAME COLUMN %I TO data_referencia',
        'connect_comercial',
        'imovel_evolucao_obra',
        U&'data_refer\00EAncia'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'connect_comercial'
         AND table_name = 'imovel_evolucao_obra'
         AND column_name = 'data_referencia'
    ) THEN
      ALTER TABLE connect_comercial.imovel_evolucao_obra
        ADD COLUMN data_referencia date NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    DROP INDEX IF EXISTS connect_comercial.idx_imovel_evolucao_obra_atual;
    CREATE INDEX IF NOT EXISTS idx_imovel_evolucao_obra_atual
      ON connect_comercial.imovel_evolucao_obra (
        identificador_imovel,
        data_referencia DESC,
        data_hora_criacao DESC
      );
  END IF;
END $$;
