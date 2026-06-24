create extension if not exists pgcrypto;

create table if not exists sevenlm_connect.funcionario_gestao_escopo (
    identificador_escopo_gestao uuid primary key default gen_random_uuid(),
    identificador_funcionario uuid not null
        references sevenlm_connect.funcionario_acesso(identificador_funcionario)
        on delete cascade,
    identificador_equipe_vigencia uuid null
        references sevenlm_connect.funcionario_equipe_vigencia(identificador_equipe_vigencia)
        on delete set null,
    regiao text null,
    equipe text null,
    cargo_gestao text null,
    ativo boolean not null default true,
    criado_por uuid null references sevenlm_connect.usuario(identificador_usuario),
    atualizado_por uuid null references sevenlm_connect.usuario(identificador_usuario),
    data_hora_criado_em timestamptz not null default now(),
    data_hora_atualizado_em timestamptz not null default now()
);

create index if not exists ix_funcionario_gestao_escopo_funcionario
    on sevenlm_connect.funcionario_gestao_escopo(identificador_funcionario);

create index if not exists ix_funcionario_gestao_escopo_equipe
    on sevenlm_connect.funcionario_gestao_escopo(identificador_equipe_vigencia);

create index if not exists ix_funcionario_gestao_escopo_regiao
    on sevenlm_connect.funcionario_gestao_escopo(regiao)
    where ativo = true;

comment on table sevenlm_connect.funcionario_gestao_escopo is
    'Escopos de regiao/equipe atendidos por cargos de gestao no cadastro de pessoas.';
