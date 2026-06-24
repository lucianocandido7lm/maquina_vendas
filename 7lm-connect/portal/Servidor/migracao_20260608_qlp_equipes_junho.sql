BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE tmp_qlp_equipes (
  equipe text NOT NULL,
  regiao text,
  gerente_vendas text,
  gerente_comercial text,
  gerente_regional text,
  head_comercial text,
  diretor_comercial text
) ON COMMIT DROP;

INSERT INTO tmp_qlp_equipes (
  equipe, regiao, gerente_vendas, gerente_comercial, gerente_regional, head_comercial, diretor_comercial
) VALUES
('Equipe Própria | FSA', 'Formosa', 'Vivian', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Equipe Própria 2 | FSA', 'Formosa', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Autônomos | FSA', 'Formosa', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Autônomos 2 | FSA', 'Formosa', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Equipe Própria | AGL', 'Águas Lindas', 'Ana Cleia Nonato', 'Marco Taveira', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Equipe Própria 2 | AGL', 'Águas Lindas', 'Josué Gomes de Souza', 'Marco Taveira', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Equipe Própria 3 | AGL', 'Águas Lindas', 'Em aberto', 'Marco Taveira', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Canal Virtual 1', 'Sede', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Canal Virtual 2', 'Sede', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Canal Virtual 3', 'Sede', 'Pâmela', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Canal Virtual 4', 'Sede', 'Renata', 'Geisiane Gomes dos Santos', 'Marco Taveira', 'Marcelo Paiva', 'Marco Narciso'),
('Equipe Própria | CAT', 'Catalão', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Vago', 'Marcelo Paiva', 'Marco Narciso');

UPDATE sevenlm_connect.funcionario_equipe_vigencia eq
   SET regiao = src.regiao,
       gerente_vendas = src.gerente_vendas,
       gerente_comercial = src.gerente_comercial,
       gerente_regional = src.gerente_regional,
       head_comercial = src.head_comercial,
       diretor_comercial = src.diretor_comercial,
       data_fim_vigencia = NULL,
       status_equipe = 'ATIVO',
       ativo = TRUE,
       origem_planilha = 'QLP atualizado 05 06 (1).pdf',
       observacao = 'Organização vigente desde 2026-06-01 conforme QLP atualizado em 05/06.',
       data_hora_atualizado_em = NOW()
  FROM tmp_qlp_equipes src
 WHERE lower(eq.equipe) = lower(src.equipe)
   AND eq.data_inicio_vigencia = DATE '2026-06-01';

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
  origem_planilha,
  observacao
)
SELECT
  src.equipe,
  src.regiao,
  src.gerente_vendas,
  src.gerente_comercial,
  src.gerente_regional,
  src.head_comercial,
  src.diretor_comercial,
  DATE '2026-06-01',
  'ATIVO',
  TRUE,
  'QLP atualizado 05 06 (1).pdf',
  'Organização vigente desde 2026-06-01 conforme QLP atualizado em 05/06.'
FROM tmp_qlp_equipes src
WHERE NOT EXISTS (
  SELECT 1
    FROM sevenlm_connect.funcionario_equipe_vigencia eq
   WHERE lower(eq.equipe) = lower(src.equipe)
     AND eq.data_inicio_vigencia = DATE '2026-06-01'
);

UPDATE sevenlm_connect.funcionario_equipe_vigencia
   SET ativo = FALSE,
       status_equipe = 'INATIVO',
       data_hora_atualizado_em = NOW()
 WHERE lower(equipe) = lower('Autônomos | AGL')
   AND data_inicio_vigencia = DATE '2026-06-01';

CREATE TEMP TABLE tmp_qlp_roster (
  equipe text NOT NULL,
  equipe_key text NOT NULL,
  corretor text NOT NULL,
  corretor_key text NOT NULL,
  gerente text,
  coordenador text,
  regiao text,
  tipo text,
  observacao text
) ON COMMIT DROP;

