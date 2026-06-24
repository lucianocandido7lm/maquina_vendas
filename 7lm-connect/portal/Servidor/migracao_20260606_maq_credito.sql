create extension if not exists pgcrypto;
create schema if not exists maq_credito;

create table if not exists maq_credito.processos (
  reserva text primary key,
  cliente text,
  caixa_status text not null default 'reserva',
  agehab_status text not null default 'reserva',
  produto text,
  sinal text,
  fiador text,
  corretor text,
  empreendimento text,
  cca_vinculado text,
  observacao_analista text,
  encaminhado_analista boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table maq_credito.processos
  add column if not exists encaminhado_analista boolean not null default false;
alter table maq_credito.processos
  add column if not exists observacao_analista text;
alter table maq_credito.processos
  add column if not exists cca_vinculado text;

create table if not exists maq_credito.documentos_status (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  documento_key text not null,
  status text not null default 'Aguardando',
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (reserva, documento_key)
);

create table if not exists maq_credito.relacionamento_status (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  relacionamento_key text not null,
  status text not null default 'nao',
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (reserva, relacionamento_key)
);

create table if not exists maq_credito.creditu_dados (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  email_segundo_proponente text,
  telefone_segundo_proponente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reserva)
);

create table if not exists maq_credito.documentos_pendencias (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  documento_key text not null,
  descricao text not null default '',
  prazo text,
  origem text,
  destino_card text not null default 'card1',
  updated_at timestamptz not null default now(),
  unique (reserva, documento_key)
);

create table if not exists maq_credito.pendencias_historico (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  documento_key text not null,
  descricao text not null default '',
  prazo text,
  origem text,
  evento text not null default 'criada',
  status_documento text,
  created_at timestamptz not null default now()
);

create table if not exists maq_credito.checklist_messages (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  documento_key text,
  author_name text not null,
  author_role text not null,
  target_role text not null default 'todos',
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_maq_credito_checklist_messages_doc
  on maq_credito.checklist_messages (reserva, documento_key, created_at);
create index if not exists idx_maq_credito_checklist_messages_reserva
  on maq_credito.checklist_messages (reserva, created_at);

create table if not exists maq_credito.uploads (
  id uuid primary key default gen_random_uuid(),
  reserva text not null references maq_credito.processos(reserva) on delete cascade,
  grupo text not null default 'geral',
  documento_key text not null,
  file_name text not null,
  storage_path text not null,
  url text not null,
  content_type text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists maq_credito.sla_processos (
  reserva text primary key references maq_credito.processos(reserva) on delete cascade,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  stop_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists maq_credito.contextos (
  id uuid primary key default gen_random_uuid(),
  contexto text not null,
  created_at timestamptz not null default now()
);

create table if not exists maq_credito.log_eventos (
  id_cliente text not null,
  status text not null,
  timestamp timestamptz not null,
  id_corretor text
);

create index if not exists idx_maq_credito_log_eventos_cliente_timestamp
  on maq_credito.log_eventos (id_cliente, timestamp);
create index if not exists idx_maq_credito_log_eventos_status
  on maq_credito.log_eventos (status);
