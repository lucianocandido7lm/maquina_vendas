#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 1);
};

const baseUrl = getArg('--base-url', process.env.BENCH_BASE_URL || 'http://127.0.0.1:3001');
const startDate = getArg('--start', process.env.BENCH_START_DATE || '2026-06-01');
const endDate = getArg('--end', process.env.BENCH_END_DATE || '2026-06-24');
const iterations = Math.max(1, Number.parseInt(getArg('--iterations', process.env.BENCH_ITERATIONS || '5'), 10) || 5);
const timeoutMs = Math.max(1000, Number.parseInt(getArg('--timeout-ms', process.env.BENCH_TIMEOUT_MS || '20000'), 10) || 20000);
const outputPath = getArg('--output', process.env.BENCH_OUTPUT || '');

const endpoints = [
  `/api/v1/dashboard/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120`,
  `/api/v1/dashboard/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&fields=cidade,empreendimento,empreendimentoReduzido,imobiliaria`,
  `/api/v1/dashboard/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&cidade=CATALAO`,
  `/api/v1/dashboard/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&empreendimentoReduzido=CATALAO`,
  `/api/v1/dashboard/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&imobiliaria=AUTONOMOS%20LFSA`,
  `/api/v1/dashboard/segmented/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120`,
  `/api/v1/dashboard/segmented/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&fields=regiaoOperacao,imobiliariaOperacao,empreendimento`,
  `/api/v1/dashboard/segmented/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&regiaoOperacao=CATALAO`,
  `/api/v1/dashboard/segmented/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&imobiliariaOperacao=AUTONOMOS%20LFSA`,
  `/api/v1/dashboard/reservas/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120`,
  `/api/v1/dashboard/reservas/filters?startDate=${startDate}&endDate=${endDate}&lite=true&limit=120&fields=situacaoAtual,repasseNoMes`,
  `/api/v1/dashboard/filters/search?field=regiaoOperacao&q=rio&startDate=${startDate}&endDate=${endDate}&limit=40`,
  `/api/v1/dashboard/filters/search?field=cidade&q=cat&startDate=${startDate}&endDate=${endDate}&limit=40`,
  `/api/v1/dashboard/filters/search?field=empreendimento&q=cat&startDate=${startDate}&endDate=${endDate}&limit=40`,
  `/api/v1/dashboard/filters/search?field=imobiliaria&q=auto&startDate=${startDate}&endDate=${endDate}&limit=40`,
  `/api/v1/dashboard/overview?startDate=${startDate}&endDate=${endDate}&regiaoOperacao=CATALAO`,
  `/api/v1/dashboard/summary?startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/trends?startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/reservas/trends?startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/reservas/breakdown?axis=all&startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/corretores/consolidado?startDate=${startDate}&endDate=${endDate}&page=1&pageSize=50`,
  `/api/v1/dashboard/corretores/diario?startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/funnel?startDate=${startDate}&endDate=${endDate}`,
  `/api/v1/dashboard/funnel/goals?startDate=${startDate}&endDate=${endDate}&metaRepasse=45`,
];

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

const runOne = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    await response.text();
    return { ok: response.ok, status: response.status, ms: performance.now() - start };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch_error');
    return { ok: false, status: reason, ms: performance.now() - start };
  } finally {
    clearTimeout(timer);
  }
};

const runEndpoint = async (path) => {
  const url = `${baseUrl}${path}`;
  const results = [];
  for (let i = 0; i < iterations; i += 1) {
    results.push(await runOne(url));
  }

  const statuses = {};
  results.forEach((item) => {
    const key = String(item.status);
    statuses[key] = (statuses[key] || 0) + 1;
  });
  const durations = results.map((item) => item.ms).sort((a, b) => a - b);
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;

  return {
    path,
    statuses,
    avgMs: Number(avg.toFixed(1)),
    p50Ms: Number(percentile(durations, 50).toFixed(1)),
    p95Ms: Number(percentile(durations, 95).toFixed(1)),
    maxMs: Number((durations[durations.length - 1] || 0).toFixed(1)),
  };
};

const main = async () => {
  console.log(JSON.stringify({
    startedAt: new Date().toISOString(),
    baseUrl,
    startDate,
    endDate,
    iterations,
    timeoutMs,
  }, null, 2));

  const report = [];
  for (const path of endpoints) {
    // eslint-disable-next-line no-await-in-loop
    const row = await runEndpoint(path);
    report.push(row);
    console.log(`${row.path} | avg=${row.avgMs}ms p50=${row.p50Ms}ms p95=${row.p95Ms}ms max=${row.maxMs}ms statuses=${JSON.stringify(row.statuses)}`);
  }

  const total = report.length;
  const healthy = report.filter((row) => Object.keys(row.statuses).every((status) => status.startsWith('2'))).length;
  const summary = {
    finishedAt: new Date().toISOString(),
    totalEndpoints: total,
    fullyHealthyEndpoints: healthy,
    degradedEndpoints: total - healthy,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify({
      meta: {
        startedAt: new Date().toISOString(),
        baseUrl,
        startDate,
        endDate,
        iterations,
        timeoutMs,
      },
      report,
      summary,
    }, null, 2));
    console.log(`[benchmark-filters] report saved: ${outputPath}`);
  }
};

main().catch((err) => {
  console.error('[benchmark-filters] failed', err?.message || err);
  process.exit(1);
});
