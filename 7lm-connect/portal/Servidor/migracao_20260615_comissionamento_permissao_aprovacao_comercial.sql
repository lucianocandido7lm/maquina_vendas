begin;

insert into sevenlm_connect.permissao (nome_permissao, descricao_permissao)
values (
    'comissionamento.aprovar.head',
    'Permite aprovar, reprovar/devolver e pedir revisão/recalculo na etapa de Aprovação Comercial do Comissionamento.'
)
on conflict (nome_permissao) do update
set descricao_permissao = excluded.descricao_permissao;

insert into sevenlm_connect.perfil_permissao (identificador_perfil, identificador_permissao)
select distinct perfil.identificador_perfil, permissao.identificador_permissao
from sevenlm_connect.perfil perfil
cross join sevenlm_connect.permissao permissao
where permissao.nome_permissao = 'comissionamento.aprovar.head'
  and (
    perfil.nome_perfil = 'Administrador do Portal'
    or lower(perfil.nome_perfil) like '%head%'
    or lower(perfil.nome_perfil) like '%diretor%'
    or lower(perfil.nome_perfil) like '%diretoria%'
  )
on conflict do nothing;

commit;
