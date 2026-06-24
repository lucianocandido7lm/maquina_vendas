import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import DashboardFilters from '../components/DashboardFilters';
import SelectFilter from '../components/SelectFilter';
import ExecutiveKpiCard from '../components/dashboard/ExecutiveKpiCard';
import AnalysisPanel from '../components/dashboard/AnalysisPanel';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import { useGoalConfig } from '../hooks/useGoalConfig';
import './Dashboard.css';
import { logger } from '../utils/logger';
import { countBusinessDays, getBusinessDayRange } from '../utils/dateUtils';
import { getComparisonRange } from '../utils/periodComparison';

const summaryFieldByKpi = {
  leads: 'total_leads',
  visitas: 'total_visitas',
  propostas: 'total_propostas_geral',
  cancelamentos: 'total_cancelamentos',
  distratos: 'total_distratos',
  vendas: 'total_vendas',
  repasses: 'total_repasses',
  sla_f: 'total_sla_finalizacao',
  sla_r: 'total_sla_repasse',
  ipc_corretor: 'total_ipc_corretor',
  ipc_imobiliaria: 'total_ipc_imobiliaria',
};

const supportFieldByKpi = {
  ipc_corretor: 'ipc_corretores_ativos',
  ipc_imobiliaria: 'ipc_imobiliarias_ativas',
  repasses: 'total_repasses',
};

const metricFieldByKpi = {
  leads: 'leads',
  visitas: 'visitas',
  propostas: 'propostas',
  cancelamentos: 'cancelamentos',
  distratos: 'distratos',
  vendas: 'vendas',
  repasses: 'repasses',
  sla_f: 'sla_finalizacao',
  sla_r: 'sla_repasse',
  ipc_corretor: 'ipc_corretor',
  ipc_imobiliaria: 'ipc_imobiliaria',
};

const statusToInsightType = {
  good: 'favoravel',
  attention: 'atencao',
  risk: 'risco',
};

const STATUS_ATTENTION_BAND = 0.8;
const LOWER_BETTER_ATTENTION_BAND = 1.2;

const resolveKpiStatus = ({ value, target, lowerIsBetter = false }) => {
  const numericValue = Number(value);
  const numericTarget = Number(target);

  if (!Number.isFinite(numericValue)) return 'attention';
  if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
    if (lowerIsBetter) return numericValue <= 0 ? 'good' : 'attention';
    return numericValue > 0 ? 'attention' : 'risk';
  }

  if (lowerIsBetter) {
    if (numericValue <= numericTarget) return 'good';
    if (numericValue <= numericTarget * LOWER_BETTER_ATTENTION_BAND) return 'attention';
    return 'risk';
  }

  if (numericValue >= numericTarget) return 'good';
  if (numericValue >= numericTarget * STATUS_ATTENTION_BAND) return 'attention';
  return 'risk';
};

