-- ============================================================
-- PawSync Database Schema (SQL Mapping of MongoDB Collections)
-- ============================================================
-- This file maps out the MongoDB collections as relational tables
-- for documentation, ERD generation, and planning purposes.
-- MongoDB Collection → SQL Table
-- ============================================================


-- ============================================================
-- TABLE: users
-- MongoDB Collection: users
-- ============================================================
-- Stores all users: pet owners, veterinarians, clinic admins
--
-- INPUTS (Registration):
--   email, password, firstName, lastName, userType, clinicName (clinic-admin only)
--
-- OUTPUTS (API Response):
--   id, email, firstName, lastName, userType, isVerified, createdAt
--   (password, resetOtp, resetOtpExpires are NEVER returned)
-- ============================================================
CREATE TABLE users (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    email               VARCHAR(255)    NOT NULL UNIQUE,        -- Lowercase, validated format
    password            VARCHAR(255)    NOT NULL,               -- Bcrypt hashed, min 6 chars raw
    first_name          VARCHAR(255)    NOT NULL,
    last_name           VARCHAR(255)    NOT NULL,
    user_type           ENUM('pet-owner', 'veterinarian', 'clinic-admin')
                                        NOT NULL,
    is_verified         BOOLEAN         NOT NULL DEFAULT FALSE, -- PRC license verification for vets
    login_attempts      INT             NOT NULL DEFAULT 0,
    lock_until          DATETIME        DEFAULT NULL,           -- Account lockout timestamp
    reset_otp           VARCHAR(255)    DEFAULT NULL,           -- Password reset OTP (hidden from queries)
    reset_otp_expires   DATETIME        DEFAULT NULL,           -- OTP expiration (hidden from queries)
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email)
);


