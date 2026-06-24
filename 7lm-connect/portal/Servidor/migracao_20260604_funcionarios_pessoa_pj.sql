alter table sevenlm_connect.funcionario_acesso
  add column if not exists cnpj text,
  add column if not exists nome_empresa text;

create index if not exists idx_funcionario_acesso_cnpj
  on sevenlm_connect.funcionario_acesso (cnpj)
  where cnpj is not null and btrim(cnpj) <> '';

create index if not exists idx_funcionario_acesso_nome_empresa
  on sevenlm_connect.funcionario_acesso (nome_empresa)
  where nome_empresa is not null and btrim(nome_empresa) <> '';
