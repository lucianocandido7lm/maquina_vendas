-- Ajuste QLP Pessoas e Cultura - vigencia 2026-06-01
-- Fonte: QLP atualizado 05 06 (1).pdf normalizado em tmp/qlp_20260608_relatorio.json
begin;

create temp table tmp_qlp_junho_2026 (
  corretor text not null,
  equipe text not null,
  regiao text,
  gerente text,
  coordenador text
) on commit drop;

insert into tmp_qlp_junho_2026 (corretor, equipe, regiao, gerente, coordenador) values
  ('Ingrid Alves D''Aparecida','Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Ryan Gomes Calazans','Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Maria Daiana da Silva BrandÃƒÂ£o','Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Nauane Martins Da Silva Oliveira','Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Valmir Santana dos Santos','Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino'),
  ('Gabriel do Nascimento Dias','Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Maria Eugenia Martins alves','Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('Murielly de Sousa Santos','Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('NathÃƒÂ¡lia Nogueira Aguiar','Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('NatÃƒÂ¡lia Cristina Neris dos Santos','Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino'),
  ('ANNA LUIZA PEREIRA DE SOUSA','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('CAMILA FERNANDES DA SILVA','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('CLEIDE DE OLIVEIRA ALVES','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('ISABELLA PEREIRA FELICIANO','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('STEFFANY SILVA PINTO','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('Thamara Rafaella de Melo Santos','AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino'),
  ('GYOVANA FERNANDES ALMEIDA CASTRO','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('KEULLY DE SOUSA BRAGA','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('LETICIA LORRANNY SANTOS DOURADO','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('THAIRINE STEFANNI RODRIGUES DA SILVA','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('MARCILENE DOS REIS CARVALHO','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('Erika Alves Gomes','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('Pabline Micheli Oliveira da Silva','AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino'),
  ('NATASHA LUCILÃƒÂA BARBOSA','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('JONATAS CASTRO DA SILVA','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('MAYSA GABRIELA GONCALVES OLIVEIRA','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('ÃƒÂquila da Silva Fernandes','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('ARIANI MORAIS DE SOUSA PEREIRA','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('MILENE DE ALMEIDA LIMA','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('Mirian da Silva Gomes Rodrigues','Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira'),
  ('JOÃƒÆ’O VITOR BRITO','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('FABIANE BEZERRA DE MOMEIRA DOS SANTOS','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('WANDERSON ROMERO COELHO DA SILVA','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('JULIANA MARIA DE SOUZA','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('ANA LUIZA ENTREPONTES DA COSTA','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('LUIS ALVES DOS SANTOS DA SILVA ROCHA','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('Guilherme Pereira Santos','Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira'),
  ('Daniel Andrade dos Santos','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Maria Eduarda Damasceno','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Caio Brendon Lopes Martins','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Lucas de Souza Rodrigues','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Lucas Ramos de VictÃƒÂ³ria','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Tamires Campos','Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos'),
  ('Sandra Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Lucas Braga de Souza Oliveira','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Leticia Santos da Silva Brito','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Luana Santana dos Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Eurides Alves','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Beatriz Santos','Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos'),
  ('Marta AnastÃƒÂ¡cio Neres','Canal Virtual 3','Sede','PÃƒÂ¢mela','Geisiane Gomes dos Santos'),
  ('Joelma Freire','Canal Virtual 3','Sede','PÃƒÂ¢mela','Geisiane Gomes dos Santos'),
  ('JÃƒÂ©ssica Silva','Canal Virtual 3','Sede','PÃƒÂ¢mela','Geisiane Gomes dos Santos'),
  ('AntÃƒÂ´nio Alisson Almeida','Canal Virtual 3','Sede','PÃƒÂ¢mela','Geisiane Gomes dos Santos'),
  ('Emannuelly do Bom Parto Souza Carvalho','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Leticia Aparecida de Melo Godinho','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Viviane Machado Gomes de Pereira Araujo','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Sara Cristina Medeiros da Costa','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Samara de Melo Cruz','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos'),
  ('Tamires Paola Murer','Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos');

create temp table tmp_qlp_equipes_junho_2026 (
  equipe text not null,
  regiao text,
  gerente_vendas text,
  gerente_comercial text,
  gerente_regional text,
  head_comercial text,
  diretor_comercial text
) on commit drop;

insert into tmp_qlp_equipes_junho_2026 (equipe, regiao, gerente_vendas, gerente_comercial, gerente_regional, head_comercial, diretor_comercial) values
  ('Equipe PrÃƒÂ³pria | FSA','Formosa','Vivian','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe PrÃƒÂ³pria 2 | FSA','Formosa','Lucas Paulo Marques Pinto','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('AutÃƒÂ´nomos | FSA','Formosa','Alana Rabelo da Costa','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('AutÃƒÂ´nomos 2 | FSA','Formosa','Daiana Soares Da Rocha','Thomaz Moreira Aquino','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe PrÃƒÂ³pria | AGL','ÃƒÂguas Lindas','Ana Cleia Nonato','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe PrÃƒÂ³pria 2 | AGL','ÃƒÂguas Lindas','JosuÃƒÂ© Gomes de Souza','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe PrÃƒÂ³pria 3 | AGL','ÃƒÂguas Lindas','Em aberto','Marco Taveira','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 1','Sede','Micael dos Santos Pires','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 2','Sede','Alba Vieira da Silva Lopes','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 3','Sede','PÃƒÂ¢mela','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Canal Virtual 4','Sede','Renata','Geisiane Gomes dos Santos','Marco Taveira','Marcelo Paiva','Marco Narciso'),
  ('Equipe PrÃƒÂ³pria | CAT','CatalÃƒÂ£o','Hawila Souza Costa','Jordan Ribeiro Vasconcelos','Vago','Marcelo Paiva','Marco Narciso');

create or replace function pg_temp.tmp_norm_qlp(valor text) returns text language sql immutable as $$
  select regexp_replace(
    lower(translate(coalesce(valor, ''),
      '??????????????????????????????????????????????????',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnAa'
    )),
    '[^a-z0-9]+', '', 'g'
  );
$$;

create or replace function pg_temp.tmp_slug_qlp(valor text) returns text language sql immutable as $$
  select regexp_replace(
    regexp_replace(
      lower(translate(coalesce(valor, ''),
        '??????????????????????????????????????????????????',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnAa'
      )),
      '[^a-z0-9]+', '_', 'g'
    ),
    '^_+|_+$', '', 'g'
  );
$$;

-- Encerrar em 31/05 as vigencias antigas que nao fazem parte do QLP de junho.
update sevenlm_connect.funcionario_equipe_vigencia eq
   set data_fim_vigencia = greatest(eq.data_inicio_vigencia, date '2026-05-31'),
       status_equipe = 'INATIVO',
       ativo = false,
       data_hora_atualizado_em = now()
 where coalesce(eq.ativo, true) = true
   and eq.data_inicio_vigencia <= date '2026-06-01'
   and (eq.data_fim_vigencia is null or eq.data_fim_vigencia >= date '2026-06-01')
   and not exists (
     select 1 from tmp_qlp_equipes_junho_2026 q where pg_temp.tmp_norm_qlp(q.equipe)=pg_temp.tmp_norm_qlp(eq.equipe)
   );

-- Garantir que as equipes do QLP estejam vigentes a partir de 01/06.
update sevenlm_connect.funcionario_equipe_vigencia eq
   set regiao = q.regiao,
       gerente_vendas = q.gerente_vendas,
       gerente_comercial = q.gerente_comercial,
       gerente_regional = q.gerente_regional,
       head_comercial = q.head_comercial,
       diretor_comercial = q.diretor_comercial,
       data_inicio_vigencia = date '2026-06-01',
       data_fim_vigencia = null,
       status_equipe = 'ATIVO',
       ativo = true,
       origem_planilha = 'QLP_20260605',
       data_hora_atualizado_em = now()
  from tmp_qlp_equipes_junho_2026 q
 where pg_temp.tmp_norm_qlp(q.equipe)=pg_temp.tmp_norm_qlp(eq.equipe);

-- Atualizar cadastro ativo para refletir a equipe vigente do QLP de junho.
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
       origem_planilha = coalesce(nullif(f.origem_planilha, ''), 'QLP_20260605'),
       data_hora_atualizado_em = now()
  from tmp_qlp_junho_2026 q
  join sevenlm_connect.funcionario_equipe_vigencia eq on pg_temp.tmp_norm_qlp(eq.equipe)=pg_temp.tmp_norm_qlp(q.equipe)
 where pg_temp.tmp_norm_qlp(f.nome)=pg_temp.tmp_norm_qlp(q.corretor);

-- Inativar corretores que continuam no cadastro, mas nao constam no QLP de 01/06/2026.
update sevenlm_connect.funcionario_acesso f
   set ativo = false,
       ativo_login = false,
       ativo_negocio = false,
       data_fim_vigencia = date '2026-05-31',
       referencia_origem = coalesce(nullif(f.referencia_origem, ''), 'ENCERRADO_ANTES_QLP_20260601'),
       data_hora_atualizado_em = now()
 where coalesce(f.ativo, true) = true
   and coalesce(f.tipo_funcionario, '') = 'CORRETOR'
   and not exists (
     select 1 from tmp_qlp_junho_2026 q where pg_temp.tmp_norm_qlp(q.corretor)=pg_temp.tmp_norm_qlp(f.nome)
   );

-- Remover sufixo textual - CLT do final dos nomes e chaves de produtividade/cadastro.
update sevenlm_connect.funcionario_acesso
   set nome = regexp_replace(nome, '\s*-\s*CLT\s*$', '', 'i'),
       data_hora_atualizado_em = now()
 where nome ~* '\s*-\s*CLT\s*$';

update connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe
   set corretor = regexp_replace(corretor, '\s*-\s*CLT\s*$', '', 'i'),
       corretor_key = regexp_replace(corretor_key, '_clt$', '', 'i')
 where corretor ~* '\s*-\s*CLT\s*$'
    or corretor_key ~* '_clt$';

update connect_comercial.dashboard_gc_produtividade_hierarquia
   set corretor_ativo_nome = regexp_replace(corretor_ativo_nome, '\s*-\s*CLT\s*$', '', 'i'),
       corretor_ativo_mes_key = regexp_replace(corretor_ativo_mes_key, '_clt(_|$)', '\1', 'i'),
       corretor_hierarquia_key = regexp_replace(corretor_hierarquia_key, '_clt$', '', 'i')
 where corretor_ativo_nome ~* '\s*-\s*CLT\s*$'
    or corretor_ativo_mes_key ~* '_clt(_|$)'
    or corretor_hierarquia_key ~* '_clt$';

-- Atualizar a hierarquia manual de junho para garantir nomes/equipes alinhados ao QLP.
update connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe h
   set equipe = q.equipe,
       equipe_key = pg_temp.tmp_slug_qlp(q.equipe),
       gerente = q.gerente,
       coordenador = q.coordenador,
       regiao = q.regiao,
       ativo_no_mes = true
  from tmp_qlp_junho_2026 q
 where h.mes_referencia = date '2026-06-01'
   and pg_temp.tmp_norm_qlp(h.corretor)=pg_temp.tmp_norm_qlp(q.corretor);

commit;



