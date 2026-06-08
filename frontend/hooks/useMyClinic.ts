'use client'

import useSWR from 'swr'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'

export interface MyClinic {
  _id: string
  name: string
  email?: string
  legalBusinessName?: string
  businessTaxId?: string
  businessRegistrationNo?: string
  birNumber?: string
  receiptFooterNote?: string
  [key: string]: unknown
}

export function useMyClinic() {
  const token = useAuthStore((s) => s.token)

  const { data, error, isLoading, mutate } = useSWR(
    token ? '/clinics/mine' : null,
    () => authenticatedFetch('/clinics/mine', { method: 'GET' }, token!),
  )

  const clinic: MyClinic | null =
    data?.status === 'SUCCESS' && data.data?.clinics?.length > 0 ? data.data.clinics[0] : null

  return { clinic, isLoading, error, mutate }
}
