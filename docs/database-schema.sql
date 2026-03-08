-- ============================================================
-- PawSync Database Schema (SQL Mapping of MongoDB Collections)
-- ============================================================
-- This file maps out the MongoDB collections as relational tables
-- for documentation, ERD generation, and planning purposes.
-- MongoDB Collection -> SQL Table
-- Last updated: 2026-03-08
-- ============================================================


-- ============================================================
-- TABLE: users
-- MongoDB Collection: users
-- ============================================================
-- Stores all users: pet owners, veterinarians, clinic admins,
-- and branch admins.
--
-- INPUTS (Registration):
--   email, password (optional for Google users), firstName, lastName,
--   contactNumber, userType, clinicName (clinic-admin only)
--
-- OUTPUTS (API Response):
--   id, email, firstName, lastName, contactNumber, userType,
--   isVerified, emailVerified, clinicId, clinicBranchId, createdAt
--   (password, resetOtp, resetOtpExpires, emailVerificationToken
--    are NEVER returned)
-- ============================================================
CREATE TABLE users (
    _id                         CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    email                       VARCHAR(255)    NOT NULL UNIQUE,        -- Lowercase, validated format
    password                    VARCHAR(255)    DEFAULT NULL,           -- Bcrypt hashed; NULL for Google-only accounts
    first_name                  VARCHAR(255)    NOT NULL,
    last_name                   VARCHAR(255)    NOT NULL,
    contact_number              VARCHAR(50)     DEFAULT NULL,
    user_type                   ENUM('pet-owner', 'veterinarian', 'clinic-admin', 'branch-admin')
                                                NOT NULL,
    clinic_id                   CHAR(24)        DEFAULT NULL,           -- FK to clinics._id (for vet/branch-admin)
    clinic_branch_id            CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id (for branch-admin)
    branch_id                   CHAR(24)        DEFAULT NULL,           -- Alias of clinic_branch_id (legacy)
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
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_clinic_id (clinic_id),
    UNIQUE INDEX idx_google_id (google_id)          -- Sparse: only unique when non-null
);


