# DE LA SALLE UNIVERSITY
### Manila

---

# PawSync
### A Web-Based NFC and QR-Enabled Centralized Pet Medical Record System

# USER MANUAL — CLINIC ADMINISTRATOR

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
    - 2.1.2 Logging into the System
  - 2.2 System Organization and Navigation
  - 2.3 Logging Out of the System
- Chapter 3 Using the System
  - 3.1 Clinic Admin Dashboard
  - 3.2 Patient Scanning Page (NFC / QR)
  - 3.3 NFC Tag Management Page
    - 3.3.1 Pending Tag Requests
    - 3.3.2 Writing an NFC Tag
  - 3.4 Clients Page
  - 3.5 Appointments Page
  - 3.6 Medical Records Page
  - 3.7 Vaccinations
    - 3.7.1 Recording Vaccinations
    - 3.7.2 Vaccine Types Catalog
    - 3.7.3 Clinic Vaccine Schedule
  - 3.8 Veterinarian Management
    - 3.8.1 Vet Verification Queue
    - 3.8.2 Inviting Veterinarians
    - 3.8.3 Leaves and Resignations
  - 3.9 Billing Page
  - 3.10 Products and Services Catalog
  - 3.11 Clinic Management Page
  - 3.12 Reports
- Chapter 4 Support Team Contact Information

---

# Chapter 1 Introduction

## 1.1 Purpose of Manual

Welcome to the Clinic Administrator User Manual for **PawSync**, a web-based NFC and QR-enabled centralized pet medical record system.

This manual provides step-by-step instructions for clinic administrators on how to effectively use the PawSync system. It explains how to manage the clinic profile and branches, scan patients at reception using NFC or QR, process veterinarian applications and verifications, oversee billing and the product/service catalog, and manage NFC tag requests.

## 1.2 System Overview

PawSync is a full-stack veterinary management platform that digitizes pet health records using NFC tags and QR codes. For clinic administrators, the system provides:

- **Patient scanning at reception** — Tap an NFC tag or scan a QR code to instantly pull up a patient's records
- **Clinic and branch management** — Maintain the clinic profile and its branch locations
- **Veterinarian lifecycle management** — Process applications, verify credentials, approve leaves, and handle resignations
- **Billing oversight** — Review, approve, or reject billing records tied to medical records; manage QR-based payments
- **Product and service catalog** — Maintain the billable items offered by the clinic
- **NFC tag operations** — Approve pet owners' tag requests and write tags using the clinic's NFC reader
- **Clinic-wide visibility** — Appointments, medical records, vaccinations, and vaccine schedules across the clinic

---

# Chapter 2 Getting Started

## 2.1 System Access

Clinic administrators access PawSync through a supported web browser via the clinic staff login page. The main branch administrator holds additional privileges over branch-level administrators (e.g., branch creation and clinic-wide actions).

### 2.1.1 User Roles and Permissions

PawSync implements role-based access control. For clinic administrators, the system allows access to the following modules:

- Clinic Admin Dashboard
- Patient Scanning (NFC / QR)
- NFC Tag Management
- Clients Directory
- Appointments (clinic-wide)
- Medical Records (clinic-wide)
- Vaccinations, Vaccine Types, and Vaccine Schedule
- Veterinarian Verification and Management
- Billing and Payments
- Products and Services Catalog
- Clinic Management (profile, branches)
- Reports

Certain actions — such as creating branches or closing the clinic — are restricted to the **main branch** administrator.

### 2.1.2 Logging into the System

1. Open the PawSync clinic login page (`/clinic-login`) through a web browser.
2. Enter your registered email address and password.
3. Click the **Login** button.
4. Upon successful authentication, you will be redirected to the Clinic Admin Dashboard.

**Note:** after 3 failed login attempts, the account is temporarily locked for 15 minutes.

*Figure 2.1 Clinic Staff Login Page*

## 2.2 System Organization and Navigation

After logging in, clinic administrators are directed to the Clinic Admin Dashboard. The sidebar navigation panel provides access to the following sections:

- Dashboard
- Patients (Scanning)
- NFC Management
- Clients
- Appointments
- Medical Records
- Vaccinations
- Vaccine Types
- Vaccine Schedule
- Verification
- Billing
- Products & Services
- Clinic Management
- Log out

## 2.3 Logging Out of the System

1. Locate the **Logout** button in the sidebar navigation panel.
2. Click the **Logout** button.
3. The system will redirect you to the login page.

---

# Chapter 3 Using the System

## 3.1 Clinic Admin Dashboard

Upon login, clinic administrators are directed to the Dashboard (`/clinic-admin`), which provides an overview of clinic operations:

- **Today's appointments** — Clinic-wide bookings for the day
- **Pending items** — Vet applications awaiting verification, pending NFC tag requests, billing records awaiting approval
- **Recent activity** — Newly created medical records and vaccinations
- **Notifications** — System events requiring administrator attention

*Figure 3.1 Clinic Admin Dashboard Interface*

## 3.2 Patient Scanning Page (NFC / QR)

The Patients page (`/clinic-admin/patients`) is the reception desk's main tool for identifying incoming patients.

**Scanning with NFC:**

1. Ensure the clinic's NFC reader is connected and the local NFC agent is running (see the Technical Manual).
2. The page displays the reader's connection status in real time.
3. Tap the pet's NFC tag on the reader. The pet's profile and complete medical history load instantly.

**Scanning with QR:**

1. Click **Scan QR Code** to activate the device camera.
2. Point the camera at the pet's QR code. The pet's profile loads once the code is recognized.

