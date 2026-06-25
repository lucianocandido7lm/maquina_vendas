# Meta Por Imobiliaria E Regiao

## Objetivo

Documentar os indicadores, medidas e regras da aba **Metas** do **BI de Reservas**,
exibida no painel **Meta por imobiliaria e regiao**.

A aba compara a previsao de repasse por imobiliaria/regiao contra a meta mensal
configurada para cada combinacao de regiao e imobiliaria.

## Localizacao No Frontend

Arquivo:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/src/pages/ReservasBI.jsx
```

Pontos principais:

- `RESERVAS_TABS`: registra a aba `Metas`.
- `META_TABLE_COLUMNS`: define as colunas, labels e descricoes dos indicadores.
- `GET /api/v1/dashboard/reservas/metas`: carrega os dados da aba.
- `PUT /api/v1/dashboard/reservas/metas`: salva a meta ajustada.

## Localizacao Na API

Arquivo:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Funcoes principais:

- `_sql_base_reservas()`: monta a base de reservas a partir de `comercial_base`.
- `_buscar_reservas_metas()`: calcula os indicadores da aba.
- `_salvar_reservas_meta()`: grava a meta editada pelo usuario.
- `metas_reservas_dashboard()`: rota `GET`.
- `atualizar_meta_reservas_dashboard()`: rota `PUT`.

## Fonte Dos Dados

Tabela principal:

```text
connect_comercial.comercial_base
```

Filtro base:

```sql
where idreserva is not null
```

A base seleciona campos de reserva, repasse, corretor, imobiliaria,
empreendimento, regiao, unidade e campos adicionais usados nas classificacoes.

## Origem Databricks Para Auditoria

Esta secao e obrigatoria para auditoria e validacao. Toda validacao da aba deve
partir do campo original sincronizado do Databricks, comparando depois com a
coluna final em `connect_comercial.comercial_base`.

Pipeline oficial:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Schema Databricks padrao:

```text
data_platform_dev.gold_cvcrm
```

O schema real pode variar por ambiente via:

```text
DATABRICKS_CATALOG
DATABRICKS_SCHEMA
```

Fontes Databricks usadas na carga da `comercial_base`:

| Fonte Databricks | Alias no sync | Uso |
| --- | --- | --- |
| `vw_bi_comercial_base` | `b` | Base principal de jornada comercial, reserva, repasse, datas, situacoes, corretor, imobiliaria, empreendimento e regiao. |
| `cvcrm_campos_adicionais_reserva_wide` | `car` | Campos adicionais de reserva usados em `Mes Seguinte`, `Prob Cair` e auditoria operacional. |
| `cvcrm_campos_adicionais_repasse_wide` | `cap` | Campos adicionais de repasse usados no calculo de `MP Reserva`. |
| `dim_lead` | `dl` | Enriquecimento de lead, origem, cidade e cliente; nao altera diretamente as medidas da aba, mas ajuda auditoria de contexto. |

Regra de prioridade dos campos adicionais:

```sql
coalesce(campo_da_wide_table, campo_da_vw_bi_comercial_base)
```

Ou seja: quando a tabela wide tem valor, ela prevalece sobre o valor que veio
na `vw_bi_comercial_base`.

### Campos Databricks Criticos Por Indicador

| Indicador | Campo Databricks de origem | Fonte Databricks | Coluna final em `connect_comercial.comercial_base` | Uso na medida |
| --- | --- | --- | --- | --- |
| Regiao | `regiao_empreendimento` | `vw_bi_comercial_base` | `regiao_empreendimento` | Agrupamento por regiao. |
| Imobiliaria | `imobiliaria_nome_canonica` | `vw_bi_comercial_base` | `imobiliaria_nome_canonica` | Primeiro nome usado para agrupamento por imobiliaria. |
| Imobiliaria fallback | `imobiliaria_nome` | `vw_bi_comercial_base` | `imobiliaria_nome` | Fallback quando `imobiliaria_nome_canonica` vier vazia. |
| Reservas Situacoes | `idreserva` | `vw_bi_comercial_base` | `idreserva` | Contagem distinta de reservas. |
| Reservas Situacoes | `reserva_situacao_nome` | `vw_bi_comercial_base` | `reserva_situacao_nome` | Classificacao das reservas operacionais. |
| Reservas Situacoes | `dt_referencia_reserva` | `vw_bi_comercial_base` | `dt_referencia_reserva` | Primeira referencia de data para `referencia_data_reserva`. |
| Reservas Situacoes fallback | `dt_cadastro_reserva` | `vw_bi_comercial_base` | `dt_cadastro_reserva` | Fallback de data quando `dt_referencia_reserva` vier nula. |
| Mes Seguinte | `reserva_campos_adicionais_reserva_repasse_no_mes` | `cvcrm_campos_adicionais_reserva_wide`, fallback `vw_bi_comercial_base` | `reserva_campos_adicionais_reserva_repasse_no_mes` | Identifica valor `Nao`. |
| Prob Cair | `reserva_campos_adicionais_reserva_repasse_no_mes` | `cvcrm_campos_adicionais_reserva_wide`, fallback `vw_bi_comercial_base` | `reserva_campos_adicionais_reserva_repasse_no_mes` | Identifica valor `Probabilidade de cair`. |
| MP Reserva | `idrepasse` | `vw_bi_comercial_base` | `idrepasse` | Contagem distinta de repasses. |
| MP Reserva | `dt_referencia_repasse` | `vw_bi_comercial_base` | `dt_referencia_repasse` | Primeira referencia de data para repasse. |
| MP Reserva fallback | `dt_referencia_reserva` | `vw_bi_comercial_base` | `dt_referencia_reserva` | Fallback de data quando `dt_referencia_repasse` vier nula. |
| MP Reserva | `repasse_situacao_nome` | `vw_bi_comercial_base` | `repasse_situacao_nome` | Classifica fluxo de repasse e MP ativa. |
| MP Reserva | `repasse_campos_adicionais_repasse_probabilidade_de_assinatura` | `cvcrm_campos_adicionais_repasse_wide`, fallback `vw_bi_comercial_base` | `repasse_campos_adicionais_repasse_probabilidade_de_assinatura` | Identifica probabilidade `Sim`, `Talvez` ou `Nao`. |
| MP Reserva | `repasse_campos_adicionais_repasse_data_envio_cehop` | `cvcrm_campos_adicionais_repasse_wide`, fallback `vw_bi_comercial_base` | `repasse_campos_adicionais_repasse_data_envio_cehop` | Identifica etapa de envio CEHOP. |
| MP Reserva | `repasse_campos_adicionais_repasse_data_conformidade_cehop` | `cvcrm_campos_adicionais_repasse_wide`, fallback `vw_bi_comercial_base` | `repasse_campos_adicionais_repasse_data_conformidade_cehop` | Identifica conformidade CEHOP. |
| MP Reserva | `repasse_campos_adicionais_repasse_data_da_inconformidade_cehop` | `cvcrm_campos_adicionais_repasse_wide`, fallback `vw_bi_comercial_base` | `repasse_campos_adicionais_repasse_data_da_inconformidade_cehop` | Identifica inconformidade CEHOP. |
| MP Reserva | `repasse_campos_adicionais_repasse_data_do_reenvio_cehop` | `cvcrm_campos_adicionais_repasse_wide`, fallback `vw_bi_comercial_base` | `repasse_campos_adicionais_repasse_data_do_reenvio_cehop` | Identifica reenvio apos inconformidade. |
| Assinados | `idrepasse` | `vw_bi_comercial_base` | `idrepasse` | Contagem distinta de repasses assinados. |
| Assinados | `dt_assinatura_contrato` | `vw_bi_comercial_base` | `dt_assinatura_contrato` | Data de assinatura dentro do periodo. |
| Meta ajustada | nao vem do Databricks | Postgres local | `dashboard_goals.goal_value` | Meta editada no portal. |
| Meta padrao | nao vem do Databricks | Codigo da API | `METAS_RESERVAS_PADRAO` | Fallback quando nao existe meta salva. |

### Campos Databricks De Rastreabilidade

Estes campos nao aparecem como colunas finais da tabela da aba, mas devem ser
usados para auditoria de divergencia, duplicidade e rastreabilidade:

| Campo Databricks/Postgres | Uso em auditoria |
| --- | --- |
| `fato_jornada_comercial_key` | Chave preferencial de deduplicacao na carga da `comercial_base`. |
| `journey_id` | Chave alternativa de jornada quando `fato_jornada_comercial_key` nao estiver disponivel. |
| `journey_key` | Chave alternativa de jornada usada como ultimo fallback no sync. |
| `idlead` | Rastreamento da origem do lead. |
| `idprecadastro` | Rastreamento do precadastro/proposta. |
| `idreserva` | Grao das medidas de reserva. |
| `idrepasse` | Grao das medidas de repasse. |
| `idimobiliaria_canonico` | Auditoria de troca de nome de imobiliaria. |
| `fonte_idimobiliaria_canonico` | Origem do ID canonico da imobiliaria. |
| `fonte_imobiliaria_nome_canonica` | Origem do nome canonico da imobiliaria. |
| `fonte_regiao_empreendimento` | Origem da regiao canonica do empreendimento. |

### Lacuna Conhecida Para Validacao

O campo Power BI/Databricks chamado `.Flag_Sec_Vendas_Credito` nao foi
encontrado na `gold_cvcrm.vw_bi_comercial_base` durante a auditoria de reservas.

Por isso, o backend usa uma regra aproximada para `Reservas Situacoes`:

```text
reserva_situacao_nome normalizada em:
- Credito
- Secretaria de Vendas
- Em processo
```

Impacto:

- a validacao contra Power BI pode divergir quando o Power BI usa
  `.Flag_Sec_Vendas_Credito`;
- qualquer auditoria deve registrar essa diferenca como criterio de validacao;
- se o campo oficial aparecer no Databricks, a regra da API deve ser revisada.

## Endpoint De Leitura

```http
GET /api/v1/dashboard/reservas/metas
```

Requisitos:

- usuario autenticado;
- permissao de leitura do Dashboard Comercial;
- intervalo de datas vindo dos filtros globais.

Resposta:

```json
{
  "items": [],
  "totalsByRegion": []
}
```

`items` contem as linhas por imobiliaria/regiao.

`totalsByRegion` contem os totais consolidados por regiao.

## Endpoint De Edicao

```http
PUT /api/v1/dashboard/reservas/metas
```

Requisitos:

- usuario autenticado;
- permissao `dashboard.comercial.manage`.

Payload:

```json
{
  "regiao": "Nome da regiao",
  "imobiliaria": "Nome da imobiliaria",
  "meta": 10
}
```

Validacoes:

- `regiao` e obrigatoria;
- `imobiliaria` e obrigatoria;
- `meta` precisa ser numerica.

Persistencia:

```text
tabela: connect_comercial.dashboard_goals
kpi_id: reservas_prev_repasse
hierarchy_level: imobiliaria
hierarchy_value: regiao|||imobiliaria
unit: reservas
target_type: absolute
period_type: monthly
business_days_aware: false
```

Quando ja existe uma meta para o mesmo `kpi_id`, `hierarchy_level` e
`hierarchy_value`, a API atualiza `goal_value` e `updated_at`.

## Escopo E Agrupamento

As linhas sao agrupadas por:

| Campo exibido | Campo/API | Regra |
| --- | --- | --- |
| Regiao | `regiao` | Usa `comercial_base.regiao_empreendimento`. Valor vazio vira `Sem regiao`. |
| Imobiliaria | `imobiliaria` | Usa `imobiliaria_nome_canonica`; se vazio, usa `imobiliaria_nome`; se vazio, vira `Sem imobiliaria`. |

Chave funcional da meta:

```text
regiao|||imobiliaria
```

Essa chave e usada tanto no frontend quanto na tabela `dashboard_goals`.

## Filtros Aplicados

A aba respeita os filtros globais enviados pelo frontend para o endpoint de
reservas. Os filtros sao aplicados sobre a base `comercial_base`.

Principais filtros aceitos:

| Parametro | Campo usado |
| --- | --- |
| `cidade` | `lead_cidade` |
| `origem` | `lead_origem_nome` |
| `empreendimento` | `empreendimento_nome` |
| `empreendimentoReduzido` | `regiao_empreendimento` |
| `regiao` | `regiao_empreendimento` |
| `regiaoOperacao` | `regiao_empreendimento` |
| `regiaoCorretor` | `regiao_empreendimento` |
| `corretor` | `corretor_nome_canonico`, fallback `corretor_nome` |
| `corretorOperacao` | `corretor_nome_canonico`, fallback `corretor_nome` |
| `corretorAtivo` | `corretor_nome_canonico`, fallback `corretor_nome` |
| `imobiliaria` | `imobiliaria_nome_canonica`, fallback `imobiliaria_nome` |
| `imobiliariaOperacao` | `imobiliaria_nome_canonica`, fallback `imobiliaria_nome` |
| `imobiliariaCorretor` | `imobiliaria_nome_canonica`, fallback `imobiliaria_nome` |
| `situacaoAtual` | `reserva_situacao_nome` |
| `idReserva` | `idreserva::text` |
| `repasseNoMes` | `reserva_campos_adicionais_reserva_repasse_no_mes` |
| `unidade` | `unidade_nome` |

Valores vazios, `todos`, `todas`, `all`, `undefined` e `null` sao ignorados.

## Indicadores E Medidas

Cada indicador abaixo informa explicitamente o campo final em Postgres e o campo
Databricks correspondente para auditoria. Quando o nome e igual nas duas pontas,
a coluna final foi preservada pelo sync.

### Regiao

Campo:

```text
regiao
```

Origem:

```text
Databricks: data_platform_dev.gold_cvcrm.vw_bi_comercial_base.regiao_empreendimento
Postgres: connect_comercial.comercial_base.regiao_empreendimento
```

Regra:

```sql
coalesce(nullif(regiao_empreendimento, ''), 'Sem regiao')
```

Uso:

- agrupar reservas por regiao do empreendimento;
- totalizar metas por regiao;
- compor a chave `regiao|||imobiliaria`.

### Imobiliaria

Campo:

```text
imobiliaria
```

Origem:

```text
Databricks: data_platform_dev.gold_cvcrm.vw_bi_comercial_base.imobiliaria_nome_canonica
Databricks fallback: data_platform_dev.gold_cvcrm.vw_bi_comercial_base.imobiliaria_nome
Postgres: connect_comercial.comercial_base.imobiliaria_nome_canonica
Postgres fallback: connect_comercial.comercial_base.imobiliaria_nome
```

Regra:

```sql
coalesce(
  nullif(imobiliaria_nome_canonica, ''),
  nullif(imobiliaria_nome, ''),
  'Sem imobiliaria'
)
```

Uso:

- identificar a equipe/imobiliaria responsavel;
- compor a chave da meta;
- comparar a previsao de repasse contra a meta mensal.

### Reservas Situacoes

Campo:

```text
reservas_situacoes
```

Campos Databricks para auditoria:

```text
vw_bi_comercial_base.idreserva
vw_bi_comercial_base.reserva_situacao_nome
vw_bi_comercial_base.dt_referencia_reserva
vw_bi_comercial_base.dt_cadastro_reserva
```

Campos Postgres equivalentes:

```text
comercial_base.idreserva
comercial_base.reserva_situacao_nome
comercial_base.dt_referencia_reserva
comercial_base.dt_cadastro_reserva
```

Formula:

```sql
count(distinct idreserva)
```

Filtro de data:

```sql
referencia_data_reserva >= startDate
and referencia_data_reserva < endDate + interval '1 day'
```

Situacoes consideradas:

```text
Credito
Secretaria de Vendas
Em processo
```

A comparacao e feita com normalizacao de acentos e caixa.

Uso:

- medir a carteira de reservas operacionais no periodo;
- servir de base para `Mês Atual`.

### Mes Seguinte

Campo:

```text
mes_seguinte
```

Campo Databricks para auditoria:

```text
cvcrm_campos_adicionais_reserva_wide.reserva_campos_adicionais_reserva_repasse_no_mes
```

Fallback Databricks:

```text
vw_bi_comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes
```

Campo Postgres final:

```text
comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes
```

Formula:

```sql
count(distinct idreserva)
```

Mesma base de `Reservas Situacoes`, com filtro adicional:

```text
reserva_repasse_no_mes = Nao
```

Campo de origem:

```text
reserva_campos_adicionais_reserva_repasse_no_mes
```

Uso:

- retirar da previsao do mes atual as reservas indicadas para repasse futuro.

### Prob Cair

Campo:

```text
prob_cair
```

Campo Databricks para auditoria:

```text
cvcrm_campos_adicionais_reserva_wide.reserva_campos_adicionais_reserva_repasse_no_mes
```

Fallback Databricks:

```text
vw_bi_comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes
```

Campo Postgres final:

```text
comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes
```

Formula:

```sql
count(distinct idreserva)
```

Mesma base de `Reservas Situacoes`, com filtro adicional:

```text
reserva_repasse_no_mes = Probabilidade de cair
```

Campo de origem:

```text
reserva_campos_adicionais_reserva_repasse_no_mes
```

Uso:

- retirar da previsao do mes atual as reservas marcadas com risco de queda.

### Mes Atual

Campo:

```text
mes_atual
```

Formula:

```text
abs(Reservas Situacoes - Mes Seguinte - Prob Cair)
```

Equivalente na API:

```sql
abs(a.reservas_situacoes - a.mes_seguinte - a.prob_cair)
```

Uso:

- representar a carteira de reservas prevista para virar repasse dentro do mes
  atual.

Observacao:

- o uso de `abs` evita valor negativo caso algum subconjunto fique maior que a
  contagem principal por efeito de dados inconsistentes.

### MP Reserva

Campo:

```text
mp_reserva
```

Campos Databricks para auditoria:

```text
vw_bi_comercial_base.idrepasse
vw_bi_comercial_base.dt_referencia_repasse
vw_bi_comercial_base.dt_referencia_reserva
vw_bi_comercial_base.repasse_situacao_nome
cvcrm_campos_adicionais_repasse_wide.repasse_campos_adicionais_repasse_probabilidade_de_assinatura
cvcrm_campos_adicionais_repasse_wide.repasse_campos_adicionais_repasse_data_envio_cehop
cvcrm_campos_adicionais_repasse_wide.repasse_campos_adicionais_repasse_data_conformidade_cehop
cvcrm_campos_adicionais_repasse_wide.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop
cvcrm_campos_adicionais_repasse_wide.repasse_campos_adicionais_repasse_data_do_reenvio_cehop
```

Fallbacks Databricks para campos adicionais:

```text
vw_bi_comercial_base.repasse_campos_adicionais_repasse_probabilidade_de_assinatura
vw_bi_comercial_base.repasse_campos_adicionais_repasse_data_envio_cehop
vw_bi_comercial_base.repasse_campos_adicionais_repasse_data_conformidade_cehop
vw_bi_comercial_base.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop
vw_bi_comercial_base.repasse_campos_adicionais_repasse_data_do_reenvio_cehop
```

Campos Postgres finais:

```text
comercial_base.idrepasse
comercial_base.dt_referencia_repasse
comercial_base.dt_referencia_reserva
comercial_base.repasse_situacao_nome
comercial_base.repasse_campos_adicionais_repasse_probabilidade_de_assinatura
comercial_base.repasse_campos_adicionais_repasse_data_envio_cehop
comercial_base.repasse_campos_adicionais_repasse_data_conformidade_cehop
comercial_base.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop
comercial_base.repasse_campos_adicionais_repasse_data_do_reenvio_cehop
```

Formula:

Soma de quatro contagens de `count(distinct idrepasse)`.

Todas as contagens usam o periodo:

```sql
coalesce(dt_referencia_repasse, referencia_data_reserva) >= startDate
and coalesce(dt_referencia_repasse, referencia_data_reserva) < endDate + interval '1 day'
```

Bloco 1:

- situacao de repasse em fluxo de repasse;
- probabilidade de assinatura `Sim` ou `Talvez`;
- envio CEHOP nulo, ou inconformidade CEHOP sem reenvio.

Bloco 2:

- situacao de repasse em fluxo de repasse;
- probabilidade de assinatura `Sim` ou `Talvez`;
- enviado para CEHOP sem conformidade, inconformidade e reenvio; ou
- reenviado apos inconformidade, ainda sem conformidade.

Bloco 3:

- situacao de repasse em fluxo de repasse;
- probabilidade de assinatura `Sim` ou `Talvez`;
- conformidade CEHOP preenchida.

Bloco 4:

- situacao em MP ativa;
- assinatura de contrato ainda nula;
- probabilidade de assinatura diferente de `Nao`.

Situacoes de fluxo de repasse:

```text
Em andamento- (repasse)
Inicio Repasse
```

Situacoes de MP ativa:

```text
Assinatura Caixa
Validacao Assinatura Caixa
Em andamento- (garantia)
```

Uso:

- medir repasses em movimento, com chance de assinatura, que ainda entram na
  previsao operacional.

### Assinados

Campo:

```text
repasses_assinados
```

Campos Databricks para auditoria:

```text
vw_bi_comercial_base.idrepasse
vw_bi_comercial_base.dt_assinatura_contrato
```

Campos Postgres equivalentes:

```text
comercial_base.idrepasse
comercial_base.dt_assinatura_contrato
```

Formula:

```sql
count(distinct idrepasse)
```

Filtro:

```sql
dt_assinatura_contrato >= startDate
and dt_assinatura_contrato < endDate + interval '1 day'
```

Uso:

- medir repasses ja assinados no periodo;
- compor a previsao final de repasse.

### Prev. Repasse

Campo:

```text
prev_repasse
```

Formula:

```text
Mes Atual + MP Reserva + Assinados
```

Equivalente na API:

```sql
abs(a.reservas_situacoes - a.mes_seguinte - a.prob_cair)
+ a.mp_reserva
+ a.repasses_assinados
```

Uso:

- indicador principal da aba;
- valor comparado contra `Meta ajustada`.

### Meta Ajustada

Campo:

```text
meta_ajustada
```

Origem principal:

```text
connect_comercial.dashboard_goals
```

Filtros da meta salva:

```text
kpi_id = reservas_prev_repasse
hierarchy_level = imobiliaria
hierarchy_value = regiao|||imobiliaria
```

Regra:

```text
se existir meta salva:
  usar dashboard_goals.goal_value
