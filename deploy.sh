#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="${SERVER:-ubuntu@145.239.71.158}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/tunzone/frontend/admin}"
REMOTE_OWNER="${REMOTE_OWNER:-ubuntu:ubuntu}"
PM2_NAME="${PM2_NAME:-tunzone-admin}"
PORT="${PORT:-3000}"
NPM_BUILD_SCRIPT="${NPM_BUILD_SCRIPT:-build}"
SSH="${SSH:-ssh}"

echo "==> Preparing $SERVER:$REMOTE_DIR ..."
$SSH "$SERVER" "sudo mkdir -p '$REMOTE_DIR' && sudo chown -R '$REMOTE_OWNER' '$REMOTE_DIR'"

echo "==> Syncing source to $SERVER:$REMOTE_DIR ..."
rsync -avz --delete \
  --exclude ".git" \
  --exclude ".cursor" \
  --exclude ".next" \
  --exclude "node_modules" \
  --exclude ".env" \
  --exclude ".env.local" \
  --exclude ".env.*.local" \
  --exclude ".DS_Store" \
  --exclude "npm-debug.log*" \
  --rsync-path="sudo rsync" \
  "$APP_DIR/" "$SERVER:$REMOTE_DIR/"

$SSH "$SERVER" "sudo chown -R '$REMOTE_OWNER' '$REMOTE_DIR'"

echo "==> Installing, building, and restarting PM2 on server..."
$SSH "$SERVER" "cd '$REMOTE_DIR' \
  && npm ci \
  && npm run '$NPM_BUILD_SCRIPT' \
  && if pm2 describe '$PM2_NAME' >/dev/null 2>&1; then PORT='$PORT' pm2 reload '$PM2_NAME' --update-env; else PORT='$PORT' pm2 start npm --name '$PM2_NAME' -- start; fi \
  && pm2 save"

echo "==> Done! Deployed successfully."
