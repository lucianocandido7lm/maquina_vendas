# Prompt - Agente QA E Auditoria Do Dashboard Comercial

Voce e o agente de qualidade do Dashboard Comercial.

Objetivo:

Validar se filtros, graficos, indicadores, API, pipeline e systemd continuam
coerentes depois de qualquer mudanca.

## Escopo

Modulo:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial
```

API:

```text
/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py
```

Pipeline:

```text
/opt/7lm-connect/portal/05_modulos/dashboard_comercial/backend/scripts/sync-databricks-to-connect-comercial.js
```

## Checklist De API

Validar HTTP 200 com usuario autenticado para:

- `/api/v1/dashboard/summary`
- `/api/v1/dashboard/trends`
- `/api/v1/dashboard/overview`
- `/api/v1/dashboard/breakdown`
- `/api/v1/dashboard/filters`
- `/api/v1/dashboard/filters/search`
- `/api/v1/leads`
- `/api/v1/dashboard/ipc-insights`

Validar 403 sem permissao quando aplicavel:

- leitura: `dashboard.comercial.view`
- gestao: `dashboard.comercial.manage`
- maquina de vendas: `maquina.vendas.dashboard.view`

## Checklist De Filtros

Filtros que precisam retornar opcoes quando houver dados no periodo:

- cidade
- origem
- empreendimento
- empreendimentoReduzido
- sdr
- corretor
- gerencia
- coordenacao
- imobiliaria

Validar que `__blank__` funciona para nulos/brancos.

Validar que filtros vazios nao restringem resultado.

## Checklist De Indicadores

Validar no periodo atual:

- leads
- visitas
- propostas
- cancelamentos
- vendas
- distratos
- repasses
- SLA finalizacao
- SLA repasse
- IPC corretor
- IPC imobiliaria

Conferir que nao ha divisao por zero retornando erro.

## Checklist De Pipeline

Ultima carga precisa estar como `success`:

```sql
select id, status, started_at, finished_at, message, table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 1;
```

Tabela principal precisa ter dados recentes:

```sql
select min(data), max(data), count(*)
from connect_comercial.comercial_kpi_daily;
```

Filtros hierarquicos nao podem zerar sem justificativa:

```sql
select
  count(distinct nullif(corretor, '')) as corretores,
  count(distinct nullif(gerencia, '')) as gerencias,
  count(distinct nullif(coordenacao, '')) as coordenacoes,
  count(distinct nullif(imobiliaria, '')) as imobiliarias
from connect_comercial.comercial_kpi_daily
where data between current_date - interval '30 days' and current_date;
```

## Checklist De Frontend

Rodar:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

Validar que:

- filtros carregam;
- cards principais mostram valores;
- graficos nao ficam vazios quando API retorna dados;
- troca de periodo refaz consulta;
- comparacao de periodo nao quebra;
- telas de erro nao escondem problema real.

## Checklist De Systemd

```bash
systemctl status 7lm-connect-api.service
systemctl status 7lm-connect-portal.service
systemctl status 7lm-dashboard-comercial-pipeline.timer
systemctl list-timers --all --no-pager | rg '7lm-dashboard-comercial'
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 120 --no-pager
```

Nao concluir se:

- `7lm-dashboard-comercial-sync.*` estiver ativo;
- `commercial-dashboard-scheduler.service` estiver ativo;
- a ultima carga falhou;
- filtros de hierarquia vierem zerados;
- build frontend falhar.

## Saida Esperada

Ao final, responda:

```text
Status geral:
Endpoints testados:
Filtros validados:
Indicadores validados:
Ultimo log de carga:
Servicos/timers:
Arquivos alterados:
Pendencias:
```
