begin;

with novos_templates as (
  select *
  from (
    values
    (
      'secretaria_ajuste_solicitado',
      3,
      '[{{codigo_comissao}}] Revisão/recalculo solicitado - {{ciclo}}',
      'Revisão/recalculo solicitado',
      '<p>Olá, {{nome_destinatario}}.</p><h3>O que aconteceu</h3><p>Foi solicitado revisão/recalculo da comissão de <strong>{{nome_comissionado}}</strong>. A comissão voltou para <strong>Calculada/Revisão</strong>.</p><h3>Quem fez</h3><p><strong>{{acao_executada_por_nome}}</strong> ({{acao_executada_por_email}})<br>Perfil: {{acao_executada_por_perfil}}</p><h3>Motivo</h3><p>{{motivo}}</p><h3>Comissão</h3><p>ID: <strong>{{codigo_comissao}}</strong><br>Ciclo: <strong>{{ciclo}}</strong><br>Comissionado: <strong>{{nome_comissionado}}</strong><br>Etapa anterior: {{etapa_anterior_usuario}}<br>Etapa atual: {{etapa_nova_usuario}}</p><h3>Próxima ação</h3><p>{{proxima_acao}}</p><p style="color:#667085;font-size:13px;">Correlação: {{correlation_id}}</p>',
      'Revisão/recalculo solicitado. Comissão: {{codigo_comissao}} / {{ciclo}}. Comissionado: {{nome_comissionado}}. Quem fez: {{acao_executada_por_nome}} ({{acao_executada_por_email}}), perfil {{acao_executada_por_perfil}}. Motivo: {{motivo}}. Etapa anterior: {{etapa_anterior_usuario}}. Etapa atual: {{etapa_nova_usuario}}. Próxima ação: {{proxima_acao}}. Correlação: {{correlation_id}}.',
      'Abrir comissionamento',
      '{{link_comissionamento}}',
      array['codigo_comissao','ciclo','nome_comissionado','acao_executada_por_nome','acao_executada_por_email','acao_executada_por_perfil','motivo','etapa_anterior_usuario','etapa_nova_usuario','proxima_acao','correlation_id']
    ),
    (
      'financeiro_pacote_pj_enviado',
      3,
      '[{{codigo_comissao}}] Nota Fiscal enviada para Pagamento - {{ciclo}}',
      'Nota Fiscal enviada para Pagamento',
      '<p>Olá, {{nome_destinatario}}.</p><h3>O que aconteceu</h3><p>A Nota Fiscal da comissão de <strong>{{nome_comissionado}}</strong> foi enviada para o destino operacional <strong>{{destino_pacote}}</strong>.</p><h3>Quem enviou</h3><p><strong>{{nf_enviada_por_nome}}</strong> ({{nf_enviada_por_email}})<br>Perfil: {{acao_executada_por_perfil}}</p><h3>Dados da NF</h3><p>Número: <strong>{{nf_numero}}</strong><br>Emissão: <strong>{{nf_data_emissao}}</strong><br>Arquivo: <strong>{{nf_nome_arquivo}}</strong><br>Observação: {{nf_observacao}}<br>Anexo: <strong>{{nf_anexo_email}}</strong></p><h3>Comissão</h3><p>ID: <strong>{{codigo_comissao}}</strong><br>Ciclo: <strong>{{ciclo}}</strong><br>Comissionado: <strong>{{nome_comissionado}}</strong><br>Etapa atual: <strong>Pagamento</strong></p><h3>Próxima ação</h3><p>{{proxima_acao}}</p><p style="color:#667085;font-size:13px;">O valor deve ser consultado somente no portal autenticado. Correlação: {{correlation_id}}</p>',
      'Nota Fiscal enviada para Pagamento. Comissão: {{codigo_comissao}} / {{ciclo}}. Comissionado: {{nome_comissionado}}. Quem enviou: {{nf_enviada_por_nome}} ({{nf_enviada_por_email}}). NF: {{nf_numero}}, emissão {{nf_data_emissao}}, arquivo {{nf_nome_arquivo}}. Anexo: {{nf_anexo_email}}. Próxima ação: {{proxima_acao}}. Correlação: {{correlation_id}}.',
      'Abrir comissionamento',
      '{{link_comissionamento}}',
      array['codigo_comissao','ciclo','nome_comissionado','destino_pacote','nf_enviada_por_nome','nf_enviada_por_email','acao_executada_por_perfil','nf_numero','nf_data_emissao','nf_nome_arquivo','nf_observacao','nf_anexo_email','proxima_acao','correlation_id']
    )
  ) as t(codigo, versao, assunto, titulo, corpo_html, corpo_texto, cta_label, cta_url_template, variaveis_obrigatorias)
)
update comissionamento.notificacao_templates destino
set
  canal = 'email',
  assunto = origem.assunto,
  titulo = origem.titulo,
  corpo_html = origem.corpo_html,
  corpo_texto = origem.corpo_texto,
  cta_label = origem.cta_label,
  cta_url_template = origem.cta_url_template,
  variaveis_obrigatorias = origem.variaveis_obrigatorias,
  politica_mascaramento = '{}'::jsonb,
  publicado_em = now(),
  ativo = true
from novos_templates origem
where destino.codigo = origem.codigo
  and destino.versao = origem.versao;

