'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  getRecordById,
  type MedicalRecord,
  type Vitals,
  type Medication,
  type DiagnosticTest,
  type PreventiveCare,
} from '@/lib/medicalRecords'
import { getVaccinationsByMedicalRecord, type Vaccination } from '@/lib/vaccinations'
import {
  ArrowLeft,
  Printer,
  Stethoscope,
  ImageIcon,
  FileText,
  Calendar,
  User,
  PawPrint,
  Baby,
  AlertCircle,
  Pill,
  FlaskConical,
  Shield,
  Syringe,
  Scissors,
  Heart,
} from 'lucide-react'
import { toast } from 'sonner'

// ---- Vitals display config ----
const vitalLabels: Record<string, { label: string; unit: string }> = {
  weight: { label: 'Weight', unit: 'kg' },
  temperature: { label: 'Temperature', unit: '°C' },
  pulseRate: { label: 'Pulse Rate', unit: 'bpm' },
  spo2: { label: 'SpO2', unit: '%' },
  bodyConditionScore: { label: 'Body Condition Score', unit: '/5' },
  dentalScore: { label: 'Dental Score', unit: '/3' },
  crt: { label: 'CRT', unit: 'sec' },
}

const IMMUNITY_DISEASES_BY_SPECIES = {
  canine: ['CPV', 'CDV', 'CAV-1'],
  feline: ['FPV', 'FCV', 'FHV'],
} as const

type ImmunitySpecies = keyof typeof IMMUNITY_DISEASES_BY_SPECIES

function resolveImmunitySpecies(species?: string): ImmunitySpecies {
  return species === 'feline' ? 'feline' : 'canine'
}

