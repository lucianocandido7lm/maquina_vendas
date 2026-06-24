BEGIN;

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('maq.credito.view', 'Permite visualizar o módulo Máquina de Crédito.'),
  ('maq.credito.manage', 'Permite gerenciar o módulo Máquina de Crédito.')
ON CONFLICT (nome_permissao) DO UPDATE
SET descricao_permissao = EXCLUDED.descricao_permissao;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT DISTINCT perfil.identificador_perfil, permissao_nova.identificador_permissao
FROM sevenlm_connect.perfil perfil
CROSS JOIN sevenlm_connect.permissao permissao_nova
WHERE permissao_nova.nome_permissao = 'maq.credito.view'
  AND (
    perfil.nome_perfil = 'Administrador do Portal'
    OR EXISTS (
      SELECT 1
      FROM sevenlm_connect.perfil_permissao perfil_permissao_existente
      JOIN sevenlm_connect.permissao permissao_existente
        ON permissao_existente.identificador_permissao = perfil_permissao_existente.identificador_permissao
      WHERE perfil_permissao_existente.identificador_perfil = perfil.identificador_perfil
        AND permissao_existente.nome_permissao IN (
          'dashboard.comercial.view',
          'dashboard.comercial.manage',
          'maquina.vendas.dashboard.view',
          'maquina.vendas.dashboard.manage',
          'imoveis.view',
          'imoveis.manage',
          'administracao.view',
          'administracao.manage',
          'ACESSO_TOTAL',
          'GERENCIAR_ACESSO'
        )
    )
  )
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT DISTINCT perfil.identificador_perfil, permissao_nova.identificador_permissao
FROM sevenlm_connect.perfil perfil
CROSS JOIN sevenlm_connect.permissao permissao_nova
WHERE permissao_nova.nome_permissao = 'maq.credito.manage'
  AND (
    perfil.nome_perfil = 'Administrador do Portal'
    OR EXISTS (
      SELECT 1
      FROM sevenlm_connect.perfil_permissao perfil_permissao_existente
      JOIN sevenlm_connect.permissao permissao_existente
        ON permissao_existente.identificador_permissao = perfil_permissao_existente.identificador_permissao
      WHERE perfil_permissao_existente.identificador_perfil = perfil.identificador_perfil
        AND permissao_existente.nome_permissao IN (
          'dashboard.comercial.manage',
          'maquina.vendas.dashboard.manage',
          'imoveis.manage',
          'administracao.manage',
          'ACESSO_TOTAL',
          'GERENCIAR_ACESSO'
        )
    )
  )
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.portal_recurso (
  codigo_modulo,
  codigo_recurso,
  nome_recurso,
  rota_recurso,
  icone_recurso,
  ordem_exibicao,
  indicador_ativo,
  indicador_em_construcao,
  identificador_permissao_visualizar,
  identificador_permissao_gerenciar
)
SELECT
  'maq_credito',
  'painel',
  'Máquina de Crédito',
  '/maq-credito',
  'credit-card',
  25,
  TRUE,
  FALSE,
  permissao_visualizar.identificador_permissao,
  permissao_gerenciar.identificador_permissao
FROM sevenlm_connect.permissao permissao_visualizar
JOIN sevenlm_connect.permissao permissao_gerenciar
  ON permissao_gerenciar.nome_permissao = 'maq.credito.manage'
WHERE permissao_visualizar.nome_permissao = 'maq.credito.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO UPDATE
SET nome_recurso = EXCLUDED.nome_recurso,
    rota_recurso = EXCLUDED.rota_recurso,
    icone_recurso = EXCLUDED.icone_recurso,
    ordem_exibicao = EXCLUDED.ordem_exibicao,
    indicador_ativo = TRUE,
    indicador_em_construcao = FALSE,
    identificador_permissao_visualizar = EXCLUDED.identificador_permissao_visualizar,
    identificador_permissao_gerenciar = EXCLUDED.identificador_permissao_gerenciar,
    data_hora_atualizado_em = NOW();

COMMIT;
