'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PRCLicenseRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/onboarding/vet')
  }, [router])

  return null
}
