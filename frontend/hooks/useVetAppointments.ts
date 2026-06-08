'use client'

import useSWR from 'swr'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import type { Appointment } from '@/lib/appointments'

export function useVetAppointments() {
  const token = useAuthStore((s) => s.token)

  const { data, error, isLoading, mutate } = useSWR(
    token ? '/appointments/vet' : null,
    () => authenticatedFetch('/appointments/vet', { method: 'GET' }, token!),
  )

  const appointments: Appointment[] = data?.status === 'SUCCESS' ? data.data?.appointments ?? [] : []

  return { appointments, isLoading, error, mutate }
}
