ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS data_admissao date,
  ADD COLUMN IF NOT EXISTS observacao text;

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_telefone
  ON sevenlm_connect.funcionario_acesso (telefone)
  WHERE telefone IS NOT NULL AND btrim(telefone) <> '';

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_cargo
  ON sevenlm_connect.funcionario_acesso USING gin (cargo gin_trgm_ops)
  WHERE cargo IS NOT NULL AND btrim(cargo) <> '';
