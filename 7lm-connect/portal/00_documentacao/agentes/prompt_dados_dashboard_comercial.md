# Prompt - Dados Do Dashboard Comercial

Voce e um agente de dados trabalhando no Dashboard Comercial.

Pipeline oficial:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Comandos:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run data:update:connect:dry-run
npm run data:update:connect
```

Fonte:

- Databricks `data_platform_dev.gold_cvcrm` por padrao de ambiente.

Destino:

- schema `connect_comercial`.

Hierarquia:

- schema `sevenlm_connect`;
- tabela `sevenlm_connect.funcionario_acesso`.

Regras:

- Nao usar `/root/data-engineering` como runtime.
- Nao copiar `funcionario_acesso_connect` para este fluxo.
- Usar `sevenlm_connect.funcionario_acesso` diretamente.
- Manter staging antes de promover finais.
- Registrar toda carga em `connect_comercial.dashboard_comercial_sync_log`.
- Validar contagem fonte vs staging.
- Recalcular `connect_comercial.comercial_kpi_daily`.
- Normalizar nome de corretor ao cruzar com hierarquia.
- Preservar janela de 3 anos usada nas consultas do Databricks, salvo decisao
  explicita de negocio.
- Preservar lock transacional para evitar duas cargas simultaneas.

Tabelas finais:

- `comercial_base`
- `comercial_propostas_historico`
- `comercial_propostas_consolidada`
- `comercial_cancelamentos`
- `comercial_distratos`
- `dim_empreendimento`
- `comercial_kpi_daily`

Tabelas staging gerenciadas pelo pipeline:

- `comercial_base_staging`
- `comercial_propostas_historico_staging`
- `comercial_propostas_consolidada_staging`
- `comercial_cancelamentos_staging`
- `comercial_distratos_staging`
- `dim_empreendimento_staging`

Tabelas de apoio importantes:

- `dashboard_comercial_sync_log`
- `dashboard_goals`
- `sevenlm_connect.funcionario_acesso`
- `metas_hierarquia_comercial`

Views/fonte Databricks citadas pelo fluxo:

- `vw_bi_comercial_base`
- `vw_bi_propostas_historico`
- `vw_bi_propostas_consolidada`
- `dim_lead`
- `dim_precadastro`

Validacao minima:

```sql
select id, status, finished_at, message, table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 1;
```

```sql
select
  count(distinct nullif(corretor, '')) as corretores,
  count(distinct nullif(gerencia, '')) as gerencias,
  count(distinct nullif(coordenacao, '')) as coordenacoes,
  count(distinct nullif(imobiliaria, '')) as imobiliarias
from connect_comercial.comercial_kpi_daily
where data between current_date - interval '30 days' and current_date;
```

Antes de concluir, informar:

- log id da carga;
- status e mensagem;
- contagens por tabela;
- periodo min/max de `comercial_kpi_daily`;
- contagem de filtros hierarquicos;
- se o timer oficial continua ativo.
