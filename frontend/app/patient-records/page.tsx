'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  createMedicalRecord,
  getRecordsByPet,
  getCurrentRecord,
  getHistoricalRecords,
  getRecordById,
  updateMedicalRecord,
  toggleShareRecord,
  type MedicalRecord,
  type Vitals,
  type VitalEntry,
  type Medication,
  type DiagnosticTest,
  type PreventiveCare,
} from '@/lib/medicalRecords'
import {
  Search,
  ClipboardList,
  Plus,
  ChevronLeft,
  PawPrint,
  Calendar,
  Eye,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Stethoscope,
  Pencil,
  Share2,
  Check,
  Pill,
  FlaskConical,
  Shield,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  EyeOff,
  Printer,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'


// ==================== TYPES ====================

interface PatientPet {
  _id: string
  name: string
  species: string
  breed: string
  photo: string | null
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
  ownerId: string
  clinicId: string
  clinicName: string
  clinicBranchId: string
  clinicBranchName: string
}

// ==================== HELPERS ====================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function emptyVitalEntry(): VitalEntry {
  return { value: '', notes: '' }
}

function emptyVitals(): Vitals {
  return {
    weight: emptyVitalEntry(),
    temperature: emptyVitalEntry(),
    pulseRate: emptyVitalEntry(),
    spo2: emptyVitalEntry(),
    bodyConditionScore: emptyVitalEntry(),
    dentalScore: emptyVitalEntry(),
    crt: emptyVitalEntry(),
    pregnancy: emptyVitalEntry(),
    xray: emptyVitalEntry(),
    vaccinated: emptyVitalEntry(),
  }
}

// Text-input vitals
const vitalLabels: Record<string, { label: string; unit: string; placeholder: string }> = {
  weight: { label: 'Weight', unit: 'kg', placeholder: 'e.g. 12.5' },
  temperature: { label: 'Temperature', unit: '\u00B0C', placeholder: 'e.g. 38.5' },
  pulseRate: { label: 'Pulse Rate', unit: 'bpm', placeholder: 'e.g. 120' },
  spo2: { label: 'SpO2', unit: '%', placeholder: 'e.g. 98' },
  bodyConditionScore: { label: 'Body Condition Score', unit: '/9', placeholder: 'e.g. 5' },
  dentalScore: { label: 'Dental Score', unit: '/4', placeholder: 'e.g. 2' },
  crt: { label: 'CRT', unit: 'sec', placeholder: 'e.g. 2' },
}

// Checkbox vitals (stored as 'Yes'/'No' in value field)
const checkboxVitalKeys = ['xray', 'pregnancy', 'vaccinated'] as const
const checkboxVitalLabels: Record<string, string> = {
  xray: 'X-Ray',
  pregnancy: 'Pregnancy',
  vaccinated: 'Vaccinated',
}

// Extra checkbox fields (stored in a separate state, not in vitals)
const extraCheckboxKeys = ['ultrasound', 'availedProducts', 'others'] as const
const extraCheckboxLabels: Record<string, string> = {
  ultrasound: 'Ultrasound',
  availedProducts: 'Availed Products',
  others: 'Others',
}

type ExtraCheckboxState = Record<typeof extraCheckboxKeys[number], boolean>

function emptyExtraCheckboxes(): ExtraCheckboxState {
  return { ultrasound: false, availedProducts: false, others: false }
}

// ==================== MAIN PAGE ====================

