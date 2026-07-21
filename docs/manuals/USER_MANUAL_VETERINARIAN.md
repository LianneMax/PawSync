# DE LA SALLE UNIVERSITY
### Manila

---

# PawSync
### A Web-Based NFC and QR-Enabled Centralized Pet Medical Record System

# USER MANUAL — VETERINARIAN

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | July 2026 |
| **Prepared for** | Partner Veterinary Clinics |
| **Prepared By** | Balbastro, *[add other team members]* |

---

## Table of Contents

- Chapter 1 Introduction
  - 1.1 Purpose of Manual
  - 1.2 System Overview
- Chapter 2 Getting Started
  - 2.1 System Access
    - 2.1.1 User Roles and Permissions
    - 2.1.2 Veterinarian Onboarding and Verification
    - 2.1.3 Logging into the System
  - 2.2 System Organization and Navigation
  - 2.3 Logging Out of the System
- Chapter 3 Using the System
  - 3.1 Veterinarian Dashboard
  - 3.2 Appointments Page
  - 3.3 Patient Records
  - 3.4 Medical Records
    - 3.4.1 Creating a Medical Record
    - 3.4.2 Editing a Medical Record
    - 3.4.3 Clinical Notes
  - 3.5 Vaccinations Page
    - 3.5.1 Recording a Vaccination
    - 3.5.2 Vaccine Schedule for Patients
  - 3.6 Confinement Monitoring
  - 3.7 AI-Generated Veterinary Reports
    - 3.7.1 Generating a New Report
    - 3.7.2 Reviewing and Managing Reports
  - 3.8 Schedule and Availability
  - 3.9 Leave Requests
  - 3.10 Resignation
  - 3.11 Settings Page
- Chapter 4 Support Team Contact Information

---

# Chapter 1 Introduction

## 1.1 Purpose of Manual

Welcome to the Veterinarian User Manual for **PawSync**, a web-based NFC and QR-enabled centralized pet medical record system designed to give veterinarians instant access to a patient's complete medical history, regardless of which clinic previously treated the pet.

This manual provides step-by-step instructions for veterinarians on how to effectively use the PawSync system. It explains how to complete onboarding and credential verification, manage appointments, create medical records and vaccinations, monitor confined patients, generate AI-assisted veterinary reports, and manage your availability.

## 1.2 System Overview

PawSync is a full-stack veterinary management platform that digitizes pet health records using NFC tags and QR codes. For veterinarians, the system provides:

- **Instant patient identification** — NFC tap or QR scan pulls up the pet's full profile and history
- **Medical record management** — Create and edit complete medical records with diagnosis, treatment, prescriptions, and file attachments
- **Vaccination recording** — Dose sequencing, booster scheduling, and age-based vaccine validation
- **Appointment management** — View and manage bookings assigned to you
- **Confinement monitoring** — Daily monitoring entries for hospitalized or boarded patients
- **AI-generated reports** — OpenAI-powered professional report generation from clinical notes (e.g., discharge and confinement reports)
- **Schedule management** — Publish your availability and file leave requests

---

# Chapter 2 Getting Started

## 2.1 System Access

Veterinarians access PawSync through a supported web browser via the clinic staff login page. A veterinarian account must be verified before full access is granted.

### 2.1.1 User Roles and Permissions

PawSync implements role-based access control. For veterinarians, the system allows access to the following modules:

- Veterinarian Dashboard
- Appointments
- Patient Records and Medical Records
- Vaccinations and Vaccine Schedule
- Confinement Monitoring
- AI Report Generation
- Schedule and Leave Management
- Profile Settings

Veterinarians cannot access clinic administration modules (billing approval, product catalog management, vet verification, clinic management). If access issues occur, contact your clinic administrator.

### 2.1.2 Veterinarian Onboarding and Verification

New veterinarians must complete an onboarding and credential verification process before practicing within the system:

1. Register an account, or accept an invitation sent by a clinic administrator.
2. Complete the veterinarian onboarding form (`/onboarding/vet`), providing your professional details and license credentials.
3. Submit the application. Your status will show as **Verification Pending** (`/onboarding/vet/verification-pending`) while the clinic administrator reviews your credentials.
4. Once approved, you are redirected to the **Verification Success** page and gain full access to the veterinarian modules.
5. If the application is rejected, the **Verification Failed** page explains the reason, and you may re-apply with corrected information.

*Figure 2.1 Veterinarian Onboarding Form*

*Figure 2.2 Verification Pending Page*

### 2.1.3 Logging into the System

1. Open the PawSync clinic login page (`/clinic-login`) through a web browser.
2. Enter your registered email address and password.
3. Click the **Login** button.
4. Upon successful authentication, you will be redirected to the Veterinarian Dashboard.

**Note:** after 3 failed login attempts, the account is temporarily locked for 15 minutes.

*Figure 2.3 Clinic Staff Login Page*

## 2.2 System Organization and Navigation

After logging in, veterinarians are directed to the Veterinarian Dashboard. The sidebar navigation panel provides access to the following sections:

- Dashboard
- Appointments
- Patient Records
- Medical Records
- Vaccinations
- Reports
- Vaccine Schedule
- Settings
- Log out

## 2.3 Logging Out of the System

1. Locate the **Logout** button in the sidebar navigation panel.
2. Click the **Logout** button.
3. The system will redirect you to the login page.

---

# Chapter 3 Using the System

## 3.1 Veterinarian Dashboard

Upon login, veterinarians are directed to the Veterinarian Dashboard (`/vet-dashboard`), which provides an overview of the day's work:

- **Today's appointments** — Bookings assigned to you for the current day
- **Recent patients** — Pets you have recently treated
- **Pending tasks** — Records awaiting completion, upcoming vaccinations for your patients
- **Notifications** — New bookings, cancellations, leave request updates

