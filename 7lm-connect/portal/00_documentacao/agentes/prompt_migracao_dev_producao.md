# Prompt - Migracao Dev Para Producao

Voce e um agente de migracao levando mudancas do desenvolvimento para producao.

Leia antes:

- `00_documentacao/operacao/migracao-dev-para-producao-dashboard-comercial.md`
- `00_documentacao/operacao/estado-atual-runtime.md`
- `00_documentacao/banco_de_dados/dashboard_comercial.md`
- `AGENTS.md`

Objetivo:

Replicar em producao o fluxo do Dashboard Comercial centralizado no `/opt`,
sem depender de `/root/data-engineering`.

Checklist:

1. Confirmar `.env` de producao:
   `/opt/7lm-connect/portal/.env`.
2. Confirmar banco e schemas:
   `sevenlm_connect` e `connect_comercial`.
3. Sincronizar codigo do modulo:
   `/opt/7lm-connect/portal/05_modulos/dashboard_comercial`.
4. Instalar dependencias:
   `npm ci --omit=dev`.
5. Instalar/atualizar systemd:
   `7lm-dashboard-comercial-pipeline.service` e `.timer`.
6. Desabilitar e mascarar sync antigo:
   `7lm-dashboard-comercial-sync.service` e `.timer`.
7. Garantir que nenhuma outra maquina rode sync antigo no mesmo banco.
8. Rodar dry-run.
9. Rodar carga real.
10. Validar API e filtros.

Arquivos criticos:

- `backend/scripts/sync-databricks-to-connect-comercial.js`
- `package.json`
- `/etc/systemd/system/7lm-dashboard-comercial-pipeline.service`
- `/etc/systemd/system/7lm-dashboard-comercial-pipeline.timer`
- `01_codigo_fonte/api_7lm_connect/rotas/rotas_de_dashboard_comercial.py`

Validacoes:

```bash
cd /opt/7lm-connect/portal/05_modulos/dashboard_comercial
node --check backend/scripts/sync-databricks-to-connect-comercial.js
npm run data:update:connect:dry-run
systemctl start 7lm-dashboard-comercial-pipeline.service
```

```sql
select id, status, finished_at, message, table_counts
from connect_comercial.dashboard_comercial_sync_log
order by id desc
limit 1;
```

Nao concluir a migracao se:

- o ultimo log nao for `success`;
- filtros de `gerencia` e `coordenacao` vierem zerados;
- houver sync antigo ativo;
- o timer novo estiver sem proximo disparo.

Pacote de evidencias obrigatorio para producao:

1. `systemctl status 7lm-connect-api.service`.
2. `systemctl status 7lm-connect-portal.service`.
3. `systemctl status 7lm-dashboard-comercial-pipeline.timer`.
4. Ultimo registro de `connect_comercial.dashboard_comercial_sync_log`.
5. Contagem de `connect_comercial.comercial_kpi_daily`.
6. Contagem distinta de `corretor`, `gerencia`, `coordenacao` e `imobiliaria`.
7. Lista de endpoints comerciais testados com HTTP 200.
8. Confirmacao de que `/root/data-engineering` nao ficou como runtime.
