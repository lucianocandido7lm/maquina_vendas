#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'backend', 'reports');

const BASE_URL = (process.env.DASHBOARD_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`).replace(/\/$/, '');
const RANGE_START = process.env.PROPOSTAS_START_DATE || new Date().toISOString().slice(0, 10);
const RANGE_END = process.env.PROPOSTAS_END_DATE || RANGE_START;

const STATUS_LABELS = ['APROVADA', 'CONDICIONADA', 'REPROVADA'];

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} for ${url}: ${text}`);
  }
  return response.json();
}

async function fetchSummary() {
  const params = new URLSearchParams({ startDate: RANGE_START, endDate: RANGE_END });
  return fetchJson(`${BASE_URL}/api/v1/dashboard/summary?${params.toString()}`);
}

async function fetchOverview() {
  const params = new URLSearchParams({ startDate: RANGE_START, endDate: RANGE_END });
  return fetchJson(`${BASE_URL}/api/v1/dashboard/overview?${params.toString()}`);
}

async function fetchBreakdown(status) {
  const params = new URLSearchParams({
    startDate: RANGE_START,
    endDate: RANGE_END,
    kpi: 'propostas',
  });
  if (status) params.set('propostaStatus', status);
  return fetchJson(`${BASE_URL}/api/v1/dashboard/breakdown?${params.toString()}`);
}

function sumField(items, key = 'value') {
  return items.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
}

function extractBreakdownTotals(payload = {}) {
  const byAxis = payload.byAxis || {};
  const axes = Object.keys(byAxis);
  return axes.map((axis) => ({
    axis,
    total: sumField(byAxis[axis] || []),
  }));
}

function buildOverviewTotals(overview = {}) {
  const totals = { aprovadas: 0, condicionadas: 0, reprovadas: 0, total: 0 };
  const trendEntries = overview.trends || [];
  for (const entry of trendEntries) {
    totals.aprovadas += Number(entry.propostas_aprovadas) || 0;
    totals.condicionadas += Number(entry.propostas_condicionadas) || 0;
    totals.reprovadas += Number(entry.propostas_reprovadas) || 0;
    totals.total += Number(entry.propostas_total ?? entry.propostas) || 0;
  }
  return totals;
}

async function main() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const summary = await fetchSummary();
  const overview = await fetchOverview();

  const breakdownBase = await fetchBreakdown();
  const breakdownPerStatus = {};
  for (const status of STATUS_LABELS) {
    breakdownPerStatus[status] = await fetchBreakdown(status);
  }

  const overviewTotals = buildOverviewTotals(overview);

  const summaryTotals = {
    aprovadas: Number(summary.total_propostas_aprovadas) || 0,
    condicionadas: Number(summary.total_propostas_condicionadas) || 0,
    reprovadas: Number(summary.total_propostas_reprovadas) || 0,
    total: Number(summary.total_propostas_geral ?? summary.total_propostas) || 0,
  };

  const diff = {
    overview_vs_summary: {
      aprovadas: round(overviewTotals.aprovadas - summaryTotals.aprovadas, 4),
      condicionadas: round(overviewTotals.condicionadas - summaryTotals.condicionadas, 4),
      reprovadas: round(overviewTotals.reprovadas - summaryTotals.reprovadas, 4),
      total: round(overviewTotals.total - summaryTotals.total, 4),
    },
  };

  const breakdownTotals = extractBreakdownTotals(breakdownBase);
  const statusTotals = Object.fromEntries(
    STATUS_LABELS.map((status) => [status, extractBreakdownTotals(breakdownPerStatus[status])]),
  );

  const report = {
    executedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    range: { start: RANGE_START, end: RANGE_END },
    summaryTotals,
    overviewTotals,
    diff,
    breakdownTotals,
    statusTotals,
  };

  const filename = `propostas-consistency-${report.executedAt.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');

  console.log('=== Consistência de Propostas ===');
  console.log(`Período................: ${RANGE_START} → ${RANGE_END}`);
  console.log(`Resumo (API summary)...: aprovadas=${summaryTotals.aprovadas}, condicionadas=${summaryTotals.condicionadas}, reprovadas=${summaryTotals.reprovadas}, total=${summaryTotals.total}`);
  console.log(`Overview (soma séries).: aprovadas=${overviewTotals.aprovadas}, condicionadas=${overviewTotals.condicionadas}, reprovadas=${overviewTotals.reprovadas}, total=${overviewTotals.total}`);
  console.log('Diferença overview-summary (deve ser 0):', diff.overview_vs_summary);

  console.log('\nTotais por eixo (breakdown geral):');
  breakdownTotals.forEach((item) => {
    console.log(`- ${item.axis}: ${round(item.total)}`);
  });

  console.log('\nTotais por eixo por status:');
  for (const status of STATUS_LABELS) {
    console.log(`· ${status}`);
    statusTotals[status].forEach((item) => {
      console.log(`   - ${item.axis}: ${round(item.total)}`);
    });
  }

  console.log(`\nRelatório salvo em ${filepath}`);
}

main().catch((err) => {
  console.error('❌ Falha na validação de propostas:', err);
  process.exitCode = 1;
});
