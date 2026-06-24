import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'backend', 'reports');

const BASE_URL = (process.env.DASHBOARD_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, '');

const COUNT_METRICS = [
  'total_leads',
  'total_visitas',
  'total_propostas_geral',
  'total_propostas_aprovadas',
  'total_propostas_condicionadas',
  'total_propostas_reprovadas',
  'total_vendas',
  'total_repasses',
  'total_cancelamentos',
  'total_distratos',
];

const METRIC_LABELS = {
  total_leads: 'Leads',
  total_visitas: 'Visitas',
  total_propostas_geral: 'Propostas (total)',
  total_propostas_aprovadas: 'Propostas aprovadas',
  total_propostas_condicionadas: 'Propostas condicionadas',
  total_propostas_reprovadas: 'Propostas reprovadas',
  total_vendas: 'Vendas',
  total_repasses: 'Repasses',
  total_cancelamentos: 'Cancelamentos',
  total_distratos: 'Distratos',
};

const PERIODS = [
  {
    key: 'day',
    label: 'Dia Atual',
    range: () => {
      const today = new Date();
      const iso = toDateInputValue(today);
      return { start: iso, end: iso };
    },
  },
  {
    key: 'week',
    label: 'Semana Atual',
    range: () => {
      const now = new Date();
      const start = new Date(now);
      const weekday = now.getDay();
      const offset = weekday === 0 ? -6 : 1 - weekday; // Monday as first business day
      start.setDate(now.getDate() + offset);
      const end = new Date(now);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    },
  },
  {
    key: 'month',
    label: 'Mês Atual',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    },
  },
];

const toleranceFor = (metricKey) => {
  if (metricKey.startsWith('total_propostas')) return 1;
  if (metricKey === 'total_repasses') return 1;
  if (metricKey === 'total_vendas') return 1;
  return 0;
};

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchSummary(range) {
  const params = new URLSearchParams({ startDate: range.start, endDate: range.end });
  const response = await fetch(`${BASE_URL}/api/v1/dashboard/summary?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao buscar summary (${response.status}): ${text}`);
  }
  return response.json();
}

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

function validateMonotonic(countsByPeriod) {
  const issues = [];
  for (const metric of COUNT_METRICS) {
    const dayValue = countsByPeriod.day?.[metric];
    const weekValue = countsByPeriod.week?.[metric];
    const monthValue = countsByPeriod.month?.[metric];

    const isFiniteDay = Number.isFinite(Number(dayValue));
    const isFiniteWeek = Number.isFinite(Number(weekValue));
    const isFiniteMonth = Number.isFinite(Number(monthValue));

    if (!isFiniteDay && !isFiniteWeek && !isFiniteMonth) continue;

    const tolerance = toleranceFor(metric);

    if (isFiniteWeek && isFiniteDay && weekValue + tolerance < dayValue) {
      issues.push({
        metric,
        type: 'week_lt_day',
        dayValue,
        weekValue,
        tolerance,
      });
    }

    if (isFiniteMonth && isFiniteWeek && monthValue + tolerance < weekValue) {
      issues.push({
        metric,
        type: 'month_lt_week',
        monthValue,
        weekValue,
        tolerance,
      });
    }

    if (isFiniteMonth && isFiniteDay && monthValue + tolerance < dayValue) {
      issues.push({
        metric,
        type: 'month_lt_day',
        monthValue,
        dayValue,
        tolerance,
      });
    }
  }
  return issues;
}

async function main() {
  await ensureReportsDir();

  const periodResults = {};
  const failures = [];

  for (const period of PERIODS) {
    const range = period.range();
    try {
      const summary = await fetchSummary(range);
      periodResults[period.key] = {
        label: period.label,
        range,
        summary,
      };
    } catch (error) {
      failures.push({
        period: period.key,
        label: period.label,
        range,
        error: error.message,
      });
    }
  }

  const countsByPeriod = Object.fromEntries(
    Object.entries(periodResults).map(([key, value]) => [key, value.summary || {}]),
  );

  const monotonicIssues = validateMonotonic(countsByPeriod);

  const report = {
    executedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    periods: periodResults,
    failures,
    monotonicIssues,
  };

  const fileName = `period-validation-${report.executedAt.replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(REPORTS_DIR, fileName);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const safeGet = (periodKey, metricKey) => {
    const value = countsByPeriod[periodKey]?.[metricKey];
    if (value == null) return 'N/D';
    return Number(value);
  };

  console.log('=== Validação de Cartões Executivos ===');
  console.log(`Base URL...............: ${BASE_URL}`);
  console.log(`Relatório salvo em.....: ${reportPath}`);
  console.log('');

  for (const metric of COUNT_METRICS) {
    const label = METRIC_LABELS[metric] || metric;
    const dayValue = safeGet('day', metric);
    const weekValue = safeGet('week', metric);
    const monthValue = safeGet('month', metric);
    console.log(`${label.padEnd(24)} Dia: ${dayValue} | Semana: ${weekValue} | Mês: ${monthValue}`);
  }

  if (failures.length > 0) {
    console.log('\nFalhas ao consultar períodos:');
    failures.forEach(({ period, label, range, error }) => {
      console.log(`- ${label} (${period}) ${range.start} → ${range.end}: ${error}`);
    });
  }

  if (monotonicIssues.length > 0) {
    console.log('\nInconsistências detectadas:');
    for (const issue of monotonicIssues) {
      const label = METRIC_LABELS[issue.metric] || issue.metric;
      if (issue.type === 'week_lt_day') {
        console.log(`- ${label}: semana (${issue.weekValue}) menor que dia (${issue.dayValue}) acima da tolerância (${issue.tolerance})`);
      } else if (issue.type === 'month_lt_week') {
        console.log(`- ${label}: mês (${issue.monthValue}) menor que semana (${issue.weekValue}) acima da tolerância (${issue.tolerance})`);
      } else if (issue.type === 'month_lt_day') {
        console.log(`- ${label}: mês (${issue.monthValue}) menor que dia (${issue.dayValue}) acima da tolerância (${issue.tolerance})`);
      }
    }
  } else {
    console.log('\nNenhuma inconsistência monotônica encontrada.');
  }
}

main().catch((error) => {
  console.error('❌ Falha geral na validação:', error);
  process.exitCode = 1;
});
