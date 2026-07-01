import { vi, describe, it, expect, afterEach } from 'vitest'

vi.mock('./auth', () => ({
  authenticatedFetch: vi.fn(),
}))

import { authenticatedFetch } from './auth'
import { getMedicalHistory } from './medicalHistory'

const mockFetch = vi.mocked(authenticatedFetch)

afterEach(() => {
  vi.clearAllMocks()
})

const fakeData = {
  pet: { _id: 'pet-001', name: 'Buddy', species: 'canine' },
  medications: [],
  operations: [],
  vaccinations: [],
  weightHistory: [],
  pregnancyRecords: [],
  latestDiagnosticTests: [],
  latestPreventiveCare: [],
  chiefComplaint: '',
  latestSOAP: null,
  latestAntigenTest: null,
  latestTiterTest: null,
}

describe('getMedicalHistory', () => {
  it('calls GET /medical-records/pet/:petId/medical-history with token', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: fakeData })

    await getMedicalHistory('pet-001', 'tok-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      '/medical-records/pet/pet-001/medical-history',
      { method: 'GET' },
      'tok-abc',
    )
  })

  it('returns data on successful response', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS', data: fakeData })

    const result = await getMedicalHistory('pet-001', 'tok')

    expect(result).toEqual(fakeData)
  })

  it('throws with server message when status is ERROR', async () => {
    mockFetch.mockResolvedValue({ status: 'ERROR', message: 'Not authorized' })

    await expect(getMedicalHistory('pet-001', 'tok')).rejects.toThrow('Not authorized')
  })

  it('throws generic message when status is ERROR with no message', async () => {
    mockFetch.mockResolvedValue({ status: 'ERROR' })

    await expect(getMedicalHistory('pet-001', 'tok')).rejects.toThrow(
      'Failed to fetch medical history',
    )
  })

  it('throws when successful response has no data', async () => {
    mockFetch.mockResolvedValue({ status: 'SUCCESS' })

    await expect(getMedicalHistory('pet-001', 'tok')).rejects.toThrow(
      'No data returned from server',
    )
  })

  it('throws when response is null', async () => {
    mockFetch.mockResolvedValue(null)

    await expect(getMedicalHistory('pet-001', 'tok')).rejects.toThrow()
  })
})
