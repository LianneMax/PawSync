-- ============================================================
-- PawSync Database Schema (SQL Mapping of MongoDB Collections)
-- ============================================================
-- This file maps out the MongoDB collections as relational tables
-- for documentation, ERD generation, and planning purposes.
-- MongoDB Collection -> SQL Table
-- Last updated: 2026-03-23
-- ============================================================


-- ============================================================
-- TABLE: users
-- MongoDB Collection: users
-- ============================================================
-- Stores all users: pet owners, veterinarians, clinic admins,
-- branch admins, and guest (walk-in intake) users.
--
-- INPUTS (Registration):
--   email, password (optional for Google users), firstName, lastName,
--   contactNumber, userType, clinicName (clinic-admin only)
--
-- OUTPUTS (API Response):
--   id, email, firstName, lastName, contactNumber, userType,
--   isVerified, emailVerified, clinicId, clinicBranchId, createdAt
--   (password, resetOtp, resetOtpExpires, emailVerificationToken,
--    claimToken are NEVER returned)
-- ============================================================
CREATE TABLE users (
    _id                         CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    email                       VARCHAR(255)    UNIQUE DEFAULT NULL,    -- Lowercase, sparse unique (guests may share placeholder)
    password                    VARCHAR(255)    DEFAULT NULL,           -- Bcrypt hashed; NULL for Google-only accounts
    first_name                  VARCHAR(255)    NOT NULL,
    last_name                   VARCHAR(255)    NOT NULL,
    contact_number              VARCHAR(50)     DEFAULT NULL,
    contact_number_normalized   VARCHAR(50)     DEFAULT NULL,           -- Digits-only normalized version (sparse unique)
    photo                       TEXT            DEFAULT NULL,           -- Base64 data URL
    user_type                   ENUM('pet-owner', 'veterinarian', 'clinic-admin', 'inactive')
                                                NOT NULL,
    clinic_id                   CHAR(24)        DEFAULT NULL,           -- FK to clinics._id (for vet/clinic-admin)
    clinic_branch_id            CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id (for clinic-admin)
    is_main_branch              BOOLEAN         NOT NULL DEFAULT FALSE, -- True if user manages the main branch
    is_verified                 BOOLEAN         NOT NULL DEFAULT FALSE, -- PRC license verification for vets
    email_verified              BOOLEAN         NOT NULL DEFAULT TRUE,  -- Email confirmation flag
    email_verification_token    VARCHAR(255)    DEFAULT NULL,           -- Hidden from queries (select: false)
    email_verification_expires  DATETIME        DEFAULT NULL,           -- Hidden from queries (select: false)
    google_id                   VARCHAR(255)    DEFAULT NULL,           -- Google OAuth ID (sparse unique)
    login_attempts              INT             NOT NULL DEFAULT 0,
    lock_until                  DATETIME        DEFAULT NULL,           -- Account lockout timestamp
    reset_otp                   VARCHAR(255)    DEFAULT NULL,           -- Password reset OTP (hidden from queries)
    reset_otp_expires           DATETIME        DEFAULT NULL,           -- OTP expiration (hidden from queries)
    -- ── Guest / Walk-in intake fields ──────────────────────────────
    is_guest                    BOOLEAN         NOT NULL DEFAULT FALSE,
    claim_status                ENUM('unclaimed', 'unclaimable', 'invited', 'claimed')
                                                DEFAULT NULL,
    guest_clinic_id             CHAR(24)        DEFAULT NULL,           -- FK to clinics._id (clinic that created guest)
    claim_token                 VARCHAR(255)    DEFAULT NULL,           -- Hidden from queries (select: false)
    claim_token_expires         DATETIME        DEFAULT NULL,           -- Hidden from queries (select: false)
    claim_invite_sent_at        DATETIME        DEFAULT NULL,
    -- ── Embedded resignation status (denormalized from resignations collection) ──
    resignation_status          ENUM('none', 'pending', 'approved', 'rejected', 'completed')
                                                NOT NULL DEFAULT 'none',
    resignation_submitted_at    DATETIME        DEFAULT NULL,
    resignation_notice_start    DATETIME        DEFAULT NULL,
    resignation_end_date        DATETIME        DEFAULT NULL,
    resignation_backup_vet_id   CHAR(24)        DEFAULT NULL,           -- FK to users._id
    resignation_clinic_id       CHAR(24)        DEFAULT NULL,           -- FK to clinics._id
    resignation_clinic_branch_id CHAR(24)       DEFAULT NULL,           -- FK to clinic_branches._id
    resignation_rejection_reason TEXT           DEFAULT NULL,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_is_guest (is_guest),
    UNIQUE INDEX idx_google_id (google_id),                 -- Sparse: only unique when non-null
    UNIQUE INDEX idx_contact_number_normalized (contact_number_normalized)  -- Sparse
);


