# Banco De Dados - Dashboard Comercial

## Schemas

### `connect_comercial`

Schema comercial consumido pela API e pelo frontend do Dashboard Comercial.

### `sevenlm_connect`

Schema institucional do 7LM Connect. Contem usuarios, sessoes, permissoes e
`funcionario_acesso`.

## Tabelas Finais Do Dashboard

- `comercial_base`
- `comercial_propostas_historico`
- `comercial_propostas_consolidada`
- `comercial_cancelamentos`
- `comercial_distratos`
- `dim_empreendimento`
- `comercial_kpi_daily`
- `dashboard_comercial_sync_log`

## Tabelas Staging

- `comercial_base_staging`
- `comercial_propostas_historico_staging`
- `comercial_propostas_consolidada_staging`
- `comercial_cancelamentos_staging`
- `comercial_distratos_staging`
- `dim_empreendimento_staging`

O pipeline carrega staging e promove para finais em transacao.

## Fonte Dos Dados

Fatos comerciais:

- Databricks, catalog/schema definidos por `DATABRICKS_CATALOG` e
  `DATABRICKS_SCHEMA`.

Hierarquia:

- `sevenlm_connect.funcionario_acesso`.

## Tabela De Consumo Principal

`connect_comercial.comercial_kpi_daily` alimenta:

- KPIs;
- graficos;
- filtros;
- breakdowns;
- IPC;
- comparacoes de periodo.

Colunas dimensionais principais:

- `data`
- `cidade`
- `origem`
- `empreendimento`
- `empreendimento_reduzido`
- `sdr`
- `corretor`
- `gerencia`
- `coordenacao`
- `imobiliaria`

Metricas principais:

- `leads`
- `visitas`
- `vendas`
- `repasses`
- `propostas_aprovadas`
- `propostas_condicionadas`
- `propostas_reprovadas`
- `propostas_total`
- `cancelamentos`
- `distratos`
- `sla_finalizacao_sum`
- `sla_finalizacao_count`
- `sla_repasse_sum`
- `sla_repasse_count`

## Regras De Hierarquia

O pipeline atual faz join lateral em `sevenlm_connect.funcionario_acesso`.

Normalizacao aplicada ao nome do corretor:

- trim;
- lower;
- remocao de sufixos operacionais:
  - `- CLT`
  - `- PJ`
  - `- DESLIGADO`
  - `- DEMITIDO`
  - `- INATIVO`

Ordenacao de preferencia:

1. `ativo_negocio` ou `ativo` verdadeiro;
2. `ativo` verdadeiro;
3. maior `data_inicio_vigencia`;
4. `identificador_funcionario`.

## Validacao Recomendada

Ultima carga:

```sql
select id, status, finished_at, message, table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 1;
```

Contagem de tabelas:

```sql
select 'comercial_base' as tabela, count(*) from connect_comercial.comercial_base
union all select 'comercial_propostas_historico', count(*) from connect_comercial.comercial_propostas_historico
union all select 'comercial_propostas_consolidada', count(*) from connect_comercial.comercial_propostas_consolidada
union all select 'comercial_cancelamentos', count(*) from connect_comercial.comercial_cancelamentos
union all select 'comercial_distratos', count(*) from connect_comercial.comercial_distratos
union all select 'dim_empreendimento', count(*) from connect_comercial.dim_empreendimento
union all select 'comercial_kpi_daily', count(*) from connect_comercial.comercial_kpi_daily;
```

Filtros:

```sql
select
  count(distinct nullif(cidade, '')) as cidades,
  count(distinct nullif(origem, '')) as origens,
  count(distinct nullif(empreendimento, '')) as empreendimentos,
  count(distinct nullif(corretor, '')) as corretores,
  count(distinct nullif(gerencia, '')) as gerencias,
  count(distinct nullif(coordenacao, '')) as coordenacoes,
  count(distinct nullif(imobiliaria, '')) as imobiliarias
from connect_comercial.comercial_kpi_daily
where data between current_date - interval '30 days' and current_date;
```
