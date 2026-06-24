BEGIN;

UPDATE sevenlm_connect.portal_recurso
SET nome_recurso = 'Colaboradores',
    data_hora_atualizado_em = NOW()
WHERE codigo_modulo = 'administracao'
  AND codigo_recurso = 'funcionarios';

COMMIT;
