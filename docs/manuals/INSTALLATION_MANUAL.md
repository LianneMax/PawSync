# DE LA SALLE UNIVERSITY
### Manila

---

# PawSync
### A Web-Based NFC and QR-Enabled Centralized Pet Medical Record System

# INSTALLATION MANUAL

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | July 2026 |
| **Prepared for** | Partner Veterinary Clinics / IT Staff |
| **Prepared By** | Balbastro, *[add other team members]* |

---

## Table of Contents

- 1. Introduction
- 2. System Requirements
  - 2.1 Software Prerequisites
  - 2.2 Hardware Requirements (NFC, optional)
- 3. Obtaining the Source Code
- 4. Local Installation
  - 4.1 Automated Setup (macOS)
  - 4.2 Manual Setup (All Platforms)
- 5. Environment Configuration
  - 5.1 Backend (`backend/.env`)
  - 5.2 Frontend (`frontend/.env.local`)
  - 5.3 Local NFC Agent (`local-nfc-agent/.env`)
  - 5.4 Obtaining Third-Party API Keys
- 6. Database Setup and Seeding
- 7. Running the System
  - 7.1 Development Mode
  - 7.2 Production Build
- 8. Cloud Deployment
  - 8.1 Database — MongoDB Atlas
  - 8.2 Backend — Render
  - 8.3 Frontend — Vercel
- 9. NFC Agent Installation (Clinic On-Premises)
  - 9.1 Overview
  - 9.2 Prerequisites (Clinic Windows PC)
  - 9.3 Building and Installing the Agent (Windows, Recommended)
  - 9.4 Running the Agent Manually (Fallback / Verification)
  - 9.5 Alternative: Running from Source (Developers)
  - 9.6 Uninstalling the Agent
- 10. Verifying the Installation
- 11. Troubleshooting

---

# 1. Introduction

This manual describes how to install, configure, and deploy **PawSync** — a web-based NFC and QR-enabled centralized pet medical record system consisting of three applications:

1. **Backend** — Express.js REST API + WebSocket server (`backend/`)
2. **Frontend** — Next.js web application (`frontend/`)
3. **Local NFC Agent** — optional on-premises hardware bridge for clinics with NFC readers (`local-nfc-agent/`)

It covers both a local development installation and the recommended production deployment (MongoDB Atlas + Render + Vercel + on-premises agent).

---

# 2. System Requirements

## 2.1 Software Prerequisites

Install the following before setting up PawSync:

| Software | Minimum Version | Source |
|---|---|---|
| Node.js | v18+ | nodejs.org |
| npm | v9+ (bundled with Node.js) | — |
| MongoDB Community Server | v6+ (or a MongoDB Atlas account) | mongodb.com/try/download/community |
| Git | any recent | git-scm.com |

Supported operating systems: Windows 10/11, macOS, Linux.

## 2.2 Hardware Requirements (NFC, optional)

Only needed by clinics that will use physical NFC tags:

- A PC/SC-compatible USB NFC reader (e.g., **ACR122U**)
- NFC tags (NTAG-family or compatible, 13.56 MHz)
- System NFC drivers: `pcscd` on Linux/macOS (Windows includes the PC/SC stack natively)

Clinics without NFC hardware can use QR code scanning instead — no extra hardware beyond a webcam or phone camera.

---

# 3. Obtaining the Source Code

```bash
git clone <repository-url>
cd PawSync
```

---

# 4. Local Installation

## 4.1 Automated Setup (macOS)

```bash
chmod +x setup.sh
./setup.sh
```

The script installs MongoDB via Homebrew, starts the MongoDB service, and installs all npm dependencies for the root, backend, and frontend.

## 4.2 Manual Setup (All Platforms)

**Step 1 — Install dependencies.** Running `npm install` at the repository root automatically installs `backend/` and `frontend/` dependencies via the `postinstall` script:

```bash
npm install
```

Or install each package manually:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../local-nfc-agent && npm install   # optional, NFC clinics only
```

**Step 2 — Create environment files:**

```bash
# Backend
cd backend
cp .env.example .env        # then edit values (see Section 5.1)

# Frontend
cd ../frontend
cp .env.example .env.local  # then edit values (see Section 5.2)
```

**Step 3 — Start MongoDB (local installs only):**

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows — MongoDB runs as a service after installation, or:
mongod --dbpath C:\data\db
```

