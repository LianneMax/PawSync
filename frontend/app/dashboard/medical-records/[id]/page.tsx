'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, type MedicalRecord } from '@/lib/medicalRecords'
import {
  ArrowLeft,
  Printer,
  Download,
  Stethoscope,
  ImageIcon,
  FileText,
  Calendar,
  User,
  Building2,
  PawPrint,
} from 'lucide-react'
import { toast } from 'sonner'

// ---- Vitals display config ----
const vitalsConfig: { key: string; label: string; type: 'number' | 'yesno'; unit?: string }[] = [
  { key: 'weight', label: 'Weight', type: 'number', unit: 'kg' },
  { key: 'temperature', label: 'Temperature', type: 'number', unit: '°C' },
  { key: 'pulseRate', label: 'Pulse Rate', type: 'number', unit: 'bpm' },
  { key: 'spo2', label: 'SpO2', type: 'number', unit: '%' },
  { key: 'bodyConditionScore', label: 'Body Condition Score', type: 'number', unit: '/9' },
  { key: 'dentalScore', label: 'Dental Score', type: 'number', unit: '/4' },
  { key: 'crt', label: 'CRT', type: 'number', unit: 'sec' },
  { key: 'pregnancy', label: 'Pregnancy', type: 'yesno' },
  { key: 'xray', label: 'X-Ray', type: 'yesno' },
  { key: 'vaccinated', label: 'Vaccinated', type: 'yesno' },
]

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecord = async () => {
      try {
        const res = await getRecordById(recordId, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setRecord(res.data.record)
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
          <div className="bg-[#5A7C7A] text-white px-8 py-6 print:bg-[#5A7C7A] print:text-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{clinic.name || 'Clinic Name'}</h1>
                <p className="text-white/80 text-sm mt-1">{branch.name ? `${branch.name} Branch` : ''}</p>
                <p className="text-white/70 text-xs mt-0.5">{branch.address || clinic.address || ''}</p>
                {clinic.phone && <p className="text-white/70 text-xs">{clinic.phone}</p>}
                {clinic.email && <p className="text-white/70 text-xs">{clinic.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Record ID</p>
                <p className="text-sm font-mono font-medium">{record._id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Title Bar */}
          <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
            <h2 className="text-sm font-semibold tracking-wider uppercase">Pet Medical Examination Report</h2>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* ===== Visit & Vet Info ===== */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-[#5A7C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date of Visit</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(record.createdAt)}</p>
                  <p className="text-xs text-gray-500">{formatTime(record.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-[#5A7C7A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Attending Veterinarian</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">
                    Dr. {vet.firstName || ''} {vet.lastName || ''}
                  </p>
                  {vet.email && <p className="text-xs text-gray-500">{vet.email}</p>}
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* ===== Patient Information ===== */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Patient Information</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F8F6F2] rounded-xl p-4">
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{pet.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Species</p>
                  <p className="text-sm font-medium text-[#4F4F4F] capitalize">{pet.species || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Breed</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{pet.breed || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Sex</p>
                  <p className="text-sm font-medium text-[#4F4F4F] capitalize">{pet.sex || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Age</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{pet.dateOfBirth ? calculateAge(pet.dateOfBirth) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Weight (Record)</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : '-'}</p>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* ===== Examination Vitals ===== */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />
                <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Examination Vitals</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#5A7C7A] text-white">
                      <th className="text-left py-2 px-4 font-medium rounded-tl-lg">Parameter</th>
                      <th className="text-left py-2 px-4 font-medium">Value</th>
                      <th className="text-left py-2 px-4 font-medium rounded-tr-lg">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalsConfig.map((v, i) => {
                      const entry = (record.vitals as any)?.[v.key]
                      if (!entry) return null
                      const displayValue =
                        v.type === 'yesno'
                          ? entry.value === 'yes'
                            ? 'Yes'
                            : 'No'
                          : `${entry.value}${v.unit ? ` ${v.unit}` : ''}`

                      return (
                        <tr
                          key={v.key}
                          className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F6F2]'}`}
                        >
                          <td className="py-2.5 px-4 font-medium text-[#4F4F4F]">{v.label}</td>
                          <td className="py-2.5 px-4 text-[#4F4F4F]">{displayValue}</td>
                          <td className="py-2.5 px-4 text-gray-600 italic">{entry.notes || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== Image Observations ===== */}
            {record.images && record.images.length > 0 && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Image Observations</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {record.images.map((img, index) => (
                      <div key={img._id || index} className="border border-gray-200 rounded-xl overflow-hidden">
                        {img.data && (
                          <div className="aspect-video bg-gray-50">
                            <img
                              src={`data:${img.contentType};base64,${img.data}`}
                              alt={img.description || `Observation ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {img.description && (
                          <div className="px-3 py-2 bg-[#F8F6F2]">
                            <p className="text-xs text-gray-600">{img.description}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ===== Overall Observation ===== */}
            {record.overallObservation && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">
                      Overall Observation / Additional Notes
                    </h3>
                  </div>
                  <div className="bg-[#F8F6F2] rounded-xl p-4">
                    <p className="text-sm text-[#4F4F4F] leading-relaxed whitespace-pre-wrap">
                      {record.overallObservation}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ===== Footer / Signature Area ===== */}
            <hr className="border-gray-200" />
            <div className="flex items-end justify-between pt-4 pb-2">
              <div>
                <p className="text-xs text-gray-400">This report was generated by PawSync</p>
                <p className="text-xs text-gray-400">{formatDate(record.createdAt)} at {formatTime(record.createdAt)}</p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-gray-400 mb-1" />
                <p className="text-sm font-medium text-[#4F4F4F]">
                  Dr. {vet.firstName || ''} {vet.lastName || ''}
                </p>
                <p className="text-xs text-gray-500">Attending Veterinarian</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
