BEGIN;

CREATE TABLE IF NOT EXISTS connect_comercial.aprovacao_excecao (
  identificador_aprovacao uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_imovel uuid NOT NULL REFERENCES connect_comercial.imovel(identificador_imovel),
  identificador_cliente uuid NOT NULL REFERENCES connect_comercial.cliente(identificador_cliente),
  identificador_simulacao uuid NOT NULL REFERENCES connect_comercial.simulacao(identificador_simulacao),
  identificador_reserva uuid NOT NULL REFERENCES connect_comercial.imovel_reserva(identificador_reserva),
  status text NOT NULL DEFAULT 'PENDENTE',
  motivo text NOT NULL,
  observacoes_solicitacao text,
  solicitado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  solicitado_em timestamptz NOT NULL DEFAULT NOW(),
  avaliado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  avaliado_em timestamptz,
  observacoes_avaliacao text,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_garantido_planejado numeric(14,2) NOT NULL DEFAULT 0,
  valor_garantido_real numeric(14,2) NOT NULL DEFAULT 0,
  valor_garantido_pre_obra_planejado numeric(14,2) NOT NULL DEFAULT 0,
  valor_garantido_pre_obra_real numeric(14,2) NOT NULL DEFAULT 0,
  gap_garantia numeric(14,2) NOT NULL DEFAULT 0,
  gap_pre_obra numeric(14,2) NOT NULL DEFAULT 0,
  percentual_gap_garantia numeric(8,4) NOT NULL DEFAULT 0,
  percentual_gap_pre_obra numeric(8,4) NOT NULL DEFAULT 0,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_aprovacao_excecao_status CHECK (status IN ('PENDENTE', 'APROVADA', 'REPROVADA', 'CANCELADA'))
);

CREATE INDEX IF NOT EXISTS idx_aprovacao_excecao_status_data
  ON connect_comercial.aprovacao_excecao (status, solicitado_em DESC);

CREATE INDEX IF NOT EXISTS idx_aprovacao_excecao_imovel
  ON connect_comercial.aprovacao_excecao (identificador_imovel, solicitado_em DESC);

CREATE INDEX IF NOT EXISTS idx_aprovacao_excecao_cliente
  ON connect_comercial.aprovacao_excecao (identificador_cliente, solicitado_em DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aprovacao_excecao_reserva_pendente
  ON connect_comercial.aprovacao_excecao (identificador_reserva)
  WHERE status = 'PENDENTE';

DROP TRIGGER IF EXISTS trg_aprovacao_excecao_data_hora_atualizado_em ON connect_comercial.aprovacao_excecao;
CREATE TRIGGER trg_aprovacao_excecao_data_hora_atualizado_em
BEFORE UPDATE ON connect_comercial.aprovacao_excecao
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

ALTER TABLE connect_comercial.imovel_reserva
  DROP CONSTRAINT IF EXISTS ck_imovel_reserva_status;

ALTER TABLE connect_comercial.imovel_reserva
  ADD CONSTRAINT ck_imovel_reserva_status
  CHECK (status IN ('ATIVA', 'PENDENTE_APROVACAO', 'LIBERADA', 'CONVERTIDA', 'EXPIRADA'));

DROP INDEX IF EXISTS connect_comercial.uq_imovel_reserva_ativa_por_imovel;
CREATE UNIQUE INDEX uq_imovel_reserva_ativa_por_imovel
  ON connect_comercial.imovel_reserva (identificador_imovel)
  WHERE status IN ('ATIVA', 'PENDENTE_APROVACAO');

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('aprovacoes.excecao.view', 'Permite visualizar solicitações de aprovação excepcional do simulador.'),
  ('aprovacoes.excecao.manage', 'Permite avaliar, aprovar ou reprovar solicitações excepcionais do simulador.')
ON CONFLICT (nome_permissao) DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
  FROM sevenlm_connect.perfil perfil
  JOIN sevenlm_connect.permissao permissao
    ON permissao.nome_permissao IN ('aprovacoes.excecao.view', 'aprovacoes.excecao.manage')
 WHERE perfil.nome_perfil IN ('Administrador do Portal', 'Gerente Comercial', 'Gestor Comercial')
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
  'aprovacoes',
  'Aprovações excepcionais',
  '/administracao/aprovacoes',
  'check-circle',
  15,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'aprovacoes.excecao.manage'
WHERE pv.nome_permissao = 'aprovacoes.excecao.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO NOTHING;

COMMIT;
