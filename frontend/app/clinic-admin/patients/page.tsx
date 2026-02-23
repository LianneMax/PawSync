'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { getClinicPatients, type ClinicPatient } from '@/lib/clinics'
import { authenticatedFetch } from '@/lib/auth'
import { getRecordsByPet, getVaccinationsByPet, type MedicalRecord, type Vaccination } from '@/lib/medicalRecords'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  Smartphone, Search, FileText, Calendar, PawPrint,
  ChevronRight, Info, Clock, User, Syringe, Stethoscope,
  Pill, FolderOpen, Printer, Share2, Edit, Upload, X, CheckCircle, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

// ==================== TYPES ====================

interface Clinic {
  _id: string
  name: string
}

type PatientTab = 'overview' | 'vaccine' | 'medical' | 'medications' | 'files'

// ==================== HELPERS ====================

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  return `${y} year${y > 1 ? 's' : ''}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== TAB: OVERVIEW ====================

function OverviewTab({ patient, records, loadingRecords }: {
  patient: ClinicPatient
  records: MedicalRecord[]
  loadingRecords: boolean
}) {
  const latestRecord = records[0] || null

  return (
    <div className="space-y-6">
      {/* Pet Information */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Pet Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Species</p>
            <p className="text-sm font-medium text-[#4F4F4F] capitalize">{patient.species}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Breed</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{patient.breed || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Sex</p>
            <p className="text-sm font-medium text-[#4F4F4F] capitalize">{patient.sex}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Age</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{calculateAge(patient.dateOfBirth)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Date of Birth</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(patient.dateOfBirth)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Weight</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{patient.weight ? `${patient.weight} kg` : '—'}</p>
          </div>
          {patient.microchipNumber && (
            <div className="bg-gray-50 rounded-lg p-3 col-span-2">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Microchip #</p>
              <p className="text-sm font-medium text-[#4F4F4F] font-mono">{patient.microchipNumber}</p>
            </div>
          )}
          {patient.bloodType && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Blood Type</p>
              <p className="text-sm font-medium text-[#4F4F4F]">{patient.bloodType}</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Vitals */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">
            Latest Vitals
            {latestRecord && (
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                [{formatDateTime(latestRecord.createdAt)}]
              </span>
            )}
          </h3>
        </div>
        {loadingRecords ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#7FA5A3]" />
          </div>
        ) : latestRecord ? (
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(latestRecord.vitals) as [string, { value: string | number; notes: string }][]).map(([key, vital]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-sm font-semibold text-[#4F4F4F]">
                  {vital.value !== undefined && vital.value !== '' ? vital.value : '—'}
                </p>
                {vital.notes && <p className="text-xs text-gray-400 mt-0.5">{vital.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
            No vitals recorded yet
          </div>
        )}
      </section>

      {/* Owner Details */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Owner Details</h3>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-[#4A8A87]">
                {patient.owner.firstName[0]}{patient.owner.lastName[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#4F4F4F]">
                {patient.owner.firstName} {patient.owner.lastName}
              </p>
              <p className="text-xs text-gray-500">{patient.owner.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Contact</p>
              <p className="text-sm text-[#4F4F4F]">{patient.owner.contactNumber || '—'}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ==================== TAB: VACCINE CARD ====================

function VaccineCardTab({ petId, token }: { petId: string; token: string | null }) {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getVaccinationsByPet(petId, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.vaccinations) {
          setVaccinations(res.data.vaccinations)
        }
      })
      .catch(() => toast.error('Failed to load vaccinations'))
      .finally(() => setLoading(false))
  }, [petId, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7FA5A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Syringe className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Vaccination Records</h3>
      </div>
      {vaccinations.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No vaccinations recorded</p>
          <p className="text-xs text-gray-400 mt-1">Vaccination records will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vaccinations.map((vax) => {
            const isOverdue = vax.nextDueDate && new Date(vax.nextDueDate) < new Date()
            return (
              <div key={vax._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {vax.isUpToDate && !isOverdue ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <h4 className="text-sm font-semibold text-[#4F4F4F]">{vax.vaccineName}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Administered</p>
                        <p className="text-xs text-[#4F4F4F]">{formatDate(vax.dateAdministered)}</p>
                      </div>
                      {vax.nextDueDate && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Next Due</p>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-amber-600' : 'text-[#4F4F4F]'}`}>
                            {formatDate(vax.nextDueDate)}
                            {isOverdue && ' (Overdue)'}
                          </p>
                        </div>
                      )}
                    </div>
                    {vax.vetId && (
                      <p className="text-xs text-gray-400 mt-2">
                        By Dr. {vax.vetId.firstName} {vax.vetId.lastName}
                        {vax.clinicId?.name && ` — ${vax.clinicId.name}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== TAB: MEDICAL RECORD ====================

function MedicalRecordTab({ records, loading }: { records: MedicalRecord[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7FA5A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Medical Records</h3>
      </div>
      {records.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No medical records</p>
          <p className="text-xs text-gray-400 mt-1">Visit records will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isExpanded = expandedId === record._id
            return (
              <div key={record._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Visit Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record._id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Stethoscope className="w-4 h-4 text-[#7FA5A3] flex-shrink-0" />
                        <span className="text-sm font-semibold text-[#4F4F4F]">
                          Visit — {formatDateTime(record.createdAt)}
                        </span>
                      </div>
                      {record.vetId && (
                        <p className="text-xs text-gray-500 ml-6">
                          Dr. {record.vetId.firstName} {record.vetId.lastName}
                          {record.clinicId?.name && ` · ${record.clinicId.name}`}
                        </p>
                      )}
                      {record.visitSummary && (
                        <p className="text-xs text-gray-600 mt-2 ml-6 line-clamp-2 bg-blue-50 rounded px-2 py-1">
                          {record.visitSummary}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-4 pt-4">
                    {/* Visit Summary (full) */}
                    {record.visitSummary && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Visit Summary</p>
                        <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3 whitespace-pre-wrap">
                          {record.visitSummary}
                        </p>
                      </div>
                    )}

                    {/* Vet Notes (clinic admin can see) */}
                    {record.vetNotes && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          Vet Notes (Private)
                        </p>
                        <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">
                          {record.vetNotes}
                        </p>
                      </div>
                    )}

                    {/* Vitals Grid */}
                    {record.vitals && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Vitals</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.entries(record.vitals) as [string, { value: string | number; notes: string }][]).map(([key, vital]) => (
                            <div key={key} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              <p className="text-xs font-semibold text-[#4F4F4F]">
                                {vital.value !== undefined && vital.value !== '' ? vital.value : '—'}
                              </p>
                              {vital.notes && (
                                <p className="text-xs text-gray-400 mt-0.5">{vital.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical Assessment */}
                    {record.overallObservation && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Clinical Assessment</p>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                          {record.overallObservation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== TAB: MEDICATIONS ====================

function MedicationsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Medications</h3>
      </div>
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">No medications recorded</p>
        <p className="text-xs text-gray-400 mt-1">Medication records will appear here</p>
      </div>
    </div>
  )
}

// ==================== TAB: FILES & IMAGES ====================

function FilesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Files & Images</h3>
      </div>
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50">
        <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6 text-[#7FA5A3]" />
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">
          Drag & drop files or{' '}
          <span className="text-[#4A8A87] underline cursor-pointer">Browse</span>
        </p>
        <p className="text-xs text-gray-400">Supported formats: JPEG, PNG, GIF, MP4, PDF, PSD, AI, Word, PPT</p>
      </div>
      <button className="w-full py-3 bg-[#4A8A87] hover:bg-[#3d7370] text-white text-sm font-semibold rounded-xl transition-colors uppercase tracking-wide">
        Upload Files
      </button>
    </div>
  )
}

// ==================== PATIENT DRAWER ====================

function PatientDrawer({
  patient,
  open,
  onClose,
  token,
}: {
  patient: ClinicPatient | null
  open: boolean
  onClose: () => void
  token: string | null
}) {
  const [activeTab, setActiveTab] = useState<PatientTab>('overview')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Reset tab and load records when patient changes
  useEffect(() => {
    if (!patient || !token) return
    setActiveTab('overview')
    setLoadingRecords(true)
    getRecordsByPet(patient._id, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.records) {
          setRecords(res.data.records)
        } else {
          setRecords([])
        }
      })
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?._id, token])
  // Note: 'patient' object reference is intentionally excluded; only the id matters

  const tabs: { id: PatientTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'vaccine', label: 'Vaccine Card' },
    { id: 'medical', label: 'Medical Record' },
    { id: 'medications', label: 'Medications' },
    { id: 'files', label: 'Files & Images' },
  ]

  if (!patient) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[520px] !p-0 flex flex-col"
        close={false}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              {patient.photo ? (
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#7FA5A3]/30">
                  <Image
                    src={patient.photo}
                    alt={patient.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center flex-shrink-0">
                  <PawPrint className="w-6 h-6 text-[#4A8A87]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#4F4F4F] leading-tight">
                  Patient Profile — {patient.name}
                </h2>
                <p className="text-xs text-gray-500 capitalize mt-0.5">
                  {patient.species} · {patient.breed}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pb-0">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#4A8A87] text-[#4A8A87] bg-[#4A8A87]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activeTab === 'overview' && (
            <OverviewTab patient={patient} records={records} loadingRecords={loadingRecords} />
          )}
          {activeTab === 'vaccine' && (
            <VaccineCardTab petId={patient._id} token={token} />
          )}
          {activeTab === 'medical' && (
            <MedicalRecordTab records={records} loading={loadingRecords} />
          )}
          {activeTab === 'medications' && <MedicationsTab />}
          {activeTab === 'files' && <FilesTab />}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#4A8A87] hover:bg-[#3d7370] text-white rounded-lg text-xs font-semibold transition-colors">
              <Edit className="w-3.5 h-3.5" />
              Edit Patient
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ==================== MAIN PAGE ====================

export default function PatientManagementPage() {
  const token = useAuthStore((state) => state.token)

  const [, setClinics] = useState<Clinic[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [patients, setPatients] = useState<ClinicPatient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<ClinicPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'dog' | 'cat'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatient | null>(null)

  const fetchClinics = useCallback(async () => {
    if (!token) return
    try {
      const response = await authenticatedFetch('/clinics/mine', { method: 'GET' }, token)
      if (response.status === 'SUCCESS' && response.data?.clinics.length > 0) {
        setClinics(response.data.clinics)
        setSelectedClinicId(response.data.clinics[0]._id)
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error)
      toast.error('Failed to fetch clinics')
    }
  }, [token])

  const fetchPatients = useCallback(async (clinicId: string) => {
    if (!token || !clinicId) return
    setLoading(true)
    try {
      const response = await getClinicPatients(clinicId, token)
      if (response.status === 'SUCCESS' && response.data?.patients) {
        setPatients(response.data.patients)
        setFilteredPatients(response.data.patients)
      } else {
        setPatients([])
        setFilteredPatients([])
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error)
      toast.error('Failed to fetch patients')
      setPatients([])
      setFilteredPatients([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const applyFilters = (data: ClinicPatient[], species: string, query: string) => {
    let filtered = data
    if (species !== 'all') {
      filtered = filtered.filter((p) => p.species === species)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.owner.firstName.toLowerCase().includes(q) ||
          p.owner.lastName.toLowerCase().includes(q) ||
          p.owner.contactNumber.includes(q) ||
          p.microchipNumber?.includes(q)
      )
    }
    setFilteredPatients(filtered)
  }

  const handleSpeciesChange = (species: 'all' | 'dog' | 'cat') => {
    setSpeciesFilter(species)
    applyFilters(patients, species, searchQuery)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(patients, speciesFilter, query)
  }

  useEffect(() => { fetchClinics() }, [fetchClinics])
  useEffect(() => { if (selectedClinicId) fetchPatients(selectedClinicId) }, [selectedClinicId, fetchPatients])
  useEffect(() => { applyFilters(patients, speciesFilter, searchQuery) }, [patients, speciesFilter, searchQuery])

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#4F4F4F] mb-2">Patient Management</h1>
            <p className="text-gray-500">Stay on top of your patients&apos; care</p>
          </div>
          <div className="flex-shrink-0 bg-white rounded-2xl border border-dashed border-[#7FA5A3] px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[#4A8A87] transition-colors">
            <div>
              <p className="text-sm font-semibold text-[#4F4F4F]">Search Patient</p>
              <p className="text-xs text-gray-400 mt-0.5">Tap the NFC tag or Scan the QR Code of the Patient to see their record</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#4A8A87] flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Species Filter & Actions */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">Select Species:</span>
            <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
              {(['all', 'dog', 'cat'] as const).map((species) => (
                <button
                  key={species}
                  onClick={() => handleSpeciesChange(species)}
                  className={`px-5 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                    speciesFilter === species
                      ? 'bg-white text-[#4F4F4F] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {species === 'all' ? 'All' : species === 'dog' ? 'Dogs' : 'Cats'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Search className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Enter a Client Name, Patients Name or ID Tag"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
          />
        </div>

        {/* Patients List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">No patients found</h3>
              <p className="text-gray-400 text-center">
                {patients.length === 0
                  ? 'No medical records have been created yet'
                  : 'Try adjusting your filters or search query'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <button
                  key={patient._id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`w-full hover:bg-gray-50 p-6 transition-colors text-left ${
                    selectedPatient?._id === patient._id ? 'bg-[#7FA5A3]/5 border-l-2 border-[#4A8A87]' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1">
                      {patient.photo ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={patient.photo}
                            alt={patient.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <PawPrint className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#4F4F4F] mb-1">{patient.name}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {patient.breed} · {patient.species === 'dog' ? 'Dog' : 'Cat'} · {patient.sex === 'male' ? 'Male' : 'Female'}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Owner</p>
                            <p className="text-gray-700 font-medium">
                              {patient.owner.firstName} {patient.owner.lastName}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Contact</p>
                            <p className="text-gray-700 font-medium">{patient.owner.contactNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Blood Type</p>
                            <p className="text-gray-700 font-medium">{patient.bloodType || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Records</p>
                            <p className="text-gray-700 font-medium">{patient.recordCount}</p>
                          </div>
                        </div>
                        {patient.lastVisit && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Last visit:{' '}
                              {new Date(patient.lastVisit).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Patient Slide-Out Drawer */}
      <PatientDrawer
        patient={selectedPatient}
        open={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        token={token}
      />
    </DashboardLayout>
  )
}
