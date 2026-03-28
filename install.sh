#!/usr/bin/env bash
# Dinner Planner – installer for Ubuntu 24 LTS
# Usage:
#   bash install.sh            # install deps and start the server once
#   bash install.sh --service  # also register as a systemd service

set -euo pipefail

INSTALL_SERVICE=false
for arg in "$@"; do
  [[ "$arg" == "--service" ]] && INSTALL_SERVICE=true
done

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="dinner-planner"
NODE_MIN_MAJOR=18

# ── helpers ──────────────────────────────────────────────────────────────────

info()    { echo -e "\033[1;34m[info]\033[0m  $*"; }
success() { echo -e "\033[1;32m[ok]\033[0m    $*"; }
warn()    { echo -e "\033[1;33m[warn]\033[0m  $*"; }
die()     { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

require_sudo() {
  if [[ $EUID -ne 0 ]]; then
    die "This step requires root. Run:  sudo bash install.sh $*"
  fi
}

# ── 1. Node.js ────────────────────────────────────────────────────────────────

install_node() {
  info "Installing Node.js 22 via NodeSource..."
  require_sudo
  apt-get update -qq
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if (( NODE_MAJOR >= NODE_MIN_MAJOR )); then
    success "Node.js $(node --version) already installed"
  else
    warn "Node.js $(node --version) is too old (need ≥ ${NODE_MIN_MAJOR})"
    install_node
  fi
else
  install_node
fi

# ── 2. npm dependencies ───────────────────────────────────────────────────────

info "Installing npm dependencies..."
cd "$APP_DIR"
npm install --omit=dev
success "Dependencies installed"

# ── 3. Systemd service (optional) ────────────────────────────────────────────

if $INSTALL_SERVICE; then
  require_sudo
  NODE_BIN="$(command -v node)"
  CURRENT_USER="${SUDO_USER:-$USER}"

  info "Registering systemd service '${SERVICE_NAME}'..."
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Dinner Planner web server
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable  "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
  success "Service '${SERVICE_NAME}' started and enabled on boot"
  echo
  info "Manage the service with:"
  echo "    sudo systemctl status  ${SERVICE_NAME}"
  echo "    sudo systemctl restart ${SERVICE_NAME}"
  echo "    journalctl -u ${SERVICE_NAME} -f"
else
  # ── 4. Start once ────────────────────────────────────────────────────────────
  echo
  success "Setup complete!"
  info "Starting Dinner Planner on http://localhost:3000  (Ctrl-C to stop)"
  echo
  exec node "${APP_DIR}/server.js"
fi
