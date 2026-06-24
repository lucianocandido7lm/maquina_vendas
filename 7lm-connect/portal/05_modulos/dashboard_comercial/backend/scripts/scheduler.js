import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

console.log("⏰ Scheduler de Dados Comercial Iniciado...");

const DEFAULT_CRON_LIST = '30 9 * * *;0 13 * * *;0 19 * * *';
const SCHEDULER_CRON_LIST = process.env.SCHEDULER_CRON_LIST || process.env.SCHEDULER_CRON || DEFAULT_CRON_LIST;
const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'America/Sao_Paulo';
const SCHEDULER_RUN_MODE = process.env.SCHEDULER_RUN_MODE || 'update';
const SCHEDULER_SKIP_INSTALL = String(process.env.SCHEDULER_SKIP_INSTALL || '1') === '1';
let isRunning = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const RUN_ALL_PATH = path.resolve(ROOT_DIR, 'deploy/run-all.sh');

function runScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [RUN_ALL_PATH, ...args], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`run-all.sh finalizou com codigo ${code}`));
    });
  });
}

/**
 * Função para rodar a sincronização e agregação
 */
function runPipeline() {
  if (isRunning) {
    console.log(`[${new Date().toLocaleString()}] ⏭️ Pipeline ja em execucao. Pulando rodada.`);
    return;
  }
  isRunning = true;
  console.log(`[${new Date().toLocaleString()}] 🔄 Iniciando Pipeline de Dados...`);

  const args = ['--mode', SCHEDULER_RUN_MODE];
  if (SCHEDULER_SKIP_INSTALL) args.push('--skip-install');

  runScript(args)
    .then(() => {
      console.log('✅ Pipeline finalizado com sucesso.');
    })
    .catch((error) => {
      console.error(`❌ Erro no Pipeline: ${error.message}`);
    })
    .finally(() => {
      isRunning = false;
    });
}

const schedules = [...new Set(
  SCHEDULER_CRON_LIST
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
)];

if (schedules.length === 0) {
  throw new Error('Nenhum cron valido em SCHEDULER_CRON_LIST/SCHEDULER_CRON');
}

schedules.forEach((expr) => {
  cron.schedule(expr, () => {
    runPipeline();
  }, { timezone: SCHEDULER_TIMEZONE });
});

// 2. Roda uma vez ao iniciar o scheduler para garantir dados frescos
console.log("🚀 Rodando carga inicial de sincronização...");
runPipeline();

console.log(`📌 Jobs agendados: ${schedules.join(' | ')} (${SCHEDULER_TIMEZONE}).`);
