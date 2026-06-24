CREATE SCHEMA IF NOT EXISTS connect_comercial;

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_gc_produtividade_repasses_importados (
  chave_registro text PRIMARY KEY,
  reserva text,
  data_assinatura date NOT NULL,
  mes_referencia date NOT NULL,
  situacao_repasse text,
  regiao text,
  empreendimento text,
  imobiliaria text,
  corretor text,
  cliente text,
  documento_cliente text,
  fonte_arquivo text NOT NULL,
  data_hora_importacao timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_rep_imp_mes
  ON connect_comercial.dashboard_gc_produtividade_repasses_importados (mes_referencia, imobiliaria, corretor);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_rep_imp_corretor
  ON connect_comercial.dashboard_gc_produtividade_repasses_importados (corretor, data_assinatura);

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe (
  mes_referencia date NOT NULL,
  equipe text NOT NULL,
  equipe_key text NOT NULL,
  corretor text NOT NULL,
  corretor_key text NOT NULL,
  gerente text,
  coordenador text,
  regiao text,
  tipo text,
  repasses_mes integer NOT NULL DEFAULT 0,
  ativo_no_mes boolean NOT NULL DEFAULT true,
  origem_planilha text NOT NULL,
  data_hora_importacao timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mes_referencia, equipe_key, corretor_key, origem_planilha)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_hist_mes_lideranca
  ON connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe
  (mes_referencia, coordenador, gerente, equipe, corretor);

CREATE INDEX IF NOT EXISTS idx_dashboard_gc_prod_hist_corretor
  ON connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe
  (corretor_key, mes_referencia);