*Figure 3.1 Veterinarian Dashboard Interface*

## 3.2 Appointments Page

The Appointments module (`/vet-dashboard/appointments` and `/vet-appointments`) lists all appointments assigned to you, including online bookings made by pet owners and walk-ins registered by the clinic.

From this page you can:

- View appointment details (pet, owner, service, date and time)
- Confirm or update the status of an appointment
- Open the pet's profile and medical history directly from the booking
- Proceed to create a medical record for a completed consultation

Surgery appointments are booked through a dedicated surgery appointment form that captures the procedure details.

*Figure 3.2 Veterinarian Appointments Page*

## 3.3 Patient Records

The Patient Records viewer (`/patient-records`) provides a consolidated view of a pet's complete medical history across all clinics — previous diagnoses, treatments, vaccinations, and attachments. When a pet arrives, its record can be pulled up by NFC tap or QR scan at reception, or searched manually.

*Figure 3.3 Patient Records Viewer*

## 3.4 Medical Records

### 3.4.1 Creating a Medical Record

Medical records are created through a staged, multi-step form that guides you through the complete consultation:

1. From an appointment or a patient profile, click **Create Medical Record**.
2. Complete the staged form sections: presenting complaint, examination findings, diagnosis, treatment plan, prescriptions, and procedures performed.
3. Attach supporting files if needed (lab results, X-ray images, documents).
4. Review and submit. The record is saved to the pet's permanent history and becomes visible to the owner.

A billing record can be generated directly from a completed medical record, pre-filled with the services rendered (the clinic administrator reviews and approves billing).

*Figure 3.4 Staged Medical Record Form*

### 3.4.2 Editing a Medical Record

Veterinarians may open an existing record they created and update its contents. All changes are tracked in the system's audit trail.

### 3.4.3 Clinical Notes

In addition to formal medical records, veterinarians can attach free-form clinical notes to a pet. Notes are visible to authorized clinic staff and are useful for observations that do not warrant a full record.

*Figure 3.5 Clinical Notes Panel*

## 3.5 Vaccinations Page

### 3.5.1 Recording a Vaccination

1. Open the Vaccinations page (`/vet-dashboard/vaccinations`) and click **New Vaccination** (`/vet-dashboard/vaccinations/new`).
2. Select the patient and the vaccine type.
3. The system validates the dose against the vaccine type's rules — minimum age, dose sequence within a series, and interval since the previous dose. Invalid doses (e.g., a vaccine given below the minimum age) are flagged.
4. Enter the dose details (batch/lot, date administered) and save.
5. The system automatically computes the next due dose or booster and schedules owner reminders.

*Figure 3.6 New Vaccination Form*

### 3.5.2 Vaccine Schedule for Patients

The Vaccine Schedule page (`/vet-vaccine-schedule`) shows upcoming and overdue doses for your patients, helping you plan boosters and follow-up visits.

*Figure 3.7 Patient Vaccine Schedule*

## 3.6 Confinement Monitoring

For hospitalized or boarded patients, PawSync maintains confinement records with daily monitoring entries:

1. Open the confined patient's record and go to the **Confinement Monitoring** panel.
2. Add monitoring entries for each observation: vitals, feeding, medications administered, and remarks.
3. Entries accumulate into a complete confinement log that can later be summarized in a confinement or discharge report.

*Figure 3.8 Confinement Monitoring Panel*

## 3.7 AI-Generated Veterinary Reports

PawSync integrates with OpenAI to generate professional veterinary reports from your clinical data, saving documentation time while keeping you in control of the final content.

### 3.7.1 Generating a New Report

1. Open the Reports page (`/vet-dashboard/reports`) and click **New Report** (`/vet-dashboard/reports/new`).
2. Select the patient and the report type (e.g., discharge report, confinement report).
3. The system gathers the relevant clinical data — medical records, monitoring entries, and medications — and generates a drafted professional report.
4. Review the generated draft. **The veterinarian is always responsible for verifying the accuracy of the report before finalizing it.**
5. Edit as needed and save. Finalized reports can be shared with the pet owner via a report link.

*Figure 3.9 AI Report Generation Page*

### 3.7.2 Reviewing and Managing Reports

The Reports page lists all reports you have generated. Click a report (`/vet-dashboard/reports/[id]`) to view, edit, or share it.

*Figure 3.10 Report List and Detail View*

## 3.8 Schedule and Availability

Veterinarians publish their availability so pet owners can only book time slots when they are on duty:

1. Open your schedule settings.
2. Define your working days and hours per clinic branch.
3. Save the schedule. Online booking slots update automatically.

*Figure 3.11 Vet Schedule Management*

## 3.9 Leave Requests

To file a leave:

1. Open the leave request form from your schedule or settings page.
2. Select the leave dates and provide a reason.
3. Submit the request for clinic administrator approval.
4. Approved leaves automatically block your booking slots for those dates.

*Figure 3.12 Leave Request Form*

## 3.10 Resignation

A veterinarian may file a resignation from a clinic through the system. The request is routed to the clinic administrator for processing. Once processed, your association with the clinic ends, while historical records you created remain intact for continuity of care.

## 3.11 Settings Page

The Vet Settings page (`/vet-settings`) allows you to manage your account:

- **Personal Information** — Update your name, contact number, and professional profile
- **Credentials** — View your verified license details
- **Password** — Change your account password

*Figure 3.13 Vet Settings Page*

---

# Chapter 4 Support Team Contact Information

For inquiries, assistance requests, comments, suggestions, or feature requests related to PawSync, please contact our dedicated support team.

**Lianne Balbastro**
lianne_balbastro@dlsu.edu.ph

*[Add other team members and their email addresses]*
