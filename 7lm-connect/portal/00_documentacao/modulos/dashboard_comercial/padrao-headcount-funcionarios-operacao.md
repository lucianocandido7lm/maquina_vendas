# Padrao De Contagem - Headcount, Ativos E Fato Operacional

Data: 2026-06-18

## Objetivo

Padronizar como o Dashboard Comercial deve vincular funcionarios, contar
HeadCount, calcular denominadores de IPC e preservar volume operacional quando
cruzar a base oficial de funcionarios com fatos comerciais.

Esta regra separa vinculo cadastral de HeadCount. Filtros, graficos, graficos
expandidos e Analise por Corretor usam o cadastro completo de funcionarios. A
regra de ativo fica restrita ao HeadCount e aos denominadores oficiais de IPC.

## Fonte Oficial De Pessoas

A fonte oficial de funcionarios, corretores, SDRs, gestores, coordenadores,
regiao e imobiliaria e:

```text
sevenlm_connect.funcionario_acesso
```

Quando existir equipe vigente vinculada ao funcionario, a API administrativa
tambem pode trazer dados de:

```text
sevenlm_connect.funcionario_equipe_vigencia
sevenlm_connect.funcionario_status_diario
```

Essas tabelas complementam a leitura cadastral, mas nao substituem
`funcionario_acesso` como base de pessoas.

## Fonte Oficial De Volume Operacional

A fonte de fatos comerciais e:

```text
connect_comercial.comercial_kpi_daily
```

Ela preserva eventos do funil, vendas, repasses, distratos, cancelamentos e
demais metricas operacionais.

## Regra De Segmentacao Comercial

Para o Dashboard Comercial, a segmentacao comercial deve seguir
`tipo_funcionario`.

```text
CORRETOR = funcionario_acesso.tipo_funcionario = 'CORRETOR'
SDR      = funcionario_acesso.tipo_funcionario = 'SDR'
```

Nao usar `cargo`, `imobiliaria` ou nome de equipe para redefinir esse segmento
quando a regra desejada for a mesma da aba Gente e Cultura.

Exemplo importante:

- uma pessoa da imobiliaria "Canal Virtual" continua sendo classificada pelo
  `tipo_funcionario`;
- se `tipo_funcionario = 'CORRETOR'`, conta como corretor;
- se `tipo_funcionario = 'SDR'`, conta como SDR;
- se nao houver SDR cadastrado com `tipo_funcionario = 'SDR'`, o HC de SDR fica
  zero, mesmo que existam fatos operacionais com nome de SDR.

## Regra De Ativo

Ativo e uma regra de HeadCount. Nao deve ser usada para esconder funcionarios
dos filtros, graficos ou vinculos cadastrais.

O funcionario e considerado ativo no periodo quando atende a regra oficial de
HeadCount.

### Com Datas De Vigencia

Quando existem datas de inicio/fim, a data manda.

Campos aceitos para inicio:

```text
data_inicio_vigencia_data
data_inicio_vigencia
dt_admissao
```

Campos aceitos para fim:

```text
data_fim_vigencia_data
data_fim_vigencia
dt_demissao
```

Para um periodo `:data_inicio` ate `:data_fim`, o funcionario entra como ativo
quando existe intersecao entre vigencia e periodo:

```text
inicio < :data_fim_exclusivo
and (fim is null or fim >= :data_inicio)
```

Se existir inicio ou fim valido, a decisao principal e feita por essas datas.

### Sem Datas De Vigencia

Quando nao existe data de vigencia/admissao/demissao, usar os marcadores
cadastrais como fallback:

```text
ativo
ativo_negocio
ativo_no_negocio
ativo_cadastro
indicador_ativo
ativo_login
status_operacional
status_negocio
status_cadastro
situacao
situacao_negocio
observacao / Status CV
```

Valores ou textos que indicam inativo, desligado, demitido, rescindido,
desativado ou bloqueado removem o funcionario do HC ativo.

Valores que indicam afastado, ausente, ferias ou licenca tambem nao entram no
HC ativo. Devem ser contados separadamente quando a tela precisar exibir
afastados.

## O Que Cada Contagem Significa

### HC Ativo

Quantidade de pessoas comerciais ativas no periodo.

Unidade:

```text
funcionario unico ativo
```

Chave preferencial:

```text
identificador_funcionario
```

Fallback de identidade, quando necessario:

```text
identificador_usuario
email
documento
nome normalizado
```

Nao depende de venda, lead, visita ou repasse na fato operacional. Tambem nao
define quais funcionarios aparecem em filtros ou graficos cadastrais.

### Funcionarios Vinculados

Quantidade/lista de pessoas comerciais cadastradas em
`sevenlm_connect.funcionario_acesso`, independentemente de estarem ativas no
mes.

Essa e a base dos filtros e graficos de funcionario:

```text
corretor
sdr
gestor
coordenador
regiao
imobiliaria
```

Essa base pode incluir ativos, inativos, desligados e pessoas sem producao no
periodo. O objetivo e permitir vinculo completo da fato com o cadastro.

### HC Por Grupo

