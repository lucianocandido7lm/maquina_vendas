BEGIN;

create extension if not exists pgcrypto;
create schema if not exists comissionamento;

create table if not exists comissionamento.ciclos (
  ciclo_id text primary key,
  mes integer not null check (mes between 1 and 12),
  ano integer not null check (ano between 2000 and 2100),
  rotulo text not null,
  origem text not null default 'manual',
  status text not null default 'calculado',
  prazo_envio_financeiro date,
  prazo_nf_dias integer not null default 2,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists comissionamento.resultados (
  resultado_id text primary key,
  ciclo_id text not null references comissionamento.ciclos(ciclo_id) on delete cascade,
  funcao text not null,
  cidade text not null,
  nome text not null,
  tipo_comissionado text not null default 'PJ_AUTONOMO',
  valor_bruto numeric(14,2) not null default 0,
  desconto_distrato numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) generated always as (valor_bruto - desconto_distrato) stored,
  status text not null default 'calculado_seed',
  status_nf text not null default 'pendente_nf',
  exige_nf boolean not null default true,
  origem text not null default 'excel_seed',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (ciclo_id, nome)
);

create index if not exists idx_comissionamento_resultados_ciclo
  on comissionamento.resultados (ciclo_id);

create index if not exists idx_comissionamento_resultados_status
  on comissionamento.resultados (ciclo_id, status, status_nf);

insert into comissionamento.ciclos (
  ciclo_id,
  mes,
  ano,
  rotulo,
  origem,
  status,
  prazo_envio_financeiro,
  prazo_nf_dias
)
values (
  '2026-05',
  5,
  2026,
  'Maio/2026',
  'excel_seed',
  'calculado_seed',
  date '2026-06-15',
  2
)
on conflict (ciclo_id) do update
set mes = excluded.mes,
    ano = excluded.ano,
    rotulo = excluded.rotulo,
    origem = excluded.origem,
    status = excluded.status,
    prazo_envio_financeiro = excluded.prazo_envio_financeiro,
    prazo_nf_dias = excluded.prazo_nf_dias,
    atualizado_em = now();

