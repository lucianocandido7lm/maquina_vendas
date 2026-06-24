# Pacote executavel de validacao P2P

Este pacote valida consistencia de dados da jornada comercial entre:

- Databricks (Bronze, Silver, Gold)
- Postgres (camada consumida pelo backend)
- API do dashboard (opcional)

## 1) Execucao automatica (recomendada)

No diretorio `apps/commercial-dashboard`:

```bash
npm run audit:p2p
```

Variaveis opcionais:

- `VALIDATION_START_DATE=YYYY-MM-DD`
- `VALIDATION_END_DATE=YYYY-MM-DD`
- `VALIDATION_API_BASE_URL=http://localhost:3001` (opcional, para validar endpoint)
- `VALIDATION_OUTPUT_DIR=/caminho/relatorios` (default: `backend/reports`)
- `DATABRICKS_BRONZE_SCHEMA` (default: `bronze`)
- `DATABRICKS_SILVER_SCHEMA` (default: `silver_cvcrm`)
- `VALIDATION_INCLUDE_BRONZE=true` (opcional; default: `false`)

Saidas:

- JSON: `backend/reports/validation-p2p-*.json`
- Markdown: `backend/reports/validation-p2p-*.md`

O script retorna exit code `1` se houver divergencia de KPI fora da tolerancia.

## 2) Execucao manual por SQL

### Databricks

1. Rode `backend/audit/sql/databricks_layer_sanity.sql`
2. Rode `backend/audit/sql/databricks_kpi_oficial.sql` substituindo `{{START_DATE}}` e `{{END_DATE}}`

### Postgres

1. Rode `backend/audit/sql/postgres_kpi_oficial.sql` com `:start_date` e `:end_date`

## 3) Criterios de aprovacao

- Contagens: diferenca = 0
- SLA (`sla_f`, `sla_r`): diferenca <= 0.1
- IPC: diferenca <= 0.01
- Nenhuma camada critica com erro de leitura

## 4) Evidencia para gestao

Anexe o markdown gerado em `backend/reports` no reporte executivo do dia.
