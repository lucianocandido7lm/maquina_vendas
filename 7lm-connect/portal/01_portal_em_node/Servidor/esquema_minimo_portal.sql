CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS sevenlm_connect;
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

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_uuid_aleatorio()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT gen_random_uuid();
$$;

CREATE OR REPLACE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data_hora_atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS sevenlm_connect.usuario (
  identificador_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula text,
  nome_completo text NOT NULL,
  correio_eletronico citext,
  senha_hash text NOT NULL,
  algoritmo_senha text NOT NULL DEFAULT 'argon2',
  indicador_ativo boolean NOT NULL DEFAULT TRUE,
  indicador_precisa_trocar_senha boolean NOT NULL DEFAULT FALSE,
  quantidade_falhas_consecutivas integer NOT NULL DEFAULT 0,
  data_hora_bloqueado_ate timestamptz,
  data_hora_ultimo_login timestamptz,
  indicador_mfa_habilitado boolean NOT NULL DEFAULT FALSE,
  mfa_totp_segredo_enc text,
  mfa_totp_confirmado_em timestamptz,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_matricula_unica
  ON sevenlm_connect.usuario (matricula)
  WHERE matricula IS NOT NULL AND btrim(matricula) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_correio_eletronico_unico
  ON sevenlm_connect.usuario (correio_eletronico)
  WHERE correio_eletronico IS NOT NULL AND btrim(correio_eletronico::text) <> '';

CREATE TABLE IF NOT EXISTS sevenlm_connect.perfil (
  identificador_perfil integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_perfil text NOT NULL UNIQUE,
  descricao_perfil text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.permissao (
  identificador_permissao integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_permissao text NOT NULL UNIQUE,
  descricao_permissao text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.usuario_perfil (
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  identificador_perfil integer NOT NULL REFERENCES sevenlm_connect.perfil(identificador_perfil) ON DELETE CASCADE,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identificador_usuario, identificador_perfil)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.perfil_permissao (
  identificador_perfil integer NOT NULL REFERENCES sevenlm_connect.perfil(identificador_perfil) ON DELETE CASCADE,
  identificador_permissao integer NOT NULL REFERENCES sevenlm_connect.permissao(identificador_permissao) ON DELETE CASCADE,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identificador_perfil, identificador_permissao)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.usuario_permissao (
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  identificador_permissao integer NOT NULL REFERENCES sevenlm_connect.permissao(identificador_permissao) ON DELETE CASCADE,
  indicador_permitido boolean NOT NULL DEFAULT TRUE,
  origem_regra text NOT NULL DEFAULT 'MANUAL',
  identificador_usuario_responsavel uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  observacao text,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  data_hora_revogado_em timestamptz,
  PRIMARY KEY (identificador_usuario, identificador_permissao)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.operacao (
  identificador_operacao integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_operacao text NOT NULL UNIQUE,
  descricao_operacao text,
  indicador_ativa boolean NOT NULL DEFAULT TRUE,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.usuario_operacao (
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  identificador_operacao integer NOT NULL REFERENCES sevenlm_connect.operacao(identificador_operacao) ON DELETE CASCADE,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identificador_usuario, identificador_operacao)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.setor (
  codigo_setor text PRIMARY KEY,
  nome_setor text NOT NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.usuario_setor (
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  codigo_setor text NOT NULL REFERENCES sevenlm_connect.setor(codigo_setor) ON DELETE CASCADE,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identificador_usuario, codigo_setor)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.setor_perfil (
  codigo_setor text NOT NULL REFERENCES sevenlm_connect.setor(codigo_setor) ON DELETE CASCADE,
  identificador_perfil integer NOT NULL REFERENCES sevenlm_connect.perfil(identificador_perfil) ON DELETE CASCADE,
  indicador_ativo boolean NOT NULL DEFAULT TRUE,
  identificador_usuario_responsavel uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  observacao text,
  data_hora_concedido_em timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (codigo_setor, identificador_perfil)
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.sessao (
  identificador_sessao uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  situacao_sessao text NOT NULL DEFAULT 'ATIVA',
  data_hora_expiracao timestamptz NOT NULL,
  data_hora_encerramento timestamptz,
  motivo_encerramento text,
  endereco_ip text,
  agente_do_usuario text,
  idioma text,
  fuso_horario_informado text,
  cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_ultimo_uso timestamptz,
  CONSTRAINT ck_sessao_situacao
    CHECK (situacao_sessao IN ('ATIVA', 'ENCERRADA'))
);

CREATE INDEX IF NOT EXISTS idx_sessao_usuario
  ON sevenlm_connect.sessao (identificador_usuario, situacao_sessao);

CREATE TABLE IF NOT EXISTS sevenlm_connect.credencial_de_renovacao (
  identificador_credencial uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_sessao uuid NOT NULL REFERENCES sevenlm_connect.sessao(identificador_sessao) ON DELETE CASCADE,
  hash_token text NOT NULL UNIQUE,
  data_hora_expiracao timestamptz NOT NULL,
  data_hora_revogacao timestamptz,
  identificador_substituida_por uuid,
  endereco_ip text,
  agente_do_usuario text,
  cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.tentativa_de_entrada (
  identificador_tentativa uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  login_informado text NOT NULL,
  indicador_sucesso boolean NOT NULL DEFAULT FALSE,
  motivo_falha text,
  endereco_ip text,
  agente_do_usuario text,
  cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_tentativa timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sevenlm_connect.auditoria_evento (
  identificador_evento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  identificador_sessao uuid REFERENCES sevenlm_connect.sessao(identificador_sessao) ON DELETE SET NULL,
  tipo_evento text NOT NULL,
  descricao_evento text,
  detalhes_evento jsonb NOT NULL DEFAULT '{}'::jsonb,
  endereco_ip text,
  agente_do_usuario text,
  data_hora_evento timestamptz NOT NULL DEFAULT NOW(),
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_evento_tipo_data
  ON sevenlm_connect.auditoria_evento (tipo_evento, data_hora_evento DESC);

CREATE TABLE IF NOT EXISTS sevenlm_connect.registro_requisicao_http (
  identificador_requisicao uuid PRIMARY KEY,
  identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  identificador_sessao uuid REFERENCES sevenlm_connect.sessao(identificador_sessao) ON DELETE SET NULL,
  metodo_http text NOT NULL,
  caminho_http text NOT NULL,
  consulta_http text,
  codigo_resposta_http integer NOT NULL,
  duracao_milisegundos integer,
  tamanho_resposta_bytes integer,
  endereco_ip text,
  agente_do_usuario text,
  origem text,
  referenciador text,
  cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  corpo_requisicao_hash text,
  corpo_requisicao_tamanho integer,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_requisicao_http_data
  ON sevenlm_connect.registro_requisicao_http (data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS sevenlm_connect.mfa_desafio (
  identificador_desafio uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_usuario uuid NOT NULL REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE CASCADE,
  tipo_desafio text NOT NULL,
  situacao text NOT NULL DEFAULT 'ABERTO',
  tentativas integer NOT NULL DEFAULT 0,
  data_hora_expiracao timestamptz NOT NULL,
  endereco_ip text,
  agente_do_usuario text,
  idioma text,
  fuso_horario_informado text,
  cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  mfa_segredo_temporario_enc text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mfa_desafio_tipo
    CHECK (tipo_desafio IN ('SETUP', 'LOGIN')),
  CONSTRAINT ck_mfa_desafio_situacao
    CHECK (situacao IN ('ABERTO', 'CONSUMIDO', 'EXPIRADO', 'BLOQUEADO'))
);

CREATE INDEX IF NOT EXISTS idx_mfa_desafio_usuario
  ON sevenlm_connect.mfa_desafio (identificador_usuario, situacao, data_hora_expiracao DESC);

CREATE TABLE IF NOT EXISTS sevenlm_connect.portal_recurso (
  identificador_recurso integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_modulo text NOT NULL,
  codigo_recurso text NOT NULL,
  nome_recurso text NOT NULL,
  rota_recurso text,
  icone_recurso text,
  ordem_exibicao integer NOT NULL DEFAULT 0,
  indicador_ativo boolean NOT NULL DEFAULT TRUE,
  indicador_em_construcao boolean NOT NULL DEFAULT FALSE,
  identificador_permissao_visualizar integer REFERENCES sevenlm_connect.permissao(identificador_permissao),
  identificador_permissao_gerenciar integer REFERENCES sevenlm_connect.permissao(identificador_permissao),
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (codigo_modulo, codigo_recurso)
);

CREATE TABLE IF NOT EXISTS connect_comercial.imovel (
  identificador_imovel uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo_imovel text,
  endereco text,
  cidade text NOT NULL,
  bairro text NOT NULL,
  estado text,
  cep text,
  valor numeric(14,2),
  quartos integer,
  banheiros integer,
  vagas_garagem integer,
  tipo_garagem text NOT NULL DEFAULT 'carro',
  area_m2 numeric(12,2),
  data_entrega date,
  meses_pre_entrega integer NOT NULL DEFAULT 36,
  meses_pos_entrega integer NOT NULL DEFAULT 24,
  percentual_conclusao_obra numeric(5,2) NOT NULL DEFAULT 0,
  percentual_fechamento_minimo numeric(5,4) NOT NULL DEFAULT 0.7000,
  valor_garantido numeric(14,2),
  valor_garantido_pre_obra_planejado numeric(14,2),
  percentual_captacao_ate_entrega numeric(5,4),
  valor_parcela_minima_pre_obra numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_imovel_meses_pre_entrega CHECK (meses_pre_entrega BETWEEN 1 AND 240),
  CONSTRAINT ck_imovel_meses_pos_entrega CHECK (meses_pos_entrega BETWEEN 0 AND 360),
  CONSTRAINT ck_imovel_percentual_conclusao_obra CHECK (percentual_conclusao_obra BETWEEN 0 AND 100),
  CONSTRAINT ck_imovel_percentual_fechamento_minimo CHECK (percentual_fechamento_minimo BETWEEN 0.01 AND 1.00),
  CONSTRAINT ck_imovel_valor_garantido CHECK (valor_garantido IS NULL OR valor_garantido >= 0),
  CONSTRAINT ck_imovel_valor_garantido_pre_obra_planejado CHECK (valor_garantido_pre_obra_planejado IS NULL OR valor_garantido_pre_obra_planejado >= 0),
  CONSTRAINT ck_imovel_percentual_captacao_ate_entrega CHECK (percentual_captacao_ate_entrega IS NULL OR percentual_captacao_ate_entrega BETWEEN 0.01 AND 1.00),
  CONSTRAINT ck_imovel_valor_parcela_minima_pre_obra CHECK (valor_parcela_minima_pre_obra >= 0),
  CONSTRAINT ck_imovel_tipo_garagem CHECK (tipo_garagem IN ('carro', 'moto'))
);

CREATE INDEX IF NOT EXISTS idx_imovel_titulo
  ON connect_comercial.imovel (titulo);

CREATE INDEX IF NOT EXISTS idx_imovel_cidade_bairro
  ON connect_comercial.imovel (cidade, bairro);

CREATE INDEX IF NOT EXISTS idx_imovel_status
  ON connect_comercial.imovel (status);

CREATE INDEX IF NOT EXISTS idx_imovel_data_criacao
  ON connect_comercial.imovel (data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.imovel_evolucao_obra (
  identificador_evolucao_obra uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel) ON DELETE CASCADE,
  percentual_conclusao_obra numeric(5,2) NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  registrado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_imovel_evolucao_obra_percentual CHECK (percentual_conclusao_obra BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_imovel_evolucao_obra_atual
  ON connect_comercial.imovel_evolucao_obra (
    identificador_imovel,
    data_referencia DESC,
    data_hora_criacao DESC,
    identificador_evolucao_obra DESC
  );

CREATE TABLE IF NOT EXISTS connect_comercial.imovel_midia (
  identificador_midia uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel) ON DELETE CASCADE,
  tipo_arquivo text NOT NULL,
  nome_arquivo text NOT NULL,
  caminho_arquivo text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_imovel_midia_tipo_arquivo
    CHECK (tipo_arquivo IN ('foto', 'video'))
);

CREATE INDEX IF NOT EXISTS idx_imovel_midia_imovel
  ON connect_comercial.imovel_midia (identificador_imovel, data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.cliente (
  identificador_cliente uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  data_nascimento date,
  cpf text,
  cpf_normalizado varchar(11),
  rg text,
  estado_civil text,
  nacionalidade text,
  email text,
  telefone text,
  celular text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  tempo_residencia_anos integer,
  renda_principal numeric(14,2),
  renda_conjuge numeric(14,2),
  outras_rendas numeric(14,2),
  renda_total numeric(14,2),
  moradores integer,
  dependentes integer,
  filhos integer,
  profissao text,
  empresa text,
  cargo text,
  tempo_emprego_anos integer,
  tipo_contrato text,
  imovel_proprio boolean,
  veiculo boolean,
  financiamentos text,
  cartao_credito numeric(14,2),
  aluguel_financiamento numeric(14,2),
  despesas_fixas numeric(14,2),
  despesas_variaveis numeric(14,2),
  observacoes text,
  parametros_simulacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_cliente_tempo_residencia_anos CHECK (tempo_residencia_anos IS NULL OR tempo_residencia_anos >= 0),
  CONSTRAINT ck_cliente_tempo_emprego_anos CHECK (tempo_emprego_anos IS NULL OR tempo_emprego_anos >= 0),
  CONSTRAINT ck_cliente_moradores CHECK (moradores IS NULL OR moradores >= 0),
  CONSTRAINT ck_cliente_dependentes CHECK (dependentes IS NULL OR dependentes >= 0),
  CONSTRAINT ck_cliente_filhos CHECK (filhos IS NULL OR filhos >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cliente_nome
  ON connect_comercial.cliente (nome_completo);

CREATE INDEX IF NOT EXISTS idx_cliente_cpf
  ON connect_comercial.cliente (cpf);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_cpf_normalizado
  ON connect_comercial.cliente (cpf_normalizado)
  WHERE cpf_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_email
  ON connect_comercial.cliente (email);

CREATE INDEX IF NOT EXISTS idx_cliente_data_criacao
  ON connect_comercial.cliente (data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.cliente_midia (
  identificador_midia uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_cliente uuid NOT NULL REFERENCES connect_comercial.cliente(identificador_cliente) ON DELETE CASCADE,
  tipo_arquivo text NOT NULL,
  nome_arquivo text NOT NULL,
  caminho_arquivo text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_cliente_midia_tipo_arquivo
    CHECK (tipo_arquivo IN ('foto', 'documento'))
);

CREATE INDEX IF NOT EXISTS idx_cliente_midia_cliente
  ON connect_comercial.cliente_midia (identificador_cliente, data_hora_criacao DESC);

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_usuario_tem_permissao(
  p_identificador_usuario uuid,
  p_nome_permissao text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_identificador_permissao integer;
  v_negado boolean;
  v_permitido boolean;
BEGIN
  SELECT identificador_permissao
    INTO v_identificador_permissao
    FROM sevenlm_connect.permissao
   WHERE nome_permissao = p_nome_permissao
   LIMIT 1;

  IF v_identificador_permissao IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM sevenlm_connect.usuario_permissao up
     WHERE up.identificador_usuario = p_identificador_usuario
       AND up.identificador_permissao = v_identificador_permissao
       AND up.data_hora_revogado_em IS NULL
       AND up.indicador_permitido = FALSE
  )
    INTO v_negado;

  IF COALESCE(v_negado, FALSE) THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
           SELECT 1
             FROM sevenlm_connect.usuario_permissao up
            WHERE up.identificador_usuario = p_identificador_usuario
              AND up.identificador_permissao = v_identificador_permissao
              AND up.data_hora_revogado_em IS NULL
              AND up.indicador_permitido = TRUE
         )
      OR EXISTS (
           SELECT 1
             FROM sevenlm_connect.usuario_perfil up
             JOIN sevenlm_connect.perfil_permissao pp
               ON pp.identificador_perfil = up.identificador_perfil
            WHERE up.identificador_usuario = p_identificador_usuario
              AND pp.identificador_permissao = v_identificador_permissao
         )
    INTO v_permitido;

  RETURN COALESCE(v_permitido, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_usuario_possui_permissao(
  p_identificador_usuario uuid,
  p_nome_permissao text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT sevenlm_connect.fn_usuario_tem_permissao(p_identificador_usuario, p_nome_permissao);
$$;

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_matricula_tem_permissao(
  p_matricula text,
  p_nome_permissao text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_identificador_usuario uuid;
BEGIN
  SELECT identificador_usuario
    INTO v_identificador_usuario
    FROM sevenlm_connect.usuario
   WHERE matricula = p_matricula
   LIMIT 1;

  IF v_identificador_usuario IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN sevenlm_connect.fn_usuario_tem_permissao(v_identificador_usuario, p_nome_permissao);
END;
$$;

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_usuario_pode_visualizar_recurso(
  p_identificador_usuario uuid,
  p_codigo_modulo text,
  p_codigo_recurso text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_perm_visualizar text;
  v_perm_gerenciar text;
BEGIN
  SELECT pv.nome_permissao,
         pg.nome_permissao
    INTO v_perm_visualizar, v_perm_gerenciar
    FROM sevenlm_connect.portal_recurso pr
    LEFT JOIN sevenlm_connect.permissao pv
      ON pv.identificador_permissao = pr.identificador_permissao_visualizar
    LEFT JOIN sevenlm_connect.permissao pg
      ON pg.identificador_permissao = pr.identificador_permissao_gerenciar
   WHERE pr.codigo_modulo = p_codigo_modulo
     AND pr.codigo_recurso = p_codigo_recurso
     AND pr.indicador_ativo = TRUE
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_perm_visualizar IS NULL AND v_perm_gerenciar IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN COALESCE(sevenlm_connect.fn_usuario_tem_permissao(p_identificador_usuario, v_perm_visualizar), FALSE)
      OR COALESCE(sevenlm_connect.fn_usuario_tem_permissao(p_identificador_usuario, v_perm_gerenciar), FALSE);
END;
$$;

DROP TRIGGER IF EXISTS trg_usuario_data_hora_atualizado_em ON sevenlm_connect.usuario;
CREATE TRIGGER trg_usuario_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.usuario
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_perfil_data_hora_atualizado_em ON sevenlm_connect.perfil;
CREATE TRIGGER trg_perfil_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.perfil
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_permissao_data_hora_atualizado_em ON sevenlm_connect.permissao;
CREATE TRIGGER trg_permissao_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.permissao
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_operacao_data_hora_atualizado_em ON sevenlm_connect.operacao;
CREATE TRIGGER trg_operacao_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.operacao
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_setor_data_hora_atualizado_em ON sevenlm_connect.setor;
CREATE TRIGGER trg_setor_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.setor
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_portal_recurso_data_hora_atualizado_em ON sevenlm_connect.portal_recurso;
CREATE TRIGGER trg_portal_recurso_data_hora_atualizado_em
BEFORE UPDATE ON sevenlm_connect.portal_recurso
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_imovel_data_hora_atualizado_em ON connect_comercial.imovel;
CREATE TRIGGER trg_imovel_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.imovel
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_cliente_data_hora_atualizado_em ON connect_comercial.cliente;
CREATE TRIGGER trg_cliente_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.cliente
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('administracao.view', 'Permite visualizar a area administrativa do portal.'),
  ('administracao.manage', 'Permite gerenciar usuarios, perfis e permissoes no portal.'),
  ('rh.admin.acessos.view', 'Permite visualizar a central de acessos.'),
  ('rh.admin.acessos.manage', 'Permite administrar a central de acessos.'),
  ('rh.acesso', 'Permite visualizar a area de Gente e Gestao.'),
  ('ACESSO_TOTAL', 'Permite acesso administrativo amplo.'),
  ('GERENCIAR_ACESSO', 'Permite gerenciar os acessos do portal.'),
  ('imoveis.view', 'Permite visualizar a listagem de imoveis.'),
  ('imoveis.create', 'Permite cadastrar novos imoveis.'),
  ('imoveis.edit', 'Permite editar dados de imoveis.'),
  ('imoveis.delete', 'Permite excluir imoveis.'),
  ('imoveis.media.manage', 'Permite enviar e remover fotos e videos de imoveis.')
ON CONFLICT (nome_permissao) DO NOTHING;

INSERT INTO sevenlm_connect.perfil (nome_perfil, descricao_perfil)
VALUES
  ('Administrador do Portal', 'Perfil inicial com gestao completa do 7LM.'),
  ('Acesso Basico', 'Perfil base para usuarios autenticados do portal.')
ON CONFLICT (nome_perfil) DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
  FROM sevenlm_connect.perfil perfil
  JOIN sevenlm_connect.permissao permissao
    ON permissao.nome_permissao IN (
      'administracao.view',
      'administracao.manage',
      'rh.admin.acessos.view',
      'rh.admin.acessos.manage',
      'rh.acesso',
      'ACESSO_TOTAL',
      'GERENCIAR_ACESSO',
      'imoveis.view',
      'imoveis.create',
      'imoveis.edit',
      'imoveis.delete',
      'imoveis.media.manage'
    )
 WHERE perfil.nome_perfil = 'Administrador do Portal'
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
  'administracao',
  'acessos',
  'Administracao de acessos',
  '/administracao/acessos',
  'shield',
  10,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'administracao.manage'
WHERE pv.nome_permissao = 'administracao.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO NOTHING;

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
  'imoveis',
  'listagem',
  'Modulo de imoveis',
  '/imoveis',
  'home',
  20,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'imoveis.edit'
WHERE pv.nome_permissao = 'imoveis.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO NOTHING;
