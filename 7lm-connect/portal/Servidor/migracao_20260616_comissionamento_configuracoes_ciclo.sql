create table if not exists comissionamento.configuracoes_ciclo (
  ciclo_id text primary key references comissionamento.ciclos(ciclo_id) on delete cascade,
  objetivo_repasse_geral numeric(14,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  atualizado_por uuid null references sevenlm_connect.usuario(identificador_usuario) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_comissionamento_configuracoes_ciclo_atualizado
  on comissionamento.configuracoes_ciclo (atualizado_em desc);

