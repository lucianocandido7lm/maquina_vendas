# Dashboard Comercial

Este modulo e a fonte do Dashboard Comercial dentro do portal 7LM Connect.

O runtime oficial atual fica em `/opt/7lm-connect/portal`. O antigo caminho
`/root/data-engineering/apps/commercial-dashboard` nao faz mais parte da
execucao operacional desta maquina.

## Estrutura do modulo

- `src/`: frontend React/Vite do dashboard.
- `src/components/`: componentes visuais reutilizaveis.
- `src/contexts/`: estado compartilhado do dashboard, filtros e contexto.
- `src/hooks/`: integracao com API, filtros e configuracoes de metas.
- `src/pages/`: paginas de alto nivel.
- `backend/scripts/`: rotinas de dados e validacoes do modulo.
- `backend/scripts/sync-databricks-to-connect-comercial.js`: pipeline oficial atual
  para carregar Databricks direto em `connect_comercial`.
- `tests/`: testes do modulo.
- `deploy/`: documentos e utilitarios historicos de operacao do modulo.

## Build e publicacao frontend

O Vite publica o build diretamente para o portal publico:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run build
```

O `vite.config.js` usa:

- `base`: `/02_recursos/05_modulos/dashboard_comercial/`
- `outDir`: `../../02_publico/02_recursos/05_modulos/dashboard_comercial`

A pagina publica que carrega o bundle fica em:

```text
/opt/7lm-connect/portal/02_publico/01_paginas/Comercial/dashboard.html
```

## API usada pelo frontend

As rotas oficiais do dashboard ficam na API FastAPI:

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

Todas exigem autenticacao do 7LM Connect e permissao
`dashboard.comercial.view`, exceto operacoes de meta/refresh gerencial que podem
exigir `dashboard.comercial.manage`.

## Pipeline oficial de dados

O pipeline oficial atual e:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
npm run data:update:connect
```

Dry-run:

```bash
npm run data:update:connect:dry-run
```

Ele carrega os dados do Databricks diretamente no banco usado pelo `/opt`:

- banco: `db_7lm_connect`
- schema comercial: `connect_comercial`
- schema de acesso/hierarquia: `sevenlm_connect`

Tabelas principais mantidas:

- `connect_comercial.comercial_base`
- `connect_comercial.comercial_propostas_historico`
- `connect_comercial.comercial_propostas_consolidada`
- `connect_comercial.comercial_cancelamentos`
- `connect_comercial.comercial_distratos`
- `connect_comercial.dim_empreendimento`
- `connect_comercial.comercial_kpi_daily`
- `connect_comercial.dashboard_comercial_sync_log`

As tabelas `_staging` correspondentes sao usadas para carga transacional antes
da promocao dos dados.

## Regras de negocio aplicadas no pipeline atual

- A fonte de fatos comerciais e o Databricks.
- A hierarquia de corretor deve vir de `sevenlm_connect.funcionario_acesso`,
  mas as abas de analise por corretor devem resolver primeiro a identidade
  operacional via `connect_comercial.dim_corretor`.
- Nao copiar mais `funcionario_acesso_connect` para este fluxo.
- O vinculo preferencial das abas de corretor e:
  `fato -> dim_corretor -> funcionario_acesso`, usando e-mail normalizado como
  ponte principal para funcionario. O match por nome normalizado e apenas
  fallback quando nao houver id/e-mail/documento canonico.
- Registros ativos em `funcionario_acesso` sao priorizados, mas historicos podem
  ser usados como fallback quando necessario.
- O resultado consolidado para filtros e graficos e
  `connect_comercial.comercial_kpi_daily`.

## Systemd

O job oficial fica em:

```text
/etc/systemd/system/7lm-dashboard-comercial-pipeline.service
/etc/systemd/system/7lm-dashboard-comercial-pipeline.timer
```

Comandos uteis:

```bash
systemctl status 7lm-dashboard-comercial-pipeline.timer
systemctl status 7lm-dashboard-comercial-pipeline.service
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 120 --no-pager
```

O servico antigo de sincronizacao local foi desativado nesta maquina:

```text
7lm-dashboard-comercial-sync.service: masked
7lm-dashboard-comercial-sync.timer: masked
```

## Documentacao relacionada

- `/opt/7lm-connect/portal/AGENTS.md`
- `/opt/7lm-connect/portal/00_documentacao/README.md`
- `/opt/7lm-connect/portal/00_documentacao/modulos/dashboard_comercial/operacao.md`
- `/opt/7lm-connect/portal/00_documentacao/operacao/migracao-dev-para-producao-dashboard-comercial.md`
