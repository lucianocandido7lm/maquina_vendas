CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sevenlm_connect.funcionario_equipe_vigencia (
  identificador_equipe_vigencia uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe text NOT NULL,
  regiao text,
  gerente_vendas text,
  gerente_comercial text,
  gerente_regional text,
  head_comercial text,
  diretor_comercial text,
  data_inicio_vigencia date NOT NULL DEFAULT CURRENT_DATE,
  data_fim_vigencia date,
  status_equipe text NOT NULL DEFAULT 'ATIVO',
  ativo boolean NOT NULL DEFAULT TRUE,
  origem_planilha text,
  observacao text,
  criado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  atualizado_por uuid REFERENCES sevenlm_connect.usuario(identificador_usuario) ON DELETE SET NULL,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_funcionario_equipe_vigencia_equipe
    CHECK (btrim(equipe) <> ''),
  CONSTRAINT ck_funcionario_equipe_vigencia_status
    CHECK (status_equipe IN ('ATIVO', 'INATIVO')),
  CONSTRAINT ck_funcionario_equipe_vigencia_periodo
    CHECK (data_fim_vigencia IS NULL OR data_fim_vigencia >= data_inicio_vigencia)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_funcionario_equipe_vigencia_inicio
  ON sevenlm_connect.funcionario_equipe_vigencia (lower(equipe), data_inicio_vigencia)
  WHERE ativo;

CREATE INDEX IF NOT EXISTS idx_funcionario_equipe_vigencia_busca
  ON sevenlm_connect.funcionario_equipe_vigencia USING gin (
    (coalesce(equipe, '') || ' ' ||
     coalesce(regiao, '') || ' ' ||
     coalesce(gerente_vendas, '') || ' ' ||
     coalesce(gerente_comercial, '') || ' ' ||
     coalesce(gerente_regional, '') || ' ' ||
     coalesce(head_comercial, '') || ' ' ||
     coalesce(diretor_comercial, '')) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_funcionario_equipe_vigencia_periodo
  ON sevenlm_connect.funcionario_equipe_vigencia (lower(equipe), data_inicio_vigencia, data_fim_vigencia);

DROP TRIGGER IF EXISTS trg_funcionario_equipe_vigencia_atualizado_em
  ON sevenlm_connect.funcionario_equipe_vigencia;
CREATE TRIGGER trg_funcionario_equipe_vigencia_atualizado_em
BEFORE UPDATE ON sevenlm_connect.funcionario_equipe_vigencia
FOR EACH ROW
EXECUTE FUNCTION sevenlm_connect.atualizar_data_hora_atualizacao();

ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD COLUMN IF NOT EXISTS identificador_equipe_vigencia uuid
    REFERENCES sevenlm_connect.funcionario_equipe_vigencia(identificador_equipe_vigencia)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionario_acesso_equipe_vigencia
  ON sevenlm_connect.funcionario_acesso (identificador_equipe_vigencia);

INSERT INTO sevenlm_connect.funcionario_equipe_vigencia (
  equipe,
  regiao,
  gerente_vendas,
  gerente_comercial,
  gerente_regional,
  head_comercial,
  diretor_comercial,
  data_inicio_vigencia,
  status_equipe,
  ativo,
  origem_planilha
)
VALUES
  ('Equipe Própria | CAT', 'Catalão', 'Hawila Souza Costa', 'Jordan Vasconcelos', 'Vago', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Imobiliárias | CAT', 'Catalão', 'Leonardo de Azevedo Mariano Silva', 'Jordan Vasconcelos', 'Vago', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Autônomos 2 | FSA', 'Formosa', 'Daiana Soares da Rocha', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Autônomos | FSA', 'Formosa', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Equipe Própria 2 |FSA', 'Formosa', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Equipe Própria |FSA', 'Formosa', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Imobiliárias | FSA', 'Formosa', 'Rafael de Lucena Martins', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('NOVKA | FSA', 'Formosa', 'A definir', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('BEIRAMAR | DF', 'Sede', 'A definir', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Canal Virtual 1', 'Sede', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Canal Virtual 2', 'Sede', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('NOVKA| DF', 'Sede', 'A definir', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('VENDAS INTERNAS - 7LM', 'Sede', 'A definir', 'A definir', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Autônomos | AGL', 'Águas Lindas', 'Equipe inativa (antiga)', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Equipe Própria 2 | AGL', 'Águas Lindas', 'Josué Gomes de Souza', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Equipe Própria | AGL', 'Águas Lindas', 'Ana Cleia Nonato', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx'),
  ('Imobiliárias | AGL', 'Águas Lindas', 'Francisco Lucielio de Queiroz', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso', DATE '2026-06-01', 'ATIVO', TRUE, 'Equipes.xlsx')
ON CONFLICT DO NOTHING;
