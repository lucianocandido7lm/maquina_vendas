BEGIN;

create schema if not exists comissionamento;

create table if not exists comissionamento.notificacao_providers (
  provider_id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null default 'email',
  ativo boolean not null default false,
  modo text not null default 'dry_run',
  remetente_padrao text,
  tenant_ref text,
  client_id_ref text,
  secret_ref text,
  cert_ref text,
  configuracao jsonb not null default '{}'::jsonb,
  limites_operacionais jsonb not null default '{}'::jsonb,
  allowlist_destinatarios text[] not null default array[]::text[],
  criado_por_usuario_id uuid,
  atualizado_por_usuario_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_notificacao_providers_modo check (modo in ('dry_run', 'teste_allowlist', 'producao'))
);

create table if not exists comissionamento.notificacao_templates (
  template_id uuid primary key default gen_random_uuid(),
  codigo text not null,
  versao integer not null default 1,
  canal text not null default 'email',
  assunto text not null,
  titulo text not null,
  corpo_html text not null,
  corpo_texto text not null,
  cta_label text,
  cta_url_template text,
  variaveis_obrigatorias text[] not null default array[]::text[],
  politica_mascaramento jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  publicado_em timestamptz not null default now(),
  criado_por_usuario_id uuid,
  criado_em timestamptz not null default now(),
  unique (codigo, versao, canal)
);

create table if not exists comissionamento.notificacao_eventos (
  evento_id uuid primary key default gen_random_uuid(),
  evento_negocio_id text,
  correlation_id text not null,
  ciclo_id text,
  resultado_id text,
  comissionado_id text,
  tipo_evento text not null,
  origem text not null default 'transicao',
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  criado_por_usuario_id uuid,
  criado_por_servico text,
  criado_em timestamptz not null default now(),
  unique (correlation_id)
);

create table if not exists comissionamento.notificacoes (
  notificacao_id uuid primary key default gen_random_uuid(),
  evento_id uuid references comissionamento.notificacao_eventos(evento_id) on delete cascade,
  tipo_evento text not null,
  titulo text not null,
  resumo text not null,
  link_acao text,
  prioridade text not null default 'normal',
  ciclo_id text,
  resultado_id text,
  comissionado_id text,
  status text not null default 'ativa',
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz,
  constraint chk_notificacoes_prioridade check (prioridade in ('baixa', 'normal', 'alta', 'critica')),
  constraint chk_notificacoes_status check (status in ('ativa', 'cancelada', 'resolvida'))
);