-- ============================================================
-- TABLE: clinics
-- MongoDB Collection: clinics
-- ============================================================
-- Stores veterinary clinic organizations.
-- Auto-created when a clinic-admin registers.
--
-- INPUTS (Auto-created on clinic-admin signup):
--   name (from clinicName), adminId, email
--
-- OUTPUTS (API Response):
--   All fields. Used in vet onboarding clinic selection,
--   clinic admin dashboard.
-- ============================================================
CREATE TABLE clinics (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    name                VARCHAR(255)    NOT NULL,               -- Clinic name
    admin_id            CHAR(24)        NOT NULL,               -- FK → users._id (clinic-admin)
    address             VARCHAR(500)    DEFAULT NULL,           -- Main address
    phone               VARCHAR(50)     DEFAULT NULL,
    email               VARCHAR(255)    DEFAULT NULL,           -- Lowercase
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_admin_id (admin_id),
    FOREIGN KEY (admin_id) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: clinic_branches
-- MongoDB Collection: clinicbranches
-- ============================================================
-- Stores individual branch locations for a clinic.
-- A default "Main Branch" is auto-created with the clinic.
--
-- INPUTS (Add/Edit Branch):
--   clinicId, name, address, city, province, phone, email,
--   openingTime, closingTime, operatingDays, isMain
--
-- OUTPUTS (API Response):
--   All fields. Used in clinic admin branch management,
--   vet onboarding branch selection.
-- ============================================================
CREATE TABLE clinic_branches (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    clinic_id           CHAR(24)        NOT NULL,               -- FK → clinics._id
    name                VARCHAR(255)    NOT NULL,               -- Branch name
    address             VARCHAR(500)    NOT NULL,               -- Street address
    city                VARCHAR(255)    DEFAULT NULL,
    province            VARCHAR(255)    DEFAULT NULL,
    phone               VARCHAR(50)     DEFAULT NULL,
    email               VARCHAR(255)    DEFAULT NULL,           -- Lowercase
    opening_time        VARCHAR(20)     DEFAULT NULL,           -- e.g. "08:00 AM"
    closing_time        VARCHAR(20)     DEFAULT NULL,           -- e.g. "08:00 PM"
    operating_days      VARCHAR(255)    DEFAULT '',             -- JSON array: ["Mon","Tue","Wed","Thu","Fri","Sat"]
    is_main             BOOLEAN         NOT NULL DEFAULT FALSE, -- Only one main per clinic
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_clinic_id (clinic_id),
    UNIQUE INDEX idx_clinic_main (clinic_id, is_main),          -- Only one main branch per clinic
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: pets
-- MongoDB Collection: pets
-- ============================================================
-- Stores all pet profiles belonging to pet owners.
-- BUSINESS RULE: A pet owner must register at least one pet during onboarding.
--
-- INPUTS (Pet Onboarding / Add Pet):
--   ownerId, name, species, breed, secondaryBreed (optional),
--   sex, dateOfBirth, weight, sterilization, notes (optional),
--   photo (optional)
--
-- OUTPUTS (API Response):
--   All fields. Used in dashboard pet cards, my-pets page,
--   vet patient lists, NFC tag lookups.
-- ============================================================
CREATE TABLE pets (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    owner_id            CHAR(24)        NOT NULL,               -- FK → users._id (pet-owner)
    name                VARCHAR(255)    NOT NULL,               -- Pet's full name
    species             ENUM('dog', 'cat')
                                        NOT NULL,
    breed               VARCHAR(255)    NOT NULL,               -- Primary breed
    secondary_breed     VARCHAR(255)    DEFAULT NULL,           -- Mixed breed (optional)
    sex                 ENUM('male', 'female')
                                        NOT NULL,
    date_of_birth       DATE            NOT NULL,               -- Approximate if unknown
    weight              DECIMAL(5,2)    NOT NULL,               -- Weight in kg
    sterilization       ENUM('yes', 'no', 'unknown')
                                        NOT NULL,
    microchip_number    VARCHAR(255)    DEFAULT NULL,           -- Microchip ID
    nfc_tag_id          VARCHAR(255)    DEFAULT NULL,           -- PawSync NFC tag identifier
    photo               TEXT            DEFAULT NULL,           -- Base64 data URL
    notes               TEXT            DEFAULT NULL,           -- Markings, color, etc.
    allergies           TEXT            DEFAULT NULL,           -- JSON array: ["Chicken","Eggs"]
    is_lost             BOOLEAN         NOT NULL DEFAULT FALSE, -- Lost pet flag
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owner_id (owner_id),
    INDEX idx_nfc_tag_id (nfc_tag_id),
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: assigned_vets
-- MongoDB Collection: assignedvets
-- ============================================================
-- Junction table: assigns a veterinarian to a pet at a clinic/branch.
-- Auto-created when a clinic admin approves a vet application.
--
-- INPUTS (Assign Vet / Approve Application):
--   vetId, petId, clinicId, clinicBranchId, clinicName, clinicAddress
--
-- OUTPUTS (API Response):
--   Populated with vet user info (name, email) and pet info.
--   Used in dashboard vet card, pet detail view.
-- ============================================================
CREATE TABLE assigned_vets (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    vet_id              CHAR(24)        NOT NULL,               -- FK → users._id (veterinarian)
    pet_id              CHAR(24)        NOT NULL,               -- FK → pets._id
    clinic_id           CHAR(24)        DEFAULT NULL,           -- FK → clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK → clinic_branches._id
    clinic_name         VARCHAR(255)    NOT NULL,               -- Denormalized clinic name
    clinic_address      VARCHAR(500)    DEFAULT NULL,           -- Denormalized clinic address
    assigned_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,  -- Active assignment flag
    last_visit          DATETIME        DEFAULT NULL,           -- Last vet visit date
    next_visit          DATETIME        DEFAULT NULL,           -- Next scheduled visit date
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_vet_pet (vet_id, pet_id),                  -- One vet-pet assignment at a time
    INDEX idx_vet_id (vet_id),
    INDEX idx_pet_id (pet_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_clinic_branch_id (clinic_branch_id),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: vet_verifications
-- MongoDB Collection: vetverifications
-- ============================================================
-- Stores PRC license verification submissions from vets.
-- Created when a vet completes onboarding Step 2 (PRC License).
-- Reviewed by clinic admins in the Verification tab.
--
-- INPUTS (Vet Onboarding - Submit Verification):
--   vetId, firstName, lastName, middleName, suffix,
--   prcLicenseNumber, profession, registrationDate,
--   expirationDate, prcIdPhoto, clinicId, branchId
--
-- OUTPUTS (API Response):
--   All fields, populated with vet user info and branch name.
--   Used in clinic admin verification page.
-- ============================================================
CREATE TABLE vet_verifications (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    vet_id              CHAR(24)        NOT NULL,               -- FK → users._id (veterinarian)
    first_name          VARCHAR(255)    NOT NULL,               -- Name as on PRC ID
    last_name           VARCHAR(255)    NOT NULL,
    middle_name         VARCHAR(255)    DEFAULT NULL,
    suffix              VARCHAR(50)     DEFAULT NULL,           -- e.g. "Jr.", "III"
    prc_license_number  VARCHAR(50)     NOT NULL,               -- 7-digit PRC number
    profession          VARCHAR(255)    NOT NULL DEFAULT 'Veterinarian',
    registration_date   DATE            NOT NULL,               -- PRC license issue date
    expiration_date     DATE            NOT NULL,               -- PRC license expiry date
    prc_id_photo        LONGTEXT        DEFAULT NULL,           -- Base64 data URL of PRC ID photo
    status              ENUM('pending', 'verified', 'rejected')
                                        NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT            DEFAULT NULL,           -- Reason if rejected
    reviewed_by         CHAR(24)        DEFAULT NULL,           -- FK → users._id (clinic-admin who reviewed)
    reviewed_at         DATETIME        DEFAULT NULL,
    clinic_id           CHAR(24)        DEFAULT NULL,           -- FK → clinics._id (clinic applied to)
    branch_id           CHAR(24)        DEFAULT NULL,           -- FK → clinic_branches._id
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_status (clinic_id, status),
    INDEX idx_status (status),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: vet_applications
-- MongoDB Collection: vetapplications
-- ============================================================
-- Stores vet applications to join a clinic.
-- Created when a vet completes onboarding Step 3 (Select Clinic).
-- On approval, an assigned_vets record is auto-created.
--
-- INPUTS (Vet Onboarding - Submit Application):
--   vetId, clinicId, branchId, verificationId
--
-- OUTPUTS (API Response):
--   All fields, populated with vet/clinic/branch info.
--   Used in clinic admin dashboard for application management.
-- ============================================================
CREATE TABLE vet_applications (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    vet_id              CHAR(24)        NOT NULL,               -- FK → users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK → clinics._id
    branch_id           CHAR(24)        NOT NULL,               -- FK → clinic_branches._id
    verification_id     CHAR(24)        DEFAULT NULL,           -- FK → vet_verifications._id
    status              ENUM('pending', 'approved', 'rejected')
                                        NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT            DEFAULT NULL,           -- Reason if rejected
    reviewed_by         CHAR(24)        DEFAULT NULL,           -- FK → users._id (clinic-admin who reviewed)
    reviewed_at         DATETIME        DEFAULT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_vet_clinic (vet_id, clinic_id),            -- One application per vet per clinic
    INDEX idx_clinic_status (clinic_id, status),
    INDEX idx_vet_id (vet_id),
    INDEX idx_status (status),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (verification_id) REFERENCES vet_verifications(_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: medical_records
-- MongoDB Collection: medicalrecords
-- ============================================================
-- Stores medical records (vitals, observations, images) for pets.
-- Created by veterinarians during consultations.
--
-- INPUTS (Create Medical Record):
--   petId, vetId, clinicId, clinicBranchId, vitals (10 entries),
--   images (optional), overallObservation
--
-- OUTPUTS (API Response):
--   All fields. Used in pet medical history view.
-- ============================================================
CREATE TABLE medical_records (
    _id                     CHAR(24)        PRIMARY KEY,        -- MongoDB ObjectId
    pet_id                  CHAR(24)        NOT NULL,           -- FK → pets._id
    vet_id                  CHAR(24)        NOT NULL,           -- FK → users._id (veterinarian)
    clinic_id               CHAR(24)        NOT NULL,           -- FK → clinics._id
    clinic_branch_id        CHAR(24)        NOT NULL,           -- FK → clinic_branches._id
    -- Vitals (each has value + notes)
    vitals_weight_value     VARCHAR(50)     NOT NULL,
    vitals_weight_notes     TEXT            DEFAULT '',
    vitals_temperature_value VARCHAR(50)    NOT NULL,
    vitals_temperature_notes TEXT           DEFAULT '',
    vitals_pulse_rate_value VARCHAR(50)     NOT NULL,
    vitals_pulse_rate_notes TEXT            DEFAULT '',
    vitals_spo2_value       VARCHAR(50)     NOT NULL,
    vitals_spo2_notes       TEXT            DEFAULT '',
    vitals_bcs_value        VARCHAR(50)     NOT NULL,           -- Body Condition Score
    vitals_bcs_notes        TEXT            DEFAULT '',
    vitals_dental_value     VARCHAR(50)     NOT NULL,           -- Dental Score
    vitals_dental_notes     TEXT            DEFAULT '',
    vitals_crt_value        VARCHAR(50)     NOT NULL,           -- Capillary Refill Time
    vitals_crt_notes        TEXT            DEFAULT '',
    vitals_pregnancy_value  VARCHAR(50)     NOT NULL,
    vitals_pregnancy_notes  TEXT            DEFAULT '',
    vitals_xray_value       VARCHAR(50)     NOT NULL,
    vitals_xray_notes       TEXT            DEFAULT '',
    vitals_vaccinated_value VARCHAR(50)     NOT NULL,
    vitals_vaccinated_notes TEXT            DEFAULT '',
    overall_observation     TEXT            DEFAULT '',
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_date (pet_id, created_at DESC),
    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_id (clinic_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);

-- Sub-table for medical record images (embedded array in MongoDB)
CREATE TABLE medical_record_images (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    medical_record_id   CHAR(24)        NOT NULL,               -- FK → medical_records._id
    data                LONGBLOB        NOT NULL,               -- Image binary data
    content_type        VARCHAR(50)     NOT NULL,               -- e.g. "image/jpeg"
    description         TEXT            DEFAULT '',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);


-- ============================================================
-- RELATIONSHIPS SUMMARY (9 tables, 10 relationships)
-- ============================================================
--
--  users (pet-owner) ──1:N──► pets
--      A pet owner can have many pets.
--      Each pet belongs to exactly one owner.
--
--  users (clinic-admin) ──1:N──► clinics
--      A clinic admin manages one or more clinics.
--      Each clinic has exactly one admin.
--
--  clinics ──1:N──► clinic_branches
--      A clinic can have many branches.
--      Each branch belongs to one clinic.
--
--  users (veterinarian) ──M:N──► pets  (via assigned_vets)
--      A vet can be assigned to many pets.
--      A pet can have many vets (unique per vet-pet pair).
--
--  users (veterinarian) ──1:N──► vet_verifications
--      A vet submits PRC verification to a clinic.
--      Reviewed by clinic admin (approved/rejected).
--
--  users (veterinarian) ──1:N──► vet_applications
--      A vet applies to join a clinic (unique per vet-clinic pair).
--      Links to vet_verifications via verification_id.
--      On approval, creates an assigned_vets record.
--
--  vet_verifications ──1:1──► vet_applications
--      Each application references the vet's PRC verification.
--
--  pets ──1:N──► medical_records
--      A pet can have many medical records over time.
--      Each record links to the vet, clinic, and branch.
--
--  medical_records ──1:N──► medical_record_images
--      A medical record can have many attached images.
--
-- ============================================================
--
--  ┌─────────────┐        ┌──────────────┐        ┌─────────────────┐
--  │   users     │──1:N──►│   clinics    │──1:N──►│ clinic_branches │
--  │(clinic-admin)│       │              │        │                 │
--  └─────────────┘        └──────┬───────┘        └────────┬────────┘
--                                │                         │
--                                │    ┌────────────────────┤
--                                │    │                    │
--                         ┌──────▼────▼──┐          ┌──────▼──────────┐
--                         │    vet_      │          │vet_applications │
--                         │verifications │◄────1:1──│                 │
--                         └──────▲───────┘          └──────▲──────────┘
--                                │                         │
--  ┌─────────────┐               │                         │
--  │   users     │───────1:N─────┴─────────1:N─────────────┘
--  │(veterinarian)│
--  └──────┬──────┘
--         │
--         │ M:N (via assigned_vets)
--         │
--  ┌──────▼──────┐        ┌──────────────┐        ┌─────────────────┐
--  │assigned_vets│◄───M:N─│    pets      │──1:N──►│ medical_records │
--  │ (junction)  │        │              │        │                 │
--  └─────────────┘        └──────▲───────┘        └──────┬──────────┘
--                                │                       │
--  ┌─────────────┐               │                ┌──────▼──────────┐
--  │   users     │───────1:N─────┘                │ medical_record_ │
--  │ (pet-owner) │                                │    images       │
--  └─────────────┘                                └─────────────────┘
--
-- ============================================================


-- ============================================================
-- SAMPLE QUERIES
-- ============================================================

-- Get all pets for a specific owner
-- SELECT * FROM pets WHERE owner_id = '<user_id>';

-- Get a pet's assigned vet with clinic info
-- SELECT u.first_name, u.last_name, u.email, av.clinic_name, av.clinic_address, av.last_visit, av.next_visit
-- FROM assigned_vets av
-- JOIN users u ON u._id = av.vet_id
-- WHERE av.pet_id = '<pet_id>' AND av.is_active = TRUE;

-- Get all pets assigned to a vet
-- SELECT p.*, av.clinic_name, av.last_visit, av.next_visit
-- FROM assigned_vets av
-- JOIN pets p ON p._id = av.pet_id
-- WHERE av.vet_id = '<vet_user_id>' AND av.is_active = TRUE;

-- Look up a pet by NFC tag
-- SELECT p.*, u.first_name AS owner_first_name, u.last_name AS owner_last_name
-- FROM pets p
-- JOIN users u ON u._id = p.owner_id
-- WHERE p.nfc_tag_id = '<nfc_tag_id>';

-- Get all clinics with their branches (for vet onboarding)
-- SELECT c.*, cb.name AS branch_name, cb.address AS branch_address, cb.is_main
-- FROM clinics c
-- JOIN clinic_branches cb ON cb.clinic_id = c._id AND cb.is_active = TRUE
-- WHERE c.is_active = TRUE
-- ORDER BY c.name, cb.is_main DESC, cb.name;

-- Get pending PRC verifications for a clinic admin's clinic
-- SELECT vv.*, u.first_name AS vet_first_name, u.last_name AS vet_last_name, u.email AS vet_email
-- FROM vet_verifications vv
-- JOIN users u ON u._id = vv.vet_id
-- JOIN clinics c ON c._id = vv.clinic_id
-- WHERE c.admin_id = '<admin_user_id>' AND vv.status = 'pending'
-- ORDER BY vv.created_at DESC;

-- Get pending vet applications for a clinic
-- SELECT va.*, u.first_name, u.last_name, u.email, cb.name AS branch_name
-- FROM vet_applications va
-- JOIN users u ON u._id = va.vet_id
-- JOIN clinic_branches cb ON cb._id = va.branch_id
-- JOIN clinics c ON c._id = va.clinic_id
-- WHERE c.admin_id = '<admin_user_id>' AND va.status = 'pending'
-- ORDER BY va.created_at DESC;

-- Get medical records for a pet (most recent first)
-- SELECT mr.*, u.first_name AS vet_first_name, u.last_name AS vet_last_name
-- FROM medical_records mr
-- JOIN users u ON u._id = mr.vet_id
-- WHERE mr.pet_id = '<pet_id>'
-- ORDER BY mr.created_at DESC;
