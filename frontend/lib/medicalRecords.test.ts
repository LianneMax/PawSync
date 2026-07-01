import { vi, describe, it, expect, afterEach } from 'vitest'

vi.mock('./auth', () => ({
  authenticatedFetch: vi.fn(),
}))

import { authenticatedFetch } from './auth'
import {
  emptyVitals,
  createMedicalRecord,
  createFollowUp,
  getVetMedicalRecords,
  getRecordsByPet,
  getCurrentRecord,
  getRecordById,
  updateMedicalRecord,
  toggleShareRecord,
  getVaccinationsByPet,
  getMedicationServices,
  getPreventiveCareServices,
  getSurgeryServices,
} from './medicalRecords'

const mockFetch = vi.mocked(authenticatedFetch)

afterEach(() => {
  vi.clearAllMocks()
})

// ─── emptyVitals ─────────────────────────────────────────────────────────────

describe('emptyVitals', () => {
  it('initializes all vital fields with empty value and notes', () => {
    const vitals = emptyVitals()
    const fields = [
      'weight', 'temperature', 'pulseRate', 'spo2',
      'bodyConditionScore', 'dentalScore', 'crt',
      'pregnancy', 'xray', 'vaccinated',
    ] as const

    for (const field of fields) {
      expect(vitals[field]).toEqual({ value: '', notes: '' })
    }
  })

  it('returns a new object on every call', () => {
    expect(emptyVitals()).not.toBe(emptyVitals())
  })
})

// ─── getMedicationServices ────────────────────────────────────────────────────

describe('getMedicationServices', () => {
  it('keeps only items with type=product and category=medication', async () => {
    const items = [
      { type: 'Product', category: 'Medication',       name: 'Amoxicillin' },
      { type: 'Service', category: 'Medication',       name: 'should be excluded' },
      { type: 'Product', category: 'Diagnostic Tests', name: 'should be excluded' },
    ]
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { items } })

    const result = await getMedicationServices('tok')

    expect(result.data?.items).toEqual([
      { type: 'Product', category: 'Medication', name: 'Amoxicillin' },
    ])
  })

  it('matching is case-insensitive', async () => {
    const items = [{ type: 'PRODUCT', category: 'MEDICATION', name: 'Drug A' }]
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { items } })

    const result = await getMedicationServices()

    expect(result.data?.items).toHaveLength(1)
  })

  it('returns response as-is when status is not SUCCESS', async () => {
    const errRes = { status: 'ERROR', message: 'Unauthorized' }
    mockFetch.mockResolvedValue(errRes)

    expect(await getMedicationServices()).toEqual(errRes)
  })

  it('returns response as-is when data.items is absent', async () => {
    const res = { status: 'SUCCESS' }
    mockFetch.mockResolvedValue(res)

    expect(await getMedicationServices()).toEqual(res)
  })
})

// ─── getPreventiveCareServices ────────────────────────────────────────────────

describe('getPreventiveCareServices', () => {
  it('keeps only items with type=service and category=preventive care', async () => {
    const items = [
      { type: 'Service', category: 'Preventive Care', name: 'Flea Treatment' },
      { type: 'Product', category: 'Preventive Care', name: 'should be excluded' },
      { type: 'Service', category: 'Medication',      name: 'should be excluded' },
    ]
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { items } })

    const result = await getPreventiveCareServices()

    expect(result.data?.items).toEqual([
      { type: 'Service', category: 'Preventive Care', name: 'Flea Treatment' },
    ])
  })

  it('returns response as-is when status is not SUCCESS', async () => {
    mockFetch.mockResolvedValue({ status: 'ERROR', message: 'Not found' })

    expect((await getPreventiveCareServices()).status).toBe('ERROR')
  })
})

// ─── getSurgeryServices ───────────────────────────────────────────────────────

describe('getSurgeryServices', () => {
  it('accepts both "surgeries" and "surgery" as valid categories', async () => {
    const items = [
      { type: 'Service', category: 'Surgeries',  name: 'Spay'  },
      { type: 'Service', category: 'Surgery',    name: 'Neuter' },
      { type: 'Service', category: 'Medication', name: 'should be excluded' },
    ]
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { items } })

    const result = await getSurgeryServices()

    expect(result.data?.items?.map((i) => i.name)).toEqual(['Spay', 'Neuter'])
  })

  it('returns response as-is when status is not SUCCESS', async () => {
    mockFetch.mockResolvedValue({ status: 'ERROR' })

    expect((await getSurgeryServices()).status).toBe('ERROR')
  })
})

