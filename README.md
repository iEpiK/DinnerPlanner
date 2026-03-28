# 🍽️ DinnerPlanner

An automated dinner planning system. Add dinners with types (meat, vegan, poultry, fish, pasta), flag Saturday specials, generate a varied monthly plan, and have it emailed to your family automatically — with a shareable link for editing.

---

## Quick install on Ubuntu 24 LTS

```bash
git clone https://github.com/iEpiK/DinnerPlanner.git
cd DinnerPlanner
bash install.sh
```

The script installs Node.js 22 (via NodeSource), installs npm dependencies, and starts the server. Once it finishes, open **http://localhost:3000** in your browser.

---

## Manual installation

### 1. Prerequisites

**Git** (usually pre-installed on Ubuntu 24):
```bash
sudo apt update && sudo apt install -y git
```

**Node.js 22** (LTS) via NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v22.x.x
```

### 2. Clone and install

```bash
git clone https://github.com/iEpiK/DinnerPlanner.git
cd DinnerPlanner
npm install
```

### 3. Start the server

```bash
npm start
```

Open **http://localhost:3000**.

The SQLite database and a `data/` directory are created automatically on first run, seeded with 22 sample dinners.

---

## Running as a background service (optional)

To keep Dinner Planner running after you close the terminal, install it as a systemd service:

```bash
sudo bash install.sh --service
```

Then manage it with standard systemd commands:

```bash
sudo systemctl status dinner-planner
sudo systemctl restart dinner-planner
sudo systemctl stop dinner-planner
```

Logs are available via:
```bash
journalctl -u dinner-planner -f
```

---

## Configuration

All settings are managed through the web UI at **http://localhost:3000**:

| Tab | What you configure |
|---|---|
| **Family** | Number of adults and kids (used when generating plans) |
| **Schedule** | Day/time to auto-send the monthly plan; SMTP credentials; recipient emails |
| **Dinners** | Add / edit / delete dinners; set type and Saturday-special flag |
| **Plans** | Generate, view, edit and send monthly plans |

### Environment variables (optional)

Create a `.env` file (or export before starting) to override defaults:

```bash
PORT=3000           # HTTP port (default: 3000)
APP_HOST=localhost:3000  # Base URL used in email links
```

---

## Running tests

```bash
npm test
```

---

## Project layout

```
DinnerPlanner/
├── server.js            # Express entry point
├── src/
│   ├── database.js      # SQLite schema + seed data
│   ├── dinnerManager.js # Dinner CRUD
│   ├── planGenerator.js # Monthly plan algorithm
│   ├── emailService.js  # Nodemailer helpers
│   ├── scheduler.js     # node-cron auto-send
│   └── routes/          # REST API routers
├── public/              # Single-page web UI
└── tests/               # Jest test suites
```
