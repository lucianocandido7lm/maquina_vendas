-- 7LM Connect - Comissionamento
-- Enriquecimento produtivo 2026-06: identidade, hierarquia real e destinatarios auditaveis.

alter table comissionamento.resultados
    add column if not exists identificador_usuario uuid,
    add column if not exists identificador_funcionario uuid,
    add column if not exists documento text,
    add column if not exists email text,
    add column if not exists cargo text,
    add column if not exists perfil_acesso text,
    add column if not exists papel_comissionamento text,
    add column if not exists origem_identidade text,
    add column if not exists validacao_lideranca jsonb not null default '{}'::jsonb;

create index if not exists idx_comissionamento_resultados_usuario
    on comissionamento.resultados (ciclo_id, identificador_usuario);

create index if not exists idx_comissionamento_resultados_funcionario
    on comissionamento.resultados (ciclo_id, identificador_funcionario);

create index if not exists idx_comissionamento_resultados_documento
    on comissionamento.resultados (ciclo_id, documento);

create index if not exists idx_comissionamento_resultados_email
    on comissionamento.resultados (ciclo_id, lower(email));

alter table comissionamento.hierarquia_snapshot
    add column if not exists comissionado_usuario_id uuid,
    add column if not exists comissionado_funcionario_id uuid,
    add column if not exists comissionado_cargo text,
    add column if not exists comissionado_perfil text,
    add column if not exists comissionado_origem_identidade text,
    add column if not exists corretor_usuario_id uuid,
    add column if not exists corretor_funcionario_id uuid,
    add column if not exists corretor_documento text,
    add column if not exists corretor_email text,
    add column if not exists corretor_cargo text,
    add column if not exists corretor_status text,
    add column if not exists corretor_origem_identidade text,
    add column if not exists vinculo_origem text;

create index if not exists idx_comissionamento_hierarquia_snapshot_usuario
    on comissionamento.hierarquia_snapshot (ciclo_id, comissionado_usuario_id, corretor_usuario_id);

create index if not exists idx_comissionamento_hierarquia_snapshot_funcionario
    on comissionamento.hierarquia_snapshot (ciclo_id, comissionado_funcionario_id, corretor_funcionario_id);

create index if not exists idx_comissionamento_hierarquia_snapshot_documento
    on comissionamento.hierarquia_snapshot (ciclo_id, comissionado_documento, corretor_documento);

create index if not exists idx_comissionamento_hierarquia_snapshot_email
    on comissionamento.hierarquia_snapshot (ciclo_id, lower(comissionado_email), lower(corretor_email));

create index if not exists idx_comissionamento_hierarquia_snapshot_vinculo
    on comissionamento.hierarquia_snapshot (ciclo_id, papel, vinculo_origem);
