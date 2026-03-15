'use client'

import { useState, useEffect } from 'react'
import { getMedicalHistory, type MedicalHistory } from '@/lib/medicalHistory'

interface UseHistoricalMedicalRecordReturn {
  data: MedicalHistory | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useHistoricalMedicalRecord(
  petId: string | null,
  token: string | null,
  refreshTrigger: number = 0
): UseHistoricalMedicalRecordReturn {
  const [data, setData] = useState<MedicalHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    if (!petId || !token) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const history = await getMedicalHistory(petId, token)
      setData(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medical history')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [petId, token, refreshTrigger])

  return { data, loading, error, refresh }
}
