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

CREATE TABLE IF NOT EXISTS connect_comercial.indicadores_meta (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connect_comercial.metas_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario),
  tipo_usuario text NOT NULL,
  indicador_id integer NOT NULL REFERENCES connect_comercial.indicadores_meta(id),
  mes_referencia smallint NOT NULL,
  ano_referencia smallint NOT NULL,
  meta_potencial numeric(14, 4),
  meta_valor numeric(14, 4) NOT NULL DEFAULT 0,
  origem_meta text NOT NULL DEFAULT 'MANUAL',
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  versao integer NOT NULL DEFAULT 1,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  motivo_alteracao text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_metas_colaboradores_tipo CHECK (tipo_usuario IN ('CORRETOR', 'GESTOR', 'COORDENADOR')),
  CONSTRAINT ck_metas_colaboradores_origem CHECK (origem_meta IN ('MANUAL', 'AUTOMATICA')),
  CONSTRAINT ck_metas_colaboradores_mes CHECK (mes_referencia BETWEEN 1 AND 12),
  CONSTRAINT ck_metas_colaboradores_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
  CONSTRAINT ck_metas_colaboradores_valores CHECK (
    coalesce(meta_potencial, 0) >= 0
    AND coalesce(meta_valor, 0) >= 0
  ),
  CONSTRAINT ck_metas_colaboradores_vigencia CHECK (data_inicio <= data_fim),
  CONSTRAINT ck_metas_colaboradores_versao CHECK (versao >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_colaboradores_ativa
  ON connect_comercial.metas_colaboradores (usuario_id, tipo_usuario, indicador_id, mes_referencia, ano_referencia, origem_meta)
  WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS idx_metas_colaboradores_filtros
  ON connect_comercial.metas_colaboradores (ano_referencia, mes_referencia, indicador_id, tipo_usuario, ativo);

CREATE TABLE IF NOT EXISTS connect_comercial.metas_gerenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  visao_meta text,
  tipo_meta text NOT NULL,
  regiao_id text,
  empreendimento_id text,
  indicador_id integer NOT NULL REFERENCES connect_comercial.indicadores_meta(id),
  meta_regra text,
  meta_valor numeric(14, 4),
  fato_1 numeric(14, 4),
  fato_2 numeric(14, 4),
  fato_consolidado numeric(14, 4),
  peso numeric(10, 4),
  observacao text,
  mes_referencia smallint NOT NULL,
  ano_referencia smallint NOT NULL,
  origem_meta text NOT NULL DEFAULT 'MANUAL',
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  versao integer NOT NULL DEFAULT 1,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_metas_gerenciais_tipo CHECK (tipo_meta IN ('REGIONAL', 'EMPREENDIMENTO', 'GLOBAL')),
  CONSTRAINT ck_metas_gerenciais_origem CHECK (origem_meta IN ('MANUAL', 'AUTOMATICA')),
  CONSTRAINT ck_metas_gerenciais_mes CHECK (mes_referencia BETWEEN 1 AND 12),
  CONSTRAINT ck_metas_gerenciais_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
  CONSTRAINT ck_metas_gerenciais_vigencia CHECK (data_inicio <= data_fim),
  CONSTRAINT ck_metas_gerenciais_versao CHECK (versao >= 1),
  CONSTRAINT ck_metas_gerenciais_valores CHECK (
    coalesce(meta_valor, 0) >= 0
    AND coalesce(fato_1, 0) >= 0
    AND coalesce(fato_2, 0) >= 0
    AND coalesce(fato_consolidado, 0) >= 0
    AND coalesce(peso, 0) >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_metas_gerenciais_filtros
  ON connect_comercial.metas_gerenciais (ano_referencia, mes_referencia, indicador_id, tipo_meta, ativo);

CREATE TABLE IF NOT EXISTS connect_comercial.resultados_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario),
  indicador_id integer NOT NULL REFERENCES connect_comercial.indicadores_meta(id),
  mes_referencia smallint NOT NULL,
  ano_referencia smallint NOT NULL,
  valor_realizado numeric(14, 4) NOT NULL DEFAULT 0,
  origem_resultado text NOT NULL DEFAULT 'MANUAL',
  data_resultado date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_resultados_metas_origem CHECK (origem_resultado IN ('MANUAL', 'SISTEMA', 'IMPORTACAO', 'CALCULADO')),
  CONSTRAINT ck_resultados_metas_mes CHECK (mes_referencia BETWEEN 1 AND 12),
  CONSTRAINT ck_resultados_metas_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
  CONSTRAINT ck_resultados_metas_valor CHECK (valor_realizado >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resultados_metas_usuario_indicador_mes
  ON connect_comercial.resultados_metas (usuario_id, indicador_id, mes_referencia, ano_referencia);

CREATE TABLE IF NOT EXISTS connect_comercial.historico_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL,
  tipo_meta text NOT NULL,
  acao text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  usuario_responsavel uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_historico_metas_tipo CHECK (tipo_meta IN ('COLABORADOR', 'GERENCIAL')),
  CONSTRAINT ck_historico_metas_acao CHECK (acao IN ('CRIACAO', 'ALTERACAO', 'INATIVACAO', 'REATIVACAO'))
);

CREATE INDEX IF NOT EXISTS idx_historico_metas_meta
  ON connect_comercial.historico_metas (meta_id, tipo_meta, created_at DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.metas_hierarquia_comercial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_id uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario),
  subordinado_id uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario),
  tipo_vinculo text NOT NULL DEFAULT 'GESTOR',
  ativo boolean NOT NULL DEFAULT TRUE,
  data_inicio date,
  data_fim date,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_metas_hierarquia_tipo CHECK (tipo_vinculo IN ('GESTOR', 'COORDENADOR')),
  CONSTRAINT ck_metas_hierarquia_usuario CHECK (gestor_id <> subordinado_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_hierarquia_ativa
  ON connect_comercial.metas_hierarquia_comercial (gestor_id, subordinado_id, tipo_vinculo)
  WHERE ativo = TRUE;

DROP TRIGGER IF EXISTS trg_indicadores_meta_updated_at ON connect_comercial.indicadores_meta;
CREATE TRIGGER trg_indicadores_meta_updated_at
BEFORE UPDATE ON connect_comercial.indicadores_meta
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_metas_colaboradores_updated_at ON connect_comercial.metas_colaboradores;
CREATE TRIGGER trg_metas_colaboradores_updated_at
BEFORE UPDATE ON connect_comercial.metas_colaboradores
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_metas_gerenciais_updated_at ON connect_comercial.metas_gerenciais;
CREATE TRIGGER trg_metas_gerenciais_updated_at
BEFORE UPDATE ON connect_comercial.metas_gerenciais
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_resultados_metas_updated_at ON connect_comercial.resultados_metas;
CREATE TRIGGER trg_resultados_metas_updated_at
BEFORE UPDATE ON connect_comercial.resultados_metas
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_metas_hierarquia_updated_at ON connect_comercial.metas_hierarquia_comercial;
CREATE TRIGGER trg_metas_hierarquia_updated_at
BEFORE UPDATE ON connect_comercial.metas_hierarquia_comercial
FOR EACH ROW
EXECUTE FUNCTION connect_comercial.atualizar_updated_at();

INSERT INTO connect_comercial.indicadores_meta (codigo, nome, descricao)
VALUES
  ('LEADS', 'Leads', 'Quantidade de leads trabalhados.'),
  ('VISITAS', 'Visitas', 'Quantidade de visitas realizadas.'),
  ('PROPOSTAS', 'Propostas', 'Quantidade de propostas geradas.'),
  ('CANCELAMENTOS', 'Cancelamentos', 'Quantidade de cancelamentos.'),
  ('VENDAS_FINALIZADAS', 'Vendas finalizadas', 'Quantidade de vendas finalizadas.'),
  ('DISTRATOS', 'Distratos', 'Quantidade de distratos.'),
  ('REPASSES', 'Repasses', 'Quantidade de repasses.'),
  ('SLA_FINALIZACAO', 'SLA finalização', 'Prazo de finalização.'),
  ('SLA_REPASSE', 'SLA repasse', 'Prazo de repasse.'),
  ('IPC', 'IPC', 'Índice de performance comercial.'),
  ('ALUGUEL', 'Aluguel', 'Indicador de aluguel.'),
  ('VENDA', 'Venda', 'Indicador de venda.'),
  ('SOBREPRECO', 'Sobrepreço', 'Indicador de sobrepreço.')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    ativo = TRUE;

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('metas.resultados.view', 'Permite visualizar o módulo Abertura e Objetivos.'),
  ('metas.resultados.manage', 'Permite cadastrar e alterar metas de colaboradores conforme regras comerciais.'),
  ('metas.resultados.admin', 'Permite administrar todas as metas sem restrição de equipe.'),
  ('metas.resultados.gerenciais.manage', 'Permite cadastrar e alterar metas gerenciais.'),
  ('metas.resultados.resultados.manage', 'Permite lançar e alterar resultados de metas.'),
  ('metas.resultados.import', 'Permite importar planilhas de abertura, objetivos e resultados.')
ON CONFLICT (nome_permissao) DO NOTHING;

INSERT INTO sevenlm_connect.perfil (nome_perfil, descricao_perfil)
VALUES
  ('Diretor Comercial', 'Acesso diretor ao módulo Abertura e Objetivos.'),
  ('Coordenador Comercial', 'Acesso de coordenação ao módulo Abertura e Objetivos.'),
  ('Corretor', 'Acesso individual a abertura, objetivos e resultados.')
ON CONFLICT (nome_perfil) DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao IN (
    'metas.resultados.view',
    'metas.resultados.manage',
    'metas.resultados.admin',
    'metas.resultados.gerenciais.manage',
    'metas.resultados.resultados.manage',
    'metas.resultados.import'
  )
WHERE perfil.nome_perfil = 'Administrador do Portal'
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao IN (
    'metas.resultados.view',
    'metas.resultados.manage',
    'metas.resultados.resultados.manage'
  )
WHERE perfil.nome_perfil IN ('Gerente Comercial', 'Gestor Comercial', 'Coordenador Comercial')
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao IN (
    'metas.resultados.view',
    'metas.resultados.gerenciais.manage',
    'metas.resultados.resultados.manage'
  )
WHERE perfil.nome_perfil = 'Diretor Comercial'
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.permissao permissao
  ON permissao.nome_permissao = 'metas.resultados.view'
WHERE perfil.nome_perfil = 'Corretor'
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
  'metas',
  'metas_resultados',
  'Abertura e Objetivos',
  '/metas/dashboard',
  'target',
  35,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'metas.resultados.manage'
WHERE pv.nome_permissao = 'metas.resultados.view'
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