---

# 5. Environment Configuration

## 5.1 Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` / `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/pawsync` |
| `JWT_SECRET` | JWT signing secret (min. 32 random chars) | `your-secure-random-string` |
| `JWT_EXPIRE` | Token expiration | `7d` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend email service API key | `re_...` |
| `OPENAI_API_KEY` | OpenAI API key (AI vet reports) | `sk-...` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials | `xxx.apps.googleusercontent.com` |

> **Security note:** never commit `.env` files. Generate `JWT_SECRET` with a cryptographically random generator (e.g., `openssl rand -hex 32`).

## 5.2 Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `http://localhost:5000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |

## 5.3 Local NFC Agent (`local-nfc-agent/.env`)

| Variable | Description | Example |
|---|---|---|
| `BACKEND_URL` | Deployed backend URL | `https://pawsync-backend.onrender.com` |
| `NFC_SECRET` | Shared secret for agent auth (must match backend) | `your-long-random-secret` |
| `POLL_INTERVAL_MS` | Write-command poll interval | `3000` |
| `DRAIN_INTERVAL_MS` | Offline event queue drain interval | `30000` |
| `LOG_LEVEL` | Winston log level | `info` |

## 5.4 Obtaining Third-Party API Keys

| Service | Purpose | Steps |
|---|---|---|
| **Resend** (required) | Verification and reminder emails | Create an account at resend.com → API Keys → create key → set `RESEND_API_KEY` |
| **OpenAI** (recommended) | AI vet report generation | platform.openai.com → API Keys → create key → set `OPENAI_API_KEY` |
| **Google OAuth** (recommended) | Social login | console.cloud.google.com → Credentials → Create OAuth Client ID (Web) → add the frontend origin to Authorized JavaScript origins → copy client ID/secret |
| **MongoDB Atlas** (production) | Cloud database | See Section 8.1 |

---

# 6. Database Setup and Seeding

With MongoDB running and `MONGODB_URI` configured, optionally seed initial data:

```bash
cd backend

# Seed initial clinic
npx ts-node scripts/seedClinic.ts

# Seed preventive care services catalog
npx ts-node scripts/seedPreventiveCareServices.ts

# Seed demo NFC requests (optional)
npx ts-node scripts/seedPendingNFCRequests.ts
```

A full demo dataset is also available as per-collection JSON exports in `mongo-seed/`, importable with `mongoimport`:

```bash
mongoimport --uri "mongodb://localhost:27017/pawsync" --collection users --file mongo-seed/test.users.json --jsonArray
# repeat per collection as needed
```

---

# 7. Running the System

## 7.1 Development Mode

From the project root (runs backend on port **5001** and frontend on port **3000** concurrently):

```bash
npm run dev
```

Or run each application individually:

```bash
cd backend && npm run dev          # nodemon auto-reload
cd frontend && npm run dev         # Next.js dev server, port 3000
cd local-nfc-agent && npm run dev  # ts-node (NFC clinics only)
```

Open `http://localhost:3000` in your browser.

## 7.2 Production Build

```bash
# Build both applications
npm run build

# Start both production servers
npm start
```

Or individually:

```bash
cd backend && npm run build && npm start    # runs dist/server.js
cd frontend && npm run build && npm start   # Next.js production server
```

Backend with PM2 process manager:

```bash
cd backend
npm run start:pm2    # uses ecosystem.config.js
```

---

# 8. Cloud Deployment

## 8.1 Database — MongoDB Atlas

1. Create a free cluster at cloud.mongodb.com.
2. Create a database user with a strong password.
3. Under **Network Access**, allow connections from your backend host (or `0.0.0.0/0` for platform-hosted backends such as Render).
4. Copy the connection string and set it as `MONGODB_URI` in the backend environment:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pawsync`

## 8.2 Backend — Render

1. Create a new **Web Service** on render.com pointing at the repository's `backend/` directory.
2. Build command: `npm install && npm run build`
3. Start command: `node dist/server.js`
4. Set all environment variables from Section 5.1 in the Render dashboard, with:
   - `NODE_ENV=production`
   - `MONGODB_URI` → the Atlas connection string
   - `FRONTEND_URL` → the deployed frontend URL (e.g., `https://pawsync.vercel.app`)
