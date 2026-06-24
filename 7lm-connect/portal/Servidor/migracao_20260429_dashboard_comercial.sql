BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS connect_comercial;

CREATE OR REPLACE FUNCTION connect_comercial.atualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_base (
    fato_jornada_comercial_key TEXT PRIMARY KEY,
    journey_id TEXT,
    journey_key TEXT,
    journey_anchor_type TEXT,
    idlead BIGINT,
    idprecadastro BIGINT,
    idreserva BIGINT,
    idrepasse BIGINT,
    idcorretor_atual BIGINT,
    idgestor BIGINT,
    idimobiliaria BIGINT,
    idempreendimento BIGINT,
    idunidade BIGINT,
    lead_situacao_nome TEXT,
    precadastro_situacao_nome TEXT,
    reserva_situacao_nome TEXT,
    repasse_situacao_nome TEXT,
    dt_ultima_conversao_lead TIMESTAMP,
    dt_visita_realizada TIMESTAMP,
    dt_resposta_analise_precadastro TIMESTAMP,
    dt_cadastro_reserva TIMESTAMP,
    dt_cancelamento_reserva TIMESTAMP,
    dt_contrato_contabilizado TIMESTAMP,
    data_venda TIMESTAMP,
    dt_venda_finalizada TIMESTAMP,
    dt_assinatura_contrato TIMESTAMP,
    sla_finalizacao_dias NUMERIC(10,2),
    sla_repasse_dias NUMERIC(10,2),
    fl_tem_resposta_analise_precadastro BOOLEAN,
    fl_cancelada BOOLEAN,
    fl_venda_finalizada BOOLEAN,
    fl_repasse_assinado BOOLEAN,
    corretor_nome TEXT,
    gestor_nome TEXT,
    imobiliaria_nome TEXT,
    imobiliaria_nome_dim TEXT,
    lead_cidade TEXT,
    lead_estado TEXT,
    lead_regiao TEXT,
    lead_origem_nome TEXT,
    sdr_nome TEXT,
    empreendimento_nome TEXT,
    regiao_empreendimento TEXT,
    unidade_nome TEXT,
    bloco TEXT,
    etapa TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_base_ids
  ON connect_comercial.comercial_base(idlead, idprecadastro, idreserva, idrepasse);
CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_dt_assinatura
  ON connect_comercial.comercial_base(dt_assinatura_contrato);
CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_data_venda
  ON connect_comercial.comercial_base(data_venda);
CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_dt_venda
  ON connect_comercial.comercial_base(dt_venda_finalizada);
CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_dt_visita
  ON connect_comercial.comercial_base(dt_visita_realizada);
CREATE INDEX IF NOT EXISTS idx_dashboard_comercial_dt_cadastro
  ON connect_comercial.comercial_base(dt_cadastro_reserva);

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_propostas_historico (
    historico_status_key TEXT PRIMARY KEY,
    journey_id TEXT,
    journey_anchor_type TEXT,
    idlead BIGINT,
    idprecadastro BIGINT,
    idreserva BIGINT,
    idrepasse BIGINT,
    referencia_data TIMESTAMP,
    situacao_de TEXT,
    situacao_para TEXT,
    proposta_status_grupo TEXT,
    idcorretor_atual BIGINT,
    idgestor BIGINT,
    idimobiliaria BIGINT,
    idempreendimento BIGINT,
    idunidade BIGINT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_propostas_ref_data
  ON connect_comercial.comercial_propostas_historico(referencia_data);

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_propostas_consolidada (
    idprecadastro BIGINT PRIMARY KEY,
    journey_id TEXT,
    dt_ultimo_historico TIMESTAMP,
    dt_ultimo_historico_data DATE,
    situacao_ultimo_status TEXT,
    proposta_status_atual TEXT,
    proposta_status_consolidado_atual TEXT,
    idcorretor_atual BIGINT,
    idgestor BIGINT,
    idimobiliaria BIGINT,
    idempreendimento BIGINT,
    idunidade BIGINT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_propostas_consol_data
  ON connect_comercial.comercial_propostas_consolidada(dt_ultimo_historico_data);
CREATE INDEX IF NOT EXISTS idx_dashboard_propostas_consol_status
  ON connect_comercial.comercial_propostas_consolidada(proposta_status_atual);

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_cancelamentos (
    journey_id TEXT,
    idlead BIGINT,
    idprecadastro BIGINT,
    idreserva BIGINT,
    idrepasse BIGINT,
    data_cancelamento TIMESTAMP,
    idcorretor_atual BIGINT,
    idgestor BIGINT,
    idimobiliaria BIGINT,
    idempreendimento BIGINT,
    idunidade BIGINT,
    corretor_nome TEXT,
    gestor_nome TEXT,
    empreendimento_nome TEXT,
    regiao_empreendimento TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_cancelamentos_dt
  ON connect_comercial.comercial_cancelamentos(data_cancelamento);

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_distratos (
    journey_id TEXT,
    idlead BIGINT,
    idprecadastro BIGINT,
    idreserva BIGINT,
    idrepasse BIGINT,
    referencia_data TIMESTAMP,
    situacao_de TEXT,
    situacao_para TEXT,
    idcorretor_atual BIGINT,
    idgestor BIGINT,
    idimobiliaria BIGINT,
    idempreendimento BIGINT,
    idunidade BIGINT,
    corretor_nome TEXT,
    gestor_nome TEXT,
    empreendimento_nome TEXT,
    regiao_empreendimento TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_distratos_dt
  ON connect_comercial.comercial_distratos(referencia_data);

CREATE TABLE IF NOT EXISTS connect_comercial.hierarquia_cvcrm (
    documento TEXT,
    nome TEXT,
    gestor_documento TEXT,
    gestor_nome TEXT,
    coordenador_documento TEXT,
    coordenador_nome TEXT,
    imobiliaria_nome TEXT,
    imobiliaria_nome_dim TEXT,
    ativo_negocio TEXT,
    data_inicio_vigencia DATE,
    data_fim_vigencia DATE
);

CREATE INDEX IF NOT EXISTS idx_dashboard_hierarquia_documento
  ON connect_comercial.hierarquia_cvcrm(documento);
CREATE INDEX IF NOT EXISTS idx_dashboard_hierarquia_nome
  ON connect_comercial.hierarquia_cvcrm(nome);
CREATE INDEX IF NOT EXISTS idx_dashboard_hierarquia_ativo_vigencia
  ON connect_comercial.hierarquia_cvcrm(ativo_negocio, data_fim_vigencia);

CREATE OR REPLACE VIEW connect_comercial.vw_hierarquia_cvcrm AS
SELECT *
FROM connect_comercial.hierarquia_cvcrm;

CREATE TABLE IF NOT EXISTS connect_comercial.comercial_kpi_daily (
    data DATE NOT NULL,
    cidade TEXT,
    origem TEXT,
    empreendimento TEXT,
    empreendimento_reduzido TEXT,
    sdr TEXT,
    corretor TEXT,
    gerencia TEXT,
    coordenacao TEXT,
    imobiliaria TEXT,
    leads INTEGER NOT NULL DEFAULT 0,
    agendamentos INTEGER NOT NULL DEFAULT 0,
    visitas INTEGER NOT NULL DEFAULT 0,
    vendas INTEGER NOT NULL DEFAULT 0,
    repasses INTEGER NOT NULL DEFAULT 0,
    sla_finalizacao_sum NUMERIC(18,4) NOT NULL DEFAULT 0,
    sla_finalizacao_count INTEGER NOT NULL DEFAULT 0,
    sla_repasse_sum NUMERIC(18,4) NOT NULL DEFAULT 0,
    sla_repasse_count INTEGER NOT NULL DEFAULT 0,
    propostas_aprovadas INTEGER NOT NULL DEFAULT 0,
    propostas_condicionadas INTEGER NOT NULL DEFAULT 0,
    propostas_reprovadas INTEGER NOT NULL DEFAULT 0,
    propostas_total INTEGER NOT NULL DEFAULT 0,
    cancelamentos INTEGER NOT NULL DEFAULT 0,
    distratos INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dashboard_kpi_daily_data
  ON connect_comercial.comercial_kpi_daily(data);
CREATE INDEX IF NOT EXISTS idx_dashboard_kpi_daily_dims
  ON connect_comercial.comercial_kpi_daily(
    data,
    cidade,
    origem,
    empreendimento_reduzido,
    corretor,
    gerencia,
    coordenacao,
    imobiliaria
  );

CREATE TABLE IF NOT EXISTS connect_comercial.dim_empreendimento (
    dim_empreendimento_key TEXT PRIMARY KEY,
    idempreendimento BIGINT,
    idunidade_origem BIGINT,
    idtipo_empreendimento BIGINT,
    tipo_empreendimento TEXT,
    empreendimento TEXT,
    empreendimento_reduzido TEXT,
    cidade TEXT,
    regiao TEXT,
    qt_unidades_empreendimento BIGINT,
    dt_entrega_empreendimento TIMESTAMP,
    dt_referencia_empreendimento TIMESTAMP,
    dt_ultima_referencia_empreendimento TIMESTAMP,
    dt_ultima_ingestao_empreendimento TIMESTAMP,
    gold_process_ts TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_dim_empreendimento_id
  ON connect_comercial.dim_empreendimento(idempreendimento);
CREATE INDEX IF NOT EXISTS idx_dashboard_dim_empreendimento_nome
  ON connect_comercial.dim_empreendimento(empreendimento);
CREATE INDEX IF NOT EXISTS idx_dashboard_dim_empreendimento_reduzido
  ON connect_comercial.dim_empreendimento(empreendimento_reduzido);
CREATE INDEX IF NOT EXISTS idx_dashboard_dim_empreendimento_regiao
  ON connect_comercial.dim_empreendimento(regiao);
CREATE INDEX IF NOT EXISTS idx_dashboard_dim_empreendimento_cidade
  ON connect_comercial.dim_empreendimento(cidade);

CREATE TABLE IF NOT EXISTS connect_comercial.dashboard_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id TEXT NOT NULL,
    goal_value NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'total',
    target_type TEXT NOT NULL DEFAULT 'absolute',
    quality_style BOOLEAN NOT NULL DEFAULT FALSE,
    period_type TEXT NOT NULL DEFAULT 'monthly',
    hierarchy_level TEXT NOT NULL DEFAULT 'all',
    hierarchy_value TEXT NOT NULL DEFAULT '',
    business_days_aware BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_dashboard_goals_value CHECK (goal_value >= 0),
    CONSTRAINT ck_dashboard_goals_hierarchy CHECK (
      hierarchy_level IN ('all', 'gerencia', 'coordenacao', 'corretor', 'cidade', 'imobiliaria')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dashboard_goals_kpi_context
  ON connect_comercial.dashboard_goals(kpi_id, hierarchy_level, hierarchy_value);

DROP TRIGGER IF EXISTS trg_dashboard_goals_updated_at ON connect_comercial.dashboard_goals;
CREATE TRIGGER trg_dashboard_goals_updated_at
BEFORE UPDATE ON connect_comercial.dashboard_goals
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

INSERT INTO connect_comercial.dashboard_goals (
  kpi_id,
  goal_value,
  unit,
  target_type,
  quality_style,
  period_type,
  hierarchy_level,
  hierarchy_value,
  business_days_aware
)
VALUES
  ('leads', 7000, 'total', 'absolute', false, 'monthly', 'all', '', true),
  ('visitas', 1300, 'total', 'absolute', false, 'monthly', 'all', '', true),
  ('propostas', 90, 'total', 'absolute', false, 'monthly', 'all', '', true),
  ('cancelamentos', 30, 'total', 'ratio_limit', true, 'monthly', 'all', '', true),
  ('distratos', 5, 'total', 'ratio_limit', true, 'monthly', 'all', '', true),
  ('vendas', 80, 'total', 'absolute', false, 'monthly', 'all', '', true),
  ('repasses', 70, 'total', 'absolute', false, 'monthly', 'all', '', true),
  ('sla_f', 8, 'dias', 'days_max', true, 'monthly', 'all', '', true),
  ('sla_r', 10, 'dias', 'days_max', true, 'monthly', 'all', '', true),
  ('ipc_corretor', 1.4, 'ratio', 'absolute', false, 'monthly', 'all', '', true),
  ('ipc_imobiliaria', 1.4, 'ratio', 'absolute', false, 'monthly', 'all', '', true)
ON CONFLICT (kpi_id, hierarchy_level, hierarchy_value) DO NOTHING;

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('dashboard.comercial.view', 'Permite visualizar o Dashboard Comercial migrado do PRJ.'),
  ('dashboard.comercial.manage', 'Permite alterar metas e parâmetros do Dashboard Comercial.')
ON CONFLICT (nome_permissao) DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao IN ('dashboard.comercial.view', 'dashboard.comercial.manage')
WHERE perfil.nome_perfil = 'Administrador do Portal'
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao = 'dashboard.comercial.view'
WHERE perfil.nome_perfil IN ('Diretor Comercial', 'Gerente Comercial', 'Gestor Comercial', 'Coordenador Comercial')
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao = 'dashboard.comercial.manage'
WHERE perfil.nome_perfil = 'Diretor Comercial'
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.portal_recurso (
  codigo_modulo,
  codigo_recurso,
  nome_recurso,
  rota_recurso,
  icone_recurso,
  ordem_exibicao,
  identificador_permissao_visualizar,
  identificador_permissao_gerenciar
)
SELECT
  'comercial',
  'dashboard_comercial',
  'Dashboard Comercial',
  '/comercial/dashboard',
  'chart',
  18,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'dashboard.comercial.manage'
WHERE pv.nome_permissao = 'dashboard.comercial.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO UPDATE
SET nome_recurso = EXCLUDED.nome_recurso,
    rota_recurso = EXCLUDED.rota_recurso,
    icone_recurso = EXCLUDED.icone_recurso,
    ordem_exibicao = EXCLUDED.ordem_exibicao,
    identificador_permissao_visualizar = EXCLUDED.identificador_permissao_visualizar,
    identificador_permissao_gerenciar = EXCLUDED.identificador_permissao_gerenciar,
    indicador_ativo = TRUE,
    data_hora_atualizado_em = NOW();

COMMIT;
