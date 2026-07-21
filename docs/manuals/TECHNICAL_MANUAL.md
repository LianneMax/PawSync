# DE LA SALLE UNIVERSITY
### Manila

---

# PawSync
### A Web-Based NFC and QR-Enabled Centralized Pet Medical Record System

# TECHNICAL MANUAL

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | July 2026 |
| **Prepared for** | Partner Veterinary Clinics / IT Staff |
| **Prepared By** | Balbastro, *[add other team members]* |

---

## Table of Contents

- 1. System Overview
- 2. System Architecture
  - 2.1 Technology Stack
  - 2.2 High-Level Architecture
  - 2.3 Repository Structure
- 3. Backend Architecture
  - 3.1 Controllers
  - 3.2 Middleware and Role Guards
  - 3.3 Authentication Flow
  - 3.4 WebSocket (Real-Time NFC Events)
- 4. Frontend Architecture
  - 4.1 Routing and Role-Based Access
  - 4.2 State Management
  - 4.3 Key Components
- 5. NFC Hardware Architecture
  - 5.1 Component List
  - 5.2 Local NFC Agent
  - 5.3 NFC Data Flow
- 6. Database Configuration
  - 6.1 Platform Details
  - 6.2 Collections
  - 6.3 File Storage (GridFS)
  - 6.4 Seeding
- 7. API Reference
- 8. Third-Party Services
- 9. Security
- 10. Deployment Architecture
- 11. Testing
- 12. Troubleshooting

---

# 1. System Overview

PawSync is a web-based, full-stack veterinary management platform that centralizes pet medical records and identifies pets through NFC tags and QR codes. It connects three registered user roles — pet owners, veterinarians, and clinic administrators — plus an unauthenticated public view for pet finders.

The system solves the fragmentation of pet health records across multiple veterinary clinics by providing:

- NFC-tagged and QR-coded pet profiles retrievable at any partner clinic
- Centralized medical records, vaccinations, and appointments
- Billing tied directly to medical records
- AI-generated veterinary reports (OpenAI)
- Real-time NFC read/write feedback over WebSocket
- Lost-pet reporting and scan-location tracking

> **INFO:** This manual covers the software architecture, hardware bridge, database, API surface, security model, and deployment configuration. It is intended for IT staff and developers responsible for installation and maintenance. For step-by-step setup, see the Installation Manual.

---

# 2. System Architecture

## 2.1 Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 | Web client for all user roles |
| Backend | Express.js 5, Node.js, TypeScript | HTTP routing, REST API, business logic |
| Database | MongoDB (Mongoose 9 ODM) | Persistent storage for all system data |
| File Storage | GridFS (via Multer + multer-gridfs-storage) | Medical images, PDFs, pet photos |
| Authentication | JWT (httpOnly cookies), bcryptjs, Google OAuth 2.0 | Login, sessions, social sign-in |
| Real-Time | WebSocket (`ws`) | Live NFC events to browser clients |
| Email | Resend API | Transactional email (30+ templates) |
| AI | OpenAI API | Vet report generation |
| State Management | Zustand 5 (localStorage persistence) | Frontend state |
| Maps | Leaflet + react-leaflet | Pet scan-location maps |
| NFC Hardware Bridge | nfc-pcsc (local agent) | USB NFC reader communication |
| QR | qrcode.react (generation), html5-qrcode (in-browser scanning) | Pet identification without NFC hardware |
| Validation | Zod (frontend), express-validator (backend) | Input validation |
| Testing | Jest, ts-jest, supertest, mongodb-memory-server | Backend test suite |

## 2.2 High-Level Architecture