5. Deploy and note the public backend URL (e.g., `https://pawsync-backend.onrender.com`).

## 8.3 Frontend — Vercel

1. Import the repository into Vercel and set the project root to `frontend/`.
2. Vercel auto-detects Next.js.
3. Set the environment variables from Section 5.2, with `NEXT_PUBLIC_BACKEND_URL` pointing at the Render backend URL.
4. Deploy. Every push to the connected branch redeploys automatically.
5. Add the Vercel domain to Google Cloud Console's Authorized JavaScript origins if Google login is enabled.

---

# 9. NFC Agent Installation (Clinic On-Premises)

## 9.1 Overview

The NFC agent must run on the physical Windows computer connected to the clinic's NFC reader (ACS ACR122U). The recommended installation packages the agent as a standalone Windows executable (`PawSync-NFC-Agent.exe`) and registers it as a **Windows service** (`PawSyncNFC` — "PawSync NFC Bridge") using NSSM, so it:

- Starts automatically every time Windows boots
- Restarts itself if it crashes
- Runs silently in the background (no terminal window needed)

**Deliverables handed to the clinic:**

1. The agent package zip (`PawSync-NFC-Agent-Windows.zip`, distributed via the shared drive), or the source folder to build it on-site
2. A copy of `nssm.exe` (from nssm.cc) — kept as a backup in case the build script's automatic NSSM download fails

## 9.2 Prerequisites (Clinic Windows PC)

Install the following, in order, before building/installing the agent:

| # | Software | Version | Notes |
|---|---|---|---|
| 1 | Node.js | v22.23.1 | nodejs.org |
| 2 | npm | v10.9.8 | bundled with Node.js — verify with `npm -v` |
| 3 | Python | v3.14.6 | python.org — required by node-gyp for native modules |
| 4 | Visual Studio Build Tools 2022 | latest | https://aka.ms/vs/17/release/vs_buildtools.exe — select the **"Desktop development with C++"** workload |
| 5 | ACS ACR122U PC/SC driver | Windows installer | acs.com.hk → Products → ACR122U → Drivers |

The C++ build tools and Python are needed because the agent's NFC library (`nfc-pcsc`) compiles native modules during `npm install`.

## 9.3 Building and Installing the Agent (Windows, Recommended)

**Step 1 — Unzip the package** from the shared drive anywhere on the clinic PC (Desktop or Downloads is fine).

**Step 2 — Open the "x64 Native Tools Command Prompt for VS"** (installed with Visual Studio Build Tools) so the C++ toolchain is on the PATH.

**Step 3 — Run the build script** from the agent folder:

```bat
cd <unzipped folder>\local-nfc-agent
build.bat
```

