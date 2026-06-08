'use client'

import useSWR from 'swr'
import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getMyAppointments, type Appointment } from '@/lib/appointments'

const EMPTY_APPOINTMENTS: Appointment[] = []

export function useMyAppointments(filter?: 'upcoming' | 'previous', refreshInterval?: number) {
  const token = useAuthStore((s) => s.token)

  const { data, error, isLoading, mutate } = useSWR(
    token ? ['/appointments/mine', filter ?? 'all'] : null,
    () => getMyAppointments(filter, token!),
    refreshInterval ? { refreshInterval } : undefined,
  )

  // Stable empty-array fallback — returning a fresh `[]` each render would change
  // the reference on every call and re-trigger effects that depend on `appointments`.
  const appointments = useMemo<Appointment[]>(
    () => (data?.status === 'SUCCESS' ? data.data?.appointments ?? EMPTY_APPOINTMENTS : EMPTY_APPOINTMENTS),
    [data]
  )

  return { appointments, isLoading, error, mutate }
}
