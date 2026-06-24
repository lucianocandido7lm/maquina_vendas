
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.resolve(ROOT_DIR, 'backend');
const BACKEND_ENV_PATH = path.resolve(BACKEND_DIR, '.env');
const REPORTS_DIR = path.resolve(BACKEND_DIR, 'reports');

dotenv.config({ path: BACKEND_ENV_PATH });

// Reuse validation logic from validate-dashboard-filters.mjs by importing or copying the core
// For simplicity in this environment, I'll create a specialized executor that calls the existing script with different ENV vars

async function runValidation(env) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/validate-dashboard-filters.mjs'], {
      cwd: ROOT_DIR,
      env: { ...process.env, ...env }
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { console.error(data.toString()); });

    child.on('close', (code) => {
      if (code === 0) {
        // Find the report file in the output
        const lines = output.split('\n');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.status === 'summary-validation-finished') {
              resolve(parsed);
              return;
            }
          } catch (e) { /* ignore */ }
        }
        resolve({ status: 'finished', raw: output });
      } else {
        reject(new Error(`Validation failed with code ${code}`));
      }
    });
  });
}

async function loadLatestInventory() {
  const files = await fs.readdir(REPORTS_DIR);
  const inventoryFiles = files
    .filter(f => f.startsWith('filters-inventory-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (inventoryFiles.length === 0) return null;
  const content = await fs.readFile(path.join(REPORTS_DIR, inventoryFiles[0]), 'utf8');
  return JSON.parse(content);
}

async function main() {
  const inventory = await loadLatestInventory();
  if (!inventory) {
    console.error('Inventory not found. Run scripts/filters-inventory.mjs first.');
    process.exit(1);
  }

  console.log('--- Phase 1: Single Value Validation ---');
  // The existing script already does this if we don't restrict it
  // But we might want to run it per filter key to avoid timeouts if it's too large
  const filterKeys = Object.keys(inventory.filters);
  
  for (const key of filterKeys) {
    console.log(`Validating filter: ${key} (${inventory.counts[key]} values)`);
    // Run for this specific key
    const result = await runValidation({
      VALIDATION_FILTER_KEYS: key,
      VALIDATION_PERIOD_KEYS: 'mes,mes_anterior,ano' // Major periods
    });
    console.log(`Finished ${key}: ${result.totals.passed} passed, ${result.totals.failed} failed.`);
  }

  console.log('--- Phase 2: Combinations (Corretor + others) ---');
  // Sample combinations for Corretor + (Cidade, Gerencia, Coordenacao)
  const corretores = inventory.filters.corretor.slice(0, 10); // Sample 10 corretores for combinations to keep it sane
  const cidades = inventory.filters.cidade.slice(0, 5); // Sample 5 cities
  
  for (const corretor of corretores) {
    for (const cidade of cidades) {
      console.log(`Validating combination: Corretor [${corretor}] + Cidade [${cidade}]`);
      const result = await runValidation({
        VALIDATION_FILTER_KEYS: 'corretor,cidade',
        VALIDATION_FILTER_VALUES: `${corretor},${cidade}`,
        VALIDATION_PERIOD_KEYS: 'mes'
      });
      console.log(`Result: ${result.totals.passed} passed, ${result.totals.failed} failed.`);
    }
  }

  console.log('--- Exhaustive Validation Finished ---');
}

main().catch(console.error);
