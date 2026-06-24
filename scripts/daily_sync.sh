#!/usr/bin/env bash
# =============================================
# daily_sync.sh — Prod → Dev Automated Sync
# Runs daily at 18:00 via cron
# =============================================

set -euo pipefail

# --- Config ---
PROD_HOST="root@104.131.48.54"
PROD_PATH="/opt/"
DEV_PATH="/opt/"
CONFLICT_PROJECT="7lm-connect"
TEMP_PROD="/tmp/7lm-connect-prod"
BACKUP_DIR="$HOME/backups"
LOG="/var/log/daily_sync_$(date +%Y%m%d).log"
MERGE_TOOL="/opt/scripts/merge_sync_tool.py"

# SSH password via sshpass (installed check below)
SSH_PASS='Dev147lm$SNK'

# --- Redirect all output to log ---
exec > >(tee -a "$LOG") 2>&1

echo ""
echo "=============================================="
echo "  DAILY SYNC: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# --- Step 1: Backup 7lm-connect ---
echo ""
echo "[1/5] Creating backup of /opt/7lm-connect/ ..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" /opt/7lm-connect/ 2>/dev/null || true
echo "  Backup created: $BACKUP_FILE"

# Prune: keep only last 7 backups
echo "  Pruning old backups (keep last 7)..."
ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
REMAINING=$(ls "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
echo "  Backups retained: $REMAINING"

# --- Step 2: Check sshpass ---
if ! command -v sshpass &>/dev/null; then
    echo ""
    echo "[INFO] sshpass not found. Attempting install..."
    apt-get install -y sshpass &>/dev/null || true
fi

RSYNC_CMD="sshpass -p '$SSH_PASS' rsync -avz -e 'ssh -o StrictHostKeyChecking=no'"

# --- Step 3: Sync non-conflict projects ---
echo ""
echo "[2/5] Syncing all projects from prod EXCEPT '$CONFLICT_PROJECT' ..."
sshpass -p "$SSH_PASS" rsync -avz --update \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude="$CONFLICT_PROJECT" \
    "$PROD_HOST:$PROD_PATH" "$DEV_PATH" 2>&1 | tail -n 5
echo "  Non-conflict project sync complete."

# --- Step 4: Pull 7lm-connect from prod to temp ---
echo ""
echo "[3/5] Pulling '$CONFLICT_PROJECT' from prod to $TEMP_PROD ..."
mkdir -p "$TEMP_PROD"
sshpass -p "$SSH_PASS" rsync -avz \
    -e "ssh -o StrictHostKeyChecking=no" \
    "$PROD_HOST:$PROD_PATH$CONFLICT_PROJECT/" "$TEMP_PROD/" 2>&1 | tail -n 5
echo "  Pull complete."

# --- Step 5: Safe Merge 7lm-connect ---
echo ""
echo "[4/5] Running safe merge for '$CONFLICT_PROJECT' ..."
python3 "$MERGE_TOOL"
echo "  Merge complete."

# --- Step 6: Final Summary ---
echo ""
echo "[5/5] SYNC COMPLETE at $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOG"
echo "  Backup: $BACKUP_FILE"
echo "=============================================="
echo ""
