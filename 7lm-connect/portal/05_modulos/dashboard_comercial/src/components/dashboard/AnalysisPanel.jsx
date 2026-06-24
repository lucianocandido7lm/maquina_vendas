import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar,
  ResponsiveContainer, CartesianGrid, ComposedChart, Line, LabelList, ReferenceDot
} from 'recharts';
import { X, ExternalLink, Filter, TrendingUp, TrendingDown, UserRound, Building2 } from 'lucide-react';
import { useCommercialFilters } from '../../hooks/useCommercialFilters';
import {
  ANALYSIS_VIEWS,
  CUMULATIVE_GRANULARITIES,
  getChartGranularityPolicy,
} from '../../utils/chartGranularity';
import './AnalysisPanel.css';

/* ---- Helpers ---- */
const TrendIndicator = ({ value }) => {
  if (value == null || isNaN(value)) return null;
  const isPositive = value >= 0;
  const color = isPositive ? '#2E7D32' : '#ba1a1a';
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color, fontSize: '0.7rem', fontWeight: 700 }}>
      <Icon size={12} />
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
};

const fmt = (value, unit = '') => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const numericValue = Number(value);
  if (unit === 'ratio') return numericValue.toFixed(2);
  const suffix = unit && unit !== 'total' && unit !== 'un' ? ` ${unit}` : '';
  if (!Number.isInteger(numericValue)) return `${numericValue.toFixed(unit === 'dias' ? 1 : 2)}${suffix}`;
  return `${new Intl.NumberFormat('pt-BR').format(numericValue)}${suffix}`;
};

const fmtDataLabel = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '';
  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? `${numericValue}` : numericValue.toFixed(1);
};

const LineValueLabel = ({ x, y, value, index, prefix = '', fill = DATA_LABEL_COLOR, dy = -8, showEvery = 1 }) => {
  if (value == null || !Number.isFinite(Number(value))) return null;
  if (showEvery > 1 && index % showEvery !== 0) return null;
  const label = prefix ? `${prefix} ${fmtDataLabel(value)}` : fmtDataLabel(value);
  return (
    <text x={x} y={y + dy} textAnchor="middle" fill={fill} fontSize={10} fontWeight={800}>
      {label}
    </text>
  );
};

const getNiceStep = (value) => {
  const raw = Math.max(1, Number(value) || 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

const buildYAxisTicks = (maxValue, targetTickCount = 4) => {
  const max = Math.max(0, Number(maxValue) || 0);
  const step = getNiceStep(max / Math.max(targetTickCount, 1));
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let value = 0; value <= top; value += step) {
    ticks.push(value);
  }
  return ticks.length >= 2 ? ticks : [0, step];
};

const fmtSlaBreakdown = (item, unit = 'dias') => {
  const sla = Number(item?.value) || 0;
  const count = Number(item?.case_count ?? item?.count ?? item?.total_count ?? 0);
  const casesLabel = count === 1 ? '1 caso' : `${count} casos`;
  return `${sla.toFixed(1)} ${unit} (${casesLabel})`;
};

const fmtDate = (value) => {
  if (!value) return '—';
  const normalized = String(value).trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    const [year, month, day] = normalized.split('-');
    if (!year || !month || !day) return normalized;
    return `${String(day).slice(0, 2)}/${month}/${year}`;
  }
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const year = parsed.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const toISODateKey = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = String(value).trim();
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  const maybeIso = normalized.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(maybeIso) ? maybeIso : null;
};

/* ---- Chart data generators ---- */
const generateBreakdownData = (aggregatedByAxis = {}) => {
  const regionItems = aggregatedByAxis.regiaoOperacao ?? aggregatedByAxis.cidade ?? [];
  const total = regionItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return regionItems.map((item) => ({
    name: item.label,
    value: Number(item.value) || 0,
    case_count: Number(item.case_count || item.count) || 0,
    share: total > 0 ? Math.round(((Number(item.value) || 0) / total) * 100) : 0,
  }));
};

/* ---- Tooltip ---- */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="analysis-tooltip">
      <p className="analysis-tooltip-label">{label}</p>
      {payload.map((entry, i) =>
        entry.value != null ? (
          <div key={i} className="analysis-tooltip-row">
            <span className="analysis-tooltip-name">
              <span className="analysis-tooltip-dot" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="analysis-tooltip-val">{entry.value}</span>
          </div>
        ) : null,
      )}
    </div>
  );
};

const STATUS_LABELS = { good: 'Acima', attention: 'Atenção', risk: 'Risco' };

const CHART_BLUE = '#0066ff';   /* High Contrast Blue (Operation) */
const CHART_TEAL = '#00d2ff';   /* Premium Cyan (Broker) */
const CHART_ORANGE = '#80b3ff'; /* Soft Pastel Blue (SDR) */
const CHART_GRAY = '#9ca8b8';
const CHART_PREVIOUS = 'rgba(0, 102, 255, 0.15)';

const DATA_LABEL_COLOR = '#0047b3';
const getDataLabelProps = (pointCount = 0) => ({
  fill: DATA_LABEL_COLOR,
  fontSize: pointCount > 24 ? 8 : (pointCount > 14 ? 9 : 11),
  fontWeight: 800,
  angle: pointCount > 24 ? -45 : 0,
  dx: pointCount > 24 ? -5 : 0,
  dy: pointCount > 24 ? -3 : -2,
});
const ADDITIONAL_AXIS_CONFIG = [
  // Visão do Corretor (cadastro de funcionários)
  { title: 'Por Corretor', key: 'corretorAtivo', scope: 'broker' },
  { title: 'Por Gestor do Corretor', key: 'gestorCorretor', scope: 'broker' },
  { title: 'Por Coordenador do Corretor', key: 'coordenadorCorretor', scope: 'broker' },
  { title: 'Por Região do Corretor', key: 'regiaoCorretor', scope: 'broker' },
  { title: 'Por Imobiliária do Corretor', key: 'imobiliariaCorretor', scope: 'broker' },

  // Visão do SDR (cadastro de funcionários)
  { title: 'Por SDR', key: 'sdrAtivo', scope: 'sdr' },
  { title: 'Por Gestor do SDR', key: 'gestorSdr', scope: 'sdr' },
  { title: 'Por Coordenador do SDR', key: 'coordenadorSdr', scope: 'sdr' },
  { title: 'Por Região do SDR', key: 'regiaoSdr', scope: 'sdr' },
  { title: 'Por Imobiliária do SDR', key: 'imobiliariaSdr', scope: 'sdr' },

  // Visão da Operação (Fato Comercial)
  { title: 'Por Origem da Operação', key: 'origem', scope: 'operation' },
  { title: 'Por Região da Operação', key: 'regiaoOperacao', scope: 'operation' },
  { title: 'Por Imobiliária da Operação', key: 'imobiliariaOperacao', scope: 'operation' },
  { title: 'Por Empreendimento da Operação', key: 'empreendimento', scope: 'operation' },
  { title: 'Por Corretor da Operação', key: 'corretorOperacao', scope: 'operation' },
  { title: 'Por SDR da Operação', key: 'sdrOperacao', scope: 'operation' },
];

const IPC_AXIS_CONFIG = [
  { title: 'Por Corretor', key: 'corretorAtivo', scope: 'broker' },
  { title: 'Por Imobiliária do Corretor', key: 'imobiliariaCorretor', scope: 'broker' },
  { title: 'Por Origem da Operação', key: 'origem', scope: 'operation' },
  { title: 'Por Região da Operação', key: 'regiaoOperacao', scope: 'operation' },
  { title: 'Por Empreendimento da Operação', key: 'empreendimento', scope: 'operation' },
];

const AXIS_SCOPE_LABELS = {
  operation: 'Operação',
  broker: 'Corretor',
  sdr: 'SDR',
};

const getAxisScope = (axis = {}) => axis.scope ?? (
  axis.key?.toLowerCase().includes('sdr')
    ? 'sdr'
    : (axis.key?.toLowerCase().includes('corretor') || axis.key === 'imobiliaria' || axis.key === 'corretor'
      ? 'broker'
      : 'operation')
);

const metricFieldByKpi = {
  leads: 'leads',
  visitas: 'visitas',
  propostas: 'propostas_total',
  cancelamentos: 'cancelamentos',
  distratos: 'distratos',
  vendas: 'vendas',
  repasses: 'repasses',
  sla_f: 'sla_finalizacao',
  sla_r: 'sla_repasse',
  ipc_corretor: 'ipc_corretor',
  ipc_imobiliaria: 'ipc_imobiliaria',
};

const getSeriesLabel = (entry, granularity = 'day') => {
  if (entry?.label) return entry.label;
  if (granularity === 'month' || granularity === 'quarter' || granularity === 'year') {
    const period = entry?.period ?? entry?.data ?? entry?.date;
    if (granularity === 'quarter' && /^\d{4}-Q[1-4]$/.test(String(period))) {
      const [year, quarter] = String(period).split('-Q');
      return `T${quarter}/${String(year).slice(2)}`;
    }
    if (granularity === 'year' && /^\d{4}$/.test(String(period))) return String(period);
    if (/^\d{4}-\d{2}$/.test(String(period))) {
      const [year, month] = String(period).split('-');
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '');
    }
  }
  return fmtDate(entry?.data ?? entry?.date).slice(0, 5);
};

const normalizeSeriesEntries = (items = [], previousItems = [], kpi = {}, granularity = 'day') => {
  const metricKey = metricFieldByKpi[kpi.id] ?? kpi.id;
  return items.map((entry, index) => {
    const previous = previousItems[index] ?? null;
    const date = entry.data ?? entry.date ?? entry.period ?? `${index + 1}`;
    const previousDate = previous?.data ?? previous?.date ?? previous?.period ?? null;
    const value = entry[metricKey];
    const previousValue = previous?.[metricKey];
    const target = granularity === 'month' && kpi.isCumulativeTarget
      ? (Number(kpi.monthlyTarget) || Number(kpi.target) || 0)
      : (granularity === 'month' ? Number(kpi.target) || 0 : Number(kpi.dailyGoal ?? kpi.target ?? 0) || 0);

    return {
      date,
      label: getSeriesLabel(entry, granularity),
      businessDayIndex: index + 1,
      value: value == null ? null : Number(value),
      hasData: value != null,
      target,
      base: kpi.id === 'sla_f'
        ? Number(entry.sla_finalizacao_base) || 0
        : (kpi.id === 'sla_r'
          ? Number(entry.sla_repasse_base) || 0
          : (kpi.id === 'ipc_imobiliaria' ? Number(entry.ipc_imobiliarias_ativas) || 0 : Number(entry.ipc_corretores_ativos) || 0)),
      baseSecondary: Number(entry.ipc_imobiliarias_ativas) || 0,
      supportValue: kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria'
        ? Number(entry.ipc_repasses ?? entry.repasses) || 0
        : Number(entry.propostas_aprovadas) || 0,
      supportValue2: Number(entry.propostas_condicionadas) || 0,
      supportValue3: Number(entry.propostas_reprovadas) || 0,
      supportValue4: Number(entry.propostas_total) || 0,
      previousValue: previousValue == null ? null : Number(previousValue),
      previousBase: kpi.id === 'sla_f'
        ? Number(previous?.sla_finalizacao_base) || 0
        : (kpi.id === 'sla_r'
          ? Number(previous?.sla_repasse_base) || 0
          : (kpi.id === 'ipc_imobiliaria' ? Number(previous?.ipc_imobiliarias_ativas) || 0 : Number(previous?.ipc_corretores_ativos) || 0)),
      previousBaseSecondary: Number(previous?.ipc_imobiliarias_ativas) || 0,
      previousSupportValue: kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria'
        ? Number(previous?.ipc_repasses ?? previous?.repasses) || 0
        : Number(previous?.propostas_aprovadas) || 0,
      previousSupportValue2: Number(previous?.propostas_condicionadas) || 0,
      previousSupportValue3: Number(previous?.propostas_reprovadas) || 0,
      previousSupportValue4: Number(previous?.propostas_total) || 0,
      previousDate,
    };
  });
};

const getWeekKey = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
};

const getBucketKey = (entry, bucket) => {
  const dateKey = String(entry.date ?? entry.data ?? entry.period ?? '');
  if (bucket === 'week') return getWeekKey(dateKey);
  if (bucket === 'quarter') {
    const year = dateKey.slice(0, 4);
    const month = Number(dateKey.slice(5, 7));
    if (!year || !month) return null;
    return `${year}-Q${Math.ceil(month / 3)}`;
  }
  if (bucket === 'year') return dateKey.slice(0, 4);
  return dateKey;
};

const formatBucketLabel = (key, bucket) => {
  if (!key) return '';
  if (bucket === 'week') return `Sem. ${fmtDate(key).slice(0, 5)}`;
  if (bucket === 'quarter') return getSeriesLabel({ period: key }, 'quarter');
  if (bucket === 'year') return key;
  return getSeriesLabel({ period: key }, 'month');
};

const getBucketTarget = (kpi = {}, bucket, itemCount = 1, targetSum = 0) => {
  if (kpi.id === 'sla_f' || kpi.id === 'sla_r' || kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
    return Number(kpi.target ?? 0) || 0;
  }
  if (bucket === 'week') return Number(targetSum) || (Number(kpi.dailyGoal) || 0) * itemCount;
  if (bucket === 'quarter') return (Number(kpi.monthlyTarget) || 0) * 3;
  if (bucket === 'year') return (Number(kpi.monthlyTarget) || 0) * 12;
  return Number(kpi.monthlyTarget ?? kpi.target ?? 0) || 0;
};

const aggregateEntriesByBucket = (entries = [], kpi = {}, bucket = 'month') => {
  if (bucket === 'day') return entries;
  const groups = new Map();
  entries.forEach((entry) => {
    const key = getBucketKey(entry, bucket);
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, {
        date: key,
        label: formatBucketLabel(key, bucket),
        businessDayIndex: groups.size + 1,
        value: 0,
        previousValue: 0,
        base: 0,
        previousBase: 0,
        baseSecondary: 0,
        previousBaseSecondary: 0,
        supportValue: 0,
        supportValue2: 0,
        supportValue3: 0,
        supportValue4: 0,
        previousSupportValue: 0,
        previousSupportValue2: 0,
        previousSupportValue3: 0,
        previousSupportValue4: 0,
        targetSum: 0,
        currentCount: 0,
        previousCount: 0,
        weightedValueSum: 0,
        previousWeightedValueSum: 0,
      });
    }

    const target = groups.get(key);
    target.targetSum += Number(entry.target) || 0;

    if (kpi.id === 'sla_f' || kpi.id === 'sla_r') {
      const base = Number(entry.base) || 0;
      const previousBase = Number(entry.previousBase) || 0;
      if (entry.value != null && base > 0) {
        target.weightedValueSum += Number(entry.value) * base;
        target.base += base;
        target.currentCount += 1;
      }
      if (entry.previousValue != null && previousBase > 0) {
        target.previousWeightedValueSum += Number(entry.previousValue) * previousBase;
        target.previousBase += previousBase;
        target.previousCount += 1;
      }
      return;
    }

    if (kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
      target.supportValue += Number(entry.supportValue) || 0;
      target.previousSupportValue += Number(entry.previousSupportValue) || 0;
      if (bucket === 'quarter' || bucket === 'year') {
        target.base += Number(entry.base) || 0;
        target.previousBase += Number(entry.previousBase) || 0;
        target.baseSecondary += Number(entry.baseSecondary) || 0;
        target.previousBaseSecondary += Number(entry.previousBaseSecondary) || 0;
      } else {
        target.base = Number(entry.base) || target.base;
        target.previousBase = Number(entry.previousBase) || target.previousBase;
        target.baseSecondary = Number(entry.baseSecondary) || target.baseSecondary;
        target.previousBaseSecondary = Number(entry.previousBaseSecondary) || target.previousBaseSecondary;
      }
      if (entry.value != null) target.currentCount += 1;
      if (entry.previousValue != null) target.previousCount += 1;
      return;
    }

    if (entry.value != null) {
      target.value += Number(entry.value) || 0;
      target.currentCount += 1;
    }
    if (entry.previousValue != null) {
      target.previousValue += Number(entry.previousValue) || 0;
      target.previousCount += 1;
    }
    target.supportValue += Number(entry.supportValue) || 0;
    target.supportValue2 += Number(entry.supportValue2) || 0;
    target.supportValue3 += Number(entry.supportValue3) || 0;
    target.supportValue4 += Number(entry.supportValue4) || 0;
    target.previousSupportValue += Number(entry.previousSupportValue) || 0;
    target.previousSupportValue2 += Number(entry.previousSupportValue2) || 0;
    target.previousSupportValue3 += Number(entry.previousSupportValue3) || 0;
    target.previousSupportValue4 += Number(entry.previousSupportValue4) || 0;
  });

  return Array.from(groups.values()).map((entry, index) => {
    const target = getBucketTarget(kpi, bucket, Math.max(entry.currentCount, entry.previousCount, 1), entry.targetSum);
    if (kpi.id === 'sla_f' || kpi.id === 'sla_r') {
      return {
        ...entry,
        businessDayIndex: index + 1,
        value: entry.base > 0 ? Number((entry.weightedValueSum / entry.base).toFixed(2)) : null,
        previousValue: entry.previousBase > 0 ? Number((entry.previousWeightedValueSum / entry.previousBase).toFixed(2)) : null,
        hasData: entry.base > 0,
        target,
      };
    }
    if (kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
      return {
        ...entry,
        businessDayIndex: index + 1,
        value: entry.base > 0 ? Number((entry.supportValue / entry.base).toFixed(2)) : null,
        previousValue: entry.previousBase > 0 ? Number((entry.previousSupportValue / entry.previousBase).toFixed(2)) : null,
        hasData: entry.currentCount > 0,
        target,
      };
    }
    return {
      ...entry,
      businessDayIndex: index + 1,
      value: entry.currentCount > 0 ? entry.value : null,
      previousValue: entry.previousCount > 0 ? entry.previousValue : null,
      hasData: entry.currentCount > 0,
      target,
    };
  });
};

