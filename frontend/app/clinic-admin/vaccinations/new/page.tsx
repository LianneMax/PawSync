'use client'

import { Suspense } from 'react'
import { Loader } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import ClinicVaccinationFormClient from './client'

function ClinicVaccinationFormFallback() {
  return (
    <DashboardLayout>
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 text-[#7FA5A3] animate-spin" />
      </div>
    </DashboardLayout>
  )
}

export default function ClinicVaccinationFormPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<ClinicVaccinationFormFallback />}>
        <ClinicVaccinationFormClient />
      </Suspense>
    </DashboardLayout>
  )
}
