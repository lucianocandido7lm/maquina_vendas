CREATE TABLE IF NOT EXISTS public.dim_imobiliaria (
  dim_imobiliaria_key TEXT,
  idimobiliaria BIGINT PRIMARY KEY,
  nome_imobiliaria TEXT,
  dt_referencia_imobiliaria TIMESTAMP,
  gold_process_ts TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dim_imobiliaria_nome
  ON public.dim_imobiliaria (nome_imobiliaria);

CREATE TABLE IF NOT EXISTS public.dim_sdr_imobiliaria (
  idimobiliaria_sdr TEXT,
  nome_imobiliaria TEXT,
  mes_referencia DATE,
  PRIMARY KEY (idimobiliaria_sdr, mes_referencia)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dim_sdr_imobiliaria'::regclass
      AND conname = 'dim_sdr_imobiliaria_pkey'
      AND cardinality(conkey) = 1
  ) THEN
    ALTER TABLE public.dim_sdr_imobiliaria DROP CONSTRAINT dim_sdr_imobiliaria_pkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.dim_sdr_imobiliaria'::regclass
      AND conname = 'dim_sdr_imobiliaria_pkey'
  ) THEN
    ALTER TABLE public.dim_sdr_imobiliaria
      ADD CONSTRAINT dim_sdr_imobiliaria_pkey PRIMARY KEY (idimobiliaria_sdr, mes_referencia);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dim_sdr_imobiliaria_nome
  ON public.dim_sdr_imobiliaria (nome_imobiliaria);
