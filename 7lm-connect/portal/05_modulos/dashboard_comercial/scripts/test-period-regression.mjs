import assert from 'node:assert/strict';
import { getComparisonRange } from '../src/utils/periodComparison.js';

const cases = [
  {
    name: 'anterior faixa customizada',
    input: ['2026-04-01', '2026-04-15', 'anterior'],
    expected: { start: '2026-03-17', end: '2026-03-31' },
  },
  {
    name: 'mes_anterior fechado',
    input: ['2026-04-01', '2026-04-30', 'mes_anterior'],
    expected: { start: '2026-03-01', end: '2026-03-31' },
  },
  {
    name: 'trimestre_anterior fechado',
    input: ['2026-04-01', '2026-06-30', 'trimestre_anterior'],
    expected: { start: '2026-01-01', end: '2026-03-31' },
  },
  {
    name: 'ano_anterior fechado',
    input: ['2026-01-01', '2026-12-31', 'ano_anterior'],
    expected: { start: '2025-01-01', end: '2025-12-31' },
  },
];

for (const testCase of cases) {
  const [start, end, rule] = testCase.input;
  const actual = getComparisonRange(start, end, rule);
  assert.deepEqual(actual, testCase.expected, `Falha: ${testCase.name}`);
}

const ontem = getComparisonRange('2026-04-01', '2026-04-15', 'ontem');
assert.match(ontem.start, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(ontem.start, ontem.end);

console.log('✅ Regressao de periodos validada com sucesso.');
