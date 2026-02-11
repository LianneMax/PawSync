-- ============================================================
-- PawSync Database Schema (SQL Mapping of MongoDB Collections)
-- ============================================================
-- This file maps out the MongoDB collections as relational tables
-- for documentation and planning purposes.
-- MongoDB Collection → SQL Table
-- ============================================================


-- ============================================================
-- TABLE: users
-- MongoDB Collection: users
-- ============================================================
-- Stores all users: pet owners, veterinarians
--
-- INPUTS (Registration):
--   email, password, firstName, lastName, userType
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
    user_type           ENUM('pet-owner', 'veterinarian')
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
-- TABLE: pets
-- MongoDB Collection: pets
-- ============================================================
-- Stores all pet profiles belonging to pet owners.
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
    photo               VARCHAR(500)    DEFAULT NULL,           -- Photo URL/path
    notes               TEXT            DEFAULT NULL,           -- Markings, color, etc.
    allergies           TEXT            DEFAULT NULL,           -- JSON array stored as text: ["Chicken","Eggs"]
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
-- Junction table: assigns a veterinarian to a pet.
-- Tracks which vet is responsible for which pet at which clinic.
--
-- INPUTS (Assign Vet to Pet):
--   vetId, petId, clinicName, clinicAddress (optional)
--
-- OUTPUTS (API Response):
--   Populated with vet user info (name, email) and pet info.
--   Used in dashboard vet card, pet detail view.
-- ============================================================
CREATE TABLE assigned_vets (
    _id                 CHAR(24)        PRIMARY KEY,            -- MongoDB ObjectId
    vet_id              CHAR(24)        NOT NULL,               -- FK → users._id (veterinarian)
    pet_id              CHAR(24)        NOT NULL,               -- FK → pets._id
    clinic_name         VARCHAR(255)    NOT NULL,               -- Clinic name
    clinic_address      VARCHAR(500)    DEFAULT NULL,           -- Clinic address
    assigned_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,  -- Active assignment flag
    last_visit          DATETIME        DEFAULT NULL,           -- Last vet visit date
    next_visit          DATETIME        DEFAULT NULL,           -- Next scheduled visit date
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_vet_pet (vet_id, pet_id),                  -- One vet-pet assignment at a time
    INDEX idx_vet_id (vet_id),
    INDEX idx_pet_id (pet_id),
    FOREIGN KEY (vet_id) REFERENCES users(_id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(_id) ON DELETE CASCADE
);


-- ============================================================
-- RELATIONSHIPS SUMMARY
-- ============================================================
--
--  users (pet-owner) ──1:N──► pets
--      A pet owner can have many pets.
--      Each pet belongs to exactly one owner.
--
--  users (veterinarian) ──M:N──► pets  (via assigned_vets)
--      A vet can be assigned to many pets.
--      A pet can have many vets (but unique per vet-pet pair).
--
--  ┌──────────┐       ┌──────────┐       ┌──────────┐
--  │  users   │──1:N─►│   pets   │◄─M:N──│  users   │
--  │(pet-owner)│       │          │       │  (vet)   │
--  └──────────┘       └──────────┘       └──────────┘
--                          │                   │
--                          └───────┬───────────┘
--                                  │
--                           ┌──────────┐
--                           │ assigned_vets │
--                           │(junction)│
--                           └──────────┘
--
-- ============================================================


-- ============================================================
-- SAMPLE QUERIES
-- ============================================================

-- Get all pets for a specific owner
-- SELECT * FROM pets WHERE owner_id = '<user_id>';

-- Get a pet's assigned vet with clinic info
-- SELECT u.first_name, u.last_name, u.email, vp.clinic_name, vp.clinic_address, vp.last_visit, vp.next_visit
-- FROM assigned_vets vp
-- JOIN users u ON u._id = vp.vet_id
-- WHERE vp.pet_id = '<pet_id>' AND vp.is_active = TRUE;

-- Get all pets assigned to a vet
-- SELECT p.*, vp.clinic_name, vp.last_visit, vp.next_visit
-- FROM assigned_vets vp
-- JOIN pets p ON p._id = vp.pet_id
-- WHERE vp.vet_id = '<vet_user_id>' AND vp.is_active = TRUE;

-- Look up a pet by NFC tag
-- SELECT p.*, u.first_name AS owner_first_name, u.last_name AS owner_last_name
-- FROM pets p
-- JOIN users u ON u._id = p.owner_id
-- WHERE p.nfc_tag_id = '<nfc_tag_id>';
