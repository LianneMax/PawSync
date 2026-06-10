import {
  PawPrint,
  Search,
  Activity,
  Heart,
  FileText,
  CheckCircle2,
  TrendingUp,
  Stethoscope,
  FlaskConical,
  ClipboardList,
  Pill,
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
  { key: 'whatWeFound' as keyof OwnerSummary, label: 'What We Found', Icon: Search, bg: 'bg-blue-50', border: 'border-blue-200', ic: 'text-blue-600', tc: 'text-blue-800' },
  { key: 'testResultsExplained' as keyof OwnerSummary, label: 'Test Results Explained', Icon: Activity, bg: 'bg-purple-50', border: 'border-purple-200', ic: 'text-purple-600', tc: 'text-purple-800' },
  { key: 'whatsHappeningInTheirBody' as keyof OwnerSummary, label: "What's Happening in Their Body", Icon: Heart, bg: 'bg-rose-50', border: 'border-rose-200', ic: 'text-rose-600', tc: 'text-rose-800' },
  { key: 'theDiagnosis' as keyof OwnerSummary, label: 'The Diagnosis', Icon: FileText, bg: 'bg-amber-50', border: 'border-amber-200', ic: 'text-amber-600', tc: 'text-amber-800' },
  { key: 'theTreatmentPlan' as keyof OwnerSummary, label: 'The Treatment Plan', Icon: CheckCircle2, bg: 'bg-green-50', border: 'border-green-200', ic: 'text-green-600', tc: 'text-green-800' },
  { key: 'whatToExpect' as keyof OwnerSummary, label: 'What to Expect', Icon: TrendingUp, bg: 'bg-indigo-50', border: 'border-indigo-200', ic: 'text-indigo-600', tc: 'text-indigo-800' },
]

const SECTION_ICONS: Record<string, React.ReactNode> = {
  clinicalSummary:          <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  laboratoryInterpretation: <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  diagnosticIntegration:    <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  assessment:               <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  managementPlan:           <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  prognosis:                <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
}

function PageHeader({ reportId }: { reportId: string }) {
  return (
    <div className="relative bg-white px-8 py-5 border-b border-gray-100">
      <p className="absolute top-3 right-4 text-gray-300 text-[10px] font-mono">{reportId.slice(-8).toUpperCase()}</p>
      <div className="flex flex-col items-center text-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logos/baivet-logo.png" alt="BaiVet" className="h-14 w-auto object-contain" />
        <p className="text-gray-500 text-xs">134A Schirra Street, Moonwalk Village, Phase 1, Parañaque</p>
        <p className="text-gray-400 text-xs">028347477 · 0917-8220273</p>
      </div>
    </div>
  )
}

