import { loadLatestInventory } from './filters-inventory.mjs';
import { validateSummary, validateTrends, validateBreakdowns } from './comprehensive_validation.js';

async function main() {
  const inventory = await loadLatestInventory();
  console.log("Inventario carregado.");
  const cidade = inventory.data.cidade[0];
  console.log("Validando cidade:", cidade);
  
  const filters = { cidade: [cidade] };
  const start = "2024-05-01";
  const end = "2024-05-31";
  
  console.log("1. Resumo...");
  const summary = await validateSummary({ start, end, filters });
  console.log("Summary passed:", summary.passed);
  
  console.log("2. Tendencias...");
  const trends = await validateTrends({ start, end, filters, summary: summary.api });
  console.log("Trends passed:", trends.ok);
  
  console.log("3. Quebras...");
  const breakdown = await validateBreakdowns({ start, end, filters, summary: summary.api });
  console.log("Breakdown passed:", breakdown.ok);
  
  console.log("Validação de amostra concluída.");
  process.exit(0);
}
main().catch(console.error);
