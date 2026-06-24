CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS tipo_vinculo text,
  ADD COLUMN IF NOT EXISTS gerente_documento text,
  ADD COLUMN IF NOT EXISTS gerente_email citext,
  ADD COLUMN IF NOT EXISTS gerente text,
  ADD COLUMN IF NOT EXISTS diretor_documento text,
  ADD COLUMN IF NOT EXISTS diretor_email citext,
  ADD COLUMN IF NOT EXISTS diretor text;

ALTER TABLE sevenlm_connect.funcionario_acesso
  DROP CONSTRAINT IF EXISTS ck_funcionario_acesso_tipo;

ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD CONSTRAINT ck_funcionario_acesso_tipo
    CHECK (tipo_funcionario IN ('FUNCIONARIO', 'CORRETOR', 'SDR', 'OUTRO'));

ALTER TABLE sevenlm_connect.funcionario_acesso
  DROP CONSTRAINT IF EXISTS ck_funcionario_acesso_tipo_vinculo;

ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD CONSTRAINT ck_funcionario_acesso_tipo_vinculo
    CHECK (tipo_vinculo IS NULL OR tipo_vinculo IN ('CLT', 'PJ', 'AUTONOMO'));

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_matricula
  ON sevenlm_connect.funcionario_acesso (matricula)
  WHERE matricula IS NOT NULL AND btrim(matricula) <> '';

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_tipo_vinculo
  ON sevenlm_connect.funcionario_acesso (tipo_vinculo);

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_imobiliaria
  ON sevenlm_connect.funcionario_acesso USING gin (imobiliaria gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_lideranca
  ON sevenlm_connect.funcionario_acesso USING gin (
    (coalesce(coordenador, '') || ' ' || coalesce(gerente, '') || ' ' || coalesce(diretor, '')) gin_trgm_ops
  );

ALTER TABLE sevenlm_connect.funcionario_status_diario
  ADD COLUMN IF NOT EXISTS snapshot_matricula text,
  ADD COLUMN IF NOT EXISTS snapshot_tipo_vinculo text,
  ADD COLUMN IF NOT EXISTS snapshot_imobiliaria text,
  ADD COLUMN IF NOT EXISTS snapshot_coordenador text,
  ADD COLUMN IF NOT EXISTS snapshot_gerente text,
  ADD COLUMN IF NOT EXISTS snapshot_diretor text;

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
    snapshot_matricula,
    snapshot_tipo_funcionario,
    snapshot_tipo_vinculo,
    snapshot_imobiliaria,
    snapshot_gestor,
    snapshot_coordenador,
    snapshot_gerente,
    snapshot_diretor,
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
      WHEN f.email IS NULL OR btrim(f.email::text) = '' THEN 'SEM_EMAIL'
      WHEN f.ativo_login IS TRUE THEN 'LIBERADO'
      WHEN f.ativo_login IS FALSE THEN 'BLOQUEADO'
      ELSE 'PENDENTE'
    END,
    CASE
      WHEN COALESCE(f.ativo, TRUE) IS TRUE THEN 'ATIVO'
      ELSE 'INATIVO'
    END,
    f.nome,
    f.email,
    f.documento,
    f.matricula,
    f.tipo_funcionario,
    f.tipo_vinculo,
    f.imobiliaria,
    f.gestor,
    f.coordenador,
    f.gerente,
    f.diretor,
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
