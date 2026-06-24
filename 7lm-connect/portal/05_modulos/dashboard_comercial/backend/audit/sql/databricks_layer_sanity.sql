-- Sanidade por camada (Bronze/Silver/Gold)
-- Ajuste catalog/schemas se necessario.

-- Bronze
SELECT 'bronze.leads' AS camada_entidade, COUNT(*) AS total_linhas, COUNT(DISTINCT idlead) AS ids_distintos, MAX(dt_ingestion) AS max_dt_ingestion
FROM data_platform_dev.bronze.leads
UNION ALL
SELECT 'bronze.precadastros', COUNT(*), COUNT(DISTINCT idprecadastro), MAX(dt_ingestion)
FROM data_platform_dev.bronze.precadastros
UNION ALL
SELECT 'bronze.reservas', COUNT(*), COUNT(DISTINCT idreserva), MAX(dt_ingestion)
FROM data_platform_dev.bronze.reservas
UNION ALL
SELECT 'bronze.repasses', COUNT(*), COUNT(DISTINCT idrepasse), MAX(dt_ingestion)
FROM data_platform_dev.bronze.repasses;

-- Silver
SELECT 'silver.leads' AS camada_entidade, COUNT(*) AS total_linhas, COUNT(DISTINCT idlead) AS ids_distintos, MAX(dt_ingestion) AS max_dt_ingestion
FROM data_platform_dev.silver_cvcrm.leads
UNION ALL
SELECT 'silver.precadastros', COUNT(*), COUNT(DISTINCT idprecadastro), MAX(dt_ingestion)
FROM data_platform_dev.silver_cvcrm.precadastros
UNION ALL
SELECT 'silver.reservas', COUNT(*), COUNT(DISTINCT idreserva), MAX(dt_ingestion)
FROM data_platform_dev.silver_cvcrm.reservas
UNION ALL
SELECT 'silver.repasses', COUNT(*), COUNT(DISTINCT idrepasse), MAX(dt_ingestion)
FROM data_platform_dev.silver_cvcrm.repasses;

-- Gold foundation
SELECT
  COUNT(*) AS jornadas,
  COUNT_IF(dt_ultima_conversao_lead IS NOT NULL) AS com_lead_conversao,
  COUNT_IF(dt_visita_realizada IS NOT NULL) AS com_visita,
  COUNT_IF(dt_cancelamento_reserva IS NOT NULL) AS com_cancelamento,
  COUNT_IF(dt_assinatura_contrato IS NOT NULL) AS com_assinatura,
  MIN(sla_finalizacao_dias) AS min_sla_f,
  MAX(sla_finalizacao_dias) AS max_sla_f,
  MIN(sla_repasse_dias) AS min_sla_r,
  MAX(sla_repasse_dias) AS max_sla_r
FROM data_platform_dev.gold_cvcrm.fato_jornada_comercial;
