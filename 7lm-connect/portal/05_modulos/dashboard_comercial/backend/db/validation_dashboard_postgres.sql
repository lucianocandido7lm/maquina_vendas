-- Validacao rapida dos 10 indicadores no Postgres (data mart local)
-- Parametros esperados: :start_date e :end_date (YYYY-MM-DD)

WITH base_summary AS (
  SELECT
    COUNT(DISTINCT idlead) FILTER (WHERE dt_ultima_conversao_lead::date BETWEEN :start_date AND :end_date AND idlead IS NOT NULL) AS leads,
    COUNT(DISTINCT idlead) FILTER (WHERE dt_visita_realizada::date BETWEEN :start_date AND :end_date AND idlead IS NOT NULL) AS visitas,
    COUNT(DISTINCT idreserva) FILTER (WHERE data_venda::date BETWEEN :start_date AND :end_date AND idreserva IS NOT NULL) AS vendas,
    COUNT(DISTINCT idrepasse) FILTER (
      WHERE dt_assinatura_contrato::date BETWEEN :start_date AND :end_date
        AND fl_repasse_assinado = true
    ) AS repasses,
    AVG(
      CASE
        WHEN dt_contrato_contabilizado IS NOT NULL
         AND dt_cadastro_reserva IS NOT NULL
         AND dt_contrato_contabilizado >= dt_cadastro_reserva
        THEN EXTRACT(EPOCH FROM (dt_contrato_contabilizado - dt_cadastro_reserva)) / 86400.0
        ELSE NULL
      END
    ) FILTER (WHERE dt_contrato_contabilizado::date BETWEEN :start_date AND :end_date) AS sla_f,
    AVG(
      CASE
        WHEN dt_assinatura_contrato IS NOT NULL
         AND dt_contrato_contabilizado IS NOT NULL
         AND dt_assinatura_contrato >= dt_contrato_contabilizado
        THEN EXTRACT(EPOCH FROM (dt_assinatura_contrato - dt_contrato_contabilizado)) / 86400.0
        ELSE NULL
      END
    ) FILTER (WHERE dt_assinatura_contrato::date BETWEEN :start_date AND :end_date) AS sla_r
  FROM comercial_base
),
propostas AS (
  SELECT
    COUNT(DISTINCT idprecadastro) FILTER (
      WHERE dt_ultimo_historico_data BETWEEN :start_date AND :end_date
        AND proposta_status_atual = 'APROVADA'
    ) AS propostas_aprovadas,
    COUNT(DISTINCT idprecadastro) FILTER (
      WHERE dt_ultimo_historico_data BETWEEN :start_date AND :end_date
        AND proposta_status_atual IN ('APROVADA','CONDICIONADA','REPROVADA')
    ) AS propostas_total
  FROM comercial_propostas_consolidada
),
eventos AS (
  SELECT
    (SELECT COUNT(DISTINCT idreserva) FROM comercial_cancelamentos WHERE data_cancelamento::date BETWEEN :start_date AND :end_date) AS cancelamentos,
    (SELECT COUNT(DISTINCT idreserva) FROM comercial_distratos WHERE referencia_data::date BETWEEN :start_date AND :end_date) AS distratos
),
ipc AS (
  SELECT
    COUNT(DISTINCT b.idrepasse) FILTER (WHERE b.dt_assinatura_contrato::date BETWEEN :start_date AND :end_date AND b.fl_repasse_assinado = true) AS repasses_assinados,
    (
      SELECT COUNT(DISTINCT h.documento)
      FROM public.vw_hierarquia_cvcrm h
      WHERE LOWER(COALESCE(h.ativo_negocio, '')) = 's'
        AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= :end_date::date)
    ) AS corretores_ativos
  FROM comercial_base b
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
  ROUND(COALESCE(b.sla_f, 0)::numeric, 1) AS sla_f,
  ROUND(COALESCE(b.sla_r, 0)::numeric, 1) AS sla_r,
  ROUND(COALESCE(i.repasses_assinados::numeric / NULLIF(i.corretores_ativos, 0), 0), 2) AS ipc,
  i.repasses_assinados,
  i.corretores_ativos
FROM base_summary b
CROSS JOIN propostas p
CROSS JOIN eventos e
CROSS JOIN ipc i;