senao:
  usar meta padrao por imobiliaria
se nao houver meta padrao:
  usar 0
```

Uso:

- meta mensal usada para medir atingimento da previsao de repasse.

### Alcancado_meta

Campo:

```text
alcancado_meta
```

Formula:

```text
(Prev. Repasse / Meta ajustada) * 100
```

Regra:

```text
se Meta ajustada > 0:
  calcular percentual
senao:
  retornar null
```

Uso visual:

- valores `>= 100%` recebem classe positiva;
- valores abaixo de `100%` recebem classe de atencao.

## Totais Por Regiao

A API calcula totais por regiao depois de montar as linhas por imobiliaria.

Campos somados:

- `reservas_situacoes`;
- `mes_seguinte`;
- `prob_cair`;
- `mes_atual`;
- `mp_reserva`;
- `repasses_assinados`;
- `prev_repasse`;
- `meta_ajustada`.

Depois da soma, o percentual e recalculado:

```text
alcancado_meta = (prev_repasse_total / meta_ajustada_total) * 100
```

Se `meta_ajustada_total` for zero, `alcancado_meta` fica `null`.

No frontend:

- a linha de total aparece destacada;
- a coluna Imobiliaria fica vazia;
- a meta total nao e editavel;
- o botao de salvar nao aparece no total.

## Metas Padrao

Quando nao existe meta salva em `dashboard_goals`, a API aplica a meta padrao
por imobiliaria.

| Imobiliaria normalizada | Meta |
| --- | ---: |
| equipe propria 2 \| agl | 7 |
| equipe propria 3 \| agl | 7 |
| equipe propria \| agl | 6 |
| canal virtual 1 | 7 |
| canal virtual 2 | 5 |
| imobiliarias \| agl | 5 |
| imobiliarias \| fsa | 10 |
| equipe propria \| fsa | 1 |
| canal virtual 1 \| fsa | 1 |
| canal virtual 2 \| fsa | 1 |
| equipe propria 2 \| fsa | 8 |
| autonomos \| fsa | 10 |
| autonomos 2 \| fsa | 10 |
| equipe propria \| cat | 15 |
| canal virtual 4 | 25 |
| imobiliarias \| cat | 10 |

Observacao:

- a comparacao usa `lower(trim(imobiliaria))`;
- nomes fora da lista recebem meta padrao `0` ate que sejam salvos em
  `dashboard_goals`.

## Comportamento Da Tela

Ao abrir a aba **Metas**, o frontend executa:

```http
GET /api/v1/dashboard/reservas/metas
```

Ao editar uma meta e clicar em salvar:

```http
PUT /api/v1/dashboard/reservas/metas
```

Depois do salvamento, a tela recarrega os dados da aba para refletir:

- nova meta ajustada;
- novo percentual `Alcancado_meta`;
- novo total por regiao.

## Observacoes De Qualidade De Dados

- `Mês Atual` usa `abs`, entao inconsistencias entre contagens podem ser
  mascaradas como valor positivo.
- `MP Reserva` depende de campos CEHOP e probabilidade de assinatura; campos
  incompletos podem alterar a classificacao.
- imobiliarias sem meta salva e sem meta padrao ficam com `Meta ajustada = 0` e
  `Alcancado_meta = null`.
- a chave da meta depende do texto de regiao e imobiliaria; alteracoes no nome
  canonico podem criar uma nova chave e deixar metas antigas sem uso.

## Resumo Das Formulas

```text
Reservas Situacoes =
  count distinct idreserva em Credito, Secretaria de Vendas ou Em processo