```
┌────────────────┐   HTTPS    ┌────────────────────┐   Mongoose   ┌──────────────┐
│  Next.js 15    │──────────▶│  Express.js API     │─────────────▶│  MongoDB     │
│  (Vercel)      │◀──────────│  (Render)           │◀─────────────│  (+ GridFS)  │
└──────┬─────────┘  JSON/JWT  └───────┬───────┬────┘              └──────────────┘
       │                              │       │
       │  WebSocket /ws/nfc           │       ├──▶ Resend API  (email)
       └──────────────────────────────┘       └──▶ OpenAI API  (vet reports)
                                      ▲
                       HTTPS (NFC_SECRET auth)
                                      │
                          ┌───────────┴──────────┐
                          │  Local NFC Agent      │
                          │  (clinic front desk)  │
                          └───────────┬──────────┘
                                      │ PC/SC (USB)
                          ┌───────────┴──────────┐
                          │  NFC Reader (ACR122U) │
                          └──────────────────────┘
```

## 2.3 Repository Structure

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
│   └── scripts/              # Database seed scripts
├── frontend/                 # Next.js application
│   ├── app/                  # App Router pages and layouts
│   ├── components/           # Reusable UI components
│   ├── lib/                  # Typed API client functions
│   ├── store/                # Zustand state stores
│   └── middleware.ts         # Role-based route protection
├── local-nfc-agent/          # Standalone NFC hardware bridge
├── mongo-seed/               # Seed data (JSON exports per collection)
├── docs/                     # Architecture and feature documentation
└── setup.sh                  # Automated setup script (macOS)
```

---

# 3. Backend Architecture

- **Framework:** Express.js 5.2.1 · **Language:** TypeScript 5.9.3
- **Default port:** 5000 (5001 when run via the root `npm run dev` script)
- **ORM:** Mongoose 9

## 3.1 Controllers

| Controller | Responsibility |
|---|---|
| `authController` | Registration, login, Google OAuth, OTP, password reset |
| `petController` | Pet CRUD, QR code, NFC tag assignment, scan alerts |
| `medicalRecordController` | Medical record lifecycle |
| `vaccinationController` | Vaccination recording, dose/age validation, boosters |
| `appointmentController` | Appointment booking and management |
| `vetScheduleController` | Vet availability and scheduling |
| `clinicController` | Clinic and branch management |
| `verificationController` | Vet credential verification |
| `vetApplicationController` | Vet onboarding workflow |
| `billingController` | Invoice creation, approval, rejection |
| `productServiceController` | Clinic product/service catalog |
| `confinementController` | Hospitalization records and monitoring entries |
| `nfcController` | NFC tag reading, writing, tag requests, agent endpoints |
| `notificationController` | User notification management |
| `vetReportController` | AI-generated vet report generation |
| `referralController` | Pet referral and ownership transfer |
| `resignationController` | Vet resignation workflow |
| `vetLeaveController` | Leave request and approval |
| `petNotesController` | Clinical notes per pet |
| `paymentQRController` | QR-based payment handling |
| `uploadController` | File upload to GridFS |
| `userController` | User profile management |

## 3.2 Middleware and Role Guards

| Middleware | Purpose |
|---|---|
| `authMiddleware` | Verifies JWT token on protected routes |
| `veterinarianOnly` | Restricts route to veterinarians |
| `petOwnerOnly` | Restricts route to pet owners |
| `clinicAdminOnly` | Restricts route to clinic admins |
| `vetOrClinicAdminOnly` | Allows either staff role |
| `mainBranchOnly` | Allows only main-branch admin actions |

## 3.3 Authentication Flow

1. User registers with email/password or Google OAuth.
2. Email verification link sent via Resend; registration validates the email domain via MX record lookup.
3. On login, a JWT is issued and stored in an **httpOnly cookie** (not localStorage).
4. "Remember me" sets a persistent cookie; otherwise a session cookie is used.
5. Rate limiting: **3 failed login attempts → 15-minute lockout**.
6. Password reset via OTP sent to the registered email.

## 3.4 WebSocket (Real-Time NFC Events)

- **Endpoint:** `ws://<host>/ws/nfc`
- NFC events posted by the local agent are broadcast to all connected browser clients.
- Event types: `reader:connect`, `reader:disconnect`, `card:read`, `card:write-complete`.
- Write path: the browser triggers a write via REST; the backend queues an `nfccommands` document; the agent polls `GET /api/nfc/commands/pending`, executes the write on hardware, and posts the result back.

