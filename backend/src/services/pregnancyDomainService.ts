import MedicalRecord from '../models/MedicalRecord';
import Pet from '../models/Pet';
import type { PregnancyEvidenceSource } from '../models/PregnancyEvidence';
import { createNotification } from './notificationService';

type PregnancyMethod =
  | 'ultrasound'
  | 'abdominal_palpation'
  | 'clinical_observation'
  | 'external_documentation'
  | 'unknown';

type PregnancyEpisodeStatus =
  | 'none'
  | 'suspected'
  | 'probable'
  | 'confirmed'
  | 'delivered'
  | 'ended_without_delivery'
  | 'outcome_unknown';

type PregnancyConfidence = 'high' | 'medium' | 'low';

export interface PregnancyEpisode {
  status: PregnancyEpisodeStatus;
  startedAt: Date | null;
  expectedDueDate: Date | null;
  litterNumber: number | null;
  latestConfirmationMethod: PregnancyMethod;
  latestConfirmationSource: PregnancyEvidenceSource;
  confidence: PregnancyConfidence;
  deliveryDate: Date | null;
  deliveryType: string | null;
  deliveryLocation: 'in_clinic' | 'outside_clinic' | 'unknown';
  totalLiveBirths: number | null;
  totalStillBirths: number | null;
  inferredFromRecords: boolean;
}

export interface PregnancySnapshot {
  status: 'pregnant' | 'not_pregnant';
  activeEpisode: PregnancyEpisode | null;
}

interface SyncInput {
  petId: string;
  actorId: string;
  medicalRecordId: string;
  pregnancyRecord?: {
    isPregnant?: boolean;
    confirmationMethod?: PregnancyMethod;
    confirmationSource?: PregnancyEvidenceSource;
    confidence?: PregnancyConfidence;
    litterNumber?: number | null;
    expectedDueDate?: Date | string | null;
    gestationDate?: Date | string | null;
  };
  pregnancyDelivery?: {
    liveBirths?: number;
    stillBirths?: number;
    deliveryDate?: Date | string | null;
    motherCondition?: string;
  };
  pregnancyLoss?: {
    lossDate?: Date | string | null;
  };
  diagnosticTests?: Array<{
    testType?: string;
    name?: string;
  }>;
  evidenceSource?: PregnancyEvidenceSource;
}

const DEFAULT_EPISODE: PregnancyEpisode = {
  status: 'none',
  startedAt: null,
  expectedDueDate: null,
  litterNumber: null,
  latestConfirmationMethod: 'unknown',
  latestConfirmationSource: 'unknown',
  confidence: 'low',
  deliveryDate: null,
  deliveryType: null,
  deliveryLocation: 'unknown',
  totalLiveBirths: null,
  totalStillBirths: null,
  inferredFromRecords: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getGestationAgeInDays(gestationDate: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - gestationDate.getTime()) / 86400000);
}

export function getSpeciesGestationRange(species: string): { min: number; max: number } | null {
  if (species === 'canine') return { min: 58, max: 68 };
  if (species === 'feline') return { min: 58, max: 67 };
  return null;
}

function inferMethodFromDiagnosticTests(
  diagnosticTests: Array<{ testType?: string; name?: string }> = []
): PregnancyMethod {
  for (const test of diagnosticTests) {
    const type = (test.testType || '').toLowerCase();
    const name = (test.name || '').toLowerCase();

    if (type === 'ultrasound' || name.includes('ultrasound')) {
      return 'ultrasound';
    }

    if (name.includes('palpation')) {
      return 'abdominal_palpation';
    }
  }

  return 'unknown';
}

function resolveEpisodeStatus(method: PregnancyMethod, confidence: PregnancyConfidence): PregnancyEpisodeStatus {
  if (method === 'ultrasound') return 'confirmed';
  if (confidence === 'high') return 'confirmed';
  if (confidence === 'medium') return 'probable';
  return 'suspected';
}

// ── getPregnancySnapshot ──────────────────────────────────────────────────────

