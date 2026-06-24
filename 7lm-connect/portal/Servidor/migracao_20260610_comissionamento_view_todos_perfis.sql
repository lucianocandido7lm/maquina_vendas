BEGIN;

insert into sevenlm_connect.perfil_permissao (
  identificador_perfil,
  identificador_permissao
)
select perfil.identificador_perfil, permissao.identificador_permissao
from sevenlm_connect.perfil perfil
cross join sevenlm_connect.permissao permissao
where permissao.nome_permissao = 'comissionamento.view'
on conflict do nothing;

COMMIT;
