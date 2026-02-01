'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PetDetailsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/onboarding/pet')
  }, [router])

  return null
}