From the loaded patient record, staff can view medical history, vaccinations, and proceed to appointments or new records.

*Figure 3.2 Patient Scanning Interface*

## 3.3 NFC Tag Management Page

The NFC page (`/clinic-admin/nfc`) manages the clinic's NFC tag operations.

### 3.3.1 Pending Tag Requests

Pet owners request NFC tags through their own accounts. Requests routed to your clinic appear in the pending requests list, where you can review and approve or reject each request. The owner is notified of the decision.

*Figure 3.3 Pending NFC Tag Requests*

### 3.3.2 Writing an NFC Tag

To physically write an approved tag:

1. Ensure the NFC reader is connected and the local NFC agent is running.
2. Select the pet whose tag will be written and click **Write Tag**.
3. Place a blank NFC tag on the reader when prompted. The system streams live status updates (reader connected, card detected, write complete) while the operation runs.
4. Once the write completes, the tag is linked to the pet, and subsequent taps at any partner clinic will identify the pet.

*Figure 3.4 NFC Tag Writing Workflow*

## 3.4 Clients Page

The Clients page (`/clinic-admin/clients`) is a directory of pet owners who have transacted with the clinic. Selecting a client (`/clinic-admin/clients/[ownerId]`) shows their contact details, registered pets, and visit history.

*Figure 3.5 Clients Directory*

## 3.5 Appointments Page

The Appointments page (`/clinic-admin/appointments`) provides clinic-wide appointment management:

- View all bookings across veterinarians and branches
- Register walk-in appointments on behalf of pet owners
- Update appointment statuses (confirm, complete, cancel)
- Filter by date, veterinarian, or status

*Figure 3.6 Clinic Appointments Page*

## 3.6 Medical Records Page

The Medical Records page (`/clinic-admin/medical-records`) lists all medical records created within the clinic. Administrators can open any record (`/clinic-admin/medical-records/[id]`) to review its details and generate billing from it. Administrators do not author clinical content — records are created by veterinarians.

*Figure 3.7 Clinic Medical Records Page*

## 3.7 Vaccinations

### 3.7.1 Recording Vaccinations

The Vaccinations page (`/clinic-admin/vaccinations`) lists vaccinations administered in the clinic. A new vaccination entry can be initiated from `/clinic-admin/vaccinations/new` in coordination with the attending veterinarian.

*Figure 3.8 Clinic Vaccinations Page*

### 3.7.2 Vaccine Types Catalog

The Vaccine Types page (`/clinic-admin/vaccine-types`) manages the vaccine definitions used by the system. Each vaccine type specifies its series rules — number of doses, minimum age, and dose intervals — which the system uses to validate administered doses and compute booster schedules.

*Figure 3.9 Vaccine Types Catalog*

### 3.7.3 Clinic Vaccine Schedule

The Vaccine Schedule page (`/clinic-admin/vaccine-schedule`) shows upcoming and overdue doses for patients of the clinic, supporting outreach and follow-up reminders.

*Figure 3.10 Clinic Vaccine Schedule*

## 3.8 Veterinarian Management

### 3.8.1 Vet Verification Queue

The Verification page (`/clinic-admin/verification`) lists veterinarian applications awaiting credential review:

1. Open an application to review the applicant's professional details and submitted license credentials.
2. Approve the application to grant the veterinarian full access, or reject it with a reason.
3. The applicant is notified and their onboarding status page updates accordingly.

*Figure 3.11 Vet Verification Queue*

### 3.8.2 Inviting Veterinarians

Administrators can invite veterinarians to join the clinic by email. The invitee receives a link to claim their account and complete onboarding.

### 3.8.3 Leaves and Resignations

- **Leave requests** — Review and approve or reject leave requests filed by veterinarians. Approved leaves automatically block the vet's booking slots.
- **Resignations** — Process resignation requests filed by veterinarians. Completed resignations end the vet's association with the clinic while preserving historical records.

*Figure 3.12 Leave and Resignation Management*

## 3.9 Billing Page

The Billing page (`/billing`) manages the clinic's invoices:

- **Review billing records** created from medical records, itemized by products and services rendered
- **Approve** a billing record to finalize it, or **reject** it with a reason for correction
- **Payment QR** — Attach or display a payment QR code for cashless settlement
- Track payment statuses across the clinic

*Figure 3.13 Billing Management Page*

## 3.10 Products and Services Catalog

The Products & Services page (`/product-man`) maintains the clinic's catalog of billable items:

1. Click **Add Item** to create a new product or service with its name, category, and price.
2. Edit or deactivate existing items as clinic offerings change.
3. Catalog items become selectable line items when billing records are created.

*Figure 3.14 Product and Service Catalog*

## 3.11 Clinic Management Page

The Clinic Management page (`/clinic-admin/clinic-management`) maintains the clinic's organizational profile:

- **Clinic profile** — Name, address, contact information, and operating details
- **Branches** — Create and manage branch locations (main branch administrators only)
- **Close clinic** — Deactivate the clinic (main branch administrators only). **Caution: this is a significant action; confirm carefully before proceeding.**

*Figure 3.15 Clinic Management Page*

## 3.12 Reports

Administrators can open shared veterinary reports via the report viewer (`/reports/[id]`), including AI-generated discharge and confinement reports produced by veterinarians.

*Figure 3.16 Report Viewer*

---

# Chapter 4 Support Team Contact Information

For inquiries, assistance requests, comments, suggestions, or feature requests related to PawSync, please contact our dedicated support team.

**Lianne Balbastro**
lianne_balbastro@dlsu.edu.ph

*[Add other team members and their email addresses]*