export async function getPregnancySnapshot(petId: string): Promise<PregnancySnapshot> {
  const pet = await Pet.findById(petId).select('sex pregnancyStatus').lean();

  if (!pet || pet.sex !== 'female') {
    return { status: 'not_pregnant', activeEpisode: null };
  }

  const records = await MedicalRecord.find({ petId })
    .select('createdAt pregnancyRecord pregnancyDelivery pregnancyLoss diagnosticTests')
    .sort({ createdAt: 1 })
    .lean();

  let activeEpisode: PregnancyEpisode | null = null;
  let latestEpisode: PregnancyEpisode | null = null;

  for (const record of records) {
    const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
    const pregnancyRecord = (record as any).pregnancyRecord;
    const pregnancyDelivery = (record as any).pregnancyDelivery;
    const pregnancyLoss = (record as any).pregnancyLoss;
    const diagnosticTests = ((record as any).diagnosticTests || []) as Array<{ testType?: string; name?: string }>;

    if (pregnancyRecord) {
      if (pregnancyRecord.isPregnant === true) {
        const method: PregnancyMethod =
          pregnancyRecord.confirmationMethod || inferMethodFromDiagnosticTests(diagnosticTests);
        const source: PregnancyEvidenceSource =
          pregnancyRecord.confirmationSource || 'inferred';
        const confidence: PregnancyConfidence = pregnancyRecord.confidence || 'low';

        const baseEpisode: PregnancyEpisode = activeEpisode || {
          ...DEFAULT_EPISODE,
          startedAt: pregnancyRecord.gestationDate ? new Date(pregnancyRecord.gestationDate) : createdAt,
        };

        activeEpisode = {
          ...baseEpisode,
          status: resolveEpisodeStatus(method, confidence),
          startedAt: baseEpisode.startedAt || createdAt,
          expectedDueDate: pregnancyRecord.expectedDueDate ? new Date(pregnancyRecord.expectedDueDate) : baseEpisode.expectedDueDate,
          litterNumber:
            pregnancyRecord.litterNumber !== null && pregnancyRecord.litterNumber !== undefined
              ? Number(pregnancyRecord.litterNumber)
              : baseEpisode.litterNumber,
          latestConfirmationMethod: method,
          latestConfirmationSource: source,
          confidence,
          inferredFromRecords: method === 'unknown' || source === 'inferred',
        };

        latestEpisode = activeEpisode;
      } else if (pregnancyRecord.isPregnant === false && activeEpisode) {
        latestEpisode = { ...activeEpisode, status: 'ended_without_delivery' };
        activeEpisode = null;
      }
    }

    // Pregnancy loss also closes the active episode
    if (pregnancyLoss && activeEpisode) {
      latestEpisode = { ...activeEpisode, status: 'ended_without_delivery' };
      activeEpisode = null;
    }

    if (pregnancyDelivery) {
      const episodeToClose: PregnancyEpisode = activeEpisode || latestEpisode || { ...DEFAULT_EPISODE, status: 'outcome_unknown' };

      latestEpisode = {
        ...episodeToClose,
        status: 'delivered',
        deliveryDate: pregnancyDelivery.deliveryDate ? new Date(pregnancyDelivery.deliveryDate) : createdAt,
        deliveryType: pregnancyDelivery.deliveryType || null,
        deliveryLocation: pregnancyDelivery.deliveryLocation || 'unknown',
        totalLiveBirths:
          pregnancyDelivery.liveBirths !== null && pregnancyDelivery.liveBirths !== undefined
            ? Number(pregnancyDelivery.liveBirths)
            : episodeToClose.totalLiveBirths,
        totalStillBirths:
          pregnancyDelivery.stillBirths !== null && pregnancyDelivery.stillBirths !== undefined
            ? Number(pregnancyDelivery.stillBirths)
            : episodeToClose.totalStillBirths,
      };

      activeEpisode = null;
    }
  }

  if (activeEpisode) {
    return {
      status: 'pregnant',
      activeEpisode,
    };
  }

  const fallbackStatus: 'pregnant' | 'not_pregnant' = pet.pregnancyStatus === 'pregnant' ? 'pregnant' : 'not_pregnant';
  return {
    status: fallbackStatus,
    activeEpisode: latestEpisode,
  };
}

// ── getPregnancyEpisodeHistory ────────────────────────────────────────────────

