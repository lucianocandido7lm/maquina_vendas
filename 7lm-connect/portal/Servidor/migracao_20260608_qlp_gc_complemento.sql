-- Complemento QLP G&C - criar faltantes e canonizar equipes
begin;

create temp table tmp_qlp_junho_2026 (
  corretor text not null,
  equipe text not null,
  regiao text,
  gerente text,
  coordenador text
);
insert into tmp_qlp_junho_2026 (corretor, equipe, regiao, gerente, coordenador) values
  ('Ingrid Alves D''Aparecida','Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Ryan Gomes Calazans','Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Maria Daiana da Silva Brandão','Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Nauane Martins Da Silva Oliveira','Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Valmir Santana dos Santos','Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Gabriel do Nascimento Dias','Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Maria Eugenia Martins alves','Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Murielly de Sousa Santos','Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Nathália Nogueira Aguiar','Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Natália Cristina Neris dos Santos','Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('ANNA LUIZA PEREIRA DE SOUSA','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('CAMILA FERNANDES DA SILVA','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('CLEIDE DE OLIVEIRA ALVES','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('ISABELLA PEREIRA FELICIANO','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('STEFFANY SILVA PINTO','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('Thamara Rafaella de Melo Santos','Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('GYOVANA FERNANDES ALMEIDA CASTRO','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('KEULLY DE SOUSA BRAGA','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('LETICIA LORRANNY SANTOS DOURADO','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('THAIRINE STEFANNI RODRIGUES DA SILVA','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('MARCILENE DOS REIS CARVALHO','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('Erika Alves Gomes','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('Pabline Micheli Oliveira da Silva','Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('NATASHA LUCILÍA BARBOSA','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('JONATAS CASTRO DA SILVA','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('MAYSA GABRIELA GONCALVES OLIVEIRA','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('Áquila da Silva Fernandes','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('ARIANI MORAIS DE SOUSA PEREIRA','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('MILENE DE ALMEIDA LIMA','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('Mirian da Silva Gomes Rodrigues','Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('JOÃO VITOR BRITO','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('FABIANE BEZERRA DE MOMEIRA DOS SANTOS','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('WANDERSON ROMERO COELHO DA SILVA','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('JULIANA MARIA DE SOUZA','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('ANA LUIZA ENTREPONTES DA COSTA','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('LUIS ALVES DOS SANTOS DA SILVA ROCHA','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('Guilherme Pereira Santos','Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira'),
  ('Daniel Andrade dos Santos','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Maria Eduarda Damasceno','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Caio Brendon Lopes Martins','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Lucas de Souza Rodrigues','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Lucas Ramos de Victória','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Tamires Campos','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Sandra Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Lucas Braga de Souza Oliveira','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Leticia Santos da Silva Brito','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Luana Santana dos Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Eurides Alves','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Beatriz Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Marta Anastácio Neres','Canal Virtual 3','Sede','Pâmela','Geisiane Gomes dos Santos'),
  ('Joelma Freire','Canal Virtual 3','Sede','Pâmela','Geisiane Gomes dos Santos'),
  ('Jéssica Silva','Canal Virtual 3','Sede','Pâmela','Geisiane Gomes dos Santos'),
  ('Antônio Alisson Almeida','Canal Virtual 3','Sede','Pâmela','Geisiane Gomes dos Santos'),
  ('Emannuelly do Bom Parto Souza Carvalho','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Leticia Aparecida de Melo Godinho','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Viviane Machado Gomes de Pereira Araujo','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Sara Cristina Medeiros da Costa','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Samara de Melo Cruz','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Tamires Paola Murer','Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos');

create temp table tmp_qlp_equipes_junho_2026 (
  equipe text not null,
  regiao text,
  gerente_vendas text,
  gerente_comercial text,
  gerente_regional text,
  head_comercial text,
  diretor_comercial text
);
insert into tmp_qlp_equipes_junho_2026 (equipe, regiao, gerente_vendas, gerente_comercial, gerente_regional, head_comercial, diretor_comercial) values
  ('Equipe Própria | FSA','Formosa','Vivian','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe Própria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Autônomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Autônomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe Própria | AGL','Águas Lindas','Ana Cleia Nonato','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe Própria 2 | AGL','Águas Lindas','Josué Gomes de Souza','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe Própria 3 | AGL','Águas Lindas','Em aberto','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 3','Sede','Pâmela','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 4','Sede','Renata','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe Própria | CAT','Catalão','Hawila Souza Costa','Jordan Ribeiro Vasconcelos','Vago','Marcelo Paiva','Marco Narciso');

create or replace function pg_temp.tmp_norm_qlp(valor text) returns text language sql immutable as $$
  select regexp_replace(
    lower(translate(coalesce(valor, ''),
      '??????????????????????????????????????????????????',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnAa'
    )), '[^a-z0-9]+', '', 'g');
$$;

-- Inativar duplicidades nao canonicas da mesma equipe vigente (ex.: "|FSA" sem espaco).
update sevenlm_connect.funcionario_equipe_vigencia eq
   set data_fim_vigencia = greatest(eq.data_inicio_vigencia, date '2026-06-01'),
       status_equipe = 'INATIVO',
       ativo = false,
       data_hora_atualizado_em = now()
  from tmp_qlp_equipes_junho_2026 q
 where coalesce(eq.ativo, true) = true
   and eq.data_inicio_vigencia <= date '2026-06-08'
   and (eq.data_fim_vigencia is null or eq.data_fim_vigencia >= date '2026-06-08')
   and pg_temp.tmp_norm_qlp(eq.equipe) = pg_temp.tmp_norm_qlp(q.equipe)
   and btrim(eq.equipe) <> btrim(q.equipe);

-- Criar cadastros minimos dos corretores do QLP que nao existiam no modulo de Pessoas.
insert into sevenlm_connect.funcionario_acesso (
  nome,
  tipo_funcionario,
  imobiliaria,
  gestor,
  coordenador,
  gerente,
  regional,
  regiao,
  identificador_equipe_vigencia,
  ativo,
  ativo_negocio,
  ativo_login,
  data_inicio_vigencia,
  data_fim_vigencia,
  referencia_origem,
  origem_planilha,
  cadastrado_por,
  status_validacao
)
select
  q.corretor,
  'CORRETOR',
  q.equipe,
  q.gerente,
  q.coordenador,
  q.coordenador,
  q.regiao,
  q.regiao,
  eq.identificador_equipe_vigencia,
  true,
  true,
  false,
  date '2026-06-01',
  null,
  'QLP_20260605',
  'QLP_20260605',
  'QLP_20260605',
  'PENDENTE'
from tmp_qlp_junho_2026 q
join sevenlm_connect.funcionario_equipe_vigencia eq
  on pg_temp.tmp_norm_qlp(eq.equipe)=pg_temp.tmp_norm_qlp(q.equipe)
 and coalesce(eq.ativo, true)=true
 and eq.data_inicio_vigencia <= date '2026-06-08'
 and (eq.data_fim_vigencia is null or eq.data_fim_vigencia >= date '2026-06-08')
where not exists (
  select 1 from sevenlm_connect.funcionario_acesso f
  where pg_temp.tmp_norm_qlp(f.nome)=pg_temp.tmp_norm_qlp(q.corretor)
);

-- Reaplicar equipe vigente nos 59 nomes do QLP, incluindo os recem-criados.
update sevenlm_connect.funcionario_acesso f
   set imobiliaria = q.equipe,
       regional = q.regiao,
       regiao = q.regiao,
       gestor = q.gerente,
       coordenador = q.coordenador,
       gerente = q.coordenador,
       identificador_equipe_vigencia = eq.identificador_equipe_vigencia,
       tipo_funcionario = 'CORRETOR',
       ativo = true,
       ativo_negocio = true,
       data_inicio_vigencia = date '2026-06-01',
       data_fim_vigencia = null,
       referencia_origem = 'QLP_20260605',
       data_hora_atualizado_em = now()
  from tmp_qlp_junho_2026 q
  join sevenlm_connect.funcionario_equipe_vigencia eq
    on pg_temp.tmp_norm_qlp(eq.equipe)=pg_temp.tmp_norm_qlp(q.equipe)
   and coalesce(eq.ativo, true)=true
   and eq.data_inicio_vigencia <= date '2026-06-08'
   and (eq.data_fim_vigencia is null or eq.data_fim_vigencia >= date '2026-06-08')
 where pg_temp.tmp_norm_qlp(f.nome)=pg_temp.tmp_norm_qlp(q.corretor);

commit;