with novos_templates as (
  select *
  from (
    values
    (
      'secretaria_ajuste_solicitado',
      3,
      '[{{codigo_comissao}}] Revisão/recalculo solicitado - {{ciclo}}',
      'Revisão/recalculo solicitado',
      '<p>Olá, {{nome_destinatario}}.</p><h3>O que aconteceu</h3><p>Foi solicitado revisão/recalculo da comissão de <strong>{{nome_comissionado}}</strong>. A comissão voltou para <strong>Calculada/Revisão</strong>.</p><h3>Quem fez</h3><p><strong>{{acao_executada_por_nome}}</strong> ({{acao_executada_por_email}})<br>Perfil: {{acao_executada_por_perfil}}</p><h3>Motivo</h3><p>{{motivo}}</p><h3>Comissão</h3><p>ID: <strong>{{codigo_comissao}}</strong><br>Ciclo: <strong>{{ciclo}}</strong><br>Comissionado: <strong>{{nome_comissionado}}</strong><br>Etapa anterior: {{etapa_anterior_usuario}}<br>Etapa atual: {{etapa_nova_usuario}}</p><h3>Próxima ação</h3><p>{{proxima_acao}}</p><p style="color:#667085;font-size:13px;">Correlação: {{correlation_id}}</p>',
      'Revisão/recalculo solicitado. Comissão: {{codigo_comissao}} / {{ciclo}}. Comissionado: {{nome_comissionado}}. Quem fez: {{acao_executada_por_nome}} ({{acao_executada_por_email}}), perfil {{acao_executada_por_perfil}}. Motivo: {{motivo}}. Etapa anterior: {{etapa_anterior_usuario}}. Etapa atual: {{etapa_nova_usuario}}. Próxima ação: {{proxima_acao}}. Correlação: {{correlation_id}}.',
      'Abrir comissionamento',
      '{{link_comissionamento}}',
      array['codigo_comissao','ciclo','nome_comissionado','acao_executada_por_nome','acao_executada_por_email','acao_executada_por_perfil','motivo','etapa_anterior_usuario','etapa_nova_usuario','proxima_acao','correlation_id']
    ),
    (
      'financeiro_pacote_pj_enviado',
      3,
      '[{{codigo_comissao}}] Nota Fiscal enviada para Pagamento - {{ciclo}}',
      'Nota Fiscal enviada para Pagamento',
      '<p>Olá, {{nome_destinatario}}.</p><h3>O que aconteceu</h3><p>A Nota Fiscal da comissão de <strong>{{nome_comissionado}}</strong> foi enviada para o destino operacional <strong>{{destino_pacote}}</strong>.</p><h3>Quem enviou</h3><p><strong>{{nf_enviada_por_nome}}</strong> ({{nf_enviada_por_email}})<br>Perfil: {{acao_executada_por_perfil}}</p><h3>Dados da NF</h3><p>Número: <strong>{{nf_numero}}</strong><br>Emissão: <strong>{{nf_data_emissao}}</strong><br>Arquivo: <strong>{{nf_nome_arquivo}}</strong><br>Observação: {{nf_observacao}}<br>Anexo: <strong>{{nf_anexo_email}}</strong></p><h3>Comissão</h3><p>ID: <strong>{{codigo_comissao}}</strong><br>Ciclo: <strong>{{ciclo}}</strong><br>Comissionado: <strong>{{nome_comissionado}}</strong><br>Etapa atual: <strong>Pagamento</strong></p><h3>Próxima ação</h3><p>{{proxima_acao}}</p><p style="color:#667085;font-size:13px;">O valor deve ser consultado somente no portal autenticado. Correlação: {{correlation_id}}</p>',
      'Nota Fiscal enviada para Pagamento. Comissão: {{codigo_comissao}} / {{ciclo}}. Comissionado: {{nome_comissionado}}. Quem enviou: {{nf_enviada_por_nome}} ({{nf_enviada_por_email}}). NF: {{nf_numero}}, emissão {{nf_data_emissao}}, arquivo {{nf_nome_arquivo}}. Anexo: {{nf_anexo_email}}. Próxima ação: {{proxima_acao}}. Correlação: {{correlation_id}}.',
      'Abrir comissionamento',
      '{{link_comissionamento}}',
      array['codigo_comissao','ciclo','nome_comissionado','destino_pacote','nf_enviada_por_nome','nf_enviada_por_email','acao_executada_por_perfil','nf_numero','nf_data_emissao','nf_nome_arquivo','nf_observacao','nf_anexo_email','proxima_acao','correlation_id']
    )
  ) as t(codigo, versao, assunto, titulo, corpo_html, corpo_texto, cta_label, cta_url_template, variaveis_obrigatorias)
)
insert into comissionamento.notificacao_templates (
  codigo,
  versao,
  canal,
  assunto,
  titulo,
  corpo_html,
  corpo_texto,
  cta_label,
  cta_url_template,
  variaveis_obrigatorias,
  politica_mascaramento,
  ativo,
  publicado_em
)
select
  codigo,
  versao,
  'email',
  assunto,
  titulo,
  corpo_html,
  corpo_texto,
  cta_label,
  cta_url_template,
  variaveis_obrigatorias,
  '{}'::jsonb,
  true,
  now()
from novos_templates
where not exists (
  select 1
  from comissionamento.notificacao_templates existente
  where existente.codigo = novos_templates.codigo
    and existente.versao = novos_templates.versao
);

update comissionamento.notificacao_templates
set ativo = false
where codigo in ('secretaria_ajuste_solicitado', 'financeiro_pacote_pj_enviado')
  and versao < 3;

commit;
