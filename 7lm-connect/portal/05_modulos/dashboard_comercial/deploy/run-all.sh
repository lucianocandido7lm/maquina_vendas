#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"
APP_WORKSPACE="commercial-dashboard"
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"
WEB_ROOT="${WEB_ROOT:-/var/www/commercial-dashboard}"

MODE="local"
WITH_PULL=0
BRANCH="main"
SKIP_INSTALL=0
SKIP_MIGRATE=0
SKIP_UPDATE=0
SKIP_P2P=0
SKIP_BUILD=0
SKIP_FRONTEND=0
SKIP_RESTART=0
SKIP_AUDIT=0
MAX_RECONCILE_ATTEMPTS="${MAX_RECONCILE_ATTEMPTS:-3}"

log() { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
err() { printf '[ERROR] %s\n' "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: bash deploy/run-all.sh [options]

Modes:
  --mode update|local|prod
    update: atualiza banco completo
    local : update completo + start local
    prod  : deploy completo de producao

Options:
  --with-pull [branch]       Executa git pull (padrao: main)
  --skip-install             Pula npm ci
  --skip-migrate             Pula migracoes incrementais
  --skip-update              Pula update de dados
  --skip-p2p                 Pula validacao P2P
  --skip-build               Pula build frontend
  --skip-frontend            Pula preview/deploy frontend
  --skip-restart             Pula start/restart de servicos
  --skip-audit               Pula npm audit (nao recomendado)
  --max-reconcile-attempts N Tentativas maximas para reconciliar P2P (padrao: 3)
  --web-root <path>          Override do web root no modo prod
  -h, --help                 Exibe ajuda
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Required command not found: $1"
    exit 1
  fi
}

require_env_key() {
  local key="$1"
  if ! grep -qE "^${key}=" "$BACKEND_ENV_FILE"; then
    err "Missing ${key} in ${BACKEND_ENV_FILE}"
    exit 1
  fi
}

run_if_exists() {
  local action="$1"
  local service="$2"
  local load_state
  load_state="$(systemctl show "${service}.service" --property=LoadState --value 2>/dev/null || true)"
  if [ -n "$load_state" ] && [ "$load_state" != "not-found" ]; then
    log "${action^} ${service}"
    sudo systemctl "$action" "$service"
  else
    warn "Servico ${service}.service nao encontrado"
  fi
}

free_port_if_busy() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    if sudo fuser "${port}"/tcp >/dev/null 2>&1; then
      log "Liberando porta ${port}"
      sudo fuser -k "${port}"/tcp >/dev/null 2>&1 || true
    fi
  fi
}

npm_install_dependencies() {
  if [ -f "${ROOT_DIR}/package-lock.json" ] || [ -f "${ROOT_DIR}/npm-shrinkwrap.json" ]; then
    if [ "$SKIP_BUILD" -eq 0 ]; then
      npm ci
    else
      npm ci --omit=dev
    fi
    return
  fi

  if [ -f "${MONOREPO_ROOT}/package-lock.json" ] || [ -f "${MONOREPO_ROOT}/npm-shrinkwrap.json" ]; then
    if [ "$SKIP_BUILD" -eq 0 ]; then
      (cd "$MONOREPO_ROOT" && npm ci --workspace "$APP_WORKSPACE")
    else
      (cd "$MONOREPO_ROOT" && npm ci --workspace "$APP_WORKSPACE" --omit=dev)
    fi
    return
  fi

  warn "Lockfile nao encontrado; usando npm install no workspace local."
  npm install
}

