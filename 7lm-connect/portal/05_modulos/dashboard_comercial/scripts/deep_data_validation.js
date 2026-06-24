
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'http://localhost:3001';
const API_SUMMARY = `${BASE_URL}/api/v1/dashboard/summary`;
const API_BREAKDOWN = `${BASE_URL}/api/v1/dashboard/breakdown`;
const API_FILTERS = `${BASE_URL}/api/v1/dashboard/filters`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validate() {
  console.log('🔍 Iniciando Validação Profunda de Paridade Summary vs Breakdown...');
  
  // 1. Get Global Summary
  const globalSummaryResp = await fetch(`${API_SUMMARY}?startDate=2024-01-01&endDate=2024-12-31`);
  const globalSummary = await globalSummaryResp.json();
  const totalLeadsGlobal = globalSummary.total_leads;
  console.log(`📊 Total Leads Global (Summary): ${totalLeadsGlobal}`);

  // 2. Get Breakdown by Cidade
  const breakdownResp = await fetch(`${API_BREAKDOWN}?startDate=2024-01-01&endDate=2024-12-31&kpi=leads`);
  const breakdown = await breakdownResp.json();
  
  const axes = ['cidade', 'corretor', 'empreendimento', 'gerencia', 'coordenacao'];
  for (const axis of axes) {
    const sum = (breakdown.byAxis[axis] || []).reduce((acc, curr) => acc + Number(curr.value), 0);
    console.log(`📊 Soma Leads Breakdown (${axis}): ${sum}`);
    const axisDiff = Math.abs(totalLeadsGlobal - sum);
    if (axisDiff > 1) {
      console.error(`❌ DISCREPÂNCIA DETECTADA em ${axis}: Summary (${totalLeadsGlobal}) vs Breakdown Sum (${sum}). Diff: ${axisDiff}`);
    } else {
      console.log(`✅ Paridade em ${axis} validada.`);
    }
  }

  // 3. Test combinations
  console.log('🧪 Testando combinações de filtros (Corretor + Cidade)...');
  const filtersResp = await fetch(API_FILTERS);
  const filters = await filtersResp.json();
  
  const sampleCorretores = filters.corretor.slice(0, 3);
  const sampleCidades = filters.cidade.slice(0, 3);

  for (const corretor of sampleCorretores) {
    for (const cidade of sampleCidades) {
      const url = `${API_SUMMARY}?startDate=2024-01-01&endDate=2024-12-31&corretor=${encodeURIComponent(corretor)}&cidade=${encodeURIComponent(cidade)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`❌ FALHA: Corretor "${corretor}" + Cidade "${cidade}" -> HTTP ${resp.status}`);
      } else {
        const data = await resp.json();
        console.log(`✅ OK: Corretor "${corretor}" + Cidade "${cidade}" -> Leads: ${data.total_leads}`);
      }
    }
  }

  console.log('🏁 Validação profunda concluída.');
}

validate().catch(console.error);
