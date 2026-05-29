import {
  PawPrint,
  Search,
  Activity,
  Heart,
  FileText,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import { PrintButton } from './PrintButton'
import { formatReportDate, SECTION_LABELS, SECTION_KEYS } from '@/lib/vetReports'
import type { VetReport, OwnerSummary } from '@/lib/vetReports'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

async function fetchSharedReport(id: string): Promise<VetReport | null> {
  try {
    const res = await fetch(`${API}/api/vet-reports/shared/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json.data
  } catch {
    return null
  }
}

function calcAge(dob: string): string {
  const diff = Date.now() - new Date(dob).getTime()
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
}

const OWNER_SUMMARY_CONFIG = [
  {
    key: 'whatWeFound' as keyof OwnerSummary,
    label: 'What We Found',
    Icon: Search,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    ic: 'text-blue-600',
    tc: 'text-blue-800',
  },
  {
    key: 'testResultsExplained' as keyof OwnerSummary,
    label: 'Test Results Explained',
    Icon: Activity,
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    ic: 'text-purple-600',
    tc: 'text-purple-800',
  },
  {
    key: 'whatsHappeningInTheirBody' as keyof OwnerSummary,
    label: "What's Happening in Their Body",
    Icon: Heart,
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    ic: 'text-rose-600',
    tc: 'text-rose-800',
  },
  {
    key: 'theDiagnosis' as keyof OwnerSummary,
    label: 'The Diagnosis',
    Icon: FileText,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    ic: 'text-amber-600',
    tc: 'text-amber-800',
  },
  {
    key: 'theTreatmentPlan' as keyof OwnerSummary,
    label: 'The Treatment Plan',
    Icon: CheckCircle2,
    bg: 'bg-green-50',
    border: 'border-green-200',
    ic: 'text-green-600',
    tc: 'text-green-800',
  },
  {
    key: 'whatToExpect' as keyof OwnerSummary,
    label: 'What to Expect',
    Icon: TrendingUp,
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    ic: 'text-indigo-600',
    tc: 'text-indigo-800',
  },
]

export default async function SharedReportPage({ params }: { params: { id: string } }) {
  const report = await fetchSharedReport(params.id)

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
        <PawPrint className="w-10 h-10 opacity-30" />
        <p className="text-sm">This report is not available or has not been shared.</p>
      </div>
    )
  }

  const pet = report.petId
  const vet = report.vetId
  const ownerSummary = report.ownerSummary
  const hasOwnerSummary =
    ownerSummary && Object.values(ownerSummary).some((v) => (v as string)?.trim())

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Print button */}
        <div className="flex justify-end mb-4 print:hidden">
          <PrintButton />
        </div>

        {/* Report document */}
        <div className="bg-white border border-gray-200 rounded-xl p-10 shadow-sm text-gray-900 print:shadow-none print:border-none print:p-0">
          {/* Header */}
          <div className="text-center mb-8 pb-4 border-b border-gray-200 font-serif">
            <h1 className="text-2xl font-bold tracking-wide uppercase">Veterinary Diagnostic Report</h1>
            <p className="text-gray-500 text-sm mt-1">Date: {formatReportDate(report.reportDate)}</p>
          </div>

          {/* Report title */}
          {report.title && (
            <p className="text-center text-base font-semibold text-gray-700 mb-6 font-serif">{report.title}</p>
          )}

          {/* Patient info */}
          <div className="mb-8 space-y-1.5 text-sm font-serif">
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

          {/* Owner summary cards */}
          {hasOwnerSummary && ownerSummary && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-emerald-700">
                  Understanding {pet.name}&apos;s Health
                </h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                A plain-language guide to this report — written for you.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {OWNER_SUMMARY_CONFIG.map(({ key, label, Icon, bg, border, ic, tc }) => {
                  const content = ownerSummary[key]
                  if (!content?.trim()) return null
                  return (
                    <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
                      <div className={`flex items-center gap-2 mb-2 ${tc}`}>
                        <Icon className={`w-4 h-4 ${ic}`} />
                        <span className="font-semibold text-sm">{label}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-gray-200 mt-8 mb-6" />
            </div>
          )}

          {/* Clinical sections */}
          <p className="font-bold mb-5 font-serif">Veterinarian Interpretation:</p>

          {SECTION_KEYS.map((key) => {
            const content = report.sections[key]
            if (!content?.trim()) return null
            return (
              <div key={key} className="mb-6 font-serif">
                <h2 className="font-bold text-sm mb-2">{SECTION_LABELS[key]}</h2>
                <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{content}</p>
              </div>
            )
          })}

          {/* Signature */}
          <div className="mt-10 pt-6 border-t border-gray-200 text-sm font-serif">
            <div className="mb-8 h-10" />
            <p className="font-bold">
              {vet.firstName} {vet.lastName}
            </p>
            <p className="text-gray-500">Veterinarian</p>
            {vet.prcLicenseNumber && (
              <p className="text-gray-500 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>
            )}
          </div>

          {/* Disclaimer */}
          <p className="mt-8 text-xs text-gray-400 leading-relaxed font-serif">
            The following interpretation of diagnostic procedures reflects a range of potential findings and
            outcomes based on the results obtained. Diagnostic tests can yield varied interpretations due to
            multiple factors, including individual patient characteristics, the presence of concurrent health
            conditions, and the inherent variability of laboratory measurements. It is essential to approach
            these interpretations as part of a comprehensive assessment that includes clinical observations
            and history.
          </p>
        </div>
      </div>
    </div>
  )
}