npm_security_audit() {
  local audit_output
  local audit_status=0

  if [ -f "${ROOT_DIR}/package-lock.json" ] || [ -f "${ROOT_DIR}/npm-shrinkwrap.json" ]; then
    set +e
    audit_output="$(npm audit --json --audit-level=high 2>&1)"
    audit_status=$?
    set -e
  elif [ -f "${MONOREPO_ROOT}/package-lock.json" ] || [ -f "${MONOREPO_ROOT}/npm-shrinkwrap.json" ]; then
    set +e
    audit_output="$(cd "$MONOREPO_ROOT" && npm audit --json --audit-level=high --workspace "$APP_WORKSPACE" 2>&1)"
    audit_status=$?
    set -e
  else
    warn "Lockfile nao encontrado; npm audit ignorado porque npm audit requer package-lock.json."
    return
  fi

  if [ "$audit_status" -eq 0 ]; then
    return
  fi

  if AUDIT_JSON="$audit_output" node --input-type=module - <<'NODE'; then
const raw = process.env.AUDIT_JSON || '';
let report;

try {
  report = JSON.parse(raw);
} catch {
  console.error(raw);
  process.exit(1);
}

if (report.error || !report.vulnerabilities) {
  console.error(raw);
  process.exit(1);
}

const HIGH_OR_CRITICAL = new Set(['high', 'critical']);
const DATABRICKS_THRIFT_ADVISORY = 'GHSA-r67j-r569-jrwp';
const vulnerabilities = Object.values(report.vulnerabilities || {});

function hasDatabricksThriftAdvisory(vulnerability) {
  return (vulnerability.via || []).some((entry) => {
    if (typeof entry === 'string') {
      return entry === 'thrift';
    }

    return entry?.name === 'thrift' && String(entry?.url || '').includes(DATABRICKS_THRIFT_ADVISORY);
  });
}

function isAllowedDatabricksThrift(vulnerability) {
  if (vulnerability.fixAvailable !== false) {
    return false;
  }

  if (vulnerability.name === 'thrift') {
    return hasDatabricksThriftAdvisory(vulnerability);
  }

  return vulnerability.name === '@databricks/sql' && hasDatabricksThriftAdvisory(vulnerability);
}

const blocking = vulnerabilities
  .filter((vulnerability) => HIGH_OR_CRITICAL.has(vulnerability.severity))
  .filter((vulnerability) => !isAllowedDatabricksThrift(vulnerability));

if (blocking.length > 0) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

const allowed = vulnerabilities
  .filter((vulnerability) => HIGH_OR_CRITICAL.has(vulnerability.severity))
  .filter(isAllowedDatabricksThrift)
  .map((vulnerability) => vulnerability.name)
  .join(', ');

if (allowed) {
  console.warn(`[WARN] npm audit: ignorando advisory sem fix do @databricks/sql/thrift (${allowed}).`);
}
NODE
    return
  fi

  return 1
}

preflight() {
  log "Preflight de conectividade"
  node backend/check-connection.js
  node --input-type=module -e "import { DBSQLClient } from '@databricks/sql'; import dotenv from 'dotenv'; dotenv.config({ path: 'backend/.env' }); const client = new DBSQLClient(); const conn = await client.connect({ token: process.env.DATABRICKS_TOKEN, host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST, path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH }); const session = await conn.openSession({ initialCatalog: process.env.DATABRICKS_CATALOG || 'data_platform_dev', initialSchema: process.env.DATABRICKS_SCHEMA || 'gold_cvcrm' }); const op = await session.executeStatement('SELECT 1 AS ok', { runAsync: true }); const rows = await op.fetchAll(); console.log('Databricks OK:', rows[0]); await op.close(); await session.close(); await conn.close();"
}