export async function getPregnancyEpisodeHistory(petId: string): Promise<PregnancyEpisode[]> {
  const pet = await Pet.findById(petId).select('sex').lean();
  if (!pet || pet.sex !== 'female') return [];

  const records = await MedicalRecord.find({ petId })
    .select('createdAt pregnancyRecord pregnancyDelivery pregnancyLoss diagnosticTests')
    .sort({ createdAt: 1 })
    .lean();

  const history: PregnancyEpisode[] = [];
  let activeEpisode: PregnancyEpisode | null = null;

  for (const record of records) {
    const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
    const pregnancyRecord = (record as any).pregnancyRecord;
    const pregnancyDelivery = (record as any).pregnancyDelivery;
    const pregnancyLoss = (record as any).pregnancyLoss;
    const diagnosticTests = ((record as any).diagnosticTests || []) as Array<{ testType?: string; name?: string }>;

    if (pregnancyRecord?.isPregnant === true) {
      const method: PregnancyMethod =
        pregnancyRecord.confirmationMethod || inferMethodFromDiagnosticTests(diagnosticTests);
      const source: PregnancyEvidenceSource = pregnancyRecord.confirmationSource || 'inferred';
      const confidence: PregnancyConfidence = pregnancyRecord.confidence || 'low';

      if (!activeEpisode) {
        activeEpisode = {
          ...DEFAULT_EPISODE,
          startedAt: pregnancyRecord.gestationDate ? new Date(pregnancyRecord.gestationDate) : createdAt,
          status: resolveEpisodeStatus(method, confidence),
          expectedDueDate: pregnancyRecord.expectedDueDate ? new Date(pregnancyRecord.expectedDueDate) : null,
          litterNumber: pregnancyRecord.litterNumber != null ? Number(pregnancyRecord.litterNumber) : null,
          latestConfirmationMethod: method,
          latestConfirmationSource: source,
          confidence,
          inferredFromRecords: method === 'unknown' || source === 'inferred',
        };
      } else {
        const existing = activeEpisode as PregnancyEpisode;
        activeEpisode = {
          ...existing,
          status: resolveEpisodeStatus(method, confidence),
          expectedDueDate: pregnancyRecord.expectedDueDate ? new Date(pregnancyRecord.expectedDueDate) : existing.expectedDueDate,
          litterNumber: pregnancyRecord.litterNumber != null ? Number(pregnancyRecord.litterNumber) : existing.litterNumber,
          latestConfirmationMethod: method,
          latestConfirmationSource: source,
          confidence,
        };
      }
    } else if (pregnancyRecord?.isPregnant === false && activeEpisode) {
      history.push({ ...activeEpisode, status: 'ended_without_delivery' });
      activeEpisode = null;
    }

    if (pregnancyLoss && activeEpisode) {
      history.push({ ...activeEpisode, status: 'ended_without_delivery' });
      activeEpisode = null;
    }

    if (pregnancyDelivery) {
      const episodeToClose: PregnancyEpisode = activeEpisode || { ...DEFAULT_EPISODE, status: 'outcome_unknown' };
      history.push({
        ...episodeToClose,
        status: 'delivered',
        deliveryDate: pregnancyDelivery.deliveryDate ? new Date(pregnancyDelivery.deliveryDate) : createdAt,
        deliveryType: pregnancyDelivery.deliveryType || null,
        deliveryLocation: pregnancyDelivery.deliveryLocation || 'unknown',
        totalLiveBirths: pregnancyDelivery.liveBirths != null ? Number(pregnancyDelivery.liveBirths) : episodeToClose.totalLiveBirths,
        totalStillBirths: pregnancyDelivery.stillBirths != null ? Number(pregnancyDelivery.stillBirths) : episodeToClose.totalStillBirths,
      });
      activeEpisode = null;
    }
  }

  // Include any still-active episode
  if (activeEpisode) {
    history.push(activeEpisode);
  }

  return history;
}

// ── syncPregnancyFromMedicalRecord ────────────────────────────────────────────

