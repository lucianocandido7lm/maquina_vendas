-- Executar com:
-- \i C:/Projetos Pessoais/7LM/7LM Connect/01_portal_em_node/Servidor/migracao_20260401_remover_matricula_gip.sql

BEGIN;

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

DROP INDEX IF EXISTS sevenlm_connect.idx_usuario_matricula_gip;

ALTER TABLE sevenlm_connect.usuario
  DROP COLUMN IF EXISTS matricula_gip;

COMMIT;
