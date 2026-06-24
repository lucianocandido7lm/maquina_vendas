BEGIN;

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('funcionarios.acesso.view', 'Permite visualizar cadastro, logins e quadro diario de funcionarios.'),
  ('funcionarios.acesso.manage', 'Permite cadastrar, importar, editar funcionarios, criar logins e manter o quadro diario.')
ON CONFLICT (nome_permissao) DO UPDATE
SET descricao_permissao = EXCLUDED.descricao_permissao;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT DISTINCT perfil.identificador_perfil, permissao_nova.identificador_permissao
FROM sevenlm_connect.perfil perfil
JOIN sevenlm_connect.perfil_permissao perfil_permissao_existente
  ON perfil_permissao_existente.identificador_perfil = perfil.identificador_perfil
JOIN sevenlm_connect.permissao permissao_existente
  ON permissao_existente.identificador_permissao = perfil_permissao_existente.identificador_permissao
JOIN sevenlm_connect.permissao permissao_nova
  ON permissao_nova.nome_permissao IN ('funcionarios.acesso.view', 'funcionarios.acesso.manage')
WHERE perfil.nome_perfil = 'Administrador do Portal'
   OR permissao_existente.nome_permissao IN (
        'administracao.manage',
        'rh.admin.acessos.manage',
        'ACESSO_TOTAL',
        'GERENCIAR_ACESSO'
      )
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
  'funcionarios',
  'Colaboradores',
  '/administracao/funcionarios',
  'users',
  20,
  pv.identificador_permissao,
  pg.identificador_permissao
FROM sevenlm_connect.permissao pv
JOIN sevenlm_connect.permissao pg
  ON pg.nome_permissao = 'funcionarios.acesso.manage'
WHERE pv.nome_permissao = 'funcionarios.acesso.view'
ON CONFLICT (codigo_modulo, codigo_recurso) DO UPDATE
SET nome_recurso = EXCLUDED.nome_recurso,
    rota_recurso = EXCLUDED.rota_recurso,
    icone_recurso = EXCLUDED.icone_recurso,
    ordem_exibicao = EXCLUDED.ordem_exibicao,
    identificador_permissao_visualizar = EXCLUDED.identificador_permissao_visualizar,
    identificador_permissao_gerenciar = EXCLUDED.identificador_permissao_gerenciar,
    indicador_ativo = TRUE,
    indicador_em_construcao = FALSE,
    data_hora_atualizado_em = NOW();

COMMIT;