const buildMonthKeysForPeriod = (period = {}) => {
  const start = toISODateKey(period?.startDate);
  const end = toISODateKey(period?.endDate);
  if (!start || !end || start > end) return [];

  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const endMonth = end.slice(0, 7);
  const keys = [];

  while (!Number.isNaN(cursor.getTime())) {
    const key = cursor.toISOString().slice(0, 7);
    keys.push(key);
    if (key >= endMonth) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
};

const normalizeMonthlyComparisonEntries = (items = [], previousItems = [], kpi = {}, period = {}) => {
  const monthKey = (entry) => {
    const key = String(entry?.period ?? entry?.data ?? entry?.date ?? '');
    return /^\d{4}-\d{2}/.test(key) ? key.slice(0, 7) : null;
  };
  const currentByMonth = new Map();
  items.forEach((entry) => {
    const month = monthKey(entry);
    if (month) currentByMonth.set(month, entry);
  });

  const previousSorted = [...previousItems]
    .filter((entry) => monthKey(entry))
    .sort((a, b) => monthKey(a).localeCompare(monthKey(b)));

  const monthsFromPeriod = buildMonthKeysForPeriod(period);
  const months = (monthsFromPeriod.length
    ? monthsFromPeriod
    : (currentByMonth.size
      ? Array.from(currentByMonth.keys())
      : previousSorted.map((entry) => monthKey(entry))))
    .sort((a, b) => a.localeCompare(b));

  return months.map((month, index) => {
    const current = currentByMonth.get(month) ?? null;
    const previous = previousSorted[index] ?? null;
    const normalized = normalizeSeriesEntries(
      current ? [current] : [{ data: month, period: month, label: getSeriesLabel({ period: month }, 'month') }],
      previous ? [previous] : [],
      kpi,
      'month',
    )[0];

    return {
      ...normalized,
      businessDayIndex: index + 1,
      value: current ? normalized.value : null,
      hasData: Boolean(current),
      target: Number(kpi.monthlyTarget ?? kpi.target ?? 0) || 0,
    };
  });
};

const buildCumulativeEntries = (entries = [], kpi = {}, granularity = 'day') => {
  if (!entries.length) return [];

  if (kpi.id === 'sla_f' || kpi.id === 'sla_r') {
    let weightedSum = 0;
    let caseBase = 0;
    let previousWeightedSum = 0;
    let previousCaseBase = 0;
    return entries.map((entry) => {
      const base = Number(entry.base) || 0;
      const previousBase = Number(entry.previousBase) || 0;
      if (entry.value != null && base > 0) {
        weightedSum += Number(entry.value) * base;
        caseBase += base;
      }
      if (entry.previousValue != null && previousBase > 0) {
        previousWeightedSum += Number(entry.previousValue) * previousBase;
        previousCaseBase += previousBase;
      }
      return {
        ...entry,
        value: entry.value != null && caseBase > 0 ? Number((weightedSum / caseBase).toFixed(2)) : null,
        previousValue: previousCaseBase > 0 ? Number((previousWeightedSum / previousCaseBase).toFixed(2)) : null,
        base: caseBase,
        previousBase: previousCaseBase,
      };
    });
  }

  if (kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
    let repasses = 0;
    let previousRepasses = 0;
    let accumulatedBase = 0;
    let accumulatedPreviousBase = 0;
    let accumulatedBaseSecondary = 0;
    let accumulatedPreviousBaseSecondary = 0;
    const baseByMonth = new Map();
    const previousBaseByMonth = new Map();
    const baseSecondaryByMonth = new Map();
    const previousBaseSecondaryByMonth = new Map();

    const addBase = (entry, field, accumulator, map) => {
      const value = Number(entry[field]) || 0;
      if (granularity === 'day') {
        const month = String(entry.date ?? entry.data ?? entry.period ?? '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) return accumulator;
        const previousValue = Number(map.get(month)) || 0;
        if (value > previousValue) {
          map.set(month, value);
          return accumulator + (value - previousValue);
        }
        return accumulator;
      }
      return accumulator + value;
    };

    return entries.map((entry) => {
      repasses += Number(entry.supportValue) || 0;
      previousRepasses += Number(entry.previousSupportValue) || 0;
      accumulatedBase = addBase(entry, 'base', accumulatedBase, baseByMonth);
      accumulatedPreviousBase = addBase(entry, 'previousBase', accumulatedPreviousBase, previousBaseByMonth);
      accumulatedBaseSecondary = addBase(entry, 'baseSecondary', accumulatedBaseSecondary, baseSecondaryByMonth);
      accumulatedPreviousBaseSecondary = addBase(entry, 'previousBaseSecondary', accumulatedPreviousBaseSecondary, previousBaseSecondaryByMonth);
      return {
        ...entry,
        isCumulativePoint: true,
        value: entry.value != null && accumulatedBase > 0 ? Number((repasses / accumulatedBase).toFixed(2)) : null,
        previousValue: accumulatedPreviousBase > 0 ? Number((previousRepasses / accumulatedPreviousBase).toFixed(2)) : null,
        ipcImobiliariaValue: entry.value != null && accumulatedBaseSecondary > 0 ? Number((repasses / accumulatedBaseSecondary).toFixed(2)) : null,
        previousIpcImobiliariaValue: accumulatedPreviousBaseSecondary > 0 ? Number((previousRepasses / accumulatedPreviousBaseSecondary).toFixed(2)) : null,
        base: accumulatedBase,
        previousBase: accumulatedPreviousBase,
        baseSecondary: accumulatedBaseSecondary,
        previousBaseSecondary: accumulatedPreviousBaseSecondary,
        supportValue: repasses,
        previousSupportValue: previousRepasses,
      };
    });
  }

  let value = 0;
  let previousValue = 0;
  let aprovadas = 0;
  let condicionadas = 0;
  let reprovadas = 0;
  let total = 0;
  return entries.map((entry) => {
    value += Number(entry.value) || 0;
    previousValue += Number(entry.previousValue) || 0;
    aprovadas += Number(entry.supportValue) || 0;
    condicionadas += Number(entry.supportValue2) || 0;
    reprovadas += Number(entry.supportValue3) || 0;
    total += Number(entry.supportValue4) || 0;
    return {
      ...entry,
      value: entry.value == null ? null : value,
      previousValue,
      supportValue: aprovadas,
      supportValue2: condicionadas,
      supportValue3: reprovadas,
      supportValue4: total,
      cumulativeActual: value,
    };
  });
};

const isRateKpi = (kpi = {}) => ['sla_f', 'sla_r', 'ipc', 'ipc_corretor', 'ipc_imobiliaria'].includes(kpi.id);

const buildCumulativeChartData = (entries = [], kpi = {}, period = {}, granularity = 'day') => {
  if (!entries.length) return { rows: [], stats: null };

  const cumulativeEntries = buildCumulativeEntries(entries, kpi, granularity);
  const observedEntries = entries.filter((entry) => entry.value != null);
  const observedCount = observedEntries.length;
  const lastObservedIndex = entries.reduce((last, entry, index) => (entry.value != null ? index : last), -1);
  const isRate = isRateKpi(kpi);
  const isPropostas = kpi.id === 'propostas';
  const totalSlots = granularity === 'month'
    ? Math.max(entries.length, 12)
    : (granularity === 'quarter'
      ? Math.max(entries.length, 4)
      : (granularity === 'year' ? entries.length : Math.max(Number(period?.totalBusinessDays) || entries.length, entries.length)));
  const rawActualTotal = observedEntries.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
  const avgIncrement = observedCount > 0 ? rawActualTotal / observedCount : 0;
  const averageAprovadas = observedCount > 0
    ? observedEntries.reduce((sum, entry) => sum + (Number(entry.supportValue) || 0), 0) / observedCount
    : 0;
  const averageCondicionadas = observedCount > 0
    ? observedEntries.reduce((sum, entry) => sum + (Number(entry.supportValue2) || 0), 0) / observedCount
    : 0;
  const averageReprovadas = observedCount > 0
    ? observedEntries.reduce((sum, entry) => sum + (Number(entry.supportValue3) || 0), 0) / observedCount
    : 0;
  const averageTotal = observedCount > 0
    ? observedEntries.reduce((sum, entry) => sum + (Number(entry.supportValue4) || 0), 0) / observedCount
    : 0;

  const rows = cumulativeEntries.map((entry, index) => {
    const hasActual = index <= lastObservedIndex && entry.value != null;
    const elapsed = entry.businessDayIndex ?? index + 1;
    const targetStep = granularity === 'month'
      ? (Number(kpi.monthlyTarget) || (Number(kpi.target) > 0 ? Number(kpi.target) / 12 : 0))
      : (Number(kpi.dailyGoal) || 0);
    const meta = kpi.isCumulativeTarget
      ? Number((targetStep * elapsed).toFixed(2))
      : Number(kpi.target ?? entry.target ?? 0);

    let forecast = null;
    let propostasAprovadasForecast = null;
    let propostasCondicionadasForecast = null;
    let propostasReprovadasForecast = null;
    let propostasTotalForecast = null;

    if (!isRate && observedCount > 0 && index >= lastObservedIndex) {
      const extraSteps = Math.max(0, index - lastObservedIndex);
      const lastActual = lastObservedIndex >= 0 ? Number(cumulativeEntries[lastObservedIndex]?.value) || 0 : 0;
      forecast = Number((lastActual + avgIncrement * extraSteps).toFixed(2));

      if (isPropostas) {
        const last = cumulativeEntries[lastObservedIndex] ?? {};
        propostasAprovadasForecast = Number(((Number(last.supportValue) || 0) + averageAprovadas * extraSteps).toFixed(2));
        propostasCondicionadasForecast = Number(((Number(last.supportValue2) || 0) + averageCondicionadas * extraSteps).toFixed(2));
        propostasReprovadasForecast = Number(((Number(last.supportValue3) || 0) + averageReprovadas * extraSteps).toFixed(2));
        propostasTotalForecast = Number(((Number(last.supportValue4) || 0) + averageTotal * extraSteps).toFixed(2));
      }
    }

    return {
      day: entry.label,
      Realizado: hasActual ? Number(entry.value) : null,
      RealizadoDia: hasActual ? Number(entry.value) : null,
      Anterior: entry.previousValue == null ? null : Number(entry.previousValue),
      Meta: meta,
      Forecast: forecast,
      VolumeDia: Number(entry.base) || 0,
      VolumeAnteriorDia: Number(entry.previousBase) || 0,
      RepassesDia: Number(entry.supportValue) || 0,
      RepassesAcumulado: Number(entry.supportValue) || 0,
      IpcImobiliaria: entry.ipcImobiliariaValue == null ? null : Number(entry.ipcImobiliariaValue),
      IpcImobiliariaAnterior: entry.previousIpcImobiliariaValue == null ? null : Number(entry.previousIpcImobiliariaValue),
      PropostasAprovadas: hasActual ? Number(entry.supportValue) || 0 : null,
      PropostasCondicionadas: hasActual ? Number(entry.supportValue2) || 0 : null,
      PropostasReprovadas: hasActual ? Number(entry.supportValue3) || 0 : null,
      PropostasTotal: hasActual ? Number(entry.supportValue4) || 0 : null,
      PropostasAprovadasForecast: propostasAprovadasForecast,
      PropostasCondicionadasForecast: propostasCondicionadasForecast,
      PropostasReprovadasForecast: propostasReprovadasForecast,
      PropostasTotalForecast: propostasTotalForecast,
    };
  });

  return {
    rows,
    stats: granularity === 'month' && !isRate
      ? {
        observedMonths: observedCount,
        averageMonthly: Number(avgIncrement.toFixed(2)),
        projectedYearEnd: Number((avgIncrement * totalSlots).toFixed(2)),
      }
      : null,
  };
};

const aggregateEntriesByMonth = (entries = [], kpi = {}) => {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = String(entry.date ?? '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    if (!groups.has(key)) {
      groups.set(key, {
        ...entry,
        date: key,
        label: getSeriesLabel({ period: key }, 'month'),
        value: 0,
        previousValue: 0,
        base: 0,
        previousBase: 0,
        baseSecondary: 0,
        previousBaseSecondary: 0,
        supportValue: 0,
        supportValue2: 0,
        supportValue3: 0,
        supportValue4: 0,
        previousSupportValue: 0,
        previousSupportValue2: 0,
        previousSupportValue3: 0,
        previousSupportValue4: 0,
        weightedValueSum: 0,
        previousWeightedValueSum: 0,
      });
    }
    const target = groups.get(key);
    if (kpi.id === 'sla_f' || kpi.id === 'sla_r') {
      const base = Number(entry.base) || 0;
      const previousBase = Number(entry.previousBase) || 0;
      target.weightedValueSum += (Number(entry.value) || 0) * base;
      target.previousWeightedValueSum += (Number(entry.previousValue) || 0) * previousBase;
      target.base += base;
      target.previousBase += previousBase;
    } else if (kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
      target.supportValue += Number(entry.supportValue) || 0;
      target.previousSupportValue += Number(entry.previousSupportValue) || 0;
      target.base = Number(entry.base) || target.base;
      target.previousBase = Number(entry.previousBase) || target.previousBase;
      target.baseSecondary = Number(entry.baseSecondary) || target.baseSecondary;
      target.previousBaseSecondary = Number(entry.previousBaseSecondary) || target.previousBaseSecondary;
    } else {
      target.value += Number(entry.value) || 0;
      target.previousValue += Number(entry.previousValue) || 0;
      target.supportValue += Number(entry.supportValue) || 0;
      target.supportValue2 += Number(entry.supportValue2) || 0;
      target.supportValue3 += Number(entry.supportValue3) || 0;
      target.supportValue4 += Number(entry.supportValue4) || 0;
      target.previousSupportValue += Number(entry.previousSupportValue) || 0;
      target.previousSupportValue2 += Number(entry.previousSupportValue2) || 0;
      target.previousSupportValue3 += Number(entry.previousSupportValue3) || 0;
      target.previousSupportValue4 += Number(entry.previousSupportValue4) || 0;
    }
  });

  return Array.from(groups.values()).map((entry, index) => {
    if (kpi.id === 'sla_f' || kpi.id === 'sla_r') {
      return {
        ...entry,
        businessDayIndex: index + 1,
        value: entry.base > 0 ? Number((entry.weightedValueSum / entry.base).toFixed(2)) : null,
        previousValue: entry.previousBase > 0 ? Number((entry.previousWeightedValueSum / entry.previousBase).toFixed(2)) : null,
      };
    }
    if (kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria') {
      return {
        ...entry,
        businessDayIndex: index + 1,
        value: entry.base > 0 ? Number((entry.supportValue / entry.base).toFixed(2)) : null,
        previousValue: entry.previousBase > 0 ? Number((entry.previousSupportValue / entry.previousBase).toFixed(2)) : null,
      };
    }
    return { ...entry, businessDayIndex: index + 1 };
  });
};