The script installs dependencies, compiles TypeScript, bundles `PawSync-NFC-Agent.exe`, copies the native `.node` modules, writes a pre-filled `.env` (with `BACKEND_URL` and `NFC_SECRET`), downloads NSSM, and produces the output in `release\dist-windows\`.

> **If Step 7 of the build (NSSM download) fails:** copy the backup `nssm.exe` into the `release\dist-windows\` folder manually, then continue.

**Step 4 — Copy the entire `dist-windows` folder** into a separate folder (e.g., in Downloads). This copy is the installed location — do not run the service from inside the build tree.

**Step 5 — Install the Windows service.** In the copied `dist-windows` folder, right-click **`setup.bat`** → **Run as administrator**. The setup script:

- Verifies `PawSync-NFC-Agent.exe`, `nssm.exe`, and `.env` are present
- Checks the Smart Card service (`SCardSvr`) — i.e., that the ACS driver is installed — and sets it to start automatically
- Registers and starts the `PawSyncNFC` service with log rotation (logs are written to `logs\` inside the folder)

**Step 6 — Plug in the ACR122U reader.** Installation is complete.

**Step 7 — Verify:** the Patients page (`/clinic-admin/patients`) should show the reader as connected, and tapping a tag should load the pet instantly. Service status can be checked with:

```bat
sc query PawSyncNFC
```

## 9.4 Running the Agent Manually (Fallback / Verification)

If the service cannot start, or to watch the agent's output directly, run the executable in the foreground:

1. Open a new Command Prompt.
2. `cd` into the **copied** `dist-windows` folder.
3. Run:
   ```bat
   PawSync-NFC-Agent.exe
   ```
4. The agent logs reader connection and tag events directly to the console. Press `Ctrl+C` to stop.

Do not run the foreground agent and the Windows service at the same time — both cannot hold the reader simultaneously.

## 9.5 Alternative: Running from Source (Developers)

For development machines (any OS), the agent can be run directly from source without packaging:

```bash
cd local-nfc-agent
cp .env.example .env    # set BACKEND_URL and NFC_SECRET
npm install
npm run dev             # or: npm run build && npm start
npm run start:pm2       # optional: run under PM2
```

On macOS/Linux, ensure the PC/SC daemon (`pcscd`) is installed and running.

## 9.6 Uninstalling the Agent

Right-click **`uninstall.bat`** in the `dist-windows` folder → **Run as administrator**. This stops and removes the `PawSyncNFC` Windows service. The folder can then be deleted.

---

**Offline tolerance:** the agent queues events locally (`.nfc-queue.ndjson`) when the internet connection drops and re-sends them once connectivity is restored.

---

# 10. Verifying the Installation

Run through this checklist after installation:

| # | Check | Expected Result |
|---|---|---|
| 1 | Open the frontend URL | Landing/login page loads |
| 2 | Register a pet owner account | Verification email arrives (Resend working) |
| 3 | Verify email and log in | Redirected to pet onboarding, then dashboard |
| 4 | Add a pet | Pet appears in My Pets with a QR code |
| 5 | Open the pet's QR code from another device | Public pet profile loads; owner receives a scan alert |
| 6 | Log in as clinic admin (`/clinic-login`) | Clinic Admin dashboard loads |
| 7 | Book an appointment as the owner | Appointment appears on clinic and vet views; confirmation email arrives |
| 8 | (NFC clinics) Tap a tag at the Patients page | Reader status shows connected; pet record loads |
| 9 | (AI enabled) Generate a vet report | Draft report is produced (OpenAI working) |
| 10 | Run backend tests: `cd backend && npm test` | Test suite passes |

---

# 11. Troubleshooting

| Issue | Likely Cause | Resolution |
|---|---|---|
| `npm install` fails on native modules | Missing build tools (node-gyp) | Install platform build tools (Windows: Visual Studio Build Tools; macOS: Xcode CLT; Linux: `build-essential`) |
| Backend exits immediately with a Mongo error | MongoDB not running or bad `MONGODB_URI` | Start MongoDB; verify the URI and Atlas network access rules |
| Frontend shows network errors on every action | `NEXT_PUBLIC_BACKEND_URL` wrong or backend down | Point the variable at the running backend; restart the frontend after changing env vars |
| CORS errors in the browser | `FRONTEND_URL` in the backend does not match the frontend origin | Set the exact origin (scheme + host + port) and redeploy/restart |
| No emails received | Invalid `RESEND_API_KEY` or unverified sending domain | Verify the key and the sending domain in the Resend dashboard |
| Google login button fails | Origin not whitelisted or wrong client ID | Add the frontend origin in Google Cloud Console; check both frontend and backend Google env vars |
| `build.bat` fails at bundling / native modules | Python, or VS Build Tools C++ workload missing; wrong command prompt | Install prerequisites from Section 9.2; run from the "x64 Native Tools Command Prompt for VS" |
| `build.bat` Step 7 (NSSM download) fails | No internet or nssm.cc unreachable | Copy the backup `nssm.exe` into `release\dist-windows\` manually |
| `setup.bat` reports "Smart Card service not found" | ACS ACR122U driver not installed | Install the ACS PC/SC driver (acs.com.hk), then re-run `setup.bat` as administrator |
| NFC reader not detected | Driver/`pcscd` missing, or another program holds the reader | Install drivers; close other NFC software; restart the agent |
| Agent runs but events never arrive | `NFC_SECRET` mismatch or `BACKEND_URL` unreachable | Match the secret on both sides; test the backend URL from the clinic PC |
| Render backend sleeps / first request slow | Free-tier instance spin-down | Expected on free tier; upgrade the instance or use a keep-alive ping |