function stripImmunityFromPlan(plan?: string): string {
  if (!plan) return ''
  return plan.replace(/\n*Immunity Testing[\s\S]*$/i, '').trim()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}y ${m}m` : `${y} year${y > 1 ? 's' : ''}`
}

export default function MedicalRecordReportPage() {
  const router = useRouter()
  const params = useParams()
  const recordId = params.id as string
  const { token } = useAuthStore()
  const printRef = useRef<HTMLDivElement>(null)

  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecord = async () => {
      try {
        const res = await getRecordById(recordId, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setRecord(res.data.record)
          // Load vaccinations linked to this medical record
          getVaccinationsByMedicalRecord(res.data.record._id, token || '').then((vacs) => {
            setVaccinations(vacs)
          }).catch(() => {})
        } else {
          toast.error(res.message || 'Failed to load record')
        }
      } catch {
        toast.error('An error occurred while loading the record')
      } finally {
        setLoading(false)
      }
    }
    if (recordId) loadRecord()
  }, [recordId, token])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
        </div>
      </DashboardLayout>
    )
  }

  if (!record) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-gray-500">Medical record not found</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-[#5A7C7A] text-white rounded-lg text-sm"
          >
            Go Back
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const pet = record.petId || {}
  const vet = record.vetId || {}
  const clinic = record.clinicId || {}
  const branch = record.clinicBranchId || {}

  const currentOwnerName = `${(pet as any)?.ownerId?.firstName || ''} ${(pet as any)?.ownerId?.lastName || ''}`.trim()
  const ownerName = (record.ownerAtTime?.name || currentOwnerName || 'Unknown Owner').trim()
  const ownerLabel = record.ownerAtTime?.name ? 'Owner at Time' : 'Current Owner'

  const soapPlan = stripImmunityFromPlan(record.plan)
  const immunitySpecies = resolveImmunitySpecies(record.immunityTesting?.species)
  const immunityDiseases = IMMUNITY_DISEASES_BY_SPECIES[immunitySpecies]

  const vitalNotes = (Object.keys(vitalLabels) as (keyof Vitals)[])
    .map((key) => {
      const entry = record.vitals?.[key]
      const note = typeof entry?.notes === 'string' ? entry.notes.trim() : ''
      if (!note) return null
      return { key, label: vitalLabels[key].label, note }
    })
    .filter((item): item is { key: keyof Vitals; label: string; note: string } => item !== null)

  const hasImmunityTesting = !!record.immunityTesting && (
    record.immunityTesting.enabled === true ||
    (record.immunityTesting.rows?.length || 0) > 0
  )
  const hasAntigenTesting = !!record.immunityTesting && (
    record.immunityTesting.antigenEnabled === true ||
    (record.immunityTesting.antigenRows?.length || 0) > 0
  )
  const hasDiagnosticTestsSection = (record.diagnosticTests?.length || 0) > 0 || hasImmunityTesting || hasAntigenTesting

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        {/* Action bar (hidden on print) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4F4F4F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Report Document */}
        <div ref={printRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:border-none print:rounded-none print:shadow-none">

          {/* ===== Clinic Header ===== */}
          <div className="bg-[#476B6B] text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-wide">VETERINARY MEDICAL RECORD</h1>
                <p className="text-white/80 text-sm mt-1">
                  {(clinic as any).name || 'Clinic Name'}
                  {(branch as any).name ? ` — ${(branch as any).name}` : ''}
                </p>
                <p className="text-white/70 text-xs mt-0.5">{(branch as any).address || (clinic as any).address || ''}</p>
                {(clinic as any).phone && <p className="text-white/70 text-xs">{(clinic as any).phone}</p>}
                {(clinic as any).email && <p className="text-white/70 text-xs">{(clinic as any).email}</p>}
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Record ID</p>
                <p className="text-sm font-mono font-medium">{record._id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* ===== Patient & Visit Info ===== */}
            <div className="grid grid-cols-2 gap-6">
              {/* Patient Information */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                    <PawPrint className="w-3.5 h-3.5" />
                    Patient Information
                  </h2>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                      <PawPrint className="w-6 h-6 text-[#5A7C7A]" />
                    </div>
                    <p className="font-bold text-[#4F4F4F] text-lg">{(pet as any).name || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Species</p>
                      <p className="text-sm text-[#4F4F4F] capitalize">{(pet as any).species || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Breed</p>
                      <p className="text-sm text-[#4F4F4F] capitalize">{(pet as any).breed || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Color</p>
                      <p className="text-sm text-[#4F4F4F]">{(pet as any).color || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Sex</p>
                      <p className="text-sm text-[#4F4F4F] capitalize">{(pet as any).sex || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Date of Birth</p>
                      <p className="text-sm text-[#4F4F4F]">{(pet as any).dateOfBirth ? new Date((pet as any).dateOfBirth).toLocaleDateString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Age</p>
                      <p className="text-sm text-[#4F4F4F]">{(pet as any).dateOfBirth ? calculateAge((pet as any).dateOfBirth) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Sterilization</p>
                      <p className="text-sm text-[#4F4F4F] capitalize">{(pet as any).sterilization || '—'}</p>
                    </div>
                    {(pet as any).nfcTagId && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Pet Tag ID</p>
                        <p className="text-sm font-mono text-[#4F4F4F]">{(pet as any).nfcTagId}</p>
                      </div>
                    )}
                    {(pet as any).microchipNumber && (
                      <div className={(pet as any).nfcTagId ? '' : 'col-span-2'}>
                        <p className="text-[10px] text-gray-400 uppercase">Microchip</p>
                        <p className="text-sm font-mono text-[#4F4F4F]">{(pet as any).microchipNumber}</p>
                      </div>
                    )}
                  </div>
                  {(pet as any).allergies && (pet as any).allergies.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase flex items-center gap-1 mb-1">
                        <AlertCircle className="w-3 h-3 text-amber-500" /> Allergies
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(pet as any).allergies.map((a: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs border border-amber-100">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Visit Information */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Visit Information
                  </h2>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Date of Examination</p>
                    <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(record.createdAt)} at {formatTime(record.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">{ownerLabel}</p>
                    <p className="text-sm font-medium text-[#4F4F4F]">{ownerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                      <User className="w-3 h-3" /> Attending Veterinarian
                    </p>
                    <p className="text-sm font-medium text-[#4F4F4F]">
                      Dr. {(vet as any).firstName || ''} {(vet as any).lastName || ''}
                    </p>
                    {(vet as any).email && <p className="text-xs text-gray-500">{(vet as any).email}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Clinic / Branch</p>
                    <p className="text-sm font-medium text-[#4F4F4F]">
                      {(clinic as any).name || '—'}
                      {(branch as any).name ? ` — ${(branch as any).name}` : ''}
                    </p>
                    {(branch as any).phone && (
                      <p className="text-xs text-gray-500 mt-0.5">Branch Phone: {(branch as any).phone}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* ===== Chief Complaint ===== */}
            {record.chiefComplaint && (
              <>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Chief Complaint / Reason for Visit</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.chiefComplaint}</p>
                  </div>
                </div>
                <hr className="border-gray-200" />
              </>
            )}

            {/* ===== Physical Examination / Vitals ===== */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                  <Stethoscope className="w-3.5 h-3.5" />
                  Physical Examination
                </h2>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 w-[45%]">Parameter</th>
                      <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(vitalLabels) as (keyof Vitals)[]).map((key) => {
                      const { label, unit } = vitalLabels[key]
                      const entry = record.vitals?.[key]
                      return (
                        <tr key={key} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 text-sm text-[#4F4F4F] font-medium">{label}</td>
                          <td className="py-2">
                            {entry?.value || entry?.value === 0 ? (
                              <span className="text-sm font-semibold text-[#2C3E2D]">
                                {entry.value}
                                {unit && <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {vitalNotes.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-2">Vital Notes</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 w-[35%]">Vital</th>
                          <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitalNotes.map((item) => (
                          <tr key={item.key} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 text-sm text-[#4F4F4F] font-medium">{item.label}</td>
                            <td className="py-2 text-sm text-[#4F4F4F] whitespace-pre-wrap">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ===== SOAP Notes ===== */}
            {(record.subjective || record.overallObservation || record.assessment || soapPlan) && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      SOAP Notes
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.subjective && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">S — Subjective</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.subjective}</p>
                      </div>
                    )}
                    {record.overallObservation && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">O — Objective</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.overallObservation}</p>
                      </div>
                    )}
                    {record.assessment && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">A — Assessment</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.assessment}</p>
                      </div>
                    )}
                    {soapPlan && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">P — Plan</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{soapPlan}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== Medications ===== */}
            {record.medications && record.medications.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5" />
                      Medications ({record.medications.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Name', 'Dosage', 'Route', 'Frequency', 'Duration', 'Status'].map((h) => (
                            <th key={h} className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {record.medications.map((med: Medication, i: number) => (
                          <tr key={(med as any)._id || i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 font-medium text-[#4F4F4F] pr-3">{med.name || '—'}</td>
                            <td className="py-2 text-gray-600 pr-3">{med.dosage || '—'}</td>
                            <td className="py-2 text-gray-600 capitalize pr-3">{med.route || '—'}</td>
                            <td className="py-2 text-gray-600 pr-3">{med.frequency || '—'}</td>
                            <td className="py-2 text-gray-600 pr-3">{med.duration || '—'}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                med.status === 'active' ? 'bg-green-50 text-green-700' :
                                med.status === 'discontinued' ? 'bg-red-50 text-red-600' :
                                'bg-gray-50 text-gray-500'
                              }`}>{med.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===== Diagnostic Tests ===== */}
            {hasDiagnosticTestsSection && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Diagnostic Tests
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.diagnosticTests?.map((test: DiagnosticTest, i: number) => (
                      <div key={(test as any)._id || i} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-[#4F4F4F]">{test.name || test.testType}</span>
                          <span className="text-xs text-gray-400 uppercase">{test.testType?.replace('_', ' ')}</span>
                        </div>
                        {test.date && <p className="text-xs text-gray-400 mb-1">{new Date(test.date).toLocaleDateString()}</p>}
                        {test.result && (
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase mb-0.5">Result</p>
                            <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{test.result}</p>
                          </div>
                        )}
                        {test.normalRange && <p className="text-xs text-gray-400 mt-1">Normal: {test.normalRange}</p>}
                        {test.notes && <p className="text-xs text-gray-500 mt-1 italic">{test.notes}</p>}
                        {Array.isArray(test.images) && test.images.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Test Images</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {test.images.map((img, imgIdx) => (
                                <div key={(img as any)._id || imgIdx} className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                                  {img.url ? (
                                    <img
                                      src={img.url}
                                      alt={img.description || `Test image ${imgIdx + 1}`}
                                      className="w-full h-24 object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                                      <ImageIcon className="w-5 h-5 text-gray-300" />
                                    </div>
                                  )}
                                  {img.description && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-white text-[10px] px-2 py-1 truncate">
                                      {img.description}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {hasImmunityTesting && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                          <h3 className="text-[11px] font-semibold text-[#476B6B] uppercase tracking-wider">Immunity Testing</h3>
                        </div>
                        <div className="p-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">Disease</th>
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">Score</th>
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">Status</th>
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {immunityDiseases.map((disease) => {
                                const row = record.immunityTesting?.rows?.find((item) => item.disease === disease)
                                return (
                                  <tr key={disease} className="border-b border-gray-50 last:border-0">
                                    <td className="py-2 text-[#4F4F4F] font-medium pr-3">{disease}</td>
                                    <td className="py-2 text-gray-600 pr-3">{row?.score ?? '—'}</td>
                                    <td className="py-2 text-gray-600 pr-3">{row?.status || '—'}</td>
                                    <td className="py-2 text-gray-600">{row?.action || '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {hasAntigenTesting && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                          <h3 className="text-[11px] font-semibold text-[#476B6B] uppercase tracking-wider">Antigen Testing</h3>
                        </div>
                        <div className="p-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">Disease</th>
                                <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {immunityDiseases.map((disease) => {
                                const row = record.immunityTesting?.antigenRows?.find((item) => item.disease === disease)
                                return (
                                  <tr key={disease} className="border-b border-gray-50 last:border-0">
                                    <td className="py-2 text-[#4F4F4F] font-medium pr-3">{disease}</td>
                                    <td className="py-2 text-gray-600">{row?.result || '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== Pregnancy Results ===== */}
            {record.pregnancyRecord && record.pregnancyRecord.isPregnant && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-pink-200 rounded-xl overflow-hidden bg-pink-50/30">
                  <div className="bg-pink-100/50 px-4 py-2 border-b border-pink-200">
                    <h2 className="text-xs font-semibold text-pink-900 uppercase tracking-wider flex items-center gap-2">
                      <Baby className="w-3.5 h-3.5" />
                      Pregnancy Results
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-pink-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Pregnancy Status</p>
                        <p className="text-sm font-bold text-pink-700 flex items-center gap-1.5">
                          <Heart className="w-4 h-4 fill-pink-500" />
                          Pregnant
                        </p>
                      </div>
                      {record.pregnancyRecord.gestationDate && (
                        <div className="bg-white rounded-lg p-3 border border-pink-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Gestation Date</p>
                          <p className="text-sm text-[#4F4F4F]">{new Date(record.pregnancyRecord.gestationDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {record.pregnancyRecord.expectedDueDate && (
                        <div className="bg-white rounded-lg p-3 border border-pink-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Expected Due Date</p>
                          <p className="text-sm text-[#4F4F4F]">{new Date(record.pregnancyRecord.expectedDueDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {record.pregnancyRecord.litterNumber != null && (
                        <div className="bg-white rounded-lg p-3 border border-pink-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Expected Litter Size</p>
                          <p className="text-sm font-semibold text-[#4F4F4F]">{record.pregnancyRecord.litterNumber} puppies/kittens</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== Delivery Results ===== */}
            {record.pregnancyDelivery && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50/30">
                  <div className="bg-green-100/50 px-4 py-2 border-b border-green-200">
                    <h2 className="text-xs font-semibold text-green-900 uppercase tracking-wider flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5" />
                      Delivery Results
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Delivery Date</p>
                        <p className="text-sm text-[#4F4F4F]">{record.pregnancyDelivery.deliveryDate ? new Date(record.pregnancyDelivery.deliveryDate).toLocaleDateString() : '—'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Delivery Type</p>
                        <p className="text-sm font-semibold text-[#4F4F4F] capitalize">{record.pregnancyDelivery.deliveryType}</p>
                      </div>
                      {record.pregnancyDelivery.laborDuration && (
                        <div className="bg-white rounded-lg p-3 border border-green-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Labor Duration</p>
                          <p className="text-sm text-[#4F4F4F]">{record.pregnancyDelivery.laborDuration}</p>
                        </div>
                      )}
                      <div className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Mother Condition</p>
                        <p className={`text-sm font-semibold capitalize ${
                          record.pregnancyDelivery.motherCondition === 'stable' ? 'text-green-700' :
                          record.pregnancyDelivery.motherCondition === 'recovering' ? 'text-blue-700' :
                          'text-red-700'
                        }`}>
                          {record.pregnancyDelivery.motherCondition}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Live Births</p>
                        <p className="text-sm font-bold text-green-700">{record.pregnancyDelivery.liveBirths}</p>
                      </div>
                      {record.pregnancyDelivery.stillBirths > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Still Births</p>
                          <p className="text-sm font-semibold text-amber-700">{record.pregnancyDelivery.stillBirths}</p>
                        </div>
                      )}
                    </div>
                    {record.pregnancyDelivery.vetRemarks && (
                      <div className="bg-white rounded-lg p-3 border border-green-100 mt-3">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Vet Remarks</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.pregnancyDelivery.vetRemarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== Surgery Results ===== */}
            {record.surgeryRecord && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <div className="bg-amber-100/50 px-4 py-2 border-b border-amber-200">
                    <h2 className="text-xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5" />
                      Surgery Results
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.surgeryRecord.surgeryType && (
                      <div className="bg-white rounded-lg p-3 border border-amber-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Surgery Type</p>
                        <p className="text-sm font-semibold text-[#4F4F4F]">{record.surgeryRecord.surgeryType}</p>
                      </div>
                    )}
                    {record.surgeryRecord.vetRemarks && (
                      <div className="bg-white rounded-lg p-3 border border-amber-100">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Vet Remarks</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.surgeryRecord.vetRemarks}</p>
                      </div>
                    )}
                    {record.surgeryRecord.images && record.surgeryRecord.images.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Surgery Images</p>
                        <div className="grid grid-cols-3 gap-2">
                          {record.surgeryRecord.images.map((img, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-amber-100">
                              {img.url ? (
                                <img
                                  src={img.url}
                                  alt={img.description || `Surgery image ${idx + 1}`}
                                  className="w-full h-32 object-cover"
                                />
                              ) : (
                                <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-gray-300" />
                                </div>
                              )}
                              {img.description && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate">
                                  {img.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== Vaccinations Administered ===== */}
            {vaccinations.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <Syringe className="w-3.5 h-3.5" />
                      Vaccinations Administered ({vaccinations.length})
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {vaccinations.map((vac, idx) => (
                      <div key={(vac as any)._id || idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-[#4F4F4F]">
                              {(vac as any).vaccineTypeId?.name || (vac as any).vaccineName || 'Unknown Vaccine'}
                              {(vac as any).doseNumber != null && (
                                <span className="ml-2 text-xs font-normal text-gray-400">Dose {(vac as any).doseNumber}</span>
                              )}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            vac.status === 'active' ? 'bg-green-50 text-green-700' :
                            vac.status === 'expired' ? 'bg-red-50 text-red-700' :
                            vac.status === 'overdue' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {vac.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-400 uppercase font-medium">Date Administered</p>
                            <p className="text-[#4F4F4F]">{vac.dateAdministered ? new Date(vac.dateAdministered).toLocaleDateString() : '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-medium">Next Due Date</p>
                            <p className="text-[#4F4F4F]">{vac.nextDueDate ? new Date(vac.nextDueDate).toLocaleDateString() : '—'}</p>
                          </div>
                          {(vac as any).route && (
                            <div>
                              <p className="text-gray-400 uppercase font-medium">Route</p>
                              <p className="text-[#4F4F4F] capitalize">{(vac as any).route}</p>
                            </div>
                          )}
                          {(vac as any).manufacturer && (
                            <div>
                              <p className="text-gray-400 uppercase font-medium">Manufacturer</p>
                              <p className="text-[#4F4F4F]">{(vac as any).manufacturer}</p>
                            </div>
                          )}
                          {(vac as any).batchNumber && (
                            <div className="col-span-2">
                              <p className="text-gray-400 uppercase font-medium">Batch/Lot Number</p>
                              <p className="text-[#4F4F4F] font-mono">{(vac as any).batchNumber}</p>
                            </div>
                          )}
                        </div>
                        {(vac as any).notes && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Clinical Notes</p>
                            <p className="text-xs text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{(vac as any).notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ===== Preventive Care ===== */}
            {record.preventiveCare && record.preventiveCare.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      Preventive Care ({record.preventiveCare.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Type', 'Product', 'Administered', 'Next Due'].map((h) => (
                            <th key={h} className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 pr-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {record.preventiveCare.map((care: PreventiveCare, i: number) => (
                          <tr key={(care as any)._id || i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 text-gray-600 capitalize pr-3">{care.careType?.replace('_', ' ') || '—'}</td>
                            <td className="py-2 font-medium text-[#4F4F4F] pr-3">{care.product || '—'}</td>
                            <td className="py-2 text-gray-600 pr-3">{care.dateAdministered ? new Date(care.dateAdministered).toLocaleDateString() : '—'}</td>
                            <td className="py-2 text-gray-600">{(care as any).nextDueDate ? new Date((care as any).nextDueDate).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ===== Preventive Exclusions ===== */}
            {Array.isArray(record.preventiveAssociatedExclusions) && record.preventiveAssociatedExclusions.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">
                      Preventive Exclusions ({record.preventiveAssociatedExclusions.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {record.preventiveAssociatedExclusions.map((item, i) => (
                        <span
                          key={`${item}-${i}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== Diagnostic Images ===== */}
            {record.images && record.images.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Diagnostic Images ({record.images.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {record.images.map((img, idx) => (
                        <div key={(img as any)._id || idx} className="rounded-lg overflow-hidden border border-gray-200">
                          {img.url ? (
                            <img
                              src={img.url}
                              alt={img.description || `Image ${idx + 1}`}
                              className="w-full h-36 object-cover"
                            />
                          ) : (
                            <div className="w-full h-36 bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                          {img.description && (
                            <p className="text-[10px] text-gray-500 px-2 py-1.5 bg-gray-50 border-t border-gray-100 truncate">{img.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== Visit Summary ===== */}
            {record.visitSummary && (
              <>
                <hr className="border-gray-200" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Visit Summary</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.visitSummary}</p>
                  </div>
                </div>
              </>
            )}

            {/* ===== Referral, Discharge & Scheduled Surgery ===== */}
            {(record.referral || record.discharge || record.scheduledSurgery) && (
              <>
                <hr className="border-gray-200" />
                <div className="grid grid-cols-2 gap-3">
                  {record.discharge && (
                    <div className="border border-green-200 rounded-xl bg-green-50/30 p-4 flex items-start gap-3">
                      <div className="text-xl shrink-0">✓</div>
                      <div>
                        <p className="text-xs font-semibold text-green-900 uppercase tracking-wider">Discharge for At-Home Care</p>
                        <p className="text-sm text-green-700 mt-1">Patient cleared for discharge</p>
                      </div>
                    </div>
                  )}
                  {record.referral && (
                    <div className="border border-blue-200 rounded-xl bg-blue-50/30 p-4 flex items-start gap-3">
                      <div className="text-xl shrink-0">→</div>
                      <div>
                        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Referral to Another Vet</p>
                        <p className="text-sm text-blue-700 mt-1">Patient requires specialist consultation</p>
                      </div>
                    </div>
                  )}
                  {record.scheduledSurgery && (
                    <div className="border border-red-200 rounded-xl bg-red-50/30 p-4 flex items-start gap-3">
                      <Scissors className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-900 uppercase tracking-wider">Surgery Scheduled</p>
                        <p className="text-sm text-red-700 mt-1">Surgical procedure has been recommended</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===== Footer / Signature Area ===== */}
            <hr className="border-gray-200" />
            <div className="flex items-end justify-between pt-4 pb-2">
              <div>
                <div className="w-48 border-b border-gray-300 mb-1" />
                <p className="text-sm font-medium text-[#4F4F4F]">
                  Dr. {(vet as any).firstName || ''} {(vet as any).lastName || ''}
                </p>
                <p className="text-xs text-gray-500">Attending Veterinarian</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">This record was generated by PawSync</p>
                <p className="text-xs text-gray-400">{formatDate(record.createdAt)} at {formatTime(record.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
