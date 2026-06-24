-- KPI oficial para validacao no Databricks (Gold)
-- Substitua {{START_DATE}} e {{END_DATE}} no formato YYYY-MM-DD

WITH base_summary AS (
  SELECT
    COUNT(DISTINCT CASE
      WHEN TO_DATE(dt_ultima_conversao_lead) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND idlead IS NOT NULL THEN idlead END) AS leads,
    COUNT(DISTINCT CASE
      WHEN TO_DATE(dt_visita) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND idlead IS NOT NULL THEN idlead END) AS visitas,
    COUNT(DISTINCT CASE
      WHEN TO_DATE(data_venda) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND idreserva IS NOT NULL THEN idreserva END) AS vendas,
    COUNT(DISTINCT CASE
      WHEN TO_DATE(dt_assinatura_contrato) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND fl_repasse_assinado = true THEN idrepasse END) AS repasses,
    AVG(CASE
      WHEN TO_DATE(dt_contrato_contabilizado) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND dt_contrato_contabilizado IS NOT NULL
       AND dt_cadastro_reserva IS NOT NULL
       AND dt_contrato_contabilizado >= dt_cadastro_reserva
      THEN datediff(TO_DATE(dt_contrato_contabilizado), TO_DATE(dt_cadastro_reserva)) END) AS sla_f,
    AVG(CASE
      WHEN TO_DATE(dt_assinatura_contrato) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND dt_assinatura_contrato IS NOT NULL
       AND dt_contrato_contabilizado IS NOT NULL
       AND dt_assinatura_contrato >= dt_contrato_contabilizado
      THEN datediff(TO_DATE(dt_assinatura_contrato), TO_DATE(dt_contrato_contabilizado)) END) AS sla_r
  FROM data_platform_dev.gold_cvcrm.vw_bi_comercial_base
),
propostas AS (
  SELECT
    COUNT(DISTINCT CASE
      WHEN dt_ultimo_historico_data BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND proposta_status_atual = 'APROVADA' THEN idprecadastro END) AS propostas_aprovadas,
    COUNT(DISTINCT CASE
      WHEN dt_ultimo_historico_data BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA') THEN idprecadastro END) AS propostas_total
  FROM data_platform_dev.gold_cvcrm.vw_bi_propostas_consolidada
),
eventos AS (
  SELECT
    (SELECT COUNT(DISTINCT idreserva)
     FROM data_platform_dev.gold_cvcrm.vw_bi_cancelamentos
     WHERE TO_DATE(data_cancelamento) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}') AS cancelamentos,
    (SELECT COUNT(DISTINCT idreserva)
     FROM data_platform_dev.gold_cvcrm.vw_bi_distratos
     WHERE TO_DATE(referencia_data) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}') AS distratos
),
ipc AS (
  SELECT
    COUNT(DISTINCT CASE
      WHEN TO_DATE(dt_assinatura_contrato) BETWEEN DATE '{{START_DATE}}' AND DATE '{{END_DATE}}'
       AND fl_repasse_assinado = true THEN idrepasse END) AS repasses_assinados,
    (
      SELECT COUNT(DISTINCT documento)
      FROM data_platform_dev.gold_cvcrm.corretores_ativos
      WHERE LOWER(COALESCE(ativo_negocio, '')) = 's'
        AND (data_inicio_vigencia IS NULL OR TO_DATE(data_inicio_vigencia) <= DATE '{{END_DATE}}')
        AND (data_fim_vigencia IS NULL OR TO_DATE(data_fim_vigencia) >= DATE '{{END_DATE}}')
    ) AS corretores_ativos
  FROM data_platform_dev.gold_cvcrm.vw_bi_comercial_base
)
SELECT
  b.leads,
  b.visitas,
  p.propostas_aprovadas,
  p.propostas_total,
  b.vendas,
  b.repasses,
  e.cancelamentos,
  e.distratos,
  ROUND(COALESCE(b.sla_f, 0), 1) AS sla_f,
  ROUND(COALESCE(b.sla_r, 0), 1) AS sla_r,
  ROUND(COALESCE(i.repasses_assinados / NULLIF(i.corretores_ativos, 0), 0), 2) AS ipc,
  i.repasses_assinados,
  i.corretores_ativos
FROM base_summary b
CROSS JOIN propostas p
CROSS JOIN eventos e
CROSS JOIN ipc i;