Quantidade de pessoas vinculadas ao recorte exibido:

```text
gestor
coordenador
regiao
imobiliaria
equipe
```

Esses atributos devem vir de `funcionario_acesso` ou de equipe vinculada ao
funcionario, nao da fato operacional. A regra de ativo so entra quando o
indicador for HeadCount.

### Afastados

Pessoas comerciais cadastradas como afastadas no periodo. Nao entram no HC
ativo nem no denominador de IPC, mas podem aparecer em indicador proprio para
nao misturar ausencia operacional com historico cadastral.

### Performance Real

Quantidade de pessoas que aparecem na fato operacional no periodo.

Unidade:

```text
pessoa/nome com registro em connect_comercial.comercial_kpi_daily
```

Essa contagem pode incluir inativos, desligados, nomes sem vinculo cadastral e
pessoas fora da hierarquia atual. Ela mede presenca na fato, nao HC.

### Volume Total Operacional

Soma integral das metricas da fato no periodo.

Exemplos:

```text
sum(leads)
sum(visitas)
sum(agendamentos)
sum(vendas)
sum(repasses)
sum(cancelamentos)
sum(distratos)
```

O volume total nunca deve diminuir porque uma pessoa esta inativa, afastada,
desligada ou sem cadastro em `funcionario_acesso`.

### Inativos/Outros

Grupo tecnico usado para preservar volume de fatos que nao encontram funcionario
vinculado de forma confiavel.

Entram em `Inativos/Outros`:

- fato com pessoa que nao existe em `funcionario_acesso`;
- fato sem `dim_corretor`/e-mail/documento/chave canonica suficiente para
  vinculo;
- fato cujo fallback por nome nao encontra funcionario comercial cadastrado;
- fato sem nome suficiente para vinculo confiavel.

Esse grupo entra nos totais operacionais e na visao por corretor quando a tela
precisar fechar o volume. Nao entra no denominador de IPC.

## Identidade Canonica Nas Abas De Corretor

Nas abas `Consolidado Corretor`, `Corretor Diario`, `Corretores Foguetes` e no
detalhamento clicavel dessas abas, o vinculo correto nao deve depender primeiro
do nome normalizado.

Fluxo preferencial:

```text
fato comercial -> connect_comercial.dim_corretor -> sevenlm_connect.funcionario_acesso
```

Prioridade de identidade:

1. `idcorretor_canonico` ou `idcorretor_atual` da fato resolve
   `connect_comercial.dim_corretor.idcorretor`;
2. o e-mail normalizado de `dim_corretor.email` resolve
   `funcionario_acesso.email`;
3. quando existir, documento ou e-mail normalizado do funcionario compoe a chave
   de identidade;
4. se nao houver chave melhor, usa-se `idcorretor` da fato;
5. fallback final por nome normalizado, marcado como vinculo fragil em auditoria.

Corretores inativos, desligados ou historicos que existam em
`funcionario_acesso` continuam vinculados ao proprio corretor para preservar a
rastreabilidade. Eles so devem cair em `Inativos/Outros` quando o fato nao
encontrar funcionario por chave estavel nem por fallback controlado.

O detalhamento clicavel deve receber a mesma `corretor_identity_key` usada na
linha agregada. O filtro por nome fica apenas como compatibilidade quando a
linha clicada ainda nao possui chave canonica.

## Regra De Cruzamento Com A Fato

Para telas de volume operacional, o join deve preservar 100% da fato e deve
usar o cadastro completo de funcionarios.

Padrao recomendado para fatos que possuem `idcorretor` ou conseguem ser
resolvidos por `dim_corretor`:

```sql
with base_funcionarios as (
  select
    lower(trim(f.email::text)) as email_norm,
    f.identificador_funcionario,
    f.nome,
    f.tipo_funcionario,
    f.gestor,
    coalesce(f.coordenador, f.gerente) as coordenador,
    coalesce(f.regiao, f.regional) as regiao,
    f.imobiliaria
  from sevenlm_connect.funcionario_acesso f
  where upper(trim(coalesce(f.tipo_funcionario, ''))) in ('CORRETOR', 'SDR')
    -- sem filtro de ativo: filtros/graficos vinculam todo o cadastro
),
base_fatos as (
  select *
  from connect_comercial.comercial_base
  where data_referencia >= :data_inicio
    and data_referencia <= :data_fim
),
dim_corretor as (
  select
    nullif(trim(idcorretor::text), '') as idcorretor_text,
    lower(trim(email::text)) as email_norm
  from connect_comercial.dim_corretor
)
select
  coalesce(bf.nome, 'Inativos/Outros') as pessoa,
  coalesce(bf.gestor, 'Inativos/Outros') as gestor,
  coalesce(bf.coordenador, 'Inativos/Outros') as coordenador,
  coalesce(bf.regiao, 'Inativos/Outros') as regiao,
  coalesce(bf.imobiliaria, 'Inativos/Outros') as imobiliaria,
  sum(coalesce(ft.leads, 0)) as leads,
  sum(coalesce(ft.vendas, 0)) as vendas,
  sum(coalesce(ft.repasses, 0)) as repasses
from base_fatos ft
left join dim_corretor dc
  on dc.idcorretor_text = nullif(coalesce(ft.idcorretor_canonico, ft.idcorretor_atual)::text, '')
left join base_funcionarios bf
  on bf.email_norm = dc.email_norm
group by 1, 2, 3, 4, 5;
```