const formatShortDate = (date) => {
  const [year, month, day] = String(date ?? '').split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}`;
};

const Dashboard = () => {
  const [expandedKpiId, setExpandedKpiId] = useState(null);
  const { filterOptions, filters, setFilterValue, filterQueryString, buildFilterParams } = useCommercialFilters();
  const { goals: goalConfigs, saveGoal: saveGoalToConfig } = useGoalConfig();
  const [apiData, setApiData] = useState({
    summary: null,
    trends: [],
    previousSummary: null,
    previousTrends: [],
    series: null,
    previousSeries: null,
    seriesMeta: null,
  });
  const [kpiBreakdowns, setKpiBreakdowns] = useState({});
  const [propostasBreakdowns, setPropostasBreakdowns] = useState(null);
  const [slaRepasseInsights, setSlaRepasseInsights] = useState(null);
  const [ipcInsights, setIpcInsights] = useState(null);
  const [lastFetchError, setLastFetchError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  
  const comparisonRange = useMemo(
    () => getComparisonRange(filters.dataInicial, filters.dataFinal, filters.comparacao),
    [filters.dataInicial, filters.dataFinal, filters.comparacao]
  );

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    const loadRealData = async () => {
      setIsLoading(true);
      setLastFetchError(null);

      const startDate = String(filters.dataInicial ?? '').trim();
      const endDate = String(filters.dataFinal ?? '').trim();

      if (!startDate || !endDate) {
        setLastFetchError('Periodo invalido para consulta do dashboard.');
        return;
      }

      // Use buildFilterParams for deterministic, consistent serialization
      const currentParams = buildFilterParams(startDate, endDate);
      const queryParams = currentParams.toString();

      const { start: previousStart, end: previousEnd } = comparisonRange;
      const overviewParams = new URLSearchParams(queryParams);
      overviewParams.set('prevStartDate', previousStart);
      overviewParams.set('prevEndDate', previousEnd);
      const overviewUrl = `/api/v1/dashboard/overview?${overviewParams.toString()}`;
      const summaryUrl = `/api/v1/dashboard/summary?${queryParams}`;
      const previousSummaryParams = buildFilterParams(previousStart, previousEnd).toString();
      const previousSummaryUrl = `/api/v1/dashboard/summary?${previousSummaryParams}`;

      logger.info('dashboard:data', 'Iniciando carregamento do dashboard', { overviewUrl });

      try {
        const [overviewResponse, summaryResponse, previousSummaryResponse] = await Promise.all([
          fetch(overviewUrl, { signal: controller.signal }),
          fetch(summaryUrl, { signal: controller.signal }),
          fetch(previousSummaryUrl, { signal: controller.signal }),
        ]);

        const getResponseErrorMessage = async (response, fallbackLabel) => {
          try {
            const body = await response.json();
            if (body?.details) return `${fallbackLabel} failed (${response.status}): ${body.details}`;
            if (body?.error) return `${fallbackLabel} failed (${response.status}): ${body.error}`;
          } catch {
            // noop
          }
          return `${fallbackLabel} failed (${response.status})`;
        };

        if (!overviewResponse.ok) {
          throw new Error(await getResponseErrorMessage(overviewResponse, 'Overview request'));
        }
        if (!summaryResponse.ok) {
          throw new Error(await getResponseErrorMessage(summaryResponse, 'Summary request'));
        }
        if (!previousSummaryResponse.ok) {
          throw new Error(await getResponseErrorMessage(previousSummaryResponse, 'Previous summary request'));
        }

        const [payload, summaryPayload, previousSummaryPayload] = await Promise.all([
          overviewResponse.json(),
          summaryResponse.json(),
          previousSummaryResponse.json(),
        ]);
        const summary = summaryPayload ?? null;
        const trends = payload?.trends ?? [];
        const previousSummary = previousSummaryPayload ?? null;
        const previousTrends = payload?.previousTrends ?? [];
        const series = payload?.series ?? null;
        const previousSeries = payload?.previousSeries ?? null;
        const seriesMeta = payload?.seriesMeta ?? null;

        if (!isSubscribed) return;

        const newData = {
          summary,
          trends: Array.isArray(trends) ? trends : [],
          previousSummary,
          previousTrends: Array.isArray(previousTrends) ? previousTrends : [],
          series,
          previousSeries,
          seriesMeta,
        };
        setApiData(newData);
        logger.info('dashboard:data', 'Dashboard carregado com sucesso');
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (!isSubscribed) return;
        logger.error('dashboard:data', 'Falha ao carregar dashboard', { error: err?.message });
        setLastFetchError(err?.message || 'Erro inesperado no carregamento.');
        setApiData({ summary: null, trends: [], previousSummary: null, previousTrends: [], series: null, previousSeries: null, seriesMeta: null });
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadRealData();
    }, 250);

    return () => {
      isSubscribed = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [buildFilterParams, comparisonRange, comparisonRange.end, comparisonRange.start, filterQueryString, filters.dataFinal, filters.dataInicial]);

  const periodBusinessDays = useMemo(
    () => countBusinessDays(filters.dataInicial, filters.dataFinal) || 0,
    [filters.dataInicial, filters.dataFinal],
  );

  const businessDayRange = useMemo(
    () => getBusinessDayRange(filters.dataInicial, filters.dataFinal),
    [filters.dataInicial, filters.dataFinal],
  );

  const monthlyBounds = useMemo(() => {
    const reference = filters.dataFinal ?? filters.dataInicial ?? new Date().toISOString().split('T')[0];
    const refDate = new Date(`${reference}T00:00:00Z`);
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const format = (date) => date.toISOString().split('T')[0];
    return {
      start: format(start),
      end: format(end),
    };
  }, [filters.dataFinal, filters.dataInicial]);

  const monthlyBusinessDays = useMemo(
    () => countBusinessDays(monthlyBounds.start, monthlyBounds.end) || 21,
    [monthlyBounds.end, monthlyBounds.start],
  );

  const trendLookup = useMemo(() => {
    return (apiData.trends ?? []).reduce((acc, entry) => {
      const rawDate = entry.data ?? entry.date;
      if (!rawDate) return acc;
      const date = rawDate.split('T')[0];
      acc[date] = entry;
      return acc;
    }, {});
  }, [apiData.trends]);

  const previousTrendLookup = useMemo(() => {
    return (apiData.previousTrends ?? []).reduce((acc, entry) => {
      const rawDate = entry.data ?? entry.date;
      if (!rawDate) return acc;
      const date = rawDate.split('T')[0];
      acc[date] = entry;
      return acc;
    }, {});
  }, [apiData.previousTrends]);

  const previousBusinessDayRange = useMemo(() => {
    return getBusinessDayRange(comparisonRange.start, comparisonRange.end);
  }, [comparisonRange]);

  const normalizedToday = useMemo(() => {
    const physicalToday = new Date().toISOString().split('T')[0];
    const filterEnd = filters.dataFinal;
    if (!filterEnd) return physicalToday;
    return physicalToday > filterEnd ? filterEnd : physicalToday;
  }, [filters.dataFinal]);

  const elapsedBusinessDays = useMemo(
    () => countBusinessDays(filters.dataInicial, normalizedToday) || 1,
    [filters.dataInicial, normalizedToday],
  );

  const analysisPeriod = useMemo(() => ({
    startDate: filters.dataInicial,
    endDate: filters.dataFinal,
    totalBusinessDays: businessDayRange.length || periodBusinessDays || 1,
    elapsedBusinessDays,
    today: normalizedToday,
  }), [filters.dataInicial, filters.dataFinal, businessDayRange.length, periodBusinessDays, normalizedToday, elapsedBusinessDays]);

  const executiveData = useMemo(() => {
    const goalsByKpi = goalConfigs.reduce((acc, item) => {
      acc[item.kpi_id] = item;
      return acc;
    }, {});

    // Lista base de KPIs oficiais
    const kpiDefinitions = [
      { id: 'leads', label: 'LEADS', unit: 'total', calcDescription: 'Contagem de novos leads no período filtrado.' },
      { id: 'visitas', label: 'VISITAS', unit: 'total', calcDescription: 'Contagem de visitas realizadas no período filtrado.' },
      { id: 'propostas', label: 'PROPOSTAS', unit: 'total', calcDescription: 'Contagem de idprecadastro pela ultima movimentacao entre Aprovada, Condicionada e Reprovada no periodo filtrado.' },
      { id: 'cancelamentos', label: 'CANCELAMENTOS', unit: 'total', calcDescription: 'Contagem de idreserva com data_cancelamento no período.' },
      { id: 'vendas', label: 'VENDAS FINALIZADAS', unit: 'total', calcDescription: 'Contagem de idreserva com data_venda da reserva no período.' },
      { id: 'distratos', label: 'DISTRATOS', unit: 'total', calcDescription: 'Contagem de idreserva com referência em status distrato no período.' },
      { id: 'repasses', label: 'REPASSES', unit: 'total', calcDescription: 'Contagem de idrepasse por data de assinatura do contrato.' },
      { id: 'sla_f', label: 'SLA FINALIZAÇÃO', unit: 'dias', calcDescription: 'Média em dias entre cadastro da reserva e contrato contabilizado.' },
      { id: 'sla_r', label: 'SLA REPASSE', unit: 'dias', calcDescription: 'Média em dias entre contrato contabilizado e assinatura do contrato.' },
      {
        id: 'ipc_corretor',
        label: 'IPC CORRETOR & IMOB.',
        unit: 'ratio',
        isIpc: true,
        hideForecast: true,
        numeratorLabel: 'Repasses Válidos',
        denominatorLabel: 'Corretores-mês',
        denominatorSecondaryLabel: 'Imobiliárias-mês',
        calcDescription: '',
      },
    ];

    const totalBusinessDays = analysisPeriod.totalBusinessDays || 1;
    const observedBusinessDays = analysisPeriod.elapsedBusinessDays || 1;

    const computeMomentum = (kpiId, currentValue) => {
      const summaryKey = summaryFieldByKpi[kpiId];
      if (!summaryKey) return null;
      const prev = Number(apiData.previousSummary?.[summaryKey]) || 0;
      const current = Number(currentValue) || 0;
      if (prev <= 0) return null;
      return Number((((current - prev) / prev) * 100).toFixed(1));
    };

    const summaryProposalAprovadas = Number(apiData.summary?.total_propostas_aprovadas) || 0;
    const summaryProposalCondicionadas = Number(apiData.summary?.total_propostas_condicionadas) || 0;
    const summaryProposalReprovadas = Number(apiData.summary?.total_propostas_reprovadas) || 0;
    const kpis = kpiDefinitions.map((def) => {
      const summaryKey = summaryFieldByKpi[def.id];
      const supportKey = supportFieldByKpi[def.id];
      const hasData = Boolean(apiData.summary);
      
      let actual = hasData ? (Number(apiData.summary?.[summaryKey]) || 0) : null;
      let prevValue = Number(apiData.previousSummary?.[summaryKey]) || 0;
      let denominator = null;
      let denominatorSecondary = null;

      if (def.unit === 'ratio') {
        denominator = Number(apiData.summary?.[supportKey]) || 0;
      }

      if (def.isIpc && def.id === 'ipc_corretor') {
        denominatorSecondary = Number(apiData.summary?.ipc_imobiliarias_ativas) || 0;
      }


      if (!hasData) {
        return {
          ...def,
          title: def.label,
          actual: null,
          prevValue: null,
          target: null,
          attainment: null,
          avgPerBusinessDay: null,
          forecast: null,
          dailyGoal: null,
          monthlyTarget: null,
          totalBusinessDays,
          forecastVisible: false,
          mom: 0,
          status: 'attention',
          variation: null,
          insight: 'N/A',
          periodLabel: `Período ${filters.dataInicial} → ${filters.dataFinal}`,
        };
      }

      const config = goalsByKpi[def.id] ?? null;
      const targetType = config?.target_type ?? 'absolute';
      const isQualityKpi = Boolean(config?.quality_style) || targetType === 'ratio_limit';
      const isLowerBetter = isQualityKpi || targetType === 'days_max';
      const vendasPeriodo = Number(apiData.summary?.total_vendas) || 0;

      let monthlyTarget = config ? Number(config.goal_value) : null;
      let periodTarget = null;

      if (targetType === 'ratio_limit') {
        periodTarget = Number((vendasPeriodo * ((monthlyTarget ?? 0) / 100)).toFixed(1));
      } else if (targetType === 'days_max') {
        periodTarget = monthlyTarget;
      } else if (def.unit === 'ratio') {
        periodTarget = monthlyTarget;
      } else if (monthlyTarget != null) {
        const baseDailyGoal = monthlyBusinessDays > 0 ? monthlyTarget / monthlyBusinessDays : monthlyTarget;
        periodTarget = Number((baseDailyGoal * totalBusinessDays).toFixed(1));
      }

      const attainment = isLowerBetter
        ? (periodTarget > 0
          ? Number((Math.min(100, ((periodTarget / Math.max(actual, 1)) * 100))).toFixed(1))
          : 0)
        : (periodTarget > 0 ? Number(((actual / periodTarget) * 100).toFixed(1)) : 0);
      const avgPerBusinessDay = Number((actual / Math.max(observedBusinessDays, 1)).toFixed(2));
      const isCumulativeTarget = targetType === 'absolute' && def.unit !== 'ratio';
      const dailyGoal = periodTarget != null
        ? (isCumulativeTarget
          ? Number((periodTarget / Math.max(totalBusinessDays, 1)).toFixed(2))
          : Number(periodTarget))
        : null;
      const forecast = isCumulativeTarget
        ? Number((avgPerBusinessDay * totalBusinessDays).toFixed(1))
        : actual;
      const statusReferenceValue = isCumulativeTarget ? forecast : actual;
      const status = resolveKpiStatus({
        value: statusReferenceValue,
        target: periodTarget,
        lowerIsBetter: isLowerBetter,
      });

      const propostasStatusTotals = def.id === 'propostas'
        ? {
          aprovadas: summaryProposalAprovadas,
          condicionadas: summaryProposalCondicionadas,
          reprovadas: summaryProposalReprovadas,
          total: summaryProposalAprovadas + summaryProposalCondicionadas + summaryProposalReprovadas,
        }
        : null;

      return {
        ...def,
        title: def.label,
        actual,
        prevValue,
        target: periodTarget,
        attainment,
        avgPerBusinessDay,
        forecast,
        dailyGoal,
        monthlyTarget,
        lowerIsBetter: isLowerBetter,
        isCumulativeTarget,
        totalBusinessDays,
        forecastVisible: periodTarget > 0,
        mom: computeMomentum(def.id, actual),
        status,
        previousPeriodLabel: `${formatShortDate(comparisonRange.start)} \u2192 ${formatShortDate(comparisonRange.end)}`,
        avgPeriodLabel: `${formatShortDate(filters.dataInicial)} → ${formatShortDate(normalizedToday)}`,
        avgBusinessDaysUsed: observedBusinessDays,
        variation: null,
        insight: hasData ? 'Dados carregados do Databricks' : 'N/D',
        targetType,
        goalUnit: config?.unit ?? def.unit,
        qualityBaseValue: isQualityKpi ? vendasPeriodo : null,
        periodLabel: `Período ${filters.dataInicial} → ${filters.dataFinal}`,
        denominator,
        denominatorSecondary,
        ipcImobiliaria: def.isIpc ? (Number(apiData.summary?.total_ipc_imobiliaria) || 0) : null,
        numerator: def.unit === 'ratio' ? (Number(apiData.summary?.total_repasses) || 0) : null,
        numeratorAttributed: def.unit === 'ratio' ? (Number(apiData.summary?.total_repasses_elegiveis) || 0) : null,
        numeratorUnlinked: def.unit === 'ratio' ? (Number(apiData.summary?.total_repasses_nao_elegiveis) || 0) : null,
        propostasStatusTotals,
      };
    });

    const insights = [];
    if (apiData.summary) {
      const leadsTotal = Number(apiData.summary.total_leads) || 0;
      const vendasTotal = Number(apiData.summary.total_vendas) || 0;
      const statusForLeads = kpis.find((k) => k.id === 'leads')?.status ?? 'attention';
      const statusForVendas = kpis.find((k) => k.id === 'vendas')?.status ?? 'attention';

      if (leadsTotal > 0) {
        insights.push({
          id: 'insight-leads',
          type: statusToInsightType[statusForLeads] ?? 'atencao',
          title: 'Captação ativa',
          description: `${leadsTotal} novos leads registrados no período filtrado.`,
        });
      }

      if (vendasTotal > 0) {
        insights.push({
          id: 'insight-vendas',
          type: statusToInsightType[statusForVendas] ?? 'favoravel',
          title: 'Conversão',
          description: `${vendasTotal} vendas confirmadas. Monitore o ritmo para manter a curva.`,
        });
      }
    }

    return { kpis, insights };
  }, [analysisPeriod.elapsedBusinessDays, analysisPeriod.totalBusinessDays, apiData.previousSummary, apiData.summary, comparisonRange.end, comparisonRange.start, filters.dataFinal, filters.dataInicial, goalConfigs, monthlyBusinessDays, normalizedToday]);

  const kpisWithGoals = executiveData.kpis;

  const observedBusinessDays = useMemo(() => {
    if (!businessDayRange.length) return [];
    return businessDayRange.filter((date) => date <= normalizedToday);
  }, [businessDayRange, normalizedToday]);

  const fallbackTrendDays = useMemo(() => (
    apiData.trends ?? []
  ).map((entry) => (entry.data ?? entry.date ?? '').split('T')[0]).filter(Boolean), [apiData.trends]);

  const dailySeries = useMemo(() => {
    const timeline = (observedBusinessDays.length ? observedBusinessDays : fallbackTrendDays).filter(Boolean);
    if (!timeline.length) return {};

    return Object.keys(metricFieldByKpi).reduce((acc, kpiId) => {
      const metricKey = metricFieldByKpi[kpiId];
      const dailyGoal = executiveData.kpis.find((kpi) => kpi.id === kpiId)?.dailyGoal ?? 0;
      const baseKey = kpiId === 'sla_f'
        ? 'sla_finalizacao_base'
        : (kpiId === 'sla_r'
          ? 'sla_repasse_base'
          : (kpiId === 'ipc_corretor' ? 'ipc_corretores_ativos' : (kpiId === 'ipc_imobiliaria' ? 'ipc_imobiliarias_ativas' : null)));
      const baseSecondaryKey = (kpiId === 'ipc_corretor' || kpiId === 'ipc_imobiliaria')
        ? 'ipc_imobiliarias_ativas'
        : null;
      const supportMetricKey = (kpiId === 'ipc_corretor' || kpiId === 'ipc_imobiliaria')
        ? 'repasses'
        : (kpiId === 'propostas' ? 'propostas_aprovadas' : null);
      const supportMetricKey2 = kpiId === 'propostas' ? 'propostas_condicionadas' : null;
      const supportMetricKey3 = kpiId === 'propostas' ? 'propostas_reprovadas' : null;
      const supportMetricKey4 = kpiId === 'propostas' ? 'propostas_total' : null;
      acc[kpiId] = timeline.map((date) => {
        const record = trendLookup[date];
        const metricValue = record && metricKey ? record[metricKey] : null;
        const rawValue = metricValue == null ? 0 : Number(metricValue);
        return {
          date,
          label: formatShortDate(date),
          value: rawValue,
          target: dailyGoal,
          base: baseKey ? (Number(record?.[baseKey]) || 0) : 0,
          baseSecondary: baseSecondaryKey ? (Number(record?.[baseSecondaryKey]) || 0) : 0,
          supportValue: supportMetricKey ? (Number(record?.[supportMetricKey]) || 0) : 0,
          supportValue2: supportMetricKey2 ? (Number(record?.[supportMetricKey2]) || 0) : 0,
          supportValue3: supportMetricKey3 ? (Number(record?.[supportMetricKey3]) || 0) : 0,
          supportValue4: supportMetricKey4 ? (Number(record?.[supportMetricKey4]) || 0) : 0,
        };
      });
      return acc;
    }, {});
  }, [executiveData.kpis, fallbackTrendDays, observedBusinessDays, trendLookup]);

  const periodSeries = useMemo(() => {
    const timeline = (businessDayRange.length ? businessDayRange : Object.keys(trendLookup)).filter(Boolean);

    if (!timeline.length) return {};

    return Object.keys(metricFieldByKpi).reduce((acc, kpiId) => {
      const metricKey = metricFieldByKpi[kpiId];
      const kpiConfig = executiveData.kpis.find((kpi) => kpi.id === kpiId);
      const dailyGoal = kpiConfig?.dailyGoal ?? 0;
      const isCumulativeTarget = Boolean(kpiConfig?.isCumulativeTarget);
      const baseKey = kpiId === 'sla_f'
        ? 'sla_finalizacao_base'
        : (kpiId === 'sla_r'
          ? 'sla_repasse_base'
          : (kpiId === 'ipc_corretor' ? 'ipc_corretores_ativos' : (kpiId === 'ipc_imobiliaria' ? 'ipc_imobiliarias_ativas' : null)));
      const baseSecondaryKey = (kpiId === 'ipc_corretor' || kpiId === 'ipc_imobiliaria')
        ? 'ipc_imobiliarias_ativas'
        : null;
      const supportMetricKey = (kpiId === 'ipc_corretor' || kpiId === 'ipc_imobiliaria')
        ? 'repasses'
        : (kpiId === 'propostas' ? 'propostas_aprovadas' : null);
      const supportMetricKey2 = kpiId === 'propostas' ? 'propostas_condicionadas' : null;
      const supportMetricKey3 = kpiId === 'propostas' ? 'propostas_reprovadas' : null;
      const supportMetricKey4 = kpiId === 'propostas' ? 'propostas_total' : null;
      const previousTimeline = previousBusinessDayRange.length
        ? previousBusinessDayRange
        : Object.keys(previousTrendLookup).sort();
      acc[kpiId] = timeline.map((date, index) => {
        const record = trendLookup[date];
        const previousDate = previousTimeline[index];
        const previousRecord = previousDate ? previousTrendLookup[previousDate] : null;
        const metricValue = record && metricKey ? record[metricKey] : null;
        const previousMetricValue = previousRecord && metricKey ? previousRecord[metricKey] : null;
        const rawValue = metricValue == null ? null : Number(metricValue);
        const rawPreviousValue = previousMetricValue == null ? null : Number(previousMetricValue);
        const previousBaseValue = baseKey ? (Number(previousRecord?.[baseKey]) || 0) : 0;
        const previousBaseSecondaryValue = baseSecondaryKey ? (Number(previousRecord?.[baseSecondaryKey]) || 0) : 0;
        const previousSupportValue = supportMetricKey ? (Number(previousRecord?.[supportMetricKey]) || 0) : 0;
        const previousSupportValue2 = supportMetricKey2 ? (Number(previousRecord?.[supportMetricKey2]) || 0) : 0;
        const previousSupportValue3 = supportMetricKey3 ? (Number(previousRecord?.[supportMetricKey3]) || 0) : 0;
        const previousSupportValue4 = supportMetricKey4 ? (Number(previousRecord?.[supportMetricKey4]) || 0) : 0;
        const hasData = Number.isFinite(rawValue) && date <= normalizedToday;
        return {
          date,
          label: formatShortDate(date),
          businessDayIndex: index + 1,
          value: hasData ? rawValue : null,
          hasData,
          target: isCumulativeTarget
            ? Number((dailyGoal * (index + 1)).toFixed(2))
            : Number(dailyGoal),
          base: baseKey ? (Number(record?.[baseKey]) || 0) : 0,
          baseSecondary: baseSecondaryKey ? (Number(record?.[baseSecondaryKey]) || 0) : 0,
          supportValue: supportMetricKey ? (Number(record?.[supportMetricKey]) || 0) : 0,
          supportValue2: supportMetricKey2 ? (Number(record?.[supportMetricKey2]) || 0) : 0,
          supportValue3: supportMetricKey3 ? (Number(record?.[supportMetricKey3]) || 0) : 0,
          supportValue4: supportMetricKey4 ? (Number(record?.[supportMetricKey4]) || 0) : 0,
          previousBase: previousBaseValue,
          previousBaseSecondary: previousBaseSecondaryValue,
          previousSupportValue: previousSupportValue,
          previousSupportValue2,
          previousSupportValue3,
          previousSupportValue4,
          previousValue: Number.isFinite(rawPreviousValue) ? rawPreviousValue : null,
          previousDate,
        };
      });
      return acc;
    }, {});
  }, [businessDayRange, executiveData.kpis, normalizedToday, previousBusinessDayRange, previousTrendLookup, trendLookup]);

  const expandedKpi = executiveData.kpis.find((item) => item.id === expandedKpiId) ?? null;

  const analysisSeries = useMemo(() => ({
    daily: apiData.series?.daily ?? apiData.trends ?? [],
    monthly: apiData.series?.monthly ?? [],
    cumulativeDaily: apiData.series?.cumulativeDaily ?? [],
    cumulativeMonthly: apiData.series?.cumulativeMonthly ?? [],
    previousDaily: apiData.previousSeries?.daily ?? apiData.previousTrends ?? [],
    previousMonthly: apiData.previousSeries?.monthly ?? [],
    previousCumulativeDaily: apiData.previousSeries?.cumulativeDaily ?? [],
    previousCumulativeMonthly: apiData.previousSeries?.cumulativeMonthly ?? [],
    meta: apiData.seriesMeta ?? null,
  }), [apiData.previousSeries, apiData.previousTrends, apiData.series, apiData.seriesMeta, apiData.trends]);

  useEffect(() => {
    if (!expandedKpiId) return;

    let active = true;
    const loadBreakdown = async () => {
      setIsLoadingBreakdown(true);
      const queryParams = buildFilterParams(undefined, undefined, { kpi: expandedKpiId }).toString();

      try {
        if (expandedKpiId === 'propostas') {
          const statuses = ['pastas_aprovadas', 'pastas_condicionadas', 'pastas_reprovadas', 'pastas_com_respostas'];
          const responses = await Promise.all(
            statuses.map((status) => {
              const params = buildFilterParams(undefined, undefined, { kpi: status }).toString();
              return fetch(`/api/v1/dashboard/segmented/breakdown?${params}`);
            }),
          );
          const payloads = await Promise.all(responses.map((r) => (r.ok ? r.json() : { byAxis: {} })));
          if (!active) return;
          setKpiBreakdowns((current) => ({ ...current, [expandedKpiId]: payloads[0] }));
          setPropostasBreakdowns({
            aprovadas: payloads[0]?.byAxis ?? {},
            condicionadas: payloads[1]?.byAxis ?? {},
            reprovadas: payloads[2]?.byAxis ?? {},
            total: payloads[3]?.byAxis ?? {},
          });
          return;
        }

        const response = await fetch(`/api/v1/dashboard/segmented/breakdown?${queryParams}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        setKpiBreakdowns((current) => ({ ...current, [expandedKpiId]: data }));
        setPropostasBreakdowns(null);

        if (expandedKpiId === 'ipc_corretor' || expandedKpiId === 'ipc_imobiliaria') {
          const ipcResponse = await fetch(`/api/v1/dashboard/ipc-insights?${queryParams}`);
          if (ipcResponse.ok) {
            const ipcData = await ipcResponse.json();
            if (active) setIpcInsights(ipcData);
          }
        }
      } catch {
        if (!active) return;
        setKpiBreakdowns((current) => ({ ...current, [expandedKpiId]: { byAxis: {} } }));
        if (expandedKpiId === 'propostas') setPropostasBreakdowns(null);
      } finally {
        if (active) setIsLoadingBreakdown(false);
      }
    };

    loadBreakdown();
    return () => { active = false; };
  }, [expandedKpiId, filterQueryString, buildFilterParams]);

  useEffect(() => {
    if (expandedKpiId !== 'sla_r' && expandedKpiId !== 'sla_f') {
      setSlaRepasseInsights(null);
      return;
    }

    let active = true;
    const loadSlaRepasseInsights = async () => {
      setIsLoadingBreakdown(true);
      const queryParams = buildFilterParams().toString();

      try {
        const endpoint = expandedKpiId === 'sla_f'
          ? '/api/v1/dashboard/sla-finalizacao-insights'
          : '/api/v1/dashboard/sla-repasse-insights';
        const response = await fetch(`${endpoint}?${queryParams}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        setSlaRepasseInsights(data);
      } catch {
        if (!active) return;
        setSlaRepasseInsights(null);
      } finally {
        if (active) setIsLoadingBreakdown(false);
      }
    };

    loadSlaRepasseInsights();
    return () => { active = false; };
  }, [expandedKpiId, filterQueryString, buildFilterParams]);

  const handleToggleExpand = useCallback((kpiId) => {
    setExpandedKpiId((current) => {
      const next = current === kpiId ? null : kpiId;
      logger.info('dashboard:kpi', 'Toggle KPI focus', { kpiId, nextState: next ? 'expanded' : 'collapsed' });
      return next;
    });
  }, []);

  const handleClosePanel = useCallback(() => {
    setExpandedKpiId(null);
  }, []);

  const handleSaveGoal = useCallback((kpiId, value) => {
    saveGoalToConfig({
      kpi_id: kpiId,
      goal_value: value,
      period_type: 'monthly',
      hierarchy_level: 'all',
      hierarchy_value: '',
      target_type: 'absolute',
      business_days_aware: true,
    });
  }, [saveGoalToConfig]);

  return (
    <div className="dashboard">
      <header className="dashboard-header flex justify-between items-center w-full">
        <div>
          <h2 className="headline-sm" style={{ margin: 0 }}>Performance Comercial</h2>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="dashboard-corretor-link label-md">
            <LayoutDashboard size={15} />
            Painel inicial
          </Link>
          <SelectFilter
            id="dashboard-view-profile"
            label="Perfil"
            value={filters.perfilVisualizacao}
            options={filterOptions.perfilVisualizacao}
            onChange={(value) => setFilterValue('perfilVisualizacao', value)}
            className="dashboard-profile-selector"
          />
        </div>
      </header>

      <DashboardFilters />

      {/* Removed the large overlay loader in favor of individual skeleton loaders on the cards */}

      {lastFetchError && (
        <div className="dashboard-alert dashboard-alert-error">
          <strong>Erro ao atualizar o dashboard.</strong> {lastFetchError}
        </div>
      )}


      <section className={`executive-kpi-grid ${expandedKpiId ? 'has-focus' : ''}`}>
        {kpisWithGoals.map((kpi) => {
          const isDimmed = expandedKpiId && expandedKpiId !== kpi.id;
          const isActive = expandedKpiId === kpi.id;

          return (
            <div
              key={kpi.id}
              className={`executive-kpi-slot ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
            >
              <ExecutiveKpiCard
                kpi={kpi}
                isExpanded={isActive}
                onToggleExpand={() => handleToggleExpand(kpi.id)}
                goalOverride={goalConfigs.find((item) => item.kpi_id === kpi.id)?.goal_value}
                isLoading={isLoading}
                dailySeries={dailySeries[kpi.id] ?? []}
              />
            </div>
          );
        })}
      </section>

      {/* Removed temporal chart for a cleaner executive view */}

      {/* Focus Mode Overlay */}
      {expandedKpi && (
        <AnalysisPanel
          kpi={expandedKpi}
          onClose={handleClosePanel}
          dailySeries={periodSeries[expandedKpi.id] ?? []}
          series={analysisSeries}
          aggregatedByAxis={kpiBreakdowns[expandedKpiId]?.byAxis}
          propostasBreakdowns={propostasBreakdowns}
          slaRepasseInsights={slaRepasseInsights}
          ipcInsights={ipcInsights}
          onSaveGoal={handleSaveGoal}
          period={analysisPeriod}
          isLoadingBreakdown={isLoadingBreakdown}
        />
      )}

      {/* Goal configuration moved to /settings (GoalSettings page) */}
    </div>
  );
};

export default Dashboard;
