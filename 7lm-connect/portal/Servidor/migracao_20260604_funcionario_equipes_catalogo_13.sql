CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  criado_por uuid,
  atualizado_por uuid,
  data_hora_criacao timestamptz NOT NULL DEFAULT NOW(),
  data_hora_atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_funcionario_equipe_vigencia_equipe
    CHECK (btrim(equipe) <> ''),
  CONSTRAINT ck_funcionario_equipe_vigencia_status
    CHECK (status_equipe IN ('ATIVO', 'INATIVO')),
  CONSTRAINT ck_funcionario_equipe_vigencia_periodo
    CHECK (data_fim_vigencia IS NULL OR data_fim_vigencia >= data_inicio_vigencia)
);

ALTER TABLE sevenlm_connect.funcionario_acesso
  ADD COLUMN IF NOT EXISTS identificador_equipe_vigencia uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_funcionario_equipe_vigencia_inicio
  ON sevenlm_connect.funcionario_equipe_vigencia (lower(equipe), data_inicio_vigencia)
  WHERE ativo;

CREATE INDEX IF NOT EXISTS idx_funcionario_equipe_vigencia_periodo
  ON sevenlm_connect.funcionario_equipe_vigencia (lower(equipe), data_inicio_vigencia, data_fim_vigencia);

WITH catalogo (
  equipe,
  regiao,
  gerente_vendas,
  gerente_comercial,
  gerente_regional,
  head_comercial,
  diretor_comercial
) AS (
  VALUES
    ('Equipe Própria | CAT', 'Catalão', 'Hawila Souza Costa', 'Jordan Vasconcelos', 'Vago', 'Marcelo Paiva', 'Marco Narciso'),
    ('Imobiliárias | CAT', 'Catalão', 'Leonardo de Azevedo Mariano Silva', 'Jordan Vasconcelos', 'Vago', 'Marcelo Paiva', 'Marco Narciso'),
    ('Autônomos 2 | FSA', 'Formosa', 'Daiana Soares da Rocha', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Autônomos | FSA', 'Formosa', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Equipe Própria 2 | FSA', 'Formosa', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Equipe Própria | FSA', 'Formosa', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Imobiliárias | FSA', 'Formosa', 'Rafael de Lucena Martins', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Canal Virtual 1', 'Sede', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Canal Virtual 2', 'Sede', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Autônomos | AGL', 'Águas Lindas', 'Equipe inativa (antiga)', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Equipe Própria 2 | AGL', 'Águas Lindas', 'Josué Gomes de Souza', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Equipe Própria | AGL', 'Águas Lindas', 'Ana Cleia Nonato', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
    ('Imobiliárias | AGL', 'Águas Lindas', 'Francisco Lucielio de Queiroz', 'Vago', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso')
),
atualizados AS (
  UPDATE sevenlm_connect.funcionario_equipe_vigencia eq
     SET regiao = c.regiao,
         gerente_vendas = c.gerente_vendas,
         gerente_comercial = c.gerente_comercial,
         gerente_regional = c.gerente_regional,
         head_comercial = c.head_comercial,
         diretor_comercial = c.diretor_comercial,
         data_fim_vigencia = NULL,
         status_equipe = 'ATIVO',
         ativo = TRUE,
         origem_planilha = 'Equipes G&C 2026-06-04',
         data_hora_atualizado_em = NOW()
    FROM catalogo c
   WHERE lower(eq.equipe) = lower(c.equipe)
     AND eq.data_inicio_vigencia = DATE '2026-06-01'
   RETURNING eq.identificador_equipe_vigencia
)
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
SELECT
  c.equipe,
  c.regiao,
  c.gerente_vendas,
  c.gerente_comercial,
  c.gerente_regional,
  c.head_comercial,
  c.diretor_comercial,
  DATE '2026-06-01',
  'ATIVO',
  TRUE,
  'Equipes G&C 2026-06-04'
FROM catalogo c
WHERE NOT EXISTS (
  SELECT 1
    FROM sevenlm_connect.funcionario_equipe_vigencia eq
   WHERE lower(eq.equipe) = lower(c.equipe)
     AND eq.data_inicio_vigencia = DATE '2026-06-01'
);

WITH permitidas(equipe) AS (
  VALUES
    ('Equipe Própria | CAT'),
    ('Imobiliárias | CAT'),
    ('Autônomos 2 | FSA'),
    ('Autônomos | FSA'),
    ('Equipe Própria 2 | FSA'),
    ('Equipe Própria | FSA'),
    ('Imobiliárias | FSA'),
    ('Canal Virtual 1'),
    ('Canal Virtual 2'),
    ('Autônomos | AGL'),
    ('Equipe Própria 2 | AGL'),
    ('Equipe Própria | AGL'),
    ('Imobiliárias | AGL')
)
UPDATE sevenlm_connect.funcionario_equipe_vigencia eq
   SET ativo = FALSE,
       status_equipe = 'INATIVO',
       data_fim_vigencia = COALESCE(data_fim_vigencia, CURRENT_DATE),
       observacao = 'Inativada fora do catalogo G&C 2026-06-04',
       data_hora_atualizado_em = NOW()
 WHERE ativo = TRUE
   AND NOT EXISTS (
     SELECT 1
       FROM permitidas p
      WHERE lower(p.equipe) = lower(eq.equipe)
   );