insert into comissionamento.resultados (
  resultado_id,
  ciclo_id,
  funcao,
  cidade,
  nome,
  tipo_comissionado,
  valor_bruto,
  desconto_distrato,
  status,
  status_nf,
  exige_nf,
  origem
)
values
  ('seed-1', '2026-05', 'COORD. VENDAS', 'AGL', 'ROBSON', 'PJ_AUTONOMO', 3400, 0, 'pronto_financeiro', 'nf_recebida', true, 'excel_seed'),
  ('seed-2', '2026-05', 'GER VENDAS', 'AGL', 'FRANCISCO', 'PJ_AUTONOMO', 1250, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-3', '2026-05', 'GER VENDAS', 'AGL', 'JOSUE', 'PJ_AUTONOMO', 1000, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-4', '2026-05', 'GER VENDAS', 'AGL', 'ANA CLEIA', 'PJ_AUTONOMO', 2850, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-5', '2026-05', 'COORD VENDAS FSA', 'FSA', 'THOMAZ', 'PJ_AUTONOMO', 4500, 0, 'pronto_financeiro', 'nf_recebida', true, 'excel_seed'),
  ('seed-6', '2026-05', 'COORD VENDAS CANAL', 'FSA', 'JORDAN', 'PJ_AUTONOMO', 9300, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-7', '2026-05', 'GER VENDAS', 'FSA', 'RAFAEL', 'PJ_AUTONOMO', 4400, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-8', '2026-05', 'GER II VENDAS', 'FSA', 'ALANA', 'PJ_AUTONOMO', 2750, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-9', '2026-05', 'GER VENDAS', 'FSA', 'DAIANA', 'PJ_AUTONOMO', 4250, 0, 'pronto_financeiro', 'nf_recebida', true, 'excel_seed'),
  ('seed-10', '2026-05', 'COORD GERAL', 'FSA', 'TAVEIRA', 'PJ_AUTONOMO', 7300, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-11', '2026-05', 'COORD. CANAL', 'AGL/FSA', 'GEISI', 'PJ_AUTONOMO', 8500, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-12', '2026-05', 'COORD. REPASSE', 'AGL/FSA', 'BRUNO', 'PJ_AUTONOMO', 10600, 0, 'aprovado_marcelo', 'pendente_nf', true, 'excel_seed'),
  ('seed-13', '2026-05', 'GER. IA', 'AGL/FSA', 'LUIZ', 'PJ_AUTONOMO', 5342, 0, 'pronto_financeiro', 'nf_recebida', true, 'excel_seed')
on conflict (resultado_id) do update
set ciclo_id = excluded.ciclo_id,
    funcao = excluded.funcao,
    cidade = excluded.cidade,
    nome = excluded.nome,
    tipo_comissionado = excluded.tipo_comissionado,
    valor_bruto = excluded.valor_bruto,
    desconto_distrato = excluded.desconto_distrato,
    status = excluded.status,
    status_nf = excluded.status_nf,
    exige_nf = excluded.exige_nf,
    origem = excluded.origem,
    atualizado_em = now();

insert into sevenlm_connect.permissao (nome_permissao, descricao_permissao)
values
  ('comissionamento.view', 'Permite visualizar o modulo de comissionamento.'),
  ('comissionamento.manage', 'Permite gerenciar o modulo de comissionamento.'),
  ('comissionamento.secretaria', 'Permite operar o fluxo de comissionamento como Secretaria de Vendas.')
on conflict (nome_permissao) do update
set descricao_permissao = excluded.descricao_permissao;

insert into sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
select distinct perfil.identificador_perfil, permissao_nova.identificador_permissao
from sevenlm_connect.perfil perfil
cross join sevenlm_connect.permissao permissao_nova
where permissao_nova.nome_permissao = 'comissionamento.view'
  and (
    perfil.nome_perfil = 'Administrador do Portal'
    or exists (
      select 1
      from sevenlm_connect.perfil_permissao perfil_permissao_existente
      join sevenlm_connect.permissao permissao_existente
        on permissao_existente.identificador_permissao = perfil_permissao_existente.identificador_permissao
      where perfil_permissao_existente.identificador_perfil = perfil.identificador_perfil
        and permissao_existente.nome_permissao in (
          'dashboard.comercial.view',
          'dashboard.comercial.manage',
          'maquina.vendas.dashboard.view',
          'maquina.vendas.dashboard.manage',
          'metas.resultados.view',
          'metas.resultados.manage',
          'administracao.view',
          'administracao.manage',
          'ACESSO_TOTAL',
          'GERENCIAR_ACESSO'
        )
    )
  )
on conflict do nothing;

insert into sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
select distinct perfil.identificador_perfil, permissao_nova.identificador_permissao
from sevenlm_connect.perfil perfil
cross join sevenlm_connect.permissao permissao_nova
where permissao_nova.nome_permissao in ('comissionamento.manage', 'comissionamento.secretaria')
  and (
    perfil.nome_perfil = 'Administrador do Portal'
    or exists (
      select 1
      from sevenlm_connect.perfil_permissao perfil_permissao_existente
      join sevenlm_connect.permissao permissao_existente
        on permissao_existente.identificador_permissao = perfil_permissao_existente.identificador_permissao
      where perfil_permissao_existente.identificador_perfil = perfil.identificador_perfil
        and permissao_existente.nome_permissao in (
          'dashboard.comercial.manage',
          'maquina.vendas.dashboard.manage',
          'metas.resultados.manage',
          'administracao.manage',
          'ACESSO_TOTAL',
          'GERENCIAR_ACESSO'
        )
    )
  )
on conflict do nothing;

insert into sevenlm_connect.portal_recurso (
  codigo_modulo,
  codigo_recurso,
  nome_recurso,
  rota_recurso,
  icone_recurso,
  ordem_exibicao,
  indicador_ativo,
  indicador_em_construcao,
  identificador_permissao_visualizar,
  identificador_permissao_gerenciar
)
select
  'comercial',
  'comissionamento',
  'Comissionamento',
  '/comercial/comissionamento',
  'wallet',
  35,
  true,
  true,
  permissao_visualizar.identificador_permissao,
  permissao_gerenciar.identificador_permissao
from sevenlm_connect.permissao permissao_visualizar
join sevenlm_connect.permissao permissao_gerenciar
  on permissao_gerenciar.nome_permissao = 'comissionamento.manage'
where permissao_visualizar.nome_permissao = 'comissionamento.view'
on conflict (codigo_modulo, codigo_recurso) do update
set nome_recurso = excluded.nome_recurso,
    rota_recurso = excluded.rota_recurso,
    icone_recurso = excluded.icone_recurso,
    ordem_exibicao = excluded.ordem_exibicao,
    indicador_ativo = true,
    indicador_em_construcao = true,
    identificador_permissao_visualizar = excluded.identificador_permissao_visualizar,
    identificador_permissao_gerenciar = excluded.identificador_permissao_gerenciar,
    data_hora_atualizado_em = now();

COMMIT;
