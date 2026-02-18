'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  createMedicalRecord,
  getRecordsByPet,
  getRecordById,
  deleteMedicalRecord,
  type MedicalRecord,
  type Vitals,
  type VitalEntry,
} from '@/lib/medicalRecords'
import {
  Search,
  ClipboardList,
  Plus,
  ChevronLeft,
  PawPrint,
  Calendar,
  Eye,
  Trash2,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Stethoscope,
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

const vitalLabels: Record<keyof Vitals, { label: string; unit: string; placeholder: string }> = {
  weight: { label: 'Weight', unit: 'kg', placeholder: 'e.g. 12.5' },
  temperature: { label: 'Temperature', unit: '\u00B0C', placeholder: 'e.g. 38.5' },
  pulseRate: { label: 'Pulse Rate', unit: 'bpm', placeholder: 'e.g. 120' },
  spo2: { label: 'SpO2', unit: '%', placeholder: 'e.g. 98' },
  bodyConditionScore: { label: 'Body Condition Score', unit: '/9', placeholder: 'e.g. 5' },
  dentalScore: { label: 'Dental Score', unit: '/4', placeholder: 'e.g. 2' },
  crt: { label: 'CRT', unit: 'sec', placeholder: 'e.g. 2' },
  pregnancy: { label: 'Pregnancy', unit: '', placeholder: 'e.g. No / Yes / N/A' },
  xray: { label: 'X-Ray', unit: '', placeholder: 'e.g. Normal / Abnormal' },
  vaccinated: { label: 'Vaccinated', unit: '', placeholder: 'e.g. Yes / No / Up to date' },
}

// ==================== MAIN PAGE ====================

export default function PatientRecordsPage() {
  const { token } = useAuthStore()
  const [patients, setPatients] = useState<PatientPet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<PatientPet | null>(null)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)

  // View modal
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

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
      if (res.status === 'SUCCESS' && res.data?.records) {
        setRecords(res.data.records)
      } else {
        setRecords([])
      }
    } catch {
      setRecords([])
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
    setRecords([])
  }

  // View full record
  const handleViewRecord = async (recordId: string) => {
    if (!token) return
    setViewLoading(true)
    try {
      const res = await getRecordById(recordId, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        setViewRecord(res.data.record)
      } else {
        toast.error('Failed to load record')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setViewLoading(false)
    }
  }

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    if (!token) return
    try {
      const res = await deleteMedicalRecord(recordId, token)
      if (res.status === 'SUCCESS') {
        toast.success('Record deleted')
        if (selectedPatient) loadRecords(selectedPatient._id)
      } else {
        toast.error(res.message || 'Failed to delete')
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
  const totalRecords = records.length

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
                    <p className="text-2xl font-bold text-green-600">{patients.length > 0 ? 'Active' : '0'}</p>
                    <p className="text-xs text-gray-500">Patient Status</p>
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

            {/* Records List */}
            <div>
              <h2 className="text-lg font-semibold text-[#4F4F4F] mb-4">Medical Records ({totalRecords})</h2>

              {loadingRecords ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : records.length === 0 ? (
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
              ) : (
                <div className="space-y-3">
                  {records.map((record) => {
                    const colors = { bg: 'bg-[#7FA5A3]/5', border: 'border-l-[#7FA5A3]' }
                    return (
                      <div key={record._id} className={`bg-white rounded-xl p-5 shadow-sm border-l-[3px] ${colors.border}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />
                              <p className="text-sm font-semibold text-[#4F4F4F]">
                                Medical Record
                              </p>
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

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewRecord(record._id)}
                              className="p-2 rounded-lg text-[#5A7C7A] hover:bg-[#7FA5A3]/10 transition-colors"
                              title="View record"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record._id)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
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

      {/* View Record Modal */}
      <ViewRecordModal
        record={viewRecord}
        loading={viewLoading}
        onClose={() => setViewRecord(null)}
      />
    </DashboardLayout>
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
  const [overallObservation, setOverallObservation] = useState('')
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setVitals(emptyVitals())
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
      const res = await createMedicalRecord(
        {
          petId: patient._id,
          clinicId: patient.clinicId,
          clinicBranchId: patient.clinicBranchId,
          vitals,
          images: images.length > 0 ? images : undefined,
          overallObservation: overallObservation || undefined,
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

// ==================== VIEW RECORD MODAL ====================

function ViewRecordModal({
  record,
  loading,
  onClose,
}: {
  record: MedicalRecord | null
  loading: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={!!record || loading} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#4F4F4F] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#5A7C7A]" />
            Medical Record Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : record ? (
          <div className="space-y-6 mt-2">
            {/* Meta */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">
                    {record.petId?.name || 'Pet'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {record.petId?.species} &middot; {record.petId?.breed}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {formatDate(record.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Dr. {record.vetId?.firstName} {record.vetId?.lastName}
                  </p>
                </div>
              </div>
              {record.clinicId?.name && (
                <p className="text-[10px] text-gray-400 mt-2">
                  {record.clinicId.name}
                  {record.clinicBranchId?.name ? ` - ${record.clinicBranchId.name}` : ''}
                </p>
              )}
            </div>

            {/* Vitals */}
            <div>
              <h3 className="text-sm font-semibold text-[#2C3E2D] mb-3">Vitals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(vitalLabels) as (keyof Vitals)[]).map((key) => {
                  const { label, unit } = vitalLabels[key]
                  const entry = record.vitals?.[key]
                  if (!entry?.value && entry?.value !== 0) return null
                  return (
                    <div key={key} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <p className="text-[10px] text-gray-400 uppercase font-medium">{label}</p>
                      <p className="text-lg font-bold text-[#4F4F4F]">
                        {entry.value} <span className="text-xs font-normal text-gray-400">{unit}</span>
                      </p>
                      {entry.notes && (
                        <p className="text-[10px] text-gray-500 mt-1">{entry.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Overall Observation */}
            {record.overallObservation && (
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Overall Observation</h3>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap">{record.overallObservation}</p>
                </div>
              </div>
            )}

            {/* Images */}
            {record.images && record.images.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E2D] mb-2">Images</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {record.images.map((img, idx) => (
                    <div key={img._id || idx} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      {img.data ? (
                        <img
                          src={`data:${img.contentType};base64,${img.data}`}
                          alt={img.description || `Image ${idx + 1}`}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {img.description && (
                        <p className="text-[10px] text-gray-500 px-2 py-1.5 truncate">{img.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
