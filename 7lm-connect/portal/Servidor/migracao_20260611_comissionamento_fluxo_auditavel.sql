BEGIN;

create schema if not exists comissionamento;

alter table comissionamento.resultados
  add column if not exists status_financeiro text not null default 'nao_enviado',
  add column if not exists status_pagamento text not null default 'nao_enviado';

create table if not exists comissionamento.eventos (
  evento_id uuid primary key default gen_random_uuid(),
  ciclo_id text,
  resultado_id text,
  comissionado_id text,
  comissionado_nome text,
  tipo_evento text not null,
  status_anterior text,
  status_novo text,
  status_nf_anterior text,
  status_nf_novo text,
  status_financeiro_anterior text,
  status_financeiro_novo text,
  status_pagamento_anterior text,
  status_pagamento_novo text,
  regra text,
  campo text,
  valor_anterior numeric(14,2),
  valor_novo numeric(14,2),
  documento_id uuid,
  comentario text,
  payload_antes jsonb not null default '{}'::jsonb,
  payload_depois jsonb not null default '{}'::jsonb,
  idempotency_key text,
  usuario_id uuid,
  sessao_id uuid,
  endereco_ip text,
  agente_do_usuario text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_comissionamento_eventos_ciclo
  on comissionamento.eventos (ciclo_id, criado_em desc);

create index if not exists idx_comissionamento_eventos_resultado
  on comissionamento.eventos (resultado_id, criado_em desc);

create index if not exists idx_comissionamento_eventos_tipo
  on comissionamento.eventos (tipo_evento, criado_em desc);

create table if not exists comissionamento.idempotency_keys (
  chave text primary key,
  rota text not null,
  usuario_id uuid,
  resposta_json jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists comissionamento.documentos (
  documento_id uuid primary key default gen_random_uuid(),
  resultado_id text,
  ciclo_id text,
  tipo_documento text not null,
  nome_arquivo text not null,
  content_type text,
  tamanho_bytes integer not null default 0,
  numero_nf text,
  data_emissao date,
  valor_nf numeric(14,2),
  observacao text,
  conteudo bytea,
  status_documento text not null default 'recebido',
  usuario_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists idx_comissionamento_documentos_resultado
  on comissionamento.documentos (resultado_id, criado_em desc);

COMMIT;
