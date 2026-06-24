CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS recrutamento_selecao;

CREATE TABLE IF NOT EXISTS system.tentativa_de_entrada (
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

CREATE INDEX IF NOT EXISTS idx_system_tentativa_de_entrada_data
  ON system.tentativa_de_entrada (data_hora_tentativa DESC);

ALTER TABLE system.tentativa_de_entrada
  ADD COLUMN IF NOT EXISTS identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS login_informado text,
  ADD COLUMN IF NOT EXISTS indicador_sucesso boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_falha text,
  ADD COLUMN IF NOT EXISTS endereco_ip text,
  ADD COLUMN IF NOT EXISTS agente_do_usuario text,
  ADD COLUMN IF NOT EXISTS cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS data_hora_tentativa timestamptz NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS system.auditoria_evento (
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

CREATE INDEX IF NOT EXISTS idx_system_auditoria_evento_tipo_data
  ON system.auditoria_evento (tipo_evento, data_hora_evento DESC);

ALTER TABLE system.auditoria_evento
  ADD COLUMN IF NOT EXISTS identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identificador_sessao uuid REFERENCES sevenlm_connect.sessao(identificador_sessao) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_evento text,
  ADD COLUMN IF NOT EXISTS descricao_evento text,
  ADD COLUMN IF NOT EXISTS detalhes_evento jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS endereco_ip text,
  ADD COLUMN IF NOT EXISTS agente_do_usuario text,
  ADD COLUMN IF NOT EXISTS data_hora_evento timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_hora_criacao timestamptz NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS system.registro_requisicao_http (
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
  corpo_requisicao_json jsonb,
  corpo_requisicao_texto text,
  corpo_requisicao_redigido boolean NOT NULL DEFAULT FALSE,
  motivo_redacao_corpo text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE system.registro_requisicao_http
  ADD COLUMN IF NOT EXISTS identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identificador_sessao uuid REFERENCES sevenlm_connect.sessao(identificador_sessao) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metodo_http text,
  ADD COLUMN IF NOT EXISTS caminho_http text,
  ADD COLUMN IF NOT EXISTS consulta_http text,
  ADD COLUMN IF NOT EXISTS codigo_resposta_http integer,
  ADD COLUMN IF NOT EXISTS duracao_milisegundos integer,
  ADD COLUMN IF NOT EXISTS tamanho_resposta_bytes integer,
  ADD COLUMN IF NOT EXISTS endereco_ip text,
  ADD COLUMN IF NOT EXISTS agente_do_usuario text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS referenciador text,
  ADD COLUMN IF NOT EXISTS cabecalhos_http jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS corpo_requisicao_hash text,
  ADD COLUMN IF NOT EXISTS corpo_requisicao_tamanho integer,
  ADD COLUMN IF NOT EXISTS corpo_requisicao_json jsonb,
  ADD COLUMN IF NOT EXISTS corpo_requisicao_texto text,
  ADD COLUMN IF NOT EXISTS corpo_requisicao_redigido boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_redacao_corpo text,
  ADD COLUMN IF NOT EXISTS data_hora_criacao timestamptz NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_system_registro_requisicao_http_data
  ON system.registro_requisicao_http (data_hora_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_system_registro_requisicao_http_usuario_data
  ON system.registro_requisicao_http (identificador_usuario, data_hora_criacao DESC)
  WHERE identificador_usuario IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_registro_requisicao_http_rota_data
  ON system.registro_requisicao_http (caminho_http, data_hora_criacao DESC);

DO $$
BEGIN
  IF to_regclass('sevenlm_connect.tentativa_de_entrada') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO system.tentativa_de_entrada (
        identificador_tentativa,
        identificador_usuario,
        login_informado,
        indicador_sucesso,
        motivo_falha,
        endereco_ip,
        agente_do_usuario,
        cabecalhos_http,
        data_hora_tentativa
      )
      SELECT
        identificador_tentativa,
        identificador_usuario,
        login_informado,
        indicador_sucesso,
        motivo_falha,
        endereco_ip,
        agente_do_usuario,
        cabecalhos_http,
        data_hora_tentativa
      FROM sevenlm_connect.tentativa_de_entrada
      ON CONFLICT (identificador_tentativa) DO NOTHING
    $sql$;
  END IF;

  IF to_regclass('sevenlm_connect.auditoria_evento') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO system.auditoria_evento (
        identificador_evento,
        identificador_usuario,
        identificador_sessao,
        tipo_evento,
        descricao_evento,
        detalhes_evento,
        endereco_ip,
        agente_do_usuario,
        data_hora_evento,
        data_hora_criacao
      )
      SELECT
        identificador_evento,
        identificador_usuario,
        identificador_sessao,
        tipo_evento,
        descricao_evento,
        detalhes_evento,
        endereco_ip,
        agente_do_usuario,
        data_hora_evento,
        data_hora_criacao
      FROM sevenlm_connect.auditoria_evento
      ON CONFLICT (identificador_evento) DO NOTHING
    $sql$;
  END IF;

  IF to_regclass('sevenlm_connect.registro_requisicao_http') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO system.registro_requisicao_http (
        identificador_requisicao,
        identificador_usuario,
        identificador_sessao,
        metodo_http,
        caminho_http,
        consulta_http,
        codigo_resposta_http,
        duracao_milisegundos,
        tamanho_resposta_bytes,
        endereco_ip,
        agente_do_usuario,
        origem,
        referenciador,
        cabecalhos_http,
        corpo_requisicao_hash,
        corpo_requisicao_tamanho,
        data_hora_criacao
      )
      SELECT
        identificador_requisicao,
        identificador_usuario,
        identificador_sessao,
        metodo_http,
        caminho_http,
        consulta_http,
        codigo_resposta_http,
        duracao_milisegundos,
        tamanho_resposta_bytes,
        endereco_ip,
        agente_do_usuario,
        origem,
        COALESCE(
          CASE WHEN to_jsonb(r) ? 'referenciador' THEN to_jsonb(r)->>'referenciador' END,
          CASE WHEN to_jsonb(r) ? 'referênciador' THEN to_jsonb(r)->>'referênciador' END
        ) AS referenciador,
        cabecalhos_http,
        corpo_requisicao_hash,
        corpo_requisicao_tamanho,
        data_hora_criacao
      FROM sevenlm_connect.registro_requisicao_http r
      ON CONFLICT (identificador_requisicao) DO NOTHING
    $sql$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS recrutamento_selecao.vaga (
  identificador_vaga uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL,
  equipe text NOT NULL,
  cargo text,
  quantidade_vagas integer NOT NULL DEFAULT 1,
  data_abertura date NOT NULL,
  data_fechamento date,
  prazo_desejado date,
  status_vaga text NOT NULL DEFAULT 'EM_ANDAMENTO',
  tipo_solicitacao text,
  prioridade text,
  recrutadora text,
  solicitante text,
  localidade text,
  modalidade text,
  substituicao_de text,
  motivo_abertura text,
  identificador_equipe_vigencia uuid REFERENCES sevenlm_connect.funcionario_equipe_vigencia(identificador_equipe_vigencia) ON DELETE SET NULL,
  diretor_aprovador text,
  diretor_aprovador_email text,
  aprovador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_solicitacao timestamptz NOT NULL DEFAULT NOW(),
  data_aprovacao timestamptz,
  data_inicio_andamento timestamptz,
  observacao text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  alterado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_recrutamento_vaga_quantidade CHECK (quantidade_vagas BETWEEN 1 AND 999),
  CONSTRAINT ck_recrutamento_vaga_datas CHECK (data_fechamento IS NULL OR data_fechamento >= data_abertura),
  CONSTRAINT ck_recrutamento_vaga_status CHECK (status_vaga IN (
    'PENDENTE_APROVACAO',
    'EM_ANDAMENTO',
    'TRIAGEM',
    'ENTREVISTAS',
    'PROPOSTA',
    'FECHADA',
    'CANCELADA',
    'CONGELADA',
    'REPROVADA'
  ))
);

ALTER TABLE recrutamento_selecao.vaga
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS quantidade_vagas integer,
  ADD COLUMN IF NOT EXISTS status_vaga text,
  ADD COLUMN IF NOT EXISTS prazo_desejado date,
  ADD COLUMN IF NOT EXISTS tipo_solicitacao text,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS recrutadora text,
  ADD COLUMN IF NOT EXISTS solicitante text,
  ADD COLUMN IF NOT EXISTS localidade text,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS substituicao_de text,
  ADD COLUMN IF NOT EXISTS motivo_abertura text,
  ADD COLUMN IF NOT EXISTS identificador_equipe_vigencia uuid,
  ADD COLUMN IF NOT EXISTS diretor_aprovador text,
  ADD COLUMN IF NOT EXISTS diretor_aprovador_email text,
  ADD COLUMN IF NOT EXISTS aprovador_usuario uuid,
  ADD COLUMN IF NOT EXISTS data_hora_solicitacao timestamptz,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS data_inicio_andamento timestamptz;

DO $$
BEGIN
  IF to_regclass('sevenlm_connect.dashboard_gc_vaga_manual') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO recrutamento_selecao.vaga (
        identificador_vaga,
        protocolo,
        equipe,
        cargo,
        quantidade_vagas,
        data_abertura,
        data_fechamento,
        prazo_desejado,
        status_vaga,
        tipo_solicitacao,
        prioridade,
        recrutadora,
        solicitante,
        localidade,
        modalidade,
        substituicao_de,
        motivo_abertura,
        identificador_equipe_vigencia,
        diretor_aprovador,
        diretor_aprovador_email,
        aprovador_usuario,
        data_hora_solicitacao,
        data_aprovacao,
        data_inicio_andamento,
        observacao,
        criado_por,
        alterado_por,
        data_hora_criacao,
        data_hora_atualizado_em
      )
      SELECT
        identificador_vaga,
        protocolo,
        equipe,
        cargo,
        COALESCE(NULLIF(quantidade_vagas, 0), 1),
        data_abertura,
        data_fechamento,
        prazo_desejado,
        COALESCE(status_vaga, 'EM_ANDAMENTO'),
        tipo_solicitacao,
        prioridade,
        recrutadora,
        solicitante,
        localidade,
        modalidade,
        substituicao_de,
        motivo_abertura,
        identificador_equipe_vigencia,
        diretor_aprovador,
        diretor_aprovador_email,
        aprovador_usuario,
        COALESCE(data_hora_solicitacao, data_hora_criacao, NOW()),
        data_aprovacao,
        data_inicio_andamento,
        observacao,
        criado_por,
        alterado_por,
        data_hora_criacao,
        data_hora_atualizado_em
      FROM sevenlm_connect.dashboard_gc_vaga_manual
      ON CONFLICT (identificador_vaga) DO NOTHING
    $sql$;
  END IF;
END $$;

UPDATE recrutamento_selecao.vaga
   SET data_hora_solicitacao = COALESCE(data_hora_solicitacao, data_hora_criacao, NOW()),
       quantidade_vagas = LEAST(999, GREATEST(1, COALESCE(quantidade_vagas, 1))),
       status_vaga = CASE
         WHEN status_vaga IN (
           'PENDENTE_APROVACAO',
           'EM_ANDAMENTO',
           'TRIAGEM',
           'ENTREVISTAS',
           'PROPOSTA',
           'FECHADA',
           'CANCELADA',
           'CONGELADA',
           'REPROVADA'
         ) THEN status_vaga
         WHEN data_fechamento IS NOT NULL AND data_fechamento <= CURRENT_DATE THEN 'FECHADA'
         ELSE 'EM_ANDAMENTO'
       END;

ALTER TABLE recrutamento_selecao.vaga
  ALTER COLUMN quantidade_vagas SET DEFAULT 1,
  ALTER COLUMN quantidade_vagas SET NOT NULL,
  ALTER COLUMN status_vaga SET DEFAULT 'EM_ANDAMENTO',
  ALTER COLUMN status_vaga SET NOT NULL,
  ALTER COLUMN data_hora_solicitacao SET DEFAULT NOW(),
  ALTER COLUMN data_hora_solicitacao SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recrutamento_vaga_protocolo
  ON recrutamento_selecao.vaga (lower(protocolo));

CREATE INDEX IF NOT EXISTS idx_recrutamento_vaga_status
  ON recrutamento_selecao.vaga (status_vaga, data_abertura DESC);

CREATE INDEX IF NOT EXISTS idx_recrutamento_vaga_equipe
  ON recrutamento_selecao.vaga (equipe);

CREATE INDEX IF NOT EXISTS idx_recrutamento_vaga_aprovacao
  ON recrutamento_selecao.vaga (status_vaga, aprovador_usuario, data_hora_solicitacao DESC);

CREATE TABLE IF NOT EXISTS recrutamento_selecao.vaga_andamento (
  identificador_andamento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_vaga uuid NOT NULL REFERENCES recrutamento_selecao.vaga(identificador_vaga) ON DELETE CASCADE,
  descricao text NOT NULL,
  status_vaga text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  criado_por_nome text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_recrutamento_vaga_andamento_descricao CHECK (length(trim(descricao)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_recrutamento_vaga_andamento_vaga
  ON recrutamento_selecao.vaga_andamento (identificador_vaga, data_hora_criacao DESC);

DO $$
BEGIN
  IF to_regclass('sevenlm_connect.dashboard_gc_vaga_manual_andamento') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO recrutamento_selecao.vaga_andamento (
        identificador_andamento,
        identificador_vaga,
        descricao,
        status_vaga,
        criado_por,
        criado_por_nome,
        data_hora_criacao
      )
      SELECT
        identificador_andamento,
        identificador_vaga,
        descricao,
        status_vaga,
        criado_por,
        criado_por_nome,
        data_hora_criacao
      FROM sevenlm_connect.dashboard_gc_vaga_manual_andamento
      ON CONFLICT (identificador_andamento) DO NOTHING
    $sql$;
  END IF;
END $$;

DO $$
DECLARE
  objeto record;
BEGIN
  FOR objeto IN
    SELECT *
      FROM (
        VALUES
          (to_regclass('sevenlm_connect.dashboard_gc_vaga_manual_andamento'), 'sevenlm_connect.dashboard_gc_vaga_manual_andamento'),
          (to_regclass('sevenlm_connect.dashboard_gc_vaga_manual'), 'sevenlm_connect.dashboard_gc_vaga_manual'),
          (to_regclass('sevenlm_connect.registro_requisicao_http'), 'sevenlm_connect.registro_requisicao_http'),
          (to_regclass('sevenlm_connect.auditoria_evento'), 'sevenlm_connect.auditoria_evento'),
          (to_regclass('sevenlm_connect.tentativa_de_entrada'), 'sevenlm_connect.tentativa_de_entrada')
      ) AS alvo(oid_objeto, nome_objeto)
  LOOP
    IF objeto.oid_objeto IS NULL THEN
      CONTINUE;
    END IF;

    IF (SELECT relkind FROM pg_class WHERE oid = objeto.oid_objeto) = 'v' THEN
      EXECUTE format('DROP VIEW IF EXISTS %s', objeto.nome_objeto);
    ELSIF (SELECT relkind FROM pg_class WHERE oid = objeto.oid_objeto) IN ('r', 'p') THEN
      EXECUTE format('DROP TABLE IF EXISTS %s', objeto.nome_objeto);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW sevenlm_connect.tentativa_de_entrada AS
SELECT * FROM system.tentativa_de_entrada;

CREATE OR REPLACE VIEW sevenlm_connect.auditoria_evento AS
SELECT * FROM system.auditoria_evento;

CREATE OR REPLACE VIEW sevenlm_connect.registro_requisicao_http AS
SELECT
  identificador_requisicao,
  identificador_usuario,
  identificador_sessao,
  metodo_http,
  caminho_http,
  consulta_http,
  codigo_resposta_http,
  duracao_milisegundos,
  tamanho_resposta_bytes,
  endereco_ip,
  agente_do_usuario,
  origem,
  referenciador AS "referênciador",
  cabecalhos_http,
  corpo_requisicao_hash,
  corpo_requisicao_tamanho,
  data_hora_criacao
FROM system.registro_requisicao_http;

CREATE OR REPLACE VIEW sevenlm_connect.dashboard_gc_vaga_manual AS
SELECT * FROM recrutamento_selecao.vaga;

CREATE OR REPLACE VIEW sevenlm_connect.dashboard_gc_vaga_manual_andamento AS
SELECT * FROM recrutamento_selecao.vaga_andamento;
