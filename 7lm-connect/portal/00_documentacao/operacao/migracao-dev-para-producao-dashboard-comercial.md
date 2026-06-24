# Migracao Dev Para Producao - Dashboard Comercial

Este documento registra o que foi feito na maquina de desenvolvimento em
2026-06-10 e o que um agente de migracao deve entender antes de levar o fluxo
para producao.

## Objetivo

Centralizar o Dashboard Comercial no runtime do `/opt/7lm-connect/portal`,
usando o banco configurado pelo proprio 7LM Connect, sem depender do antigo
runtime em `/root/data-engineering/apps/commercial-dashboard`.

## Observacao De Perimetro Em Producao

Auditoria informada para producao:

- existe mediador publico via Apache em `80/443`;
- o dominio `maquinadevendas7lm.app.br` segue o fluxo
  `Internet -> Apache -> 127.0.0.1:3000 Portal Node`;
- o Portal Node faz proxy interno de `/api` para
  `http://127.0.0.1:8000` FastAPI;
- porem `3000/tcp` e `8000/tcp` tambem estao acessiveis externamente.

Conclusao documental:

```text
O fluxo canonico existe, mas o perimetro esta parcialmente fechado porque ha
bypass direto da internet para Portal Node e FastAPI.
```

Nenhuma alteracao operacional foi aplicada nesta etapa. Antes de endurecer
producao, revisar `00_documentacao/seguranca/perimetro-api-banco.md`.

## Estado Antes

Existiam rotinas antigas que podiam depender do projeto em `/root` ou de uma
sincronizacao intermediaria:

- `commercial-dashboard.service`
- `commercial-dashboard-preview.service`
- `commercial-dashboard-scheduler.service`
- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`

O sync antigo chamava:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/scripts/sincronizar_dashboard_comercial.py
```

Esse fluxo copiava dados de uma fonte intermediaria para `connect_comercial` e
mantinha tabelas como `hierarquia_cvcrm`.

## Estado Depois

O runtime operacional ficou no `/opt`:

```text
/opt/7lm-connect/portal
```

Servicos principais:

- `7lm-connect-api.service`
- `7lm-connect-portal.service`
- `7lm-dashboard-comercial-pipeline.timer`
- `7lm-dashboard-comercial-pipeline.service`

Pipeline oficial:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Comando:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run data:update:connect
```

## Arquivos Criados Ou Alterados

### Pipeline Node

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

Responsabilidades:

- carregar `.env` do `/opt`;
- conectar ao Databricks;
- conectar ao Postgres usado pelo 7LM Connect;
- carregar tabelas finais e `_staging`;
- promover dados em transacao;
- recalcular `connect_comercial.comercial_kpi_daily`;
- registrar execucao em `connect_comercial.dashboard_comercial_sync_log`.

### Package scripts

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/package.json
```

Scripts adicionados:

```json
"data:update:connect": "node backend/scripts/sync-databricks-to-connect-comercial.js",
"data:update:connect:dry-run": "node backend/scripts/sync-databricks-to-connect-comercial.js --dry-run"
```

### Systemd

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

### Units antigas

Nesta maquina de desenvolvimento:

- `7lm-dashboard-comercial-sync.service` foi arquivado como
  `/etc/systemd/system/7lm-dashboard-comercial-sync.service.disabled-by-codex`
  e mascarado.
- `7lm-dashboard-comercial-sync.timer` foi arquivado como
  `/etc/systemd/system/7lm-dashboard-comercial-sync.timer.disabled-by-codex`
  e mascarado.

Nao reativar esse fluxo em producao se a decisao for seguir o Plano B.

## Banco E Schemas

O `/opt` usa:

- banco definido por `SEVENLM_CONNECT_DBNAME`;
- host definido por `SEVENLM_CONNECT_DBHOST`;
- schema principal `sevenlm_connect`;
- schema comercial `connect_comercial`.

Tabelas finais carregadas pelo novo pipeline:

