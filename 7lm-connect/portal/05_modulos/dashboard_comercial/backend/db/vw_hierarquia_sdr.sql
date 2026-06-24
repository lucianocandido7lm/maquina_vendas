-- View exposing normalized SDR hierarchy for use by the dashboard
CREATE OR REPLACE VIEW public.vw_hierarquia_sdr AS
SELECT
  nome::text           AS nome,
  ativo_negocio::text  AS ativo_negocio,
  data_inicio_vigencia::date AS data_inicio_vigencia,
  data_fim_vigencia::date    AS data_fim_vigencia,
  mes_referencia::date AS mes_referencia,
  email_norm::text AS email_norm,
  documento_norm::text AS documento_norm,
  COALESCE(sdr_ativo_nome, nome)::text AS sdr_ativo_nome,
  gestor_sdr::text AS gestor_sdr,
  coordenador_sdr::text AS coordenador_sdr,
  regiao_sdr::text AS regiao_sdr,
  imobiliaria_sdr::text AS imobiliaria_sdr,
  sdr_hierarquia_key::text AS sdr_hierarquia_key,
  sdr_ativo_mes_key::text AS sdr_ativo_mes_key,
  COALESCE(data_inicio_vigencia_data, data_inicio_vigencia)::date AS data_inicio_vigencia_data,
  COALESCE(data_fim_vigencia_data, data_fim_vigencia)::date AS data_fim_vigencia_data
FROM public.hierarquia_sdr;

-- Nota: a view usa a tabela local public.hierarquia_sdr, preenchida pelo sync Databricks -> Postgres.
