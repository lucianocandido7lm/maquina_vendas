BEGIN;

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
END
$$;

ALTER TABLE connect_comercial.cliente
  ADD COLUMN IF NOT EXISTS cpf_normalizado varchar(11),
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  ADD COLUMN IF NOT EXISTS nome_pai text,
  ADD COLUMN IF NOT EXISTS regime_casamento text,
  ADD COLUMN IF NOT EXISTS escolaridade text,
  ADD COLUMN IF NOT EXISTS situacao_moradia text,
  ADD COLUMN IF NOT EXISTS renda_formal numeric(14,2),
  ADD COLUMN IF NOT EXISTS renda_informal numeric(14,2),
  ADD COLUMN IF NOT EXISTS documentacao_pendente text,
  ADD COLUMN IF NOT EXISTS status_documental text;

UPDATE connect_comercial.cliente
   SET cpf_normalizado = nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '')
 WHERE cpf IS NOT NULL
   AND (
      cpf_normalizado IS NULL
      OR cpf_normalizado = ''
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_cpf_normalizado
  ON connect_comercial.cliente (cpf_normalizado)
  WHERE cpf_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_status_documental
  ON connect_comercial.cliente (status_documental);

CREATE TABLE IF NOT EXISTS connect_comercial.composicao_familiar_cliente (
  identificador_membro uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_cliente_principal uuid NOT NULL REFERENCES connect_comercial.cliente(identificador_cliente) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  cpf_normalizado varchar(11) NOT NULL,
  rg text,
  data_nascimento date,
  sexo text,
  estado_civil text,
  regime_casamento text,
  nacionalidade text,
  nome_mae text,
  nome_pai text,
  parentesco text NOT NULL,
  telefone text,
  celular text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  mora_com_cliente_principal boolean NOT NULL DEFAULT FALSE,
  usar_endereco_cliente_principal boolean NOT NULL DEFAULT FALSE,
  renda_mensal numeric(14,2),
  outras_rendas numeric(14,2),
  renda_total numeric(14,2),
  renda_formal numeric(14,2),
  renda_informal numeric(14,2),
  despesas_fixas numeric(14,2),
  despesas_variaveis numeric(14,2),
  financiamentos text,
  profissao text,
  ocupacao text,
  empresa_atual text,
  cargo text,
  tempo_emprego_anos integer,
  tipo_contrato text,
  escolaridade text,
  situacao_moradia text,
  compoe_renda boolean NOT NULL DEFAULT TRUE,
  incluir_na_analise boolean NOT NULL DEFAULT TRUE,
  incluir_na_composicao_financeira boolean NOT NULL DEFAULT TRUE,
  incluir_na_confissao_divida boolean NOT NULL DEFAULT FALSE,
  responsavel_documentacao boolean NOT NULL DEFAULT FALSE,
  principal_comprador boolean NOT NULL DEFAULT FALSE,
  documentacao_pendente text,
  status_documental text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT TRUE,
  data_hora_desativacao timestamptz,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_composicao_familiar_tempo_emprego CHECK (tempo_emprego_anos IS NULL OR tempo_emprego_anos >= 0),
  CONSTRAINT ck_composicao_familiar_renda_mensal CHECK (renda_mensal IS NULL OR renda_mensal >= 0),
  CONSTRAINT ck_composicao_familiar_outras_rendas CHECK (outras_rendas IS NULL OR outras_rendas >= 0),
  CONSTRAINT ck_composicao_familiar_renda_total CHECK (renda_total IS NULL OR renda_total >= 0),
  CONSTRAINT ck_composicao_familiar_renda_formal CHECK (renda_formal IS NULL OR renda_formal >= 0),
  CONSTRAINT ck_composicao_familiar_renda_informal CHECK (renda_informal IS NULL OR renda_informal >= 0),
  CONSTRAINT ck_composicao_familiar_despesas_fixas CHECK (despesas_fixas IS NULL OR despesas_fixas >= 0),
  CONSTRAINT ck_composicao_familiar_despesas_variaveis CHECK (despesas_variaveis IS NULL OR despesas_variaveis >= 0)
);

CREATE INDEX IF NOT EXISTS idx_composicao_familiar_cliente_principal
  ON connect_comercial.composicao_familiar_cliente (identificador_cliente_principal, data_hora_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_composicao_familiar_flags_analise
  ON connect_comercial.composicao_familiar_cliente (
    identificador_cliente_principal,
    ativo,
    incluir_na_analise,
    compoe_renda
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_composicao_familiar_cpf_normalizado_ativo
  ON connect_comercial.composicao_familiar_cliente (cpf_normalizado)
  WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS connect_comercial.composicao_familiar_documento (
  identificador_documento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_membro uuid NOT NULL REFERENCES connect_comercial.composicao_familiar_cliente(identificador_membro) ON DELETE CASCADE,
  categoria_documento text NOT NULL,
  nome_arquivo text,
  caminho_arquivo text,
  tipo_mime text,
  tamanho_bytes bigint,
  observacoes text,
  ativo boolean NOT NULL DEFAULT TRUE,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_composicao_familiar_documento_tamanho CHECK (tamanho_bytes IS NULL OR tamanho_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_composicao_familiar_documento_membro
  ON connect_comercial.composicao_familiar_documento (identificador_membro, data_hora_criacao DESC);

DO $$
BEGIN
  IF to_regclass('connect_comercial.cliente_complemento_renda') IS NOT NULL THEN
    INSERT INTO connect_comercial.composicao_familiar_cliente (
      identificador_cliente_principal,
      nome_completo,
      cpf,
      cpf_normalizado,
      parentesco,
      renda_mensal,
      renda_total,
      compoe_renda,
      incluir_na_analise,
      incluir_na_composicao_financeira,
      ativo,
      observacoes
    )
    SELECT
      ccr.identificador_cliente,
      ccr.nome,
      ccr.cpf,
      nullif(regexp_replace(coalesce(ccr.cpf, ''), '\D', '', 'g'), ''),
      ccr.parentesco,
      ccr.renda,
      ccr.renda,
      TRUE,
      coalesce(ccr.incluir_na_analise, TRUE),
      TRUE,
      coalesce(ccr.incluir_na_analise, TRUE),
      'Registro migrado automaticamente de cliente_complemento_renda.'
    FROM connect_comercial.cliente_complemento_renda ccr
    WHERE nullif(regexp_replace(coalesce(ccr.cpf, ''), '\D', '', 'g'), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
          FROM connect_comercial.composicao_familiar_cliente cfc
         WHERE cfc.identificador_cliente_principal = ccr.identificador_cliente
           AND cfc.cpf_normalizado = nullif(regexp_replace(coalesce(ccr.cpf, ''), '\D', '', 'g'), '')
      );
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_composicao_familiar_cliente_data_hora_atualizado_em ON connect_comercial.composicao_familiar_cliente;
CREATE TRIGGER trg_composicao_familiar_cliente_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.composicao_familiar_cliente
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_composicao_familiar_documento_data_hora_atualizado_em ON connect_comercial.composicao_familiar_documento;
CREATE TRIGGER trg_composicao_familiar_documento_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.composicao_familiar_documento
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

COMMIT;
