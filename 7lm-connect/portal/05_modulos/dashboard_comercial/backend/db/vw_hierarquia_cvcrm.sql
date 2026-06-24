-- View exposing normalized hierarquia for use by the dashboard
CREATE OR REPLACE VIEW public.vw_hierarquia_cvcrm AS
SELECT
  documento::text AS documento,
  nome::text AS nome,
  gestor_documento::text AS gestor_documento,
  gestor_nome::text AS gestor_nome,
  coordenador_documento::text AS coordenador_documento,
  coordenador_nome::text AS coordenador_nome,
  imobiliaria_nome::text AS imobiliaria_nome,
  imobiliaria_nome_dim::text AS imobiliaria_nome_dim,
  ativo_negocio::text AS ativo_negocio,
  data_inicio_vigencia::date AS data_inicio_vigencia,
  data_fim_vigencia::date AS data_fim_vigencia,
  mes_referencia::date AS mes_referencia,
  email_norm::text AS email_norm,
  documento_norm::text AS documento_norm,
  COALESCE(corretor_ativo_nome, nome)::text AS corretor_ativo_nome,
  COALESCE(gestor_corretor, gestor_nome)::text AS gestor_corretor,
  COALESCE(coordenador_corretor, coordenador_nome)::text AS coordenador_corretor,
  regiao_corretor::text AS regiao_corretor,
  COALESCE(imobiliaria_corretor, imobiliaria_nome_dim, imobiliaria_nome)::text AS imobiliaria_corretor,
  corretor_hierarquia_key::text AS corretor_hierarquia_key,
  corretor_ativo_mes_key::text AS corretor_ativo_mes_key,
  COALESCE(data_inicio_vigencia_data, data_inicio_vigencia)::date AS data_inicio_vigencia_data,
  COALESCE(data_fim_vigencia_data, data_fim_vigencia)::date AS data_fim_vigencia_data
FROM public.hierarquia_cvcrm;

-- Nota: a view usa a tabela local public.hierarquia_cvcrm, preenchida pelo sync Databricks -> Postgres.
