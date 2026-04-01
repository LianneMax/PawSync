import { Suspense } from 'react'
import ActivateOwnerClient from './activate-owner-client'

export default function ActivateOwnerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#7FA5A3]" />}>
      <ActivateOwnerClient />
    </Suspense>
  )
}
