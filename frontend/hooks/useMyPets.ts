'use client'

import useSWR from 'swr'
import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'

const EMPTY_PETS: Pet[] = []

export function useMyPets() {
  const token = useAuthStore((s) => s.token)

  const { data, error, isLoading, mutate } = useSWR(
    token ? '/pets' : null,
    () => getMyPets(token!),
  )

  // Stable empty-array fallback — returning a fresh `[]` each render would change
  // the reference on every call and re-trigger effects that depend on `pets`.
  const pets = useMemo<Pet[]>(
    () => (data?.status === 'SUCCESS' ? data.data?.pets ?? EMPTY_PETS : EMPTY_PETS),
    [data]
  )

  // `pets` is only an authoritative empty list once a successful response is in hand.
  // Before the auth token rehydrates the SWR key is null (SWR reports isLoading:false
  // with no data), and a failed revalidation yields a non-SUCCESS payload — in both
  // cases `pets` is a transient [] that must NOT be read as "owner has no pets".
  const loaded = data?.status === 'SUCCESS'

  // Treat the pre-token window as loading so consumers wait instead of acting on the
  // transient empty list (e.g. the dashboard's redirect-to-onboarding guard).
  return { pets, isLoading: isLoading || !token, error, loaded, mutate }
}
