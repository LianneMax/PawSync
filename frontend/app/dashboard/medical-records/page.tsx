import { Suspense } from 'react'
import { MedicalRecordsContent } from './content'

export const dynamic = 'force-dynamic'

function LoadingFallback() {
  return (
    <div className="p-6 lg:p-8 flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
    </div>
  )
}

export default function MedicalRecordsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MedicalRecordsContent />
    </Suspense>
  )
}