create table if not exists comissionamento.notificacao_destinatarios (
  destinatario_id uuid primary key default gen_random_uuid(),
  notificacao_id uuid references comissionamento.notificacoes(notificacao_id) on delete cascade,
  usuario_id uuid,
  email text,
  nome text,
  perfil text not null,
  canal text not null default 'email',
  visibilidade text not null default 'ciclo',
  pode_ver_valor boolean not null default false,
  lida_em timestamptz,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists comissionamento.notificacao_fila_envio (
  fila_envio_id uuid primary key default gen_random_uuid(),
  evento_id uuid references comissionamento.notificacao_eventos(evento_id) on delete cascade,
  notificacao_id uuid references comissionamento.notificacoes(notificacao_id) on delete cascade,
  destinatario_id uuid references comissionamento.notificacao_destinatarios(destinatario_id) on delete cascade,
  template_id uuid references comissionamento.notificacao_templates(template_id),
  template_codigo text not null,
  template_versao integer not null default 1,
  canal text not null default 'email',
  destinatario_email text,
  destinatario_nome text,
  payload_renderizado jsonb not null default '{}'::jsonb,
  status text not null default 'pendente',
  tentativas integer not null default 0,
  proxima_tentativa_em timestamptz,
  provider_codigo text not null default 'fake',
  provider_message_id text,
  idempotency_key text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz,
  unique (evento_id, destinatario_email, canal, template_codigo, template_versao),
  constraint chk_notificacao_fila_status check (
    status in ('pendente', 'em_processamento', 'simulado', 'enviado_para_provider', 'falhou_retry', 'falhou_permanente', 'cancelado', 'ignorado_idempotencia')
  )
);

create table if not exists comissionamento.notificacao_logs (
  log_id uuid primary key default gen_random_uuid(),
  fila_envio_id uuid references comissionamento.notificacao_fila_envio(fila_envio_id) on delete cascade,
  evento_id uuid references comissionamento.notificacao_eventos(evento_id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  provider text not null default 'fake',
  provider_message_id text,
  request_payload_mascarado jsonb not null default '{}'::jsonb,
  response_payload_mascarado jsonb not null default '{}'::jsonb,
  erro_codigo text,
  erro_mensagem text,
  criado_em timestamptz not null default now()
);

create table if not exists comissionamento.notificacao_preferencias (
  preferencia_id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  tipo_evento text not null,
  canal text not null default 'email',
  habilitado boolean not null default true,
  frequencia text not null default 'imediata',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, tipo_evento, canal),
  constraint chk_notificacao_preferencias_frequencia check (frequencia in ('imediata', 'diaria', 'semanal'))
);

create table if not exists comissionamento.notificacao_regras_escalonamento (
  regra_escalonamento_id uuid primary key default gen_random_uuid(),
  tipo_evento_origem text not null,
  perfil_fluxo text,
  status_origem text,
  prazo_quantidade integer not null default 1,
  prazo_unidade text not null default 'dia_util',
  lembrete_antes_quantidade integer not null default 0,
  lembrete_antes_unidade text not null default 'dia_util',
  escalonar_apos_quantidade integer not null default 1,
  escalonar_apos_unidade text not null default 'dia_util',
  destinatarios_escalonamento jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_notificacao_destinatarios_usuario
  on comissionamento.notificacao_destinatarios (usuario_id, lida_em, criado_em desc);

create index if not exists idx_notificacao_destinatarios_email
  on comissionamento.notificacao_destinatarios (lower(coalesce(email, '')), criado_em desc);

create index if not exists idx_notificacao_fila_status
  on comissionamento.notificacao_fila_envio (status, proxima_tentativa_em, criado_em);

create index if not exists idx_notificacao_logs_fila
  on comissionamento.notificacao_logs (fila_envio_id, criado_em desc);

create unique index if not exists ux_notificacao_regras_escalonamento_chave
  on comissionamento.notificacao_regras_escalonamento (
    tipo_evento_origem,
    coalesce(perfil_fluxo, ''),
    coalesce(status_origem, '')
  );

insert into comissionamento.notificacao_providers (
  codigo,
  nome,
  tipo,
  ativo,
  modo,
  remetente_padrao,
  configuracao,
  limites_operacionais,
  allowlist_destinatarios
) values
(
  'fake',
  'Provider fake dry-run',
  'email',
  true,
  'dry_run',
  'inovacao@7lm.com.br',
  '{"send_enabled": false, "dry_run": true}'::jsonb,
  '{"max_retries": 3, "timeout_seconds": 15}'::jsonb,
  array['hudson.porto@7lm.com.br', 'automacaoprocessos@7lm.com.br', 'inovacao@7lm.com.br']
),
(
  'microsoft_graph',
  'Microsoft Graph SendMail',
  'email',
  false,
  'teste_allowlist',
  'inovacao@7lm.com.br',
  '{"send_enabled": false, "mailbox": "inovacao@7lm.com.br", "scope": "https://graph.microsoft.com/.default"}'::jsonb,
  '{"max_retries": 3, "timeout_seconds": 15, "respect_retry_after": true}'::jsonb,
  array['hudson.porto@7lm.com.br', 'automacaoprocessos@7lm.com.br', 'inovacao@7lm.com.br']
)
on conflict (codigo) do update set
  remetente_padrao = excluded.remetente_padrao,
  allowlist_destinatarios = excluded.allowlist_destinatarios,
  atualizado_em = now();

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
  politica_mascaramento
) values
('head_aprovacao_pendente', 1, 'email', 'Comissionamento {{ciclo}}: aprovacoes pendentes', 'Aprovacao pendente do Head', '<p>Ola, {{nome_destinatario}}.</p><p>Ha comissoes do ciclo <strong>{{ciclo}}</strong> aguardando aprovacao do Head Comercial.</p><p>Status atual: <strong>{{status_atual}}</strong>. Proxima acao: <strong>{{proxima_acao}}</strong>.</p><p>Acesse o portal para revisar os detalhes protegidos.</p>', 'Ola, {{nome_destinatario}}. Ha comissoes do ciclo {{ciclo}} aguardando aprovacao. Acesse o portal: {{link_comissionamento}}', 'Revisar comissoes', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','status_atual','proxima_acao','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('secretaria_ajuste_solicitado', 1, 'email', 'Comissionamento {{ciclo}}: ajuste solicitado', 'Ajuste solicitado', '<p>Ola, {{nome_destinatario}}.</p><p>Uma comissao do ciclo <strong>{{ciclo}}</strong> voltou para revisao.</p><p>Motivo informado: <strong>{{motivo}}</strong>.</p><p>Acesse o portal para consultar o historico e aplicar os ajustes necessarios.</p>', 'Ola, {{nome_destinatario}}. Uma comissao do ciclo {{ciclo}} voltou para revisao. Motivo: {{motivo}}. Portal: {{link_comissionamento}}', 'Abrir revisao', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','motivo','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('secretaria_rejeicao_head', 1, 'email', 'Comissionamento {{ciclo}}: devolucao do Head Comercial', 'Revisao solicitada pelo Head', '<p>Ola, {{nome_destinatario}}.</p><p>O Head Comercial devolveu uma aprovacao do ciclo <strong>{{ciclo}}</strong>.</p><p>Motivo: <strong>{{motivo}}</strong>.</p><p>Acompanhe a pendencia pelo portal antes de reenviar para aprovacao.</p>', 'Ola, {{nome_destinatario}}. O Head devolveu uma aprovacao do ciclo {{ciclo}}. Motivo: {{motivo}}. Portal: {{link_comissionamento}}', 'Ver pendencia', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','motivo','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('comissionado_nf_solicitada', 1, 'email', 'Nota Fiscal solicitada - Comissionamento {{ciclo}}', 'Envio de Nota Fiscal solicitado', '<p>Ola, {{nome_destinatario}}.</p><p>Sua comissao do ciclo <strong>{{ciclo}}</strong> foi aprovada e precisa da Nota Fiscal para seguir ao Financeiro.</p><p>Prazo para envio: <strong>{{prazo}}</strong>.</p><p>Por seguranca, valores e detalhes completos ficam disponiveis apenas no portal autenticado.</p>', 'Ola, {{nome_destinatario}}. Sua Nota Fiscal do ciclo {{ciclo}} foi solicitada. Prazo: {{prazo}}. Portal: {{link_comissionamento}}', 'Enviar Nota Fiscal', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','prazo','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('comissionado_nf_lembrete', 1, 'email', 'Lembrete de Nota Fiscal - Comissionamento {{ciclo}}', 'Nota Fiscal pendente', '<p>Ola, {{nome_destinatario}}.</p><p>Identificamos que a Nota Fiscal do ciclo <strong>{{ciclo}}</strong> ainda esta pendente ou precisa de acompanhamento.</p><p>Prazo: <strong>{{prazo}}</strong>. Proxima acao: <strong>{{proxima_acao}}</strong>.</p><p>Acesse o portal para enviar ou corrigir as informacoes.</p>', 'Ola, {{nome_destinatario}}. A NF do ciclo {{ciclo}} esta pendente. Prazo: {{prazo}}. Portal: {{link_comissionamento}}', 'Regularizar NF', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','prazo','proxima_acao','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('secretaria_nf_recebida', 1, 'email', 'NF recebida para validacao - Comissionamento {{ciclo}}', 'NF aguardando validacao', '<p>Ola, {{nome_destinatario}}.</p><p>Uma Nota Fiscal do ciclo <strong>{{ciclo}}</strong> foi recebida e aguarda validacao da Secretaria.</p><p>Status atual: <strong>{{status_atual}}</strong>.</p><p>Acesse o portal para conferir o documento protegido e registrar a validacao.</p>', 'Ola, {{nome_destinatario}}. NF recebida para validacao no ciclo {{ciclo}}. Portal: {{link_comissionamento}}', 'Validar NF', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','status_atual','correlation_id'], '{"ocultar_anexos": true}'::jsonb),
('comissionado_nf_rejeitada', 1, 'email', 'Correcao necessaria na NF - Comissionamento {{ciclo}}', 'Nota Fiscal precisa de correcao', '<p>Ola, {{nome_destinatario}}.</p><p>A Nota Fiscal enviada para o ciclo <strong>{{ciclo}}</strong> precisa de correcao.</p><p>Motivo: <strong>{{motivo}}</strong>.</p><p>Acesse o portal para enviar a versao corrigida.</p>', 'Ola, {{nome_destinatario}}. A NF do ciclo {{ciclo}} precisa de correcao. Motivo: {{motivo}}. Portal: {{link_comissionamento}}', 'Enviar correcao', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','motivo','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('comissionado_nf_validada', 1, 'email', 'NF validada - Comissionamento {{ciclo}}', 'Nota Fiscal validada', '<p>Ola, {{nome_destinatario}}.</p><p>A Nota Fiscal do ciclo <strong>{{ciclo}}</strong> foi validada pela Secretaria.</p><p>A comissao seguira para o pacote consolidado de envio ao Financeiro, conforme calendario interno.</p><p>Consulte o portal para acompanhar o status.</p>', 'Ola, {{nome_destinatario}}. A NF do ciclo {{ciclo}} foi validada. Portal: {{link_comissionamento}}', 'Ver minha comissao', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','correlation_id'], '{"ocultar_valor_comissionado": true}'::jsonb),
('secretaria_pacote_pronto', 1, 'email', 'Comissionamento {{ciclo}}: pacote pronto para envio', 'Pacote pronto', '<p>Ola, {{nome_destinatario}}.</p><p>Ha <strong>{{quantidade_itens}}</strong> comissoes do ciclo <strong>{{ciclo}}</strong> prontas para pacote consolidado.</p><p>Destino previsto: <strong>{{destino_pacote}}</strong>.</p><p>Acesse o portal para revisar e enviar.</p>', 'Ola, {{nome_destinatario}}. Ha {{quantidade_itens}} comissoes prontas no ciclo {{ciclo}}. Destino: {{destino_pacote}}. Portal: {{link_comissionamento}}', 'Revisar pacote', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','quantidade_itens','destino_pacote','correlation_id'], '{"ocultar_detalhes_individuais": true}'::jsonb),
('financeiro_pacote_pj_enviado', 1, 'email', 'Pacote consolidado PJ/autonomos - Comissionamento {{ciclo}}', 'Pacote enviado ao Financeiro', '<p>Ola, {{nome_destinatario}}.</p><p>O pacote consolidado de comissionamento PJ/autonomos do ciclo <strong>{{ciclo}}</strong> foi enviado para processamento financeiro.</p><p>Quantidade de itens: <strong>{{quantidade_itens}}</strong>.</p><p>Os detalhes completos e documentos protegidos devem ser acessados pelo portal.</p>', 'Ola, {{nome_destinatario}}. Pacote PJ/autonomos do ciclo {{ciclo}} enviado. Itens: {{quantidade_itens}}. Portal: {{link_comissionamento}}', 'Acessar pacote', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','quantidade_itens','destino_pacote','correlation_id'], '{"permitir_valor_pacote": true, "ocultar_anexos": true}'::jsonb),
('rh_financeiro_pacote_clt_enviado', 1, 'email', 'Pacote consolidado CLT - Comissionamento {{ciclo}}', 'Pacote CLT enviado', '<p>Ola, {{nome_destinatario}}.</p><p>O pacote consolidado de comissionamento CLT do ciclo <strong>{{ciclo}}</strong> foi enviado para RH e Financeiro.</p><p>Quantidade de itens: <strong>{{quantidade_itens}}</strong>.</p><p>Nota Fiscal nao se aplica a este perfil.</p>', 'Ola, {{nome_destinatario}}. Pacote CLT do ciclo {{ciclo}} enviado para RH/Financeiro. Itens: {{quantidade_itens}}. Portal: {{link_comissionamento}}', 'Acessar pacote', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','quantidade_itens','destino_pacote','correlation_id'], '{"permitir_valor_pacote": true, "ocultar_anexos": true}'::jsonb),
('erro_integracao_email', 1, 'email', 'Falha no envio de e-mail - Comissionamento {{ciclo}}', 'Falha de envio', '<p>Ola, {{nome_destinatario}}.</p><p>Uma notificacao do ciclo <strong>{{ciclo}}</strong> nao foi entregue pelo provider configurado.</p><p>Status: <strong>{{status_atual}}</strong>. Proxima acao: <strong>{{proxima_acao}}</strong>.</p><p>Consulte o historico de envios para reprocessar com seguranca.</p>', 'Ola, {{nome_destinatario}}. Falha de envio no ciclo {{ciclo}}. Status: {{status_atual}}. Portal: {{link_comissionamento}}', 'Ver historico', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','status_atual','proxima_acao','correlation_id'], '{"tecnico": true}'::jsonb),
('resumo_diario_pendencias', 1, 'email', 'Resumo diario de pendencias - Comissionamento {{ciclo}}', 'Resumo diario de pendencias', '<p>Ola, {{nome_destinatario}}.</p><p>O ciclo <strong>{{ciclo}}</strong> possui <strong>{{quantidade_itens}}</strong> pendencias que exigem acompanhamento.</p><p>Proxima acao recomendada: <strong>{{proxima_acao}}</strong>.</p><p>A lista detalhada fica disponivel somente no portal.</p>', 'Ola, {{nome_destinatario}}. O ciclo {{ciclo}} possui {{quantidade_itens}} pendencias. Portal: {{link_comissionamento}}', 'Abrir painel', '{{link_comissionamento}}', array['ciclo','nome_destinatario','link_comissionamento','quantidade_itens','proxima_acao','correlation_id'], '{"resumo": true, "ocultar_detalhes_individuais": true}'::jsonb)
on conflict (codigo, versao, canal) do update set
  assunto = excluded.assunto,
  titulo = excluded.titulo,
  corpo_html = excluded.corpo_html,
  corpo_texto = excluded.corpo_texto,
  cta_label = excluded.cta_label,
  cta_url_template = excluded.cta_url_template,
  variaveis_obrigatorias = excluded.variaveis_obrigatorias,
  politica_mascaramento = excluded.politica_mascaramento,
  ativo = true;

insert into comissionamento.notificacao_regras_escalonamento (
  tipo_evento_origem,
  perfil_fluxo,
  status_origem,
  prazo_quantidade,
  prazo_unidade,
  lembrete_antes_quantidade,
  escalonar_apos_quantidade,
  destinatarios_escalonamento
) values
('enviado_para_head', null, 'aguardando_head_comercial', 1, 'dia_util', 0, 1, '["secretaria","admin"]'::jsonb),
('nf_solicitada', 'corretor_autonomo', 'aguardando_nf', 2, 'dia_util', 1, 1, '["secretaria","admin"]'::jsonb),
('nf_solicitada', 'gestor_coordenador_autonomo', 'aguardando_nf', 2, 'dia_util', 1, 1, '["secretaria","admin"]'::jsonb),
('nf_rejeitada', null, 'aguardando_nf', 1, 'dia_util', 0, 1, '["secretaria"]'::jsonb),
('nf_recebida', null, 'nf_em_validacao', 1, 'dia_util', 0, 1, '["admin"]'::jsonb),
('pacote_pagamento_enviado', null, 'pronta_para_envio_pagamento', 5, 'dia_util', 1, 1, '["admin"]'::jsonb)
on conflict do nothing;

COMMIT;
