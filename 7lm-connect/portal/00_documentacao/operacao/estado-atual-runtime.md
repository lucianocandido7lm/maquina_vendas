# Estado Atual Do Runtime

Data da auditoria: 2026-06-10.

## Runtime Oficial

O runtime oficial desta maquina esta em:

```text
/opt/7lm-connect/portal
```

O diretorio abaixo nao faz mais parte da execucao operacional do Dashboard
Comercial nesta maquina:

```text
/root/data-engineering/apps/commercial-dashboard
```

Ele pode existir em disco, mas nao deve ser usado para novos jobs, deploys ou
desenvolvimento operacional.

## Servicos Ativos

### API

```text
7lm-connect-api.service
```

- Working directory:
  `/opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect`
- Env:
  `/opt/7lm-connect/portal/.env`
- Entrypoint:
  `/opt/7lm-connect/portal/.venv/bin/python /opt/7lm-connect/portal/01_codigo_fonte/api_7lm_connect/aplicacao.py`

### Portal Node

```text
7lm-connect-portal.service
```

- Working directory:
  `/opt/7lm-connect/portal`
- Env:
  `/opt/7lm-connect/portal/.env`
- Entrypoint:
  `/usr/bin/node /opt/7lm-connect/portal/01_codigo_fonte/servidor_do_portal.js`

### Dashboard Comercial Pipeline

```text
7lm-dashboard-comercial-pipeline.timer
7lm-dashboard-comercial-pipeline.service
```

- Working directory:
  `/opt/7lm-connect/portal/05_modulos/dashboard_comercial`
- Execucao:
  `/usr/bin/npm run data:update:connect`
- Heap:
  `NODE_OPTIONS=--max-old-space-size=4096`

## Servicos Antigos

Nao reativar:

- `commercial-dashboard.service`
- `commercial-dashboard-preview.service`
- `commercial-dashboard-scheduler.service`
- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`

Nesta maquina, o sync antigo do Dashboard Comercial foi mascarado:

```text
7lm-dashboard-comercial-sync.service: masked
7lm-dashboard-comercial-sync.timer: masked
```

## Validacao

Comandos uteis:

```bash
systemctl status 7lm-connect-api.service
systemctl status 7lm-connect-portal.service
systemctl status 7lm-dashboard-comercial-pipeline.timer
systemctl list-timers --all --no-pager | rg '7lm-dashboard-comercial'
```

Log do pipeline:

```bash
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 120 --no-pager
```

## Banco

O `/opt` usa as variaveis `SEVENLM_CONNECT_*` definidas em:

```text
/opt/7lm-connect/portal/.env
```

Schemas principais:

- `sevenlm_connect`: autenticacao, permissoes, usuarios, funcionarios e
  hierarquia.
- `connect_comercial`: tabelas comerciais, dashboard e dados agregados.