const buildDailySeries = (entries = [], kpi) => {
  const meta = kpi.isCumulativeTarget ? (kpi.dailyGoal || 0) : (kpi.target || 0);
  return entries.map((entry) => {
    const hasEntryData = entry.hasData !== false && entry.value != null;
    const isObserved = hasEntryData;
    const repasses = Number(entry.supportValue ?? 0);
    const corretores = Number(entry.base ?? 0);
    const imobiliarias = Number(entry.baseSecondary ?? 0);
    return {
      day: entry.label,
      date: entry.date,
      RealizadoDia: hasEntryData ? Number(entry.value) : null,
      PropostasAprovadasDia: isObserved ? Number(entry.supportValue ?? 0) : null,
      AnteriorDia: entry.previousValue != null ? Number(entry.previousValue) : 0,
      AnteriorSlaDia: entry.previousValue != null ? Number(entry.previousValue) : null,
      MetaDia: Number((Number(entry.target ?? meta) || 0).toFixed(2)),
      BaseDia: corretores,
      BaseAnteriorDia: Number(entry.previousBase ?? 0),
      BaseSecundariaDia: imobiliarias,
      ApoioDia: repasses,
      ApoioAnteriorDia: Number(entry.previousSupportValue ?? 0),
      PropostasCondicionadasDia: isObserved ? Number(entry.supportValue2 ?? 0) : null,
      PropostasReprovadasDia: isObserved ? Number(entry.supportValue3 ?? 0) : null,
      PropostasTotalDia: isObserved ? Number(entry.supportValue4 ?? 0) : null,
      IpcCorretorDia: Number.isFinite(Number(entry.value))
        ? Number(entry.value)
        : (corretores > 0 ? Number((repasses / corretores).toFixed(2)) : null),
      IpcImobiliariaDia: imobiliarias > 0
        ? Number((repasses / imobiliarias).toFixed(2))
        : (kpi.id === 'ipc_imobiliaria' && Number.isFinite(Number(entry.value)) ? Number(entry.value) : null),
    };
  });
};

const normalizeIpcRanking = (items = []) => items
  .map((item) => ({
    ...item,
    label: item?.label ?? item?.name ?? item?.corretor ?? item?.imobiliaria ?? 'Sem informação',
    value: Number(item?.value) || 0,
    base: Number(item?.base) || 0,
    ipc: Number(item?.ipc) || 0,
    share: Number(item?.share) || 0,
  }));

const BreakdownLoadingRows = ({ rows = 5 }) => (
  <div className="analysis-breakdown-loading" aria-label="Carregando dados internos">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="analysis-breakdown-loading-row">
        <span className="analysis-breakdown-loading-line is-label" />
        <span className="analysis-breakdown-loading-line is-value" />
        <span className="analysis-breakdown-loading-track" />
      </div>
    ))}
  </div>
);

const VIEW_CONFIG = {
  [ANALYSIS_VIEWS.DAILY]: { label: 'Realizado por Dia', bucket: 'day', grainLabel: 'dia' },
  [ANALYSIS_VIEWS.WEEKLY]: { label: 'Realizado por Semana', bucket: 'week', grainLabel: 'semana' },
  [ANALYSIS_VIEWS.MONTHLY]: { label: 'Realizado por Mês', bucket: 'month', grainLabel: 'mês' },
  [ANALYSIS_VIEWS.QUARTERLY]: { label: 'Realizado por Trimestre', bucket: 'quarter', grainLabel: 'trimestre' },
  [ANALYSIS_VIEWS.YEARLY]: { label: 'Realizado por Ano', bucket: 'year', grainLabel: 'ano' },
};

const CUMULATIVE_CONFIG = {
  [CUMULATIVE_GRANULARITIES.BUSINESS_DAY]: { label: 'Dia útil', bucket: 'day', grainLabel: 'dia útil' },
  [CUMULATIVE_GRANULARITIES.WEEK]: { label: 'Semana', bucket: 'week', grainLabel: 'semana' },
  [CUMULATIVE_GRANULARITIES.MONTH]: { label: 'Mês', bucket: 'month', grainLabel: 'mês' },
  [CUMULATIVE_GRANULARITIES.QUARTER]: { label: 'Trimestre', bucket: 'quarter', grainLabel: 'trimestre' },
  [CUMULATIVE_GRANULARITIES.YEAR]: { label: 'Ano', bucket: 'year', grainLabel: 'ano' },
};

const capitalize = (value) => `${String(value || '').charAt(0).toUpperCase()}${String(value || '').slice(1)}`;

