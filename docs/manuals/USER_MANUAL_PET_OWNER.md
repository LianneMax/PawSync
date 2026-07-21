# DE LA SALLE UNIVERSITY
### Manila

---

# PawSync
### A Web-Based NFC and QR-Enabled Centralized Pet Medical Record System

# USER MANUAL — PET OWNER

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | July 2026 |
| **Prepared for** | Partner Veterinary Clinics and Pet Owners |
| **Prepared By** | Balbastro, *[add other team members]* |

---

## Table of Contents

- Chapter 1 Introduction
  - 1.1 Purpose of Manual
  - 1.2 System Overview
- Chapter 2 Getting Started
  - 2.1 System Access
    - 2.1.1 User Roles and Permissions
    - 2.1.2 Creating an Account
    - 2.1.3 Verifying Your Email
    - 2.1.4 Logging into the System
    - 2.1.5 First-Time Setup (Pet Onboarding)
  - 2.2 System Organization and Navigation
  - 2.3 Recovering a Forgotten Password
  - 2.4 Logging Out of the System
- Chapter 3 Using the System
  - 3.1 Pet Owner Dashboard
  - 3.2 My Pets Page
    - 3.2.1 Adding a New Pet
    - 3.2.2 Viewing and Editing a Pet Profile
    - 3.2.3 Pet QR Code
    - 3.2.4 Requesting and Linking an NFC Tag
    - 3.2.5 Marking a Pet as Lost
  - 3.3 Appointments Page
    - 3.3.1 Booking an Appointment
    - 3.3.2 Viewing and Cancelling Appointments
  - 3.4 Medical Records
  - 3.5 Vaccine Cards Page
  - 3.6 Vaccine Schedule Page
  - 3.7 Billing Page
  - 3.8 Pet Ownership Transfer
  - 3.9 Settings Page
- Chapter 4 Support Team Contact Information

---

# Chapter 1 Introduction

## 1.1 Purpose of Manual

Welcome to the Pet Owner User Manual for **PawSync**, a web-based NFC and QR-enabled centralized pet medical record system designed to keep your pets' complete health history in one place, accessible at any partner veterinary clinic.

This manual provides step-by-step instructions for pet owners on how to effectively use the PawSync system. It explains how to create an account, register your pets, book appointments, view medical records and vaccination history, request NFC tags, and manage your account settings.

Whether you are a new user or seeking guidance on specific system functions, this manual aims to help you efficiently manage your pets' health records within PawSync.

## 1.2 System Overview

PawSync is a full-stack veterinary management platform that digitizes pet health records using NFC tags and QR codes. It connects pet owners, veterinarians, and clinic administrators through a unified system.

For pet owners, the system provides:

- **Centralized pet profiles** — Register your pets with their name, species, breed, photos, and other details
- **NFC-tagged pet identification** — Request a physical NFC tag; any clinic can tap it to instantly pull up your pet's complete medical history
- **QR code identification** — Every pet has a scannable QR code as an alternative to NFC
- **Complete medical history** — View all medical records created by veterinarians across clinics
- **Vaccination tracking** — Digital vaccine cards, dose sequencing, and booster reminders
- **Online appointment booking** — Book, view, and cancel appointments with email reminders
- **Lost pet protection** — Mark a pet as lost; anyone who scans its tag sees a lost-pet alert and can share their location with you
- **Ownership transfer** — Transfer a pet's records to another owner through a referral and invitation system

---

# Chapter 2 Getting Started

## 2.1 System Access

Pet owners can access PawSync through a supported web browser (Google Chrome, Microsoft Edge, Firefox, or Safari). Unlike clinic staff accounts, pet owner accounts are self-registered — you create your own account directly from the sign-up page.

### 2.1.1 User Roles and Permissions

PawSync implements role-based access control to ensure that users only access features relevant to their role. For pet owners, the system allows access to the following modules:

- Pet Owner Dashboard
- My Pets (pet profiles, QR codes, NFC tags)
- Appointments
- Medical Records
- Vaccine Cards and Vaccine Schedule
- Billing
- Account Settings

Pet owners cannot access veterinarian or clinic administrator modules. If access issues occur, contact the support team listed in Chapter 4.

### 2.1.2 Creating an Account

To create a pet owner account, follow these steps:

1. Open the PawSync sign-up page (`/signup`) in your web browser.
2. Enter your first name, last name, email address, and password.
3. Alternatively, click **Sign up with Google** to register using your Google account.
4. Click the **Sign Up** button.
5. The system will send a verification link to your email address.