---

# 4. Frontend Architecture

## 4.1 Routing and Role-Based Access

All routes are protected by Next.js middleware (`frontend/middleware.ts`):

- Reads `authToken` and `userType` cookies.
- Route permission map assigns each path prefix to allowed roles (`pet-owner`, `veterinarian`, `clinic-admin`).
- Unauthenticated users are redirected to `/login` (pet owners) or `/clinic-login` (staff), with a `redirect` query param back to the original page.
- Authenticated users hitting another role's route are redirected to their own dashboard.
- Public routes (`/verify-email`, `/reports`, `/join`, and the public pet profile `/pet/[petId]`) are always accessible.

**Pages by role:**

| Role | Key routes |
|---|---|
| Public | `/`, `/login`, `/clinic-login`, `/signup`, `/verify-email`, `/join`, `/invite/accept`, `/pet/[petId]`, `/reports/[id]`, `/activate-owner` |
| Pet Owner | `/dashboard`, `/my-pets`, `/my-pets/[id]/nfc`, `/my-pets/[id]/vaccine-card`, `/my-appointments`, `/vaccine-cards`, `/vaccine-schedule`, `/patient-records`, `/billing`, `/settings`, `/onboarding/pet` |
| Veterinarian | `/vet-dashboard`, `/vet-dashboard/appointments`, `/vet-dashboard/vaccinations`, `/vet-dashboard/reports`, `/vet-appointments`, `/vet-vaccine-schedule`, `/vet-settings`, `/onboarding/vet` |
| Clinic Admin | `/clinic-admin`, `/clinic-admin/patients`, `/clinic-admin/nfc`, `/clinic-admin/clients`, `/clinic-admin/appointments`, `/clinic-admin/medical-records`, `/clinic-admin/vaccinations`, `/clinic-admin/vaccine-types`, `/clinic-admin/vaccine-schedule`, `/clinic-admin/verification`, `/clinic-admin/clinic-management`, `/billing`, `/product-man` |

## 4.2 State Management

- **Zustand 5** stores with localStorage persistence (e.g., `authStore` for the session user).
- Forms use **react-hook-form + Zod** resolvers.
- All backend communication goes through typed API client functions in `lib/` (`auth.ts`, `pets.ts`, `appointments.ts`, `medicalRecords.ts`, `billingSync.ts`, `clinics.ts`, `petNfc.ts`, etc.).

## 4.3 Key Components

| Component | Description |
|---|---|
| `DashboardLayout` | Main layout wrapper with sidebar/navbar |
| `Navbar` | Role-aware top navigation |
| `MedicalRecordStagedModal` | Multi-step medical record form |
| `BillingFromRecordModal` | Create billing from a medical record |
| `BillingViewModal` | View and manage billing details |
| `SurgeryAppointmentModal` | Surgery appointment booking form |
| `ConfinementMonitoringPanel` | Hospitalization monitoring UI |
| `NFCLinkModal` | NFC tag linking workflow |
| `ReferralModal` | Pet ownership referral form |
| `ScanLocationsMap` | Leaflet map of pet scan history |

---

# 5. NFC Hardware Architecture

## 5.1 Component List

| Component | Model / Spec | Function |
|---|---|---|
| NFC Reader | ACR122U (or any PC/SC-compatible reader) | Reads/writes 13.56 MHz NFC tags |
| NFC Tags | NTAG-family (or compatible) | Physical pet tags written with the pet's identifier |
| Host PC | Clinic front-desk computer (Windows/macOS/Linux) | Runs the local NFC agent |
| Drivers | PC/SC stack (`pcscd` on Linux/macOS; built-in on Windows) | USB reader communication |

