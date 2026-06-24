import { test, expect, request as playwrightRequest } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { getComparisonRange } from '../../src/utils/periodComparison.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const appDir = path.resolve(__dirname, '..', '..');

let serverProcess = null;
let serverAlreadyRunning = false;

const computeRange = () => {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const toISO = (date) => date.toISOString().split('T')[0];
  return { startDate: toISO(start), endDate: toISO(end) };
};

const waitForServer = async (url, timeoutMs = 45000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ctx = await playwrightRequest.newContext();
    try {
      const response = await ctx.get(url);
      if (response.ok()) {
        await ctx.dispose();
        return;
      }
    } catch {
      // retry until timeout
    }
    await ctx.dispose();
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Servidor não respondeu em ${timeoutMs}ms`);
};

test.beforeAll(async () => {
  const { startDate, endDate } = computeRange();
  const probeUrl = `${baseURL}/api/v1/dashboard/summary?startDate=${startDate}&endDate=${endDate}`;
  const probeCtx = await playwrightRequest.newContext();
  try {
    const response = await probeCtx.get(probeUrl);
    if (response.ok()) {
      serverAlreadyRunning = true;
      await probeCtx.dispose();
      return;
    }
  } catch {
    // spawn backend below
  }
  await probeCtx.dispose();

  serverProcess = spawn('node', ['backend/server.js'], {
    cwd: appDir,
    env: { ...process.env },
    stdio: 'ignore',
  });

  await waitForServer(probeUrl);
});

test.afterAll(async () => {
  if (!serverAlreadyRunning && serverProcess) {
    await new Promise((resolve) => {
      serverProcess.once('exit', resolve);
      serverProcess.kill('SIGTERM');
      setTimeout(resolve, 5000);
    });
  }
});

test('summary totals batem com trends e breakdown', async ({ request }) => {
  const { startDate, endDate } = computeRange();
  const previousRange = getComparisonRange(startDate, endDate, 'anterior');

  const summaryResponse = await request.get('/api/v1/dashboard/summary', {
    params: { startDate, endDate },
  });
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = await summaryResponse.json();

  const overviewResponse = await request.get('/api/v1/dashboard/overview', {
    params: {
      startDate,
      endDate,
      prevStartDate: previousRange.start,
      prevEndDate: previousRange.end,
    },
  });
  expect(overviewResponse.ok()).toBeTruthy();
  const overview = await overviewResponse.json();

  const trendsTotalLeads = (overview.trends ?? []).reduce((acc, item) => acc + Number(item.leads || 0), 0);
  const overviewTotalLeads = Number(overview.summary?.total_leads || 0);
  expect(trendsTotalLeads).toBe(overviewTotalLeads);
  expect(overviewTotalLeads).toBeLessThanOrEqual(Number(summary.total_leads || 0));

  const propostasTotal = Number(summary.total_propostas_aprovadas || 0)
    + Number(summary.total_propostas_condicionadas || 0)
    + Number(summary.total_propostas_reprovadas || 0);
  expect(propostasTotal).toBe(Number(summary.total_propostas_geral || 0));

  const breakdownResponse = await request.get('/api/v1/dashboard/breakdown', {
    params: { startDate, endDate, dimension: 'corretor' },
  });
  expect(breakdownResponse.ok()).toBeTruthy();
  const breakdown = await breakdownResponse.json();
  const firstCorretor = (breakdown.byAxis?.corretor ?? [])[0];
  expect(firstCorretor).toBeTruthy();
  if (firstCorretor) {
    expect(Number(firstCorretor.case_count ?? firstCorretor.value ?? 0)).toBeLessThanOrEqual(Number(summary.total_leads || 0));
  }
});

test('filtro por cidade replica contagem', async ({ request }) => {
  const { startDate, endDate } = computeRange();

  const baselineSummaryResponse = await request.get('/api/v1/dashboard/summary', {
    params: { startDate, endDate },
  });
  expect(baselineSummaryResponse.ok()).toBeTruthy();
  const baselineSummary = await baselineSummaryResponse.json();

  const filtersResponse = await request.get('/api/v1/dashboard/filters', {
    params: { startDate, endDate, lite: 'true', limit: '120' },
  });
  expect(filtersResponse.ok()).toBeTruthy();
  const filtersData = await filtersResponse.json();
  const breakdownResponse = await request.get('/api/v1/dashboard/breakdown', {
    params: { startDate, endDate, dimension: 'cidade' },
  });
  expect(breakdownResponse.ok()).toBeTruthy();
  const breakdownFull = await breakdownResponse.json();
  const targetCity = (breakdownFull.byAxis?.cidade ?? []).find((row) => row.label && row.label !== 'Sem informacao' && Number(row.case_count ?? row.value ?? 0) > 0);

  expect(targetCity, 'Nenhuma cidade elegível encontrada para validar filtro').toBeTruthy();
  if (!targetCity) return;

  const targetOption = (filtersData?.cidade ?? []).find((item) => item.label === targetCity.label);
  expect(targetOption, `Cidade ${targetCity.label} não encontrada em filters`).toBeTruthy();
  if (!targetOption) return;

  const filteredResponse = await request.get('/api/v1/dashboard/summary', {
    params: { startDate, endDate, cidade: targetOption.value },
  });
  expect(filteredResponse.ok()).toBeTruthy();
  const filtered = await filteredResponse.json();

  const breakdownFilteredResponse = await request.get('/api/v1/dashboard/breakdown', {
    params: { startDate, endDate, dimension: 'cidade', cidade: targetOption.value },
  });
  expect(breakdownFilteredResponse.ok()).toBeTruthy();
  const breakdown = await breakdownFilteredResponse.json();
  const matchingRow = (breakdown.byAxis?.cidade ?? []).find((row) => row.label === targetOption.label);
  const leadsForCorretor = matchingRow ? Number(matchingRow.case_count ?? matchingRow.value ?? 0) : 0;

  expect(Number(filtered.total_leads || 0)).toBeLessThanOrEqual(Number(baselineSummary.total_leads || 0));
  expect(Number(filtered.total_leads || 0)).toBe(leadsForCorretor);
});