const AnalysisPanel = ({ 
  kpi, onClose, dailySeries, series, aggregatedByAxis, period, slaRepasseInsights, ipcInsights, propostasBreakdowns, isLoadingBreakdown = false
}) => {
  const [slaSortMode, setSlaSortMode] = useState('desc');
  const [pendingMinDays, setPendingMinDays] = useState('0');
  const [propostasView, setPropostasView] = useState('total');
  const [repasseFilter, setRepasseFilter] = useState('all');
  const chartPolicy = useMemo(() => {
    const monthCount = Number(series?.monthly?.length) || 0;
    return getChartGranularityPolicy({ ...period, monthCount });
  }, [period, series?.monthly?.length]);
  const [viewState, setViewState] = useState({
    kpiId: kpi?.id ?? null,
    selectedView: chartPolicy.defaultView,
    cumulativeGranularity: chartPolicy.defaultCumulativeGranularity,
  });
  const allowedViews = chartPolicy.allowedViews ?? [ANALYSIS_VIEWS.DAILY, ANALYSIS_VIEWS.MONTHLY, ANALYSIS_VIEWS.CUMULATIVE];
  const selectedViewRaw = viewState.kpiId === kpi?.id ? viewState.selectedView : chartPolicy.defaultView;
  const selectedView = allowedViews.includes(selectedViewRaw) ? selectedViewRaw : chartPolicy.defaultView;
  const allowedCumulativeGranularities = chartPolicy.allowedCumulativeGranularities ?? [CUMULATIVE_GRANULARITIES.BUSINESS_DAY, CUMULATIVE_GRANULARITIES.MONTH];
  const cumulativeGranularityRaw = viewState.kpiId === kpi?.id
    ? viewState.cumulativeGranularity
    : chartPolicy.defaultCumulativeGranularity;
  const cumulativeGranularity = allowedCumulativeGranularities.includes(cumulativeGranularityRaw)
    ? cumulativeGranularityRaw
    : chartPolicy.defaultCumulativeGranularity;
  const { filters, activeFilterLabels } = useCommercialFilters();

  /** Build array of active filter badge labels for context display */
  const activeFilterBadges = useMemo(() => {
    const badges = activeFilterLabels.map((f) => `${f.label}: ${f.display}`);
    if (filters.dataInicial && filters.dataFinal) {
      const fmtD = (d) => {
        const [y, m, day] = String(d).split('-');
        return y && m && day ? `${day}/${m}` : d;
      };
      badges.push(`${fmtD(filters.dataInicial)} → ${fmtD(filters.dataFinal)}`);
    }
    return badges;
  }, [activeFilterLabels, filters.dataInicial, filters.dataFinal]);

  const kpiDataForScale = useMemo(() => {
    if (!kpi) return null;
    const value = kpi.actual;
    return {
      ...kpi,
      actual: Number(value) || 0,
      isPercent: kpi.id === 'ipc' || kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria' || kpi.id?.includes('sla')
    };
  }, [kpi]);

  const monthlyEntries = useMemo(() => {
    const apiMonthly = normalizeMonthlyComparisonEntries(series?.monthly ?? [], series?.previousMonthly ?? [], kpiDataForScale || {}, period);
    if (apiMonthly.length) return apiMonthly;
    return aggregateEntriesByMonth(dailySeries || [], kpiDataForScale || {});
  }, [dailySeries, kpiDataForScale, period, series?.monthly, series?.previousMonthly]);

  const entriesByBucket = useMemo(() => {
    const daily = dailySeries || [];
    return {
      day: daily,
      week: aggregateEntriesByBucket(daily, kpiDataForScale || {}, 'week'),
      month: monthlyEntries,
      quarter: aggregateEntriesByBucket(monthlyEntries, kpiDataForScale || {}, 'quarter'),
      year: aggregateEntriesByBucket(monthlyEntries, kpiDataForScale || {}, 'year'),
    };
  }, [dailySeries, kpiDataForScale, monthlyEntries]);

  const cumulativeBaseEntries = useMemo(() => {
    const bucket = CUMULATIVE_CONFIG[cumulativeGranularity]?.bucket ?? 'day';
    return entriesByBucket[bucket] ?? [];
  }, [cumulativeGranularity, entriesByBucket]);

  const cumulativeTrendBaseData = useMemo(() => {
    if (!cumulativeBaseEntries.length) return [];
    const granularity = CUMULATIVE_CONFIG[cumulativeGranularity]?.bucket ?? 'day';
    return buildCumulativeChartData(cumulativeBaseEntries, kpiDataForScale || {}, period, granularity).rows;
  }, [cumulativeBaseEntries, cumulativeGranularity, kpiDataForScale, period]);

  const monthlyProjection = useMemo(() => {
    const granularity = CUMULATIVE_CONFIG[cumulativeGranularity]?.bucket ?? 'day';
    if (granularity !== 'month' && granularity !== 'quarter' && granularity !== 'year') {
      return { rows: cumulativeTrendBaseData, stats: null };
    }
    const cumulativeChart = buildCumulativeChartData(cumulativeBaseEntries, kpiDataForScale || {}, period, granularity);
    return { rows: cumulativeChart.rows, stats: cumulativeChart.stats };
  }, [cumulativeBaseEntries, cumulativeGranularity, cumulativeTrendBaseData, kpiDataForScale, period]);

  const trendData = monthlyProjection.rows;
  const monthlyCumulativeStats = monthlyProjection.stats;
  const selectedViewConfig = VIEW_CONFIG[selectedView] ?? VIEW_CONFIG[ANALYSIS_VIEWS.DAILY];
  const selectedGrainLabel = selectedViewConfig.grainLabel;
  const selectedGrainLabelTitle = capitalize(selectedGrainLabel);
  const ipcActiveBaseViewConfig = VIEW_CONFIG[chartPolicy.defaultView] ?? VIEW_CONFIG[ANALYSIS_VIEWS.DAILY];
  const ipcActiveBaseBucket = ipcActiveBaseViewConfig.bucket ?? 'day';
  const ipcActiveBaseGrainLabel = ipcActiveBaseViewConfig.grainLabel ?? 'dia';
  const ipcActiveBaseGrainLabelTitle = capitalize(ipcActiveBaseGrainLabel);
  const cumulativeConfig = CUMULATIVE_CONFIG[cumulativeGranularity] ?? CUMULATIVE_CONFIG[CUMULATIVE_GRANULARITIES.BUSINESS_DAY];
  const cumulativeGrainLabel = cumulativeConfig.grainLabel;
  const cumulativeGrainLabelTitle = capitalize(cumulativeGrainLabel);
  const periodLongHint = !allowedViews.includes(ANALYSIS_VIEWS.DAILY) && chartPolicy.calendarDays > 31;
  const projectionAverageLabel = cumulativeConfig.bucket === 'quarter'
    ? 'Média trimestral'
    : (cumulativeConfig.bucket === 'year' ? 'Média anual' : 'Média mensal');

  const dailyBarsData = useMemo(() => {
    const bucket = VIEW_CONFIG[selectedView]?.bucket ?? 'day';
    const source = entriesByBucket[bucket] ?? [];
    if (!source.length) return [];
    return buildDailySeries(source, kpiDataForScale || {});
  }, [entriesByBucket, kpiDataForScale, selectedView]);
  const ipcMonthlyActiveBaseData = useMemo(() => {
    const isIpcMetric = ['ipc', 'ipc_corretor', 'ipc_imobiliaria'].includes(kpiDataForScale?.id);
    if (!isIpcMetric) return [];
    const source = entriesByBucket[ipcActiveBaseBucket] ?? [];
    return source
      .filter((entry) => entry.value != null || Number(entry.supportValue) > 0 || Number(entry.base) > 0)
      .map((entry) => ({
        day: entry.label,
        date: entry.date,
        RepassesPeriodo: Number(entry.supportValue) || 0,
        CorretoresAtivosPeriodo: Number(entry.base) || 0,
        IpcCorretorPeriodo: entry.value == null ? null : Number(entry.value),
      }));
  }, [entriesByBucket, ipcActiveBaseBucket, kpiDataForScale?.id]);
  const ipcMonthlyBaseStats = useMemo(() => {
    if (!ipcMonthlyActiveBaseData.length) {
      return { totalRepasses: 0, averageCorretores: 0, peakIpc: 0, observedPeriods: 0 };
    }
    const observedPeriods = ipcMonthlyActiveBaseData.length;
    const totalRepasses = ipcMonthlyActiveBaseData.reduce((sum, entry) => sum + (Number(entry.RepassesPeriodo) || 0), 0);
    const totalCorretores = ipcMonthlyActiveBaseData.reduce((sum, entry) => sum + (Number(entry.CorretoresAtivosPeriodo) || 0), 0);
    const peakIpc = ipcMonthlyActiveBaseData.reduce((max, entry) => Math.max(max, Number(entry.IpcCorretorPeriodo) || 0), 0);
    return {
      totalRepasses,
      averageCorretores: Number((totalCorretores / Math.max(observedPeriods, 1)).toFixed(1)),
      peakIpc,
      observedPeriods,
    };
  }, [ipcMonthlyActiveBaseData]);
  const dataLabelProps = useMemo(() => getDataLabelProps(dailyBarsData.length), [dailyBarsData.length]);
  const trendDataLabelProps = useMemo(() => getDataLabelProps(trendData.length), [trendData.length]);
  const realizedChartMargin = useMemo(() => ({
    top: kpiDataForScale?.id === 'propostas' ? 44 : (dailyBarsData.length > 24 ? 34 : (dailyBarsData.length > 14 ? 24 : 14)),
    right: 8,
    left: kpiDataForScale?.id === 'propostas' ? -8 : -16,
    bottom: kpiDataForScale?.id === 'propostas' ? 12 : (dailyBarsData.length > 24 ? 34 : 24),
  }), [dailyBarsData.length, kpiDataForScale?.id]);
  const breakdownData = useMemo(() => generateBreakdownData(aggregatedByAxis), [aggregatedByAxis]);
  const propostasDimensionSets = useMemo(() => {
    const source = propostasBreakdowns ?? {
      aprovadas: aggregatedByAxis ?? {},
      condicionadas: {},
      reprovadas: {},
      total: {},
    };
    return [
      { key: 'aprovadas', title: 'Aprovadas', axis: source.aprovadas ?? {} },
      { key: 'condicionadas', title: 'Condicionadas', axis: source.condicionadas ?? {} },
      { key: 'reprovadas', title: 'Reprovadas', axis: source.reprovadas ?? {} },
      { key: 'total', title: 'Com Resposta (3 juntas)', axis: source.total ?? {} },
    ];
  }, [aggregatedByAxis, propostasBreakdowns]);
  const propostasSelectedSet = useMemo(
    () => propostasDimensionSets.find((item) => item.key === propostasView) ?? propostasDimensionSets[0],
    [propostasDimensionSets, propostasView],
  );
  const showForecastRaw = kpi.forecastVisible !== false;
  const forecastBase = Number.isFinite(kpi.forecast) ? kpi.forecast : kpi.actual;

  const statusKey = STATUS_LABELS[kpi.status] ? kpi.status : 'attention';
  const kpiTitle = kpi.title ?? kpi.label ?? kpi.id;
  const lowerIsBetter = Boolean(kpi.lowerIsBetter);
  const kpiActual = Number(kpi.actual ?? 0);
  const kpiDenominator = Number(kpi.denominator ?? 0);
  const momentumValue = Number(kpi.mom ?? 0);
  const hasMomentum = Number.isFinite(Number(kpi.mom));
  const isMomentumIncrease = momentumValue >= 0;
  const gapValue = lowerIsBetter
    ? (kpiActual) - (Number(kpi.target ?? 0))
    : (Number(kpi.target ?? 0)) - (kpiActual);
  const hasGap = gapValue > 0;
  const attainmentValue = Number.isFinite(kpi.attainment) ? kpi.attainment : (Number(kpi.target) > 0 ? (kpiActual / Number(kpi.target)) * 100 : 0);
  const attPct = Math.min(attainmentValue, 100);
  const avgBusinessDay = Number.isFinite(kpi.avgPerBusinessDay) ? kpi.avgPerBusinessDay : 0;
  const isSlaFinalizacao = kpi.id === 'sla_f';
  const isSlaRepasse = kpi.id === 'sla_r';
  const isIpc = kpi.id === 'ipc' || kpi.id === 'ipc_corretor' || kpi.id === 'ipc_imobiliaria';
  const isPropostas = kpi.id === 'propostas';
  const propostasStatusTotals = kpi.propostasStatusTotals;
  const isCancelamentos = kpi.id === 'cancelamentos';
  const isSla = isSlaFinalizacao || isSlaRepasse;
  const showForecast = showForecastRaw && !isSla && !isIpc;
  const showMonthlyProjectionStats = selectedView === ANALYSIS_VIEWS.CUMULATIVE
    && ['month', 'quarter', 'year'].includes(cumulativeConfig.bucket)
    && monthlyCumulativeStats
    && !isSla
    && !isIpc;
  const chartHeightStyle = useMemo(() => {
    if (!isPropostas) return undefined;
    const isDailyView = selectedView === ANALYSIS_VIEWS.DAILY;
    const baseHeight = selectedView === ANALYSIS_VIEWS.CUMULATIVE ? 300 : (isDailyView ? 405 : 340);
    const height = Math.min(isDailyView ? 455 : 420, Math.max(baseHeight, 300 + (dailyBarsData.length * (isDailyView ? 6 : 5))));
    return {
      '--analysis-chart-height': `${height}px`,
      '--analysis-chart-card-min-height': `${height + 58}px`,
    };
  }, [dailyBarsData.length, isPropostas, selectedView]);
  const propostasYAxisTicks = useMemo(() => {
    if (!isPropostas) return undefined;
    const maxValue = dailyBarsData.reduce((max, entry) => Math.max(
      max,
      Number(entry.PropostasAprovadasDia) || 0,
      Number(entry.PropostasCondicionadasDia) || 0,
      Number(entry.PropostasReprovadasDia) || 0,
      Number(entry.PropostasTotalDia) || 0,
      Number(entry.AnteriorDia) || 0,
      Number(entry.MetaDia) || 0,
    ), 0);
    return buildYAxisTicks(maxValue * 1.12, dailyBarsData.length > 8 ? 4 : 5);
  }, [dailyBarsData, isPropostas]);
  const forecastValue = showForecast ? forecastBase : kpi.actual;
  const limitedEmpreendimentos = (aggregatedByAxis?.empreendimento ?? []).slice(0, 12);
  const topCorretoresIpc = (aggregatedByAxis?.corretor ?? []).slice(0, 12);

  const ipcSummary = useMemo(() => {
    if (!isIpc) return {
      repasses: 0,
      repassesAtribuidos: 0,
      repassesSemVinculo: 0,
      corretoresAtivos: 0,
      imobiliariasAtivas: 0,
      ipcCorretor: 0,
      prevIpcCorretor: 0,
      ipcImobiliaria: 0,
      prevIpcImobiliaria: 0,
    };

    if (ipcInsights && ipcInsights.summary) {
      const s = ipcInsights.summary;
      return {
        repasses: Number(s.repasses) || 0,
        repassesAtribuidos: Number(s.repassesAtribuidos) || 0,
        repassesSemVinculo: Number(s.repassesSemVinculo) || 0,
        corretoresAtivos: Number(s.corretores) || 0,
        imobiliariasAtivas: Number(s.imobiliarias) || 0,
        ipcCorretor: Number(s.ipcCorretor) || 0,
        prevIpcCorretor: Number(s.prevIpcCorretor) || 0,
        ipcImobiliaria: Number(s.ipcImobiliaria) || 0,
        prevIpcImobiliaria: Number(s.prevIpcImobiliaria) || 0
      };
    }

    const repassesSeries = (dailySeries || []).reduce((sum, entry) => sum + (Number(entry.supportValue) || 0), 0);
    const repassesBreakdown = (aggregatedByAxis?.corretor ?? []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const repasses = Math.max(repassesSeries, repassesBreakdown);

    const corretoresAtivosSerie = (dailySeries || []).reduce((max, entry) => Math.max(max, Number(entry.base) || 0), 0);
    const imobiliariasAtivasSerie = (dailySeries || []).reduce((max, entry) => Math.max(max, Number(entry.baseSecondary) || 0), 0);
    const corretoresAtivos = Math.max(corretoresAtivosSerie, kpiDenominator || 0);
    const imobiliariasAtivas = Math.max(imobiliariasAtivasSerie, Number(kpi.id === 'ipc_imobiliaria' ? kpiDenominator : 0) || 0);

    return {
      repasses,
      repassesAtribuidos: Number(kpi.numeratorAttributed) || 0,
      repassesSemVinculo: Number(kpi.numeratorUnlinked) || 0,
      corretoresAtivos,
      imobiliariasAtivas,
      ipcCorretor: Number(kpi.id === 'ipc_corretor' ? kpiActual : (corretoresAtivos > 0 ? (repasses / corretoresAtivos) : 0)) || 0,
      prevIpcCorretor: 0,
      ipcImobiliaria: Number(kpi.id === 'ipc_imobiliaria' ? kpiActual : (imobiliariasAtivas > 0 ? (repasses / imobiliariasAtivas) : 0)) || 0,
      prevIpcImobiliaria: 0
    };
  }, [aggregatedByAxis, dailySeries, ipcInsights, isIpc, kpi.id, kpi.numeratorAttributed, kpi.numeratorUnlinked, kpiActual, kpiDenominator]);

  const ipcRepasses = ipcSummary.repasses;

  const ipcRankings = useMemo(() => {
    const fallback = { corretores: [], imobiliarias: [] };
    if (!isIpc) return fallback;
    
    if (ipcInsights && ipcInsights.rankings) {
      return {
        corretores: normalizeIpcRanking(Array.isArray(ipcInsights.rankings.corretores) ? ipcInsights.rankings.corretores : []),
        imobiliarias: normalizeIpcRanking(Array.isArray(ipcInsights.rankings.imobiliarias) ? ipcInsights.rankings.imobiliarias : [])
      };
    }

    return {
      corretores: normalizeIpcRanking((aggregatedByAxis?.corretor ?? []).map(r => ({ 
        ...r,
        label: r.label, 
        value: r.value, 
        share: (Number(r.value) / (ipcRepasses || 1)) * 100 
      }))).sort((a, b) => b.value - a.value),
      imobiliarias: normalizeIpcRanking((aggregatedByAxis?.imobiliaria ?? []).map(r => ({ 
        ...r,
        label: r.label, 
        value: r.value, 
        share: (Number(r.value) / (ipcRepasses || 1)) * 100 
      }))).sort((a, b) => b.value - a.value)
    };
  }, [aggregatedByAxis, ipcInsights, ipcRepasses, isIpc]);

  const filteredIpcRankings = useMemo(() => {
    const applyRepasseFilter = (items = []) => items.filter((item) => {
      const value = Number(item.value) || 0;
      if (repasseFilter === 'with') return value > 0;
      if (repasseFilter === 'without') return value === 0;
      return true;
    });

    return {
      corretores: applyRepasseFilter(ipcRankings.corretores),
      imobiliarias: applyRepasseFilter(ipcRankings.imobiliarias),
    };
  }, [ipcRankings, repasseFilter]);

  const ipcCoverage = useMemo(() => {
    const countActiveWithRepasse = (items = []) => items.filter((item) => (Number(item.base) || 0) > 0 && (Number(item.value) || 0) > 0).length;
    const countActiveWithoutRepasse = (items = []) => items.filter((item) => (Number(item.base) || 0) > 0 && (Number(item.value) || 0) === 0).length;
    const sumUnlinkedRepasses = (items = []) => items
      .filter((item) => (Number(item.base) || 0) === 0)
      .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    return {
      corretoresComRepasse: countActiveWithRepasse(ipcRankings.corretores),
      corretoresSemRepasse: countActiveWithoutRepasse(ipcRankings.corretores),
      corretoresRepassesSemVinculo: sumUnlinkedRepasses(ipcRankings.corretores),
      imobiliariasComRepasse: countActiveWithRepasse(ipcRankings.imobiliarias),
      imobiliariasSemRepasse: countActiveWithoutRepasse(ipcRankings.imobiliarias),
      imobiliariasRepassesSemVinculo: sumUnlinkedRepasses(ipcRankings.imobiliarias),
    };
  }, [ipcRankings]);
  const fallbackSlaFinalizacaoInsights = useMemo(() => {
    if (!isSlaFinalizacao || slaRepasseInsights) return null;
    const contabilizacoesViaSerie = dailySeries.reduce((sum, entry) => sum + (Number(entry.base) || 0), 0);
    const contabilizacoesViaBreakdown = (aggregatedByAxis?.corretor ?? []).reduce(
      (sum, item) => sum + (Number(item.case_count || item.count || 0) || 0),
      0,
    );
    const contabilizacoesPeriodo = Math.max(contabilizacoesViaSerie, contabilizacoesViaBreakdown);
    const topCorretores = (aggregatedByAxis?.corretor ?? [])
      .filter((item) => Number(item.case_count || item.count || 0) > 0)
      .slice(0, 12)
      .map((item) => ({
        corretor: item.label,
        assinaturas: Number(item.case_count || item.count || 0),
      }));
    const maioresSla = (aggregatedByAxis?.corretor ?? [])
      .filter((item) => Number(item.case_count || item.count || 0) > 0)
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 12)
      .map((item) => ({
        corretor: item.label,
        journeyId: `fallback-${item.label}`,
        idrepasse: null,
        dtContratoContabilizado: null,
        dtAssinaturaContrato: null,
        slaDias: item.value == null ? null : Number(Number(item.value).toFixed(1)),
        situacaoRepasse: `${Number(item.case_count || item.count || 0)} casos no período`,
      }));

    return {
      summary: {
        contabilizadosPeriodo: contabilizacoesPeriodo,
        contabilizacoesPeriodo,
        comAssinatura: contabilizacoesPeriodo,
        semAssinatura: 0,
        taxaAssinatura: null,
        taxaOperacional: null,
      },
      topCorretoresAssinatura: topCorretores,
      maioresSla,
      semAssinaturaDetalhes: [],
      semAssinaturaPorSituacao: [],
    };
  }, [aggregatedByAxis, dailySeries, isSlaFinalizacao, slaRepasseInsights]);

  const effectiveSlaInsights = slaRepasseInsights ?? fallbackSlaFinalizacaoInsights;

  const slaRepasseSummary = effectiveSlaInsights?.summary ?? {
    contabilizadosPeriodo: 0,
    contabilizacoesPeriodo: 0,
    comAssinatura: 0,
    semAssinatura: 0,
    taxaAssinatura: 0,
    taxaOperacional: 0,
  };
  const topCorretoresAssinatura = effectiveSlaInsights?.topCorretoresAssinatura ?? [];
  const topCorretoresSegmentados = effectiveSlaInsights?.topCorretoresSegmentados ?? {};
  const slaVolumeLabel = isSlaRepasse ? 'assinaturas' : 'contabilizações';
  const slaTopOperation = topCorretoresSegmentados.operacao?.length
    ? topCorretoresSegmentados.operacao
    : topCorretoresAssinatura;
  const slaTopCards = [
    {
      key: 'operacao',
      scope: 'operation',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Corretor da Operação (Top 12)`,
      items: slaTopOperation,
    },
    {
      key: 'ativo',
      scope: 'broker',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Corretor (Top 12)`,
      items: topCorretoresSegmentados.ativo ?? [],
    },
  ];
  const slaHierarchyCards = [
    {
      key: 'gestorCorretor',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Gestor do Corretor`,
      items: topCorretoresSegmentados.gestorCorretor ?? [],
    },
    {
      key: 'coordenadorCorretor',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Coordenador do Corretor`,
      items: topCorretoresSegmentados.coordenadorCorretor ?? [],
    },
    {
      key: 'regiaoCorretor',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Região do Corretor`,
      items: topCorretoresSegmentados.regiaoCorretor ?? [],
    },
    {
      key: 'imobiliariaCorretor',
      title: `${isSlaRepasse ? 'Assinaturas' : 'Contabilizações'} por Imobiliária do Corretor`,
      items: topCorretoresSegmentados.imobiliariaCorretor ?? [],
    },
  ];
  const maioresSla = useMemo(
    () => effectiveSlaInsights?.maioresSla ?? [],
    [effectiveSlaInsights],
  );
  const semAssinaturaDetalhes = useMemo(
    () => effectiveSlaInsights?.semAssinaturaDetalhes ?? [],
    [effectiveSlaInsights],
  );
  const maioresSlaOrdenados = useMemo(() => {
    const items = [...maioresSla];
    const dir = slaSortMode === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const av = Number(a?.slaDias ?? -1);
      const bv = Number(b?.slaDias ?? -1);
      return (av - bv) * dir;
    });
    return items;
  }, [maioresSla, slaSortMode]);
  const minPendingDaysValue = Number.parseInt(pendingMinDays, 10) || 0;
  const periodStart = period?.startDate ?? null;
  const periodEnd = period?.endDate ?? null;
  const pendenciasFiltradas = useMemo(() => (
    semAssinaturaDetalhes.filter((item) => {
      const dias = Number(item?.diasSemAssinatura) || 0;
      const contabilizadoKey = toISODateKey(item?.dtContratoContabilizado);
      const inPeriod = Boolean(
        contabilizadoKey
          && (!periodStart || contabilizadoKey >= periodStart)
          && (!periodEnd || contabilizadoKey <= periodEnd)
      );
      return dias >= minPendingDaysValue && inPeriod;
    })
  ), [minPendingDaysValue, periodEnd, periodStart, semAssinaturaDetalhes]);
  const pendenciasPorSituacaoFiltradas = useMemo(() => {
    const grouped = new Map();
    pendenciasFiltradas.forEach((item) => {
      const key = item?.situacaoRepasse || 'Sem informacao';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return Array.from(grouped.entries())
      .map(([situacaoRepasse, total]) => ({ situacaoRepasse, total }))
      .sort((a, b) => b.total - a.total || a.situacaoRepasse.localeCompare(b.situacaoRepasse, 'pt-BR'));
  }, [pendenciasFiltradas]);
  const pendingTotalResolved = useMemo(() => {
    if (pendenciasFiltradas.length) return pendenciasFiltradas.length;
    if (isSlaFinalizacao) return Number(slaRepasseSummary?.semAssinatura) || 0;
    return 0;
  }, [isSlaFinalizacao, pendenciasFiltradas.length, slaRepasseSummary?.semAssinatura]);
  const pendingStatusResolved = useMemo(() => {
    if (pendenciasPorSituacaoFiltradas.length) return pendenciasPorSituacaoFiltradas;
    if (isSlaFinalizacao && (Number(slaRepasseSummary?.semAssinatura) || 0) > 0) {
      return [{ situacaoRepasse: 'Sem detalhamento de situação', total: Number(slaRepasseSummary?.semAssinatura) || 0 }];
    }
    return [];
  }, [isSlaFinalizacao, pendenciasPorSituacaoFiltradas, slaRepasseSummary?.semAssinatura]);
  const slaCaseVolume = useMemo(
    () => dailySeries.reduce((sum, entry) => sum + (Number(entry.base) || 0), 0),
    [dailySeries],
  );
  const propostasTotals = useMemo(() => {
    if (!isPropostas) return { aprovadas: 0, condicionadas: 0, reprovadas: 0, total: 0 };
    const aprovadasSeries = dailySeries.reduce((sum, entry) => sum + (Number(entry.supportValue) || 0), 0);
    const condicionadasSeries = dailySeries.reduce((sum, entry) => sum + (Number(entry.supportValue2) || 0), 0);
    const reprovadasSeries = dailySeries.reduce((sum, entry) => sum + (Number(entry.supportValue3) || 0), 0);
    const totalSeries = dailySeries.reduce((sum, entry) => sum + (Number(entry.supportValue4) || 0), 0);
    const aprovadasBreakdown = (propostasBreakdowns?.aprovadas?.corretor ?? aggregatedByAxis?.corretor ?? [])
      .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const summaryTotals = propostasStatusTotals ?? {};
    const aprovadas = Math.max(
      aprovadasSeries,
      aprovadasBreakdown,
      Number(summaryTotals.aprovadas) || 0,
    );
    const condicionadas = Math.max(
      condicionadasSeries,
      Number(summaryTotals.condicionadas) || 0,
    );
    const reprovadas = Math.max(
      reprovadasSeries,
      Number(summaryTotals.reprovadas) || 0,
    );
    const totalFromSummary = Number(summaryTotals.total)
      || (Number(summaryTotals.aprovadas) || 0)
        + (Number(summaryTotals.condicionadas) || 0)
        + (Number(summaryTotals.reprovadas) || 0);
    const total = Math.max(totalSeries, aprovadas + condicionadas + reprovadas, totalFromSummary);
    return { aprovadas, condicionadas, reprovadas, total };
  }, [aggregatedByAxis, dailySeries, isPropostas, propostasBreakdowns, propostasStatusTotals]);
  const axisConfig = isIpc ? IPC_AXIS_CONFIG : ADDITIONAL_AXIS_CONFIG;
  const visibleAxisConfig = useMemo(() => {
    // SDR rule: Only show SDR hierarchy for Leads, Visitas or Agendamentos
    const isSdrContext = kpi.id === 'leads' || kpi.id === 'visitas' || kpi.id?.toLowerCase().includes('agendamento');
    
    return axisConfig.filter((axis) => {
      const scope = getAxisScope(axis);
      if (scope === 'sdr' && !isSdrContext) return false;
      return (aggregatedByAxis?.[axis.key] ?? []).length > 0;
    });
  }, [aggregatedByAxis, axisConfig, kpi.id]);
  const topCidadeCancelamento = breakdownData[0] ?? null;
  const topEmpreendimentoCancelamento = limitedEmpreendimentos[0] ?? null;
  const cancelamentoCoverage = isCancelamentos
    ? {
      availableAxes: visibleAxisConfig.length + 2,
      totalAxes: axisConfig.length + 2,
    }
    : { availableAxes: 0, totalAxes: 0 };
  const forecastSentenceCancelamento = showForecast
    ? `${kpiTitle} apresenta atingimento de ${attainmentValue.toFixed(1)}% no período, com forecast projetando ${fmt(forecastValue, kpi.unit)} para o fechamento.`
    : `${kpiTitle} encerra o período com ${fmt(kpi.actual, kpi.unit)} realizadas.`;
  const gapSentenceCancelamento = hasGap
    ? ` Gap de ${fmt(Math.abs(gapValue), kpi.unit)} em relação à meta requer atenção no ritmo das próximas semanas.`
    : ' Indicador em rota favorável para cumprimento da meta no ciclo atual.';
  const cidadeLabelCancelamento = topCidadeCancelamento?.name || 'Sem informação';
  const cidadeShareCancelamento = Number(topCidadeCancelamento?.share) || 0;
  const empreendimentoLabelCancelamento = topEmpreendimentoCancelamento?.label || 'Sem informação';
  const empreendimentoVolumeCancelamento = Number(topEmpreendimentoCancelamento?.value) || 0;
  const cancelamentosAnnotation = `${forecastSentenceCancelamento}${gapSentenceCancelamento} Pela base atual, a maior concentração está em ${cidadeLabelCancelamento} (${cidadeShareCancelamento}%) e no empreendimento ${empreendimentoLabelCancelamento} (${fmt(empreendimentoVolumeCancelamento, kpi.unit)}). ${cancelamentoCoverage.availableAxes} de ${cancelamentoCoverage.totalAxes} cortes analíticos possuem dados no período.`;
  const slaFinalizacaoAnnotation = `${showForecast
    ? `${kpiTitle} apresenta atingimento de ${attainmentValue.toFixed(1)}% no período, com forecast projetando ${fmt(forecastValue, kpi.unit)} para o fechamento.`
    : `${kpiTitle} encerra o período com ${fmt(kpi.actual, kpi.unit)} realizadas.`}${
    hasGap
      ? ` Gap de ${fmt(Math.abs(gapValue), kpi.unit)} em relação à meta requer atenção no ritmo das próximas semanas.`
      : ' Indicador em rota favorável para cumprimento da meta no ciclo atual.'
  } Visão operacional: ${fmt(slaRepasseSummary?.contabilizacoesPeriodo, 'un')} contabilizações no período para ${fmt(slaRepasseSummary?.contabilizadosPeriodo, 'un')} reservas cadastradas (${fmt(slaRepasseSummary?.taxaOperacional, '%')}). Visão cohort: ${fmt(slaRepasseSummary?.comAssinatura, 'un')} reservas do próprio período já contabilizadas (${fmt(slaRepasseSummary?.taxaAssinatura, '%')}).`;
  const maxBreakdown = Math.max(
    ...(isIpc
      ? topCorretoresIpc.map((d) => Number(d.value) || 0)
      : breakdownData.map((d) => Number(d.value) || 0)),
    1,
  );
  const todayComparablePoint = useMemo(() => {
    for (let index = trendData.length - 1; index >= 0; index -= 1) {
      const entry = trendData[index];
      if (entry.Realizado != null && entry.Anterior != null && entry.Anterior !== 0) return entry;
    }
    return null;
  }, [trendData]);
  const todayVariationPct = todayComparablePoint
    ? ((todayComparablePoint.Realizado - todayComparablePoint.Anterior) / Math.abs(todayComparablePoint.Anterior)) * 100
    : null;
  const isTodayAbovePrevious = todayVariationPct != null ? todayVariationPct >= 0 : null;
  const forecastRuleText = 'Forecast usa o ritmo atual para projetar o fechamento do período; em indicadores acumulados a projeção segue média por dia útil, e nos demais indicadores usa a projeção consolidada do backend.';
  const gapRuleText = lowerIsBetter
    ? 'Gap de qualidade é calculado por realizado - meta (positivo indica desvio acima da meta).'
    : 'Gap de volume é calculado por meta - realizado (positivo indica faltante para atingir a meta).';
  return (
    <div
      className="analysis-backdrop"
      onClick={onClose}
    >
      <div
        className="analysis-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Summary */}
        <div className="analysis-summary">
          <div className="analysis-summary-header">
            <span className="analysis-summary-subtitle">Modo de Análise</span>
            <h2 className="analysis-summary-title">{kpiTitle}</h2>
            {kpi.calcDescription && !isIpc && (
              <span className="analysis-summary-subtitle" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.62rem' }}>
                {kpi.calcDescription}
              </span>
            )}
            <span
              className={`executive-kpi-badge executive-kpi-badge-${statusKey}`}
              style={{ width: 'fit-content', marginTop: '0.2rem' }}
            >
              {STATUS_LABELS[statusKey]}
            </span>

            {activeFilterBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                <Filter size={10} style={{ opacity: 0.5, marginTop: '0.15rem' }} />
                {activeFilterBadges.map((badge) => (
                  <span
                    key={badge}
                    style={{
                      fontSize: '0.58rem',
                      padding: '0.15rem 0.4rem',
                      background: 'rgba(83, 147, 239, 0.08)',
                      borderRadius: '3px',
                      color: 'var(--on-surface-variant)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="analysis-hero-value">{fmt(kpi.actual, kpi.unit)}</p>
            <p className="analysis-mom-indicator">
              {hasMomentum ? `${isMomentumIncrease ? '↑' : '↓'} ${Math.abs(kpi.mom ?? 0).toFixed(1)}% vs período anterior` : 'Sem base comparativa para variação %'}
            </p>
            {kpi.previousPeriodLabel && (
              <p className="analysis-mom-indicator" style={{ opacity: 0.75 }}>
                Comparação: período filtrado vs {kpi.previousPeriodLabel}
              </p>
            )}
          </div>

          <div className="analysis-stats-grid">
            <div className="analysis-stat">
              <span className="analysis-stat-label">Meta</span>
              <span className="analysis-stat-value">{fmt(kpi.target, kpi.unit)}</span>
            </div>
            <div className="analysis-stat">
              <span className="analysis-stat-label">{showForecast ? 'Forecast' : 'Fechamento'}</span>
              <span className="analysis-stat-value">{fmt(forecastValue, kpi.unit)}</span>
            </div>
            <div className="analysis-stat">
              <span className="analysis-stat-label">Atingimento</span>
              <span className="analysis-stat-value">{attainmentValue.toFixed(1)}%</span>
              <div className="analysis-progress-track">
                <div className="analysis-progress-fill" style={{ width: `${attPct}%` }} />
              </div>
            </div>
            <div className="analysis-stat">
              <span className="analysis-stat-label">Gap</span>
              <span className={`analysis-stat-value ${hasGap ? 'text-error' : 'text-positive'}`}>
                {hasGap ? '-' : '+'}{fmt(Math.abs(gapValue), kpi.unit)}
              </span>
            </div>
          </div>

          <div className="analysis-stat" style={{ background: 'transparent', padding: '0.15rem 0' }}>
            <span className="analysis-stat-label">Média útil/dia</span>
            <span className="analysis-stat-value">{fmt(avgBusinessDay, kpi.unit)}</span>
            {kpi.avgPeriodLabel && (
              <span className="analysis-stat-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                Período usado: {kpi.avgPeriodLabel} ({kpi.avgBusinessDaysUsed ?? 0} dias úteis)
              </span>
            )}
          </div>

          <div className="analysis-nav-links">
              <Link to={`/indicadores/${kpi.id}/dashboard`} className="analysis-nav-link">
                <ExternalLink size={12} /> Dashboard da Equipe
              </Link>
            <Link to={`/indicadores/${kpi.id}/detalhamento`} className="analysis-nav-link">
              <ExternalLink size={12} /> Detalhamento
            </Link>
          </div>
        </div>

        {/* Right: Analytics Content */}
        <div className="analysis-content">
          <div className="analysis-content-header">
            <div className="analysis-content-header-text">
              <span className="analysis-section-label">Visão Analítica</span>
              <span className="analysis-section-title">{isIpc ? 'Eficiência de Vendas e Volume Acumulado' : `Progressão Temporal — ${kpiTitle}`}</span>
            </div>
            <button type="button" className="analysis-close-btn" onClick={onClose} aria-label="Fechar análise">
              <X size={16} />
            </button>
          </div>

          {/* New Summary Row for IPC and SLA */}
          {isSlaRepasse && (
            <div className="analysis-summary-row is-five">
              <div className="analysis-summary-card">
                <span className="analysis-summary-label">Média SLA</span>
                <span className="analysis-summary-value">{fmt(kpi.actual, kpi.goalUnit)}</span>
              </div>
              
              <div className="analysis-summary-card">
                <span className="analysis-summary-label">Volume de Casos</span>
                <span className="analysis-summary-value">{fmt(slaCaseVolume, 'un')}</span>
              </div>

              <div className="analysis-summary-card">
                <span className="analysis-summary-label">Meta Período</span>
                <span className="analysis-summary-value">{fmt(kpi.target, kpi.goalUnit)}</span>
              </div>

              <div className="analysis-summary-card">
                <span className="analysis-summary-label">Forecast</span>
                <span className="analysis-summary-value">{fmt(forecastValue, kpi.goalUnit)}</span>
              </div>

              <div className="analysis-summary-card">
                <span className="analysis-summary-label">Atingimento</span>
                <span className={`analysis-summary-value ${statusKey}`}>{attPct}%</span>
              </div>
            </div>
          )}

          <div className="analysis-view-controls" aria-label="Alternar visualização do indicador">
            <div className="analysis-segmented">
              {allowedViews.map((viewKey) => {
                const item = viewKey === ANALYSIS_VIEWS.CUMULATIVE
                  ? { key: viewKey, label: 'Evolução Acumulada' }
                  : { key: viewKey, label: VIEW_CONFIG[viewKey]?.label ?? viewKey };
                return (
                <button
                  key={item.key}
                  type="button"
                  className={`analysis-segmented-btn ${selectedView === item.key ? 'is-active' : ''}`}
                  onClick={() => setViewState((current) => ({
                    kpiId: kpi?.id ?? null,
                    selectedView: item.key,
                    cumulativeGranularity: current.kpiId === kpi?.id
                      ? current.cumulativeGranularity
                      : chartPolicy.defaultCumulativeGranularity,
                  }))}
                >
                  {item.label}
                </button>
                );
              })}
            </div>
            {selectedView === ANALYSIS_VIEWS.CUMULATIVE && (
              <div className="analysis-segmented is-compact" aria-label="Granularidade do acumulado">
                {allowedCumulativeGranularities.map((granularityKey) => (
                  <button
                    key={granularityKey}
                    type="button"
                    className={`analysis-segmented-btn ${cumulativeGranularity === granularityKey ? 'is-active' : ''}`}
                    onClick={() => setViewState(() => ({
                      kpiId: kpi?.id ?? null,
                      selectedView: ANALYSIS_VIEWS.CUMULATIVE,
                      cumulativeGranularity: granularityKey,
                    }))}
                  >
                    {CUMULATIVE_CONFIG[granularityKey]?.label ?? granularityKey}
                  </button>
                ))}
              </div>
            )}
          </div>
          {periodLongHint && (
            <span className="analysis-density-hint">
              Período longo: visão {VIEW_CONFIG[chartPolicy.defaultView]?.label?.replace('Realizado por ', '').toLowerCase()} recomendada.
            </span>
          )}

          {/* Main Chart */}
          {selectedView === ANALYSIS_VIEWS.CUMULATIVE && (
          <div className={`analysis-chart-container ${isPropostas ? 'is-propostas-chart' : ''}`} style={chartHeightStyle}>
            <div className="analysis-chart-meta">
              <span className="analysis-chart-title">
                {isSla
                  ? `SLA Acumulado por ${cumulativeGrainLabelTitle}`
                  : (isIpc ? `IPC Acumulado (Base Mensal) por ${cumulativeGrainLabelTitle}` : (isPropostas ? `Evolução Acumulada de Propostas por ${cumulativeGrainLabelTitle}` : `Evolução Acumulada por ${cumulativeGrainLabelTitle}`))}
              </span>
              {showMonthlyProjectionStats && (
                <div className="analysis-chart-kpis">
                  <span>{projectionAverageLabel}: {fmt(monthlyCumulativeStats.averageMonthly, kpi.unit)}</span>
                  <span>Projeção ano: {fmt(monthlyCumulativeStats.projectedYearEnd, kpi.unit)}</span>
                  <span>{monthlyCumulativeStats.observedMonths} períodos realizados</span>
                </div>
              )}
              {todayVariationPct != null && (
                <span className="analysis-stat-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {isTodayAbovePrevious ? '↑' : '↓'} Realizado hoje {isTodayAbovePrevious ? 'acima' : 'abaixo'} do período anterior em {Math.abs(todayVariationPct).toFixed(1)}%
                </span>
              )}
              <div className="analysis-chart-legend">
                {isSla ? (
                  <>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Média SLA (dias)
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-bar" style={{ background: 'rgba(52, 120, 246, 0.1)' }} /> Volume por {cumulativeGrainLabel}
                    </div>
                  </>
                ) : isIpc ? (
                  <>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> IPC Corretor
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_TEAL }} /> IPC Imobiliária
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dashed" /> IPC Corretor anterior
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dashed" style={{ borderColor: CHART_TEAL }} /> IPC Imobiliária anterior
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-bar" style={{ background: 'rgba(52, 120, 246, 0.1)' }} /> Repasses acumulados (Válidos)
                    </div>
                  </>
                ) : isPropostas ? (
                  <>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Aprovadas
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: '#f59e0b' }} /> Condicionadas
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: '#ef4444' }} /> Reprovadas
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_TEAL }} /> Total
                    </div>
                  </>
                ) : (
                  <>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Realizado
                    </div>
                    <div className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_PREVIOUS }} /> Período anterior
                    </div>
                  </>
                )}
                <div className="analysis-legend-item">
                  <span className="analysis-legend-dashed" /> Meta
                </div>
                {showForecast && (
                  <div className="analysis-legend-item">
                    <span className="analysis-legend-dot" style={{ background: CHART_TEAL, opacity: 0.85 }} /> Forecast
                  </div>
                )}
              </div>
            </div>
            <div className="analysis-chart-wrap">
              {trendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 12, right: 8, left: -20, bottom: 24 }}>
                    <defs>
                      <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradRepasses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(156,168,184,0.1)" vertical={false} />
                    <XAxis dataKey="day" interval={0} minTickGap={0} tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => v.toFixed(kpi.goalUnit === 'dias' ? 1 : 2)} />
                    <YAxis yAxisId="right" orientation="right" hide />
                    <Tooltip content={<ChartTooltip />} />
                    
                    {/* Context Bars */}
                    {isIpc && (
                      <Bar yAxisId="right" dataKey="RepassesAcumulado" name="Volume Acumulado" fill="url(#gradRepasses)" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false} />
                    )}
                    {isSlaRepasse && (
                      <Bar yAxisId="right" dataKey="VolumeDia" name="Volume do Dia" fill="url(#gradRepasses)" radius={[4, 4, 0, 0]} barSize={25} isAnimationActive={false} />
                    )}

                    {/* Meta Line */}
                    <Line yAxisId="left" type="monotone" dataKey="Meta" stroke="rgba(71,85,105,0.95)" strokeDasharray="5 5" dot={false} strokeWidth={2.1} />
                    {showForecast && !isPropostas && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Forecast"
                        stroke={CHART_TEAL}
                        strokeDasharray="7 5"
                        dot={false}
                        strokeWidth={2}
                        strokeOpacity={0.72}
                        connectNulls
                      />
                    )}

                    {/* Main Metric Lines/Areas */}
                    {!isIpc && !isPropostas && (
                      <>
                        <Area yAxisId="left" type="monotone" dataKey="Realizado" stroke={CHART_BLUE} strokeWidth={3} fill="url(#gradActual)" dot={chartPolicy.showDots ? { r: 4, fill: CHART_BLUE } : false} activeDot={{ r: 6 }}>
                          <LabelList dataKey="Realizado" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Area>
                        <Line yAxisId="left" type="monotone" dataKey="Anterior" name="Período anterior" stroke={CHART_PREVIOUS} strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls>
                          <LabelList dataKey="Anterior" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                      </>
                    )}
                    {isPropostas && (
                      <>
                        <Line yAxisId="left" type="monotone" dataKey="PropostasAprovadas" stroke={CHART_BLUE} strokeWidth={2.6} dot={false}>
                          <LabelList dataKey="PropostasAprovadas" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="PropostasCondicionadas" stroke="#f59e0b" strokeWidth={2.3} dot={false}>
                          <LabelList dataKey="PropostasCondicionadas" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="PropostasReprovadas" stroke="#ef4444" strokeWidth={2.3} dot={false}>
                          <LabelList dataKey="PropostasReprovadas" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="PropostasTotal" stroke={CHART_TEAL} strokeWidth={2.6} dot={false}>
                          <LabelList dataKey="PropostasTotal" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        {showForecast && (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="PropostasAprovadasForecast" stroke={CHART_BLUE} strokeWidth={2.1} strokeDasharray="7 5" dot={false} strokeOpacity={0.72} connectNulls />
                            <Line yAxisId="left" type="monotone" dataKey="PropostasCondicionadasForecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="7 5" dot={false} strokeOpacity={0.72} connectNulls />
                            <Line yAxisId="left" type="monotone" dataKey="PropostasReprovadasForecast" stroke="#ef4444" strokeWidth={2} strokeDasharray="7 5" dot={false} strokeOpacity={0.72} connectNulls />
                            <Line yAxisId="left" type="monotone" dataKey="PropostasTotalForecast" stroke={CHART_TEAL} strokeWidth={2.2} strokeDasharray="7 5" dot={false} strokeOpacity={0.72} connectNulls />
                          </>
                        )}
                      </>
                    )}
                    
                    {isIpc && (
                      <>
                        <Line yAxisId="left" type="monotone" dataKey="Realizado" name="IPC Corretor" stroke={CHART_BLUE} strokeWidth={3} dot={chartPolicy.showDots ? { r: 4, fill: CHART_BLUE } : false}>
                          <LabelList dataKey="Realizado" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="IpcImobiliaria" name="IPC Imobiliária" stroke={CHART_TEAL} strokeWidth={3} dot={chartPolicy.showDots ? { r: 4, fill: CHART_TEAL } : false}>
                          <LabelList dataKey="IpcImobiliaria" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="Anterior" name="IPC Corretor anterior" stroke={CHART_PREVIOUS} strokeWidth={2} strokeDasharray="6 4" dot={false}>
                          <LabelList dataKey="Anterior" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                        <Line yAxisId="left" type="monotone" dataKey="IpcImobiliariaAnterior" name="IPC Imobiliária anterior" stroke={CHART_TEAL} strokeOpacity={0.7} strokeWidth={2} strokeDasharray="6 4" dot={false}>
                          <LabelList dataKey="IpcImobiliariaAnterior" position="top" formatter={fmtDataLabel} {...trendDataLabelProps} />
                        </Line>
                      </>
                    )}

                    {todayComparablePoint && todayVariationPct != null && (
                      <ReferenceDot
                        yAxisId="left"
                        x={todayComparablePoint.day}
                        y={todayComparablePoint.Realizado}
                        r={5}
                        fill={CHART_BLUE}
                        stroke="#ffffff"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                        label={{
                          value: `${todayVariationPct >= 0 ? '↑' : '↓'} ${Math.abs(todayVariationPct).toFixed(1)}%`,
                          position: 'top',
                          fill: CHART_BLUE,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="analysis-chart-empty text-variant">Sem dados para o período selecionado.</div>
              )}
            </div>
          </div>
          )}

          {selectedView !== ANALYSIS_VIEWS.CUMULATIVE && (
          <div className={`analysis-chart-container ${isPropostas ? 'is-propostas-chart' : ''}`} style={chartHeightStyle}>
            <div className="analysis-chart-meta">
              <span className="analysis-chart-title">{kpi.id === 'sla_f' || kpi.id === 'sla_r' ? `SLA e Base de Casos por ${selectedGrainLabelTitle}` : (isIpc ? `Repasses e Base Mensal por ${selectedGrainLabelTitle}` : (isPropostas ? `Propostas por Situação (${selectedGrainLabelTitle})` : `Realizado por ${selectedGrainLabelTitle}`))}</span>
              <div className="analysis-chart-legend">
                {kpi.id === 'sla_f' || kpi.id === 'sla_r' ? (
                  <>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Média SLA no {selectedGrainLabel}
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_PREVIOUS }} /> SLA anterior
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_GRAY }} /> Meta SLA
                    </span>
                  </>
                ) : isIpc ? (
                  <>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: 'rgba(88,144,255,0.7)' }} /> Repasses (Válidos) no {selectedGrainLabel}
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: 'rgba(148,163,184,0.3)' }} /> Repasses anterior
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> IPC Corretor {selectedGrainLabel}
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_TEAL }} /> IPC Imobiliária {selectedGrainLabel}
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_GRAY }} /> Meta IPC
                    </span>
                  </>
                ) : isPropostas ? (
                  <>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Aprovadas</span>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: '#f59e0b' }} /> Condicionadas</span>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: '#ef4444' }} /> Reprovadas</span>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: CHART_TEAL }} /> Total</span>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: CHART_PREVIOUS }} /> Total anterior</span>
                    <span className="analysis-legend-item"><span className="analysis-legend-dot" style={{ background: CHART_GRAY }} /> Meta {selectedGrainLabel} (Aprovadas)</span>
                  </>
                ) : (
                  <>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> Realizado no {selectedGrainLabel}
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_PREVIOUS }} /> Período anterior
                    </span>
                    <span className="analysis-legend-item">
                      <span className="analysis-legend-dot" style={{ background: CHART_GRAY }} /> Meta do {selectedGrainLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="analysis-chart-wrap">
              {dailyBarsData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyBarsData} margin={realizedChartMargin}>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(156,168,184,0.1)" vertical={false} />
                    <XAxis dataKey="day" interval={0} minTickGap={0} tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={isPropostas && propostasYAxisTicks?.length ? [0, propostasYAxisTicks.at(-1)] : undefined}
                      ticks={isPropostas ? propostasYAxisTicks : undefined}
                      tick={{ fontSize: 9, fill: '#9ca8b8' }}
                      tickLine={false}
                      axisLine={false}
                      width={38}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {kpi.id === 'sla_f' || kpi.id === 'sla_r' ? (
                      <>
                        <Bar dataKey="RealizadoDia" name={`Média SLA no ${selectedGrainLabel}`} fill={CHART_BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="RealizadoDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Bar dataKey="AnteriorSlaDia" name="SLA médio no período anterior" fill={CHART_PREVIOUS} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="AnteriorSlaDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Line type="stepAfter" dataKey="MetaDia" name="Meta SLA" stroke={CHART_GRAY} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </>
                    ) : isIpc ? (
                      <>
                        <Bar dataKey="ApoioDia" name={`Repasses no ${selectedGrainLabel}`} fill="rgba(88,144,255,0.7)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="ApoioDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Bar dataKey="ApoioAnteriorDia" name="Repasses período anterior" fill="rgba(148,163,184,0.3)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="ApoioAnteriorDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Line type="monotone" dataKey="IpcCorretorDia" name={`IPC Corretor ${selectedGrainLabel}`} stroke={CHART_BLUE} strokeWidth={2.4} dot={chartPolicy.showDots ? { r: 2, fill: CHART_BLUE } : false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="IpcImobiliariaDia" name={`IPC Imobiliaria ${selectedGrainLabel}`} stroke={CHART_TEAL} strokeWidth={2.4} dot={chartPolicy.showDots ? { r: 2, fill: CHART_TEAL } : false} isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="MetaDia" name="Meta IPC" stroke={CHART_GRAY} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </>
                    ) : isPropostas ? (
                      <>
                        <Bar dataKey="PropostasAprovadasDia" name={`Aprovadas no ${selectedGrainLabel}`} fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="PropostasAprovadasDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} fill="#065f46" />
                        </Bar>
                        <Bar dataKey="PropostasCondicionadasDia" name={`Condicionadas no ${selectedGrainLabel}`} fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="PropostasCondicionadasDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} fill="#b45309" />
                        </Bar>
                        <Bar dataKey="PropostasReprovadasDia" name={`Reprovadas no ${selectedGrainLabel}`} fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="PropostasReprovadasDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} fill="#b91c1c" />
                        </Bar>
                        <Line type="monotone" dataKey="PropostasTotalDia" name={`Total no ${selectedGrainLabel}`} stroke={CHART_TEAL} strokeWidth={2.6} dot={false} isAnimationActive={false} connectNulls>
                          <LabelList
                            dataKey="PropostasTotalDia"
                            content={<LineValueLabel prefix="T" fill="#10b981" dy={-10} />}
                          />
                        </Line>
                        <Line type="monotone" dataKey="AnteriorDia" name="Total no período anterior" stroke={CHART_PREVIOUS} strokeWidth={2.2} dot={false} isAnimationActive={false} connectNulls>
                          <LabelList
                            dataKey="AnteriorDia"
                            content={<LineValueLabel prefix="Ant" fill="#b45309" dy={16} />}
                          />
                        </Line>
                        <Line type="stepAfter" dataKey="MetaDia" name={`Meta do ${selectedGrainLabel} (Aprovadas)`} stroke={CHART_GRAY} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="RealizadoDia" name={`Realizado no ${selectedGrainLabel}`} fill={CHART_BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="RealizadoDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Bar dataKey="AnteriorDia" name="Realizado no período anterior" fill={CHART_PREVIOUS} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="AnteriorDia" position="top" formatter={fmtDataLabel} {...dataLabelProps} />
                        </Bar>
                        <Line type="stepAfter" dataKey="MetaDia" name={`Meta do ${selectedGrainLabel}`} stroke={CHART_GRAY} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="analysis-chart-empty text-variant">Sem dados diários para o período selecionado.</div>
              )}
            </div>
          </div>
          )}

          {isIpc && ipcMonthlyActiveBaseData.length > 0 && (
            <div className="analysis-chart-container analysis-ipc-monthly-base-chart">
              <div className="analysis-chart-meta">
                <div className="analysis-chart-title-block">
                  <span className="analysis-chart-title">Repasses, Base Ativa e IPC por {ipcActiveBaseGrainLabelTitle}</span>
                  <span className="analysis-chart-subtitle">Leitura por {ipcActiveBaseGrainLabel}: repasses válidos contra corretores ativos.</span>
                </div>
                <div className="analysis-chart-kpis">
                  <span>{fmt(ipcMonthlyBaseStats.totalRepasses, 'un')} repasses</span>
                  <span>{fmt(ipcMonthlyBaseStats.averageCorretores, 'un')} corretores médios</span>
                  <span>Pico IPC {fmt(ipcMonthlyBaseStats.peakIpc, 'ratio')}</span>
                  <span>{ipcMonthlyBaseStats.observedPeriods} {ipcActiveBaseGrainLabel}(s)</span>
                </div>
                <div className="analysis-chart-legend">
                  <span className="analysis-legend-item">
                    <span className="analysis-legend-dot" style={{ background: 'rgba(88,144,255,0.72)' }} /> Repasses válidos
                  </span>
                  <span className="analysis-legend-item">
                    <span className="analysis-legend-bar" style={{ background: 'rgba(128,179,255,0.18)' }} /> Corretores ativos
                  </span>
                  <span className="analysis-legend-item">
                    <span className="analysis-legend-dot" style={{ background: CHART_BLUE }} /> IPC Corretor por {ipcActiveBaseGrainLabel}
                  </span>
                </div>
              </div>
              <div className="analysis-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ipcMonthlyActiveBaseData} margin={{ top: 18, right: 8, left: -14, bottom: 22 }}>
                    <defs>
                      <linearGradient id="gradIpcMonthlyRepasses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.78} />
                        <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0.26} />
                      </linearGradient>
                      <linearGradient id="gradIpcMonthlyBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_ORANGE} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={CHART_ORANGE} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(156,168,184,0.1)" vertical={false} />
                    <XAxis dataKey="day" interval={0} tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="volume" tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} width={38} />
                    <YAxis yAxisId="ipc" orientation="right" tick={{ fontSize: 9, fill: '#9ca8b8' }} tickLine={false} axisLine={false} width={38} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      yAxisId="volume"
                      type="monotone"
                      dataKey="CorretoresAtivosPeriodo"
                      name="Corretores ativos"
                      stroke={CHART_ORANGE}
                      strokeWidth={2.4}
                      fill="url(#gradIpcMonthlyBase)"
                      dot={{ r: 2.5, fill: CHART_ORANGE }}
                      isAnimationActive={false}
                    >
                      <LabelList dataKey="CorretoresAtivosPeriodo" position="top" formatter={fmtDataLabel} {...getDataLabelProps(ipcMonthlyActiveBaseData.length)} />
                    </Area>
                    <Bar yAxisId="volume" dataKey="RepassesPeriodo" name="Repasses válidos" fill="url(#gradIpcMonthlyRepasses)" radius={[4, 4, 0, 0]} barSize={24} isAnimationActive={false}>
                      <LabelList dataKey="RepassesPeriodo" position="top" formatter={fmtDataLabel} {...getDataLabelProps(ipcMonthlyActiveBaseData.length)} />
                    </Bar>
                    <Line
                      yAxisId="ipc"
                      type="monotone"
                      dataKey="IpcCorretorPeriodo"
                      name="IPC Corretor"
                      stroke={CHART_BLUE}
                      strokeWidth={2.2}
                      dot={{ r: 2.4, fill: CHART_BLUE }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}


          {/* IPC: Dual-column Corretor vs Imobiliária layout */}
          {isIpc ? (
            <>
              {/* Summary KPIs for IPC */}
              <div className="analysis-summary-row is-five" style={{ marginBottom: '1.2rem' }}>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Repasses Atuais</span>
                  <span className="analysis-summary-value">{fmt(kpi.numerator, 'un')}</span>
                  <span className="analysis-ipc-summary-hint">
                    {fmt(ipcSummary.repassesAtribuidos, 'un')} atribuídos · {fmt(ipcSummary.repassesSemVinculo, 'un')} sem vínculo
                  </span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Corretores-mês</span>
                  <span className="analysis-summary-value">{fmt(kpi.denominator, 'un')}</span>
                  <span className="analysis-ipc-summary-hint">
                    {ipcCoverage.corretoresComRepasse} com repasse · {ipcCoverage.corretoresSemRepasse} sem · {fmt(ipcCoverage.corretoresRepassesSemVinculo, 'un')} rep. sem vínculo
                  </span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Imobiliárias-mês</span>
                  <span className="analysis-summary-value">{fmt(kpi.denominatorSecondary, 'un')}</span>
                  <span className="analysis-ipc-summary-hint">
                    {ipcCoverage.imobiliariasComRepasse} com repasse · {ipcCoverage.imobiliariasSemRepasse} sem · {fmt(ipcCoverage.imobiliariasRepassesSemVinculo, 'un')} rep. sem vínculo
                  </span>
                </div>
                <div className="analysis-summary-card" style={{ background: 'rgba(52, 120, 246, 0.05)' }}>
                  <span className="analysis-summary-label" style={{ color: CHART_BLUE }}>IPC Corretor</span>
                  <span className="analysis-summary-value" style={{ color: CHART_BLUE }}>{fmt(kpi.actual, kpi.unit)}</span>
                </div>
                <div className="analysis-summary-card" style={{ background: 'rgba(20, 184, 166, 0.05)' }}>
                  <span className="analysis-summary-label" style={{ color: CHART_TEAL }}>IPC Imobiliária</span>
                  <span className="analysis-summary-value" style={{ color: CHART_TEAL }}>{fmt(ipcSummary.ipcImobiliaria, kpi.unit)}</span>
                </div>
              </div>

              {/* Dual columns: Corretor vs Imobiliária Rankings */}
              <div className="analysis-ipc-filters">
                <span className="analysis-ipc-filter-label">
                  <Filter size={14} /> Filtro de repasses
                </span>
                <div className="analysis-ipc-filter-segmented">
                  <button type="button" className={`analysis-filter-pill ${repasseFilter === 'all' ? 'is-active' : ''}`} onClick={() => setRepasseFilter('all')}>
                    <span>Todos</span>
                    <strong>{ipcRankings.corretores.length}</strong>
                  </button>
                  <button type="button" className={`analysis-filter-pill ${repasseFilter === 'with' ? 'is-active' : ''}`} onClick={() => setRepasseFilter('with')}>
                    <span>Com Repasse</span>
                    <strong>{ipcCoverage.corretoresComRepasse}</strong>
                  </button>
                  <button type="button" className={`analysis-filter-pill ${repasseFilter === 'without' ? 'is-active' : ''}`} onClick={() => setRepasseFilter('without')}>
                    <span>Sem Repasse</span>
                    <strong>{ipcCoverage.corretoresSemRepasse}</strong>
                  </button>
                </div>
              </div>

              <div className="analysis-ipc-dual" style={{ marginBottom: '1.5rem' }}>
                <div className="analysis-ipc-column">
                  <div className="analysis-ipc-column-header">
                    <span className="analysis-ipc-column-icon"><UserRound size={16} /></span>
                    <div>
                      <span className="analysis-ipc-column-title">Visão por Corretor</span>
                      <span className="analysis-ipc-column-subtitle">Repasses, base mensal e IPC por corretor ativo</span>
                    </div>
                  </div>
                  <div className="analysis-ipc-column-list" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    {filteredIpcRankings.corretores.map((item, idx) => {
                      const repasses = Number(item.value) || 0;
                      const maxRepasses = Math.max(...ipcRankings.corretores.map((x) => Number(x.value) || 0), 1);
                      return (
                        <div key={idx} className={`analysis-ipc-row ${repasses === 0 ? 'is-zero' : ''}`}>
                          <div className="analysis-ipc-row-header">
                            <span className="analysis-ipc-row-name">{item.label}</span>
                            <span className="analysis-ipc-row-ipc">{repasses} rep.</span>
                          </div>
                          <div className="analysis-ipc-row-metrics">
                            <span className="analysis-ipc-row-metric">{Number(item.base) > 0 ? `${fmt(item.base, 'un')} mês(es) ativo` : 'Fora da hierarquia ativa'}</span>
                            <span className="analysis-ipc-row-metric">IPC {fmt(item.ipc, 'ratio')}</span>
                            <span className="analysis-ipc-row-metric analysis-ipc-row-metric--muted">{Number(item.share || 0).toFixed(1)}% dos repasses</span>
                          </div>
                          <div className="analysis-ipc-bar-track">
                            <div className="analysis-ipc-bar-fill analysis-ipc-bar-fill--corretor" style={{ width: `${(repasses / maxRepasses) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!filteredIpcRankings.corretores.length && <span className="text-variant">Sem corretores neste filtro.</span>}
                  </div>
                </div>

                <div className="analysis-ipc-column">
                  <div className="analysis-ipc-column-header">
                    <span className="analysis-ipc-column-icon"><Building2 size={16} /></span>
                    <div>
                      <span className="analysis-ipc-column-title">Visão por Imobiliária</span>
                      <span className="analysis-ipc-column-subtitle">Repasses, base mensal e IPC por imobiliária do corretor</span>
                    </div>
                  </div>
                  <div className="analysis-ipc-column-list" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    {filteredIpcRankings.imobiliarias.map((item, idx) => {
                      const repasses = Number(item.value) || 0;
                      const maxRepasses = Math.max(...ipcRankings.imobiliarias.map((x) => Number(x.value) || 0), 1);
                      return (
                        <div key={idx} className={`analysis-ipc-row ${repasses === 0 ? 'is-zero' : ''}`}>
                          <div className="analysis-ipc-row-header">
                            <span className="analysis-ipc-row-name">{item.label}</span>
                            <span className="analysis-ipc-row-ipc analysis-ipc-row-ipc--imob">{repasses} rep.</span>
                          </div>
                          <div className="analysis-ipc-row-metrics">
                            <span className="analysis-ipc-row-metric">{Number(item.base) > 0 ? `${fmt(item.base, 'un')} mês(es) ativa` : 'Fora da hierarquia ativa'}</span>
                            <span className="analysis-ipc-row-metric">IPC {fmt(item.ipc, 'ratio')}</span>
                            <span className="analysis-ipc-row-metric analysis-ipc-row-metric--muted">{Number(item.share || 0).toFixed(1)}% dos repasses</span>
                          </div>
                          <div className="analysis-ipc-bar-track">
                            <div className="analysis-ipc-bar-fill analysis-ipc-bar-fill--imob" style={{ width: `${(repasses / maxRepasses) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!filteredIpcRankings.imobiliarias.length && <span className="text-variant">Sem imobiliárias neste filtro.</span>}
                  </div>
                </div>
              </div>

              {/* Breakdown Controls for Hierarchical view */}

              <div className="analysis-additional-hierarchy">
                {['operation', 'broker', 'sdr'].map((scope) => {
                  const scopeAxes = visibleAxisConfig.filter((a) => getAxisScope(a) === scope);
                  if (!scopeAxes.length) return null;
                  return (
                    <div key={scope} className={`analysis-scope-group group-${scope}`}>
                      <h3 className="analysis-group-title">{AXIS_SCOPE_LABELS[scope]}</h3>
                      <div className="analysis-additional-grid">
                        {scopeAxes.map((axis) => {
                          const axisScope = getAxisScope(axis);
                          let axisItems = (aggregatedByAxis?.[axis.key] ?? []);
                          if (repasseFilter === 'with') axisItems = axisItems.filter(i => (Number(i.value) || 0) > 0);
                          else if (repasseFilter === 'without') axisItems = axisItems.filter(i => (Number(i.value) || 0) === 0);
                          
                          const visibleItems = axisItems.slice(0, 12);
                          const maxValue = Math.max(...visibleItems.map(i => Number(i.value) || 0), 1);
                          return (
                            <article key={axis.key} className={`analysis-additional-card analysis-axis-${axisScope}`}>
                              <div className="analysis-additional-header">
                                <div className="analysis-additional-title-block">
                                  <span className="analysis-axis-scope">{AXIS_SCOPE_LABELS[axisScope]}</span>
                                  <span className="analysis-additional-title">{axis.title}</span>
                                </div>
                                <span className="analysis-additional-count">{axisItems.length} grupos</span>
                              </div>
                              <div className="analysis-additional-list">
                                {visibleItems.map(item => {
                                  const itemValue = Number(item.value) || 0;
                                  return (
                                    <div key={item.label} className="analysis-additional-row">
                                      <span className="analysis-additional-label">{item.label}</span>
                                      <div className="analysis-additional-progress" aria-hidden="true">
                                        <span className="analysis-additional-progress-fill" style={{ width: `${Math.min((itemValue / maxValue) * 100, 100)}%` }} />
                                      </div>
                                      <strong className="analysis-additional-value">{fmt(itemValue, 'un')} rep</strong>
                                    </div>
                                  );
                                })}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : isPropostas ? (
            <>
              <div className="analysis-summary-row is-five" style={{ marginTop: '0.9rem' }}>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Aprovadas</span>
                  <span className="analysis-summary-value">{fmt(propostasTotals.aprovadas, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Condicionadas</span>
                  <span className="analysis-summary-value">{fmt(propostasTotals.condicionadas, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Reprovadas</span>
                  <span className="analysis-summary-value">{fmt(propostasTotals.reprovadas, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Com Resposta (3 juntas)</span>
                  <span className="analysis-summary-value">{fmt(propostasTotals.total, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">Aprovação</span>
                  <span className="analysis-summary-value">{propostasTotals.total > 0 ? `${((propostasTotals.aprovadas / propostasTotals.total) * 100).toFixed(1)}%` : '0.0%'}</span>
                </div>
              </div>

              <div className="analysis-additional-card" style={{ marginTop: '0.9rem' }}>
                <div className="analysis-additional-header" style={{ marginBottom: '0.6rem' }}>
                  <span className="analysis-additional-title">Segmentação de Propostas</span>
                  <span className="analysis-additional-count">Filtro principal: Com Resposta (3 juntas)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {propostasDimensionSets.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPropostasView(item.key)}
                      style={{
                        border: propostasView === item.key ? '1px solid rgba(71, 85, 105, 0.95)' : '1px solid rgba(71, 85, 105, 0.45)',
                        background: propostasView === item.key ? 'rgba(30, 41, 59, 0.5)' : 'rgba(15, 23, 42, 0.22)',
                        color: propostasView === item.key ? '#cbd5e1' : '#94a3b8',
                        borderRadius: '8px',
                        padding: '0.32rem 0.62rem',
                        fontSize: '0.74rem',
                        fontWeight: propostasView === item.key ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {propostasSelectedSet && (() => {
                const set = propostasSelectedSet;
                const cityData = generateBreakdownData(set.axis);
                const empreendimentoData = (set.axis?.empreendimento ?? []).slice(0, 12);
                const cityMax = Math.max(...cityData.map((item) => Number(item.value) || 0), 1);
                return (
                  <div key={set.key} className="analysis-breakdown" style={{ marginTop: '0.9rem' }}>
                    <div className="analysis-breakdown-card analysis-axis-operation">
                      <span className="analysis-breakdown-title">Distribuição por Região da Operação ({set.title})</span>
                      <div className="analysis-breakdown-items">
                        {isLoadingBreakdown ? (
                          <BreakdownLoadingRows />
                        ) : (
                          <>
                            {cityData.map((item) => (
                              <div key={`${set.key}-${item.name}`}>
                                <div className="analysis-breakdown-item-header">
                                  <span className="analysis-breakdown-item-name">{item.name}</span>
                                  <span className="analysis-breakdown-item-value">{`${fmt(item.value, 'un')} (${item.share}%)`}</span>
                                </div>
                                <div className="analysis-breakdown-bar-track">
                                  <div className="analysis-breakdown-bar-fill" style={{ width: `${(item.value / cityMax) * 100}%` }} />
                                </div>
                              </div>
                            ))}
                            {!cityData.length && <span className="text-variant">Sem dados suficientes</span>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="analysis-breakdown-card analysis-axis-operation">
                      <span className="analysis-breakdown-title">Por Empreendimento da Operação ({set.title})</span>
                      <div className="analysis-breakdown-items">
                        {isLoadingBreakdown ? (
                          <BreakdownLoadingRows />
                        ) : (
                          <>
                            {empreendimentoData.map((item) => {
                              const empreendimentoMax = Math.max(...empreendimentoData.map((x) => Number(x.value) || 0), 1);
                              const itemValue = Number(item.value) || 0;
                              return (
                                <div key={`${set.key}-${item.label}`}>
                                  <div className="analysis-breakdown-item-header">
                                    <span className="analysis-breakdown-item-name">{item.label}</span>
                                    <span className="analysis-breakdown-item-value">{fmt(itemValue, 'un')}</span>
                                  </div>
                                  <div className="analysis-breakdown-bar-track">
                                    <div className="analysis-breakdown-bar-fill" style={{ width: `${(itemValue / empreendimentoMax) * 100}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                            {!empreendimentoData.length && <span className="text-variant">Sem dados suficientes</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="analysis-additional-grid" style={{ marginTop: '0.9rem' }}>
                {[
                  { key: 'aprovadas', title: 'Aprovadas', value: propostasTotals.aprovadas, color: CHART_BLUE },
                  { key: 'condicionadas', title: 'Condicionadas', value: propostasTotals.condicionadas, color: '#f59e0b' },
                  { key: 'reprovadas', title: 'Reprovadas', value: propostasTotals.reprovadas, color: '#ef4444' },
                  { key: 'com-resposta', title: 'Com Resposta - Geral', value: propostasTotals.total, color: CHART_TEAL },
                ].map((item) => (
                  <article key={item.key} className="analysis-additional-card">
                    <div className="analysis-additional-header">
                      <span className="analysis-additional-title">{item.title}</span>
                      <span className="analysis-additional-count">{fmt(item.value, 'un')}</span>
                    </div>
                    <div className="analysis-additional-list">
                      <div className="analysis-additional-row">
                        <span className="analysis-additional-label">Valor bruto</span>
                        <div className="analysis-additional-progress" aria-hidden="true">
                          <span className="analysis-additional-progress-fill" style={{ width: `${propostasTotals.total > 0 ? (item.value / propostasTotals.total) * 100 : 0}%`, background: item.color }} />
                        </div>
                        <strong className="analysis-additional-value">{fmt(item.value, 'un')}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {propostasSelectedSet && (
                <div key={`${propostasSelectedSet.key}-axes`} className="analysis-additional-hierarchy" style={{ marginTop: '0.9rem' }}>
                  {['operation', 'broker', 'sdr'].map((scope) => {
                    const scopeAxes = visibleAxisConfig.filter((a) => getAxisScope(a) === scope);
                    if (!scopeAxes.length) return null;

                    return (
                      <div key={scope} className={`analysis-scope-group group-${scope}`}>
                        <h3 className="analysis-group-title">{AXIS_SCOPE_LABELS[scope]}</h3>
                        <div className="analysis-additional-grid">
                          {scopeAxes.map((axis) => {
                            const axisScope = getAxisScope(axis);
                            const axisItems = (propostasSelectedSet.axis?.[axis.key] ?? []).slice(0, 12);
                            const maxValue = Math.max(...axisItems.map((item) => Number(item.value) || 0), 1);
                            return (
                              <article key={`${propostasSelectedSet.key}-${axis.key}`} className={`analysis-additional-card analysis-axis-${axisScope}`}>
                                <div className="analysis-additional-header">
                                  <div className="analysis-additional-title-block">
                                    <span className="analysis-axis-scope">{AXIS_SCOPE_LABELS[axisScope]}</span>
                                    <span className="analysis-additional-title">{axis.title} ({propostasSelectedSet.title})</span>
                                  </div>
                                  <span className="analysis-additional-count">{axisItems.length} grupos</span>
                                </div>
                                <div className="analysis-additional-list">
                                  {isLoadingBreakdown ? (
                                    <BreakdownLoadingRows rows={4} />
                                  ) : (
                                    <>
                                      {axisItems.map((item) => {
                                        const itemValue = Number(item.value) || 0;
                                        return (
                                          <div key={`${propostasSelectedSet.key}-${axis.key}-${item.label}`} className="analysis-additional-row">
                                            <span className="analysis-additional-label">{item.label}</span>
                                            <div className="analysis-additional-progress" aria-hidden="true">
                                              <span
                                                className="analysis-additional-progress-fill"
                                                style={{ width: `${Math.min((itemValue / maxValue) * 100, 100)}%` }}
                                              />
                                            </div>
                                            <strong className="analysis-additional-value">{fmt(itemValue, 'un')}</strong>
                                          </div>
                                        );
                                      })}
                                      {!axisItems.length && <span className="text-variant">Sem dados suficientes</span>}
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : isSla ? (
            <>
              <div className="analysis-breakdown">
                {slaTopCards.map((card) => {
                  const maxAssinaturas = Math.max(...card.items.map((x) => Number(x.assinaturas) || 0), 1);
                  return (
                    <div key={card.key} className={`analysis-breakdown-card analysis-axis-${card.scope}`}>
                      <span className="analysis-breakdown-title">{card.title}</span>
                      <div className="analysis-breakdown-items">
                        {card.items.map((item) => {
                          const assinaturas = Number(item.assinaturas) || 0;
                          return (
                            <div key={`${card.key}-${item.corretor}`}>
                              <div className="analysis-breakdown-item-header">
                                <span className="analysis-breakdown-item-name">{item.corretor}</span>
                                <span className="analysis-breakdown-item-value">{assinaturas} {slaVolumeLabel}</span>
                              </div>
                              <div className="analysis-breakdown-bar-track">
                                <div className="analysis-breakdown-bar-fill" style={{ width: `${(assinaturas / maxAssinaturas) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {!card.items.length && (
                          <span className="text-variant">Sem {slaVolumeLabel} no período.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="analysis-scope-group group-broker">
                <h3 className="analysis-group-title">Hierarquia mensal do Corretor</h3>
                <div className="analysis-additional-grid">
                  {slaHierarchyCards.map((card) => {
                    const maxAssinaturas = Math.max(...card.items.map((x) => Number(x.assinaturas) || 0), 1);
                    return (
                      <article key={card.key} className="analysis-additional-card analysis-axis-broker">
                        <div className="analysis-additional-header">
                          <div className="analysis-additional-title-block">
                            <span className="analysis-axis-scope">Corretor</span>
                            <span className="analysis-additional-title">{card.title}</span>
                          </div>
                          <span className="analysis-additional-count">{card.items.length} grupos</span>
                        </div>
                        <div className="analysis-additional-list">
                          {card.items.map((item) => {
                            const assinaturas = Number(item.assinaturas) || 0;
                            return (
                              <div key={`${card.key}-${item.corretor}`} className="analysis-additional-row">
                                <span className="analysis-additional-label">{item.corretor}</span>
                                <div className="analysis-additional-progress" aria-hidden="true">
                                  <span
                                    className="analysis-additional-progress-fill"
                                    style={{ width: `${Math.min((assinaturas / maxAssinaturas) * 100, 100)}%` }}
                                  />
                                </div>
                                <strong className="analysis-additional-value">{assinaturas} {slaVolumeLabel}</strong>
                              </div>
                            );
                          })}
                          {!card.items.length && <span className="text-variant">Sem dados suficientes</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="analysis-breakdown">
                <div className="analysis-breakdown-card">
                  <div className="analysis-additional-header" style={{ marginBottom: '0.45rem' }}>
                    <span className="analysis-breakdown-title">{isSlaRepasse ? 'Pendências sem Assinatura por Situação' : 'Pendências sem Contabilização por Situação'}</span>
                    <select
                      value={pendingMinDays}
                      onChange={(e) => setPendingMinDays(e.target.value)}
                      style={{
                        background: 'rgba(10,18,34,0.8)',
                        border: '1px solid rgba(156,168,184,0.25)',
                        color: '#d7dde6',
                        borderRadius: '8px',
                        padding: '0.25rem 0.45rem',
                        fontSize: '0.72rem',
                      }}
                    >
                      <option value="0">Todas pendências</option>
                      <option value="15">Somente &gt;= 15 dias</option>
                      <option value="30">Somente &gt;= 30 dias</option>
                    </select>
                  </div>
                  <div className="analysis-breakdown-items">
                    {pendingStatusResolved.map((item) => {
                      const maxPendencias = Math.max(...pendingStatusResolved.map((x) => Number(x.total) || 0), 1);
                      const total = Number(item.total) || 0;
                      return (
                        <div key={item.situacaoRepasse}>
                          <div className="analysis-breakdown-item-header">
                            <span className="analysis-breakdown-item-name">{item.situacaoRepasse}</span>
                            <span className="analysis-breakdown-item-value">{total} casos</span>
                          </div>
                          <div className="analysis-breakdown-bar-track">
                            <div className="analysis-breakdown-bar-fill" style={{ width: `${(total / maxPendencias) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!pendingStatusResolved.length && (
                      <span className="text-variant">
                        {isSlaFinalizacao
                          ? 'Detalhamento de pendências indisponível para a fonte atual.'
                          : 'Sem pendências para o filtro selecionado.'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="analysis-additional-grid">
                <article className="analysis-additional-card">
                  <div className="analysis-additional-header">
                    <span className="analysis-additional-title">{isSlaRepasse ? 'Maiores SLA (Contrato → Assinatura)' : 'Maiores SLA (Reserva → Contabilização)'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="analysis-additional-count">{maioresSlaOrdenados.length} casos</span>
                      <select
                        value={slaSortMode}
                        onChange={(e) => setSlaSortMode(e.target.value)}
                        style={{
                          background: 'rgba(10,18,34,0.8)',
                          border: '1px solid rgba(156,168,184,0.25)',
                          color: '#d7dde6',
                          borderRadius: '8px',
                          padding: '0.25rem 0.45rem',
                          fontSize: '0.72rem',
                        }}
                      >
                        <option value="desc">Maior SLA primeiro</option>
                        <option value="asc">Menor SLA primeiro</option>
                      </select>
                    </div>
                  </div>
                  <div className="analysis-additional-list">
                    {maioresSlaOrdenados.map((item) => (
                      <div key={`${item.journeyId}-${item.idrepasse ?? 'sem-repasse'}`} className="analysis-additional-row">
                        <span className="analysis-additional-label">{item.corretor}</span>
                        <strong className="analysis-additional-value">
                          {item.slaDias != null ? `${item.slaDias.toFixed(1)} dias` : '—'} · {
                            item.dtContratoContabilizado && item.dtAssinaturaContrato
                              ? `${fmtDate(item.dtContratoContabilizado)} → ${fmtDate(item.dtAssinaturaContrato)}`
                              : (periodStart && periodEnd
                                ? `${fmtDate(periodStart)} → ${fmtDate(periodEnd)} (janela do filtro)`
                                : 'sem detalhamento de datas')
                          }
                        </strong>
                      </div>
                    ))}
                    {!maioresSlaOrdenados.length && <span className="text-variant">Sem casos de SLA válidos no período.</span>}
                  </div>
                </article>

                <article className="analysis-additional-card">
                  <div className="analysis-additional-header">
                    <span className="analysis-additional-title">{isSlaRepasse ? 'Com Contabilização e sem Assinatura' : 'Com Reserva e sem Contabilização'}</span>
                    <span className="analysis-additional-count">{pendingTotalResolved} casos</span>
                  </div>
                  <div className="analysis-additional-list">
                    {pendenciasFiltradas.map((item) => {
                      const reservaId = item.idreserva ?? (!isSlaRepasse ? item.idrepasse : null);
                      const entityLabel = isSlaRepasse
                        ? (item.idrepasse ? `Repasse ${item.idrepasse}` : null)
                        : (reservaId ? `Reserva ${reservaId}` : null);
                      return (
                        <div key={`${item.journeyId}-${item.idrepasse ?? item.idreserva ?? 'sem-id'}`} className="analysis-additional-row">
                          <span className="analysis-additional-label">{item.corretor}</span>
                          <strong className="analysis-additional-value">
                            {entityLabel ? `${entityLabel} · ` : ''}{fmtDate(item.dtContratoContabilizado)} · {item.diasSemAssinatura != null ? `${item.diasSemAssinatura.toFixed(1)} dias` : '—'} · {item.situacaoRepasse}
                          </strong>
                        </div>
                      );
                    })}
                    {!pendenciasFiltradas.length && (
                      <span className="text-variant">
                        {pendingTotalResolved > 0
                          ? `${pendingTotalResolved} casos sem detalhamento de pendência para o filtro selecionado.`
                          : 'Não há casos pendentes para o filtro selecionado.'}
                      </span>
                    )}
                  </div>
                </article>
              </div>

              <div className="analysis-summary-row is-five" style={{ marginTop: '0.9rem' }}>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">{isSlaRepasse ? 'Contratos Contabilizados' : 'Contabilizações no Período'}</span>
                  <span className="analysis-summary-value">{fmt(isSlaRepasse ? slaRepasseSummary?.contabilizadosPeriodo : slaRepasseSummary?.contabilizacoesPeriodo, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">{isSlaRepasse ? 'Com Assinatura' : 'Reservas Cadastradas'}</span>
                  <span className="analysis-summary-value">{fmt(isSlaRepasse ? slaRepasseSummary?.comAssinatura : slaRepasseSummary?.contabilizadosPeriodo, 'un')}</span>
                </div>
                <div className="analysis-summary-card">
                  <span className="analysis-summary-label">{isSlaRepasse ? 'Sem Assinatura' : 'Sem Contabilização'}</span>
                  <span className="analysis-summary-value">{fmt(pendingTotalResolved, 'un')}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Non-IPC: Original breakdown layout */}
              <div className="analysis-breakdown" style={{ position: 'relative' }}>
                {isLoadingBreakdown && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(var(--surface-rgb, 255,255,255), 0.7)',
                    backdropFilter: 'blur(2px)',
                    borderRadius: '8px',
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Carregando breakdown…</span>
                  </div>
                )}
                <div className="analysis-breakdown-card analysis-axis-operation">
                  <span className="analysis-breakdown-title">Distribuição por Região da Operação</span>
                  <div className="analysis-breakdown-items">
                    {breakdownData.map((item) => (
                      <div key={item.name}>
                        <div className="analysis-breakdown-item-header">
                          <span className="analysis-breakdown-item-name">{item.name}</span>
                          <span className="analysis-breakdown-item-value">
                            {isSla ? fmtSlaBreakdown(item, kpi.unit) : `${fmt(item.value, kpi.unit)} (${item.share}%)`}
                          </span>
                        </div>
                        <div className="analysis-breakdown-bar-track">
                          <div className="analysis-breakdown-bar-fill" style={{ width: `${(item.value / maxBreakdown) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analysis-breakdown-card analysis-axis-operation">
                  <span className="analysis-breakdown-title">Por Empreendimento da Operação</span>
                  <div className="analysis-breakdown-items">
                    {limitedEmpreendimentos.map((item) => {
                      const empreendimentoMax = Math.max(...limitedEmpreendimentos.map((x) => Number(x.value) || 0), 1);
                      const itemValue = Number(item.value) || 0;
                      return (
                        <div key={item.label}>
                          <div className="analysis-breakdown-item-header">
                            <span className="analysis-breakdown-item-name">{item.label}</span>
                            <span className="analysis-breakdown-item-value">
                              {isSla ? fmtSlaBreakdown(item, kpi.unit) : fmt(itemValue, kpi.unit)}
                            </span>
                          </div>
                          <div className="analysis-breakdown-bar-track">
                            <div className="analysis-breakdown-bar-fill" style={{ width: `${(itemValue / empreendimentoMax) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!limitedEmpreendimentos.length && (
                      <span className="text-variant">Sem dados suficientes</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="analysis-additional-hierarchy">
                {['operation', 'broker', 'sdr'].map((scope) => {
                  const scopeAxes = visibleAxisConfig.filter((a) => getAxisScope(a) === scope);
                  if (!scopeAxes.length) return null;

                  return (
                    <div key={scope} className={`analysis-scope-group group-${scope}`}>
                      <h3 className="analysis-group-title">{AXIS_SCOPE_LABELS[scope]}</h3>
                      <div className="analysis-additional-grid">
                        {scopeAxes.map((axis) => {
                          const axisScope = getAxisScope(axis);
                          const axisItems = (aggregatedByAxis?.[axis.key] ?? []).slice(0, 12);
                          const maxValue = Math.max(...axisItems.map((item) => Number(item.value) || 0), 1);
                          return (
                            <article key={axis.key} className={`analysis-additional-card analysis-axis-${axisScope}`}>
                              <div className="analysis-additional-header">
                                <div className="analysis-additional-title-block">
                                  <span className="analysis-axis-scope">{AXIS_SCOPE_LABELS[axisScope]}</span>
                                  <span className="analysis-additional-title">{axis.title}</span>
                                </div>
                                <span className="analysis-additional-count">{axisItems.length} grupos</span>
                              </div>
                              <div className="analysis-additional-list">
                                {axisItems.map((item) => {
                                  const itemValue = Number(item.value) || 0;
                                  return (
                                    <div key={item.label} className="analysis-additional-row">
                                      <span className="analysis-additional-label">{item.label}</span>
                                      <div className="analysis-additional-progress" aria-hidden="true">
                                        <span
                                          className="analysis-additional-progress-fill"
                                          style={{ width: `${Math.min((itemValue / maxValue) * 100, 100)}%` }}
                                        />
                                      </div>
                                      <strong className="analysis-additional-value">
                                        {isSla ? fmtSlaBreakdown(item, kpi.unit) : fmt(itemValue, kpi.unit)}
                                      </strong>
                                    </div>
                                  );
                                })}
                                {!axisItems.length && <span className="text-variant">Sem dados suficientes</span>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Annotation */}
          <div className="analysis-annotation">
            <span className="analysis-annotation-title">Leitura analítica</span>
            <p className="analysis-annotation-text">
              {isIpc
                ? `O IPC por Corretor está em ${fmt(kpi.actual, kpi.unit)} e o IPC por Imobiliária em ${fmt(ipcSummary.ipcImobiliaria, kpi.unit)} no período. Atingimento da meta de corretor em ${attainmentValue.toFixed(1)}%.${
                  hasGap
                    ? ` Gap de ${fmt(Math.abs(gapValue), kpi.unit)} em relação à meta requer aumento no ritmo de repasses.`
                    : ' Indicador em rota favorável para cumprimento da meta.'
                }`
                : isPropostas
                  ? `${kpiTitle} considera a ultima movimentacao por idprecadastro dentro dos status Aprovada, Condicionada e Reprovada no periodo filtrado. No período, temos ${fmt(propostasTotals.aprovadas, 'un')} aprovadas, ${fmt(propostasTotals.condicionadas, 'un')} condicionadas e ${fmt(propostasTotals.reprovadas, 'un')} reprovadas (total com resposta ${fmt(propostasTotals.total, 'un')}). ${showForecast ? `Forecast projeta ${fmt(forecastValue, kpi.unit)} propostas com resposta no fechamento.` : ''}${hasGap ? ` Gap atual de ${fmt(Math.abs(gapValue), kpi.unit)} para a meta de propostas com resposta.` : ' Indicador em rota favorável para a meta de propostas com resposta.'}`
                : isCancelamentos
                  ? cancelamentosAnnotation
                : isSlaFinalizacao
                  ? slaFinalizacaoAnnotation
                : `${showForecast
                  ? `${kpiTitle} apresenta atingimento de ${attainmentValue.toFixed(1)}% no período, com forecast projetando ${
                    fmt(forecastValue, kpi.unit)
                  } para o fechamento.`
                  : `${kpiTitle} encerra o período com ${fmt(kpi.actual, kpi.unit)} realizadas.`}${
                  hasGap
                    ? ` Gap de ${fmt(Math.abs(gapValue), kpi.unit)} em relação à meta requer atenção no ritmo das próximas semanas.`
                    : ' Indicador em rota favorável para cumprimento da meta no ciclo atual.'
                }`}
            </p>
            <p className="analysis-annotation-text" style={{ marginTop: '0.5rem', opacity: 0.88 }}>
              {forecastRuleText} {gapRuleText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