-- ============================================================
-- TABLE: clinics
-- MongoDB Collection: clinics
-- ============================================================
-- Stores veterinary clinic organizations.
-- Auto-created when a clinic-admin registers.
--
-- INPUTS (Auto-created on clinic-admin signup):
--   name, adminId, email, mainBranchId (set after main branch created)
--
-- OUTPUTS (API Response):
--   All fields. Used in vet onboarding clinic selection,
--   clinic admin dashboard.
-- ============================================================
CREATE TABLE clinics (
    _id                 CHAR(24)        PRIMARY KEY,
    name                VARCHAR(255)    NOT NULL,
    admin_id            CHAR(24)        NOT NULL,               -- FK to users._id (clinic-admin)
    main_branch_id      CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    logo                TEXT            DEFAULT NULL,           -- Base64 data URL of clinic logo
    address             VARCHAR(500)    DEFAULT NULL,
    phone               VARCHAR(50)     DEFAULT NULL,
    email               VARCHAR(255)    DEFAULT NULL,           -- Lowercase
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_admin_id (admin_id),
    FOREIGN KEY (admin_id) REFERENCES users(_id) ON DELETE CASCADE,
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
--   openingTime, closingTime, operatingDays[], isMain
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
    operating_days      VARCHAR(255)    DEFAULT '[]',           -- JSON array; enum: Mon|Tue|Wed|Thu|Fri|Sat|Sun
    is_main             BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_clinic_id (clinic_id),
    UNIQUE INDEX idx_clinic_main (clinic_id, is_main),          -- Partial: isMain=true only
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
--   ownerId, name, species, breed, secondaryBreed, sex, dateOfBirth,
--   weight, sterilization, microchipNumber, bloodType, photo, notes, allergies
--
-- OUTPUTS (API Response):
--   All fields. Used in dashboard pet cards, my-pets page,
--   vet patient lists, NFC tag lookups, lost pet profile.
-- ============================================================
CREATE TABLE pets (
    _id                         CHAR(24)        PRIMARY KEY,
    owner_id                    CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    name                        VARCHAR(255)    NOT NULL,
    species                     ENUM('dog', 'cat') NOT NULL,
    breed                       VARCHAR(255)    NOT NULL,
    secondary_breed             VARCHAR(255)    DEFAULT NULL,
    sex                         ENUM('male', 'female') NOT NULL,
    date_of_birth               DATE            NOT NULL,
    weight                      DECIMAL(5,2)    NOT NULL,               -- kg
    sterilization               ENUM('yes', 'no', 'unknown') NOT NULL,
    microchip_number            VARCHAR(255)    DEFAULT NULL,
    nfc_tag_id                  VARCHAR(255)    DEFAULT NULL,           -- PawSync NFC tag identifier
    qr_code                     TEXT            DEFAULT NULL,           -- QR code data URL or identifier
    photo                       TEXT            DEFAULT NULL,           -- Base64 data URL
    notes                       TEXT            DEFAULT NULL,
    blood_type                  VARCHAR(50)     DEFAULT NULL,
    allergies                   TEXT            DEFAULT '[]',           -- JSON array: ['Chicken','Eggs']
    is_lost                     BOOLEAN         NOT NULL DEFAULT FALSE,
    lost_contact_name           VARCHAR(255)    DEFAULT NULL,
    lost_contact_number         VARCHAR(50)     DEFAULT NULL,
    lost_message                TEXT            DEFAULT NULL,
    lost_reported_by_stranger   BOOLEAN         NOT NULL DEFAULT FALSE,
    is_confined                 BOOLEAN         NOT NULL DEFAULT FALSE,
    confined_since              DATETIME        DEFAULT NULL,
    last_scanned_lat            DECIMAL(10,7)   DEFAULT NULL,
    last_scanned_lng            DECIMAL(10,7)   DEFAULT NULL,
    last_scanned_at             DATETIME        DEFAULT NULL,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owner_id (owner_id),
    INDEX idx_nfc_tag_id (nfc_tag_id),
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE
);

-- Sub-table for pet NFC scan location history (embedded array in MongoDB)
CREATE TABLE pet_scan_locations (
    _id         CHAR(24)        PRIMARY KEY,
    pet_id      CHAR(24)        NOT NULL,               -- FK to pets._id
    lat         DECIMAL(10,7)   NOT NULL,
    lng         DECIMAL(10,7)   NOT NULL,
    scanned_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_pet_id (pet_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE
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
-- TABLE: appointments
-- MongoDB Collection: appointments
-- ============================================================
-- Stores pet appointments booked at a clinic.
-- Status lifecycle: pending -> confirmed -> in_progress -> completed | cancelled
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
    types               VARCHAR(1000)   NOT NULL,
        -- JSON array of one or more:
        --   consultation | general-checkup | primary-treatment |
        --   vaccination | puppy-litter-vaccination | deworming |
        --   cbc | blood-chemistry-16 | pcr-test | x-ray | ultrasound |
        --   abdominal-surgery | orthopedic-surgery | dental-scaling |
        --   laser-therapy | inpatient-care | outpatient-treatment |
        --   point-of-care-diagnostic | basic-grooming | full-grooming
    date                DATE            NOT NULL,
    start_time          VARCHAR(10)     NOT NULL,               -- e.g. '07:00'
    end_time            VARCHAR(10)     NOT NULL,               -- e.g. '07:30'
    status              ENUM('pending', 'confirmed', 'in_progress', 'cancelled', 'completed')
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
    INDEX idx_status (status),
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
--   - One record per appointmentId (409 on duplicate)
--
-- INPUTS: petId, vetId, clinicId, clinicBranchId, appointmentId,
--   stage, chiefComplaint, vitals, SOAP notes, visitSummary, vetNotes,
--   overallObservation, medications[], diagnosticTests[], preventiveCare[],
--   images[], sharedWithOwner, confinementAction, confinementDays
-- OUTPUTS: All fields (private by default).
-- ============================================================
CREATE TABLE medical_records (
    _id                         CHAR(24)        PRIMARY KEY,
    pet_id                      CHAR(24)        NOT NULL,       -- FK to pets._id
    vet_id                      CHAR(24)        NOT NULL,       -- FK to users._id (veterinarian)
    clinic_id                   CHAR(24)        NOT NULL,       -- FK to clinics._id
    clinic_branch_id            CHAR(24)        NOT NULL,       -- FK to clinic_branches._id
    appointment_id              CHAR(24)        DEFAULT NULL,   -- FK to appointments._id
    billing_id                  CHAR(24)        DEFAULT NULL,   -- FK to billing._id
    stage                       ENUM('pre_procedure', 'in_procedure', 'post_procedure', 'completed')
                                                NOT NULL DEFAULT 'pre_procedure',
    chief_complaint             TEXT            DEFAULT '',
    -- Vitals (10 entries, each has value + notes)
    vitals_weight_value         VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_weight_notes         TEXT            DEFAULT '',
    vitals_temperature_value    VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_temperature_notes    TEXT            DEFAULT '',
    vitals_pulse_rate_value     VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_pulse_rate_notes     TEXT            DEFAULT '',
    vitals_spo2_value           VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_spo2_notes           TEXT            DEFAULT '',
    vitals_bcs_value            VARCHAR(50)     NOT NULL DEFAULT '',  -- Body Condition Score 1-5
    vitals_bcs_notes            TEXT            DEFAULT '',
    vitals_dental_value         VARCHAR(50)     NOT NULL DEFAULT '',  -- Dental Score 1-3
    vitals_dental_notes         TEXT            DEFAULT '',
    vitals_crt_value            VARCHAR(50)     NOT NULL DEFAULT '',  -- Capillary Refill Time
    vitals_crt_notes            TEXT            DEFAULT '',
    vitals_pregnancy_value      VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_pregnancy_notes      TEXT            DEFAULT '',
    vitals_xray_value           VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_xray_notes           TEXT            DEFAULT '',
    vitals_vaccinated_value     VARCHAR(50)     NOT NULL DEFAULT '',
    vitals_vaccinated_notes     TEXT            DEFAULT '',
    -- SOAP notes
    subjective                  TEXT            DEFAULT '',     -- S: Patient history / owner complaint
    assessment                  TEXT            DEFAULT '',     -- A: Diagnosis / clinical assessment
    plan                        TEXT            DEFAULT '',     -- P: Treatment plan / next steps
    -- Summary
    visit_summary               TEXT            DEFAULT '',
    vet_notes                   TEXT            DEFAULT '',
    overall_observation         TEXT            DEFAULT '',
    -- Flags
    shared_with_owner           BOOLEAN         NOT NULL DEFAULT FALSE,
    is_current                  BOOLEAN         NOT NULL DEFAULT TRUE,
    confinement_action          ENUM('none', 'confined', 'released') NOT NULL DEFAULT 'none',
    confinement_days            INT             NOT NULL DEFAULT 0,
    created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_date (pet_id, created_at DESC),
    INDEX idx_vet_id (vet_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_appointment_id (appointment_id),
    INDEX idx_is_current (is_current),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (billing_id) REFERENCES billing(_id) ON DELETE SET NULL
);

-- Sub-table: images attached to a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_images (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,
    data                LONGBLOB        NOT NULL,
    content_type        VARCHAR(50)     NOT NULL,               -- e.g. 'image/jpeg'
    description         TEXT            DEFAULT '',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: medications prescribed in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_medications (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,
    name                VARCHAR(255)    DEFAULT '',
    dosage              VARCHAR(255)    DEFAULT '',
    route               ENUM('oral', 'topical', 'injection', 'other') NOT NULL DEFAULT 'oral',
    frequency           VARCHAR(255)    DEFAULT '',
    duration            VARCHAR(255)    DEFAULT '',
    start_date          DATE            DEFAULT NULL,
    end_date            DATE            DEFAULT NULL,
    notes               TEXT            DEFAULT '',
    status              ENUM('active', 'completed', 'discontinued') NOT NULL DEFAULT 'active',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: diagnostic tests ordered in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_diagnostic_tests (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,
    test_type           ENUM('blood_work', 'x_ray', 'ultrasound', 'urinalysis', 'ecg', 'other')
                                        NOT NULL DEFAULT 'other',
    name                VARCHAR(255)    DEFAULT '',
    date                DATE            DEFAULT NULL,
    result              TEXT            DEFAULT '',
    normal_range        VARCHAR(255)    DEFAULT '',
    notes               TEXT            DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);

-- Sub-table: preventive care administered in a medical record (embedded array in MongoDB)
CREATE TABLE medical_record_preventive_care (
    _id                 CHAR(24)        PRIMARY KEY,
    medical_record_id   CHAR(24)        NOT NULL,
    care_type           ENUM('flea', 'tick', 'heartworm', 'deworming', 'other') NOT NULL DEFAULT 'other',
    product             VARCHAR(255)    DEFAULT '',
    date_administered   DATE            DEFAULT NULL,
    next_due_date       DATE            DEFAULT NULL,
    notes               TEXT            DEFAULT '',

    INDEX idx_record_id (medical_record_id),
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: vaccine_types
-- MongoDB Collection: vaccinetypes
-- ============================================================
-- Reference table of known vaccines that can be administered.
-- Seeded on server startup via seedVaccineTypes().
-- Managed by clinic admins at /clinic-admin/vaccine-types.
--
-- INPUTS: name, species[], validityDays, requiresBooster,
--   boosterIntervalDays, minAgeMonths, route, pricePerDose,
--   defaultManufacturer, defaultBatchNumber
-- OUTPUTS: All fields. Used in vaccination creation form.
-- ============================================================
CREATE TABLE vaccine_types (
    _id                     CHAR(24)        PRIMARY KEY,
    name                    VARCHAR(255)    NOT NULL UNIQUE,
    species                 VARCHAR(100)    NOT NULL,           -- JSON array; enum: dog|cat|all
    validity_days           INT             NOT NULL,
    requires_booster        BOOLEAN         NOT NULL DEFAULT FALSE,
    booster_interval_days   INT             DEFAULT NULL,
    min_age_months          INT             NOT NULL DEFAULT 0,
    route                   VARCHAR(50)     DEFAULT NULL,
    price_per_dose          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    default_manufacturer    VARCHAR(255)    DEFAULT NULL,
    default_batch_number    VARCHAR(255)    DEFAULT NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_is_active (is_active)
);


-- ============================================================
-- TABLE: vaccinations
-- MongoDB Collection: vaccinations
-- ============================================================
-- Stores individual vaccination records for pets.
-- Status auto-computed by pre-save hook and nightly scheduler (2 AM).
-- A verifyToken (24-char HMAC-SHA256) is generated on create for QR verification.
-- Auto-draft created when appointment type includes 'vaccination'.
--
-- STATUS STATE MACHINE:
--   pending  -> dateAdministered is null
--   active   -> administered, not expired, nextDueDate not past
--   overdue  -> nextDueDate < now (nightly job)
--   expired  -> expiryDate < now (nightly job)
--   declined -> declinedAt is set
--
-- INPUTS: petId, vetId, clinicId, clinicBranchId, appointmentId,
--   medicalRecordId, vaccineTypeId, vaccineName, manufacturer,
--   batchNumber, route, dateAdministered, expiryDate, nextDueDate, notes
-- OUTPUTS: All fields. Public: /api/vaccinations/pet/:petId/public
--          Verify: /api/vaccinations/verify/:token
-- ============================================================
CREATE TABLE vaccinations (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    appointment_id      CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    medical_record_id   CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    vaccine_type_id     CHAR(24)        DEFAULT NULL,           -- FK to vaccine_types._id
    vaccine_name        VARCHAR(255)    NOT NULL,
    manufacturer        VARCHAR(255)    DEFAULT '',
    batch_number        VARCHAR(255)    DEFAULT '',
    route               ENUM('subcutaneous', 'intramuscular', 'intranasal', 'oral') DEFAULT NULL,
    date_administered   DATE            DEFAULT NULL,           -- NULL = pending
    expiry_date         DATE            DEFAULT NULL,
    next_due_date       DATE            DEFAULT NULL,
    status              ENUM('active', 'expired', 'overdue', 'pending', 'declined')
                                        NOT NULL DEFAULT 'pending',
    is_up_to_date       BOOLEAN         NOT NULL DEFAULT TRUE,  -- Backward-compat (true when status=active)
    declined_reason     TEXT            DEFAULT NULL,
    declined_by         CHAR(24)        DEFAULT NULL,           -- FK to users._id
    declined_at         DATETIME        DEFAULT NULL,
    notes               TEXT            DEFAULT '',
    verify_token        CHAR(24)        DEFAULT NULL,           -- 24-char HMAC-SHA256 for QR/URL verification
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_date (pet_id, date_administered DESC),
    INDEX idx_status_due (status, next_due_date),
    UNIQUE INDEX idx_verify_token (verify_token),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (vaccine_type_id) REFERENCES vaccine_types(_id) ON DELETE SET NULL,
    FOREIGN KEY (declined_by) REFERENCES users(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: confinement_records
-- MongoDB Collection: confinementrecords
-- ============================================================
-- Tracks inpatient/confinement stays for pets.
-- Status: admitted -> discharged
--
-- INPUTS: petId, vetId, clinicId, clinicBranchId, appointmentId,
--   reason, notes, admissionDate, dischargeDate
-- OUTPUTS: All fields. Used in vet dashboard patient management.
-- ============================================================
CREATE TABLE confinement_records (
    _id                 CHAR(24)        PRIMARY KEY,
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        DEFAULT NULL,           -- FK to clinic_branches._id
    appointment_id      CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    reason              TEXT            NOT NULL,
    notes               TEXT            DEFAULT '',
    admission_date      DATETIME        NOT NULL,
    discharge_date      DATETIME        DEFAULT NULL,           -- NULL = still admitted
    status              ENUM('admitted', 'discharged') NOT NULL DEFAULT 'admitted',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_pet_admission (pet_id, admission_date DESC),
    INDEX idx_status_clinic (status, clinic_id),
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL
);


-- ============================================================
-- TABLE: product_services
-- MongoDB Collection: productservices
-- ============================================================
-- Catalog of billable products and services offered by the clinic.
-- Used as line items when creating billing records.
--
-- INPUTS: name, type, price, description
-- OUTPUTS: All fields. Used in billing creation form.
-- ============================================================
CREATE TABLE product_services (
    _id             CHAR(24)        PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL UNIQUE,
    type            ENUM('Service', 'Product') NOT NULL,
    price           DECIMAL(10,2)   NOT NULL,
    description     TEXT            DEFAULT '',
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type),
    INDEX idx_is_active (is_active)
);


-- ============================================================
-- TABLE: billing
-- MongoDB Collection: billings
-- ============================================================
-- Stores invoice/billing records for veterinary services.
-- STATUS LIFECYCLE: awaiting_approval -> pending_payment -> paid
--
-- INPUTS: ownerId, petId, vetId, clinicId, clinicBranchId,
--   medicalRecordId, appointmentId, items[], subtotal,
--   discount, totalAmountDue, serviceLabel, serviceDate
-- OUTPUTS: All fields + owner/vet/clinic info.
-- ============================================================
CREATE TABLE billing (
    _id                 CHAR(24)        PRIMARY KEY,
    owner_id            CHAR(24)        NOT NULL,               -- FK to users._id (pet-owner)
    pet_id              CHAR(24)        NOT NULL,               -- FK to pets._id
    vet_id              CHAR(24)        NOT NULL,               -- FK to users._id (veterinarian)
    clinic_id           CHAR(24)        NOT NULL,               -- FK to clinics._id
    clinic_branch_id    CHAR(24)        NOT NULL,               -- FK to clinic_branches._id
    medical_record_id   CHAR(24)        DEFAULT NULL,           -- FK to medical_records._id
    appointment_id      CHAR(24)        DEFAULT NULL,           -- FK to appointments._id
    subtotal            DECIMAL(10,2)   NOT NULL,
    discount            DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    total_amount_due    DECIMAL(10,2)   NOT NULL,
    status              ENUM('awaiting_approval', 'pending_payment', 'paid') NOT NULL DEFAULT 'awaiting_approval',
    paid_at             DATETIME        DEFAULT NULL,
    service_label       VARCHAR(500)    DEFAULT '',
    service_date        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owner (owner_id, created_at DESC),
    INDEX idx_vet_status (vet_id, status, created_at DESC),
    INDEX idx_clinic_status (clinic_id, status, created_at DESC),
    INDEX idx_pet_id (pet_id),
    INDEX idx_medical_record_id (medical_record_id),
    INDEX idx_appointment_id (appointment_id),
    FOREIGN KEY (owner_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(_id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_branch_id) REFERENCES clinic_branches(_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(_id) ON DELETE SET NULL
);

-- Sub-table: billing line items (embedded array in MongoDB)
CREATE TABLE billing_items (
    _id                 CHAR(24)        PRIMARY KEY,
    billing_id          CHAR(24)        NOT NULL,               -- FK to billing._id
    product_service_id  CHAR(24)        NOT NULL,               -- FK to product_services._id
    name                VARCHAR(255)    NOT NULL,               -- Snapshot of name at billing time
    type                ENUM('Service', 'Product') NOT NULL,
    unit_price          DECIMAL(10,2)   NOT NULL,

    INDEX idx_billing_id (billing_id),
    FOREIGN KEY (billing_id) REFERENCES billing(_id) ON DELETE CASCADE,
    FOREIGN KEY (product_service_id) REFERENCES product_services(_id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: notifications
-- MongoDB Collection: notifications
-- ============================================================
-- In-app notifications sent to users (primarily pet owners).
-- Triggered by appointment events, billing status, vaccine schedules.
--
-- TYPES: appointment_scheduled | appointment_cancelled | appointment_completed |
--        appointment_reminder | appointment_rescheduled |
--        bill_due | bill_paid | vaccine_due | pet_lost
--
-- INPUTS (auto-created by notificationService):
--   userId, type, title, message, metadata (optional JSON)
-- OUTPUTS: All fields. Shown in DashboardLayout notification bell.
-- ============================================================
CREATE TABLE notifications (
    _id         CHAR(24)        PRIMARY KEY,
    user_id     CHAR(24)        NOT NULL,                       -- FK to users._id
    type        ENUM(
                    'appointment_scheduled', 'appointment_cancelled',
                    'appointment_completed', 'appointment_reminder',
                    'appointment_rescheduled', 'bill_due', 'bill_paid',
                    'vaccine_due', 'pet_lost'
                ) NOT NULL,
    title       VARCHAR(255)    NOT NULL,
    message     TEXT            NOT NULL,
    read        BOOLEAN         NOT NULL DEFAULT FALSE,
    metadata    TEXT            DEFAULT NULL,                   -- JSON blob
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
    INDEX idx_status_created (status, created_at),                 -- Poller query: pending, oldest first
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
-- RELATIONSHIPS SUMMARY (19 tables, 40+ relationships)
-- ============================================================
--
--  users (pet-owner)    --1:N--> pets
--  users (clinic-admin) --1:N--> clinics
--  clinics              --1:N--> clinic_branches
--  users (veterinarian) --1:N--> vet_schedules (per branch)
--  users (veterinarian) --M:N--> pets (via assigned_vets)
--  users (veterinarian) --1:N--> vet_verifications
--  users (veterinarian) --1:N--> vet_applications
--  vet_verifications    --1:1--> vet_applications
--  pets                 --1:N--> appointments
--  appointments         --1:1--> medical_records (auto on check-in)
--  pets                 --1:N--> medical_records
--  medical_records      --1:N--> medical_record_images
--  medical_records      --1:N--> medical_record_medications
--  medical_records      --1:N--> medical_record_diagnostic_tests
--  medical_records      --1:N--> medical_record_preventive_care
--  vaccine_types        --1:N--> vaccinations
--  pets                 --1:N--> vaccinations
--  pets                 --1:N--> confinement_records
--  product_services     --1:N--> billing_items
--  billing              --1:N--> billing_items
--  users (pet-owner)    --1:N--> notifications
--  pets                 --1:N--> nfc_commands
--  pets                 --1:N--> pet_tag_requests
--  pets                 --1:N--> pet_scan_locations
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

-- Get pending PRC verifications for a clinic admin
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
-- SELECT b.*, bi.name AS item_name, bi.type AS item_type, bi.unit_price
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

-- Get pending NFC write commands (for local agent polling)
-- SELECT * FROM nfc_commands
-- WHERE status = 'pending'
-- ORDER BY created_at ASC
-- LIMIT 1;
