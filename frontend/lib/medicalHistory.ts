import { authenticatedFetch } from './auth'

export interface MedicalHistoryPet {
  _id: string
  name: string
  species: 'canine' | 'feline'
  breed: string
  secondaryBreed: string | null
  sex: 'male' | 'female'
  dateOfBirth: string
  weight: number
  age: string
  sterilization: string
  color: string | null
  microchipNumber: string | null
  nfcTagId: string | null
  photo: string | null
  allergies: string[]
  pregnancyStatus: 'pregnant' | 'not_pregnant'
}

export interface Operation {
  date: string
  surgeryType: string
  vetRemarks: string
  clinicName: string
  clinicId: string
}

export interface Medication {
  name: string
  dosage: string
  route: 'oral' | 'topical' | 'injection' | 'other'
  frequency: string
  startDate: string | null
  endDate: string | null
  status: 'active' | 'completed' | 'discontinued'
  notes: string
}

export interface LatestSOAP {
  date: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export interface VaccinationRecord {
  name: string
  status: string
  dateAdministered: string
  nextDueDate: string
  route: string
  manufacturer: string
  batchNumber: string
}

export interface PregnancyRecord {
  eventType?: 'pregnancy_assessment' | 'delivery'
  date?: string
  isPregnant?: boolean
  gestationDate?: string
  expectedDueDate?: string
  litterNumber?: number
  confirmationMethod?: 'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown'
  confirmationSource?: 'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown'
  confidence?: 'high' | 'medium' | 'low'
  deliveryDate?: string
  deliveryType?: 'natural' | 'c-section'
  deliveryLocation?: 'in_clinic' | 'outside_clinic' | 'unknown'
  reportedBy?: 'vet' | 'owner' | 'external_vet' | 'unknown'
  motherCondition?: string
}

export interface PregnancyEpisode {
  status: 'none' | 'suspected' | 'probable' | 'confirmed' | 'delivered' | 'ended_without_delivery' | 'outcome_unknown'
  startedAt: string | null
  expectedDueDate: string | null
  litterNumber: number | null
  latestConfirmationMethod: 'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown'
  latestConfirmationSource: 'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  deliveryDate: string | null
  deliveryType: 'natural' | 'c-section' | null
  deliveryLocation: 'in_clinic' | 'outside_clinic' | 'unknown'
  totalLiveBirths: number | null
  totalStillBirths: number | null
  inferredFromRecords: boolean
}

export interface MedicalHistory {
  pet: MedicalHistoryPet
  operations: Operation[]
  medications: Medication[]
  chiefComplaint: string
  latestSOAP: LatestSOAP | null
  vaccinations: VaccinationRecord[]
  pregnancyRecords: PregnancyRecord[]
  pregnancyEpisode: PregnancyEpisode
}

export async function getMedicalHistory(petId: string, token: string): Promise<MedicalHistory> {
  const res = await authenticatedFetch(
    `/medical-records/pet/${petId}/medical-history`,
    { method: 'GET' },
    token
  )

  if (!res || res.status === 'ERROR') {
    throw new Error(res?.message || 'Failed to fetch medical history')
  }

  if (!res.data) {
    throw new Error('No data returned from server')
  }

  return res.data
}
