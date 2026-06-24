BEGIN;

UPDATE sevenlm_connect.portal_recurso
   SET nome_recurso = 'Abertura e Objetivos',
       ordem_exibicao = 25,
       rota_recurso = '/metas/dashboard',
       icone_recurso = 'target'
 WHERE codigo_modulo = 'metas'
   AND codigo_recurso = 'metas_resultados';

DELETE FROM sevenlm_connect.portal_recurso
 WHERE codigo_modulo = 'financeiro'
    OR rota_recurso = '/financeiro'
    OR rota_recurso LIKE '/financeiro/%';

COMMIT;
