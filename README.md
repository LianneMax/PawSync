# PawSync

**Web-based NFC and QR-enabled centralized pet medical record system**

PawSync is a full-stack veterinary management platform that digitizes pet health records using NFC tags and QR codes. It connects pet owners, veterinarians, and clinic administrators through a unified system for medical records, appointments, vaccinations, billing, and more.

---

## Table of Contents

- [System Overview](#system-overview)
- [Users of the System](#users-of-the-system)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Running the System](#running-the-system)
- [Backend Structure](#backend-structure)
- [Frontend Structure](#frontend-structure)
- [Local NFC Agent](#local-nfc-agent)
- [API Reference](#api-reference)
- [Database](#database)
- [Third-Party Services](#third-party-services)
- [Testing](#testing)
- [Deployment](#deployment)

---

## System Overview

PawSync solves the fragmentation of pet health records across multiple veterinary clinics by providing:

- **NFC-tagged pet profiles** — Tap an NFC tag to instantly pull up a pet's complete medical history at any clinic
- **QR code scanning** — Alternative to NFC for clinics without NFC hardware
- **Centralized medical records** — All pet health data accessible to authorized vets and owners
- **Vaccination tracking** — Dose sequencing, booster reminders, and age-based vaccine validation
- **Appointment management** — Online and walk-in bookings with email reminders
- **Billing & invoicing** — Product/service-based billing tied directly to medical records
- **AI-generated vet reports** — OpenAI-powered professional report generation from clinical notes
- **Real-time NFC events** — WebSocket-driven live feedback during NFC read/write operations
- **Pet ownership transfers** — Referral and invitation system for transferring pet records

---

## Users of the System

### Pet Owner
- Registers and manages their pets' profiles (name, breed, species, photos, etc.)
- Views complete medical history, vaccination records, and upcoming appointments
- Books appointments at registered clinics
- Requests NFC tags for their pets
- Receives email notifications for appointments and vaccination reminders
- Can transfer pet ownership to another user via referral

### Veterinarian
- Views pet profiles and full medical history when a pet visits
- Creates and edits medical records, prescriptions, and clinical notes
- Records vaccinations and manages booster schedules
- Manages their own availability and schedule
- Generates AI-powered professional veterinary reports
- Manages confinement (hospitalization/boarding) monitoring entries

### Clinic Administrator
- Manages the clinic profile and branches
- Scans NFC tags / QR codes at reception to pull up patient records
- Manages veterinarian applications, verifications, and resignations
- Oversees billing, payments, and product/service catalog
- Approves or rejects billing records
- Manages NFC tag requests and tag writing operations
- Can close (deactivate) the clinic

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | Express.js 5, Node.js, TypeScript |
| **Database** | MongoDB (Mongoose ODM), GridFS for file storage |
| **Auth** | JWT, bcryptjs, Google OAuth 2.0 |
| **Real-Time** | WebSocket (`ws`) for NFC events |
| **Email** | Resend API |
| **AI** | OpenAI API (vet report generation) |
| **State Management** | Zustand (frontend) |
| **Maps** | Leaflet + react-leaflet |
| **NFC Hardware** | nfc-pcsc (local agent) |
| **File Uploads** | Multer + multer-gridfs-storage |
| **Validation** | Zod (frontend), express-validator (backend) |
| **Testing** | Jest, ts-jest, supertest, mongodb-memory-server |

---

## Project Structure

```
PawSync/
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── config/           # Database connection (MongoDB + GridFS)
│   │   ├── controllers/      # Route handler logic (24 controllers)
│   │   ├── models/           # Mongoose schemas (29 models)
│   │   ├── routes/           # API route definitions (23 route files)
│   │   ├── services/         # Business logic (email, NFC, etc.)
│   │   ├── middleware/       # Auth, role guards, error handling
│   │   ├── websocket/        # WebSocket server for NFC events
│   │   ├── utils/            # Helper utilities
│   │   └── types/            # TypeScript type definitions
│   ├── scripts/              # Database seed scripts
│   ├── uploads/              # Local file storage (dev only)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/              # App Router pages and layouts
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # API client functions
│   │   ├── store/            # Zustand state stores
│   │   ├── hooks/            # Custom React hooks
│   │   └── middleware.ts     # Role-based route protection
│   ├── public/               # Static assets
│   ├── .env.example
│   ├── package.json
│   └── next.config.mjs
│
├── local-nfc-agent/          # Standalone NFC hardware bridge
│   ├── src/                  # TypeScript source
│   ├── .env.example
│   └── package.json
│
├── docs/                     # Architecture and feature documentation
├── setup.sh                  # Automated setup script (macOS)
├── package.json              # Root monorepo scripts
└── README.md
```

---

## Prerequisites

Make sure the following are installed before setting up PawSync:

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- **MongoDB** v6 or higher (local) — [mongodb.com](https://www.mongodb.com/try/download/community) — or a MongoDB Atlas connection string
- **Git**

### Optional (for NFC hardware support)
- A compatible NFC reader (ACR122U or similar PC/SC-compatible reader)
- Relevant system-level NFC drivers (`pcscd` on Linux/macOS)

---

## Installation & Setup

### Option 1 — Automated Setup (macOS)

```bash
git clone <repository-url>
cd PawSync
chmod +x setup.sh
./setup.sh
```

The setup script installs MongoDB (via Homebrew), starts the MongoDB service, and installs all npm dependencies for the root, backend, and frontend.

---

### Option 2 — Manual Setup

**1. Clone the repository**
```bash
git clone <repository-url>
cd PawSync
```

**2. Install all dependencies**

Running `npm install` at the root automatically installs dependencies for both `backend/` and `frontend/` via the `postinstall` script.

```bash
npm install
```

Or install each manually:
```bash
# Root
npm install

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Local NFC Agent (optional)
cd local-nfc-agent && npm install
```

**3. Configure environment variables**

Backend:
```bash
cd backend
cp .env.example .env
# Edit .env with your values (see Environment Variables section)
```

Frontend:
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your values
```

**4. Start MongoDB** (if running locally)
```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Direct
mongod --dbpath /data/db
```

**5. (Optional) Seed the database with initial data**
```bash
cd backend
npx ts-node scripts/seedClinic.ts
npx ts-node scripts/seedPreventiveCareServices.ts
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/pawsync` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-secure-random-string` |
| `JWT_EXPIRE` | Token expiration | `7d` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend email service API key | `re_...` |
| `OPENAI_API_KEY` | OpenAI API key for vet reports | `sk-...` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `http://localhost:5000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |

### Local NFC Agent (`local-nfc-agent/.env`)

| Variable | Description | Example |
|---|---|---|
| `BACKEND_URL` | Backend server URL | `https://pawsync-backend.onrender.com` |
| `NFC_SECRET` | Shared secret for agent auth | `your-long-random-secret` |
| `POLL_INTERVAL_MS` | How often to poll for write commands | `3000` |
| `DRAIN_INTERVAL_MS` | How often to drain the command queue | `30000` |
| `LOG_LEVEL` | Winston log level | `info` |

---

## Running the System

### Development (both frontend + backend simultaneously)

From the project root:
```bash
npm run dev
```

This runs the backend on **port 5001** and the frontend on **port 3000** concurrently using `concurrently`.

---

### Running individually

**Backend only:**
```bash
cd backend
npm run dev        # Development with nodemon (auto-reload)
```

**Frontend only:**
```bash
cd frontend
npm run dev        # Next.js dev server on port 3000
```

**Local NFC Agent:**
```bash
cd local-nfc-agent
npm run dev        # Development with ts-node
```

---

### Production Build

**Build both:**
```bash
npm run build
```

**Build individually:**
```bash
# Backend — compiles TypeScript to dist/
cd backend && npm run build

# Frontend — Next.js production build
cd frontend && npm run build
```

**Start production servers:**
```bash
npm start

# Or individually:
cd backend && npm start       # Runs dist/server.js
cd frontend && npm start      # Runs Next.js production server
```

**Backend with PM2:**
```bash
cd backend
npm run start:pm2             # Uses ecosystem.config.js
```

---

### Useful npm Scripts

| Location | Command | Description |
|---|---|---|
| Root | `npm run dev` | Run frontend + backend concurrently |
| Root | `npm run build` | Build both frontend and backend |
| Root | `npm start` | Start both production builds |
| Backend | `npm run dev` | Development server with auto-reload |
| Backend | `npm run build` | Compile TypeScript to `dist/` |
| Backend | `npm start` | Run compiled production server |
| Backend | `npm test` | Run Jest test suite |
| Frontend | `npm run dev` | Next.js development server |
| Frontend | `npm run build` | Next.js production build |
| Frontend | `npm start` | Next.js production server |
| Frontend | `npm run lint` | ESLint check |
| NFC Agent | `npm run dev` | Agent with ts-node |
| NFC Agent | `npm run build` | Compile TypeScript |
| NFC Agent | `npm start` | Run compiled agent |

---

## Backend Structure

### Technology
- **Framework:** Express.js 5.2.1
- **Language:** TypeScript 5.9.3
- **Default Port:** `5000` (fallback `5001`)
- **Database ORM:** Mongoose 9

### Controllers (24)
Handles business logic separated from routing:

| Controller | Responsibility |
|---|---|
| `authController` | Registration, login, Google OAuth, OTP, password reset |
| `petController` | Pet CRUD, QR code, NFC tag assignment |
| `medicalRecordController` | Medical record lifecycle |
| `vaccinationController` | Vaccination recording and tracking |
| `appointmentController` | Appointment booking and management |
| `vetScheduleController` | Vet availability and scheduling |
| `clinicController` | Clinic and branch management |
| `verificationController` | Vet credential verification |
| `vetApplicationController` | Vet onboarding workflow |
| `billingController` | Invoice creation, approval, rejection |
| `productServiceController` | Clinic product/service catalog |
| `confinementController` | Pet hospitalization records |
| `nfcController` | NFC tag reading, writing, tag requests |
| `notificationController` | User notification management |
| `vetReportController` | AI-generated vet report generation |
| `referralController` | Pet referral and ownership transfer |
| `resignationController` | Vet resignation workflow |
| `vetLeaveController` | Leave request and approval |
| `petNotesController` | Clinical notes per pet |
| `paymentQRController` | QR-based payment handling |
| `uploadController` | File upload to GridFS |
| `userController` | User profile management |

### Middleware

| Middleware | Purpose |
|---|---|
| `authMiddleware` | Verifies JWT token on protected routes |
| `veterinarianOnly` | Restricts route to veterinarians |
| `petOwnerOnly` | Restricts route to pet owners |
| `clinicAdminOnly` | Restricts route to clinic admins |
| `vetOrClinicAdminOnly` | Allows either role |
| `mainBranchOnly` | Allows only main branch admin actions |

### Authentication Flow

1. User registers with email/password or Google OAuth
2. Email verification link sent via Resend
3. On login, JWT token issued (stored in httpOnly cookie)
4. "Remember me" sets a persistent session; otherwise session cookie
5. Rate limiting: 3 failed login attempts → 15-minute lockout
6. Password reset via OTP sent to registered email

### WebSocket (NFC Real-Time)

- **Endpoint:** `ws://<host>/ws/nfc`
- NFC events from the local agent are forwarded to all connected browser clients
- Events: `reader:connect`, `reader:disconnect`, `card:read`, `card:write-complete`
- Browser clients trigger NFC writes; agent polls for queued commands every few seconds

---

## Frontend Structure

### Technology
- **Framework:** Next.js 15 (App Router)
- **UI:** React 19, Tailwind CSS 4, Radix UI, Lucide Icons
- **State:** Zustand 5 with localStorage persistence
- **Forms:** react-hook-form + Zod
- **Animations:** Framer Motion / Motion

### Pages by Role

**Public / Authentication**
| Route | Description |
|---|---|
| `/login` | Pet owner login |
| `/clinic-login` | Clinic admin / vet login |
| `/signup` | User registration |
| `/verify-email` | Email verification |
| `/join` | Accept pet ownership invitation |
| `/invite/accept` | Claim invited account |

**Pet Owner**
| Route | Description |
|---|---|
| `/dashboard` | Home dashboard |
| `/my-pets` | Pet list and profiles |
| `/my-pets/[id]/nfc` | NFC tag assignment for a pet |
| `/my-pets/[id]/vaccine-card` | Vaccine certificate for a pet |
| `/my-appointments` | View and book appointments |
| `/vaccine-cards` | All pet vaccine cards |
| `/vaccine-schedule` | Upcoming vaccination timeline |
| `/patient-records` | Pet medical records viewer |
| `/settings` | Account settings |

**Veterinarian**
| Route | Description |
|---|---|
| `/vet-dashboard` | Vet home dashboard |
| `/vet-dashboard/appointments` | Manage appointments |
| `/vet-dashboard/medical-records` | Create and edit medical records |
| `/vet-dashboard/vaccinations` | Record and manage vaccinations |
| `/vet-dashboard/reports` | AI-generated report management |
| `/vet-appointments` | Appointment scheduling |
| `/vet-vaccine-schedule` | Vaccine schedule for patients |
| `/vet-settings` | Vet profile settings |

**Clinic Administrator**
| Route | Description |
|---|---|
| `/clinic-admin` | Admin dashboard |
| `/clinic-admin/patients` | Patient scanning (NFC/QR) |
| `/clinic-admin/appointments` | Clinic-wide appointment management |
| `/clinic-admin/verification` | Vet verification queue |
| `/billing` | Billing management |
| `/product-man` | Product and service catalog |
| `/reports` | Report viewer |

**Onboarding**
| Route | Description |
|---|---|
| `/onboarding/pet` | First-time pet owner setup |
| `/onboarding/vet` | Veterinarian onboarding |

### Route Protection

All routes are protected via Next.js middleware (`src/middleware.ts`):
- Reads `authToken` and `userType` cookies
- Redirects unauthenticated users to the appropriate login page
- Redirects authenticated users to their role-specific dashboard
- Public routes (email verification, reports, join pages) are always accessible

### Key Components

| Component | Description |
|---|---|
| `DashboardLayout` | Main layout wrapper with sidebar/navbar |
| `Navbar` | Role-aware top navigation |
| `MedicalRecordStagedModal` | Comprehensive multi-step medical record form |
| `BillingFromRecordModal` | Create billing from a medical record |
| `BillingViewModal` | View and manage billing details |
| `SurgeryAppointmentModal` | Surgery appointment booking form |
| `ConfinementMonitoringPanel` | Hospitalization/boarding monitoring UI |
| `NFCLinkModal` | NFC tag linking workflow |
| `ReferralModal` | Pet ownership referral form |
| `ScanLocationsMap` | Leaflet map of pet scan history |

### API Client (`lib/`)

All backend communication is done through typed API client functions:

| File | Purpose |
|---|---|
| `auth.ts` | Auth endpoints (login, register, logout) |
| `pets.ts` | Pet CRUD |
| `appointments.ts` | Appointment management |
| `medicalRecords.ts` | Medical record operations |
| `billingSync.ts` | Billing synchronization |
| `confinementMonitoring.ts` | Confinement record operations |
| `clinics.ts` | Clinic and branch operations |
| `notifications.ts` | Notification fetching |
| `referrals.ts` | Referral management |
| `petNfc.ts` | NFC tag operations |
| `petNotes.ts` | Clinical notes |
| `users.ts` | User profile operations |
| `upload.ts` | File upload helpers |
| `helpers.ts` | Shared utility functions |
| `philippineLocations.ts` | Region/city data for PH locations |

---

## Local NFC Agent

The local NFC agent is a standalone Node.js application that runs **on-premises** (e.g., at a clinic's front desk computer) and bridges NFC hardware with the cloud-hosted backend.

### Why It's Needed
When the backend is hosted on a cloud server (e.g., Render), it cannot directly access locally-connected USB NFC readers. The agent handles hardware events locally and communicates with the backend over HTTPS/WebSocket.

### How It Works
1. Agent detects an NFC reader connected to the local machine
2. When a card is tapped, the agent reads the NFC tag ID
3. Agent POSTs the event to `POST /api/nfc/events` (authenticated with `NFC_SECRET`)
4. Backend broadcasts the event to all connected browser clients via WebSocket
5. For write operations, the browser triggers a write command; the agent polls `GET /api/nfc/commands/pending` and executes the write on the hardware

### Setup
```bash
cd local-nfc-agent
cp .env.example .env
# Set BACKEND_URL and NFC_SECRET
npm install
npm run dev
```

### Running with PM2 (recommended for clinics)
```bash
cd local-nfc-agent
npm run start:pm2
```

---

## API Reference

Base URL: `http://localhost:5000/api`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Register new user |
| `POST` | `/auth/login` | No | Login with email/password |
| `GET` | `/auth/me` | Yes | Get current user profile |
| `POST` | `/auth/logout` | Yes | Logout and clear cookie |
| `POST` | `/auth/google` | No | Google OAuth login |
| `POST` | `/auth/forgot-password` | No | Request OTP for password reset |
| `POST` | `/auth/verify-otp` | No | Verify OTP |
| `POST` | `/auth/reset-password` | No | Reset password with verified OTP |
| `GET` | `/auth/verify-email` | No | Verify email via link |
| `POST` | `/auth/activate-invitation` | No | Claim an invited account |

### Pets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/pets` | Pet Owner | Create a pet |
| `GET` | `/pets` | Yes | List current user's pets |
| `GET` | `/pets/:petId` | Yes | Get pet details |
| `PUT` | `/pets/:petId` | Pet Owner | Update pet profile |

### NFC

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/nfc/status` | Yes | Check NFC service status |
| `GET` | `/nfc/readers` | Yes | List connected NFC readers |
| `GET` | `/nfc/pet/:petId/for-writing` | Yes | Get pet data for NFC write |
| `GET` | `/nfc/pet/:petId/status` | Yes | Check if pet has an NFC tag |
| `POST` | `/nfc/pet/:petId/write` | Yes | Initiate NFC write |
| `POST` | `/nfc/pet/:petId/record-writing` | Yes | Record completed NFC write |
| `GET` | `/nfc/by-tag-id/:nfcTagId` | Yes | Look up pet by NFC tag ID |
| `POST` | `/nfc/pet/:petId/request-tag` | Pet Owner | Request an NFC tag |
| `GET` | `/nfc/clinic/pending-requests` | Clinic Admin | View pending tag requests |
| `POST` | `/nfc/events` | Agent Auth | Agent posts NFC events |
| `GET` | `/nfc/commands/pending` | Agent Auth | Agent polls for write commands |
| `POST` | `/nfc/commands/:id/result` | Agent Auth | Agent posts write result |

### Medical Records

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/medical-records` | Vet | Create medical record |
| `GET` | `/medical-records/:id` | Yes | Get medical record |
| `PUT` | `/medical-records/:id` | Vet | Update medical record |
| `GET` | `/medical-records/pet/:petId` | Yes | Get all records for a pet |

### Vaccinations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/vaccinations` | Vet | Record a vaccination |
| `GET` | `/vaccinations/pet/:petId` | Yes | Get pet's vaccination history |
| `PUT` | `/vaccinations/:id` | Vet | Update vaccination record |
| `GET` | `/vaccine-types` | Yes | List all vaccine types |

### Appointments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/appointments` | Pet Owner | Book an appointment |
| `GET` | `/appointments` | Yes | List appointments (role-aware) |
| `PUT` | `/appointments/:id` | Yes | Update appointment |
| `DELETE` | `/appointments/:id` | Pet Owner | Cancel appointment |

### Billing

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/billings` | Vet / Admin | Create billing record |
| `GET` | `/billings` | Yes | List billings |
| `PUT` | `/billings/:id` | Admin | Update billing |
| `POST` | `/billings/:id/reject` | Admin | Reject a billing record |

### Clinics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/clinics` | Admin | Create clinic |
| `GET` | `/clinics` | Yes | List clinics |
| `GET` | `/clinics/:id` | Yes | Get clinic details |
| `POST` | `/clinics/:id/branches` | Admin | Create clinic branch |

### Vet Schedule

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/vet-schedule` | Vet | Set availability |
| `GET` | `/vet-schedule/:vetId` | Yes | Get vet's schedule |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications` | Yes | Get current user's notifications |
| `PUT` | `/notifications/:id/read` | Yes | Mark notification as read |

### File Uploads

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/upload` | Yes | Upload file to GridFS |
| `GET` | `/upload/:filename` | Yes | Retrieve file from GridFS |

---

## Database

**Type:** MongoDB (Mongoose ODM)
**GridFS:** Used for storing large files (medical images, PDFs, pet photos)

### Key Collections (29 models)

| Collection | Description |
|---|---|
| `users` | All user accounts with role field |
| `pets` | Pet profiles with NFC tag and QR data |
| `clinics` | Clinic profiles |
| `clinicbranches` | Clinic branch locations |
| `appointments` | Booking records |
| `medicalrecords` | Full medical record with file refs |
| `vaccinations` | Individual dose records |
| `vaccinetypes` | Vaccine definitions with series/age rules |
| `vetschedules` | Veterinarian availability |
| `vetverifications` | Credential verification workflow |
| `vetapplications` | Vet onboarding requests |
| `billings` | Invoice records |
| `productservices` | Billable items catalog |
| `confinementrecords` | Hospitalization records |
| `confinementmonitoringentries` | Daily boarding notes |
| `vetreports` | AI-generated report data |
| `referrals` | Pet ownership referrals |
| `ownershiptransfers` | Transfer requests |
| `notifications` | User notification queue |
| `audittrails` | Activity log |
| `petnotes` | Clinical notes per pet |
| `pettagrequests` | NFC tag request queue |
| `nfccommands` | NFC write command queue |
| `resignations` | Vet resignation records |
| `vetleaves` | Leave request records |
| `paymentqrs` | QR payment records |
| `assignedvets` | Vet-to-patient assignment tracking |
| `pregnancyevidences` | Pregnancy documentation records |
| `uploads.files` / `uploads.chunks` | GridFS file storage |

### Seeding the Database

```bash
cd backend

# Seed initial clinic
npx ts-node scripts/seedClinic.ts

# Seed preventive care services
npx ts-node scripts/seedPreventiveCareServices.ts

# Seed demo NFC requests (optional)
npx ts-node scripts/seedPendingNFCRequests.ts
```

---

## Third-Party Services

### Required

| Service | Purpose | Where to Get |
|---|---|---|
| **MongoDB** | Primary database | [mongodb.com](https://www.mongodb.com) or local install |
| **Resend** | Transactional email (30+ templates) | [resend.com](https://resend.com) |

### Optional but Recommended

| Service | Purpose | Where to Get |
|---|---|---|
| **OpenAI** | AI-generated veterinary reports | [platform.openai.com](https://platform.openai.com) |
| **Google OAuth** | Social login for users | [console.cloud.google.com](https://console.cloud.google.com) |

### Frontend Libraries (No Key Required)

| Library | Purpose |
|---|---|
| **Leaflet** | Interactive maps for pet scan locations |
| **qrcode.react** | QR code generation for pet profiles |
| **html5-qrcode** | In-browser QR code scanning |
| **Framer Motion** | UI animations |
| **Radix UI** | Accessible UI primitives |

---

## Testing

```bash
cd backend
npm test
```

- **Framework:** Jest with ts-jest
- **API Testing:** supertest
- **In-Memory DB:** mongodb-memory-server (no real database needed for tests)
- **Timeout:** 30 seconds (to allow MongoDB setup)
- **Location:** `backend/src/__tests__/`

---

## Deployment

### Backend (Render / any Node.js host)

1. Build: `npm run build`
2. Start: `node dist/server.js`
3. Set all environment variables in the hosting dashboard
4. Set `NODE_ENV=production`
5. Ensure MongoDB URI points to MongoDB Atlas or a remote instance

### Frontend (Vercel)

1. Connect the `frontend/` directory to a Vercel project
2. Set environment variables in the Vercel dashboard
3. Vercel auto-detects Next.js and builds/deploys on push

### Local NFC Agent (On-Premises)

The NFC agent must run on the physical machine connected to the NFC reader:

```bash
cd local-nfc-agent
# Point BACKEND_URL to your deployed backend
npm run build
npm start

# Or with PM2 for process management
npm run start:pm2
```

---

## Documentation

Additional technical documentation is available in the [`docs/`](docs/) directory:

| File | Description |
|---|---|
| `ARCHITECTURE.md` | System design and data flow diagrams |
| `NFC_QUICK_START.md` | NFC setup guide for clinics |
| `NFC_PET_PROFILE_WORKFLOW.md` | End-to-end NFC workflow |
| `CLINIC_PATIENT_SCANNING_USER_GUIDE.md` | Clinic scanning guide |
| `CLINIC_SCANNING_ARCHITECTURE.md` | Clinic scanning system design |
| `VACCINATION_SYSTEM_ARCHITECTURE.md` | Vaccination system design |
| `VACCINATION_AGE_VALIDATION_README.md` | Age-based vaccine validation rules |
| `IMPLEMENTATION_SUMMARY.md` | Feature implementation notes |

---

## Security Notes

- JWT tokens are stored in **httpOnly cookies** (not localStorage) to prevent XSS
- Passwords are hashed with **bcryptjs** (never stored in plaintext)
- Login is rate-limited: **3 attempts** before a 15-minute lockout
- All protected routes require a valid JWT via `authMiddleware`
- Role-based guards prevent cross-role access to sensitive routes
- The local NFC agent authenticates with the backend using a shared `NFC_SECRET` header
- CORS is configured to allow only trusted origins
- Helmet.js applies secure HTTP headers on all responses
- Email domain validation via MX record lookup on registration
