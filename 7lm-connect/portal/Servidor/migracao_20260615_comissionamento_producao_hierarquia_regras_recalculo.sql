create extension if not exists pgcrypto;

create schema if not exists comissionamento;

create table if not exists comissionamento.hierarquia_snapshot (
    snapshot_id uuid primary key default gen_random_uuid(),
    ciclo_id text not null,
    mes_referencia text,
    papel text not null check (papel in ('gestor', 'coordenador')),
    comissionado_id text not null,
    comissionado_nome text not null,
    comissionado_documento text,
    comissionado_email text,
    gestor_nome text,
    gestor_documento text,
    gestor_email text,
    coordenador_nome text,
    coordenador_documento text,
    coordenador_email text,
    corretor_nome text,
    corretor_tipo text,
    corretor_hierarquia_key text,
    corretor_ativo_mes_key text,
    regiao_corretor text,
    imobiliaria_corretor text,
    ativo boolean,
    ativo_negocio boolean,
    origem_json jsonb not null default '{}'::jsonb,
    criado_em timestamptz not null default now()
);

create unique index if not exists ux_comissionamento_hierarquia_snapshot_linha
    on comissionamento.hierarquia_snapshot (
        ciclo_id,
        papel,
        comissionado_id,
        coalesce(corretor_hierarquia_key, corretor_ativo_mes_key, corretor_nome, '')
    );

create index if not exists ix_comissionamento_hierarquia_snapshot_ciclo_comissionado
    on comissionamento.hierarquia_snapshot (ciclo_id, comissionado_id);

create table if not exists comissionamento.regras_publicadas (
    regra_publicada_id uuid primary key default gen_random_uuid(),
    ciclo_id text not null,
    comissionado_id text not null,
    comissionado_nome text,
    regra_tipo text not null check (regra_tipo in ('regra_01', 'regra_02')),
    versao integer not null,
    regra_01 jsonb not null default '{}'::jsonb,
    regra_02 jsonb not null default '{}'::jsonb,
    regra_02_ips jsonb not null default '[]'::jsonb,
    regra_02_ips_removidos jsonb not null default '[]'::jsonb,
    payload jsonb not null default '{}'::jsonb,
    motivo text,
    comentario text,
    ativo boolean not null default true,
    publicado_por uuid,
    publicado_em timestamptz not null default now()
);

create unique index if not exists ux_comissionamento_regras_publicadas_versao
    on comissionamento.regras_publicadas (ciclo_id, comissionado_id, regra_tipo, versao);

create unique index if not exists ux_comissionamento_regras_publicadas_ativa
    on comissionamento.regras_publicadas (ciclo_id, comissionado_id, regra_tipo)
    where ativo;

create index if not exists ix_comissionamento_regras_publicadas_ciclo
    on comissionamento.regras_publicadas (ciclo_id, comissionado_id, ativo);
