CREATE TABLE IF NOT EXISTS public.comercial_indicador_segmentacao (
  indicador TEXT,
  data_evento DATE,
  mes_referencia DATE,
  entidade_id TEXT,
  valor_realizado NUMERIC,
  idcorretor_operacao BIGINT,
  corretor_operacao_nome TEXT,
  idimobiliaria_operacao BIGINT,
  imobiliaria_operacao_nome TEXT,
  regiao_operacao TEXT,
  idempreendimento_operacao BIGINT,
  empreendimento_operacao_nome TEXT,
  idunidade_operacao BIGINT,
  unidade_operacao_nome TEXT,
  sdr_operacao_nome TEXT,
  origem_operacao_nome TEXT,
  corretor_ativo_nome TEXT,
  gestor_corretor TEXT,
  coordenador_corretor TEXT,
  regiao_corretor TEXT,
  imobiliaria_corretor TEXT,
  fl_corretor_ativo_mes BOOLEAN,
  sdr_ativo_nome TEXT,
  gestor_sdr TEXT,
  coordenador_sdr TEXT,
  regiao_sdr TEXT,
  imobiliaria_sdr TEXT,
  fl_sdr_ativo_mes BOOLEAN,
  fl_indicador_sdr_aplicavel BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_data_indicador
  ON public.comercial_indicador_segmentacao (data_evento, indicador);

CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_mes_indicador
  ON public.comercial_indicador_segmentacao (mes_referencia, indicador);

CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_corretor_operacao
  ON public.comercial_indicador_segmentacao (idcorretor_operacao, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_corretor_ativo
  ON public.comercial_indicador_segmentacao (corretor_ativo_nome, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_comercial_ind_seg_sdr_ativo
  ON public.comercial_indicador_segmentacao (sdr_ativo_nome, mes_referencia)
  WHERE fl_indicador_sdr_aplicavel IS TRUE;

ALTER TABLE IF EXISTS public.hierarquia_cvcrm
  ADD COLUMN IF NOT EXISTS mes_referencia DATE,
  ADD COLUMN IF NOT EXISTS email_norm TEXT,
  ADD COLUMN IF NOT EXISTS documento_norm TEXT,
  ADD COLUMN IF NOT EXISTS corretor_ativo_nome TEXT,
  ADD COLUMN IF NOT EXISTS gestor_corretor TEXT,
  ADD COLUMN IF NOT EXISTS coordenador_corretor TEXT,
  ADD COLUMN IF NOT EXISTS regiao_corretor TEXT,
  ADD COLUMN IF NOT EXISTS imobiliaria_corretor TEXT,
  ADD COLUMN IF NOT EXISTS corretor_hierarquia_key TEXT,
  ADD COLUMN IF NOT EXISTS corretor_ativo_mes_key TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio_vigencia_data DATE,
  ADD COLUMN IF NOT EXISTS data_fim_vigencia_data DATE;

ALTER TABLE IF EXISTS public.hierarquia_sdr
  ADD COLUMN IF NOT EXISTS mes_referencia DATE,
  ADD COLUMN IF NOT EXISTS email_norm TEXT,
  ADD COLUMN IF NOT EXISTS documento_norm TEXT,
  ADD COLUMN IF NOT EXISTS sdr_ativo_nome TEXT,
  ADD COLUMN IF NOT EXISTS gestor_sdr TEXT,
  ADD COLUMN IF NOT EXISTS coordenador_sdr TEXT,
  ADD COLUMN IF NOT EXISTS regiao_sdr TEXT,
  ADD COLUMN IF NOT EXISTS imobiliaria_sdr TEXT,
  ADD COLUMN IF NOT EXISTS sdr_hierarquia_key TEXT,
  ADD COLUMN IF NOT EXISTS sdr_ativo_mes_key TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio_vigencia_data DATE,
  ADD COLUMN IF NOT EXISTS data_fim_vigencia_data DATE;