Quando a fonte agregada nao possui `idcorretor` nem e-mail, a API pode usar uma
ponte previamente resolvida pela base granular. Match direto por nome so deve
ser fallback final e auditavel.

Para telas cujo objetivo e calcular HeadCount, aplicar a regra oficial de ativo
separadamente. Para filtros e graficos cadastrais, nao aplicar ativo.

## Regra De IPC

IPC nao e contagem de quem vendeu. IPC e indice de produtividade da maquina
ativa.

### Numerador

O numerador vem da fato operacional:

```text
sum(repasses)
```

Ele deve incluir repasses de ativos e tambem repasses historicos de
inativos/outros, quando o objetivo for medir o volume total da operacao no
periodo.

### Denominador Mensal

O denominador vem do HC ativo da base de funcionarios no periodo:

```text
count(distinct identificador_funcionario ativo)
```

Nao usar:

```text
count(distinct corretor em comercial_kpi_daily)
```

Esse erro troca "funcionario ativo" por "pessoa que apareceu na fato".

### Formula

```text
IPC mensal = sum(repasses do periodo) / count(distinct funcionarios ativos no periodo)
```

Para acumulados com varios meses, somar denominadores mensais quando a regra for
produtividade por funcionario-mes:

```text
IPC YTD = sum(repasses no YTD) / sum(HC ativo de cada mes do YTD)
```

## Regras Para Filtros E Graficos

Filtros de pessoa devem vir de `funcionario_acesso` completo:

```text
corretor
gestor do corretor
coordenador do corretor
regiao do corretor
imobiliaria do corretor
sdr
gestor do sdr
coordenador do sdr
regiao do sdr
imobiliaria do sdr
```

Breakdowns/graficos internos de cards expandidos que exibem corretor, SDR,
gestor, coordenador, regiao ou imobiliaria tambem devem usar os atributos de
`funcionario_acesso` completo, sem corte de ativo por mes.

Quando o grafico mede volume operacional, fatos sem match devem aparecer como
`Inativos/Outros` para fechar o total.

## Invariantes De Validacao

Qualquer implementacao deve passar nestas validacoes:

1. A soma do volume operacional na visao operacional deve ser igual a soma do
   volume na visao por corretor/SDR.
2. Trocar entre visoes nao pode alterar `sum(leads)`, `sum(vendas)`,
   `sum(repasses)`, `sum(cancelamentos)` ou `sum(distratos)` para o mesmo
   periodo/filtros operacionais.
3. O denominador de IPC deve bater com o HeadCount oficial para o periodo.
4. `Inativos/Outros` pode ter volume, mas nao pode aumentar o HC ativo.
5. Um funcionario cadastrado sem fato pode aparecer nas visoes cadastrais com
   metricas zeradas quando a tela for de vinculo de funcionario.
6. Um fato de pessoa inativa ou sem cadastro deve aparecer no volume total,
   agregado como `Inativos/Outros`.

## Referencias No Codigo

Gente e Cultura - frontend:

```text
02_publico/02_recursos/02_scripts/dashboard_gc.js
```

Funcoes relevantes:

```text
funcionarioTipo
isCommercialFuncionario
funcionarioStatusCadastro
isActiveFuncionario
activeCommercialFuncionarios
pessoaKey
```

Gente e Cultura - backend:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_administracao.py
01_codigo_fonte/api_7lm_connect/servicos/funcionarios_acesso.py
```

Funcoes relevantes:

```text
listar_funcionarios
_funcionario_ativo_produtividade_dashboard_gc
_linha_hierarquia_ativa_produtividade_dashboard_gc
_filtrar_hierarquia_por_funcionarios_ativos_dashboard_gc
_resumo_no_produtividade_dashboard_gc
```

Dashboard Comercial:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Helpers esperados:

```text
_sql_funcionarios_comerciais_vigentes
_condicao_funcionario_pessoa
_condicao_funcionario_ativo_intervalo_sql
```

## Decisao Arquitetural

`funcionario_acesso` define quem existe no cadastro comercial e qual e sua
estrutura. A regra oficial de HeadCount define quem esta ativo. A
`comercial_kpi_daily` define o que aconteceu na operacao.

Essas duas leituras nao devem ser misturadas:

- filtros, graficos e vinculos de corretor/SDR/gestor/coordenador/regiao/
  imobiliaria usam o cadastro completo de `sevenlm_connect.funcionario_acesso`;
- HeadCount e denominador oficial de IPC aplicam a regra oficial de ativo;
- leads, visitas, vendas, repasses, cancelamentos e distratos vem da fato
  `connect_comercial.comercial_kpi_daily`;
- fatos sem funcionario ativo continuam no volume como `Inativos/Outros`;
- `Inativos/Outros` nunca entra no denominador do IPC.
