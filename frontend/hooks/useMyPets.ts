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

  return { pets, isLoading, error, mutate }
}