INSERT INTO tmp_qlp_roster (
  equipe, equipe_key, corretor, corretor_key, gerente, coordenador, regiao, tipo, observacao
) VALUES
('Equipe Própria | FSA', 'equipe_propria_fsa', 'Ingrid Alves D''Aparecida', 'ingrid_alves_d_aparecida', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria | FSA', 'equipe_propria_fsa', 'Ryan Gomes Calazans', 'ryan_gomes_calazans', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria | FSA', 'equipe_propria_fsa', 'Maria Daiana da Silva Brandão', 'maria_daiana_da_silva_brandao', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria | FSA', 'equipe_propria_fsa', 'Nauane Martins Da Silva Oliveira', 'nauane_martins_da_silva_oliveira', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria | FSA', 'equipe_propria_fsa', 'Valmir Santana dos Santos', 'valmir_santana_dos_santos', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria 2 | FSA', 'equipe_propria_2_fsa', 'Gabriel do Nascimento Dias', 'gabriel_do_nascimento_dias', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria 2 | FSA', 'equipe_propria_2_fsa', 'Maria Eugenia Martins alves', 'maria_eugenia_martins_alves', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria 2 | FSA', 'equipe_propria_2_fsa', 'Murielly de Sousa Santos', 'murielly_de_sousa_santos', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria 2 | FSA', 'equipe_propria_2_fsa', 'Nathália Nogueira Aguiar', 'nathalia_nogueira_aguiar', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Equipe Própria 2 | FSA', 'equipe_propria_2_fsa', 'Natália Cristina Neris dos Santos', 'natalia_cristina_neris_dos_santos', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa', 'Equipe propria', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'ANNA LUIZA PEREIRA DE SOUSA', 'anna_luiza_pereira_de_sousa', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'CAMILA FERNANDES DA SILVA', 'camila_fernandes_da_silva', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'CLEIDE DE OLIVEIRA ALVES', 'cleide_de_oliveira_alves', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'ISABELLA PEREIRA FELICIANO', 'isabella_pereira_feliciano', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'STEFFANY SILVA PINTO', 'steffany_silva_pinto', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos | FSA', 'autonomos_fsa', 'Thamara Rafaella de Melo Santos', 'thamara_rafaella_de_melo_santos', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'GYOVANA FERNANDES ALMEIDA CASTRO', 'gyovana_fernandes_almeida_castro', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'KEULLY DE SOUSA BRAGA', 'keully_de_sousa_braga', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'LETICIA LORRANNY SANTOS DOURADO', 'leticia_lorranny_santos_dourado', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'THAIRINE STEFANNI RODRIGUES DA SILVA', 'thairine_stefanni_rodrigues_da_silva', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'MARCILENE DOS REIS CARVALHO', 'marcilene_dos_reis_carvalho', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'Erika Alves Gomes', 'erika_alves_gomes', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Autônomos 2 | FSA', 'autonomos_2_fsa', 'Pabline Micheli Oliveira da Silva', 'pabline_micheli_oliveira_da_silva', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa', 'Autonomo', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'NATASHA LUCILÍA BARBOSA', 'natasha_lucilia_barbosa', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'JONATAS CASTRO DA SILVA', 'jonatas_castro_da_silva', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'MAYSA GABRIELA GONCALVES OLIVEIRA', 'maysa_gabriela_goncalves_oliveira', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'Áquila da Silva Fernandes', 'aquila_da_silva_fernandes', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'ARIANI MORAIS DE SOUSA PEREIRA', 'ariani_morais_de_sousa_pereira', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'MILENE DE ALMEIDA LIMA', 'milene_de_almeida_lima', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria | AGL', 'equipe_propria_agl', 'Mirian da Silva Gomes Rodrigues', 'mirian_da_silva_gomes_rodrigues', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'JOÃO VITOR BRITO', 'joao_vitor_brito', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'FABIANE BEZERRA DE MOMEIRA DOS SANTOS', 'fabiane_bezerra_de_momeira_dos_santos', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'WANDERSON ROMERO COELHO DA SILVA', 'wanderson_romero_coelho_da_silva', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'JULIANA MARIA DE SOUZA', 'juliana_maria_de_souza', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'ANA LUIZA ENTREPONTES DA COSTA', 'ana_luiza_entrepontes_da_costa', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', 'novata'),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'LUIS ALVES DOS SANTOS DA SILVA ROCHA', 'luis_alves_dos_santos_da_silva_rocha', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Equipe Própria 2 | AGL', 'equipe_propria_2_agl', 'Guilherme Pereira Santos', 'guilherme_pereira_santos', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'Equipe propria', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Daniel Andrade dos Santos', 'daniel_andrade_dos_santos', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Maria Eduarda Damasceno', 'maria_eduarda_damasceno', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Caio Brendon Lopes Martins', 'caio_brendon_lopes_martins', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Lucas de Souza Rodrigues', 'lucas_de_souza_rodrigues', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Lucas Ramos de Victória', 'lucas_ramos_de_victoria', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 1', 'canal_virtual_1', 'Tamires Campos', 'tamires_campos', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Sandra Santos', 'sandra_santos', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Lucas Braga de Souza Oliveira', 'lucas_braga_de_souza_oliveira', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Leticia Santos da Silva Brito', 'leticia_santos_da_silva_brito', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Luana Santana dos Santos', 'luana_santana_dos_santos', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Eurides Alves', 'eurides_alves', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 2', 'canal_virtual_2', 'Beatriz Santos', 'beatriz_santos', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 3', 'canal_virtual_3', 'Marta Anastácio Neres', 'marta_anastacio_neres', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 3', 'canal_virtual_3', 'Joelma Freire', 'joelma_freire', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 3', 'canal_virtual_3', 'Jéssica Silva', 'jessica_silva', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Canal Virtual 3', 'canal_virtual_3', 'Antônio Alisson Almeida', 'antonio_alisson_almeida', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', 'Canal virtual', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Emannuelly do Bom Parto Souza Carvalho', 'emannuelly_do_bom_parto_souza_carvalho', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Leticia Aparecida de Melo Godinho', 'leticia_aparecida_de_melo_godinho', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Viviane Machado Gomes de Pereira Araujo', 'viviane_machado_gomes_de_pereira_araujo', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Sara Cristina Medeiros da Costa', 'sara_cristina_medeiros_da_costa', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Samara de Melo Cruz', 'samara_de_melo_cruz', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL),
('Equipe Própria | CAT', 'equipe_propria_cat', 'Tamires Paola Murer', 'tamires_paola_murer', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão', 'Equipe propria', NULL);

DELETE FROM connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe
 WHERE mes_referencia = DATE '2026-06-01';

INSERT INTO connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe (
  mes_referencia,
  equipe,
  equipe_key,
  corretor,
  corretor_key,
  gerente,
  coordenador,
  regiao,
  tipo,
  repasses_mes,
  ativo_no_mes,
  origem_planilha
)
SELECT
  DATE '2026-06-01',
  equipe,
  equipe_key,
  corretor,
  corretor_key,
  gerente,
  coordenador,
  regiao,
  tipo,
  0,
  TRUE,
  'QLP atualizado 05 06 (1).pdf'
FROM tmp_qlp_roster;

CREATE TEMP TABLE tmp_qlp_funcionarios_casados (
  identificador_funcionario uuid NOT NULL,
  equipe text NOT NULL,
  gestor text,
  coordenador text,
  regiao text
) ON COMMIT DROP;

INSERT INTO tmp_qlp_funcionarios_casados (
  identificador_funcionario, equipe, gestor, coordenador, regiao
) VALUES
('77a4e829-f2ea-4300-9f6f-d974b039a681', 'Equipe Própria | FSA', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa'),
('aa48d0af-0813-4655-8736-4522112dbf26', 'Equipe Própria | FSA', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa'),
('22f3d160-b40f-4485-add1-f5fd74ded444', 'Equipe Própria | FSA', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa'),
('9356f12d-2e7d-46b5-ba19-dc74b8ccacfa', 'Equipe Própria | FSA', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa'),
('94b69e1a-c971-4fae-9c23-fadb9298bc08', 'Equipe Própria | FSA', 'Vivian', 'Thomaz Moreira Aquino', 'Formosa'),
('1526518b-345e-4227-94e0-d6bd1c3ece34', 'Equipe Própria 2 | FSA', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa'),
('63747bdc-eb6a-4ee7-b303-4e39a5bbe798', 'Equipe Própria 2 | FSA', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa'),
('e746ee02-537c-4814-b6d8-f2ae15cfa459', 'Equipe Própria 2 | FSA', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa'),
('91725954-2220-4076-940a-3f4d348c670d', 'Equipe Própria 2 | FSA', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa'),
('6905ad68-9732-41c3-b72d-abf3c6acbda0', 'Equipe Própria 2 | FSA', 'Lucas Paulo Marques Pinto', 'Thomaz Moreira Aquino', 'Formosa'),
('f0296b6e-24bd-447d-bbbc-09b4bac4361c', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa'),
('91c9d777-a433-4a91-8d85-45a21172745f', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa'),
('79ca62cc-2396-4493-a583-c8a4dbb215ab', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa'),
('037b0554-97c6-4fa5-b754-0a45274013f8', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa'),
('2ab1b2f2-6015-476f-b6b0-8e0a52613cef', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa'),
('a7b8a4de-3245-4084-97f7-f6cc80458ebe', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('4960f2e7-075b-42d5-b7c6-ff072a95d6d2', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('a8be4cb7-d3ee-4dcb-947d-3c60127e2c74', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('c73041da-471c-47e0-831c-117f66754df6', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('f84a55a5-8e3e-4613-a6e7-6fc5b85b658b', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('139e9848-013e-432e-8586-0aedae712c3f', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('3e785d63-f8f5-45db-9dd4-973b1b687190', 'Autônomos 2 | FSA', 'Daiana Soares Da Rocha', 'Thomaz Moreira Aquino', 'Formosa'),
('78968e73-e68c-4758-80a2-f90aff238373', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('996c304f-ed5a-49e3-85b4-e103cbe0b782', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('838495be-ba16-45aa-bfc4-5737edef316b', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('93ecab49-f0e0-4fa3-ba9d-813bd32f37f8', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('a953699e-9d2d-4d91-8cf8-f5b8698ba615', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('5bb68b33-0493-4b0f-90c1-2daf1dc0530b', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas'),
('94118de8-8f3d-4a98-9a75-b1042a5d2291', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas'),
('7ead5f48-5d37-4097-a7ad-187847150a28', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas'),
('5026d5aa-9f6e-446d-bf42-5881eee3dd29', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas'),
('ba9ced5b-26c9-471b-94c7-f6512b13c51d', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas'),
('fa6bfd22-f6b4-4b93-b53a-11ac7305029d', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede'),
('11b5f2b4-fb7e-45eb-a908-6a7e5959975a', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede'),
('92402647-0467-41b2-b12e-331dad875632', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede'),
('f9b4cd33-eee1-40d4-9700-8d4e5f6cadf9', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede'),
('3eaf2282-d09f-4382-9249-e80fbdd061ad', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede'),
('7b30dffc-b45d-46c1-8fe6-7ec9c25ded40', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede'),
('06cc264f-567e-4087-aab2-487144d690db', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede'),
('92d30ae1-1c4a-4174-95ea-aef79c2825d5', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede'),
('2c821bdb-0bba-40fd-a2cb-cb86dbe90d09', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede'),
('08f91902-72a4-4ca8-bc31-6eb5f84f13c3', 'Canal Virtual 3', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede'),
('bcc83fcd-0e51-4ccb-a805-b76135b8e0ba', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão'),
('dd978c5f-c166-47a0-9780-d4c803741599', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão'),
('b53a92fd-b4a7-4b1e-a526-0eb29d0a58ee', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão'),
('6089a43e-6439-4cec-9be5-faa19a0a0996', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão'),
('197517cb-9638-4673-90af-712fbb4fedd2', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão'),
('cc3819df-4d30-4dfe-9d0d-c4d8421c23c9', 'Equipe Própria | CAT', 'Hawila Souza Costa', 'Jordan Ribeiro Vasconcelos', 'Catalão');

UPDATE sevenlm_connect.funcionario_acesso f
   SET imobiliaria = src.equipe,
       identificador_equipe_vigencia = eq.identificador_equipe_vigencia,
       gestor = src.gestor,
       coordenador = src.coordenador,
       gerente = COALESCE(eq.gerente_regional, f.gerente),
       diretor = COALESCE(eq.diretor_comercial, f.diretor),
       regional = src.regiao,
       regiao = src.regiao,
       ativo = TRUE,
       ativo_negocio = TRUE,
       data_inicio_vigencia = DATE '2026-06-01',
       data_fim_vigencia = NULL,
       origem_planilha = 'QLP atualizado 05 06 (1).pdf',
       observacao = COALESCE(NULLIF(f.observacao, ''), 'Equipe atualizada conforme QLP atualizado em 05/06.'),
       data_hora_atualizado_em = NOW()
  FROM tmp_qlp_funcionarios_casados src
  JOIN sevenlm_connect.funcionario_equipe_vigencia eq
    ON lower(eq.equipe) = lower(src.equipe)
   AND eq.data_inicio_vigencia = DATE '2026-06-01'
 WHERE f.identificador_funcionario = src.identificador_funcionario;

CREATE TEMP TABLE tmp_qlp_funcionarios_minimos (
  nome text NOT NULL,
  equipe text NOT NULL,
  gestor text,
  coordenador text,
  regiao text,
  observacao text
) ON COMMIT DROP;

INSERT INTO tmp_qlp_funcionarios_minimos (
  nome, equipe, gestor, coordenador, regiao, observacao
) VALUES
('CLEIDE DE OLIVEIRA ALVES', 'Autônomos | FSA', 'Alana Rabelo da Costa', 'Thomaz Moreira Aquino', 'Formosa', NULL),
('Mirian da Silva Gomes Rodrigues', 'Equipe Própria | AGL', 'Ana Cleia Nonato', 'Marco Taveira', 'Águas Lindas', NULL),
('JOÃO VITOR BRITO', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', NULL),
('ANA LUIZA ENTREPONTES DA COSTA', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', 'novata'),
('Guilherme Pereira Santos', 'Equipe Própria 2 | AGL', 'Josué Gomes de Souza', 'Marco Taveira', 'Águas Lindas', NULL),
('Tamires Campos', 'Canal Virtual 1', 'Micael dos Santos Pires', 'Geisiane Gomes dos Santos', 'Sede', NULL),
('Eurides Alves', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', NULL),
('Beatriz Santos', 'Canal Virtual 2', 'Alba Vieira da Silva Lopes', 'Geisiane Gomes dos Santos', 'Sede', NULL),
('Joelma Freire', 'Canal Virtual 3', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', NULL),
('Jéssica Silva', 'Canal Virtual 3', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', NULL),
('Antônio Alisson Almeida', 'Canal Virtual 3', 'Pâmela', 'Geisiane Gomes dos Santos', 'Sede', NULL);

INSERT INTO sevenlm_connect.funcionario_acesso (
  tipo_funcionario,
  tipo_vinculo,
  nome,
  cargo,
  imobiliaria,
  identificador_equipe_vigencia,
  gestor,
  coordenador,
  gerente,
  diretor,
  regional,
  regiao,
  ativo_negocio,
  ativo,
  ativo_login,
  data_inicio_vigencia,
  data_fim_vigencia,
  referencia_origem,
  origem_planilha,
  cadastrado_por,
  observacao,
  data_hora_importacao
)
SELECT
  'CORRETOR',
  NULL,
  src.nome,
  'Corretor',
  src.equipe,
  eq.identificador_equipe_vigencia,
  src.gestor,
  src.coordenador,
  eq.gerente_regional,
  eq.diretor_comercial,
  src.regiao,
  src.regiao,
  TRUE,
  TRUE,
  FALSE,
  DATE '2026-06-01',
  NULL,
  'QLP atualizado 05 06 (1).pdf',
  'QLP atualizado 05 06 (1).pdf',
  'Codex',
  concat('Cadastro mínimo criado pelo QLP 05/06 para composição de equipe/produtividade.', case when src.observacao is not null then ' Observação: ' || src.observacao else '' end),
  NOW()
FROM tmp_qlp_funcionarios_minimos src
JOIN sevenlm_connect.funcionario_equipe_vigencia eq
  ON lower(eq.equipe) = lower(src.equipe)
 AND eq.data_inicio_vigencia = DATE '2026-06-01'
WHERE NOT EXISTS (
  SELECT 1
    FROM sevenlm_connect.funcionario_acesso f
   WHERE lower(f.nome) = lower(src.nome)
);

COMMIT;
