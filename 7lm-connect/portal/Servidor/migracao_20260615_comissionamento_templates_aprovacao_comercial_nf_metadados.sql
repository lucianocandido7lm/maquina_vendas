-- 7LM Connect - Comissionamento
-- Ajustes de linguagem: Aprovacao Comercial / Diretoria Comercial e NF sem armazenamento de arquivo.

update comissionamento.notificacao_templates
set
    assunto = 'Comissionamento {{ciclo}}: aprovacoes comerciais pendentes',
    titulo = 'Aprovacao comercial pendente',
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>Ha comissoes do ciclo <strong>{{ciclo}}</strong> aguardando aprovacao comercial pela Diretoria Comercial.</p><p>Status atual: <strong>{{status_atual}}</strong>. Proxima acao: <strong>{{proxima_acao}}</strong>.</p><p>Acesse o portal para revisar os detalhes protegidos.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. Ha comissoes do ciclo {{ciclo}} aguardando aprovacao comercial pela Diretoria Comercial. Acesse o portal: {{link_comissionamento}}',
    cta_label = 'Revisar comissoes'
where codigo = 'head_aprovacao_pendente';

update comissionamento.notificacao_templates
set
    assunto = 'Comissionamento {{ciclo}}: devolucao da Diretoria Comercial',
    titulo = 'Revisao solicitada pela Diretoria Comercial',
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>A Diretoria Comercial devolveu uma comissao do ciclo <strong>{{ciclo}}</strong> para revisao.</p><p>Comissionado: <strong>{{nome_comissionado}}</strong>.</p><p>Motivo: <strong>{{motivo}}</strong>.</p><p>Acompanhe a pendencia pelo portal antes de reenviar para aprovacao.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. A Diretoria Comercial devolveu uma comissao do ciclo {{ciclo}}. Comissionado: {{nome_comissionado}}. Motivo: {{motivo}}. Portal: {{link_comissionamento}}',
    cta_label = 'Ver pendencia'
where codigo = 'secretaria_rejeicao_head';

update comissionamento.notificacao_templates
set
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>Sua comissao do ciclo <strong>{{ciclo}}</strong> foi aprovada pela Diretoria Comercial e precisa da Nota Fiscal para seguir ao Financeiro.</p><p>Prazo para envio: <strong>{{prazo}}</strong>.</p><p>Por seguranca, valores e detalhes completos ficam disponiveis apenas no portal autenticado.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. Sua comissao do ciclo {{ciclo}} foi aprovada pela Diretoria Comercial e precisa da Nota Fiscal. Prazo: {{prazo}}. Portal: {{link_comissionamento}}'
where codigo = 'comissionado_nf_solicitada';

update comissionamento.notificacao_templates
set
    assunto = 'Nota Fiscal enviada ao Financeiro - Comissionamento {{ciclo}}',
    titulo = 'Nota Fiscal enviada ao Financeiro',
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>Uma Nota Fiscal foi enviada para processamento financeiro no ciclo <strong>{{ciclo}}</strong>.</p><p><strong>Comissionado:</strong> {{nome_comissionado}}<br><strong>Cargo/perfil:</strong> {{cargo_comissionado}} / {{perfil_comissionado}}<br><strong>Enviada por:</strong> {{nf_enviada_por_nome}} ({{nf_enviada_por_email}})<br><strong>Numero da NF:</strong> {{nf_numero}}<br><strong>Data de emissao:</strong> {{nf_data_emissao}}<br><strong>Arquivo informado:</strong> {{nf_nome_arquivo}}<br><strong>Armazenamento do arquivo:</strong> {{nf_arquivo_armazenado}}</p><p><strong>Observacao:</strong> {{nf_observacao}}</p><p>Valores e detalhes completos continuam protegidos no portal autenticado.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. NF enviada ao Financeiro no ciclo {{ciclo}}. Comissionado: {{nome_comissionado}}. Enviada por: {{nf_enviada_por_nome}} ({{nf_enviada_por_email}}). Numero: {{nf_numero}}. Emissao: {{nf_data_emissao}}. Arquivo informado: {{nf_nome_arquivo}}. Armazenamento: {{nf_arquivo_armazenado}}. Observacao: {{nf_observacao}}. Portal: {{link_comissionamento}}',
    cta_label = 'Acessar comissionamento',
    variaveis_obrigatorias = array['ciclo','nome_destinatario','link_comissionamento','nome_comissionado','cargo_comissionado','perfil_comissionado','nf_enviada_por_nome','nf_enviada_por_email','nf_numero','nf_data_emissao','nf_nome_arquivo','nf_arquivo_armazenado','nf_observacao','correlation_id']
where codigo = 'financeiro_pacote_pj_enviado';

update comissionamento.notificacao_templates
set
    assunto = 'Comissao CLT enviada para RH/Financeiro - Comissionamento {{ciclo}}',
    titulo = 'Comissao enviada para RH/Financeiro',
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>A comissao CLT do ciclo <strong>{{ciclo}}</strong> foi enviada para RH e Financeiro.</p><p>Comissionado: <strong>{{nome_comissionado}}</strong>.</p><p>Nota Fiscal nao se aplica a este perfil.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. Comissao CLT do ciclo {{ciclo}} enviada para RH/Financeiro. Comissionado: {{nome_comissionado}}. NF nao se aplica. Portal: {{link_comissionamento}}'
where codigo = 'rh_financeiro_pacote_clt_enviado';

update comissionamento.notificacao_templates
set
    assunto = 'Comissionamento {{ciclo}}: enviada ao Financeiro/RH',
    titulo = 'Comissoes enviadas ao Financeiro/RH',
    corpo_html = '<p>Ola, {{nome_destinatario}}.</p><p>Ha <strong>{{quantidade_itens}}</strong> comissoes do ciclo <strong>{{ciclo}}</strong> enviadas ao destino operacional.</p><p>Destino: <strong>{{destino_pacote}}</strong>.</p><p>Acesse o portal para acompanhar o historico e os detalhes protegidos.</p>',
    corpo_texto = 'Ola, {{nome_destinatario}}. Ha {{quantidade_itens}} comissoes enviadas no ciclo {{ciclo}}. Destino: {{destino_pacote}}. Portal: {{link_comissionamento}}'
where codigo = 'secretaria_pacote_pronto';