Mes Seguinte =
  Reservas Situacoes com Repasse no mes = Nao

Prob Cair =
  Reservas Situacoes com Repasse no mes = Probabilidade de cair

Mes Atual =
  abs(Reservas Situacoes - Mes Seguinte - Prob Cair)

MP Reserva =
  count distinct idrepasse em fluxos de repasse/garantia elegiveis

Assinados =
  count distinct idrepasse com dt_assinatura_contrato no periodo

Prev. Repasse =
  Mes Atual + MP Reserva + Assinados

Meta ajustada =
  meta salva em dashboard_goals ou meta padrao da imobiliaria

Alcancado_meta =
  Prev. Repasse / Meta ajustada * 100
```

## Consultas De Validacao

As consultas abaixo sao referencias para validar a aba contra a camada final do
portal e contra a origem Databricks. Ajuste as datas conforme o periodo da tela.

### Validacao No Postgres Final

```sql
with base as (
  select
    coalesce(nullif(regiao_empreendimento, ''), 'Sem regiao') as regiao,
    coalesce(nullif(imobiliaria_nome_canonica, ''), nullif(imobiliaria_nome, ''), 'Sem imobiliaria') as imobiliaria,
    idreserva,
    idrepasse,
    coalesce(dt_referencia_reserva, dt_cadastro_reserva) as referencia_data_reserva,
    coalesce(dt_referencia_repasse, coalesce(dt_referencia_reserva, dt_cadastro_reserva)) as referencia_data_repasse,
    reserva_situacao_nome,
    reserva_campos_adicionais_reserva_repasse_no_mes as repasse_no_mes,
    repasse_situacao_nome,
    repasse_campos_adicionais_repasse_probabilidade_de_assinatura as prob_assinatura,
    repasse_campos_adicionais_repasse_data_envio_cehop as envio_cehop,
    repasse_campos_adicionais_repasse_data_conformidade_cehop as conformidade_cehop,
    repasse_campos_adicionais_repasse_data_da_inconformidade_cehop as inconformidade_cehop,
    repasse_campos_adicionais_repasse_data_do_reenvio_cehop as reenvio_cehop,
    dt_assinatura_contrato
  from connect_comercial.comercial_base
  where idreserva is not null
),
agregado as (
  select
    regiao,
    imobiliaria,
    count(distinct idreserva) filter (
      where referencia_data_reserva >= date '2026-06-01'
        and referencia_data_reserva < date '2026-07-01'
        and translate(lower(coalesce(reserva_situacao_nome, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
            in ('credito', 'secretaria de vendas', 'em processo')
    ) as reservas_situacoes,
    count(distinct idreserva) filter (
      where referencia_data_reserva >= date '2026-06-01'
        and referencia_data_reserva < date '2026-07-01'
        and translate(lower(coalesce(reserva_situacao_nome, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
            in ('credito', 'secretaria de vendas', 'em processo')
        and translate(lower(coalesce(repasse_no_mes, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'nao'
    ) as mes_seguinte,
    count(distinct idreserva) filter (
      where referencia_data_reserva >= date '2026-06-01'
        and referencia_data_reserva < date '2026-07-01'
        and translate(lower(coalesce(reserva_situacao_nome, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
            in ('credito', 'secretaria de vendas', 'em processo')
        and translate(lower(coalesce(repasse_no_mes, '')), 'ãáàâäéèêëíìîïóòôöõúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'probabilidade de cair'
    ) as prob_cair,
    count(distinct idrepasse) filter (
      where dt_assinatura_contrato >= date '2026-06-01'
        and dt_assinatura_contrato < date '2026-07-01'
    ) as repasses_assinados
  from base
  group by 1, 2
)
select
  *,
  abs(reservas_situacoes - mes_seguinte - prob_cair) as mes_atual,
  abs(reservas_situacoes - mes_seguinte - prob_cair) + repasses_assinados as prev_repasse_sem_mp
from agregado
order by regiao, imobiliaria;
```

Observacao:

- a consulta acima valida a parte de reserva e assinados;
- `MP Reserva` deve ser validado com os campos CEHOP listados na matriz, pois a
  formula completa soma quatro blocos de condicoes.

### Validacao Da Carga Databricks Para Postgres

```sql
select
  id,
  status,
  source_schema,
  target_schema,
  table_counts,
  finished_at,
  message
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 5;
```

Validar preenchimento dos campos auditaveis:

```sql
select
  count(*) as linhas_reserva,
  count(*) filter (where dt_referencia_reserva is not null) as com_dt_referencia_reserva,
  count(*) filter (where reserva_campos_adicionais_reserva_repasse_no_mes is not null) as com_repasse_no_mes,
  count(*) filter (where repasse_campos_adicionais_repasse_probabilidade_de_assinatura is not null) as com_prob_assinatura,
  count(*) filter (where repasse_campos_adicionais_repasse_data_envio_cehop is not null) as com_envio_cehop,
  count(*) filter (where repasse_campos_adicionais_repasse_data_conformidade_cehop is not null) as com_conformidade_cehop,
  count(*) filter (where repasse_campos_adicionais_repasse_data_da_inconformidade_cehop is not null) as com_inconformidade_cehop,
  count(*) filter (where repasse_campos_adicionais_repasse_data_do_reenvio_cehop is not null) as com_reenvio_cehop
from connect_comercial.comercial_base
where idreserva is not null;
```

### Validacao Direta No Databricks

Use a mesma janela de datas e compare com o Postgres. A consulta abaixo mostra
os campos de origem antes da promocao para `connect_comercial`.

```sql
select
  coalesce(nullif(b.regiao_empreendimento, ''), 'Sem regiao') as regiao,
  coalesce(nullif(b.imobiliaria_nome_canonica, ''), nullif(b.imobiliaria_nome, ''), 'Sem imobiliaria') as imobiliaria,
  count(distinct b.idreserva) as reservas_com_id,
  count(distinct b.idrepasse) as repasses_com_id,
  count(*) filter (where coalesce(car.reserva_campos_adicionais_reserva_repasse_no_mes, b.reserva_campos_adicionais_reserva_repasse_no_mes) is not null) as com_repasse_no_mes,
  count(*) filter (where coalesce(cap.repasse_campos_adicionais_repasse_probabilidade_de_assinatura, b.repasse_campos_adicionais_repasse_probabilidade_de_assinatura) is not null) as com_prob_assinatura
from data_platform_dev.gold_cvcrm.vw_bi_comercial_base b
left join data_platform_dev.gold_cvcrm.cvcrm_campos_adicionais_reserva_wide car
  on car.idreserva = b.idreserva
left join data_platform_dev.gold_cvcrm.cvcrm_campos_adicionais_repasse_wide cap
  on cap.idrepasse = b.idrepasse
where b.idreserva is not null
  and (
    coalesce(b.dt_referencia_reserva, b.dt_cadastro_reserva) >= date '2026-06-01'
    and coalesce(b.dt_referencia_reserva, b.dt_cadastro_reserva) < date '2026-07-01'
  )
group by 1, 2
order by 1, 2;
```

Checklist de auditoria:

- confirmar ultimo `dashboard_comercial_sync_log` com `status = success`;
- confirmar que `table_counts.comercial_base` nao esta zerado;
- comparar contagem distinta de `idreserva` por `regiao` e `imobiliaria`;
- comparar preenchimento de `reserva_campos_adicionais_reserva_repasse_no_mes`;
- comparar preenchimento dos campos CEHOP de repasse;
- registrar divergencias causadas pela ausencia de `.Flag_Sec_Vendas_Credito`;
- validar se nomes canonicos de imobiliaria/regiao mudaram, pois isso altera a
  chave `regiao|||imobiliaria` usada nas metas.
