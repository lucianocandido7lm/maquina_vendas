BEGIN;

UPDATE sevenlm_connect.portal_recurso
   SET nome_recurso = 'Dashboard Comercial',
       rota_recurso = '/comercial/dashboard',
       icone_recurso = 'chart',
       ordem_exibicao = 10,
       indicador_ativo = TRUE,
       indicador_em_construcao = FALSE,
       data_hora_atualizado_em = NOW()
 WHERE codigo_modulo = 'comercial'
   AND codigo_recurso = 'dashboard_comercial';

UPDATE sevenlm_connect.portal_recurso
   SET nome_recurso = 'Máquina de Vendas',
       rota_recurso = '/comercial/clientes',
       icone_recurso = 'home',
       ordem_exibicao = 20,
       indicador_ativo = TRUE,
       indicador_em_construcao = FALSE,
       data_hora_atualizado_em = NOW()
 WHERE codigo_modulo = 'imoveis'
   AND codigo_recurso = 'listagem';

UPDATE sevenlm_connect.portal_recurso
   SET nome_recurso = 'Abertura e Objetivos',
       rota_recurso = '/metas/dashboard',
       icone_recurso = 'target',
       ordem_exibicao = 30,
       indicador_ativo = TRUE,
       indicador_em_construcao = FALSE,
       data_hora_atualizado_em = NOW()
 WHERE codigo_modulo = 'metas'
   AND codigo_recurso = 'metas_resultados';

DELETE FROM sevenlm_connect.portal_recurso
 WHERE codigo_modulo = 'financeiro'
    OR rota_recurso = '/financeiro'
    OR rota_recurso LIKE '/financeiro/%';

COMMIT;
