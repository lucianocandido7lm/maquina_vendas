# Regra Consolidada - IPC E Corretores Ativos

Data: 2026-06-16

> Documento historico. A regra canonica atual para HC, funcionarios ativos,
> denominador de IPC e preservacao de volume operacional esta em
> `00_documentacao/modulos/dashboard_comercial/padrao-headcount-funcionarios-operacao.md`.
> Em caso de conflito, usar o documento canonico atual.

## Objetivo

Consolidar a regra correta de IPC e corretores ativos usada fora do Dashboard
Comercial, antes de implementar a mesma logica dentro do Dashboard Comercial.

## Diagnostico

O Dashboard Comercial calcula hoje:

```text
IPC corretor = repasses do periodo / count(distinct corretor em comercial_kpi_daily no periodo)
```

Essa regra esta errada para a Maquina de Vendas porque "corretor ativo" nao e
"corretor que apareceu na fato comercial". A fato comercial pode conter
corretores historicos, inativos, bloqueados, registros antigos, corretores sem
QLP vigente e pessoas que tiveram algum evento no funil mas nao contam como
base ativa do mes.

## Fonte Oficial Fora Do Dashboard Comercial

A regra madura esta no endpoint de produtividade:

```text
GET /api/gente-cultura/produtividade
```

Arquivo:

```text
01_codigo_fonte/api_7lm_connect/rotas/rotas_de_administracao.py
```

Fontes usadas:

- `connect_comercial.dashboard_gc_produtividade_historico_corretor_equipe`
- `connect_comercial.dashboard_gc_produtividade_repasses_importados`
- `connect_comercial.dashboard_gc_produtividade_hierarquia`
- `connect_comercial.dashboard_gc_produtividade_kpi_daily`
- `sevenlm_connect.funcionario_acesso` como fallback/identidade.

## Prioridade De Fonte Para Corretor Ativo

1. Se existir QLP/historico manual para o mes em
   `dashboard_gc_produtividade_historico_corretor_equipe`, ele manda no mes.
2. Se nao existir historico manual para o mes, usa
   `dashboard_gc_produtividade_hierarquia`.
3. Se a hierarquia nao trouxer flags/status suficientes, usa
   `sevenlm_connect.funcionario_acesso` como fallback de ativo.

## Definicao De Corretor Ativo

Um corretor conta no denominador quando:

- pertence ao QLP/hierarquia vigente do mes;
- tem vinculo de equipe/gerente/coordenador;
- esta ativo no mes;
- nao esta fora da vigencia do periodo;
- nao esta marcado como inativo, desligado, bloqueado, desativado ou similar.

No historico manual, o campo principal e:

```text
ativo_no_mes = true
```

Na hierarquia automatica, os campos avaliados sao:

- `ativo`
- `ativo_login`
- `ativo_negocio`
- `data_inicio_vigencia`
- `data_inicio_vigencia_data`
- `dt_admissao`
- `data_fim_vigencia`
- `data_fim_vigencia_data`
- `dt_demissao`

## Unidade Do Denominador

A unidade correta do denominador e o vinculo produtivo mensal:

```text
mes + coordenador + gerente + equipe + corretor_hierarquia_key/corretor_ativo_mes_key/corretor
```

Na pratica, quando nao ha duplicidade de equipe para a mesma pessoa, isso bate
com quantidade de corretores unicos. Mas a regra deve preservar o vinculo
produtivo, nao apenas nome distinto.

## Formula De IPC

### IPC mensal

```text
IPC mes = repasses oficiais do mes / corretores ativos do mes
```

### IPC acumulado no ano

```text
IPC YTD = repasses oficiais acumulados / soma dos denominadores mensais
```

Ou seja, de janeiro a junho, o denominador nao e a quantidade de corretores
ativos em junho. E a soma de "corretor ativo no mes" em cada mes.

### IPC por corretor

```text
IPC corretor YTD = repasses do corretor no ano / meses ativos do corretor no ano
```

Se o corretor entrou depois de janeiro, o denominador considera os meses ativos
a partir da admissao/vigencia.

## Numerador Oficial De Repasses

Para meses com importacao manual:

```text
dashboard_gc_produtividade_repasses_importados
```

substitui os repasses automaticos do mes.

Para meses sem importacao manual:

```text
dashboard_gc_produtividade_kpi_daily.repasses
```

## Validacao Junho/2026

Periodo: 2026-06-01 a 2026-06-30.

### Dashboard Comercial atual

```text
repasses = 11
corretores distintos com fato = 188
IPC corretor = 0.06
imobiliarias distintas com fato = 14
IPC imobiliaria = 0.79
```

### Regra oficial fora do Dashboard Comercial

```text
fonte do denominador = QLP manual
corretores ativos = 59
equipes ativas = 10
repasses oficiais = 7
IPC corretor = 0.12
IPC equipe/imobiliaria = 0.70
```

### Meses 2026 ja consolidados

```text
2026-01: 42 ativos, 70 repasses, IPC 1.67
2026-02: 51 ativos, 74 repasses, IPC 1.45
2026-03: 63 ativos, 89 repasses, IPC 1.41
2026-04: 57 ativos, 63 repasses, IPC 1.11
2026-05: 63 ativos, 107 repasses, IPC 1.70
2026-06: 59 ativos, 7 repasses, IPC 0.12
```

YTD 2026 ate junho:

```text
repasses = 410
denominador acumulado = 335 corretor-mes
IPC YTD = 1.22
```

## Regra Para O Dashboard Comercial

O Dashboard Comercial deve parar de usar:

```text
count(distinct corretor em comercial_kpi_daily)
```

para IPC/corretores ativos.

Deve usar a mesma camada da Maquina de Vendas:

1. Resolver corretores ativos pelo QLP/hierarquia mensal.
2. Aplicar os mesmos filtros de equipe, gerente, coordenador, regiao e
   imobiliaria a partir da hierarquia oficial.
3. Calcular denominador mensal por vinculo produtivo ativo.
4. Para acumulados, somar denominadores mensais.
5. Para ranking de corretor, calcular repasses / meses ativos do proprio
   corretor.
6. Para IPC por imobiliaria/equipe, usar equipes/imobiliarias ativas do QLP, e
   nao imobiliarias distintas que tiveram fato comercial.

## Pendencias Antes Da Implementacao

- Confirmar se o card `Repasses` do Dashboard Comercial deve mostrar o numerador
  oficial da produtividade ou continuar mostrando `comercial_kpi_daily`.
- Confirmar nomenclatura visual: "IPC Imobiliaria" deve ser tratado como
  "IPC Equipe/Imobiliaria ativa" quando vier da logica de QLP.
- Centralizar a regra em uma funcao/helper de backend para evitar divergencia
  entre Dashboard Comercial, Gente e Cultura, Comissionamento e Maquina de
  Vendas.
