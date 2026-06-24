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
    RAISE EXCEPTION 'Schema sevenlm_connect não encontrado para herdar o proprietário.';
  END IF;

  IF to_regnamespace('connect_comercial') IS NULL THEN
    EXECUTE format('CREATE SCHEMA connect_comercial AUTHORIZATION %I', v_dono);
  ELSE
    EXECUTE format('ALTER SCHEMA connect_comercial OWNER TO %I', v_dono);
  END IF;
END
$$;

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

DROP TRIGGER IF EXISTS trg_cliente_data_hora_atualizado_em ON connect_comercial.cliente;
CREATE TRIGGER trg_cliente_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.cliente
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

COMMIT;