-- ============================================================
-- TABLE: clinics
-- MongoDB Collection: clinics
-- ============================================================
-- Stores veterinary clinic organizations.
-- Auto-created when a clinic-admin registers.
-- The admin is linked via users.clinic_id, not stored here.
--
-- INPUTS (Auto-created on clinic-admin signup):
--   name, mainBranchId (set after main branch created)
--
-- OUTPUTS (API Response):
--   All fields. Used in vet onboarding clinic selection,
--   clinic admin dashboard.
-- ============================================================
CREATE TABLE clinics (
    _id                 CHAR(24)        PRIMARY KEY,
    name                VARCHAR(255)    NOT NULL,
    main_branch_id      CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    logo                TEXT            DEFAULT NULL,           -- Base64 data URL of clinic logo
    address             VARCHAR(500)    DEFAULT NULL,
    phone               VARCHAR(50)     DEFAULT NULL,
    email               VARCHAR(255)    DEFAULT NULL,           -- Lowercase
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (main_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: clinic_branches
-- MongoDB Collection: clinicbranches
-- ============================================================
-- Stores individual branch locations for a clinic.
-- A default 'Main Branch' is auto-created with the clinic.
--
-- INPUTS (Add/Edit Branch):
--   clinicId, name, address, city, province, phone, email,
--   openingTime, closingTime, operatingDays[], closureDates[], isMain
--
-- OUTPUTS (API Response):
--   All fields. Used in clinic admin branch management,
--   vet onboarding branch selection.
-- ============================================================
CREATE TABLE clinic_branches (
    _id                 CHAR(24)        PRIMARY KEY,
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    name                VARCHAR(255)    NOT NULL,
    address             VARCHAR(500)    NOT NULL,
    city                VARCHAR(255)    DEFAULT NULL,
    province            VARCHAR(255)    DEFAULT NULL,
    phone               VARCHAR(50)     DEFAULT NULL,
    email               VARCHAR(255)    DEFAULT NULL,           -- Lowercase
    opening_time        VARCHAR(20)     DEFAULT NULL,           -- e.g. '08:00'
    closing_time        VARCHAR(20)     DEFAULT NULL,           -- e.g. '20:00'
    operating_days      VARCHAR(255)    NOT NULL DEFAULT '[]',  -- JSON array; enum: Mon|Tue|Wed|Thu|Fri|Sat|Sun
    is_main             BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_clinic_id (clinic_id),
    UNIQUE INDEX idx_clinic_main (clinic_id, is_main),          -- Partial: isMain=true only
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE
);

-- Sub-table: temporary closure dates for a branch (embedded array in MongoDB)
CREATE TABLE clinic_branch_closure_dates (
    _id             CHAR(24)        PRIMARY KEY,
    branch_id       CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    start_date      DATETIME        NOT NULL,
    end_date        DATETIME        NOT NULL,
    closure_type    ENUM('single-day', 'date-range') NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_branch_id (branch_id),
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: pets
-- MongoDB Collection: pets
-- ============================================================
-- Stores all pet profiles belonging to pet owners.
-- BUSINESS RULE: A pet owner must register at least one pet during onboarding.
--
-- INPUTS (Pet Onboarding / Add Pet):
--   ownerId, name, species, breed, secondaryBreed, sex, dateOfBirth,
--   weight, sterilization, microchipNumber, bloodType, color, photo, allergies
--
-- OUTPUTS (API Response):
--   All fields. Used in dashboard pet cards, my-pets page,
--   vet patient lists, NFC tag lookups, lost pet profile.
-- ============================================================
CREATE TABLE pets (
    _id                             CHAR(24)        PRIMARY KEY,
    owner_id                        CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    status                          ENUM('alive', 'lost', 'deceased') NOT NULL DEFAULT 'alive',
    name                            VARCHAR(255)    NOT NULL,
    species                         ENUM('canine', 'feline') NOT NULL,
    breed                           VARCHAR(255)    NOT NULL,
    secondary_breed                 VARCHAR(255)    DEFAULT NULL,
    sex                             ENUM('male', 'female') NOT NULL,
    date_of_birth                   DATE            NOT NULL,
    weight                          DECIMAL(6,2)    NOT NULL,               -- kg
    sterilization                   ENUM('spayed', 'unspayed', 'neutered', 'unneutered', 'unknown') NOT NULL,
    microchip_number                VARCHAR(255)    DEFAULT NULL,
    nfc_tag_id                      VARCHAR(255)    DEFAULT NULL,           -- PawSync NFC tag identifier (unique when non-null)
    qr_code                         TEXT            DEFAULT NULL,           -- QR code data URL or identifier
    photo                           TEXT            DEFAULT NULL,           -- Base64 data URL
    color                           VARCHAR(100)    DEFAULT NULL,
    blood_type                      VARCHAR(50)     DEFAULT NULL,
    allergies                       TEXT            NOT NULL DEFAULT '[]',  -- JSON array: ['Chicken','Eggs']
    -- ── Pregnancy tracking ──────────────────────────────────────────
    pregnancy_status                ENUM('pregnant', 'not_pregnant') DEFAULT NULL, -- NULL for males
    total_pregnancies               INT             NOT NULL DEFAULT 0,
    total_litters                   INT             NOT NULL DEFAULT 0,
    last_delivery_date              DATETIME        DEFAULT NULL,
    -- ── Vet assignment ──────────────────────────────────────────────
    assigned_vet_id                 CHAR(24)        DEFAULT NULL,           -- FK to users._id (vet)
    -- ── Status fields ───────────────────────────────────────────────
    is_lost                         BOOLEAN         NOT NULL DEFAULT FALSE,
    is_alive                        BOOLEAN         NOT NULL DEFAULT TRUE,
    deceased_at                     DATETIME        DEFAULT NULL,
    deceased_by                     CHAR(24)        DEFAULT NULL,           -- FK to users._id (vet who confirmed)
    removed_by_owner                BOOLEAN         NOT NULL DEFAULT FALSE,
    removed_at                      DATETIME        DEFAULT NULL,
    -- ── Lost pet info ───────────────────────────────────────────────
    lost_contact_name               VARCHAR(255)    DEFAULT NULL,
    lost_contact_number             VARCHAR(50)     DEFAULT NULL,
    lost_message                    TEXT            DEFAULT NULL,
    lost_reported_by_stranger       BOOLEAN         NOT NULL DEFAULT FALSE,
    -- ── Confinement ─────────────────────────────────────────────────
    is_confined                     BOOLEAN         NOT NULL DEFAULT FALSE,
    confined_since                  DATETIME        DEFAULT NULL,
    current_confinement_record_id   CHAR(24)        DEFAULT NULL,           -- FK to confinement_records._id
    -- ── NFC scan location ───────────────────────────────────────────
    last_scanned_lat                DECIMAL(10,7)   DEFAULT NULL,
    last_scanned_lng                DECIMAL(10,7)   DEFAULT NULL,
    last_scanned_at                 DATETIME        DEFAULT NULL,
    created_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owner_id (owner_id),
    INDEX idx_status (status),
    INDEX idx_is_alive (is_alive),
    INDEX idx_removed_by_owner (removed_by_owner),
    UNIQUE INDEX idx_nfc_tag_id (nfc_tag_id),               -- Sparse: only unique when non-null
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_vet_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (deceased_by) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (current_confinement_record_id) REFERENCES confinement_records(_id) ON DELETE SET NULL
);

-- Sub-table: NFC scan location history (embedded array in MongoDB)
CREATE TABLE pet_scan_locations (
    _id         CHAR(24)        PRIMARY KEY,
    pet_id      CHAR(24)        NOT NULL,               -- FK to pets._id
    lat         DECIMAL(10,7)   NOT NULL,
    lng         DECIMAL(10,7)   NOT NULL,
    scanned_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_pet_id (pet_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE
);

-- Sub-table: previous owners history (embedded array in MongoDB)
CREATE TABLE pet_previous_owners (
    _id         CHAR(24)        PRIMARY KEY,
    pet_id      CHAR(24)        NOT NULL,               -- FK to pets._id
    user_id     CHAR(24)        NOT NULL,               -- FK to users._id (former owner)
    name        VARCHAR(255)    NOT NULL,               -- Snapshot of owner name at transfer time
    until       DATETIME        NOT NULL,               -- Date ownership ended

    INDEX idx_pet_id (pet_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: pet_notes
-- MongoDB Collection: petnotes
-- ============================================================
-- Stores general free-form notes for a pet (one document per pet).
-- ============================================================
CREATE TABLE pet_notes (
    _id         CHAR(24)        PRIMARY KEY,
    pet_id      CHAR(24)        NOT NULL UNIQUE,        -- FK to pets._id (one notes doc per pet)
    notes       TEXT            NOT NULL DEFAULT '',
    updated_by  CHAR(24)        DEFAULT NULL,           -- FK to users._id
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: assigned_vets
-- MongoDB Collection: assignedvets
-- ============================================================
-- Junction table: assigns a veterinarian to a pet and/or clinic branch.
-- Auto-created when a clinic admin approves a vet application.
-- petId is nullable (null = clinic-level assignment only).
--
-- INPUTS (Assign Vet / Approve Application):
--   vetId, petId (optional), clinicId, clinicBranchId, clinicName, clinicAddress
--
-- OUTPUTS (API Response):
--   Populated with vet user info and pet info.
--   Used in dashboard vet card, pet detail view.
-- ============================================================
CREATE TABLE assigned_vets (
    _id                 CHAR(24)        PRIMARY KEY,
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    pet_id              CHAR(24)        DEFAULT NULL,           -- FK to pets._id; null = clinic-level
    clinic_id           CHAR(24)        DEFAULT NULL,           -- FK to clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    clinic_name         VARCHAR(255)    NOT NULL,               -- Denormalized
    clinic_address      VARCHAR(500)    DEFAULT NULL,           -- Denormalized
    assigned_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    last_visit          DATETIME        DEFAULT NULL,
    next_visit          DATETIME        DEFAULT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Partial unique: one assignment per vet-pet pair (when petId is set)
    -- Partial unique: one assignment per vet-branch (when clinicBranchId is set, petId null)
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
-- INPUTS: vetId, firstName, lastName, middleName, suffix,
--   prcLicenseNumber, profession, registrationDate,
--   expirationDate, prcIdPhoto, clinicId, branchId
-- OUTPUTS: All fields + vet user info. Used in clinic admin verification page.
-- ============================================================
CREATE TABLE vet_verifications (
    _id                 CHAR(24)        PRIMARY KEY,
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    first_name          VARCHAR(255)    NOT NULL,
    last_name           VARCHAR(255)    NOT NULL,
    middle_name         VARCHAR(255)    DEFAULT NULL,
    suffix              VARCHAR(50)     DEFAULT NULL,
    prc_license_number  VARCHAR(50)     NOT NULL,
    profession          VARCHAR(255)    NOT NULL DEFAULT 'Veterinarian',
    registration_date   DATE            NOT NULL,
    expiration_date     DATE            NOT NULL,
    prc_id_photo        LONGTEXT        DEFAULT NULL,           -- Base64 data URL
    status              ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT            DEFAULT NULL,
    reviewed_by         CHAR(24)        DEFAULT NULL,           -- FK to users._id (clinic-admin)
    reviewed_at         DATETIME        DEFAULT NULL,
    clinic_id           CHAR(24)        DEFAULT NULL,           -- FK to clinics._id
    branch_id           CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
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
-- Unique constraint: one pending application per vet per clinic.
--
-- INPUTS: vetId, clinicId, branchId, verificationId
-- OUTPUTS: All fields + vet/clinic/branch info.
-- ============================================================
CREATE TABLE vet_applications (
    _id                 CHAR(24)        PRIMARY KEY,
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    branch_id           CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    verification_id     CHAR(24)        DEFAULT NULL,           -- FK to vet_verifications._id
    status              ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT            DEFAULT NULL,
    reviewed_by         CHAR(24)        DEFAULT NULL,           -- FK to users._id (clinic-admin)
    reviewed_at         DATETIME        DEFAULT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_vet_clinic (vet_id, clinic_id),
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
-- TABLE: vet_invitations
-- MongoDB Collection: vetinvitations
-- ============================================================
-- Direct token-based invitations sent to vets by clinic admins.
-- Alternative to the application workflow.
-- ============================================================
CREATE TABLE vet_invitations (
    _id         CHAR(24)        PRIMARY KEY,
    vet_id      CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id   CHAR(24)        NOT NULL,               -- FK to clinics._id
    branch_id   CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    token       VARCHAR(255)    NOT NULL UNIQUE,        -- Invitation token
    status      ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
    expires_at  DATETIME        NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_status (status),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: vet_schedules
-- MongoDB Collection: vetschedules
-- ============================================================
-- Stores a vet's working schedule at a specific branch.
-- One schedule per vet per branch (unique constraint).
--
-- INPUTS: vetId, branchId, workingDays[], startTime, endTime,
--   breakStart, breakEnd
-- OUTPUTS: All fields. Used for appointment slot generation.
-- ============================================================
CREATE TABLE vet_schedules (
    _id             CHAR(24)        PRIMARY KEY,
    vet_id          CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    branch_id       CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    working_days    VARCHAR(255)    NOT NULL DEFAULT '[]',  -- JSON array; enum: Mon|Tue|Wed|Thu|Fri|Sat|Sun
    start_time      VARCHAR(10)     NOT NULL,               -- e.g. '09:00'
    end_time        VARCHAR(10)     NOT NULL,               -- e.g. '17:00'
    break_start     VARCHAR(10)     DEFAULT NULL,           -- e.g. '12:00'
    break_end       VARCHAR(10)     DEFAULT NULL,           -- e.g. '13:00'
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_vet_branch (vet_id, branch_id),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: vet_leaves
-- MongoDB Collection: vetleaves
-- ============================================================
-- Records day-off / leave dates for a veterinarian.
-- Used to block out appointment slots on those dates.
-- ============================================================
CREATE TABLE vet_leaves (
    _id         CHAR(24)        PRIMARY KEY,
    vet_id      CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    date        DATE            NOT NULL,
    reason      TEXT            DEFAULT NULL,
    status      ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vet_id (vet_id),
    INDEX idx_date (date),
    INDEX idx_vet_date_status (vet_id, date, status),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: resignations
-- MongoDB Collection: resignations
-- ============================================================
-- Manages the formal resignation workflow for veterinarians.
-- STATUS: pending -> approved | rejected -> completed
-- Also denormalized as embedded field on users.resignation_*.
--
-- INPUTS: vetId, clinicId, clinicBranchId, backupVetId
-- OUTPUTS: All fields. Used in clinic admin resignation management.
-- ============================================================
CREATE TABLE resignations (
    _id                 CHAR(24)        PRIMARY KEY,
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (resigning vet)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    backup_vet_id       CHAR(24)        NOT NULL,               -- FK to users._id (replacement vet)
    status              ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
    submitted_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notice_start        DATETIME        DEFAULT NULL,
    end_date            DATETIME        DEFAULT NULL,
    reviewed_by         CHAR(24)        DEFAULT NULL,           -- FK to users._id (reviewer)
    reviewed_at         DATETIME        DEFAULT NULL,
    rejection_reason    TEXT            DEFAULT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vet_status (vet_id, status),
    INDEX idx_clinic_branch_status (clinic_id, clinic_branch_id, status),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (backup_vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: appointments
-- MongoDB Collection: appointments
-- ============================================================
-- Stores pet appointments booked at a clinic.
-- Status lifecycle: pending -> confirmed -> in_clinic -> in_progress
--                   -> completed | cancelled | rescheduled
-- Check-in (in_progress) auto-creates a MedicalRecord draft.
--
-- INPUTS: petId, ownerId, vetId (optional), clinicId, clinicBranchId,
--   mode, types[], date, startTime, endTime, notes, isWalkIn, isEmergency
-- OUTPUTS: All fields + pet/vet/clinic info.
-- ============================================================
CREATE TABLE appointments (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    owner_id            CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    vet_id              CHAR(24)        DEFAULT NULL,           -- FK to users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    mode                ENUM('online', 'face-to-face') NOT NULL,
    types               VARCHAR(1000)   NOT NULL DEFAULT '[]',
        -- JSON array of appointment types, e.g.:
        --   consultation | general-checkup | vaccination | deworming |
        --   x-ray | ultrasound | surgery | grooming | etc.
    date                DATE            NOT NULL,
    start_time          VARCHAR(10)     NOT NULL,               -- e.g. '07:00'
    end_time            VARCHAR(10)     NOT NULL,               -- e.g. '07:30'
    status              ENUM('pending', 'confirmed', 'rescheduled', 'in_clinic', 'in_progress', 'cancelled', 'completed')
                                        NOT NULL DEFAULT 'pending',
    notes               TEXT            DEFAULT NULL,
    is_walk_in          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_emergency        BOOLEAN         NOT NULL DEFAULT FALSE,
    medical_record_id   CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id (set on check-in)
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Partial unique: no double-booking same vet/date/slot for non-emergency active appointments
    INDEX idx_pet_id (pet_id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_date (date),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: medical_records
-- MongoDB Collection: medicalrecords
-- ============================================================
-- Stores medical records for pets, created by veterinarians.
-- BUSINESS RULES:
--   - One isCurrent=true record per pet at a time
--   - Private by default (sharedWithOwner=false)
--   - Delete disabled; only edit/view/share allowed
--   - Auto-created as draft when appointment moves to in_progress
--
-- INPUTS: petId, ownerId, vetId, clinicId, clinicBranchId, appointmentId,
--   stage, chiefComplaint, vitals, SOAP notes, visitSummary, vetNotes,
--   overallObservation, medications[], diagnosticTests[], preventiveCare[],
--   images[], sharedWithOwner, confinementAction, confinementDays
-- OUTPUTS: All fields (private by default).
-- ============================================================
CREATE TABLE medical_records (
    _id                         CHAR(24)        PRIMARY KEY,
    pet_id                      CHAR(24)        NOT NULL,       -- FK to pets._id
    owner_id                    CHAR(24)        NOT NULL,       -- FK to users._id (current owner at time of record)
    pet_is_alive                BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Denormalized snapshots at time of record
    owner_at_time_name          VARCHAR(255)    NOT NULL DEFAULT '',
    owner_at_time_id            CHAR(24)        DEFAULT NULL,   -- FK to users._id
    vet_at_time_name            VARCHAR(255)    NOT NULL DEFAULT '',
    vet_at_time_id              CHAR(24)        DEFAULT NULL,   -- FK to users._id
    vet_id                      CHAR(24)        NOT NULL,       -- FK to users._id (veterinarian)
    clinic_id                   CHAR(24)        NOT NULL,       -- FK to clinics._id
    clinic_branch_id            CHAR(24)        NOT NULL,       -- FK to clinic_branches._id
    appointment_id              CHAR(24)        DEFAULT NULL,   -- FK to appointments._id
    billing_id                  CHAR(24)        DEFAULT NULL,   -- FK to billing._id
    confinement_record_id       CHAR(24)        DEFAULT NULL,   -- FK to confinement_records._id
    stage                       ENUM('pre_procedure', 'in_procedure', 'post_procedure', 'confined', 'completed')
                                                NOT NULL DEFAULT 'pre_procedure',
    chief_complaint             TEXT            NOT NULL DEFAULT '',
    -- Vitals (10 entries, each has value + notes)
    vitals_weight_value         VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_weight_notes         TEXT            NOT NULL DEFAULT '',
    vitals_temperature_value    VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_temperature_notes    TEXT            NOT NULL DEFAULT '',
    vitals_pulse_rate_value     VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_pulse_rate_notes     TEXT            NOT NULL DEFAULT '',
    vitals_spo2_value           VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_spo2_notes           TEXT            NOT NULL DEFAULT '',
    vitals_bcs_value            VARCHAR(50)     NOT NULL DEFAULT '',  -- Body Condition Score 1-5
    vitals_bcs_notes            TEXT            NOT NULL DEFAULT '',
    vitals_dental_value         VARCHAR(50)     NOT NULL DEFAULT '',  -- Dental Score 1-3
    vitals_dental_notes         TEXT            NOT NULL DEFAULT '',
    vitals_crt_value            VARCHAR(50)     NOT NULL DEFAULT '',  -- Capillary Refill Time
    vitals_crt_notes            TEXT            NOT NULL DEFAULT '',
    vitals_pregnancy_value      VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_pregnancy_notes      TEXT            NOT NULL DEFAULT '',
    vitals_xray_value           VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_xray_notes           TEXT            NOT NULL DEFAULT '',
    vitals_vaccinated_value     VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_vaccinated_notes     TEXT            NOT NULL DEFAULT '',
    -- SOAP notes
    subjective                  TEXT            NOT NULL DEFAULT '',  -- S: Patient history / owner complaint
    assessment                  TEXT            NOT NULL DEFAULT '',  -- A: Diagnosis / clinical assessment
    plan                        TEXT            NOT NULL DEFAULT '',  -- P: Treatment plan / next steps
    -- Summary
    visit_summary               TEXT            NOT NULL DEFAULT '',
    vet_notes                   TEXT            NOT NULL DEFAULT '',
    overall_observation         TEXT            NOT NULL DEFAULT '',
    -- Flags
    shared_with_owner           BOOLEAN         NOT NULL DEFAULT FALSE,
    is_current                  BOOLEAN         NOT NULL DEFAULT TRUE,
    confinement_action          ENUM('none', 'confined', 'released') NOT NULL DEFAULT 'none',
    confinement_days            INT             NOT NULL DEFAULT 0,
    referral                    BOOLEAN         NOT NULL DEFAULT FALSE,
    discharge                   BOOLEAN         NOT NULL DEFAULT FALSE,
    scheduled_surgery           BOOLEAN         NOT NULL DEFAULT FALSE,
    preventive_associated_exclusions TEXT       NOT NULL DEFAULT '[]', -- JSON array of excluded service names
    -- Embedded pregnancy record (single document, NULL if not applicable)
    pregnancy_is_pregnant           BOOLEAN     DEFAULT NULL,
    pregnancy_gestation_date        DATETIME    DEFAULT NULL,
    pregnancy_expected_due_date     DATETIME    DEFAULT NULL,
    pregnancy_litter_number         INT         DEFAULT NULL,
    pregnancy_confirmation_method   ENUM('ultrasound','abdominal_palpation','clinical_observation','external_documentation','unknown') DEFAULT NULL,
    pregnancy_confirmation_source   ENUM('this_clinic','external_clinic','owner_reported','inferred','unknown') DEFAULT NULL,
    pregnancy_confidence            ENUM('high','medium','low') DEFAULT NULL,
    pregnancy_confirmed_at          DATETIME    DEFAULT NULL,
    pregnancy_notes                 TEXT        DEFAULT NULL,
    -- Embedded pregnancy delivery (single document, NULL if not applicable)
    delivery_date                   DATETIME    DEFAULT NULL,
    delivery_type                   VARCHAR(100) DEFAULT NULL,
    delivery_labor_duration         VARCHAR(100) DEFAULT NULL,
    delivery_live_births            INT         DEFAULT NULL,
    delivery_still_births           INT         DEFAULT NULL,
    delivery_mother_condition       ENUM('stable','critical','recovering') DEFAULT NULL,
    delivery_vet_remarks            TEXT        DEFAULT NULL,
    delivery_location               ENUM('in_clinic','outside_clinic','unknown') DEFAULT NULL,
    delivery_reported_by            ENUM('vet','owner','external_vet','unknown') DEFAULT NULL,
    -- Embedded pregnancy loss (single document, NULL if not applicable)
    loss_date                       DATETIME    DEFAULT NULL,
    loss_type                       ENUM('miscarriage','reabsorption','abortion','other') DEFAULT NULL,
    loss_gestational_age_at_loss    INT         DEFAULT NULL,
    loss_notes                      TEXT        DEFAULT NULL,
    loss_reported_by                ENUM('vet','owner','external_vet','unknown') DEFAULT NULL,
    -- Embedded surgery record (single document, NULL if not applicable)
    surgery_type                    VARCHAR(255) DEFAULT NULL,
    surgery_vet_remarks             TEXT        DEFAULT NULL,
    -- Embedded immunity testing (single document, NULL if not applicable)
    immunity_enabled                BOOLEAN     DEFAULT NULL,
    immunity_species                VARCHAR(50) DEFAULT NULL,
    immunity_kit_name               VARCHAR(255) DEFAULT NULL,
    immunity_test_date              DATETIME    DEFAULT NULL,
    immunity_positive_count         INT         DEFAULT NULL,
    immunity_summary                TEXT        DEFAULT NULL,
    immunity_markdown               TEXT        DEFAULT NULL,
    immunity_tag                    VARCHAR(100) DEFAULT NULL,
    immunity_linked_appointment_id  CHAR(24)    DEFAULT NULL,   -- FK to appointments._id
    immunity_follow_up_appointment_id CHAR(24)  DEFAULT NULL,   -- FK to appointments._id
    immunity_follow_up_date         DATETIME    DEFAULT NULL,
    immunity_skip_suggested         BOOLEAN     DEFAULT FALSE,
    immunity_antigen_enabled        BOOLEAN     DEFAULT FALSE,
    immunity_antigen_date           DATETIME    DEFAULT NULL,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_date (pet_id, created_at DESC),
    INDEX idx_pet_is_current (pet_id, is_current),
    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_appointment_id (appointment_id),
    INDEX idx_is_current (is_current),
    INDEX idx_pet_is_alive (pet_is_alive),
    INDEX idx_confinement_record_id (confinement_record_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_id) REFERENCES billing(_id) ON DELETE SET NULL,
    FOREIGN KEY (confinement_record_id) REFERENCES confinement_records(_id) ON DELETE SET NULL
);

-- Sub-table: images attached to a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_images (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    url                 TEXT            NOT NULL,               -- GridFS URL or base64
    description         TEXT            NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: medications prescribed in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_medications (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    name                VARCHAR(255)    NOT NULL DEFAULT '',
    dosage              VARCHAR(255)    NOT NULL DEFAULT '',
    route               ENUM('oral', 'topical', 'injection', 'other') NOT NULL DEFAULT 'oral',
    frequency           VARCHAR(255)    NOT NULL DEFAULT '',
    duration            VARCHAR(255)    NOT NULL DEFAULT '',
    start_date          DATE            DEFAULT NULL,
    end_date            DATE            DEFAULT NULL,
    notes               TEXT            NOT NULL DEFAULT '',
    status              ENUM('active', 'completed', 'discontinued') NOT NULL DEFAULT 'active',
    quantity            DECIMAL(10,2)   DEFAULT NULL,
    pricing_type        ENUM('singlePill', 'pack', '') DEFAULT '',
    pieces_per_pack     INT             DEFAULT NULL,

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: diagnostic tests ordered in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_diagnostic_tests (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    test_type           ENUM('blood_work', 'x_ray', 'ultrasound', 'urinalysis', 'ecg', 'other')
                                        NOT NULL DEFAULT 'other',
    name                VARCHAR(255)    NOT NULL DEFAULT '',
    date                DATE            DEFAULT NULL,
    result              TEXT            NOT NULL DEFAULT '',
    normal_range        VARCHAR(255)    NOT NULL DEFAULT '',
    notes               TEXT            NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: images for a diagnostic test (embedded array in MongoDB)
CREATE TABLE medical_record_diagnostic_test_images (
    _id                     CHAR(24)    PRIMARY KEY,
    diagnostic_test_id      CHAR(24)    NOT NULL,               -- FK to medical_record_diagnostic_tests._id
    url                     TEXT        NOT NULL,
    description             TEXT        NOT NULL DEFAULT '',

    INDEX idx_diagnostic_test_id (diagnostic_test_id),
    FOREIGN KEY (diagnostic_test_id) REFERENCES medical_record_diagnostic_tests(_id) ON DELETE CASCADE
);

-- Sub-table: preventive care administered in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_preventive_care (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    care_type           ENUM('flea', 'tick', 'heartworm', 'deworming', 'other') NOT NULL DEFAULT 'other',
    product             VARCHAR(255)    NOT NULL DEFAULT '',
    date_administered   DATE            DEFAULT NULL,
    notes               TEXT            NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: surgery images in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_surgery_images (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    url                 TEXT            NOT NULL,
    description         TEXT            NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: immunity testing rows in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_immunity_rows (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    disease             VARCHAR(255)    NOT NULL DEFAULT '',
    score               DECIMAL(5,2)    DEFAULT NULL,
    status              VARCHAR(100)    NOT NULL DEFAULT '',
    action              VARCHAR(255)    NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: immunity antigen testing rows in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_antigen_rows (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    disease             VARCHAR(255)    NOT NULL DEFAULT '',
    result              VARCHAR(100)    NOT NULL DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: follow-up entries in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_follow_ups (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id
    owner_observations  TEXT            NOT NULL DEFAULT '',
    vet_notes           TEXT            NOT NULL DEFAULT '',
    shared_with_owner   BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE
);

-- Sub-table: media attached to a follow-up (embedded array in MongoDB)
CREATE TABLE medical_record_follow_up_media (
    _id             CHAR(24)    PRIMARY KEY,
    follow_up_id    CHAR(24)    NOT NULL,               -- FK to medical_record_follow_ups._id
    url             TEXT        NOT NULL,
    description     TEXT        NOT NULL DEFAULT '',

    INDEX idx_follow_up_id (follow_up_id),
    FOREIGN KEY (follow_up_id) REFERENCES medical_record_follow_ups(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: vaccine_types
-- MongoDB Collection: vaccinetypes
-- ============================================================
-- Reference table of known vaccines that can be administered.
-- Seeded on server startup via seedVaccineTypes().
-- Managed by clinic admins at /clinic-admin/vaccine-types.
-- Unique constraint: name + species combination.
--
-- INPUTS: name, species[], validityDays, isSeries, totalSeries,
--   seriesIntervalDays, boosterValid, boosterIntervalDays,
--   minAgeMonths, minAgeUnit, maxAgeMonths, maxAgeUnit,
--   route, doseVolumeMl, pricePerDose,
--   defaultManufacturer, defaultBatchNumber
-- OUTPUTS: All fields. Used in vaccination creation form.
-- ============================================================
CREATE TABLE vaccine_types (
    _id                     CHAR(24)        PRIMARY KEY,
    name                    VARCHAR(255)    NOT NULL,
    species                 VARCHAR(100)    NOT NULL,           -- JSON array; enum: dog|cat|all
    validity_days           INT             NOT NULL,
    -- Series configuration
    is_series               BOOLEAN         NOT NULL DEFAULT FALSE,
    total_series            INT             NOT NULL DEFAULT 3, -- number of doses in series
    series_interval_days    INT             NOT NULL DEFAULT 21,-- days between doses
    -- Booster configuration
    booster_valid           BOOLEAN         NOT NULL DEFAULT FALSE,
    booster_interval_days   INT             DEFAULT NULL,
    -- Age restrictions
    min_age_months          INT             NOT NULL DEFAULT 0,
    min_age_unit            ENUM('weeks', 'months') NOT NULL DEFAULT 'months',
    max_age_months          INT             DEFAULT NULL,
    max_age_unit            ENUM('weeks', 'months') NOT NULL DEFAULT 'months',
    -- Administration
    route                   VARCHAR(50)     DEFAULT NULL,
    dose_volume_ml          DECIMAL(5,2)    DEFAULT NULL,       -- mL; dog=1.0, cat=0.5, both=NULL
    -- Metadata
    price_per_dose          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    default_manufacturer    VARCHAR(255)    DEFAULT NULL,
    default_batch_number    VARCHAR(255)    DEFAULT NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_name_species (name, species),
    INDEX idx_is_active (is_active)
);


-- ============================================================
-- TABLE: vaccinations
-- MongoDB Collection: vaccinations
-- ============================================================
-- Stores individual vaccination records for pets.
-- Status auto-computed by pre-save hook.
--
-- STATUS STATE MACHINE:
--   pending  -> dateAdministered is null
--   active   -> administered, not expired, nextDueDate not past
--   overdue  -> nextDueDate < now
--   expired  -> expiryDate < now
--
-- INPUTS: petId, vetId, clinicId, clinicBranchId, appointmentId,
--   medicalRecordId, vaccineTypeId, vaccineName, manufacturer,
--   batchNumber, route, administeredDoseMl, dateAdministered,
--   expiryDate, nextDueDate, doseNumber, boosterNumber, notes
-- OUTPUTS: All fields. Used in pet vaccine history.
-- ============================================================
CREATE TABLE vaccinations (
    _id                     CHAR(24)        PRIMARY KEY,
    pet_id                  CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id                  CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id               CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id        CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    appointment_id          CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    medical_record_id       CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    booster_appointment_id  CHAR(24)        DEFAULT NULL,           -- FK to appointments._id (next booster appt)
    dose_number             INT             NOT NULL DEFAULT 1,     -- Sequential dose number across all records (min 1)
    booster_number          INT             NOT NULL DEFAULT 0,     -- 0 = still in series; 1+ = booster number
    vaccine_type_id         CHAR(24)        DEFAULT NULL,           -- FK to vaccine_types._id
    vaccine_name            VARCHAR(255)    NOT NULL,
    manufacturer            VARCHAR(255)    NOT NULL DEFAULT '',
    batch_number            VARCHAR(255)    NOT NULL DEFAULT '',
    route                   ENUM('subcutaneous', 'intramuscular', 'intranasal', 'oral') DEFAULT NULL,
    administered_dose_ml    DECIMAL(6,3)    DEFAULT NULL,           -- mL actually administered
    date_administered       DATE            DEFAULT NULL,           -- NULL = pending
    expiry_date             DATE            DEFAULT NULL,
    next_due_date           DATE            DEFAULT NULL,
    status                  ENUM('active', 'expired', 'overdue', 'pending') NOT NULL DEFAULT 'pending',
    is_up_to_date           BOOLEAN         NOT NULL DEFAULT TRUE,  -- Backward-compat (true when status=active)
    notes                   TEXT            NOT NULL DEFAULT '',
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_date (pet_id, date_administered DESC),
    INDEX idx_status_due (status, next_due_date),
    INDEX idx_pet_vaccine_dose (pet_id, vaccine_type_id, dose_number DESC),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (booster_appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (vaccine_type_id) REFERENCES vaccine_types(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: confinement_records
-- MongoDB Collection: confinementrecords
-- ============================================================
-- Tracks inpatient/confinement stays for pets.
-- Status: admitted -> discharged
-- Release request workflow allows owners to request early discharge.
--
-- INPUTS: petId, vetId, clinicId, clinicBranchId, appointmentId,
--   reason, notes, admissionDate
-- OUTPUTS: All fields. Used in vet dashboard patient management.
-- ============================================================
CREATE TABLE confinement_records (
    _id                             CHAR(24)        PRIMARY KEY,
    pet_id                          CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id                          CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id                       CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id                CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    appointment_id                  CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    billing_id                      CHAR(24)        DEFAULT NULL,           -- FK to billing._id
    reason                          TEXT            NOT NULL,
    notes                           TEXT            NOT NULL DEFAULT '',
    admission_date                  DATETIME        NOT NULL,
    discharge_date                  DATETIME        DEFAULT NULL,           -- NULL = still admitted
    status                          ENUM('admitted', 'discharged') NOT NULL DEFAULT 'admitted',
    release_request_status          ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none',
    release_requested_by_owner_id   CHAR(24)        DEFAULT NULL,           -- FK to users._id (pet owner)
    release_requested_at            DATETIME        DEFAULT NULL,
    release_confirmed_by_vet_id     CHAR(24)        DEFAULT NULL,           -- FK to users._id (vet)
    release_confirmed_at            DATETIME        DEFAULT NULL,
    created_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_admission (pet_id, admission_date DESC),
    INDEX idx_status_clinic (status, clinic_id),
    INDEX idx_billing_id (billing_id),
    INDEX idx_release_request_status (release_request_status),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_id) REFERENCES billing(_id) ON DELETE SET NULL,
    FOREIGN KEY (release_requested_by_owner_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (release_confirmed_by_vet_id) REFERENCES users(_id) ON DELETE SET NULL
);

-- Sub-table: associated medical record IDs for a confinement (embedded array in MongoDB)
CREATE TABLE confinement_medical_records (
    _id                     CHAR(24)    PRIMARY KEY,
    confinement_record_id   CHAR(24)    NOT NULL,               -- FK to confinement_records._id
    medical_record_id       CHAR(24)    NOT NULL,               -- FK to medical_records._id

    INDEX idx_confinement_id (confinement_record_id),
    FOREIGN KEY (confinement_record_id) REFERENCES confinement_records(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: confinement_monitoring_entries
-- MongoDB Collection: confinementmonitoringentries
-- ============================================================
-- Periodic vitals monitoring entries recorded during confinement.
-- Entry types: daily (routine) or spot (triggered by concern).
-- Out-of-range values require an editReason override.
--
-- INPUTS: confinementRecordId, petId, medicalRecordId, recordedAt,
--   entryType, temperature, heartRate, respiratoryRate, weight,
--   hydrationStatus, appetite, painScore, clinicalNotes,
--   clinicalFlag, followUpAction, followUpInHours, optional vitals
-- OUTPUTS: All fields. Used in confinement monitoring dashboard.
-- ============================================================
CREATE TABLE confinement_monitoring_entries (
    _id                         CHAR(24)        PRIMARY KEY,
    confinement_record_id       CHAR(24)        NOT NULL,               -- FK to confinement_records._id
    pet_id                      CHAR(24)        NOT NULL,               -- FK to pets._id
    medical_record_id           CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    recorded_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entry_type                  ENUM('daily', 'spot') NOT NULL,
    recorder_id                 CHAR(24)        NOT NULL,               -- FK to users._id
    recorder_role               ENUM('veterinarian', 'clinic-admin') NOT NULL,
    -- Required vitals (value + unit)
    temperature_value           DECIMAL(5,2)    NOT NULL,
    temperature_unit            VARCHAR(10)     NOT NULL DEFAULT '°C',
    heart_rate_value            DECIMAL(6,2)    NOT NULL,
    heart_rate_unit             VARCHAR(10)     NOT NULL DEFAULT 'bpm',
    respiratory_rate_value      DECIMAL(6,2)    NOT NULL,
    respiratory_rate_unit       VARCHAR(10)     NOT NULL DEFAULT 'bpm',
    weight_value                DECIMAL(6,2)    NOT NULL,
    weight_unit                 VARCHAR(10)     NOT NULL DEFAULT 'kg',
    hydration_status            VARCHAR(80)     NOT NULL,
    appetite                    VARCHAR(80)     NOT NULL,
    pain_score                  TINYINT         NOT NULL,               -- 0-10
    -- Optional vitals (NULL if not measured)
    capillary_refill_time_value DECIMAL(4,2)    DEFAULT NULL,
    capillary_refill_time_unit  VARCHAR(10)     DEFAULT NULL,
    spo2_value                  DECIMAL(5,2)    DEFAULT NULL,
    spo2_unit                   VARCHAR(10)     DEFAULT NULL,
    blood_glucose_value         DECIMAL(6,2)    DEFAULT NULL,
    blood_glucose_unit          VARCHAR(10)     DEFAULT NULL,
    blood_pressure_systolic_value   DECIMAL(6,2) DEFAULT NULL,
    blood_pressure_systolic_unit    VARCHAR(10)  DEFAULT NULL,
    blood_pressure_diastolic_value  DECIMAL(6,2) DEFAULT NULL,
    blood_pressure_diastolic_unit   VARCHAR(10)  DEFAULT NULL,
    -- Clinical assessment
    clinical_notes              TEXT            NOT NULL,               -- max 4000 chars
    clinical_flag               ENUM('normal', 'abnormal', 'critical') NOT NULL DEFAULT 'normal',
    follow_up_action            ENUM('watch', 'recheck', 'escalate', 'medication_adjustment', 'diagnostics') NOT NULL,
    follow_up_in_hours          SMALLINT        DEFAULT NULL,           -- 1-168; required when follow_up_action='recheck'
    requires_immediate_review   BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Alert resolution
    alert_resolved              BOOLEAN         NOT NULL DEFAULT FALSE,
    alert_resolved_at           DATETIME        DEFAULT NULL,
    alert_resolved_by           CHAR(24)        DEFAULT NULL,           -- FK to users._id
    -- Audit
    created_by                  CHAR(24)        NOT NULL,               -- FK to users._id
    updated_by                  CHAR(24)        NOT NULL,               -- FK to users._id
    edit_reason                 VARCHAR(300)    NOT NULL DEFAULT '',    -- Required for out-of-range values
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_confinement_recorded (confinement_record_id, recorded_at DESC),
    INDEX idx_pet_id (pet_id),
    INDEX idx_entry_type (entry_type),
    INDEX idx_clinical_flag (clinical_flag),
    INDEX idx_requires_review (requires_immediate_review),
    INDEX idx_alert_resolved (alert_resolved),
    FOREIGN KEY (confinement_record_id) REFERENCES confinement_records(_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (recorder_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_resolved_by) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: product_services
-- MongoDB Collection: productservices
-- ============================================================
-- Catalog of billable products and services offered by the clinic.
-- Used as line items when creating billing records.
-- Branch-level availability is tracked via embedded branchAvailability.
--
-- INPUTS: name, type, category, price, description,
--   administrationRoute, administrationMethod, dosing fields, etc.
-- OUTPUTS: All fields. Used in billing creation form.
-- ============================================================
CREATE TABLE product_services (
    _id                     CHAR(24)        PRIMARY KEY,
    name                    VARCHAR(255)    NOT NULL,
    type                    ENUM('Service', 'Product') NOT NULL,
    category                ENUM('Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries',
                                 'Pregnancy Delivery', 'General Consultation', 'Grooming', 'Others')
                                            NOT NULL DEFAULT 'Others',
    price                   DECIMAL(10,2)   NOT NULL,
    description             TEXT            NOT NULL DEFAULT '',
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    is_system_product       BOOLEAN         NOT NULL DEFAULT FALSE,   -- System-seeded, cannot be deleted
    administration_route    ENUM('oral', 'topical', 'injection', 'preventive') DEFAULT NULL,
    administration_method   ENUM('tablets', 'capsules', 'syrup', 'skin', 'ears', 'eyes', 'wounds',
                                 'iv', 'im', 'sc', 'spot-on', 'chewable') DEFAULT NULL,
    net_content             DECIMAL(10,4)   DEFAULT NULL,           -- mg per tablet/capsule or mL per vial/dose
    dose_per_kg             DECIMAL(10,4)   DEFAULT NULL,
    dose_unit               VARCHAR(20)     DEFAULT NULL,
    dose_concentration      DECIMAL(10,4)   DEFAULT NULL,           -- mg/mL for injections
    dosage_amount           VARCHAR(50)     DEFAULT NULL,           -- computed guide value e.g. "500mg"
    frequency_notes         TEXT            DEFAULT NULL,
    frequency               TINYINT         DEFAULT NULL,
    frequency_label         VARCHAR(100)    DEFAULT NULL,
    duration                SMALLINT        DEFAULT NULL,
    duration_label          VARCHAR(100)    DEFAULT NULL,
    interval_days           SMALLINT        DEFAULT NULL,
    weight_min              DECIMAL(6,2)    DEFAULT NULL,
    weight_max              DECIMAL(6,2)    DEFAULT NULL,
    associated_service_id   CHAR(24)        DEFAULT NULL,           -- FK to product_services._id (self-ref)
    preventive_duration     SMALLINT        DEFAULT NULL,
    preventive_duration_unit ENUM('months', 'years') DEFAULT NULL,
    pricing_type            ENUM('singlePill', 'pack') NOT NULL DEFAULT 'singlePill',
    pieces_per_pack         INT             DEFAULT NULL,
    injection_pricing_type  ENUM('singleDose', 'mlPerKg') DEFAULT NULL,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type),
    INDEX idx_is_active (is_active),
    INDEX idx_name_category_route_method (name, category, administration_route, administration_method),
    FOREIGN KEY (associated_service_id) REFERENCES product_services(_id) ON DELETE SET NULL
);

-- Sub-table: branch-level availability for a product/service (embedded array in MongoDB)
CREATE TABLE product_service_branch_availability (
    _id                 CHAR(24)    PRIMARY KEY,
    product_service_id  CHAR(24)    NOT NULL,               -- FK to product_services._id
    branch_id           CHAR(24)    NOT NULL,               -- FK to clinic_branches._id
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    INDEX idx_product_service_id (product_service_id),
    INDEX idx_branch_id (branch_id),
    FOREIGN KEY (product_service_id) REFERENCES product_services(_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: billing
-- MongoDB Collection: billings
-- ============================================================
-- Stores invoice/billing records for veterinary services.
-- STATUS LIFECYCLE: pending_payment -> paid
-- QR payment proof goes through a pendingQrApproval flag.
--
-- INPUTS: ownerId, petId, vetId, clinicId, clinicBranchId,
--   medicalRecordId, confinementRecordId, appointmentId,
--   items[], subtotal, discount, totalAmountDue, serviceLabel, serviceDate
-- OUTPUTS: All fields + owner/vet/clinic info.
-- ============================================================
CREATE TABLE billing (
    _id                         CHAR(24)        PRIMARY KEY,
    owner_id                    CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    pet_id                      CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id                      CHAR(24)        DEFAULT NULL,           -- FK to users._id (veterinarian); nullable
    clinic_id                   CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id            CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    medical_record_id           CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    confinement_record_id       CHAR(24)        DEFAULT NULL,           -- FK to confinement_records._id
    appointment_id              CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    subtotal                    DECIMAL(10,2)   NOT NULL,
    discount                    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    total_amount_due            DECIMAL(10,2)   NOT NULL,
    status                      ENUM('pending_payment', 'paid') NOT NULL DEFAULT 'pending_payment',
    paid_at                     DATETIME        DEFAULT NULL,
    amount_paid                 DECIMAL(10,2)   DEFAULT NULL,
    payment_method              ENUM('cash', 'card', 'qr') DEFAULT NULL,
    service_label               VARCHAR(500)    NOT NULL DEFAULT '',
    service_date                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    qr_payment_proof            TEXT            DEFAULT NULL,           -- Base64 image of payment proof
    qr_payment_submitted_at     DATETIME        DEFAULT NULL,
    pending_qr_approval         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owner (owner_id, created_at DESC),
    INDEX idx_vet_status (vet_id, status, created_at DESC),
    INDEX idx_clinic_status (clinic_id, status, created_at DESC),
    INDEX idx_pet_id (pet_id),
    INDEX idx_medical_record_id (medical_record_id),
    INDEX idx_confinement_record_id (confinement_record_id),
    INDEX idx_appointment_id (appointment_id),
    INDEX idx_status (status),
    INDEX idx_pending_qr_approval (pending_qr_approval),
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (confinement_record_id) REFERENCES confinement_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL
);

-- Sub-table: billing line items (embedded array in MongoDB)
CREATE TABLE billing_items (
    _id                 CHAR(24)        PRIMARY KEY,
    billing_id          CHAR(24)        NOT NULL,               -- FK to billing._id
    product_service_id  CHAR(24)        DEFAULT NULL,           -- FK to product_services._id
    vaccine_type_id     CHAR(24)        DEFAULT NULL,           -- FK to vaccine_types._id (for vaccine line items)
    name                VARCHAR(255)    NOT NULL,               -- Snapshot of name at billing time
    type                ENUM('Service', 'Product') NOT NULL,
    unit_price          DECIMAL(10,2)   NOT NULL,
    quantity            DECIMAL(10,2)   NOT NULL DEFAULT 1,

    INDEX idx_billing_id (billing_id),
    FOREIGN KEY (billing_id) REFERENCES billing(_id) ON DELETE CASCADE,
    FOREIGN KEY (product_service_id) REFERENCES product_services(_id) ON DELETE SET NULL,
    FOREIGN KEY (vaccine_type_id) REFERENCES vaccine_types(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: payment_qr
-- MongoDB Collection: paymentqrs
-- ============================================================
-- Stores QR code images for clinic payment methods (GCash, PayMaya, etc.).
-- ============================================================
CREATE TABLE payment_qr (
    _id         CHAR(24)        PRIMARY KEY,
    label       VARCHAR(255)    NOT NULL,               -- e.g. 'GCash', 'PayMaya'
    image_data  LONGTEXT        NOT NULL,               -- Base64 data URL
    clinic_id   CHAR(24)        DEFAULT NULL,           -- FK to clinics._id
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_clinic_id (clinic_id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: ownership_transfers
-- MongoDB Collection: ownershiptransfers
-- ============================================================
-- Audit trail for pet ownership transfers between users.
-- ============================================================
CREATE TABLE ownership_transfers (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    old_owner_id        CHAR(24)        NOT NULL,               -- FK to users._id (previous owner)
    new_owner_id        CHAR(24)        NOT NULL,               -- FK to users._id (new owner)
    transfer_date       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    records_transferred BOOLEAN         NOT NULL DEFAULT TRUE,  -- Whether medical records were shared
    transferred_by      CHAR(24)        NOT NULL,               -- FK to users._id (who initiated transfer)
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_id (pet_id),
    INDEX idx_old_owner_id (old_owner_id),
    INDEX idx_new_owner_id (new_owner_id),
    INDEX idx_transfer_date (transfer_date),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (old_owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (new_owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (transferred_by) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: referrals
-- MongoDB Collection: referrals
-- ============================================================
-- Tracks vet-to-vet patient referrals between clinic branches.
-- STATUS: pending -> accepted | declined
-- ============================================================
CREATE TABLE referrals (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    medical_record_id   CHAR(24)        NOT NULL,               -- FK to medical_records._id
    referring_vet_id    CHAR(24)        NOT NULL,               -- FK to users._id
    referred_vet_id     CHAR(24)        NOT NULL,               -- FK to users._id
    referring_branch_id CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    referred_branch_id  CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    reason              TEXT            NOT NULL,
    status              ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE,
    FOREIGN KEY (referring_vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (referred_vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (referring_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (referred_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: vet_reports
-- MongoDB Collection: vetreports
-- ============================================================
-- Comprehensive clinical reports generated by vets (optionally AI-assisted).
-- Can be shared with the pet owner.
-- STATUS: draft -> finalized
-- ============================================================
CREATE TABLE vet_reports (
    _id                         CHAR(24)        PRIMARY KEY,
    pet_id                      CHAR(24)        NOT NULL,               -- FK to pets._id
    medical_record_id           CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    vet_id                      CHAR(24)        NOT NULL,               -- FK to users._id
    clinic_id                   CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id            CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    title                       VARCHAR(255)    NOT NULL DEFAULT '',
    report_date                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vet_context_notes           TEXT            NOT NULL DEFAULT '',
    -- Report sections
    section_clinical_summary        TEXT        NOT NULL DEFAULT '',
    section_laboratory_interpretation TEXT      NOT NULL DEFAULT '',
    section_diagnostic_integration  TEXT        NOT NULL DEFAULT '',
    section_assessment              TEXT        NOT NULL DEFAULT '',
    section_management_plan         TEXT        NOT NULL DEFAULT '',
    section_prognosis               TEXT        NOT NULL DEFAULT '',
    is_ai_generated             BOOLEAN         NOT NULL DEFAULT FALSE,
    status                      ENUM('draft', 'finalized') NOT NULL DEFAULT 'draft',
    shared_with_owner           BOOLEAN         NOT NULL DEFAULT FALSE,
    shared_at                   DATETIME        DEFAULT NULL,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_vet_created (vet_id, created_at DESC),
    INDEX idx_pet_created (pet_id, created_at DESC),
    INDEX idx_clinic_created (clinic_id, created_at DESC),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: notifications
-- MongoDB Collection: notifications
-- ============================================================
-- In-app notifications sent to users.
-- Triggered by appointments, billing, vaccine schedules, confinement, etc.
--
-- INPUTS (auto-created by notificationService):
--   userId, type, title, message, metadata (optional JSON)
-- OUTPUTS: All fields. Shown in DashboardLayout notification bell.
-- ============================================================
CREATE TABLE notifications (
    _id         CHAR(24)        PRIMARY KEY,
    user_id     CHAR(24)        NOT NULL,                       -- FK to users._id
    type        ENUM(
                    -- Pet owner notifications
                    'appointment_scheduled', 'appointment_cancelled',
                    'appointment_completed', 'appointment_reminder',
                    'appointment_rescheduled', 'appointment_reassigned',
                    'bill_due', 'bill_paid',
                    'vaccine_due',
                    'pet_lost', 'pet_found', 'pet_tag_ready',
                    'confinement_release_confirmed',
                    'pregnancy_confirmed', 'pregnancy_due_soon', 'pregnancy_overdue',
                    -- Vet notifications
                    'vet_resignation_submitted', 'vet_resignation_approved',
                    'vet_resignation_rejected', 'vet_resigned',
                    -- Clinic admin notifications
                    'clinic_new_appointment_booked', 'clinic_appointment_cancelled',
                    'clinic_appointment_rescheduled',
                    'clinic_vet_application_submitted', 'clinic_vet_resignation_review',
                    'clinic_pet_tag_requested',
                    'clinic_invoice_paid', 'clinic_qr_payment_submitted',
                    -- Confinement
                    'confinement_release_request', 'confinement_monitoring_alert'
                ) NOT NULL,
    title       VARCHAR(255)    NOT NULL,
    message     TEXT            NOT NULL,
    read        BOOLEAN         NOT NULL DEFAULT FALSE,
    metadata    TEXT            DEFAULT NULL,                   -- JSON blob for dynamic content
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: nfc_commands
-- MongoDB Collection: nfccommands
-- ============================================================
-- Queued NFC write commands for the local PawSync NFC agent.
-- Agent polls for pending commands and writes the URL to a tag.
--
-- STATUS LIFECYCLE: pending -> in_progress -> done | failed
--
-- INPUTS (POST /api/nfc/pet/:petId/write): petId, url
-- OUTPUTS (polled by local NFC agent): All fields + result.
-- ============================================================
CREATE TABLE nfc_commands (
    _id                     CHAR(24)        PRIMARY KEY,
    pet_id                  CHAR(24)        NOT NULL,               -- FK to pets._id
    url                     TEXT            NOT NULL,               -- URL to write to the NFC tag
    status                  ENUM('pending', 'in_progress', 'done', 'failed') NOT NULL DEFAULT 'pending',
    result_uid              VARCHAR(255)    DEFAULT NULL,           -- NFC tag UID
    result_write_success    BOOLEAN         DEFAULT NULL,
    result_message          TEXT            DEFAULT NULL,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_id (pet_id),
    INDEX idx_status_created (status, created_at),              -- Poller query: pending, oldest first
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: pet_tag_requests
-- MongoDB Collection: pettagrequests
-- ============================================================
-- Tracks requests from pet owners for a new/replacement NFC tag.
-- Fulfilled by clinic staff.
--
-- STATUS LIFECYCLE: pending -> fulfilled | cancelled
--
-- INPUTS: petId, ownerId, clinicId, reason, pickupDate, clinicBranchId
-- OUTPUTS: All fields. Used in clinic admin tag request management.
-- ============================================================
CREATE TABLE pet_tag_requests (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    owner_id            CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    reason              ENUM('lost_replacement', 'upgrade', 'additional', 'other', '') DEFAULT '',
    pickup_date         DATE            DEFAULT NULL,
    status              ENUM('pending', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
    fulfilled_at        DATETIME        DEFAULT NULL,
    fulfilled_by        CHAR(24)        DEFAULT NULL,           -- FK to users._id (staff who fulfilled)
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_status (pet_id, status),
    INDEX idx_clinic_status (clinic_id, status, created_at DESC),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL,
    FOREIGN KEY (fulfilled_by) REFERENCES users(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: audit_trails
-- MongoDB Collection: audittrails
-- ============================================================
-- System-level audit log for significant actions.
-- Used for compliance and debugging.
-- ============================================================
CREATE TABLE audit_trails (
    _id                 CHAR(24)        PRIMARY KEY,
    action              VARCHAR(255)    NOT NULL,               -- Action name, e.g. 'vet_resigned'
    actor_user_id       CHAR(24)        DEFAULT NULL,           -- FK to users._id (who performed action)
    target_user_id      CHAR(24)        DEFAULT NULL,           -- FK to users._id (who was affected)
    clinic_id           CHAR(24)        DEFAULT NULL,           -- FK to clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    metadata            TEXT            NOT NULL DEFAULT '{}',  -- JSON blob for action-specific context
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_action (action),
    INDEX idx_actor_user_id (actor_user_id),
    INDEX idx_target_user_id (target_user_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_clinic_branch_id (clinic_branch_id),
    FOREIGN KEY (actor_user_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE SET NULL,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL
);


-- ============================================================
-- RELATIONSHIPS SUMMARY (29 collections, 50+ relationships)
-- ============================================================
--
--  users (pet-owner)            --1:N--> pets
--  users (pet-owner)            --1:N--> notifications
--  users (clinic-admin)         --1:N--> clinics (via users.clinic_id)
--  clinics                      --1:N--> clinic_branches
--  clinic_branches              --1:N--> clinic_branch_closure_dates
--  users (veterinarian)         --1:N--> vet_schedules (per branch)
--  users (veterinarian)         --M:N--> pets (via assigned_vets)
--  users (veterinarian)         --1:N--> vet_verifications
--  users (veterinarian)         --1:N--> vet_applications
--  users (veterinarian)         --1:N--> vet_leaves
--  users (veterinarian)         --1:N--> resignations
--  vet_verifications            --1:1--> vet_applications
--  pets                         --1:N--> appointments
--  pets                         --1:N--> medical_records
--  pets                         --1:N--> vaccinations
--  pets                         --1:N--> confinement_records
--  pets                         --1:N--> nfc_commands
--  pets                         --1:N--> pet_tag_requests
--  pets                         --1:N--> pet_scan_locations
--  pets                         --1:N--> pet_previous_owners
--  pets                         --1:1--> pet_notes
--  pets                         --1:N--> ownership_transfers
--  pets                         --1:N--> referrals
--  pets                         --1:N--> vet_reports
--  appointments                 --1:1--> medical_records (auto on check-in)
--  medical_records              --1:N--> medical_record_images
--  medical_records              --1:N--> medical_record_medications
--  medical_records              --1:N--> medical_record_diagnostic_tests
--  medical_records              --1:N--> medical_record_preventive_care
--  medical_records              --1:N--> medical_record_surgery_images
--  medical_records              --1:N--> medical_record_immunity_rows
--  medical_records              --1:N--> medical_record_antigen_rows
--  medical_records              --1:N--> medical_record_follow_ups
--  confinement_records          --1:N--> confinement_medical_records
--  confinement_records          --1:N--> confinement_monitoring_entries
--  vaccine_types                --1:N--> vaccinations
--  product_services             --1:N--> billing_items
--  product_services             --1:N--> product_service_branch_availability
--  billing                      --1:N--> billing_items
--  clinics                      --1:N--> payment_qr
--
-- ============================================================


-- ============================================================
-- SAMPLE QUERIES
-- ============================================================

-- Get all pets for a specific owner
-- SELECT * FROM pets WHERE owner_id = '<user_id>' AND removed_by_owner = FALSE;

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

-- Get pending PRC verifications for a clinic admin
-- SELECT vv.*, u.first_name AS vet_first_name, u.last_name AS vet_last_name, u.email AS vet_email
-- FROM vet_verifications vv
-- JOIN users u ON u._id = vv.vet_id
-- JOIN clinics c ON c._id = vv.clinic_id
-- WHERE c._id = '<clinic_id>' AND vv.status = 'pending'
-- ORDER BY vv.created_at DESC;

-- Get pending vet applications for a clinic
-- SELECT va.*, u.first_name, u.last_name, u.email, cb.name AS branch_name
-- FROM vet_applications va
-- JOIN users u ON u._id = va.vet_id
-- JOIN clinic_branches cb ON cb._id = va.branch_id
-- WHERE va.clinic_id = '<clinic_id>' AND va.status = 'pending'
-- ORDER BY va.created_at DESC;

-- Get medical records for a pet (most recent first), with medications
-- SELECT mr.*, meds.name AS med_name, meds.dosage, meds.status AS med_status
-- FROM medical_records mr
-- LEFT JOIN medical_record_medications meds ON meds.medical_record_id = mr._id
-- WHERE mr.pet_id = '<pet_id>'
-- ORDER BY mr.created_at DESC;

-- Get active vaccinations for a pet
-- SELECT v.*, vt.name AS vaccine_type_name
-- FROM vaccinations v
-- LEFT JOIN vaccine_types vt ON vt._id = v.vaccine_type_id
-- WHERE v.pet_id = '<pet_id>' AND v.status = 'active'
-- ORDER BY v.date_administered DESC;

-- Get all pending billing for a pet owner
-- SELECT b.*, bi.name AS item_name, bi.type AS item_type, bi.unit_price, bi.quantity
-- FROM billing b
-- JOIN billing_items bi ON bi.billing_id = b._id
-- WHERE b.owner_id = '<owner_user_id>' AND b.status = 'pending_payment'
-- ORDER BY b.created_at DESC;

-- Get unread notifications for a user
-- SELECT * FROM notifications
-- WHERE user_id = '<user_id>' AND read = FALSE
-- ORDER BY created_at DESC;

-- Get all currently admitted pets at a clinic
-- SELECT cr.*, p.name AS pet_name, u.first_name AS vet_first_name
-- FROM confinement_records cr
-- JOIN pets p ON p._id = cr.pet_id
-- JOIN users u ON u._id = cr.vet_id
-- WHERE cr.clinic_id = '<clinic_id>' AND cr.status = 'admitted';

-- Get critical monitoring entries requiring immediate review
-- SELECT cme.*, p.name AS pet_name
-- FROM confinement_monitoring_entries cme
-- JOIN pets p ON p._id = cme.pet_id
-- WHERE cme.confinement_record_id = '<confinement_id>'
--   AND cme.requires_immediate_review = TRUE
--   AND cme.alert_resolved = FALSE
-- ORDER BY cme.recorded_at DESC;

-- Get pending NFC write commands (for local agent polling)
-- SELECT * FROM nfc_commands
-- WHERE status = 'pending'
-- ORDER BY created_at ASC
-- LIMIT 1;

-- Get all pending resignations for a clinic
-- SELECT r.*, u.first_name AS vet_first_name, u.last_name AS vet_last_name,
--        bv.first_name AS backup_vet_first_name
-- FROM resignations r
-- JOIN users u ON u._id = r.vet_id
-- JOIN users bv ON bv._id = r.backup_vet_id
-- WHERE r.clinic_id = '<clinic_id>' AND r.status = 'pending'
-- ORDER BY r.submitted_at DESC;