// ─── createMedicalRecord ─────────────────────────────────────────────────────

describe('createMedicalRecord', () => {
  it('calls POST /medical-records with serialized body and token', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { record: {} } })
    const data = { petId: 'pet-001', clinicId: 'clinic-001' }

    await createMedicalRecord(data, 'tok-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records',
      { method: 'POST', body: JSON.stringify(data) },
      'tok-abc',
    )
  })
})

// ─── createFollowUp ──────────────────────────────────────────────────────────

describe('createFollowUp', () => {
  it('calls POST /medical-records/:id/follow-ups with body and token', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { followUps: [] } })
    const data = { ownerObservations: 'Doing better', vetNotes: 'Recovering well' }

    await createFollowUp('rec-001', data, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/rec-001/follow-ups',
      { method: 'POST', body: JSON.stringify(data) },
      'tok',
    )
  })
})

// ─── getVetMedicalRecords ─────────────────────────────────────────────────────

describe('getVetMedicalRecords', () => {
  it('calls URL with no query string when no params provided', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { records: [], total: 0 } })

    await getVetMedicalRecords(undefined, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/vet/my-records',
      { method: 'GET' },
      'tok',
    )
  })

  it('appends petId to query string when provided', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { records: [], total: 0 } })

    await getVetMedicalRecords({ petId: 'pet-001' }, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/vet/my-records?petId=pet-001',
      { method: 'GET' },
      'tok',
    )
  })

  it('appends limit and offset to query string when provided', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { records: [], total: 0 } })

    await getVetMedicalRecords({ limit: 10, offset: 20 }, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/vet/my-records?limit=10&offset=20',
      { method: 'GET' },
      'tok',
    )
  })
})

// ─── getRecordsByPet ─────────────────────────────────────────────────────────

describe('getRecordsByPet', () => {
  it('calls GET /medical-records/pet/:petId', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: {} })

    await getRecordsByPet('pet-001', 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/pet/pet-001',
      { method: 'GET' },
      'tok',
    )
  })
})

// ─── getCurrentRecord ─────────────────────────────────────────────────────────

describe('getCurrentRecord', () => {
  it('calls GET /medical-records/pet/:petId/current', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { record: {} } })

    await getCurrentRecord('pet-001', 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/pet/pet-001/current',
      { method: 'GET' },
      'tok',
    )
  })
})

// ─── getRecordById ────────────────────────────────────────────────────────────

describe('getRecordById', () => {
  it('calls GET /medical-records/:id', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { record: {} } })

    await getRecordById('rec-001', 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/rec-001',
      { method: 'GET' },
      'tok',
    )
  })
})

// ─── updateMedicalRecord ──────────────────────────────────────────────────────

describe('updateMedicalRecord', () => {
  it('calls PUT /medical-records/:id with serialized updates', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { record: {} } })
    const updates = { chiefComplaint: 'Limping', stage: 'completed' as const }

    await updateMedicalRecord('rec-001', updates, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/rec-001',
      { method: 'PUT', body: JSON.stringify(updates) },
      'tok',
    )
  })
})

// ─── toggleShareRecord ────────────────────────────────────────────────────────

describe('toggleShareRecord', () => {
  it('calls PATCH /medical-records/:id/share with shared=true', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { sharedWithOwner: true } })

    await toggleShareRecord('rec-001', true, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/rec-001/share',
      { method: 'PATCH', body: JSON.stringify({ shared: true }) },
      'tok',
    )
  })

  it('calls PATCH /medical-records/:id/share with shared=false', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { sharedWithOwner: false } })

    await toggleShareRecord('rec-001', false, 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/rec-001/share',
      { method: 'PATCH', body: JSON.stringify({ shared: false }) },
      'tok',
    )
  })
})

// ─── getVaccinationsByPet ─────────────────────────────────────────────────────

describe('getVaccinationsByPet', () => {
  it('calls GET /medical-records/pet/:petId/vaccinations', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: { vaccinations: [] } })

    await getVaccinationsByPet('pet-001', 'tok')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/pet/pet-001/vaccinations',
      { method: 'GET' },
      'tok',
    )
  })
})