export async function syncPregnancyFromMedicalRecord(input: SyncInput): Promise<void> {
  const pet = await Pet.findById(input.petId).populate('ownerId', '_id name');
  if (!pet) {
    throw new Error('Pet not found');
  }

  if (pet.sex !== 'female') {
    throw new Error('Pregnancy updates are only valid for female pets');
  }

  // Sterilization consistency check
  if (input.pregnancyRecord?.isPregnant === true && pet.sterilization === 'spayed') {
    throw new Error('A spayed pet cannot be marked as pregnant');
  }

  const liveBirths = Number(input.pregnancyDelivery?.liveBirths || 0);
  const stillBirths = Number(input.pregnancyDelivery?.stillBirths || 0);
  const totalBirths = liveBirths + stillBirths;
  const litterNumber =
    input.pregnancyRecord?.litterNumber !== null && input.pregnancyRecord?.litterNumber !== undefined
      ? Number(input.pregnancyRecord.litterNumber)
      : null;

  if (litterNumber !== null && totalBirths > 0 && totalBirths > litterNumber) {
    throw new Error('Total births cannot exceed litter number');
  }

  // Date logic validation
  const gestationDate = input.pregnancyRecord?.gestationDate
    ? new Date(input.pregnancyRecord.gestationDate as string)
    : null;
  const expectedDueDate = input.pregnancyRecord?.expectedDueDate
    ? new Date(input.pregnancyRecord.expectedDueDate as string)
    : null;
  const deliveryDate = input.pregnancyDelivery?.deliveryDate
    ? new Date(input.pregnancyDelivery.deliveryDate as string)
    : null;
  const now = new Date();

  if (gestationDate && expectedDueDate && expectedDueDate <= gestationDate) {
    throw new Error('Expected due date must be after the gestation date');
  }

  if (deliveryDate && gestationDate && deliveryDate < gestationDate) {
    throw new Error('Delivery date cannot be before the gestation date');
  }

  if (deliveryDate && deliveryDate > now) {
    throw new Error('Delivery date cannot be in the future');
  }

  // Species gestation range warning (log only, no throw)
  if (gestationDate && expectedDueDate) {
    const gapDays = Math.round((expectedDueDate.getTime() - gestationDate.getTime()) / 86400000);
    const range = getSpeciesGestationRange((pet as any).species || '');
    if (range && (gapDays < range.min || gapDays > range.max)) {
      console.warn(
        `[Pregnancy] Gestation gap ${gapDays}d is outside normal range (${range.min}–${range.max}d) for ${(pet as any).species}`
      );
    }
  }

  const wasAlreadyPregnant = pet.pregnancyStatus === 'pregnant';
  let statusToPersist: 'pregnant' | 'not_pregnant' | null = null;

  if (input.pregnancyDelivery) {
    statusToPersist = 'not_pregnant';
  } else if (input.pregnancyLoss) {
    statusToPersist = 'not_pregnant';
  } else if (input.pregnancyRecord?.isPregnant === true) {
    const method = input.pregnancyRecord.confirmationMethod || inferMethodFromDiagnosticTests(input.diagnosticTests || []);
    const source = input.pregnancyRecord.confirmationSource || input.evidenceSource || 'inferred';

    if (method === 'unknown' && source === 'unknown') {
      throw new Error('Pregnancy confirmation method or source is required when marking as pregnant');
    }

    statusToPersist = 'pregnant';
  } else if (input.pregnancyRecord?.isPregnant === false) {
    statusToPersist = 'not_pregnant';
  }

  if (!statusToPersist) {
    const snapshot = await getPregnancySnapshot(input.petId);
    statusToPersist = snapshot.status;
  }

  // Update pet stats
  let needsSave = pet.pregnancyStatus !== statusToPersist;

  if (statusToPersist === 'pregnant' && !wasAlreadyPregnant) {
    (pet as any).totalPregnancies = ((pet as any).totalPregnancies || 0) + 1;
    needsSave = true;
  }

  if (input.pregnancyDelivery) {
    (pet as any).totalLitters = ((pet as any).totalLitters || 0) + 1;
    (pet as any).lastDeliveryDate = deliveryDate || now;
    needsSave = true;
  }

  if (needsSave) {
    pet.pregnancyStatus = statusToPersist;
    await pet.save();
  }

  // Resolve owner ID for notifications
  const ownerId = (pet as any).ownerId?._id
    ? (pet as any).ownerId._id.toString()
    : typeof (pet as any).ownerId === 'string'
      ? (pet as any).ownerId
      : (pet as any).ownerId?.toString?.();

  const petName = (pet as any).name || 'The patient';

  // Notifications
  if (statusToPersist === 'pregnant' && !wasAlreadyPregnant) {
    const dueDateStr = expectedDueDate
      ? expectedDueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'unknown';

    if (ownerId) {
      await createNotification(
        ownerId,
        'pregnancy_confirmed',
        'Pregnancy Confirmed',
        `${petName}'s pregnancy has been confirmed. Expected due date: ${dueDateStr}.`,
        { petId: input.petId, medicalRecordId: input.medicalRecordId }
      );
    }
    if (input.actorId && input.actorId !== ownerId) {
      await createNotification(
        input.actorId,
        'pregnancy_confirmed',
        'Pregnancy Confirmed',
        `${petName} has been confirmed pregnant. Expected due date: ${dueDateStr}.`,
        { petId: input.petId, medicalRecordId: input.medicalRecordId }
      );
    }
  }

  if (input.pregnancyDelivery && ownerId) {
    const deliveryDateStr = deliveryDate
      ? deliveryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'today';
    await createNotification(
      ownerId,
      'pregnancy_confirmed',
      'Delivery Recorded',
      `${petName}'s delivery has been recorded on ${deliveryDateStr}. Live births: ${liveBirths}, Stillbirths: ${stillBirths}.`,
      { petId: input.petId, medicalRecordId: input.medicalRecordId }
    );
  }
}
