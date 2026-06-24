
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api/v1/dashboard';
const START_DATE = '2026-04-01'; // Use a representative range
const END_DATE = '2026-05-04';

const results = {
  validations: [],
  summary: {
    total_tested: 0,
    success: 0,
    failed: 0,
    by_type: {}
  }
};

async function runValidation() {
  console.log('🚀 Iniciando validação exaustiva de filtros...');

  try {
    // 1. Pegar todos os filtros
    const filtersRes = await fetch(`${API_BASE}/filters?startDate=${START_DATE}&endDate=${END_DATE}`);
    if (!filtersRes.ok) throw new Error(`Falha ao buscar filtros: ${filtersRes.statusText}`);
    const filters = await filtersRes.json();

    const filterTypes = ['corretor', 'cidade', 'coordenacao', 'gerencia', 'empreendimento'];
    
    for (const type of filterTypes) {
      if (!filters[type]) continue;
      const values = filters[type].filter(f => f.value !== 'todos' && f.value !== 'todas' && f.value !== '__blank__');
      console.log(`\nValidando ${type} (${values.length} valores)...`);
      results.summary.by_type[type] = { total: values.length, success: 0, failed: 0 };

      for (const filterObj of values) {
        const val = filterObj.value;
        const success = await validateSingleFilter(type, val);
        results.summary.total_tested++;
        if (success) {
          results.summary.success++;
          results.summary.by_type[type].success++;
        } else {
          results.summary.failed++;
          results.summary.by_type[type].failed++;
        }
      }
    }

    // 2. Validar algumas combinações principais
    console.log('\nValidando combinações críticas...');
    const topCorretores = filters.corretor ? filters.corretor.slice(2, 7) : [];
    const topCidades = filters.cidade ? filters.cidade.slice(2, 5) : [];

    for (const c of topCorretores) {
      for (const city of topCidades) {
        const success = await validateCombination({ corretor: c.value, cidade: city.value });
        if (success) results.summary.success++;
        else results.summary.failed++;
        results.summary.total_tested++;
      }
    }

    // Salvar relatório
    fs.writeFileSync('backend/reports/validation_report.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Validação finalizada. Relatório salvo em backend/reports/validation_report.json');

  } catch (err) {
    console.error('❌ Erro fatal na validação:', err.message);
  }
}

async function validateSingleFilter(type, value) {
  try {
    const query = new URLSearchParams({
      startDate: START_DATE,
      endDate: END_DATE,
      [type]: value
    }).toString();

    const summaryRes = await fetch(`${API_BASE}/summary?${query}`);
    const breakdownRes = await fetch(`${API_BASE}/breakdown?${query}&dimension=cidade`);

    if (!summaryRes.ok || !breakdownRes.ok) {
      logError(type, value, `Status error: summary=${summaryRes.status}, breakdown=${breakdownRes.status}`);
      return false;
    }

    return true;
  } catch (err) {
    logError(type, value, err.message);
    return false;
  }
}

async function validateCombination(combo) {
  try {
    const query = new URLSearchParams({
      startDate: START_DATE,
      endDate: END_DATE,
      ...combo
    }).toString();

    const res = await fetch(`${API_BASE}/summary?${query}`);
    return res.ok;
  } catch (err) {
    logError('combination', JSON.stringify(combo), err.message);
    return false;
  }
}

function logError(type, value, error) {
  console.log(`  ❌ Falha: [${type}] ${value} -> ${error}`);
  results.validations.push({ type, value, error, timestamp: new Date() });
}

runValidation();