check_and_repair_parity() {
  node --input-type=module - <<'NODE'
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

const PAIRS = [
  ['comercial_base', 'comercial_base_staging'],
  ['comercial_indicador_segmentacao', 'comercial_indicador_segmentacao_staging'],
  ['comercial_propostas_historico', 'comercial_propostas_historico_staging'],
  ['comercial_propostas_consolidada', 'comercial_propostas_consolidada_staging'],
  ['comercial_cancelamentos', 'comercial_cancelamentos_staging'],
  ['comercial_distratos', 'comercial_distratos_staging'],
  ['dim_empreendimento', 'dim_empreendimento_staging'],
];

async function getParity(client) {
  const checks = [];
  for (const [finalTable, stagingTable] of PAIRS) {
    const s = await client.query(`SELECT COUNT(*)::bigint AS c FROM public.${stagingTable}`);
    const f = await client.query(`SELECT COUNT(*)::bigint AS c FROM public.${finalTable}`);
    checks.push([finalTable, Number(s.rows[0]?.c || 0), Number(f.rows[0]?.c || 0)]);
  }
  const diff = checks
    .filter(([, staging, final]) => staging !== final)
    .map(([table, staging, final]) => ({ table, staging, final }));
  return { checks, diff };
}

async function forcePromote(client) {
  await client.query('BEGIN');
  try {
    for (const [finalTable, stagingTable] of PAIRS) {
      await client.query(`TRUNCATE public.${finalTable}`);
      await client.query(`INSERT INTO public.${finalTable} SELECT * FROM public.${stagingTable}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

const client = await pool.connect();
try {
  let parity = await getParity(client);
  console.log('parity_counts', parity);

  if (parity.diff.length > 0) {
    console.warn('⚠️ Paridade divergente detectada. Executando recuperacao forçada staging -> final...');
    await forcePromote(client);
    parity = await getParity(client);
    console.log('parity_counts_after_repair', parity);
  }

  if (parity.diff.length > 0) {
    throw new Error('Swap inconsistente apos recuperacao: diferencas entre staging e final.');
  }
} finally {
  client.release();
  await pool.end();
}
NODE
}

reconcile_vendas_with_databricks() {
  node --input-type=module - <<'NODE'
import pg from 'pg';
import dotenv from 'dotenv';
import { DBSQLClient } from '@databricks/sql';

dotenv.config({ path: 'backend/.env' });

function formatDate(d) { return d.toISOString().split('T')[0]; }
function getRange() {
  const now = new Date();
  return {
    start: process.env.VALIDATION_START_DATE || formatDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    end: process.env.VALIDATION_END_DATE || formatDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))),
  };
}

const { start, end } = getRange();
const pgPool = new pg.Pool({ user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT, ssl: { rejectUnauthorized: false } });
const dbsql = new DBSQLClient();
const conn = await dbsql.connect({ token: process.env.DATABRICKS_TOKEN, host: process.env.DATABRICKS_SERVER_HOSTNAME || process.env.DATABRICKS_HOST, path: process.env.DATABRICKS_HTTP_PATH || process.env.DATABRICKS_PATH });
const session = await conn.openSession({ initialCatalog: process.env.DATABRICKS_CATALOG || 'data_platform_dev', initialSchema: process.env.DATABRICKS_SCHEMA || 'gold_cvcrm' });

try {
  const pgRows = (await pgPool.query("SELECT journey_id FROM comercial_base WHERE data_venda::date BETWEEN $1 AND $2 AND journey_id IS NOT NULL", [start, end])).rows.map((r) => String(r.journey_id));
  const op = await session.executeStatement(`SELECT CAST(journey_id AS STRING) AS journey_id FROM ${(process.env.DATABRICKS_CATALOG || 'data_platform_dev')}.${(process.env.DATABRICKS_SCHEMA || 'gold_cvcrm')}.vw_bi_comercial_base WHERE TO_DATE(data_venda) BETWEEN DATE '${start}' AND DATE '${end}' AND journey_id IS NOT NULL`, { runAsync: true });
  const dbxRows = (await op.fetchAll()).map((r) => String(r.journey_id));
  await op.close();

  const setPg = new Set(pgRows);
  const setDbx = new Set(dbxRows);
  const onlyPg = [...setPg].filter((x) => !setDbx.has(x));
  const onlyDbx = [...setDbx].filter((x) => !setPg.has(x));

  console.log('vendas_reconcile_diff', { start, end, pg: setPg.size, dbx: setDbx.size, only_pg: onlyPg.length, only_dbx: onlyDbx.length, sample_only_pg: onlyPg.slice(0, 20), sample_only_dbx: onlyDbx.slice(0, 20) });

  if (onlyPg.length > 0) {
    await pgPool.query('UPDATE comercial_base SET data_venda = NULL WHERE journey_id = ANY($1)', [onlyPg]);
    console.warn(`⚠️ Reconciliacao vendas: ${onlyPg.length} journey_id(s) removidos do KPI de vendas no Postgres.`);
  }
} finally {
  await session.close().catch(() => {});
  await conn.close().catch(() => {});
  await pgPool.end().catch(() => {});
}
NODE
}

run_data_update() {
  if [ "$SKIP_UPDATE" -eq 1 ]; then
    log "Skip data update"
    return 0
  fi

  if [ "$SKIP_MIGRATE" -eq 0 ]; then
    log "[1/5] Run incremental migrations"
    node backend/scripts/migrate-incremental.js
  else
    log "[1/5] Skip migrations"
  fi

  local attempt=1
  while [ "$attempt" -le "$MAX_RECONCILE_ATTEMPTS" ]; do
    log "[2/5] Run canonical data pipeline (tentativa ${attempt}/${MAX_RECONCILE_ATTEMPTS})"
    node backend/scripts/run-data-update.js

    log "[3/5] Validate staging/final parity"
    check_and_repair_parity

    log "[4/5] Validate filter sources"
    node --input-type=module -e "import pg from 'pg'; import dotenv from 'dotenv'; dotenv.config({path:'backend/.env'}); const pool=new pg.Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:process.env.DB_PORT,ssl:{rejectUnauthorized:false}}); const q=await pool.query(\"SELECT (SELECT COUNT(*) FROM public.comercial_indicador_segmentacao) AS segmentacao_linhas, (SELECT MAX(data_evento) FROM public.comercial_indicador_segmentacao) AS segmentacao_max_data, (SELECT COUNT(DISTINCT h.nome) FROM public.vw_hierarquia_cvcrm h WHERE h.nome IS NOT NULL AND h.mes_referencia = date_trunc('month', CURRENT_DATE)::date AND LOWER(COALESCE(h.ativo_negocio,''))='s') AS corretor_ativo_mes, (SELECT COUNT(DISTINCT h.gestor_nome) FROM public.vw_hierarquia_cvcrm h WHERE h.gestor_nome IS NOT NULL AND h.mes_referencia = date_trunc('month', CURRENT_DATE)::date AND LOWER(COALESCE(h.ativo_negocio,''))='s') AS gerencia_hierarquia_mes, (SELECT COUNT(DISTINCT s.sdr_ativo_nome) FROM public.comercial_indicador_segmentacao s WHERE s.fl_indicador_sdr_aplicavel IS TRUE AND NULLIF(TRIM(COALESCE(s.sdr_ativo_nome,'')), '') IS NOT NULL) AS sdr_ativo_segmentacao, (SELECT COUNT(DISTINCT regiao_operacao) FROM public.comercial_indicador_segmentacao WHERE NULLIF(TRIM(COALESCE(regiao_operacao,'')), '') IS NOT NULL) AS regioes_operacao, (SELECT COUNT(DISTINCT regiao_corretor) FROM public.comercial_indicador_segmentacao WHERE NULLIF(TRIM(COALESCE(regiao_corretor,'')), '') IS NOT NULL) AS regioes_corretor, (SELECT COUNT(*) FROM public.dim_empreendimento) AS total_dim_empreendimento\"); console.log('validation_counts', q.rows[0]); await pool.end();"

    log "[5/5] Freshness snapshot"
    node --input-type=module -e "import pg from 'pg'; import dotenv from 'dotenv'; dotenv.config({path:'backend/.env'}); const pool=new pg.Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:process.env.DB_PORT,ssl:{rejectUnauthorized:false}}); const q=await pool.query(\"SELECT (SELECT MAX(dt_ultima_conversao_lead) FROM comercial_base) AS max_lead, (SELECT MAX(dt_visita_realizada) FROM comercial_base) AS max_visita, (SELECT MAX(data_venda) FROM comercial_base) AS max_venda, (SELECT MAX(dt_assinatura_contrato) FROM comercial_base) AS max_repasse, (SELECT MAX(dt_ultimo_historico_data) FROM comercial_propostas_consolidada) AS max_proposta, (SELECT MAX(data_cancelamento) FROM comercial_cancelamentos) AS max_cancelamento, (SELECT MAX(referencia_data) FROM comercial_distratos) AS max_distrato\"); console.log('freshness_postgres', q.rows[0]); await pool.end();"

    if [ "$SKIP_P2P" -eq 1 ]; then
      log "[extra] Skip P2P validation"
      return 0
    fi

    log "[extra] Run P2P validation"
    if node backend/scripts/run-p2p-validation.js; then
      log "P2P validacao OK"
      return 0
    fi

    warn "Executando reconciliacao dirigida de vendas (journey_id) contra Databricks..."
    reconcile_vendas_with_databricks

    if [ "$attempt" -eq "$MAX_RECONCILE_ATTEMPTS" ]; then
      err "P2P divergente apos ${MAX_RECONCILE_ATTEMPTS} tentativas de reconciliacao."
      return 1
    fi

    warn "P2P divergente; repetindo ciclo completo de sincronizacao/reconciliacao..."
    attempt=$((attempt + 1))
  done
}

healthcheck_api() {
  curl -fsS "http://127.0.0.1:3001/api/v1/dashboard/summary?startDate=$(date +%Y-%m-01)&endDate=$(date +%Y-%m-%d)" >/dev/null
}

ensure_backend_api() {
  log "Healthcheck API"
  for _ in {1..20}; do
    if healthcheck_api; then
      return 0
    fi
    sleep 2
  done

  warn "API nao respondeu via servico; iniciando fallback local em background"
  free_port_if_busy 3001
  setsid node backend/server.js > backend/server.log 2>&1 < /dev/null &
  sleep 2

  for _ in {1..20}; do
    if healthcheck_api; then
      return 0
    fi
    sleep 2
  done

  healthcheck_api
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift
      ;;
    --with-pull)
      WITH_PULL=1
      if [ "${2:-}" != "" ] && [[ "${2:-}" != --* ]]; then
        BRANCH="$2"
        shift
      fi
      ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-update|--skip-data-update) SKIP_UPDATE=1 ;;
    --skip-p2p) SKIP_P2P=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-frontend|--skip-frontend-deploy) SKIP_FRONTEND=1 ;;
    --skip-restart) SKIP_RESTART=1 ;;
    --skip-audit) SKIP_AUDIT=1 ;;
    --max-reconcile-attempts)
      MAX_RECONCILE_ATTEMPTS="${2:-}"
      if ! [[ "$MAX_RECONCILE_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
        err "--max-reconcile-attempts requires integer > 0"
        exit 1
      fi
      shift
      ;;
    --web-root)
      WEB_ROOT="${2:-}"
      if [ -z "$WEB_ROOT" ]; then
        err "--web-root requires a value"
        exit 1
      fi
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

cd "$ROOT_DIR"
require_cmd node
require_cmd npm
require_cmd curl

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  err "Missing env file: ${BACKEND_ENV_FILE}"
  exit 1
fi

for key in DB_USER DB_PASSWORD DB_HOST DB_PORT DB_NAME DATABRICKS_TOKEN DATABRICKS_HOST DATABRICKS_HTTP_PATH; do
  require_env_key "$key"
done

preflight

if [ "$WITH_PULL" -eq 1 ]; then
  require_cmd git
  log "Git pull ${BRANCH}"
  git pull origin "$BRANCH"
fi

if [ "$SKIP_INSTALL" -eq 0 ]; then
  log "Install dependencies"
  npm_install_dependencies
fi

if [ "$SKIP_AUDIT" -eq 0 ]; then
  log "Security audit (high/critical)"
  npm_security_audit
else
  warn "npm audit ignorado via --skip-audit"
fi

case "$MODE" in
  update)
    run_data_update
    ;;
  local)
    run_data_update

    if [ "$SKIP_RESTART" -eq 0 ]; then
      run_if_exists start commercial-dashboard
      run_if_exists start commercial-dashboard-scheduler

      ensure_backend_api
    fi

    if [ "$SKIP_BUILD" -eq 0 ]; then
      log "Build frontend"
      npm run build
    fi

    if [ "$SKIP_FRONTEND" -eq 0 ]; then
      log "Start frontend preview"
      free_port_if_busy 5174
      nohup npm run preview -- --host 0.0.0.0 --port 5174 >/tmp/commercial-dashboard-preview.log 2>&1 &
      sleep 2
    fi
    ;;
  prod)
    run_data_update

    if [ "$SKIP_BUILD" -eq 0 ]; then
      log "Build frontend"
      npm run build
    fi

    if [ "$SKIP_FRONTEND" -eq 0 ]; then
      if [ ! -d "$WEB_ROOT" ]; then
        err "WEB_ROOT does not exist: ${WEB_ROOT}"
        exit 1
      fi
      log "Deploy frontend static files"
      sudo cp -r dist/* "${WEB_ROOT}/"
      if systemctl show nginx.service --property=LoadState --value >/dev/null 2>&1; then
        sudo systemctl reload nginx
      fi
    fi

    if [ "$SKIP_RESTART" -eq 0 ]; then
      run_if_exists restart commercial-dashboard
      run_if_exists restart commercial-dashboard-scheduler
    fi

    ensure_backend_api
    ;;
  *)
    err "Invalid mode: $MODE"
    exit 1
    ;;
esac

log "Processo finalizado com sucesso (mode=${MODE})."