## 5.2 Local NFC Agent

The local NFC agent (`local-nfc-agent/`) is a standalone Node.js/TypeScript application that runs **on-premises** at the clinic and bridges USB NFC hardware with the cloud-hosted backend. It is required because a cloud server cannot access locally connected USB readers.

Internals:

| Module | Purpose |
|---|---|
| `nfcWorker.ts` | Talks to the reader via `nfc-pcsc`; detects taps, performs writes |
| `httpRelay.ts` | POSTs card/reader events to the backend (`/api/nfc/events`) |
| `commandPoller.ts` | Polls `/api/nfc/commands/pending` for queued write commands |
| `eventQueue.ts` | Persists unsent events to `.nfc-queue.ndjson` for retry (offline tolerance) |
| `logger.ts` | Winston logging |
| `ecosystem.config.js` | PM2 process configuration for unattended operation |

Agent authentication uses a shared secret: every request carries the `NFC_SECRET` value configured on both the agent and the backend.

## 5.3 NFC Data Flow

**Read (tap) flow:**

```
Pet tag tapped → Agent reads tag ID → POST /api/nfc/events (NFC_SECRET)
→ Backend broadcasts over WebSocket /ws/nfc → Clinic browser loads pet by tag ID
```

**Write flow:**

```
Admin clicks "Write Tag" in browser → POST /api/nfc/pet/:petId/write
→ Backend queues nfccommands document → Agent polls /api/nfc/commands/pending
→ Agent writes tag on hardware → POST /api/nfc/commands/:id/result
→ Backend broadcasts card:write-complete → Browser shows success
```

Polling intervals are configurable via `POLL_INTERVAL_MS` (default 3000 ms) and `DRAIN_INTERVAL_MS` (default 30000 ms).

---

# 6. Database Configuration

## 6.1 Platform Details

| Item | Value |
|---|---|
| Engine | MongoDB v6+ (local) or MongoDB Atlas (cloud) |
| ODM | Mongoose 9 |
| Database name | `pawsync` (from `MONGODB_URI`) |
| Connection | `MONGODB_URI` env var, e.g. `mongodb://localhost:27017/pawsync` |
| Large files | GridFS buckets `uploads.files` / `uploads.chunks` |

## 6.2 Collections

| Collection | Description |
|---|---|
| `users` | All user accounts with role field (`pet-owner`, `veterinarian`, `clinic-admin`) |
| `pets` | Pet profiles with NFC tag ID, QR data, lost status, scan locations |
| `clinics` / `clinicbranches` | Clinic profiles and branch locations |
| `appointments` | Booking records |
| `medicalrecords` | Full medical records with file references |
| `vaccinations` / `vaccinetypes` | Dose records and vaccine definitions with series/age rules |
| `vetschedules` / `vetleaves` | Veterinarian availability and leave requests |
| `vetverifications` / `vetapplications` | Credential verification and onboarding workflow |
| `billings` / `productservices` / `paymentqrs` | Invoices, billable catalog, QR payments |
| `confinementrecords` / `confinementmonitoringentries` | Hospitalization records and daily notes |
| `vetreports` | AI-generated report data |
| `referrals` / `ownershiptransfers` / `vetinvitations` | Transfer and invitation workflows |
| `notifications` | User notification queue |
| `audittrails` / `guestauditlogs` | Activity logs (authenticated and public/guest actions) |
| `petnotes` | Clinical notes per pet |
| `pettagrequests` / `nfccommands` | NFC tag request queue and write command queue |
| `resignations` | Vet resignation records |
| `assignedvets` | Vet-to-patient assignment tracking |
| `petlocationlogs` | Pet tag scan location history |
| `uploads.files` / `uploads.chunks` | GridFS file storage |

## 6.3 File Storage (GridFS)

