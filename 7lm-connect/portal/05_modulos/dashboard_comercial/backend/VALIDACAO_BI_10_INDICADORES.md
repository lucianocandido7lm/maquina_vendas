# Plano rapido de validacao BI (10 indicadores)

Objetivo: abrir o sistema e validar rapidamente se os indicadores batem entre API, Postgres local e Gold Databricks.

## 1) Janela padrao de validacao

- Defina uma janela curta e controlada (recomendado): mes atual ate hoje.
- Exemplo: `start_date = 2026-04-01`, `end_date = 2026-04-13`.

## 2) Ordem de execucao (15-25 min)

1. Rodar atualizacao de dados (`/api/v1/dashboard/refresh-data`) ou job equivalente.
2. Conferir que a carga terminou sem erro no backend.
3. Executar SQL de validacao no Postgres: `db/validation_dashboard_postgres.sql`.
4. Executar SQL espelho no Databricks (queries abaixo).
5. Abrir dashboard e comparar cards com os mesmos filtros/periodo.

## 3) Criterio de aceite por indicador

- Contagens (`leads`, `visitas`, `propostas`, `vendas`, `repasses`, `cancelamentos`, `distratos`): diferenca absoluta = 0.
- SLAs (`sla_f`, `sla_r`): tolerancia maxima de 0.1 dia (arredondamento).
- `ipc`: tolerancia maxima de 0.01.

## 4) Query espelho Databricks (Gold)

```sql
-- Ajuste o catalog/schema se necessario
-- data_platform_dev.gold_cvcrm

WITH base_summary AS (
  SELECT
    COUNT(*) FILTER (WHERE to_date(dt_ultima_conversao_lead) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS leads,
    COUNT(DISTINCT idlead) FILTER (WHERE to_date(dt_visita) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13') AND idlead IS NOT NULL) AS visitas,
    COUNT(*) FILTER (WHERE to_date(data_venda) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS vendas,
    COUNT(DISTINCT idrepasse) FILTER (WHERE to_date(dt_assinatura_contrato) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13') AND fl_repasse_assinado = true) AS repasses,
    AVG(CASE WHEN dt_contrato_contabilizado IS NOT NULL AND dt_cadastro_reserva IS NOT NULL AND dt_contrato_contabilizado >= dt_cadastro_reserva THEN datediff(to_date(dt_contrato_contabilizado), to_date(dt_cadastro_reserva)) END)
      FILTER (WHERE to_date(dt_contrato_contabilizado) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS sla_f,
    AVG(CASE WHEN dt_assinatura_contrato IS NOT NULL AND dt_contrato_contabilizado IS NOT NULL AND dt_assinatura_contrato >= dt_contrato_contabilizado THEN datediff(to_date(dt_assinatura_contrato), to_date(dt_contrato_contabilizado)) END)
      FILTER (WHERE to_date(dt_assinatura_contrato) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS sla_r
  FROM data_platform_dev.gold_cvcrm.vw_bi_comercial_base
),
propostas AS (
  SELECT
    COUNT(DISTINCT idprecadastro) FILTER (
      WHERE dt_ultimo_historico_data BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')
        AND proposta_status_atual = 'APROVADA'
    ) AS propostas_aprovadas,
    COUNT(DISTINCT idprecadastro) FILTER (
      WHERE dt_ultimo_historico_data BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')
        AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
    ) AS propostas_total
  FROM data_platform_dev.gold_cvcrm.vw_bi_propostas_consolidada
),
eventos AS (
  SELECT
    (SELECT COUNT(DISTINCT idreserva) FROM data_platform_dev.gold_cvcrm.vw_bi_cancelamentos WHERE to_date(data_cancelamento) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS cancelamentos,
    (SELECT COUNT(DISTINCT idreserva) FROM data_platform_dev.gold_cvcrm.vw_bi_distratos WHERE to_date(referencia_data) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13')) AS distratos
),
ipc AS (
  SELECT
    COUNT(DISTINCT idrepasse) FILTER (WHERE to_date(dt_assinatura_contrato) BETWEEN DATE('2026-04-01') AND DATE('2026-04-13') AND fl_repasse_assinado = true) AS repasses_assinados,
    (
      SELECT COUNT(DISTINCT documento)
      FROM data_platform_dev.gold_cvcrm.corretores_ativos
      WHERE lower(coalesce(ativo_negocio, '')) = 's'
        AND (data_fim_vigencia IS NULL OR data_fim_vigencia >= DATE('2026-04-13'))
    ) AS corretores_ativos
  FROM data_platform_dev.gold_cvcrm.vw_bi_comercial_base
)
SELECT
  b.leads, b.visitas, p.propostas_aprovadas, p.propostas_total, b.vendas, b.repasses,
  e.cancelamentos, e.distratos,
  ROUND(COALESCE(b.sla_f, 0), 1) AS sla_f,
  ROUND(COALESCE(b.sla_r, 0), 1) AS sla_r,
  ROUND(COALESCE(i.repasses_assinados / NULLIF(i.corretores_ativos, 0), 0), 2) AS ipc
FROM base_summary b
CROSS JOIN propostas p
CROSS JOIN eventos e
CROSS JOIN ipc i;
```

## 5) Checklist visual no sistema

- Abra `/api/v1/dashboard/summary` com o mesmo periodo do SQL e compare os 10 cards.
- Abra `/api/v1/dashboard/trends` e confira se a soma diaria bate com o total do `summary` para cada KPI de contagem.
- Em `propostas`, valide se o card principal representa `aprovadas` ou `total` e mantenha o mesmo conceito no BI.

## 6) Diagnostico rapido quando der diferenca

- Diferenca em `cancelamentos`/`distratos`: verificar se a jornada existe em `comercial_base` local (join dos eventos depende da base).
- Diferenca em `sla_f`/`sla_r`: conferir nulos e datas invertidas (fim < inicio).
- Diferenca em `ipc`: conferir denominador de corretores ativos na hierarquia vigente na data de corte.

## 7) Status da correcao aplicada agora

- Ajustado o filtro de carga da base no sync Databricks para considerar tambem:
  - `dt_contrato_contabilizado`
  - `dt_assinatura_contrato`
  - `dt_cancelamento_reserva`

Arquivo alterado: `apps/commercial-dashboard/backend/scripts/sync-databricks.js`.
