# Dashboard Comercial - Operacao Atual

Este documento descreve a operacao atual do Dashboard Comercial dentro do
7LM Connect em `/opt/7lm-connect/portal`.

O fluxo antigo baseado em `/root/data-engineering/apps/commercial-dashboard`
foi retirado da execucao desta maquina. Mantenha referencias a `/root` apenas
como historico; nao use esse caminho para novos deploys, jobs ou scripts.

## Servicos ativos

- `7lm-connect-api.service`
  - API FastAPI do portal.
  - Working directory:
    `/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect`
  - Env:
    `/opt/7lm-connect/portal/.env`

- `7lm-connect-portal.service`
  - Servidor Node do portal.
  - Working directory:
    `/opt/7lm-connect/portal`
  - Entrypoint:
    `/opt/7lm-connect/portal/01_codigo_fonte/servidor_do_portal.js`

- `7lm-dashboard-comercial-pipeline.timer`
  - Agenda o pipeline direto Databricks -> `connect_comercial`.
  - Ativa `7lm-dashboard-comercial-pipeline.service`.

## Servicos antigos bloqueados ou inativos

- `7lm-dashboard-comercial-sync.service`: masked.
- `7lm-dashboard-comercial-sync.timer`: masked.
- `commercial-dashboard.service`: disabled.
- `commercial-dashboard-preview.service`: disabled.
- `commercial-dashboard-scheduler.service`: disabled.

O script Python legado
`01_codigo_fonte/api_7lm_connect/scripts/sincronizar_dashboard_comercial.py`
tambem fica bloqueado por padrao. Ele copiava de um Postgres intermediario
`public` para `connect_comercial`. O caminho operacional suportado agora e
somente Databricks -> `connect_comercial` via Node.

Registro completo dos ajustes, regras de negocio e validacoes de 2026-06-19:

```text
/opt/7lm-connect/portal/00_documentacao/modulos/dashboard_comercial/historico/dashboard_comercial_operacao_regras_20260619.md
```

Em 2026-06-19 tambem foram desativados no servidor remoto `7lmdev01`
(`104.131.48.54`) os agendamentos legados que ainda escreviam no Postgres
final com `source_schema = public`:

- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`
- `commercial-dashboard-scheduler.service`

As units foram arquivadas em `/etc/systemd/system` com sufixo
`.disabled-direct-databricks-*`, e os crons de
`/root/data-engineering/apps/commercial-dashboard/deploy/deploy-prod-complete.sh`
foram comentados no crontab root remoto. Backup do crontab remoto:
`/root/crontab.before-disable-commercial-intermediate.20260619_150331`.

## Pipeline oficial

Diretorio:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
```

Execucao real:

```bash
npm run data:update:connect
```

Dry-run:

```bash
npm run data:update:connect:dry-run
```

Script:

```text
backend/scripts/sync-databricks-to-connect-comercial.js
```

O script carrega `.env` nesta ordem:

1. `/opt/7lm-connect/portal/.env`
2. `/etc/commercial-dashboard/env`
3. `backend/.env`, se existir

A conexao Postgres do pipeline oficial usa `application_name`:

```text
7lm_dashboard_comercial_databricks_direct
```

Use esse nome para identificar a carga oficial em `pg_stat_activity`.

## Systemd do pipeline

Arquivos:

```text
/etc/systemd/system/7lm-dashboard-comercial-pipeline.service
/etc/systemd/system/7lm-dashboard-comercial-pipeline.timer
```

Service:

```text
WorkingDirectory=/opt/7lm-connect/portal/05_modulos/dashboard_comercial
EnvironmentFile=/opt/7lm-connect/portal/.env
EnvironmentFile=/etc/commercial-dashboard/env
Environment=NODE_OPTIONS=--max-old-space-size=4096
ExecStart=/usr/bin/npm run data:update:connect
```

Timer:

```text
OnActiveSec=1h
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true
```

Comandos:

```bash
systemctl status 7lm-dashboard-comercial-pipeline.timer
systemctl status 7lm-dashboard-comercial-pipeline.service
systemctl list-timers --all --no-pager | rg '7lm-dashboard-comercial'
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 120 --no-pager
```

## Banco e schemas

O `/opt` usa o banco configurado em `/opt/7lm-connect/portal/.env` pelas variaveis
`SEVENLM_CONNECT_*`.

Schemas usados pelo Dashboard Comercial:

- `connect_comercial`: fatos, staging, KPI diario e log de sync.
- `sevenlm_connect`: autenticacao, permissoes e `funcionario_acesso`.

Tabelas finais carregadas:

- `connect_comercial.comercial_base`
- `connect_comercial.comercial_propostas_historico`
- `connect_comercial.comercial_propostas_consolidada`
- `connect_comercial.comercial_cancelamentos`
- `connect_comercial.comercial_distratos`
- `connect_comercial.dim_corretor`
- `connect_comercial.dim_empreendimento`
- `connect_comercial.comercial_kpi_daily`

Log operacional:

```sql
select id, status, started_at, finished_at, duration_seconds, message
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 10;
```

## Validacao rapida

Validar servicos:

```bash
systemctl is-active 7lm-connect-api.service
systemctl is-active 7lm-connect-portal.service
systemctl is-active 7lm-dashboard-comercial-pipeline.timer
```

Validar ultima carga:

```sql
select id, status, finished_at, message, table_counts->'comercial_kpi_daily' as kpi
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 1;
```

Validar filtros e graficos:

```sql
select
  count(*) as linhas,
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

Validar fechamento das abas de corretor e detalhamento:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run audit:corretor-values -- --start=2026-06-01 --end=2026-06-30
```

## Rotas da API

Arquivo:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Rotas principais:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/trends`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/breakdown`
- `GET /api/v1/dashboard/filters`
- `GET /api/v1/dashboard/filters/search`
- `GET /api/v1/leads`
- `POST /api/v1/dashboard/refresh-data`
- `GET /api/v1/dashboard/ipc-insights`

As rotas exigem usuario autenticado e permissao de portal.

## Deploy de mudancas

Para mudancas de frontend:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
systemctl restart 7lm-connect-portal.service
```

Para mudancas de API Python:

```bash
python -m py_compile /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
systemctl restart 7lm-connect-api.service
```

Para mudancas no pipeline:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
node --check backend/scripts/sync-databricks-to-connect-comercial.js
npm run data:update:connect:dry-run
systemctl start 7lm-dashboard-comercial-pipeline.service
```

## Regras para manutencao

- Nao criar novos runtimes em `/root/data-engineering`.
- Nao reabilitar `commercial-dashboard*.service`.
- Nao reabilitar `7lm-dashboard-comercial-sync.*`.
- Toda nova rota do Dashboard Comercial deve nascer em
  `rotas_de_dashboard_comercial.py` ou em servico chamado por essa rota.
- Toda nova regra de dados deve declarar a tabela fonte, a tabela destino e a
  validacao de contagem/consistencia.
- Se um novo bloco visual precisar de dados agregados, preferir adicionar coluna
  ou view derivada em `connect_comercial` em vez de computar tudo no frontend.
