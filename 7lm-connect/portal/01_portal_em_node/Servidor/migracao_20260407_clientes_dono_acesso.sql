BEGIN;

ALTER TABLE connect_comercial.cliente
  ADD COLUMN IF NOT EXISTS identificador_usuario_cadastro uuid REFERENCES sevenlm_connect.usuario(identificador_usuario),
  ADD COLUMN IF NOT EXISTS usuario_cadastro_nome text,
  ADD COLUMN IF NOT EXISTS usuario_cadastro_email text;

CREATE INDEX IF NOT EXISTS idx_cliente_usuario_cadastro
  ON connect_comercial.cliente (identificador_usuario_cadastro);

INSERT INTO sevenlm_connect.permissao (nome_permissao, descricao_permissao)
VALUES
  ('clientes.view.all', 'Permite visualizar todos os clientes comerciais, ignorando o filtro de responsavel pelo cadastro.'),
  ('clientes.manage.all', 'Permite gerenciar clientes comerciais de qualquer responsavel pelo cadastro.')
ON CONFLICT (nome_permissao) DO NOTHING;

INSERT INTO sevenlm_connect.perfil (nome_perfil, descricao_perfil)
VALUES
  ('Gerente Comercial', 'Acesso gerencial ao modulo comercial com visao de todos os clientes.'),
  ('Corretor Comercial', 'Acesso operacional ao modulo comercial limitado aos clientes cadastrados pelo proprio corretor.')
ON CONFLICT (nome_perfil) DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
  FROM sevenlm_connect.perfil perfil
  JOIN sevenlm_connect.permissao permissao
    ON permissao.nome_permissao IN (
      'clientes.view.all',
      'clientes.manage.all'
    )
 WHERE perfil.nome_perfil IN ('Administrador do Portal', 'Gerente Comercial')
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
  FROM sevenlm_connect.perfil perfil
  JOIN sevenlm_connect.permissao permissao
    ON permissao.nome_permissao IN (
      'imoveis.view',
      'imoveis.create',
      'imoveis.edit'
    )
 WHERE perfil.nome_perfil IN ('Gerente Comercial', 'Corretor Comercial')
ON CONFLICT DO NOTHING;

INSERT INTO sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
SELECT perfil.identificador_perfil, permissao.identificador_permissao
  FROM sevenlm_connect.perfil perfil
  JOIN sevenlm_connect.permissao permissao
    ON permissao.nome_permissao IN (
      'imoveis.delete',
      'imoveis.media.manage'
    )
 WHERE perfil.nome_perfil = 'Gerente Comercial'
ON CONFLICT DO NOTHING;

UPDATE connect_comercial.cliente cliente
   SET identificador_usuario_cadastro = usuario_legado.identificador_usuario,
       usuario_cadastro_nome = usuario_legado.nome_completo,
       usuario_cadastro_email = usuario_legado.correio_eletronico::text
  FROM (
        SELECT identificador_usuario, nome_completo, correio_eletronico
          FROM sevenlm_connect.usuario
         WHERE indicador_ativo = true
         ORDER BY
           CASE
             WHEN correio_eletronico::text = 'adm@7lm.com.br' THEN 0
             WHEN matricula = 'admin7lm' THEN 1
             ELSE 2
           END,
           data_hora_criacao
         LIMIT 1
       ) usuario_legado
 WHERE cliente.identificador_usuario_cadastro IS NULL;

COMMIT;
