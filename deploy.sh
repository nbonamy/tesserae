#!/usr/bin/env bash
# Install Weather and Wind into an existing remote Tesserae Docker container.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/.env}"
if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  echo "Copy .env.example to .env and configure your server first." >&2
  exit 1
fi
# This is the operator's private configuration, never uploaded to the server.
source "$DEPLOY_ENV_FILE"
: "${DEPLOY_SSH_HOST:?Set DEPLOY_SSH_HOST in .env}"
: "${DEPLOY_DIR:?Set DEPLOY_DIR in .env}"
TESSERAE_CONTAINER="${TESSERAE_CONTAINER:-tesserae}"
case "${DEPLOY_USE_SUDO:-1}" in
  1) DOCKER_COMMAND="sudo -n docker" ;;
  0) DOCKER_COMMAND="docker" ;;
  *) echo "DEPLOY_USE_SUDO must be 0 or 1." >&2; exit 1 ;;
esac

printf -v REMOTE_STAGE '%q' "$DEPLOY_DIR/widgets"
printf -v REMOTE_WIDGET '%q' "$DEPLOY_DIR/widgets/weather_wind/."
printf -v REMOTE_CONTAINER '%q' "$TESSERAE_CONTAINER"
printf -v REMOTE_DEST '%q' "$TESSERAE_CONTAINER:/app/data/authored/weather_wind/"

COPYFILE_DISABLE=1 tar --format=ustar --exclude='__pycache__' --exclude='*.pyc' \
  -C "$SCRIPT_DIR/widgets" -cf - weather_wind |
  ssh "$DEPLOY_SSH_HOST" \
    "mkdir -p $REMOTE_STAGE && tar -xf - -C $REMOTE_STAGE && $DOCKER_COMMAND cp $REMOTE_WIDGET $REMOTE_DEST && $DOCKER_COMMAND restart $REMOTE_CONTAINER"

echo "Weather and Wind deployed. Select it in your Tesserae dashboard."
