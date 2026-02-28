import { Suspense } from 'react'
import { Loader } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'

import VaccinationFormClient from './client'

// Suspense wrapper for useSearchParams hook
export default function NewVaccinationPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
          </div>
        }
      >
        <VaccinationFormClient />
      </Suspense>
    </DashboardLayout>
  )
}
