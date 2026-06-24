CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sevenlm_connect.funcionario_acesso (
  identificador_funcionario uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_funcionario text NOT NULL DEFAULT 'CORRETOR',
  documento text,
  email citext,
  nome text NOT NULL,
  imobiliaria text,
  gestor_documento text,
  gestor_email citext,
  gestor text,
  coordenador_documento text,
  coordenador_email citext,
  coordenador text,
  regional text,
  regiao text,
  ativo_negocio boolean,
  ativo boolean NOT NULL DEFAULT TRUE,
  ativo_login boolean,
  data_cadastro_usuario timestamptz,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  referencia_origem text,
  origem_planilha text,
  cadastrado_por text,
  identificador_usuario uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_importacao timestamptz,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_funcionario_acesso_tipo
    CHECK (tipo_funcionario IN ('CORRETOR', 'SDR', 'OUTRO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionario_acesso_tipo_documento
  ON sevenlm_connect.funcionario_acesso (tipo_funcionario, documento)
  WHERE documento IS NOT NULL AND btrim(documento) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionario_acesso_tipo_email
  ON sevenlm_connect.funcionario_acesso (tipo_funcionario, lower(email::text))
  WHERE email IS NOT NULL AND btrim(email::text) <> '';

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_nome
  ON sevenlm_connect.funcionario_acesso USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_usuario
  ON sevenlm_connect.funcionario_acesso (identificador_usuario);

DROP TRIGGER IF EXISTS trg_funcionario_acesso_atualizado_em ON sevenlm_connect.funcionario_acesso;
CREATE TRIGGER trg_funcionario_acesso_atualizado_em
BEFORE UPDATE ON sevenlm_connect.funcionario_acesso
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

CREATE TABLE IF NOT EXISTS sevenlm_connect.funcionario_status_diario (
  identificador_status uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_funcionario uuid NOT NULL REFERENCES sevenlm_connect.funcionario_acesso(identificador_funcionario) ON DELETE CASCADE,
  data_status date NOT NULL,
  status_negocio text NOT NULL DEFAULT 'PENDENTE',
  status_login text NOT NULL DEFAULT 'PENDENTE',
  status_operacional text NOT NULL DEFAULT 'PENDENTE',
  observacao text,
  snapshot_nome text NOT NULL,
  snapshot_email citext,
  snapshot_documento text,
  snapshot_tipo_funcionario text NOT NULL,
  snapshot_gestor text,
  snapshot_regional text,
  snapshot_regiao text,
  snapshot_ativo_negocio boolean,
  snapshot_ativo boolean,
  snapshot_ativo_login boolean,
  atualizado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_funcionario_status_diario UNIQUE (identificador_funcionario, data_status)
);

CREATE INDEX IF NOT EXISTS idx_funcionario_status_diario_data
  ON sevenlm_connect.funcionario_status_diario (data_status, status_operacional);

DROP TRIGGER IF EXISTS trg_funcionario_status_diario_atualizado_em ON sevenlm_connect.funcionario_status_diario;
CREATE TRIGGER trg_funcionario_status_diario_atualizado_em
BEFORE UPDATE ON sevenlm_connect.funcionario_status_diario
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

CREATE OR REPLACE FUNCTION sevenlm_connect.fn_gerar_funcionario_status_diario(p_data_status date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer := 0;
BEGIN
  INSERT INTO sevenlm_connect.funcionario_status_diario (
    identificador_funcionario,
    data_status,
    status_negocio,
    status_login,
    status_operacional,
    snapshot_nome,
    snapshot_email,
    snapshot_documento,
    snapshot_tipo_funcionario,
    snapshot_gestor,
    snapshot_regional,
    snapshot_regiao,
    snapshot_ativo_negocio,
    snapshot_ativo,
    snapshot_ativo_login
  )
  SELECT
    f.identificador_funcionario,
    COALESCE(p_data_status, CURRENT_DATE),
    CASE
      WHEN f.ativo_negocio IS TRUE THEN 'ATIVO'
      WHEN f.ativo_negocio IS FALSE THEN 'INATIVO'
      ELSE 'PENDENTE'
    END,
    CASE
      WHEN f.ativo_login IS TRUE THEN 'LIBERADO'
      WHEN f.ativo_login IS FALSE THEN 'SEM_LOGIN'
      ELSE 'PENDENTE'
    END,
    CASE
      WHEN COALESCE(f.ativo, TRUE) IS TRUE THEN 'ATIVO'
      ELSE 'INATIVO'
    END,
    f.nome,
    f.email,
    f.documento,
    f.tipo_funcionario,
    f.gestor,
    f.regional,
    f.regiao,
    f.ativo_negocio,
    f.ativo,
    f.ativo_login
  FROM sevenlm_connect.funcionario_acesso f
  WHERE COALESCE(f.ativo, TRUE) = TRUE
  ON CONFLICT (identificador_funcionario, data_status) DO NOTHING;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;
