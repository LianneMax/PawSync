'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, type MedicalRecord } from '@/lib/medicalRecords'
import {
  ArrowLeft,
  Printer,
  Stethoscope,
  ImageIcon,
  FileText,
  Calendar,
  User,
  PawPrint,
  Pill,
  FlaskConical,
  ShieldCheck,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import BillingFromRecordModal from '@/components/BillingFromRecordModal'

const vitalsConfig: { key: string; label: string; type: 'number' | 'yesno'; unit?: string }[] = [
  { key: 'weight',             label: 'Weight',               type: 'number', unit: 'kg' },
  { key: 'temperature',        label: 'Temperature',          type: 'number', unit: '°C' },
  { key: 'pulseRate',          label: 'Pulse Rate',           type: 'number', unit: 'bpm' },
  { key: 'spo2',               label: 'SpO2',                 type: 'number', unit: '%' },
  { key: 'bodyConditionScore', label: 'Body Condition Score', type: 'number', unit: '/5' },
  { key: 'dentalScore',        label: 'Dental Score',         type: 'number', unit: '/3' },
  { key: 'crt',                label: 'CRT',                  type: 'number', unit: 'sec' },
  { key: 'pregnancy',          label: 'Pregnancy',            type: 'yesno' },
  { key: 'xray',               label: 'X-Ray',                type: 'yesno' },
  { key: 'vaccinated',         label: 'Vaccinated',           type: 'yesno' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function calculateAge(dob: string): string {
  const birth = new Date(dob)
  const now = new Date()
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}y ${m}m` : `${y} year${y > 1 ? 's' : ''}`
}

export default function ClinicAdminMedicalRecordViewPage() {
  const router = useRouter()
  const params = useParams()
  const recordId = params.id as string
  const { token } = useAuthStore()
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [billingStatus, setBillingStatus] = useState<'awaiting_approval' | 'pending_payment' | 'paid' | null>(null)
  const [existingBillingId, setExistingBillingId] = useState<string | null>(null)

  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getRecordById(recordId, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          const rec = res.data.record
          setRecord(rec)

          if (rec.billingId) {
            const billingIdStr = typeof rec.billingId === 'object' ? (rec.billingId as any)._id ?? String(rec.billingId) : String(rec.billingId)
            setExistingBillingId(billingIdStr)
            try {
              const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
              const billingRes = await fetch(`${apiBase}/billings/${billingIdStr}`, {
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              })
              const billingData = await billingRes.json()
              if (billingData?.data?.billing?.status) {
                setBillingStatus(billingData.data.billing.status)
              }
            } catch {
              // non-fatal, fallback to create
            }
          }
        } else {
          toast.error(res.message || 'Failed to load record')
        }
      } catch {
        toast.error('An error occurred while loading the record')
      } finally {
        setLoading(false)
      }
    }
    if (recordId) load()
  }, [recordId, token])

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
            onClick={() => router.push('/clinic-admin/medical-records')}
            className="px-4 py-2 bg-[#5A7C7A] text-white rounded-lg text-sm"
          >
            Back to Records
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const pet    = record.petId    as any || {}
  const vet    = record.vetId    as any || {}
  const clinic = record.clinicId as any || {}
  const branch = record.clinicBranchId as any || {}

  const hasVitals = record.vitals && Object.values(record.vitals).some((e: any) => e.value !== '' && e.value !== null && e.value !== undefined)
  const hasMeds   = record.medications && record.medications.length > 0
  const hasTests  = record.diagnosticTests && record.diagnosticTests.length > 0
  const hasCare   = record.preventiveCare && record.preventiveCare.length > 0
  const hasSOAP   = record.subjective || record.assessment || record.plan

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto">

        {/* Action bar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button
            onClick={() => router.push('/clinic-admin/medical-records')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#4F4F4F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* Report document */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:border-none print:rounded-none">

          {/* Clinic header */}
          <div className="bg-[#5A7C7A] text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{clinic.name || 'Clinic Name'}</h1>
                {branch.name && <p className="text-white/80 text-sm mt-1">{branch.name} Branch</p>}
                {(branch.address || clinic.address) && (
                  <p className="text-white/70 text-xs mt-0.5">{branch.address || clinic.address}</p>
                )}
                {clinic.phone && <p className="text-white/70 text-xs">{clinic.phone}</p>}
                {clinic.email && <p className="text-white/70 text-xs">{clinic.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Record ID</p>
                <p className="text-sm font-mono font-medium">{record._id.slice(-8).toUpperCase()}</p>
                <button
                  onClick={() => setShowBillingModal(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors print:hidden"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  {billingStatus === 'paid'
                    ? 'View Billing'
                    : billingStatus != null
                    ? 'Edit Billing'
                    : 'Create Billing'}
                </button>
              </div>
            </div>
          </div>

          {/* Title bar */}
          <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
            <h2 className="text-sm font-semibold tracking-wider uppercase">Pet Medical Examination Record</h2>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* Visit & vet info */}
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

            {record.chiefComplaint && (
              <div className="bg-[#f0f7f7] rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Chief Complaint</p>
                <p className="text-sm text-[#4F4F4F]">{record.chiefComplaint}</p>
              </div>
            )}

            <hr className="border-gray-200" />

            {/* Patient info */}
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
                  <p className="text-sm font-medium text-[#4F4F4F]">
                    {pet.dateOfBirth ? calculateAge(pet.dateOfBirth) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="text-sm font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : '-'}</p>
                </div>
              </div>
            </div>

            {/* Vitals */}
            {hasVitals && (
              <>
                <hr className="border-gray-200" />
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
                          if (!entry || (entry.value === '' && !entry.notes)) return null
                          const displayValue =
                            v.type === 'yesno'
                              ? entry.value === 'yes' ? 'Yes' : 'No'
                              : `${entry.value}${v.unit ? ` ${v.unit}` : ''}`
                          return (
                            <tr key={v.key} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F6F2]'}`}>
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
              </>
            )}

            {/* SOAP notes */}
            {hasSOAP && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">SOAP Notes</h3>
                  </div>
                  <div className="space-y-3">
                    {record.subjective && (
                      <div className="bg-[#F8F6F2] rounded-xl p-4">
                        <p className="text-xs text-gray-500 font-medium mb-1">Subjective (S)</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.subjective}</p>
                      </div>
                    )}
                    {record.assessment && (
                      <div className="bg-[#F8F6F2] rounded-xl p-4">
                        <p className="text-xs text-gray-500 font-medium mb-1">Assessment (A)</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.assessment}</p>
                      </div>
                    )}
                    {record.plan && (
                      <div className="bg-[#F8F6F2] rounded-xl p-4">
                        <p className="text-xs text-gray-500 font-medium mb-1">Plan (P)</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.plan}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Visit summary / overall observation */}
            {(record.visitSummary || record.overallObservation) && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">
                      Overall Observation / Additional Notes
                    </h3>
                  </div>
                  {record.visitSummary && (
                    <div className="bg-[#F8F6F2] rounded-xl p-4 mb-3">
                      <p className="text-xs text-gray-500 font-medium mb-1">Visit Summary</p>
                      <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.visitSummary}</p>
                    </div>
                  )}
                  {record.overallObservation && (
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-medium mb-1">Observations</p>
                      <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.overallObservation}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Medications */}
            {hasMeds && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Pill className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Medications</h3>
                  </div>
                  <div className="space-y-2">
                    {record.medications.map((med, i) => (
                      <div key={med._id || i} className="bg-[#F8F6F2] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Name</p>
                          <p className="text-sm font-medium text-[#4F4F4F]">{med.name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Dosage</p>
                          <p className="text-sm text-[#4F4F4F]">{med.dosage || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Route</p>
                          <p className="text-sm text-[#4F4F4F] capitalize">{med.route || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Frequency</p>
                          <p className="text-sm text-[#4F4F4F]">{med.frequency || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm text-[#4F4F4F]">{med.duration || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="text-sm text-[#4F4F4F] capitalize">{med.status || '-'}</p>
                        </div>
                        {med.notes && (
                          <div className="col-span-full">
                            <p className="text-xs text-gray-500">Notes</p>
                            <p className="text-sm text-[#4F4F4F]">{med.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Diagnostic tests */}
            {hasTests && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Diagnostic Tests</h3>
                  </div>
                  <div className="space-y-2">
                    {record.diagnosticTests.map((test, i) => (
                      <div key={test._id || i} className="bg-[#F8F6F2] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Test</p>
                          <p className="text-sm font-medium text-[#4F4F4F]">{test.name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Type</p>
                          <p className="text-sm text-[#4F4F4F] capitalize">{(test.testType || '-').replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Result</p>
                          <p className="text-sm text-[#4F4F4F]">{test.result || '-'}</p>
                        </div>
                        {test.normalRange && (
                          <div>
                            <p className="text-xs text-gray-500">Normal Range</p>
                            <p className="text-sm text-[#4F4F4F]">{test.normalRange}</p>
                          </div>
                        )}
                        {test.notes && (
                          <div className="col-span-full">
                            <p className="text-xs text-gray-500">Notes</p>
                            <p className="text-sm text-[#4F4F4F]">{test.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Preventive care */}
            {hasCare && (
              <>
                <hr className="border-gray-200" />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Preventive Care</h3>
                  </div>
                  <div className="space-y-2">
                    {record.preventiveCare.map((care, i) => (
                      <div key={care._id || i} className="bg-[#F8F6F2] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Type</p>
                          <p className="text-sm font-medium text-[#4F4F4F] capitalize">{care.careType || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Product</p>
                          <p className="text-sm text-[#4F4F4F]">{care.product || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date Administered</p>
                          <p className="text-sm text-[#4F4F4F]">
                            {care.dateAdministered ? formatDate(care.dateAdministered) : '-'}
                          </p>
                        </div>
                        {care.nextDueDate && (
                          <div>
                            <p className="text-xs text-gray-500">Next Due</p>
                            <p className="text-sm text-[#4F4F4F]">{formatDate(care.nextDueDate)}</p>
                          </div>
                        )}
                        {care.notes && (
                          <div className="col-span-full">
                            <p className="text-xs text-gray-500">Notes</p>
                            <p className="text-sm text-[#4F4F4F]">{care.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Images */}
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

            {/* Footer */}
            <hr className="border-gray-200" />
            <div className="flex items-end justify-between pt-4 pb-2">
              <div>
                <p className="text-xs text-gray-400">This record was generated by PawSync</p>
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

      <BillingFromRecordModal
        open={showBillingModal}
        mode={billingStatus === 'paid' ? 'view' : billingStatus != null ? 'update' : 'create'}
        onClose={() => setShowBillingModal(false)}
        patientName={pet.name || ''}
        appointmentId={record.appointmentId?._id || record.appointmentId || null}
        vetName={`${vet.firstName || ''} ${vet.lastName || ''}`.trim()}
        record={record}
        token={token || undefined}
        existingBillingId={existingBillingId ?? undefined}
        onBillingCreated={(billingId) => {
          setExistingBillingId(billingId)
          setBillingStatus('awaiting_approval')
        }}
      />
    </DashboardLayout>
  )
}