- `connect_comercial.comercial_base`
- `connect_comercial.comercial_propostas_historico`
- `connect_comercial.comercial_propostas_consolidada`
- `connect_comercial.comercial_cancelamentos`
- `connect_comercial.comercial_distratos`
- `connect_comercial.dim_empreendimento`
- `connect_comercial.comercial_kpi_daily`

Tabelas staging:

- `connect_comercial.comercial_base_staging`
- `connect_comercial.comercial_propostas_historico_staging`
- `connect_comercial.comercial_propostas_consolidada_staging`
- `connect_comercial.comercial_cancelamentos_staging`
- `connect_comercial.comercial_distratos_staging`
- `connect_comercial.dim_empreendimento_staging`

Log:

- `connect_comercial.dashboard_comercial_sync_log`

## Regras De Negocio Aplicadas

- Fonte de fatos: Databricks.
- Destino: `connect_comercial`.
- Hierarquia de comercial/corretor: `sevenlm_connect.funcionario_acesso`.
- Nao usar mais `funcionario_acesso_connect` no Plano B.
- Nao copiar a hierarquia para tabela intermediaria do Dashboard Comercial.
- O match de corretor remove sufixos operacionais como:
  - `- CLT`
  - `- PJ`
  - `- DESLIGADO`
  - `- DEMITIDO`
  - `- INATIVO`
- Registros ativos em `funcionario_acesso` sao priorizados.
- Historicos podem ser usados como fallback se forem o melhor match por nome.
- O frontend e a API consomem principalmente `comercial_kpi_daily` para filtros,
  graficos e KPIs.

## Validacao Feita No Dev

Ultima carga direta validada:

- status: `success`
- mensagem: `Carga direta Databricks -> connect_comercial concluida.`
- `comercial_kpi_daily`: `106152` linhas

Endpoints validados com token temporario de teste:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/trends`
- `GET /api/v1/dashboard/overview`
- `GET /api/v1/dashboard/breakdown`
- `GET /api/v1/dashboard/filters`
- `GET /api/v1/dashboard/filters/search`
- `GET /api/v1/leads`
- `POST /api/v1/dashboard/refresh-data`
- `GET /api/v1/dashboard/ipc-insights`

Filtros de junho validados:

- `cidade`: 3
- `origem`: 29
- `empreendimento`: 24
- `empreendimentoReduzido`: 6
- `sdr`: 29
- `corretor`: 120
- `gerencia`: 14
- `coordenacao`: 6
- `imobiliaria`: 14

## Checklist Para Producao

1. Confirmar que o `/opt/7lm-connect/portal/.env` de producao aponta para o
   banco correto.
2. Sincronizar o modulo:
   `/opt/7lm-connect/portal/05_modulos/dashboard_comercial`.
3. Garantir dependencias Node:
   `npm ci --omit=dev`.
4. Instalar/atualizar systemd:
   `7lm-dashboard-comercial-pipeline.service` e `.timer`.
5. Desativar e mascarar o fluxo antigo:
   `7lm-dashboard-comercial-sync.service` e `.timer`.
6. Verificar se nao existe outra maquina agendando o sync antigo contra o mesmo
   banco remoto.
7. Rodar:
   `npm run data:update:connect:dry-run`.
8. Rodar:
   `systemctl start 7lm-dashboard-comercial-pipeline.service`.
9. Validar `dashboard_comercial_sync_log`.
10. Validar endpoints e filtros.

## Riscos E Cuidados

- Se outra maquina ainda rodar o sync antigo contra o mesmo banco, ela pode
  sobrescrever `connect_comercial.comercial_kpi_daily`.
- A carga usa bastante memoria; manter `NODE_OPTIONS=--max-old-space-size=4096`.
- Nao reabilitar `commercial-dashboard-scheduler.service`.
- Nao usar `/root/data-engineering` como runtime.
- Validar contagens antes e depois da primeira carga em producao.

## Consultas Uteis

Ultimas cargas:

```sql
select id, status, started_at, finished_at, duration_seconds, message, table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 10;
```

Filtros principais:

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
where data between date '2026-06-01' and date '2026-06-30';
```