Uploaded files (medical images, PDFs, pet photos) are streamed into GridFS via Multer. Files are served back through `GET /api/upload/:filename` with authentication.

## 6.4 Seeding

```bash
cd backend
npx ts-node scripts/seedClinic.ts                   # initial clinic
npx ts-node scripts/seedPreventiveCareServices.ts   # preventive care catalog
npx ts-node scripts/seedPendingNFCRequests.ts       # demo NFC requests (optional)
```

The `mongo-seed/` directory also contains full JSON exports per collection for restoring a demo dataset (importable with `mongoimport`).

---

# 7. API Reference

Base URL: `http://<backend-host>:5000/api`

**Authentication**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login with email/password |
| GET | `/auth/me` | Yes | Get current user profile |
| POST | `/auth/logout` | Yes | Logout and clear cookie |
| POST | `/auth/google` | No | Google OAuth login |
| POST | `/auth/forgot-password` | No | Request OTP for password reset |
| POST | `/auth/verify-otp` | No | Verify OTP |
| POST | `/auth/reset-password` | No | Reset password with verified OTP |
| GET | `/auth/verify-email` | No | Verify email via link |
| POST | `/auth/activate-invitation` | No | Claim an invited account |

**Pets**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/pets` | Pet Owner | Create a pet |
| GET | `/pets` | Yes | List current user's pets |
| GET | `/pets/:petId` | Yes | Get pet details |
| PUT | `/pets/:petId` | Pet Owner | Update pet profile |
| POST | `/pets/:petId/scan-alert` | No (public) | Fire scan alert to owner on public profile view |

**NFC**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/nfc/status` | Yes | Check NFC service status |
| GET | `/nfc/readers` | Yes | List connected NFC readers |
| GET | `/nfc/pet/:petId/for-writing` | Yes | Get pet data for NFC write |
| GET | `/nfc/pet/:petId/status` | Yes | Check if pet has an NFC tag |
| POST | `/nfc/pet/:petId/write` | Yes | Initiate NFC write |
| POST | `/nfc/pet/:petId/record-writing` | Yes | Record completed NFC write |
| GET | `/nfc/by-tag-id/:nfcTagId` | Yes | Look up pet by NFC tag ID |
| POST | `/nfc/pet/:petId/request-tag` | Pet Owner | Request an NFC tag |
| GET | `/nfc/clinic/pending-requests` | Clinic Admin | View pending tag requests |
| POST | `/nfc/events` | Agent (NFC_SECRET) | Agent posts NFC events |
| GET | `/nfc/commands/pending` | Agent (NFC_SECRET) | Agent polls for write commands |
| POST | `/nfc/commands/:id/result` | Agent (NFC_SECRET) | Agent posts write result |

