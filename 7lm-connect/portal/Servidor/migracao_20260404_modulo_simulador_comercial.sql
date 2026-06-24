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

CREATE TABLE IF NOT EXISTS connect_comercial.cliente_complemento_renda (
  identificador_complemento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_cliente uuid NOT NULL REFERENCES connect_comercial.cliente(identificador_cliente) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL,
  parentesco text,
  renda numeric(14,2) NOT NULL,
  incluir_na_analise boolean NOT NULL DEFAULT TRUE,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_cliente_complemento_renda_valor CHECK (renda >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_complemento_renda_cliente_cpf
  ON connect_comercial.cliente_complemento_renda (identificador_cliente, cpf);

CREATE INDEX IF NOT EXISTS idx_cliente_complemento_renda_cliente
  ON connect_comercial.cliente_complemento_renda (identificador_cliente, data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.simulacao (
  identificador_simulacao uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_cliente uuid NOT NULL REFERENCES connect_comercial.cliente(identificador_cliente),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel),
  empreendimento text,
  identificador_corretor uuid,
  renda_principal numeric(14,2) NOT NULL,
  renda_complementar numeric(14,2) NOT NULL,
  renda_total numeric(14,2) NOT NULL,
  limite_comprometimento numeric(14,2) NOT NULL,
  percentual_comprometimento numeric(8,4) NOT NULL,
  valor_imovel numeric(14,2) NOT NULL,
  valor_total_operacao numeric(14,2) NOT NULL,
  financiamento_caixa numeric(14,2) NOT NULL,
  fgts numeric(14,2) NOT NULL,
  subsidio numeric(14,2) NOT NULL,
  entrada numeric(14,2) NOT NULL,
  pro_soluto_total numeric(14,2) NOT NULL,
  sobrepreco numeric(14,2) NOT NULL,
  percentual_fechamento_inicial numeric(8,4) NOT NULL,
  classificacao_fechamento_inicial text NOT NULL,
  percentual_projetado_entrega numeric(8,4) NOT NULL,
  classificacao_projecao_entrega text NOT NULL,
  saldo_pos_entrega numeric(14,2) NOT NULL,
  meses_pre_entrega integer NOT NULL,
  meses_pos_entrega integer NOT NULL,
  status_simulacao text NOT NULL,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_simulacao_percentual_comprometimento CHECK (percentual_comprometimento >= 0),
  CONSTRAINT ck_simulacao_percentual_fechamento_inicial CHECK (percentual_fechamento_inicial >= 0),
  CONSTRAINT ck_simulacao_percentual_projetado_entrega CHECK (percentual_projetado_entrega >= 0),
  CONSTRAINT ck_simulacao_meses_pre_entrega CHECK (meses_pre_entrega >= 0),
  CONSTRAINT ck_simulacao_meses_pos_entrega CHECK (meses_pos_entrega BETWEEN 0 AND 80),
  CONSTRAINT ck_simulacao_prazo_total_max_80 CHECK (
    meses_pre_entrega BETWEEN 0 AND 80
    AND meses_pos_entrega BETWEEN 0 AND 80
    AND (meses_pre_entrega + meses_pos_entrega) <= 80
  ),
  CONSTRAINT ck_simulacao_valores_nao_negativos CHECK (
    renda_principal >= 0
    AND renda_complementar >= 0
    AND renda_total >= 0
    AND limite_comprometimento >= 0
    AND valor_imovel >= 0
    AND valor_total_operacao >= 0
    AND financiamento_caixa >= 0
    AND fgts >= 0
    AND subsidio >= 0
    AND entrada >= 0
    AND pro_soluto_total >= 0
    AND sobrepreco >= 0
    AND saldo_pos_entrega >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_simulacao_cliente_data
  ON connect_comercial.simulacao (identificador_cliente, data_hora_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_simulacao_imovel_data
  ON connect_comercial.simulacao (identificador_imovel, data_hora_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_simulacao_status
  ON connect_comercial.simulacao (status_simulacao);

CREATE TABLE IF NOT EXISTS connect_comercial.simulacao_parcela (
  identificador_parcela uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_simulacao uuid NOT NULL REFERENCES connect_comercial.simulacao(identificador_simulacao) ON DELETE CASCADE,
  fase text NOT NULL,
  tipo_parcela text NOT NULL,
  numero_parcela integer NOT NULL,
  vencimento_previsto date,
  valor_parcela numeric(14,2) NOT NULL,
  percentual_renda_comprometido numeric(8,4),
  observacao text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_simulacao_parcela_numero CHECK (numero_parcela >= 1),
  CONSTRAINT ck_simulacao_parcela_valor CHECK (valor_parcela >= 0),
  CONSTRAINT ck_simulacao_parcela_percentual CHECK (
    percentual_renda_comprometido IS NULL OR percentual_renda_comprometido >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_simulacao_parcela_simulacao
  ON connect_comercial.simulacao_parcela (identificador_simulacao, fase, numero_parcela);

CREATE TABLE IF NOT EXISTS connect_comercial.imovel_reserva (
  identificador_reserva uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel),
  identificador_cliente uuid REFERENCES connect_comercial.cliente(identificador_cliente),
  identificador_simulacao uuid REFERENCES connect_comercial.simulacao(identificador_simulacao),
  status text NOT NULL,
  reservado_por uuid,
  reservado_em timestamptz,
  expiracao_em timestamptz,
  observacoes text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_imovel_reserva_status CHECK (status IN ('ATIVA', 'LIBERADA', 'CONVERTIDA', 'EXPIRADA'))
);

CREATE INDEX IF NOT EXISTS idx_imovel_reserva_imovel
  ON connect_comercial.imovel_reserva (identificador_imovel, data_hora_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_imovel_reserva_cliente
  ON connect_comercial.imovel_reserva (identificador_cliente, data_hora_criacao DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_imovel_reserva_ativa_por_imovel
  ON connect_comercial.imovel_reserva (identificador_imovel)
  WHERE status = 'ATIVA';

CREATE TABLE IF NOT EXISTS connect_comercial.historico_status_imovel (
  identificador_historico uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel),
  status_anterior text,
  status_novo text NOT NULL,
  identificador_simulacao uuid REFERENCES connect_comercial.simulacao(identificador_simulacao),
  identificador_cliente uuid REFERENCES connect_comercial.cliente(identificador_cliente),
  alterado_por uuid,
  observacoes text,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_status_imovel_data
  ON connect_comercial.historico_status_imovel (identificador_imovel, data_hora_criacao DESC);

CREATE TABLE IF NOT EXISTS connect_comercial.politica_comercial_empreendimento (
  identificador_politica uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento text NOT NULL,
  percentual_fechamento_ideal numeric(5,4) NOT NULL DEFAULT 0.9000,
  percentual_fechamento_minimo numeric(5,4) NOT NULL DEFAULT 0.8500,
  percentual_quitacao_entrega_ideal numeric(5,4) NOT NULL DEFAULT 1.0000,
  percentual_quitacao_entrega_minimo numeric(5,4) NOT NULL DEFAULT 0.9500,
  limite_comprometimento numeric(5,4) NOT NULL DEFAULT 0.4500,
  ativo boolean NOT NULL DEFAULT TRUE,
  payload_regras jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_politica_percentuais_validos CHECK (
    percentual_fechamento_ideal >= 0
    AND percentual_fechamento_minimo >= 0
    AND percentual_quitacao_entrega_ideal >= 0
    AND percentual_quitacao_entrega_minimo >= 0
    AND limite_comprometimento > 0
    AND limite_comprometimento <= 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_comercial_empreendimento_nome
  ON connect_comercial.politica_comercial_empreendimento (empreendimento);

DROP TRIGGER IF EXISTS trg_cliente_complemento_renda_data_hora_atualizado_em ON connect_comercial.cliente_complemento_renda;
CREATE TRIGGER trg_cliente_complemento_renda_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.cliente_complemento_renda
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_simulacao_data_hora_atualizado_em ON connect_comercial.simulacao;
CREATE TRIGGER trg_simulacao_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.simulacao
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_imovel_reserva_data_hora_atualizado_em ON connect_comercial.imovel_reserva;
CREATE TRIGGER trg_imovel_reserva_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.imovel_reserva
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

DROP TRIGGER IF EXISTS trg_politica_comercial_empreendimento_data_hora_atualizado_em ON connect_comercial.politica_comercial_empreendimento;
CREATE TRIGGER trg_politica_comercial_empreendimento_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.politica_comercial_empreendimento
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

INSERT INTO connect_comercial.politica_comercial_empreendimento (
  empreendimento,
  percentual_fechamento_ideal,
  percentual_fechamento_minimo,
  percentual_quitacao_entrega_ideal,
  percentual_quitacao_entrega_minimo,
  limite_comprometimento,
  ativo
)
VALUES (
  'POLITICA_PADRAO_CONNECT_COMERCIAL',
  0.9000,
  0.8500,
  1.0000,
  0.9500,
  0.4500,
  TRUE
)
ON CONFLICT (empreendimento) DO NOTHING;

COMMIT;
