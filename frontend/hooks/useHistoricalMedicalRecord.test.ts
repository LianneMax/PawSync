import { vi, describe, it, expect, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/medicalHistory', () => ({
  getMedicalHistory: vi.fn(),
}))

import { getMedicalHistory } from '@/lib/medicalHistory'
import { useHistoricalMedicalRecord } from './useHistoricalMedicalRecord'

const mockGet = vi.mocked(getMedicalHistory)

const fakePetId = 'pet-001'
const fakeToken = 'tok-abc'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeHistory: any = {
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('useHistoricalMedicalRecord', () => {
  it('does not fetch and returns null data when petId is null', async () => {
    const { result } = renderHook(() =>
      useHistoricalMedicalRecord(null, fakeToken),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('does not fetch and returns null data when token is null', async () => {
    const { result } = renderHook(() =>
      useHistoricalMedicalRecord(fakePetId, null),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('sets data on successful fetch', async () => {
    mockGet.mockResolvedValue(fakeHistory)

    const { result } = renderHook(() =>
      useHistoricalMedicalRecord(fakePetId, fakeToken),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(fakeHistory)
    expect(result.current.error).toBeNull()
    expect(mockGet).toHaveBeenCalledWith(fakePetId, fakeToken)
  })

  it('sets error message and clears data when fetch throws', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useHistoricalMedicalRecord(fakePetId, fakeToken),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Network error')
    expect(result.current.data).toBeNull()
  })

  it('sets fallback error message when thrown value is not an Error', async () => {
    mockGet.mockRejectedValue('something went wrong')

    const { result } = renderHook(() =>
      useHistoricalMedicalRecord(fakePetId, fakeToken),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Failed to load medical history')
  })

  it('re-fetches when refreshTrigger changes', async () => {
    mockGet.mockResolvedValue(fakeHistory)

    const { result, rerender } = renderHook(
      ({ trigger }: { trigger: number }) =>
        useHistoricalMedicalRecord(fakePetId, fakeToken, trigger),
      { initialProps: { trigger: 0 } },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockGet).toHaveBeenCalledTimes(1)

    rerender({ trigger: 1 })

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })
})
