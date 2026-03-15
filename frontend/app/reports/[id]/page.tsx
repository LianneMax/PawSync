'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  getSharedReport,
  formatReportDate,
  SECTION_LABELS,
  SECTION_KEYS,
  type VetReport,
} from '@/lib/vetReports'
import { PawPrint, Printer } from 'lucide-react'

function calcAge(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime()
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
}

export default function SharedReportPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<VetReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getSharedReport(id)
      .then(setReport)
      .catch(() => setError('This report is not available or has not been shared.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
        <PawPrint className="w-10 h-10 opacity-30" />
        <p className="text-sm">{error || 'Report not found.'}</p>
      </div>
    )
  }

  const pet = report.petId
  const vet = report.vetId

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Print / download button (only visible on screen) */}
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>

        {/* The report document */}
        <div className="bg-white border border-gray-200 rounded-xl p-10 shadow-sm font-serif text-gray-900 print:shadow-none print:border-none print:p-0">
          {/* Header */}
          <div className="text-center mb-8 pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold tracking-wide uppercase">Veterinary Diagnostic Report</h1>
            <p className="text-gray-500 text-sm mt-1">Date: {formatReportDate(report.reportDate)}</p>
          </div>

          {/* Report title */}
          {report.title && (
            <p className="text-center text-base font-semibold text-gray-700 mb-6">{report.title}</p>
          )}

          {/* Patient info */}
          <div className="mb-8 space-y-1.5 text-sm">
            <p><strong>Patient:</strong> {pet.name}</p>
            <p><strong>Owner:</strong> —</p>
            <p><strong>Species/Breed:</strong> {pet.species === 'canine' ? 'Canine' : 'Feline'} / {pet.breed}</p>
            <p><strong>Sex/Age:</strong> {pet.sex} / {pet.dateOfBirth ? calcAge(pet.dateOfBirth) : '—'}</p>
            <p><strong>Weight:</strong> {pet.weight ?? '—'} kg</p>
            {pet.sterilization && <p><strong>Sterilization:</strong> {pet.sterilization}</p>}
            {pet.allergies && pet.allergies.length > 0 && (
              <p><strong>Known Allergies:</strong> {pet.allergies.join(', ')}</p>
            )}
          </div>

          <p className="font-bold mb-5">Veterinarian Interpretation:</p>

          {SECTION_KEYS.map((key) => {
            const content = report.sections[key]
            if (!content?.trim()) return null
            return (
              <div key={key} className="mb-6">
                <h2 className="font-bold text-sm mb-2">{SECTION_LABELS[key]}</h2>
                <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{content}</p>
              </div>
            )
          })}

          {/* Signature */}
          <div className="mt-10 pt-6 border-t border-gray-200 text-sm">
            <div className="mb-8 h-10" /> {/* signature space */}
            <p className="font-bold">
              {vet.firstName} {vet.lastName}
            </p>
            <p className="text-gray-500">Veterinarian</p>
            {vet.prcLicenseNumber && (
              <p className="text-gray-500 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>
            )}
          </div>

          {/* Footer note */}
          <p className="mt-8 text-xs text-gray-400 leading-relaxed">
            The following interpretation of diagnostic procedures reflects a range of potential findings and outcomes based on the results obtained.
            Diagnostic tests can yield varied interpretations due to multiple factors, including individual patient characteristics, the presence of
            concurrent health conditions, and the inherent variability of laboratory measurements. It is essential to approach these interpretations
            as part of a comprehensive assessment that includes clinical observations and history.
          </p>
        </div>
      </div>
    </div>
  )
}