export default async function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await fetchSharedReport(id)

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
  const hasOwnerSummary = ownerSummary && Object.values(ownerSummary).some(
    (v) => typeof v === 'string' && (v as string).trim()
  )
  const totalPages = hasOwnerSummary ? 2 : 1

  return (
    <div className="report-print-root min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-204 mx-auto space-y-8">

        {/* Print button */}
        <div className="report-no-print flex justify-end">
          <PrintButton />
        </div>

        {/* ── PAGE 1: Owner Summary (shown first to owner) ── */}
        {hasOwnerSummary && ownerSummary && (
          <div>
            <p className="report-no-print text-xs text-gray-400 text-center mb-2">
              Page 1 of {totalPages} — Owner Summary
            </p>
            <div
              className="report-print-page bg-white border border-gray-200 shadow-md overflow-hidden rounded-xl"
              style={{ minHeight: '1056px' }}
            >
              <PageHeader reportId={report._id} />
              <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
                <h2 className="text-sm font-semibold tracking-wider uppercase">
                  Owner Summary — For {pet.name}&apos;s Family
                </h2>
              </div>
              <div className="px-8 py-6 space-y-4">
                <p className="text-xs text-gray-500">
                  A plain-language guide to this report, written for you.
                </p>
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
            </div>
          </div>
        )}

        {/* ── PAGE 2 (or 1 if no owner summary): Veterinary Diagnostic Report ── */}
        <div className={hasOwnerSummary ? 'report-print-newpage' : undefined}>
          <p className="report-no-print text-xs text-gray-400 text-center mb-2">
            Page {hasOwnerSummary ? 2 : 1} of {totalPages} — Veterinary Diagnostic Report
          </p>
          <div
            className="report-print-page bg-white border border-gray-200 shadow-md overflow-hidden rounded-xl"
            style={{ minHeight: '1056px' }}
          >
            <PageHeader reportId={report._id} />
            <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
              <h2 className="text-sm font-semibold tracking-wider uppercase">Veterinary Diagnostic Report</h2>
            </div>
            <div className="px-8 py-6 space-y-6">

              {/* Patient info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                  <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Patient Information</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F8F6F2] rounded-xl p-4 text-sm">
                  <div><p className="text-xs text-gray-500">Name</p><p className="font-medium text-[#4F4F4F]">{pet.name}</p></div>
                  <div><p className="text-xs text-gray-500">Species</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.species === 'canine' ? 'Canine' : 'Feline'}</p></div>
                  <div><p className="text-xs text-gray-500">Breed</p><p className="font-medium text-[#4F4F4F]">{pet.breed}</p></div>
                  <div><p className="text-xs text-gray-500">Sex</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sex ?? '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Age</p><p className="font-medium text-[#4F4F4F]">{pet.dateOfBirth ? calcAge(pet.dateOfBirth) : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Weight</p><p className="font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Sterilization</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sterilization ?? '—'}</p></div>
                  <div><p className="text-xs text-gray-500">Microchip</p><p className="font-medium text-[#4F4F4F] font-mono">{pet.microchipNumber || 'N/A'}</p></div>
                  {pet.allergies && pet.allergies.length > 0 && (
                    <div><p className="text-xs text-gray-500">Allergies</p><p className="font-medium text-[#4F4F4F]">{pet.allergies.join(', ')}</p></div>
                  )}
                </div>
              </div>

              {/* Attending vet */}
              <div className="flex items-center gap-2 bg-[#f0f7f7] rounded-xl px-4 py-3 text-sm">
                <Stethoscope className="w-4 h-4 text-[#5A7C7A] shrink-0" />
                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium mr-1">Attending Veterinarian:</span>
                <span className="font-medium text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</span>
                {vet.prcLicenseNumber && (
                  <span className="text-gray-400 text-xs ml-1">· P.R.C. Lic No. {vet.prcLicenseNumber}</span>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* Clinical sections */}
              {SECTION_KEYS.map((key, i) => {
                const content = report.sections[key]
                if (!content?.trim()) return null
                return (
                  <div key={key}>
                    {i > 0 && <hr className="border-gray-100 mb-6" />}
                    <div className="flex items-center gap-2 mb-3">
                      {SECTION_ICONS[key]}
                      <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">{SECTION_LABELS[key]}</h3>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{content}</p>
                    </div>
                  </div>
                )
              })}

              {/* Vet signature */}
              <hr className="border-gray-200" />
              <div className="flex items-end justify-between pt-2">
                <div className="text-sm">
                  {report.vetSignature?.url ? (
                    <img src={report.vetSignature.url} alt="Veterinarian signature" className="h-12 mb-2 object-contain" />
                  ) : (
                    <div className="mb-8 h-10" />
                  )}
                  <p className="font-bold text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</p>
                  <p className="text-gray-500 text-xs">Licensed Veterinarian</p>
                  {vet.prcLicenseNumber && (
                    <p className="text-gray-400 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>Report Date: {formatReportDate(report.reportDate)}</p>
                  <p className="font-mono">{report._id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
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

      </div>
    </div>
  )
}
