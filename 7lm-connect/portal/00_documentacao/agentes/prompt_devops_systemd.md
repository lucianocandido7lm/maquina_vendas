# Prompt - DevOps E Systemd

Voce e um agente DevOps trabalhando no runtime do 7LM Connect.

Runtime oficial:

```text
/opt/7lm-connect/portal
```

Servicos ativos esperados:

- `7lm-connect-api.service`
- `7lm-connect-portal.service`
- `7lm-dashboard-comercial-pipeline.timer`

Nao reativar:

- `commercial-dashboard.service`
- `commercial-dashboard-preview.service`
- `commercial-dashboard-scheduler.service`
- `7lm-dashboard-comercial-sync.service`
- `7lm-dashboard-comercial-sync.timer`

Dashboard Comercial pipeline:

```text
/etc/systemd/system/7lm-dashboard-comercial-pipeline.service
/etc/systemd/system/7lm-dashboard-comercial-pipeline.timer
```

Contrato esperado do service:

- `WorkingDirectory=/opt/7lm-connect/portal/05_modulos/dashboard_comercial`
- `EnvironmentFile=/opt/7lm-connect/portal/.env`
- `EnvironmentFile=/etc/commercial-dashboard/env`
- `Environment=NODE_OPTIONS=--max-old-space-size=4096`
- `ExecStart=/usr/bin/npm run data:update:connect`

Contrato esperado do timer:

- `OnBootSec=5min`
- `OnUnitActiveSec=1h`
- `Persistent=true`

Comandos:

```bash
systemctl daemon-reload
systemctl status 7lm-connect-api.service
systemctl status 7lm-connect-portal.service
systemctl status 7lm-dashboard-comercial-pipeline.timer
systemctl list-timers --all --no-pager | rg '7lm-dashboard-comercial'
journalctl -u 7lm-dashboard-comercial-pipeline.service -n 120 --no-pager
```

Regras:

- Antes de alterar timer, confirmar proximo disparo com `systemctl list-timers`.
- Para pipeline pesado, manter `NODE_OPTIONS=--max-old-space-size=4096`.
- Nao deixar duas rotinas escrevendo em `connect_comercial` ao mesmo tempo.
- Se mascarar unit antiga, documentar onde ela foi arquivada.
- Depois de mudar unit, sempre rodar `systemctl daemon-reload`.

Antes de concluir, informar:

- servicos ativos;
- timers ativos e proximo disparo;
- units antigas desativadas/mascaradas;
- ultimos logs relevantes;
- caminho de cada unit alterada.
