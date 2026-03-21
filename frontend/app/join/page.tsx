import { Suspense } from 'react'
import JoinClient from './join-client'

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#7FA5A3]" />}>
      <JoinClient />
    </Suspense>
  )
}