export default function PatientRecordsPage() {
  const { token } = useAuthStore()
  const [patients, setPatients] = useState<PatientPet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<PatientPet | null>(null)
  const [currentRecord, setCurrentRecord] = useState<MedicalRecord | null>(null)
  const [historicalRecords, setHistoricalRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)

  // Edit modal
  const [editRecord, setEditRecord] = useState<MedicalRecord | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // View modal
  const [viewOpen, setViewOpen] = useState(false)
  const [viewInitialIndex, setViewInitialIndex] = useState(0)

  // Load patients from vet's appointments
  const loadPatients = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await authenticatedFetch('/appointments/vet', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.appointments) {
        const petMap = new Map<string, PatientPet>()
        for (const appt of res.data.appointments) {
          const petId = appt.petId?._id
          if (petId && !petMap.has(petId)) {
            petMap.set(petId, {
              _id: petId,
              name: appt.petId?.name || 'Unknown',
              species: appt.petId?.species || '',
              breed: appt.petId?.breed || '',
              photo: appt.petId?.photo || null,
              ownerFirstName: appt.ownerId?.firstName || '',
              ownerLastName: appt.ownerId?.lastName || '',
              ownerEmail: appt.ownerId?.email || '',
              ownerId: appt.ownerId?._id || '',
              clinicId: appt.clinicId?._id || '',
              clinicName: appt.clinicId?.name || '',
              clinicBranchId: appt.clinicBranchId?._id || '',
              clinicBranchName: appt.clinicBranchId?.name || '',
            })
          }
        }
        setPatients(Array.from(petMap.values()))
      }
    } catch (err) {
      console.error('Failed to load patients:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  // Load records when patient selected
  const loadRecords = useCallback(async (petId: string) => {
    if (!token) return
    setLoadingRecords(true)
    try {
      const res = await getRecordsByPet(petId, token)
      if (res.status === 'SUCCESS' && res.data) {
        setCurrentRecord(res.data.currentRecord || null)
        setHistoricalRecords(res.data.historicalRecords || [])
      } else {
        setCurrentRecord(null)
        setHistoricalRecords([])
      }
    } catch {
      setCurrentRecord(null)
      setHistoricalRecords([])
    } finally {
      setLoadingRecords(false)
    }
  }, [token])

  const handleSelectPatient = (pet: PatientPet) => {
    setSelectedPatient(pet)
    loadRecords(pet._id)
  }

  const handleBack = () => {
    setSelectedPatient(null)
    setCurrentRecord(null)
    setHistoricalRecords([])
  }

  // Build ordered list of all record IDs for the selected patient
  const allRecordIds = [
    ...(currentRecord ? [currentRecord._id] : []),
    ...historicalRecords.map((r) => r._id),
  ]

  // View full record — open modal at the right index
  const handleViewRecord = (recordId: string) => {
    const idx = allRecordIds.indexOf(recordId)
    setViewInitialIndex(idx >= 0 ? idx : 0)
    setViewOpen(true)
  }

  // Edit record - load full record data then open edit modal
  const handleEditRecord = async (recordId: string) => {
    if (!token) return
    setEditLoading(true)
    try {
      const res = await getRecordById(recordId, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        setEditRecord(res.data.record)
      } else {
        toast.error('Failed to load record for editing')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setEditLoading(false)
    }
  }

  // Toggle share with owner
  const handleToggleShare = async (recordId: string, currentlyShared: boolean) => {
    if (!token) return
    try {
      const res = await toggleShareRecord(recordId, !currentlyShared, token)
      if (res.status === 'SUCCESS') {
        toast.success(res.data?.sharedWithOwner ? 'Record shared with pet owner' : 'Record unshared')
        if (selectedPatient) loadRecords(selectedPatient._id)
      } else {
        toast.error(res.message || 'Failed to update sharing')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  // Filter patients by search
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      p.breed.toLowerCase().includes(q) ||
      `${p.ownerFirstName} ${p.ownerLastName}`.toLowerCase().includes(q)
    )
  })

  const totalPatients = patients.length
  const totalRecords = (currentRecord ? 1 : 0) + historicalRecords.length

  return (
    <DashboardLayout userType="veterinarian">
      <div className="p-6 lg:p-8">
        {!selectedPatient ? (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#4F4F4F]">Patient Records</h1>
              <p className="text-gray-500 text-sm mt-1">View and manage medical records for your patients</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{totalPatients}</p>
                    <p className="text-xs text-gray-500">Total Patients</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {new Set(patients.map((p) => p.ownerId).filter(Boolean)).size}
                    </p>
                    <p className="text-xs text-gray-500">Unique Owners</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by patient name, species, breed, or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all bg-white"
                />
              </div>
            </div>

            {/* Patient List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
                <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-[#4F4F4F] mb-2">No patients found</h2>
                <p className="text-gray-500 text-sm">
                  {searchQuery
                    ? 'No patients match your search. Try a different term.'
                    : 'Your patients will appear here once you have confirmed appointments.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPatients.map((pet) => (
                  <button
                    key={pet._id}
                    onClick={() => handleSelectPatient(pet)}
                    className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md hover:ring-1 hover:ring-[#7FA5A3]/30 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {pet.photo ? (
                        <img src={pet.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center">
                          <PawPrint className="w-6 h-6 text-[#5A7C7A]" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#4F4F4F]">{pet.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{pet.species} &middot; {pet.breed}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      <p>Owner: {pet.ownerFirstName} {pet.ownerLastName}</p>
                      <p className="mt-0.5">{pet.clinicBranchName || pet.clinicName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Patient Detail View */}
            <div className="mb-6">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#4F4F4F] transition-colors mb-4"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Patients
              </button>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {selectedPatient.photo ? (
                      <img src={selectedPatient.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center">
                        <PawPrint className="w-8 h-8 text-[#5A7C7A]" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl font-bold text-[#4F4F4F]">{selectedPatient.name}</h1>
                      <p className="text-sm text-gray-500 capitalize">{selectedPatient.species} &middot; {selectedPatient.breed}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Owner: {selectedPatient.ownerFirstName} {selectedPatient.ownerLastName} &middot; {selectedPatient.clinicBranchName || selectedPatient.clinicName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 bg-[#476B6B] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a5a5a] transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    New Record
                  </button>
                </div>
              </div>
            </div>

            {/* Medical Records */}
            <div className="space-y-6">
              {/* Current Record Section */}
              <div>
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-4">Current Medical Record</h2>

                {loadingRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : currentRecord ? (
                  <div className="bg-gradient-to-br from-[#7FA5A3]/5 to-[#476B6B]/5 rounded-xl p-6 shadow-md border-2 border-[#7FA5A3]/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <p className="text-sm font-semibold text-[#2C3E2D]">Active Medical Record</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(currentRecord.createdAt)}
                          </span>
                          <span>
                            Dr. {currentRecord.vetId?.firstName} {currentRecord.vetId?.lastName}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span>{currentRecord.clinicId?.name}</span>
                        </div>
                        {currentRecord.overallObservation && (
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{currentRecord.overallObservation}</p>
                        )}

                        {/* Vitals Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                          {currentRecord.vitals?.weight?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-gray-500 font-medium">Weight</p>
                              <p className="text-sm font-semibold text-blue-600">{currentRecord.vitals.weight.value} kg</p>
                            </div>
                          )}
                          {currentRecord.vitals?.temperature?.value && (
                            <div className="bg-white rounded-lg p-2 border border-orange-100">
                              <p className="text-[10px] text-gray-500 font-medium">Temperature</p>
                              <p className="text-sm font-semibold text-orange-600">{currentRecord.vitals.temperature.value}°C</p>
                            </div>
                          )}
                          {currentRecord.vitals?.pulseRate?.value && (
                            <div className="bg-white rounded-lg p-2 border border-red-100">
                              <p className="text-[10px] text-gray-500 font-medium">Pulse</p>
                              <p className="text-sm font-semibold text-red-600">{currentRecord.vitals.pulseRate.value} bpm</p>
                            </div>
                          )}
                          {currentRecord.vitals?.spo2?.value && (
                            <div className="bg-white rounded-lg p-2 border border-violet-100">
                              <p className="text-[10px] text-gray-500 font-medium">SpO2</p>
                              <p className="text-sm font-semibold text-violet-600">{currentRecord.vitals.spo2.value}%</p>
                            </div>
                          )}
                          {currentRecord.vitals?.bodyConditionScore?.value && (
                            <div className="bg-white rounded-lg p-2 border border-emerald-100">
                              <p className="text-[10px] text-gray-500 font-medium">BCS</p>
                              <p className="text-sm font-semibold text-emerald-600">{currentRecord.vitals.bodyConditionScore.value}/9</p>
                            </div>
                          )}
                        </div>

                        {/* Additional Vitals */}
                        {(currentRecord.vitals?.dentalScore?.value || 
                          currentRecord.vitals?.crt?.value || 
                          currentRecord.vitals?.pregnancy?.value || 
                          currentRecord.vitals?.xray?.value || 
                          currentRecord.vitals?.vaccinated?.value) && (
                          <div className="mt-3 space-y-1">
                            {currentRecord.vitals?.dentalScore?.value && (
                              <p className="text-xs text-gray-600">Dental Score: <span className="font-semibold">{currentRecord.vitals.dentalScore.value}/4</span></p>
                            )}
                            {currentRecord.vitals?.crt?.value && (
                              <p className="text-xs text-gray-600">CRT: <span className="font-semibold">{currentRecord.vitals.crt.value} sec</span></p>
                            )}
                            {currentRecord.vitals?.pregnancy?.value && (
                              <p className="text-xs text-gray-600">Pregnancy: <span className="font-semibold">{currentRecord.vitals.pregnancy.value}</span></p>
                            )}
                            {currentRecord.vitals?.xray?.value && (
                              <p className="text-xs text-gray-600">X-Ray: <span className="font-semibold">{currentRecord.vitals.xray.value}</span></p>
                            )}
                            {currentRecord.vitals?.vaccinated?.value && (
                              <p className="text-xs text-gray-600">Vaccinated: <span className="font-semibold">{currentRecord.vitals.vaccinated.value}</span></p>
                            )}
                          </div>
                        )}

                        {/* Images indicator */}
                        {currentRecord.images && currentRecord.images.length > 0 && (
                          <div className="mt-3 flex items-center gap-1 text-xs text-gray-600">
                            <ImageIcon className="w-3 h-3" />
                            {currentRecord.images.length} attachment{currentRecord.images.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <button
                          onClick={() => handleToggleShare(currentRecord._id, !!currentRecord.sharedWithOwner)}
                          className={`p-2 rounded-lg transition-colors ${
                            currentRecord.sharedWithOwner
                              ? 'text-green-600 bg-green-50 hover:bg-green-100'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-[#5A7C7A]'
                          }`}
                          title={currentRecord.sharedWithOwner ? 'Unshare from owner' : 'Share with owner'}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewRecord(currentRecord._id)}
                          className="p-2 rounded-lg text-[#5A7C7A] hover:bg-[#7FA5A3]/10 transition-colors"
                          title="View full record"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditRecord(currentRecord._id)}
                          className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                          title="Edit record"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">No medical records yet</h3>
                    <p className="text-gray-500 text-sm mb-4">Create a new medical record for this patient.</p>
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="inline-flex items-center gap-2 bg-[#7FA5A3] text-white px-5 py-2.5 rounded-xl hover:bg-[#6b9391] transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Create Record
                    </button>
                  </div>
                )}
              </div>

              {/* Historical Records Section */}
              {historicalRecords.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-[#4F4F4F] mb-4">Historical Records ({historicalRecords.length})</h2>
                  <div className="space-y-3">
                    {historicalRecords.map((record) => (
                      <div key={record._id} className="bg-white rounded-xl p-5 shadow-sm border-l-[3px] border-l-gray-300 hover:border-l-[#7FA5A3] transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm font-semibold text-[#4F4F4F]">Past Record</p>
                              {record.sharedWithOwner && (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-green-50 text-green-600 font-medium">
                                  <Check className="w-3 h-3" />
                                  Shared
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(record.createdAt)}
                              </span>
                              <span>
                                Dr. {record.vetId?.firstName} {record.vetId?.lastName}
                              </span>
                            </div>
                            {record.overallObservation && (
                              <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{record.overallObservation}</p>
                            )}

                            {/* Quick vitals preview */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {record.vitals?.weight?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">
                                  Weight: {record.vitals.weight.value} kg
                                </span>
                              )}
                              {record.vitals?.temperature?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600">
                                  Temp: {record.vitals.temperature.value}&deg;C
                                </span>
                              )}
                              {record.vitals?.pulseRate?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-50 text-red-600">
                                  Pulse: {record.vitals.pulseRate.value} bpm
                                </span>
                              )}
                              {record.images && record.images.length > 0 && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-50 text-purple-600 flex items-center gap-0.5">
                                  <ImageIcon className="w-3 h-3" />
                                  {record.images.length} image{record.images.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <button
                              onClick={() => handleToggleShare(record._id, !!record.sharedWithOwner)}
                              className={`p-2 rounded-lg transition-colors ${
                                record.sharedWithOwner
                                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                  : 'text-gray-400 hover:bg-gray-100 hover:text-[#5A7C7A]'
                              }`}
                              title={record.sharedWithOwner ? 'Unshare from owner' : 'Share with owner'}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewRecord(record._id)}
                              className="p-2 rounded-lg text-[#5A7C7A] hover:bg-[#7FA5A3]/10 transition-colors"
                              title="View record"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditRecord(record._id)}
                              className="p-2 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                              title="Edit record"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Record Modal */}
      {selectedPatient && (
        <CreateRecordModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          patient={selectedPatient}
          onCreated={() => {
            setCreateOpen(false)
            loadRecords(selectedPatient._id)
          }}
        />
      )}

      {/* Edit Record Modal */}
      {selectedPatient && (
        <EditRecordModal
          record={editRecord}
          loading={editLoading}
          onClose={() => setEditRecord(null)}
          onUpdated={() => {
            setEditRecord(null)
            loadRecords(selectedPatient._id)
          }}
        />
      )}

      {/* View Record Modal */}
      <ViewRecordModal
        open={viewOpen}
        recordIds={allRecordIds}
        initialIndex={viewInitialIndex}
        token={token || ''}
        onClose={() => setViewOpen(false)}
        onToggleShare={(id, shared) => {
          handleToggleShare(id, shared)
        }}
      />
    </DashboardLayout>
  )
}

// ==================== CHECKBOX VITALS SECTION ====================

function CheckboxVitalsSection({
  vitals,
  onToggle,
  extraCheckboxes,
  onExtraToggle,
}: {
  vitals: Vitals
  onToggle: (key: keyof Vitals) => void
  extraCheckboxes: ExtraCheckboxState
  onExtraToggle: (key: typeof extraCheckboxKeys[number]) => void
}) {
  const allCheckboxItems = [
    ...checkboxVitalKeys.map((key) => ({
      key,
      label: checkboxVitalLabels[key],
      checked: vitals[key]?.value === 'Yes',
      onToggle: () => onToggle(key as keyof Vitals),
    })),
    ...extraCheckboxKeys.map((key) => ({
      key,
      label: extraCheckboxLabels[key],
      checked: extraCheckboxes[key],
      onToggle: () => onExtraToggle(key),
    })),
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Services & Observations</h3>
      <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {allCheckboxItems.map(({ key, label, checked, onToggle }) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div
                onClick={onToggle}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                  checked
                    ? 'bg-[#476B6B] border-[#476B6B]'
                    : 'bg-white border-gray-300 group-hover:border-[#7FA5A3]'
                }`}
              >
                {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs text-[#4F4F4F]">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== CREATE RECORD MODAL ====================

function CreateRecordModal({
  open,
  onClose,
  patient,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  patient: PatientPet
  onCreated: () => void
}) {
  const { token } = useAuthStore()
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())
  const [extraCheckboxes, setExtraCheckboxes] = useState<ExtraCheckboxState>(emptyExtraCheckboxes())
  const [overallObservation, setOverallObservation] = useState('')
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setVitals(emptyVitals())
      setExtraCheckboxes(emptyExtraCheckboxes())
      setOverallObservation('')
      setImages([])
    }
  }, [open])

  const updateVital = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }))
  }

  const toggleCheckboxVital = (key: keyof Vitals) => {
    setVitals((prev) => ({
      ...prev,
      [key]: { ...prev[key], value: prev[key].value === 'Yes' ? 'No' : 'Yes' },
    }))
  }

  const toggleExtraCheckbox = (key: typeof extraCheckboxKeys[number]) => {
    setExtraCheckboxes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        setImages((prev) => [
          ...prev,
          { data: base64, contentType: file.type, description: file.name },
        ])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      // Build observation note with extra checkboxes
      const checkedExtras = extraCheckboxKeys.filter((k) => extraCheckboxes[k]).map((k) => extraCheckboxLabels[k])
      const extraNote = checkedExtras.length > 0 ? `\n\nServices availed: ${checkedExtras.join(', ')}` : ''
      const finalObservation = overallObservation + extraNote

      const res = await createMedicalRecord(
        {
          petId: patient._id,
          clinicId: patient.clinicId,
          clinicBranchId: patient.clinicBranchId,
          vitals,
          images: images.length > 0 ? images : undefined,
          overallObservation: finalObservation || undefined,
        },
        token
      )
      if (res.status === 'SUCCESS') {
        toast.success('Medical record created successfully!')
        onCreated()
      } else {
        toast.error(res.message || 'Failed to create record')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#4F4F4F] flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#5A7C7A]" />
            New Medical Record for {patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Vitals Section */}
          <div>
            <h3 className="text-sm font-semibold text-[#2C3E2D] mb-3">Vitals</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(vitalLabels) as (keyof Vitals)[]).map((key) => {
                const { label, unit, placeholder } = vitalLabels[key]
                return (
                  <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <label className="block text-xs font-medium text-[#4F4F4F] mb-1">
                      {label} {unit && <span className="text-gray-400">({unit})</span>}
                    </label>
                    <input
                      type="text"
                      value={vitals[key].value}
                      onChange={(e) => updateVital(key, 'value', e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                    />
                    <input
                      type="text"
                      value={vitals[key].notes}
                      onChange={(e) => updateVital(key, 'notes', e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full px-3 py-1.5 mt-1.5 border border-gray-100 rounded-lg text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Checkbox Vitals + Extra Services */}
          <CheckboxVitalsSection
            vitals={vitals}
            onToggle={toggleCheckboxVital}
            extraCheckboxes={extraCheckboxes}
            onExtraToggle={toggleExtraCheckbox}
          />

          {/* Overall Observation */}
          <div>
            <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Overall Observation</h3>
            <textarea
              value={overallObservation}
              onChange={(e) => setOverallObservation(e.target.value)}
              placeholder="Write your general observations, notes, and recommendations..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Images / Attachments</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2]/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to upload images</p>
              <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, PDF supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative bg-gray-50 rounded-lg px-3 py-2 pr-8 text-xs text-gray-600 border border-gray-200">
                    <ImageIcon className="w-3 h-3 inline-block mr-1" />
                    {img.description || `Image ${idx + 1}`}
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Record'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== EDIT RECORD MODAL ====================

function EditRecordModal({
  record,
  loading,
  onClose,
  onUpdated,
}: {
  record: MedicalRecord | null
  loading: boolean
  onClose: () => void
  onUpdated: () => void
}) {
  const { token } = useAuthStore()
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())
  const [extraCheckboxes, setExtraCheckboxes] = useState<ExtraCheckboxState>(emptyExtraCheckboxes())
  const [overallObservation, setOverallObservation] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [visitSummary, setVisitSummary] = useState('')
  const [subjective, setSubjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [vetNotes, setVetNotes] = useState('')
  const [medications, setMedications] = useState<Omit<Medication, '_id'>[]>([])
  const [diagnosticTests, setDiagnosticTests] = useState<Omit<DiagnosticTest, '_id'>[]>([])
  const [preventiveCare, setPreventiveCare] = useState<Omit<PreventiveCare, '_id'>[]>([])
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [medsOpen, setMedsOpen] = useState(false)
  const [testsOpen, setTestsOpen] = useState(false)
  const [preventiveOpen, setPreventiveOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emptyMed = (): Omit<Medication, '_id'> => ({ name: '', dosage: '', route: 'oral', frequency: '', duration: '', startDate: null, endDate: null, notes: '', status: 'active' })
  const emptyTest = (): Omit<DiagnosticTest, '_id'> => ({ testType: 'other', name: '', date: null, result: '', normalRange: '', notes: '' })
  const emptyPC = (): Omit<PreventiveCare, '_id'> => ({ careType: 'other', product: '', dateAdministered: null, nextDueDate: null, notes: '' })

  // Populate form when record loads
  useEffect(() => {
    if (record) {
      setVitals(record.vitals || emptyVitals())
      setOverallObservation(record.overallObservation || '')
      setChiefComplaint(record.chiefComplaint || '')
      setVisitSummary(record.visitSummary || '')
      setSubjective(record.subjective || '')
      setAssessment(record.assessment || '')
      setPlan(record.plan || '')
      setVetNotes(record.vetNotes || '')
      setMedications((record.medications || []).map(({ _id: _, ...rest }) => rest))
      setDiagnosticTests((record.diagnosticTests || []).map(({ _id: _, ...rest }) => rest))
      setPreventiveCare((record.preventiveCare || []).map(({ _id: _, ...rest }) => rest))
      setSharedWithOwner(record.sharedWithOwner || false)
      setExtraCheckboxes(emptyExtraCheckboxes())
    }
  }, [record])

  const updateVital = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }))
  }

  const toggleCheckboxVital = (key: keyof Vitals) => {
    setVitals((prev) => ({
      ...prev,
      [key]: { ...prev[key], value: prev[key].value === 'Yes' ? 'No' : 'Yes' },
    }))
  }

  const toggleExtraCheckbox = (key: typeof extraCheckboxKeys[number]) => {
    setExtraCheckboxes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    if (!token || !record) return
    setSubmitting(true)
    try {
      const checkedExtras = extraCheckboxKeys.filter((k) => extraCheckboxes[k]).map((k) => extraCheckboxLabels[k])
      const extraNote = checkedExtras.length > 0 ? `\n\nServices availed: ${checkedExtras.join(', ')}` : ''
      const finalObservation = overallObservation + extraNote

      const res = await updateMedicalRecord(
        record._id,
        {
          vitals,
          overallObservation: finalObservation,
          chiefComplaint,
          visitSummary,
          subjective,
          assessment,
          plan,
          vetNotes,
          medications,
          diagnosticTests,
          preventiveCare,
          sharedWithOwner,
        },
        token
      )
      if (res.status === 'SUCCESS') {
        toast.success('Medical record updated successfully!')
        onUpdated()
      } else {
        toast.error(res.message || 'Failed to update record')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!record || loading} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : record ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[#4F4F4F] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                Edit Medical Record
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-2">
              {/* Chief Complaint */}
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Chief Complaint</h3>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={2}
                  placeholder="Reason for visit, owner's complaint…"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                />
              </div>

              {/* Vitals Section */}
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-3">Vitals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(vitalLabels) as (keyof Vitals)[]).map((key) => {
                    const { label, unit, placeholder } = vitalLabels[key]
                    return (
                      <div key={key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <label className="block text-xs font-medium text-[#4F4F4F] mb-1">
                          {label} {unit && <span className="text-gray-400">({unit})</span>}
                        </label>
                        <input
                          type="text"
                          value={vitals[key].value}
                          onChange={(e) => updateVital(key, 'value', e.target.value)}
                          placeholder={placeholder}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                        />
                        <input
                          type="text"
                          value={vitals[key].notes}
                          onChange={(e) => updateVital(key, 'notes', e.target.value)}
                          placeholder="Notes (optional)"
                          className="w-full px-3 py-1.5 mt-1.5 border border-gray-100 rounded-lg text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Checkbox Vitals + Extra Services */}
              <CheckboxVitalsSection
                vitals={vitals}
                onToggle={toggleCheckboxVital}
                extraCheckboxes={extraCheckboxes}
                onExtraToggle={toggleExtraCheckbox}
              />

              {/* Overall Observation */}
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Overall Observation (O)</h3>
                <textarea
                  value={overallObservation}
                  onChange={(e) => setOverallObservation(e.target.value)}
                  placeholder="Physical exam findings, clinical impression…"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                />
              </div>

              {/* SOAP Notes */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#2C3E2D]">SOAP Notes</h3>
                {[
                  { label: 'S — Subjective', placeholder: 'Patient history, owner complaint…', val: subjective, set: setSubjective },
                  { label: 'A — Assessment', placeholder: 'Diagnosis, differential diagnosis…', val: assessment, set: setAssessment },
                  { label: 'P — Plan', placeholder: 'Treatment plan, next steps…', val: plan, set: setPlan },
                ].map(({ label, placeholder, val, set }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-[#476B6B] mb-1">{label}</label>
                    <textarea
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      rows={2}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] resize-none"
                    />
                  </div>
                ))}
              </div>

              {/* Visit Summary */}
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Visit Summary</h3>
                <textarea
                  value={visitSummary}
                  onChange={(e) => setVisitSummary(e.target.value)}
                  rows={2}
                  placeholder="Brief summary of visit outcome…"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                />
              </div>

              {/* Vet Notes */}
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2 flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-gray-400" /> Vet Notes <span className="font-normal text-gray-400 text-xs">(private)</span>
                </h3>
                <textarea
                  value={vetNotes}
                  onChange={(e) => setVetNotes(e.target.value)}
                  rows={2}
                  placeholder="Private notes not visible to owner…"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none bg-gray-50"
                />
              </div>

              {/* Medications */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMedsOpen(!medsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#2C3E2D] flex items-center gap-2">
                    <Pill className="w-4 h-4 text-[#7FA5A3]" /> Medications ({medications.length})
                  </span>
                  {medsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {medsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {medications.map((med, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-gray-400">Medication {i + 1}</span>
                          <button type="button" onClick={() => setMedications((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Name *" value={med.name} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, name: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Dosage" value={med.dosage} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.route} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, route: e.target.value as Medication['route'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="oral">Oral</option><option value="topical">Topical</option><option value="injection">Injection</option><option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Frequency" value={med.frequency} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Duration" value={med.duration} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, duration: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.status} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, status: e.target.value as Medication['status'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="active">Active</option><option value="completed">Completed</option><option value="discontinued">Discontinued</option>
                          </select>
                        </div>
                        <input type="text" placeholder="Notes" value={med.notes} onChange={(e) => setMedications((p) => p.map((m, j) => j === i ? { ...m, notes: e.target.value } : m))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button type="button" onClick={() => setMedications((p) => [...p, emptyMed()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium">
                      <Plus className="w-3.5 h-3.5" /> Add Medication
                    </button>
                  </div>
                )}
              </div>

              {/* Diagnostic Tests */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTestsOpen(!testsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#2C3E2D] flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#7FA5A3]" /> Diagnostic Tests ({diagnosticTests.length})
                  </span>
                  {testsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {testsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {diagnosticTests.map((test, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-gray-400">Test {i + 1}</span>
                          <button type="button" onClick={() => setDiagnosticTests((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={test.testType} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, testType: e.target.value as DiagnosticTest['testType'] } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="blood_work">Blood Work</option><option value="x_ray">X-Ray</option><option value="ultrasound">Ultrasound</option><option value="urinalysis">Urinalysis</option><option value="ecg">ECG</option><option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Name" value={test.name} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, name: e.target.value } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="date" value={test.date || ''} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, date: e.target.value || null } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Normal range" value={test.normalRange} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, normalRange: e.target.value } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                        </div>
                        <textarea rows={2} placeholder="Result" value={test.result} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, result: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] resize-none" />
                        <input type="text" placeholder="Notes" value={test.notes} onChange={(e) => setDiagnosticTests((p) => p.map((t, j) => j === i ? { ...t, notes: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button type="button" onClick={() => setDiagnosticTests((p) => [...p, emptyTest()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium">
                      <Plus className="w-3.5 h-3.5" /> Add Test
                    </button>
                  </div>
                )}
              </div>

              {/* Preventive Care */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreventiveOpen(!preventiveOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#2C3E2D] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#7FA5A3]" /> Preventive Care ({preventiveCare.length})
                  </span>
                  {preventiveOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {preventiveOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {preventiveCare.map((care, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-gray-400">Item {i + 1}</span>
                          <button type="button" onClick={() => setPreventiveCare((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={care.careType} onChange={(e) => setPreventiveCare((p) => p.map((c, j) => j === i ? { ...c, careType: e.target.value as PreventiveCare['careType'] } : c))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="flea">Flea</option><option value="tick">Tick</option><option value="heartworm">Heartworm</option><option value="deworming">Deworming</option><option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Product" value={care.product} onChange={(e) => setPreventiveCare((p) => p.map((c, j) => j === i ? { ...c, product: e.target.value } : c))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Date Administered</label>
                            <input type="date" value={care.dateAdministered || ''} onChange={(e) => setPreventiveCare((p) => p.map((c, j) => j === i ? { ...c, dateAdministered: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Next Due</label>
                            <input type="date" value={care.nextDueDate || ''} onChange={(e) => setPreventiveCare((p) => p.map((c, j) => j === i ? { ...c, nextDueDate: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                        </div>
                        <input type="text" placeholder="Notes" value={care.notes} onChange={(e) => setPreventiveCare((p) => p.map((c, j) => j === i ? { ...c, notes: e.target.value } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button type="button" onClick={() => setPreventiveCare((p) => [...p, emptyPC()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium">
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Share with Owner */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Share with Owner</p>
                  <p className="text-xs text-gray-500">{sharedWithOwner ? 'Owner can view this record' : 'Record is private'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSharedWithOwner(!sharedWithOwner)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${sharedWithOwner ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sharedWithOwner ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ==================== VIEW RECORD MODAL ====================

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function calculateAge(dob: string) {
  const birth = new Date(dob)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (years > 0) return `${years} yr${years !== 1 ? 's' : ''}${months > 0 ? ` ${months} mo` : ''}`
  return `${months} mo`
}

function ViewRecordModal({
  open,
  recordIds,
  initialIndex,
  token,
  onClose,
  onToggleShare,
}: {
  open: boolean
  recordIds: string[]
  initialIndex: number
  token: string
  onClose: () => void
  onToggleShare: (id: string, currentlyShared: boolean) => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [record, setRecord] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset index when modal opens
  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  // Load record whenever index changes
  useEffect(() => {
    if (!open || !recordIds[index] || !token) return
    setLoading(true)
    setRecord(null)
    getRecordById(recordIds[index], token).then((res) => {
      if (res.status === 'SUCCESS' && res.data?.record) setRecord(res.data.record)
    }).finally(() => setLoading(false))
  }, [open, index, recordIds, token])

  const total = recordIds.length
  const pet = record?.petId
  const vet = record?.vetId
  const clinic = record?.clinicId
  const branch = record?.clinicBranchId

  const handlePrint = () => {
    if (!record) return
    const petName = pet?.name || 'Unknown'
    const vetName = `Dr. ${vet?.firstName || ''} ${vet?.lastName || ''}`.trim()
    const clinicName = [clinic?.name, branch?.name].filter(Boolean).join(' — ')
    const visitDate = formatFullDate(record.createdAt)

    const vitalRows = (Object.keys(vitalLabels) as (keyof Vitals)[]).map((key) => {
      const { label, unit } = vitalLabels[key]
      const entry = record.vitals?.[key]
      const val = entry?.value || entry?.value === 0 ? `${entry.value}${unit ? ' ' + unit : ''}` : '—'
      return `<tr><td>${label}</td><td><strong>${val}</strong></td><td>${entry?.notes || '—'}</td></tr>`
    }).join('')

    const checkboxRows = checkboxVitalKeys.map((key) => {
      const label = checkboxVitalLabels[key]
      const entry = record.vitals?.[key]
      const val = entry?.value || '—'
      return `<tr><td>${label}</td><td><strong>${val}</strong></td><td>${entry?.notes || '—'}</td></tr>`
    }).join('')

    const medRows = (record.medications || []).map((m: Medication) =>
      `<tr><td>${m.name||'—'}</td><td>${m.dosage||'—'}</td><td>${m.route||'—'}</td><td>${m.frequency||'—'}</td><td>${m.duration||'—'}</td><td>${m.status||'—'}</td></tr>`
    ).join('')

    const testCards = (record.diagnosticTests || []).map((t: DiagnosticTest) =>
      `<div class="test-card"><strong>${t.name||t.testType}</strong> <span class="sub">${(t.testType||'').replace('_',' ')}</span>${t.date ? `<br><span class="sub">${new Date(t.date).toLocaleDateString()}</span>` : ''}${t.result ? `<p>${t.result}</p>` : ''}${t.normalRange ? `<span class="sub">Normal: ${t.normalRange}</span>` : ''}</div>`
    ).join('')

    const careRows = (record.preventiveCare || []).map((c: PreventiveCare) =>
      `<tr><td>${(c.careType||'—').replace('_',' ')}</td><td>${c.product||'—'}</td><td>${c.dateAdministered ? new Date(c.dateAdministered).toLocaleDateString() : '—'}</td><td>${c.nextDueDate ? new Date(c.nextDueDate).toLocaleDateString() : '—'}</td></tr>`
    ).join('')

    const soapSection = (record.subjective || record.assessment || record.plan) ? `
      <div class="section">
        <div class="section-header">SOAP NOTES</div>
        <div class="section-body">
          ${record.subjective ? `<p class="soap-label">S — Subjective</p><p>${record.subjective}</p>` : ''}
          ${record.assessment ? `<p class="soap-label">A — Assessment</p><p>${record.assessment}</p>` : ''}
          ${record.plan ? `<p class="soap-label">P — Plan</p><p>${record.plan}</p>` : ''}
        </div>
      </div>` : ''

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Medical Record — ${petName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#2c2c2c;background:#fff;padding:0}
      .header{background:#476B6B;color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}
      .header h1{font-size:18px;font-weight:700;letter-spacing:.05em}
      .header .sub{opacity:.7;font-size:12px;margin-top:4px}
      .header .id{text-align:right;font-size:11px;opacity:.7}
      .header .id span{display:block;font-family:monospace;font-size:14px;opacity:.9}
      .visit-nav{background:#f0f7f7;border-bottom:1px solid #dde8e8;padding:8px 32px;font-size:12px;color:#476B6B;font-weight:600}
      .content{padding:24px 32px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
      .section{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px}
      .section-header{background:#f9fafb;padding:8px 16px;font-size:10px;font-weight:700;color:#476B6B;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #e5e7eb}
      .section-body{padding:12px 16px}
      .pet-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
      .avatar{width:48px;height:48px;border-radius:50%;background:#d1e3e3;display:flex;align-items:center;justify-content:center;font-size:20px}
      .pet-name{font-size:16px;font-weight:700}
      .grid-info{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
      .info-label{font-size:9px;text-transform:uppercase;color:#9ca3af;margin-bottom:1px}
      .info-val{font-size:12px;color:#374151}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:600;padding:0 8px 6px 0;border-bottom:1px solid #f3f4f6}
      td{padding:6px 8px 6px 0;border-bottom:1px solid #f9fafb;vertical-align:top}
      tr:last-child td{border-bottom:none}
      .soap-label{font-size:10px;font-weight:700;color:#476B6B;text-transform:uppercase;letter-spacing:.05em;margin:8px 0 3px}
      .soap-label:first-child{margin-top:0}
      p{margin:4px 0;line-height:1.5}
      .test-card{background:#f9fafb;border-radius:8px;padding:10px;margin-bottom:8px}
      .test-card:last-child{margin-bottom:0}
      .sub{font-size:10px;color:#9ca3af}
      .footer{border-top:2px solid #e5e7eb;padding:16px 32px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px}
      .sig-line{width:180px;border-bottom:1px solid #9ca3af;margin-bottom:4px}
      .sig-label{font-size:10px;color:#9ca3af}
      .allergy-tag{display:inline-block;background:#fffbeb;border:1px solid #fde68a;color:#b45309;border-radius:4px;padding:1px 6px;font-size:11px;margin:2px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="header">
      <div><h1>VETERINARY MEDICAL RECORD</h1><div class="sub">${clinicName}</div></div>
      <div class="id">Record ID<span>${record._id.slice(-8).toUpperCase()}</span></div>
    </div>
    ${total > 1 ? `<div class="visit-nav">Visit ${index + 1} of ${total}</div>` : ''}
    <div class="content">
      <div class="grid2">
        <div class="section">
          <div class="section-header">Patient Information</div>
          <div class="section-body">
            <div class="pet-header"><div class="avatar">🐾</div><div class="pet-name">${petName}</div></div>
            <div class="grid-info">
              <div><div class="info-label">Species</div><div class="info-val">${pet?.species||'—'}</div></div>
              <div><div class="info-label">Breed</div><div class="info-val">${pet?.breed||'—'}</div></div>
              <div><div class="info-label">Sex</div><div class="info-val">${pet?.sex||'—'}</div></div>
              <div><div class="info-label">Age</div><div class="info-val">${pet?.dateOfBirth ? calculateAge(pet.dateOfBirth) : '—'}</div></div>
              ${pet?.microchipNumber ? `<div class="col-span-2"><div class="info-label">Microchip</div><div class="info-val" style="font-family:monospace">${pet.microchipNumber}</div></div>` : ''}
            </div>
            ${pet?.allergies?.length ? `<div style="margin-top:8px"><div class="info-label" style="margin-bottom:4px">⚠ Allergies</div>${pet.allergies.map((a: string) => `<span class="allergy-tag">${a}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="section">
          <div class="section-header">Visit Information</div>
          <div class="section-body">
            <div style="margin-bottom:10px"><div class="info-label">Date of Examination</div><div class="info-val" style="font-weight:600">${visitDate}</div></div>
            <div style="margin-bottom:10px"><div class="info-label">Attending Veterinarian</div><div class="info-val" style="font-weight:600">${vetName}</div>${vet?.email ? `<div class="sub">${vet.email}</div>` : ''}</div>
            <div><div class="info-label">Clinic / Branch</div><div class="info-val">${clinicName||'—'}</div></div>
          </div>
        </div>
      </div>
      ${record.chiefComplaint ? `<div class="section"><div class="section-header">Chief Complaint / Reason for Visit</div><div class="section-body"><p>${record.chiefComplaint}</p></div></div>` : ''}
      <div class="section">
        <div class="section-header">Physical Examination</div>
        <div class="section-body"><table><thead><tr><th>Parameter</th><th>Value</th><th>Notes</th></tr></thead><tbody>${vitalRows}${checkboxRows}</tbody></table></div>
      </div>
      ${record.overallObservation ? `<div class="section"><div class="section-header">Clinical Assessment &amp; Observation</div><div class="section-body"><p>${record.overallObservation}</p></div></div>` : ''}
      ${soapSection}
      ${record.visitSummary ? `<div class="section"><div class="section-header">Visit Summary</div><div class="section-body"><p>${record.visitSummary}</p></div></div>` : ''}
      ${(record.medications||[]).length ? `<div class="section"><div class="section-header">💊 Medications</div><div class="section-body"><table><thead><tr><th>Name</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Status</th></tr></thead><tbody>${medRows}</tbody></table></div></div>` : ''}
      ${(record.diagnosticTests||[]).length ? `<div class="section"><div class="section-header">🧪 Diagnostic Tests</div><div class="section-body">${testCards}</div></div>` : ''}
      ${(record.preventiveCare||[]).length ? `<div class="section"><div class="section-header">🛡 Preventive Care</div><div class="section-body"><table><thead><tr><th>Type</th><th>Product</th><th>Administered</th><th>Next Due</th></tr></thead><tbody>${careRows}</tbody></table></div></div>` : ''}
      <div class="footer">
        <div><div class="sig-line"></div><div class="sig-label">${vetName}</div><div class="sig-label">Attending Veterinarian</div></div>
        <div style="text-align:right"><div class="sig-label">${visitDate}</div><div class="sig-label">Date of Record</div></div>
      </div>
    </div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : record ? (
          <div className="bg-white">
            {/* ===== DOCUMENT HEADER ===== */}
            <div className="bg-[#476B6B] text-white px-8 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-wide">VETERINARY MEDICAL RECORD</h1>
                  <p className="text-white/70 text-sm mt-1">
                    {clinic?.name || 'Clinic'}
                    {branch?.name ? ` — ${branch.name}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60">Record ID</p>
                  <p className="text-sm font-mono text-white/90">{record._id.slice(-8).toUpperCase()}</p>
                </div>
              </div>
              {(clinic?.address || branch?.address) && (
                <p className="text-xs text-white/50 mt-2">
                  {branch?.address || clinic?.address}
                  {clinic?.phone ? ` | ${clinic.phone}` : ''}
                  {clinic?.email ? ` | ${clinic.email}` : ''}
                </p>
              )}
            </div>

            {/* ===== VISIT NAVIGATION ===== */}
            {total > 1 && (
              <div className="flex items-center justify-between px-8 py-2.5 bg-[#f0f7f7] border-b border-[#dde8e8]">
                <button
                  onClick={() => setIndex((i) => i + 1)}
                  disabled={index >= total - 1}
                  className="flex items-center gap-1 text-xs font-medium text-[#476B6B] disabled:text-gray-300 hover:text-[#3a5a5a] disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-4 h-4" /> Older Visit
                </button>
                <span className="text-xs font-semibold text-[#476B6B]">
                  Visit {index + 1} of {total}
                  {index === 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-[#476B6B] text-white rounded text-[10px]">Current</span>}
                </span>
                <button
                  onClick={() => setIndex((i) => i - 1)}
                  disabled={index <= 0}
                  className="flex items-center gap-1 text-xs font-medium text-[#476B6B] disabled:text-gray-300 hover:text-[#3a5a5a] disabled:cursor-not-allowed"
                >
                  Newer Visit <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="px-8 py-6 space-y-6">
              {/* ===== PATIENT & VISIT INFO ===== */}
              <div className="grid grid-cols-2 gap-6">
                {/* Patient Information */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Patient Information</h2>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {pet?.photo ? (
                        <img src={pet.photo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[#7FA5A3]/20" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                          <PawPrint className="w-6 h-6 text-[#5A7C7A]" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-[#4F4F4F] text-lg">{pet?.name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Species</p>
                        <p className="text-sm text-[#4F4F4F] capitalize">{pet?.species || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Breed</p>
                        <p className="text-sm text-[#4F4F4F] capitalize">{pet?.breed || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Sex</p>
                        <p className="text-sm text-[#4F4F4F] capitalize">{pet?.sex || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Age</p>
                        <p className="text-sm text-[#4F4F4F]">{pet?.dateOfBirth ? calculateAge(pet.dateOfBirth) : '—'}</p>
                      </div>
                      {pet?.microchipNumber && (
                        <div className="col-span-2">
                          <p className="text-[10px] text-gray-400 uppercase">Microchip</p>
                          <p className="text-sm font-mono text-[#4F4F4F]">{pet.microchipNumber}</p>
                        </div>
                      )}
                    </div>
                    {pet?.allergies && pet.allergies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase flex items-center gap-1 mb-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> Allergies
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {pet.allergies.map((a: string, i: number) => (
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
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Visit Information</h2>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Date of Examination</p>
                      <p className="text-sm font-medium text-[#4F4F4F]">{formatFullDate(record.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Attending Veterinarian</p>
                      <p className="text-sm font-medium text-[#4F4F4F]">
                        Dr. {vet?.firstName} {vet?.lastName}
                      </p>
                      {vet?.email && <p className="text-xs text-gray-400">{vet.email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Clinic / Branch</p>
                      <p className="text-sm text-[#4F4F4F]">
                        {clinic?.name || '—'}
                        {branch?.name ? ` — ${branch.name}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== CHIEF COMPLAINT ===== */}
              {record.chiefComplaint && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Chief Complaint / Reason for Visit</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.chiefComplaint}</p>
                  </div>
                </div>
              )}

              {/* ===== PHYSICAL EXAMINATION / VITALS ===== */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Physical Examination</h2>
                </div>
                <div className="p-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 w-[35%]">Parameter</th>
                        <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2 w-[25%]">Value</th>
                        <th className="text-left text-[10px] text-gray-400 uppercase font-semibold pb-2">Notes</th>
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
                            <td className="py-2 text-xs text-gray-500">{entry?.notes || '—'}</td>
                          </tr>
                        )
                      })}
                      {/* Checkbox vitals in view */}
                      {checkboxVitalKeys.map((key) => {
                        const label = checkboxVitalLabels[key]
                        const entry = record.vitals?.[key]
                        return (
                          <tr key={key} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 text-sm text-[#4F4F4F] font-medium">{label}</td>
                            <td className="py-2">
                              {entry?.value ? (
                                <span className={`text-sm font-semibold ${entry.value === 'Yes' ? 'text-green-600' : 'text-gray-400'}`}>
                                  {entry.value}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-2 text-xs text-gray-500">{entry?.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ===== CLINICAL ASSESSMENT / OBSERVATION ===== */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Clinical Assessment &amp; Observation</h2>
                </div>
                <div className="p-4">
                  {record.overallObservation ? (
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.overallObservation}</p>
                  ) : (
                    <p className="text-sm text-gray-300 italic">No observation recorded.</p>
                  )}
                </div>
              </div>

              {/* ===== SOAP NOTES ===== */}
              {(record.subjective || record.assessment || record.plan) && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">SOAP Notes</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.subjective && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">S — Subjective</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.subjective}</p>
                      </div>
                    )}
                    {record.assessment && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">A — Assessment</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.assessment}</p>
                      </div>
                    )}
                    {record.plan && (
                      <div>
                        <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">P — Plan</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.plan}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== VISIT SUMMARY ===== */}
              {record.visitSummary && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">Visit Summary</h2>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.visitSummary}</p>
                  </div>
                </div>
              )}

              {/* ===== MEDICATIONS ===== */}
              {record.medications && record.medications.length > 0 && (
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
                          <tr key={med._id || i} className="border-b border-gray-50 last:border-0">
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
              )}

              {/* ===== DIAGNOSTIC TESTS ===== */}
              {record.diagnosticTests && record.diagnosticTests.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Diagnostic Tests ({record.diagnosticTests.length})
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.diagnosticTests.map((test: DiagnosticTest, i: number) => (
                      <div key={test._id || i} className="bg-gray-50 rounded-xl p-3">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== PREVENTIVE CARE ===== */}
              {record.preventiveCare && record.preventiveCare.length > 0 && (
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
                          <tr key={care._id || i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 text-gray-600 capitalize pr-3">{care.careType?.replace('_', ' ') || '—'}</td>
                            <td className="py-2 font-medium text-[#4F4F4F] pr-3">{care.product || '—'}</td>
                            <td className="py-2 text-gray-600 pr-3">{care.dateAdministered ? new Date(care.dateAdministered).toLocaleDateString() : '—'}</td>
                            <td className="py-2 text-gray-600">{care.nextDueDate ? new Date(care.nextDueDate).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== DIAGNOSTIC IMAGES ===== */}
              {record.images && record.images.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider">
                      Diagnostic Images ({record.images.length})
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {record.images.map((img, idx) => (
                        <div key={img._id || idx} className="rounded-lg overflow-hidden border border-gray-200">
                          {img.data ? (
                            <img
                              src={`data:${img.contentType};base64,${img.data}`}
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
              )}

              {/* ===== FOOTER / SIGNATURE LINE ===== */}
              <div className="border-t-2 border-gray-200 pt-5 mt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="w-48 border-b border-gray-300 mb-1" />
                    <p className="text-xs text-gray-500">
                      Dr. {vet?.firstName} {vet?.lastName}
                    </p>
                    <p className="text-[10px] text-gray-400">Attending Veterinarian</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{formatFullDate(record.createdAt)}</p>
                    <p className="text-[10px] text-gray-400">Date of Record</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== ACTION BAR ===== */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleShare(record._id, !!record.sharedWithOwner)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    record.sharedWithOwner
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                  {record.sharedWithOwner ? 'Shared with Owner' : 'Share with Owner'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print / PDF
                </button>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}