*Figure 2.1 PawSync Sign-Up Page*

### 2.1.3 Verifying Your Email

Before you can fully use the system, you must verify your email address:

1. Open the verification email sent by PawSync.
2. Click the verification link in the email.
3. You will be redirected to the verification confirmation page.

If you did not receive the email, check your spam folder or request a new verification link from the login page.

*Figure 2.2 Email Verification Page*

### 2.1.4 Logging into the System

To log into the PawSync system, follow these steps:

1. Open the PawSync login page (`/login`) through a web browser.
2. Enter your registered email address and password, or click **Continue with Google**.
3. Optionally tick **Remember me** to stay signed in on your device.
4. Click the **Login** button.
5. Upon successful authentication, you will be redirected to the Pet Owner Dashboard.

If incorrect login credentials are entered, the system will display an error message. **Note:** after 3 failed login attempts, your account is temporarily locked for 15 minutes as a security measure.

*Figure 2.3 PawSync Login Page*

### 2.1.5 First-Time Setup (Pet Onboarding)

When logging in for the first time, new pet owners are guided through the pet onboarding flow (`/onboarding/pet`), where you register your first pet by providing its name, species, breed, sex, birth date, and photo. You may add more pets later from the My Pets page.

*Figure 2.4 Pet Onboarding Page*

## 2.2 System Organization and Navigation

After logging in, pet owners are directed to the Dashboard, which serves as the main interface. The system uses a sidebar navigation panel that allows users to access the following sections:

- Dashboard
- My Pets
- Appointments
- Medical Records
- Vaccine Cards
- Vaccine Schedule
- Billing
- Settings
- Log out

## 2.3 Recovering a Forgotten Password

If you forget your password:

1. On the login page, click **Forgot Password**.
2. Enter your registered email address. The system sends a One-Time Password (OTP) to your email.
3. Enter the OTP on the verification screen.
4. Once the OTP is verified, enter and confirm your new password.

*Figure 2.5 Password Reset Flow*

## 2.4 Logging Out of the System

To securely log out of the system:

1. Locate the **Logout** button in the sidebar navigation panel.
2. Click the **Logout** button.
3. The system will redirect you to the login page.

Users are encouraged to log out after each session, especially on shared devices, to maintain account security.

---

# Chapter 3 Using the System

## 3.1 Pet Owner Dashboard

Upon successful login, pet owners are automatically directed to the Dashboard (`/dashboard`). This page provides a consolidated overview of your pets and their health status, including:

- **My Pets summary** — Quick cards for each registered pet
- **Upcoming appointments** — Your next scheduled clinic visits
- **Upcoming vaccinations** — Boosters and doses that are due soon
- **Recent medical records** — The latest records created for your pets
- **Notifications** — Appointment reminders, vaccination reminders, NFC tag request updates, and scan alerts

*Figure 3.1 Pet Owner Dashboard Interface*

## 3.2 My Pets Page

The My Pets page (`/my-pets`) lists all pets registered under your account. From here you can add new pets, open individual pet profiles, and manage each pet's QR code and NFC tag.

*Figure 3.2 My Pets Page Interface*

### 3.2.1 Adding a New Pet

1. On the My Pets page, click the **Add Pet** button.
2. Fill in the pet's details: name, species, breed, sex, birth date, color/markings, and an optional photo.
3. Click **Save**. The new pet appears in your pet list with an automatically generated QR code.

*Figure 3.3 Add Pet Form*

### 3.2.2 Viewing and Editing a Pet Profile

Click a pet card to open its profile page (`/my-pets/[id]`). The profile displays:

- Basic information (species, breed, sex, age, weight)
- Medical history summary
- Vaccination records
- Scan location history (where the pet's tag has been scanned, shown on a map)

To edit the profile, click the **Edit** button, update the fields, and save your changes.

*Figure 3.4 Pet Profile Page*

### 3.2.3 Pet QR Code

Every pet has a unique QR code that links to its public pet profile. Clinics can scan this code at reception to pull up the pet's records. You can display the QR code from the pet profile and download or print it (for example, to attach to a collar).

*Figure 3.5 Pet QR Code Display*

### 3.2.4 Requesting and Linking an NFC Tag

Pet owners can request a physical NFC tag for a pet. Once issued by a clinic, the tag can be tapped at any partner clinic to identify the pet instantly.

To request a tag:

1. Open the pet's NFC page (`/my-pets/[id]/nfc`).
2. Click **Request NFC Tag** and select the clinic that will issue the tag.
3. The request is sent to the clinic administrator. You will receive a notification when it is approved.
4. Visit the clinic to have the tag physically written and linked to your pet.

The NFC page also shows the pet's current tag status (linked or not linked).

*Figure 3.6 NFC Tag Request Page*

### 3.2.5 Marking a Pet as Lost

If your pet goes missing:

1. Open the pet's profile and click **Mark as Lost**.
2. Confirm the action. The pet's public profile is updated with a lost-pet alert.
3. Anyone who scans the pet's NFC tag or QR code will see the lost-pet alert and can share their current location with you.
4. You will receive a notification whenever the tag is scanned, and shared locations appear on the pet's scan-location map.
5. When your pet is found, click **Mark as Found** to remove the alert.

*Figure 3.7 Lost Pet Alert and Scan Location Map*

## 3.3 Appointments Page

The Appointments module (`/my-appointments`) allows pet owners to book and manage clinic visits.

### 3.3.1 Booking an Appointment

1. On the Appointments page, click **Book Appointment**.
2. Select the pet, the clinic and branch, the service or reason for the visit, and a preferred veterinarian (if applicable).
3. Choose an available date and time slot. Slots reflect each veterinarian's published schedule and approved leaves.
4. Confirm the booking. The system sends a confirmation email, and a reminder email before the appointment.

*Figure 3.8 Appointment Booking Form*

### 3.3.2 Viewing and Cancelling Appointments

The Appointments page lists your upcoming and past appointments with their status (pending, confirmed, completed, or cancelled). To cancel a booking, open the appointment and click **Cancel Appointment**.

*Figure 3.9 Appointments List*

## 3.4 Medical Records

Pet owners can view (but not edit) all medical records created for their pets:

- **Medical Records page** (`/dashboard/medical-records`) — Lists all records across your pets. Click a record to view its full details, including diagnosis, treatment, prescriptions, attached files, and the veterinarian and clinic that created it.
- **Patient Records viewer** (`/patient-records`) — A consolidated per-pet view of the complete medical history.

*Figure 3.10 Medical Records Viewer*

## 3.5 Vaccine Cards Page

The Vaccine Cards page (`/vaccine-cards`) displays a digital vaccination certificate for each of your pets, equivalent to a physical vaccine booklet. Each card shows the vaccines administered, dose numbers, dates, administering veterinarian, and clinic.

An individual pet's card can also be opened from its profile (`/my-pets/[id]/vaccine-card`) and printed or saved for travel and boarding requirements.

*Figure 3.11 Digital Vaccine Card*

## 3.6 Vaccine Schedule Page

The Vaccine Schedule page (`/vaccine-schedule`) shows a timeline of upcoming vaccinations for all your pets, including due boosters and next doses in multi-dose series. The system automatically computes due dates based on each vaccine type's series rules and your pet's age, and sends email reminders when doses are approaching.

*Figure 3.12 Vaccine Schedule Timeline*

## 3.7 Billing Page

The Billing page (`/billing`) lists invoices issued by clinics for services rendered to your pets. Each billing record shows the itemized products and services, quantities, prices, total amount, and payment status. Clinics may provide a payment QR code for cashless settlement.

*Figure 3.13 Billing Page*

## 3.8 Pet Ownership Transfer

PawSync allows a pet's records to be transferred to another owner (for example, after adoption or rehoming):

1. The current owner initiates a referral/transfer from the pet's profile, entering the new owner's email address.
2. The new owner receives an email invitation with a link to the Join page (`/join`).
3. If the new owner does not yet have a PawSync account, they can claim an invited account via the invitation link (`/invite/accept`).
4. Once accepted, the pet and its complete medical history are transferred to the new owner's account.

*Figure 3.14 Ownership Transfer Flow*

## 3.9 Settings Page

The Settings page (`/settings`) allows pet owners to manage their account:

- **Personal Information** — Update your name, contact number, and profile details
- **Password** — Change your account password (enter the current password, then the new password)
- **Notifications** — Review notification preferences

*Figure 3.15 Settings Page*

---

# Chapter 4 Support Team Contact Information

For inquiries, assistance requests, comments, suggestions, or feature requests related to PawSync, please contact our dedicated support team. We are committed to ensuring a seamless experience, and your feedback is essential to enhancing the system.

Feel free to contact any of our team members via email:

**Lianne Balbastro**
lianne_balbastro@dlsu.edu.ph

*[Add other team members and their email addresses]*