**Medical Records / Vaccinations / Appointments / Billing / Clinics / Schedules / Notifications / Uploads**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/medical-records` | Vet | Create medical record |
| GET/PUT | `/medical-records/:id` | Yes / Vet | Get / update medical record |
| GET | `/medical-records/pet/:petId` | Yes | All records for a pet |
| POST | `/vaccinations` | Vet | Record a vaccination |
| GET | `/vaccinations/pet/:petId` | Yes | Pet's vaccination history |
| GET | `/vaccine-types` | Yes | List vaccine types |
| POST | `/appointments` | Pet Owner | Book an appointment |
| GET/PUT/DELETE | `/appointments/:id` | role-aware | Manage appointment |
| POST | `/billings` | Vet / Admin | Create billing record |
| PUT | `/billings/:id` | Admin | Update billing |
| POST | `/billings/:id/reject` | Admin | Reject billing |
| POST | `/clinics` / `/clinics/:id/branches` | Admin | Create clinic / branch |
| POST | `/vet-schedule` | Vet | Set availability |
| GET | `/notifications` | Yes | Current user's notifications |
| POST | `/upload` / GET `/upload/:filename` | Yes | GridFS upload / retrieval |

*(For the exhaustive route list, see `backend/src/routes/`.)*

---

# 8. Third-Party Services

| Service | Purpose | Required? | Where to Get |
|---|---|---|---|
| MongoDB / Atlas | Primary database | Required | mongodb.com |
| Resend | Transactional email (30+ templates) | Required | resend.com |
| OpenAI | AI-generated veterinary reports | Recommended | platform.openai.com |
| Google OAuth | Social login | Recommended | console.cloud.google.com |
| Leaflet, qrcode.react, html5-qrcode | Maps, QR generation/scanning | No key needed | npm |

---

# 9. Security

- JWT tokens stored in **httpOnly cookies** (not localStorage) to prevent XSS token theft
- Passwords hashed with **bcryptjs**; never stored in plaintext
- Login rate limiting: 3 attempts → 15-minute lockout
- All protected routes require a valid JWT via `authMiddleware`; role guards prevent cross-role access
- Frontend middleware enforces role-based routing as a second layer
- Local NFC agent authenticates with a shared `NFC_SECRET` header
- CORS restricted to trusted origins (`FRONTEND_URL`)
- Helmet.js applies secure HTTP headers
- Email domain validation via MX record lookup on registration
- Public pet profiles expose only owner-approved fields; guest actions are logged in `guestauditlogs`

---

# 10. Deployment Architecture

Recommended production topology:

| Tier | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-detects Next.js; deploys `frontend/` on push |
| Backend | Render (Web Service) or any Node host | `npm run build` → `node dist/server.js`; set `NODE_ENV=production` |
| Database | MongoDB Atlas | Point `MONGODB_URI` at the Atlas cluster |
| NFC Agent | On-premises clinic PC | Runs under PM2; `BACKEND_URL` points at the deployed backend |

The agent-to-cloud design means clinics need only a normal outbound internet connection; no inbound ports or VPN are required at the clinic.

---

# 11. Testing

```bash
cd backend
npm test
```

- **Framework:** Jest with ts-jest · **API testing:** supertest
- **In-memory DB:** mongodb-memory-server (no real database needed)
- **Timeout:** 30 s (allows in-memory MongoDB startup)
- **Location:** `backend/src/__tests__/`

---

# 12. Troubleshooting

| Issue | Likely Cause | Resolution |
|---|---|---|
| Backend fails to start: MongoDB connection error | MongoDB not running or wrong `MONGODB_URI` | Start MongoDB (`brew services start mongodb-community` / `systemctl start mongod`) or fix the URI |
| Login always fails with valid credentials | Account locked after 3 failed attempts | Wait 15 minutes, or reset the password via OTP |
| No verification / reminder emails | Missing or invalid `RESEND_API_KEY` | Set a valid Resend key in `backend/.env` |
| NFC reader not detected in the browser | Local agent not running, or reader driver missing | Start the agent (`npm run dev` or PM2); verify PC/SC drivers; check agent logs |
| NFC events not reaching the browser | `NFC_SECRET` mismatch between agent and backend, or wrong `BACKEND_URL` | Align both `.env` values; confirm the backend URL is reachable from the clinic PC |
| Tag write never completes | Agent not polling / command stuck in queue | Check agent logs; verify `POLL_INTERVAL_MS`; re-issue the write |
| AI report generation fails | Missing or invalid `OPENAI_API_KEY` | Set a valid OpenAI key in `backend/.env` |
| Google sign-in fails | Wrong `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, or origin not whitelisted in Google Console | Fix credentials; add the frontend origin to authorized JavaScript origins |
| Uploaded files return 404 | GridFS bucket empty or filename mismatch | Confirm the upload succeeded; check `uploads.files` collection |
| CORS errors in the browser console | `FRONTEND_URL` does not match the actual frontend origin | Set `FRONTEND_URL` in `backend/.env` to the exact origin (scheme + host + port) |
