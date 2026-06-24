#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  echo "Nao execute com '.' (source). Use: bash deploy/stop-local.sh"
  return 0
fi

set -euo pipefail

PREVIEW_PID_FILE="/tmp/commercial-dashboard-preview.pid"

run_if_exists() {
  local action="$1"
  local service="$2"

  local load_state
  load_state="$(systemctl show "${service}.service" --property=LoadState --value 2>/dev/null || true)"

  if [ -n "$load_state" ] && [ "$load_state" != "not-found" ]; then
    echo "${action^} ${service}..."
    sudo systemctl "$action" "$service"
  else
    echo "Servico ${service}.service nao encontrado. Pulando."
  fi
}

stop_port_5174() {
  stop_port 5174
}

stop_port_3001() {
  stop_port 3001
}

stop_port() {
  local port="$1"

  if command -v fuser >/dev/null 2>&1; then
    if sudo fuser "${port}"/tcp >/dev/null 2>&1; then
      echo "Parando processo na porta ${port}..."
      sudo fuser -k "${port}"/tcp >/dev/null 2>&1 || true
    else
      echo "Porta ${port} ja estava livre."
    fi
  else
    echo "fuser nao encontrado. Nao foi possivel encerrar automaticamente a porta ${port}."
  fi
}

stop_frontend_preview_if_running() {
  if [ -f "${PREVIEW_PID_FILE}" ]; then
    local preview_pid
    preview_pid="$(cat "${PREVIEW_PID_FILE}" 2>/dev/null || true)"
    if [ -n "$preview_pid" ] && ps -p "$preview_pid" >/dev/null 2>&1; then
      echo "Parando frontend preview (PID ${preview_pid})..."
      kill "$preview_pid" >/dev/null 2>&1 || true
    fi
    rm -f "${PREVIEW_PID_FILE}"
  fi
}

echo "[1/5] Parando scheduler..."
run_if_exists stop commercial-dashboard-scheduler

echo "[2/5] Parando backend..."
run_if_exists stop commercial-dashboard

echo "[3/5] Parando frontend preview (Node)..."
stop_frontend_preview_if_running

echo "[4/5] Liberando porta 3001..."
stop_port_3001

echo "[5/5] Liberando porta 5174..."
stop_port_5174

echo "Stop concluido."
