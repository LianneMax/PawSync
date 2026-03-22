'use client'

import Image from 'next/image'
import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  createMedicalRecord,
  createFollowUp,
  getRecordsByPet,
  getCurrentRecord,
  getHistoricalRecords,
  getRecordById,
  toggleShareRecord,
  type MedicalRecord,
  type FollowUp,
  type Vitals,
  type VitalEntry,
  type Medication,
  type DiagnosticTest,
  type PreventiveCare,
  type PregnancyRecord,
  type PregnancyDelivery,
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
  Printer,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Receipt,
  Syringe,
  StickyNote,
  Baby,
  Heart,
  Scissors,
  LayoutGrid,
  List,
} from 'lucide-react'
import { getVaccinationsByPet, getVaccinationsByMedicalRecord, getStatusClasses, getStatusLabel, type Vaccination } from '@/lib/vaccinations'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import BillingFromRecordModal from '@/components/BillingFromRecordModal'
import MedicalRecordStagedModal from '@/components/MedicalRecordStagedModal'
import { HistoricalMedicalRecord } from '@/components/HistoricalMedicalRecord'
import ConfinementMonitoringPanel from '@/components/ConfinementMonitoringPanel'
import { getPetNotes as getPetNotesApi, savePetNotes as savePetNotesApi } from '@/lib/petNotes'
import { getReferredPets } from '@/lib/referrals'


// ==================== TYPES ====================

interface PatientPet {
  _id: string
  name: string
  species: string
  breed: string
  photo: string | null
  sex: string
  dateOfBirth: string | null
  color: string | null
  sterilization: string | null
  nfcTagId: string | null
  microchipNumber: string | null
  allergies: string[]
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
  ownerId: string
  clinicId: string
  clinicName: string
  clinicBranchId: string
  clinicBranchName: string
  isConfined?: boolean
  isReferral?: boolean
  status?: string
  isAlive?: boolean
  isLost?: boolean
  removedByOwner?: boolean
  previousOwners?: Array<unknown>
  lastVisitAt?: string | null
}

// ==================== HELPERS ====================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAppointmentTypeDisplay(type: string): string {
  const displayMap: Record<string, string> = {
    'consultation': 'Consultation',
    'general-checkup': 'General Checkup',
    'primary-treatment': 'Primary Treatment',
    'vaccination': 'Vaccination',
    'rabies-vaccination': 'Rabies Vaccination',
    'puppy-litter-vaccination': 'Puppy Litter Vaccination',
    'deworming': 'Deworming',
    'cbc': 'CBC Test',
    'blood-chemistry-16': 'Blood Chemistry (16)',
    'pcr-test': 'PCR Test',
    'x-ray': 'X-Ray',
    'ultrasound': 'Ultrasound',
    'abdominal-surgery': 'Abdominal Surgery',
    'orthopedic-surgery': 'Orthopedic Surgery',
    'dental-scaling': 'Dental Scaling',
    'laser-therapy': 'Laser Therapy',
    'Sterilization': 'Sterilization',
    'inpatient-care': 'Inpatient Care',
    'outpatient-treatment': 'Outpatient Treatment',
    'point-of-care-diagnostic': 'Point of Care Diagnostic',
    'basic-grooming': 'Basic Grooming',
    'full-grooming': 'Full Grooming',
    'Basic Grooming': 'Basic Grooming',
    'Full Grooming': 'Full Grooming',
    'General Consultation': 'General Consultation',
    'Preventive Care': 'Preventive Care',
    'Grooming': 'Grooming',
    'flea-tick-prevention': 'Flea & Tick Prevention',
  }
  
  return displayMap[type] || type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
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
  bodyConditionScore: { label: 'Body Condition Score', unit: '/5', placeholder: 'e.g. 3' },
  dentalScore: { label: 'Dental Score', unit: '/3', placeholder: 'e.g. 2' },
  crt: { label: 'CRT', unit: 'sec', placeholder: 'e.g. 2' },
}

// Checkbox vitals (stored as 'Yes'/'No' in value field)
const checkboxVitalKeys = ['xray', 'pregnancy', 'vaccinated'] as const
const checkboxVitalLabels: Record<string, string> = {
  xray: 'X-Ray',
  pregnancy: 'Pregnancy',
  vaccinated: 'Vaccinated',
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

function PatientRecordsPageContent() {
  const { token } = useAuthStore()
  const searchParams = useSearchParams()
  const [patients, setPatients] = useState<PatientPet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Alive' | 'Deceased' | 'Confined' | 'Lost' | 'Relocated'>('All')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<PatientPet | null>(null)
  const [currentRecord, setCurrentRecord] = useState<MedicalRecord | null>(null)
  const [historicalRecords, setHistoricalRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)

  // Edit modal (staged visit)
  const [stagedEdit, setStagedEdit] = useState<{ recordId: string; appointmentId?: string; petId: string; appointmentTypes: string[] } | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [billingModalOpen, setBillingModalOpen] = useState(false)
  const [billingModalMode, setBillingModalMode] = useState<'view'>('view')
  const [billingModalExistingId, setBillingModalExistingId] = useState<string | undefined>(undefined)

  // Medical history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)

  // Follow-up modal
  const [followUpOpen, setFollowUpOpen] = useState(false)

  // View modal
  const [viewOpen, setViewOpen] = useState(false)
  const [viewInitialIndex, setViewInitialIndex] = useState(0)

  // Patient detail tab
  const [patientTab, setPatientTab] = useState<'records' | 'vaccinations'>('records')
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loadingVaccinations, setLoadingVaccinations] = useState(false)
  const [pendingReleaseRequest, setPendingReleaseRequest] = useState<{ confinementRecordId: string; requestedAt?: string | null } | null>(null)
  const [confirmingRelease, setConfirmingRelease] = useState(false)

  // Load patients from vet's appointments + referred pets
  const loadPatients = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [apptRes, referralRes] = await Promise.all([
        authenticatedFetch('/appointments/vet', { method: 'GET' }, token),
        getReferredPets(token),
      ])

      const petMap = new Map<string, PatientPet>()

      if (apptRes.status === 'SUCCESS' && apptRes.data?.appointments) {
        for (const appt of apptRes.data.appointments) {
          const petId = appt.petId?._id
          if (!petId) continue

          const latestVisitAt = appt.date ? new Date(appt.date).toISOString() : null
          if (!petMap.has(petId)) {
            petMap.set(petId, {
              _id: petId,
              name: appt.petId?.name || 'Unknown',
              species: appt.petId?.species || '',
              breed: appt.petId?.breed || '',
              photo: appt.petId?.photo || null,
              sex: appt.petId?.sex || '',
              dateOfBirth: appt.petId?.dateOfBirth || null,
              color: appt.petId?.color || null,
              sterilization: appt.petId?.sterilization || null,
              nfcTagId: appt.petId?.nfcTagId || null,
              microchipNumber: appt.petId?.microchipNumber || null,
              allergies: appt.petId?.allergies || [],
              status: appt.petId?.status,
              isAlive: appt.petId?.isAlive,
              isLost: appt.petId?.isLost,
              removedByOwner: appt.petId?.removedByOwner,
              previousOwners: Array.isArray(appt.petId?.previousOwners) ? appt.petId.previousOwners : [],
              ownerFirstName: appt.ownerId?.firstName || '',
              ownerLastName: appt.ownerId?.lastName || '',
              ownerEmail: appt.ownerId?.email || '',
              ownerId: appt.ownerId?._id || '',
              clinicId: appt.clinicId?._id || '',
              clinicName: appt.clinicId?.name || '',
              clinicBranchId: appt.clinicBranchId?._id || '',
              clinicBranchName: appt.clinicBranchId?.name || '',
              lastVisitAt: latestVisitAt,
            })
            continue
          }

          const existingPet = petMap.get(petId)
          if (!existingPet) continue
          const existingTime = existingPet.lastVisitAt ? new Date(existingPet.lastVisitAt).getTime() : 0
          const nextTime = latestVisitAt ? new Date(latestVisitAt).getTime() : 0
          if (nextTime > existingTime) {
            petMap.set(petId, { ...existingPet, lastVisitAt: latestVisitAt })
          }
        }
      }

      // Merge referred pets — skipped if pet already appears via appointments
      if (referralRes.status === 'SUCCESS' && referralRes.data?.pets) {
        for (const p of referralRes.data.pets) {
          if (!petMap.has(p._id)) {
            petMap.set(p._id, { ...p, isReferral: true, lastVisitAt: null })
          }
        }
      }

      // Mark confined pets
      try {
        const confRes = await authenticatedFetch('/confinement?status=admitted', { method: 'GET' }, token)
        if (confRes?.status === 'SUCCESS') {
          const confPetIds = new Set<string>(
            (confRes.data?.records || []).map((r: any) => r.petId?._id || r.petId)
          )
          for (const [id, pet] of petMap) {
            if (confPetIds.has(id)) petMap.set(id, { ...pet, isConfined: true })
          }
        }
      } catch {
        // Non-critical; proceed without confinement markers
      }

      setPatients(Array.from(petMap.values()))
    } catch (err) {
      console.error('Failed to load patients:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  // Deep-link: auto-select pet when ?petId= is present in the URL and patients have loaded
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (loading || deepLinkHandled.current) return
    const petId = searchParams.get('petId')
    if (!petId) return
    const match = patients.find((p) => p._id === petId)
    if (match) {
      deepLinkHandled.current = true
      handleSelectPatient(match)
    }
    // If petId is present but not found in the list the user either lacks access
    // or the ID is invalid — silently fall through to the normal patient list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, patients, searchParams])

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

  const loadVaccinations = useCallback(async (petId: string) => {
    if (!token) return
    setLoadingVaccinations(true)
    try {
      const vacs = await getVaccinationsByPet(petId, token)
      setVaccinations(Array.isArray(vacs) ? vacs : [])
    } catch {
      setVaccinations([])
    } finally {
      setLoadingVaccinations(false)
    }
  }, [token])

  const loadPendingReleaseRequest = useCallback(async (petId: string) => {
    if (!token) return
    try {
      const res = await authenticatedFetch(`/confinement/pet/${petId}`, { method: 'GET' }, token)
      const records = res?.data?.records || []
      const pending = records.find((r: any) => r.status === 'admitted' && r.releaseRequestStatus === 'pending')
      if (pending?._id) {
        setPendingReleaseRequest({
          confinementRecordId: pending._id,
          requestedAt: pending.releaseRequestedAt || null,
        })
      } else {
        setPendingReleaseRequest(null)
      }
    } catch {
      setPendingReleaseRequest(null)
    }
  }, [token])

  const handleConfirmReleaseRequest = async () => {
    if (!token || !pendingReleaseRequest?.confinementRecordId || !selectedPatient) return
    setConfirmingRelease(true)
    try {
      const res = await authenticatedFetch(
        `/confinement/${pendingReleaseRequest.confinementRecordId}/confirm-release`,
        { method: 'PATCH' },
        token,
      )
      if (res?.status === 'SUCCESS') {
        toast.success('Confinement release confirmed')
        await Promise.all([
          loadPendingReleaseRequest(selectedPatient._id),
          loadRecords(selectedPatient._id),
        ])
      } else {
        toast.error(res?.message || 'Failed to confirm confinement release')
      }
    } catch {
      toast.error('Failed to confirm confinement release')
    } finally {
      setConfirmingRelease(false)
    }
  }

  const handleSelectPatient = (pet: PatientPet) => {
    setSelectedPatient(pet)
    setPatientTab('records')
    setVaccinations([])
    setPendingReleaseRequest(null)
    loadRecords(pet._id)
    loadPendingReleaseRequest(pet._id)
  }

  const handleBack = () => {
    setSelectedPatient(null)
    setCurrentRecord(null)
    setHistoricalRecords([])
    setPatientTab('records')
    setVaccinations([])
    setPendingReleaseRequest(null)
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

  // Edit record - load record data then open staged visit modal
  const handleEditRecord = async (recordId: string) => {
    if (!token) return
    setEditLoading(true)
    try {
      const localRec = [currentRecord, ...historicalRecords].find((r) => r?._id === recordId)

      if (localRec) {
        setStagedEdit({
          recordId: localRec._id,
          appointmentId:
            (typeof localRec.appointmentId === 'object' && localRec.appointmentId
              ? (localRec.appointmentId as any)._id
              : localRec.appointmentId) || undefined,
          petId:
            (typeof localRec.petId === 'object' && localRec.petId
              ? (localRec.petId as any)._id
              : localRec.petId) as string,
          appointmentTypes:
            (typeof localRec.appointmentId === 'object' && localRec.appointmentId
              ? (localRec.appointmentId as any).types || []
              : []),
        })
        return
      }

      const res = await getRecordById(recordId, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        const rec = res.data.record
        setStagedEdit({
          recordId: rec._id,
          appointmentId: rec.appointmentId?._id || (typeof rec.appointmentId === 'string' ? rec.appointmentId : undefined),
          petId: rec.petId?._id || rec.petId,
          appointmentTypes: rec.appointmentId?.types || [],
        })
      } else {
        toast.error(res.message || 'Failed to load record for editing')
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

  const getNormalizedPatientStatus = (patient: PatientPet): 'Alive' | 'Deceased' | 'Confined' | 'Lost' | 'Relocated' => {
    const normalizedStatus = (patient.status || '').trim().toLowerCase()
    if (patient.isConfined || normalizedStatus === 'confined') return 'Confined'
    if (patient.isLost || normalizedStatus === 'lost') return 'Lost'
    if (patient.removedByOwner || normalizedStatus === 'relocated') return 'Relocated'
    if (patient.isAlive === false || normalizedStatus === 'deceased') return 'Deceased'
    return 'Alive'
  }

  // Filter patients by search + status
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = (
      p.name.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      p.breed.toLowerCase().includes(q) ||
      `${p.ownerFirstName} ${p.ownerLastName}`.toLowerCase().includes(q)
    )
    const normalized = getNormalizedPatientStatus(p)
    const matchesStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'Alive'
        ? ['Alive', 'Confined', 'Lost', 'Relocated'].includes(normalized)
        : normalized === selectedStatus)
    return matchesSearch && matchesStatus
  })

  const totalPatients = patients.length
  const totalRecords = (currentRecord ? 1 : 0) + historicalRecords.length
  const selectedIsLost = selectedPatient?.isLost || selectedPatient?.status === 'lost'
  const selectedIsDeceased = !selectedPatient?.isAlive || selectedPatient?.status === 'deceased'
  const selectedIsRelocated = !!selectedPatient?.removedByOwner

  return (
    <DashboardLayout userType="veterinarian">
      <div className="p-6 lg:p-8">
        {!selectedPatient ? (
          <>
            {/* Header */}
            <PageHeader
              title="Patient Records"
              subtitle="View and manage medical records for your patients"
              className="mb-6"
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#C5D8FF] rounded-xl flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-[#4569B1]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#4569B1]">{totalPatients}</p>
                    <p className="text-xs text-gray-500">Total Patients</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E8F2EE] rounded-xl flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-[#35785C]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#35785C]">
                      {new Set(patients.map((p) => p.ownerId).filter(Boolean)).size}
                    </p>
                    <p className="text-xs text-gray-500">Unique Owners</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Filter + Search */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0 overflow-x-auto">
                  <div className="inline-flex bg-white border border-[#DCEAE3] rounded-full p-1 gap-1 min-w-max">
                    {(['All', 'Alive', 'Deceased', 'Confined', 'Lost', 'Relocated'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setSelectedStatus(status)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                          selectedStatus === status
                            ? 'bg-[#476B6B] text-white shadow-sm'
                            : 'text-[#4F4F4F] hover:bg-white/70'
                        }`}
                        aria-pressed={selectedStatus === status}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 inline-flex items-center rounded-full border border-[#DCEAE3] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      viewMode === 'card'
                        ? 'bg-[#476B6B] text-white shadow-sm'
                        : 'text-[#4F4F4F] hover:bg-[#F5FAF8]'
                    }`}
                    aria-pressed={viewMode === 'card'}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      viewMode === 'list'
                        ? 'bg-[#476B6B] text-white shadow-sm'
                        : 'text-[#4F4F4F] hover:bg-[#F5FAF8]'
                    }`}
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                </div>
              </div>

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
                  {searchQuery || selectedStatus !== 'All'
                    ? 'No patients match your current search and status filters. Try adjusting them.'
                    : 'Your patients will appear here once you have confirmed appointments or receive a referral.'}
                </p>
              </div>
            ) : (
              viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredPatients.map((pet) => {
                    const isLost = pet.isLost || pet.status === 'lost'
                    const isDeceased = !pet.isAlive || pet.status === 'deceased'
                    const isRelocated = !!pet.removedByOwner

                    return (
                    <button
                      key={pet._id}
                      onClick={() => handleSelectPatient(pet)}
                      className={`rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-all ${
                        pet.isConfined ? 'bg-blue-50 border-2 border-blue-300 hover:ring-1 hover:ring-blue-400/40'
                        : isLost ? 'bg-red-50 border-2 border-[#900B09]/40 hover:ring-1 hover:ring-[#900B09]/30'
                        : isDeceased ? 'bg-amber-50 border-2 border-amber-300 hover:ring-1 hover:ring-amber-400/40'
                        : isRelocated ? 'bg-orange-50 border-2 border-orange-300 hover:ring-1 hover:ring-orange-400/40'
                        : pet.isReferral ? 'bg-teal-50 border-2 border-teal-200 hover:ring-1 hover:ring-teal-400/40'
                        : 'bg-white border-2 border-transparent hover:ring-1 hover:ring-[#7FA5A3]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {pet.photo ? (
                          <Image src={pet.photo} alt="" width={48} height={48} sizes="48px" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            pet.isConfined ? 'bg-blue-100'
                            : isLost ? 'bg-red-100'
                            : isDeceased ? 'bg-amber-100'
                            : isRelocated ? 'bg-orange-100'
                            : pet.isReferral ? 'bg-teal-100'
                            : 'bg-[#7FA5A3]/15'
                          }`}>
                            <PawPrint className={`w-6 h-6 ${
                              pet.isConfined ? 'text-blue-500'
                              : isLost ? 'text-[#900B09]'
                              : isDeceased ? 'text-amber-500'
                              : isRelocated ? 'text-orange-500'
                              : pet.isReferral ? 'text-teal-600'
                              : 'text-[#5A7C7A]'
                            }`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[#4F4F4F]">{pet.name}</p>
                            {pet.isConfined && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-semibold uppercase tracking-wide shrink-0">
                                Confined
                              </span>
                            )}
                            {isLost && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full font-semibold uppercase tracking-wide shrink-0" style={{ backgroundColor: '#FEE2E2', color: '#900B09' }}>
                                Lost
                              </span>
                            )}
                            {isDeceased && !pet.isConfined && !isLost && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide shrink-0">
                                Deceased
                              </span>
                            )}
                            {isRelocated && !pet.isConfined && !isLost && !isDeceased && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-orange-100 text-orange-700 font-semibold uppercase tracking-wide shrink-0">
                                Relocated
                              </span>
                            )}
                            {pet.isReferral && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-teal-100 text-teal-700 font-semibold uppercase tracking-wide shrink-0">
                                Referred
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 capitalize">{pet.species} &middot; {pet.breed}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        <p>Owner: {pet.ownerFirstName} {pet.ownerLastName}</p>
                        <p className="mt-0.5">{pet.clinicBranchName || pet.clinicName}</p>
                      </div>
                    </button>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F5FAF8]">
                        <tr className="text-left text-[#476B6B]">
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Species</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Owner</th>
                          <th className="px-4 py-3 font-semibold">Last Visit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map((pet) => {
                          const normalizedStatus = getNormalizedPatientStatus(pet)
                          return (
                            <tr
                              key={pet._id}
                              onClick={() => handleSelectPatient(pet)}
                              className="border-t border-gray-100 hover:bg-[#F8FCFA] cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {pet.photo ? (
                                    <Image src={pet.photo} alt="" width={36} height={36} sizes="36px" className="w-9 h-9 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center">
                                      <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                                    </div>
                                  )}
                                  <span className="font-semibold text-[#4F4F4F]">{pet.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 capitalize">{pet.species}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${
                                  normalizedStatus === 'Confined' ? 'bg-blue-100 text-blue-700'
                                  : normalizedStatus === 'Lost' ? 'bg-red-100 text-red-700'
                                  : normalizedStatus === 'Deceased' ? 'bg-amber-100 text-amber-700'
                                  : normalizedStatus === 'Relocated' ? 'bg-orange-100 text-orange-700'
                                  : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {normalizedStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{pet.ownerFirstName} {pet.ownerLastName}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {pet.lastVisitAt ? formatDate(pet.lastVisitAt) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
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
                      <Image src={selectedPatient.photo} alt="" width={64} height={64} sizes="64px" className="w-16 h-16 rounded-full object-cover" />
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-[#476B6B] text-[#476B6B] text-sm font-medium rounded-xl hover:bg-[#476B6B]/5 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Medical History
                    </button>
                    <button
                      onClick={() => setFollowUpOpen(true)}
                      disabled={!currentRecord?.isCurrent}
                      title={!currentRecord?.isCurrent ? 'Follow-ups can only be added to the active medical record' : 'Add a follow-up to the current record'}
                      className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white text-sm font-medium rounded-xl hover:bg-[#3a5858] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#476B6B]"
                    >
                      <Plus className="w-4 h-4" />
                      New Follow-up Record
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Detail Tabs */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                <button
                  onClick={() => setPatientTab('records')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    patientTab === 'records'
                      ? 'bg-white text-[#476B6B] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Medical Records
                </button>
                <button
                  onClick={() => {
                    setPatientTab('vaccinations')
                    if (selectedPatient && vaccinations.length === 0 && !loadingVaccinations) {
                      loadVaccinations(selectedPatient._id)
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    patientTab === 'vaccinations'
                      ? 'bg-white text-[#476B6B] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Syringe className="w-4 h-4" />
                  Vaccinations
                </button>
              </div>

              {pendingReleaseRequest && (
                <button
                  onClick={handleConfirmReleaseRequest}
                  disabled={confirmingRelease}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-sm font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Owner requested release from confinement"
                >
                  <AlertCircle className="w-4 h-4" />
                  {confirmingRelease ? 'Confirming...' : 'Confirm Release Request'}
                </button>
              )}
            </div>

            {/* Medical Records */}
            {patientTab === 'records' && <div className="space-y-6">
              {/* Current Record Section */}
              <div>
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-4">Current Medical Record</h2>

                {loadingRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : currentRecord ? (
                  <div className={`bg-white rounded-xl p-6 shadow-md border-2 ${
                    currentRecord.stage === 'confined' ? 'border-blue-300'
                    : selectedIsLost ? 'border-[#900B09]/50'
                    : selectedIsDeceased ? 'border-amber-300'
                    : selectedIsRelocated ? 'border-orange-300'
                    : 'border-[#7FA5A3]/30'
                  }`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-3 h-3 rounded-full ${
                            currentRecord.stage === 'confined' ? 'bg-blue-500'
                            : selectedIsLost ? 'bg-[#900B09]'
                            : selectedIsDeceased ? 'bg-amber-500'
                            : selectedIsRelocated ? 'bg-orange-500'
                            : 'bg-green-500'
                          }`}></div>
                          <p className="text-sm font-semibold text-[#2C3E2D]">
                            {currentRecord.stage === 'confined' ? 'Confined – Ongoing Record' : 'Active Medical Record'}
                          </p>
                          {currentRecord.stage === 'confined' && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-semibold uppercase tracking-wide">
                              Admitted
                            </span>
                          )}
                          {selectedIsLost && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full font-semibold uppercase tracking-wide" style={{ backgroundColor: '#FEE2E2', color: '#900B09' }}>
                              Lost
                            </span>
                          )}
                          {selectedIsDeceased && currentRecord.stage !== 'confined' && !selectedIsLost && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-semibold uppercase tracking-wide">
                              Deceased
                            </span>
                          )}
                          {selectedIsRelocated && currentRecord.stage !== 'confined' && !selectedIsLost && !selectedIsDeceased && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-orange-100 text-orange-700 font-semibold uppercase tracking-wide">
                              Relocated
                            </span>
                          )}
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
                        {currentRecord.appointmentId ? (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {(currentRecord.appointmentId.types || []).map((t: string) => (
                              <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#f0f7f7] text-[#476B6B] font-medium capitalize">
                                {formatAppointmentTypeDisplay(t)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 text-[10px] rounded-full bg-purple-50 text-purple-600 font-medium">
                            Follow-up / Online Consultation
                          </span>
                        )}
                        {currentRecord.overallObservation && (
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{currentRecord.overallObservation}</p>
                        )}

                        {/* Vitals Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                          {currentRecord.vitals?.weight?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-[#3B82F6] font-medium">Weight</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">{currentRecord.vitals.weight.value} kg</p>
                            </div>
                          )}
                          {currentRecord.vitals?.temperature?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-[#3B82F6] font-medium">Temperature</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">{currentRecord.vitals.temperature.value}°C</p>
                            </div>
                          )}
                          {currentRecord.vitals?.pulseRate?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-[#3B82F6] font-medium">Pulse</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">{currentRecord.vitals.pulseRate.value} bpm</p>
                            </div>
                          )}
                          {currentRecord.vitals?.spo2?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-[#3B82F6] font-medium">SpO2</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">{currentRecord.vitals.spo2.value}%</p>
                            </div>
                          )}
                          {currentRecord.vitals?.bodyConditionScore?.value && (
                            <div className="bg-white rounded-lg p-2 border border-blue-100">
                              <p className="text-[10px] text-[#3B82F6] font-medium">BCS</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">{currentRecord.vitals.bodyConditionScore.value}/5</p>
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
                              <p className="text-xs text-[#3B82F6]">Dental Score: <span className="font-semibold">{currentRecord.vitals.dentalScore.value}/3</span></p>
                            )}
                            {currentRecord.vitals?.crt?.value && (
                              <p className="text-xs text-[#3B82F6]">CRT: <span className="font-semibold">{currentRecord.vitals.crt.value} sec</span></p>
                            )}
                            {currentRecord.vitals?.pregnancy?.value && (
                              <p className="text-xs text-[#3B82F6]">Pregnancy: <span className="font-semibold">{currentRecord.vitals.pregnancy.value}</span></p>
                            )}
                            {currentRecord.vitals?.xray?.value && (
                              <p className="text-xs text-[#3B82F6]">X-Ray: <span className="font-semibold">{currentRecord.vitals.xray.value}</span></p>
                            )}
                            {currentRecord.vitals?.vaccinated?.value && (
                              <p className="text-xs text-[#3B82F6]">Vaccinated: <span className="font-semibold">{currentRecord.vitals.vaccinated.value}</span></p>
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

                    {/* Billing button */}
                    {currentRecord.billingId && (
                      <div className="flex justify-end mt-4 pt-3 border-t border-[#7FA5A3]/20">
                        <button
                          onClick={() => { setBillingModalMode('view'); setBillingModalExistingId(typeof currentRecord?.billingId === 'object' ? (currentRecord?.billingId as any)?._id : currentRecord?.billingId ?? undefined); setBillingModalOpen(true) }}
                          className="flex items-center gap-2 px-4 py-2 border border-[#476B6B] text-[#476B6B] text-sm font-medium rounded-xl hover:bg-[#f0f7f7] transition-colors"
                        >
                          <Receipt className="w-4 h-4" />
                          View Billing
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">No medical records yet</h3>
                    <p className="text-gray-500 text-sm">Medical records will appear here once created during an appointment.</p>
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
                            {record.appointmentId ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(record.appointmentId.types || []).map((t: string) => (
                                  <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#f0f7f7] text-[#476B6B] font-medium capitalize">
                                    {formatAppointmentTypeDisplay(t)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 text-[10px] rounded-full bg-purple-50 text-purple-600 font-medium">
                                Follow-up / Online Consultation
                              </span>
                            )}
                            {record.overallObservation && (
                              <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{record.overallObservation}</p>
                            )}

                            {/* Quick vitals preview */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {record.vitals?.weight?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-[#3B82F6]">
                                  Weight: {record.vitals.weight.value} kg
                                </span>
                              )}
                              {record.vitals?.temperature?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-[#3B82F6]">
                                  Temp: {record.vitals.temperature.value}&deg;C
                                </span>
                              )}
                              {record.vitals?.pulseRate?.value && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-50 text-[#3B82F6]">
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
            </div>}

            {/* Vaccinations Tab */}
            {patientTab === 'vaccinations' && (
              <div className="space-y-4">
                {loadingVaccinations ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : vaccinations.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-500 mb-1">No vaccination records</h3>
                    <p className="text-sm text-gray-400">Vaccination records for this patient will appear here.</p>
                  </div>
                ) : (
                  vaccinations.map((v) => {
                    const vt = v.vaccineTypeId as any
                    return (
                      <div key={v._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 bg-[#7FA5A3]/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                              <Syringe className="w-5 h-5 text-[#476B6B]" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-[#4F4F4F]">{vt?.name || v.vaccineName}</h3>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mt-1">
                                <span>Administered: {v.dateAdministered ? new Date(v.dateAdministered).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                {v.expiryDate && <span>Expires: {new Date(v.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                                {v.nextDueDate && <span>Next due: {new Date(v.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-1">
                                {v.manufacturer && <span>Mfr: {v.manufacturer}</span>}
                                {v.batchNumber && <span>Lot: {v.batchNumber}</span>}
                                {v.route && <span>Route: {v.route}</span>}
                              </div>
                              {v.notes && <p className="text-xs text-gray-500 mt-1 italic">{v.notes}</p>}
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${getStatusClasses(v.status)}`}>
                            {getStatusLabel(v.status)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
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

      {/* Follow-up Record Modal */}
      {selectedPatient && (
        <FollowUpRecordModal
          open={followUpOpen}
          onClose={() => setFollowUpOpen(false)}
          patient={selectedPatient}
          record={currentRecord}
          onCreated={() => {
            setFollowUpOpen(false)
            loadRecords(selectedPatient._id)
          }}
        />
      )}

      {/* Edit Record Modal (Staged Visit) */}
      {stagedEdit && (
        <MedicalRecordStagedModal
          recordId={stagedEdit.recordId}
          appointmentId={stagedEdit.appointmentId}
          petId={stagedEdit.petId}
          appointmentTypes={stagedEdit.appointmentTypes}
          onComplete={() => {
            setStagedEdit(null)
            if (selectedPatient) loadRecords(selectedPatient._id)
          }}
          onClose={() => setStagedEdit(null)}
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

      {/* Medical History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#4F4F4F]">
              Medical History — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && token && (
            <HistoricalMedicalRecord petId={selectedPatient._id} token={token} isReadOnly={true} />
          )}
        </DialogContent>
      </Dialog>

      {/* Billing Modal */}
      <BillingFromRecordModal
        open={billingModalOpen}
        mode={billingModalMode}
        onClose={() => setBillingModalOpen(false)}
        patientName={selectedPatient?.name ?? ''}
        appointmentId={
          typeof currentRecord?.appointmentId === 'object'
            ? currentRecord?.appointmentId?._id ?? null
            : currentRecord?.appointmentId ?? null
        }
        vetName={
          typeof currentRecord?.vetId === 'object' && currentRecord?.vetId
            ? `Dr. ${(currentRecord.vetId as any).firstName ?? ''} ${(currentRecord.vetId as any).lastName ?? ''}`.trim()
            : '—'
        }
        record={currentRecord ?? undefined}
        token={token || undefined}
        existingBillingId={billingModalExistingId}
      />
    </DashboardLayout>
  )
}

export default function PatientRecordsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading patient records…</div>}>
      <PatientRecordsPageContent />
    </Suspense>
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
  const [expandedFollowUps, setExpandedFollowUps] = useState<Set<string>>(new Set())
  const [followUpsMinimized, setFollowUpsMinimized] = useState(false)
  const [lightboxMedia, setLightboxMedia] = useState<{ src: string; contentType: string; description?: string } | null>(null)
  const [billingModalOpen, setBillingModalOpen] = useState(false)

  // Vet notepad (pet-level, same across all visits)
  const [petNotesDraft, setPetNotesDraft] = useState('')
  const [petNotesSaving, setPetNotesSaving] = useState(false)
  const [petNotesSaved, setPetNotesSaved] = useState(false)
  const [notesMinimized, setNotesMinimized] = useState(false)
  const [historyMinimized, setHistoryMinimized] = useState(true)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const toggleFollowUp = (id: string) => {
    setExpandedFollowUps((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Reset index when modal opens
  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  // Load record whenever index changes
  useEffect(() => {
    if (!open || !recordIds[index] || !token) return
    setLoading(true)
    setRecord(null)
    setExpandedFollowUps(new Set())
    getRecordById(recordIds[index], token).then((res) => {
      if (res.status === 'SUCCESS' && res.data?.record) {
        const recordData = res.data.record
        // Load vaccinations for this medical record
        getVaccinationsByMedicalRecord(recordData._id, token).then((vaccinations) => {
          setRecord({ ...recordData, vaccinations })
        }).catch(() => {
          // If vaccination fetch fails, still show record without vaccinations
          setRecord(recordData)
        })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [open, index, recordIds, token])

  // Load pet-level vet notes when pet changes
  useEffect(() => {
    const petId = record?.petId?._id
    if (!petId || !token) return
    getPetNotesApi(petId, token).then((res) => {
      if (res.status === 'SUCCESS') setPetNotesDraft(res.data?.notes || '')
    })
  }, [record?.petId?._id, token])

  const handleSaveNotes = async () => {
    const petId = record?.petId?._id
    if (!token || !petId) return
    setPetNotesSaving(true)
    try {
      const res = await savePetNotesApi(petId, petNotesDraft, token)
      if (res.status === 'SUCCESS') {
        setPetNotesSaved(true)
        setTimeout(() => setPetNotesSaved(false), 2000)
      } else {
        toast.error(res.message || 'Failed to save vet notes')
      }
    } catch {
      toast.error('Failed to save vet notes')
    } finally {
      setPetNotesSaving(false)
    }
  }

  const total = recordIds.length
  const pet = record?.petId
  const vet = record?.vetId
  const clinic = record?.clinicId
  const branch = record?.clinicBranchId
  const currentOwnerName = `${pet?.ownerId?.firstName || ''} ${pet?.ownerId?.lastName || ''}`.trim()
  const ownerName = (record?.ownerAtTime?.name || currentOwnerName || 'Unknown Owner').trim()
  const ownerLabel = record?.ownerAtTime?.name ? 'Owner at Time' : 'Current Owner'
  const soapPlan = stripImmunityFromPlan(record?.plan)

  const immunitySpecies = resolveImmunitySpecies(record?.immunityTesting?.species)
  const immunityDiseases = IMMUNITY_DISEASES_BY_SPECIES[immunitySpecies]
  const vitalNotes = (Object.keys(vitalLabels) as (keyof Vitals)[])
    .map((key) => {
      const entry = record?.vitals?.[key]
      const note = typeof entry?.notes === 'string' ? entry.notes.trim() : ''
      if (!note) return null
      return { key, label: vitalLabels[key].label, note }
    })
    .filter((item): item is { key: keyof Vitals; label: string; note: string } => item !== null)
  const hasImmunityTesting = !!record?.immunityTesting && (
    record.immunityTesting.enabled === true ||
    (record.immunityTesting.rows?.length || 0) > 0
  )
  const hasAntigenTesting = !!record?.immunityTesting && (
    record.immunityTesting.antigenEnabled === true ||
    (record.immunityTesting.antigenRows?.length || 0) > 0
  )
  const hasDiagnosticTestsSection = (record?.diagnosticTests?.length || 0) > 0 || hasImmunityTesting || hasAntigenTesting

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
      return `<tr><td>${label}</td><td><strong>${val}</strong></td></tr>`
    }).join('')

    const printVitalNotes = (Object.keys(vitalLabels) as (keyof Vitals)[])
      .map((key) => {
        const note = record.vitals?.[key]?.notes?.trim()
        if (!note) return null
        return `<tr><td>${vitalLabels[key].label}</td><td>${note}</td></tr>`
      })
      .filter(Boolean)
      .join('')

    const medRows = (record.medications || []).map((m: Medication) =>
      `<tr><td>${m.name||'—'}</td><td>${m.dosage||'—'}</td><td>${m.route||'—'}</td><td>${m.frequency||'—'}</td><td>${m.duration||'—'}</td><td>${m.status||'—'}</td></tr>`
    ).join('')

    const testCards = (record.diagnosticTests || []).map((t: DiagnosticTest) =>
      `<div class="test-card"><strong>${t.name||t.testType}</strong> <span class="sub">${(t.testType||'').replace('_',' ')}</span>${t.date ? `<br><span class="sub">${new Date(t.date).toLocaleDateString()}</span>` : ''}${t.result ? `<p>${t.result}</p>` : ''}${t.normalRange ? `<span class="sub">Normal: ${t.normalRange}</span>` : ''}</div>`
    ).join('')

    const printImmunitySpecies = resolveImmunitySpecies(record.immunityTesting?.species)
    const printImmunityDiseases = IMMUNITY_DISEASES_BY_SPECIES[printImmunitySpecies]
    const printImmunityRows = printImmunityDiseases.map((disease) => {
      const row = record.immunityTesting?.rows?.find((item) => item.disease === disease)
      return `<tr><td>${disease}</td><td>${row?.score ?? '—'}</td><td>${row?.status || '—'}</td><td>${row?.action || '—'}</td></tr>`
    }).join('')
    const printAntigenRows = printImmunityDiseases.map((disease) => {
      const row = record.immunityTesting?.antigenRows?.find((item) => item.disease === disease)
      return `<tr><td>${disease}</td><td>${row?.result || '—'}</td></tr>`
    }).join('')
    const printHasImmunityTesting = !!record.immunityTesting && (
      record.immunityTesting.enabled === true ||
      (record.immunityTesting.rows?.length || 0) > 0
    )
    const printHasAntigenTesting = !!record.immunityTesting && (
      record.immunityTesting.antigenEnabled === true ||
      (record.immunityTesting.antigenRows?.length || 0) > 0
    )
    const diagnosticSection = ((record.diagnosticTests || []).length > 0 || printHasImmunityTesting || printHasAntigenTesting) ? `
      <div class="section">
        <div class="section-header">🧪 Diagnostic Tests</div>
        <div class="section-body">
          ${(record.diagnosticTests || []).length > 0 ? testCards : ''}
          ${printHasImmunityTesting ? `
            <div style="margin-top:${(record.diagnosticTests || []).length > 0 ? '10px' : '0'}">
              <p class="soap-label">Immunity Testing</p>
              <table>
                <thead><tr><th>Disease</th><th>Score</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>${printImmunityRows}</tbody>
              </table>
            </div>
          ` : ''}
          ${printHasAntigenTesting ? `
            <div style="margin-top:10px">
              <p class="soap-label">Antigen Testing</p>
              <table>
                <thead><tr><th>Disease</th><th>Result</th></tr></thead>
                <tbody>${printAntigenRows}</tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''

    const careRows = (record.preventiveCare || []).map((c: PreventiveCare) =>
      `<tr><td>${(c.careType||'—').replace('_',' ')}</td><td>${c.product||'—'}</td><td>${c.dateAdministered ? new Date(c.dateAdministered).toLocaleDateString() : '—'}</td><td>${c.nextDueDate ? new Date(c.nextDueDate).toLocaleDateString() : '—'}</td></tr>`
    ).join('')

    const printSoapPlan = stripImmunityFromPlan(record.plan)
    const soapSection = (record.subjective || record.overallObservation || record.assessment || printSoapPlan) ? `
      <div class="section">
        <div class="section-header">SOAP NOTES</div>
        <div class="section-body">
          ${record.subjective ? `<p class="soap-label">S — Subjective</p><p>${record.subjective}</p>` : ''}
          ${record.overallObservation ? `<p class="soap-label">O — Objective</p><p>${record.overallObservation}</p>` : ''}
          ${record.assessment ? `<p class="soap-label">A — Assessment</p><p>${record.assessment}</p>` : ''}
          ${printSoapPlan ? `<p class="soap-label">P — Plan</p><p>${printSoapPlan}</p>` : ''}
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
            <div style="margin-bottom:10px"><div class="info-label">${ownerLabel}</div><div class="info-val" style="font-weight:600">${ownerName}</div></div>
            <div style="margin-bottom:10px"><div class="info-label">Attending Veterinarian</div><div class="info-val" style="font-weight:600">${vetName}</div></div>
            <div>
              <div class="info-label">Clinic / Branch</div>
              <div class="info-val">${clinicName||'—'}</div>
            </div>
            <div>
              <div class="info-label">Branch Phone</div>
              <div class="info-val">${branch?.phone || '—'}</div>
            </div>
          </div>
        </div>
      </div>
      ${record.chiefComplaint ? `<div class="section"><div class="section-header">Chief Complaint / Reason for Visit</div><div class="section-body"><p>${record.chiefComplaint}</p></div></div>` : ''}
      <div class="section">
        <div class="section-header">Physical Examination</div>
        <div class="section-body">
          <table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${vitalRows}</tbody></table>
          ${printVitalNotes ? `<div style="margin-top:10px"><p class="soap-label">Vital Notes</p><table><thead><tr><th>Vital</th><th>Notes</th></tr></thead><tbody>${printVitalNotes}</tbody></table></div>` : ''}
        </div>
      </div>
      ${soapSection}
      ${(record.medications||[]).length ? `<div class="section"><div class="section-header">💊 Medications</div><div class="section-body"><table><thead><tr><th>Name</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Status</th></tr></thead><tbody>${medRows}</tbody></table></div></div>` : ''}
      ${diagnosticSection}
      ${(record.preventiveCare||[]).length ? `<div class="section"><div class="section-header">🛡 Preventive Care</div><div class="section-body"><table><thead><tr><th>Type</th><th>Product</th><th>Administered</th><th>Next Due</th></tr></thead><tbody>${careRows}</tbody></table></div></div>` : ''}
      ${record.visitSummary ? `<div class="section"><div class="section-header">Visit Summary</div><div class="section-body"><p>${record.visitSummary}</p></div></div>` : ''}
      <div class="footer">
        <div><div class="sig-line"></div><div class="sig-label">${vetName}</div><div class="sig-label">Attending Veterinarian</div></div>
        <div style="text-align:right"><div class="sig-label">${visitDate}</div><div class="sig-label">Date of Record</div></div>
      </div>
    </div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Side-by-side container */}
      <div className="relative flex items-stretch gap-2 w-[90vw] h-[85vh]">

        {/* ===== FOLLOW-UPS PANEL (left, collapsible) ===== */}
        {record && (
          <div className={`bg-white rounded-xl shadow-xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${followUpsMinimized ? 'w-10' : 'w-[30rem]'}`}>
            {followUpsMinimized ? (
              <button
                onClick={() => setFollowUpsMinimized(false)}
                className="flex flex-col items-center justify-center h-full gap-3 text-[#476B6B] hover:bg-gray-50 w-full px-1"
              >
                <ChevronRightIcon className="w-4 h-4 shrink-0" />
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase text-[#476B6B]"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Follow-ups ({record.followUps?.length || 0})
                </span>
              </button>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Follow-ups ({record.followUps?.length || 0})
                  </h2>
                  <button
                    onClick={() => setFollowUpsMinimized(true)}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                    title="Minimize panel"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {(!record.followUps || record.followUps.length === 0) ? (
                    <div className="px-4 py-8 text-center flex items-center justify-center h-full">
                      <p className="text-xs text-gray-400 leading-relaxed">No follow-up records for this visit yet.</p>
                    </div>
                  ) : (
                    <div>
                      {[...(record.followUps)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((fu) => {
                        const isExpanded = expandedFollowUps.has(fu._id)
                        return (
                          <div key={fu._id} className="border-b border-gray-100 last:border-0">
                            <button
                              type="button"
                              onClick={() => toggleFollowUp(fu._id)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {new Date(fu.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {fu.sharedWithOwner && (
                                    <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">Shared</span>
                                  )}
                                  {isExpanded
                                    ? <ChevronUp className="w-3 h-3 text-gray-400 shrink-0" />
                                    : <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                                  }
                                </div>
                              </div>
                              <p className="text-xs font-medium text-[#4F4F4F] mt-0.5">
                                Dr. {fu.vetId?.firstName} {fu.vetId?.lastName}
                              </p>
                              {fu.media && fu.media.length > 0 && !isExpanded && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-purple-500 mt-0.5">
                                  <ImageIcon className="w-3 h-3" />
                                  {fu.media.length} attachment{fu.media.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {!isExpanded && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{fu.ownerObservations}</p>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-3 space-y-2">
                                <div>
                                  <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">Owner Observations</p>
                                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{fu.ownerObservations}</p>
                                </div>
                                {fu.vetNotes && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1">Vet Notes</p>
                                    <p className="text-xs text-gray-600 leading-relaxed italic whitespace-pre-wrap">{fu.vetNotes}</p>
                                  </div>
                                )}
                                {fu.media && fu.media.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wider mb-1.5">
                                      Attachments ({fu.media.length})
                                    </p>
                                    <div className="grid grid-cols-5 gap-1">
                                      {fu.media.map((m, mi) => {
                                        const isVideo = m.contentType.startsWith('video/')
                                        const src = m.data ? `data:${m.contentType};base64,${m.data}` : ''
                                        return (
                                          <button
                                            key={m._id || mi}
                                            type="button"
                                            onClick={() => setLightboxMedia({ src, contentType: m.contentType, description: m.description })}
                                            className="relative aspect-square rounded overflow-hidden border border-gray-200 bg-gray-100 hover:opacity-75 transition-opacity"
                                            title={m.description || (isVideo ? `Video ${mi + 1}` : `Image ${mi + 1}`)}
                                          >
                                            {isVideo ? (
                                              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                                <FileText className="w-3 h-3 text-purple-300" />
                                              </div>
                                            ) : src ? (
                                              <img
                                                src={src}
                                                alt={m.description || `Image ${mi + 1}`}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-3 h-3 text-gray-400" />
                                              </div>
                                            )}
                                          </button>
                                        )
                                      })}
                                    </div>
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
              </>
            )}
          </div>
        )}

        {/* ===== MAIN RECORD PANEL (right) ===== */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-xl flex items-center justify-center flex-1 h-full">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : record ? (
          <div className="bg-white rounded-xl shadow-xl flex flex-col flex-1 h-full overflow-hidden">
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
                <div className="text-right flex flex-col items-end gap-2">
                  <div>
                    <p className="text-xs text-white/60">Record ID</p>
                    <p className="text-sm font-mono text-white/90">{record._id.slice(-8).toUpperCase()}</p>
                  </div>
                  {record.billingId && (
                    <button
                      onClick={() => { setBillingModalOpen(true) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Billing
                    </button>
                  )}
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

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex-1 overflow-y-auto">
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
                        <Image src={pet.photo} alt="" width={48} height={48} sizes="48px" className="w-12 h-12 rounded-full object-cover border-2 border-[#7FA5A3]/20" />
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
                        <p className="text-[10px] text-gray-400 uppercase">Color</p>
                        <p className="text-sm text-[#4F4F4F]">{pet?.color || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Sex</p>
                        <p className="text-sm text-[#4F4F4F] capitalize">{pet?.sex || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Date of Birth</p>
                        <p className="text-sm text-[#4F4F4F]">{pet?.dateOfBirth ? new Date(pet.dateOfBirth).toLocaleDateString() : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Age</p>
                        <p className="text-sm text-[#4F4F4F]">{pet?.dateOfBirth ? calculateAge(pet.dateOfBirth) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Sterilization</p>
                        <p className="text-sm text-[#4F4F4F] capitalize">{pet?.sterilization || '—'}</p>
                      </div>
                      {pet?.nfcTagId && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Pet Tag ID</p>
                          <p className="text-sm font-mono text-[#4F4F4F]">{pet.nfcTagId}</p>
                        </div>
                      )}
                      {pet?.microchipNumber && (
                        <div className={pet?.nfcTagId ? '' : 'col-span-2'}>
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
                      <p className="text-[10px] text-gray-400 uppercase">{ownerLabel}</p>
                      <p className="text-sm font-medium text-[#4F4F4F]">{ownerName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Attending Veterinarian</p>
                      <p className="text-sm font-medium text-[#4F4F4F]">
                        Dr. {vet?.firstName} {vet?.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Clinic / Branch</p>
                      <p className="text-sm font-medium text-[#4F4F4F]">
                        {clinic?.name || '—'}
                        {branch?.name ? ` — ${branch.name}` : ''}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Branch Phone: {branch?.phone || '—'}
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

              {/* ===== SOAP NOTES ===== */}
              {(record.subjective || record.overallObservation || record.assessment || soapPlan) && (
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
              {hasDiagnosticTestsSection && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Diagnostic Tests
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.diagnosticTests?.map((test: DiagnosticTest, i: number) => (
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
                        {Array.isArray(test.images) && test.images.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Test Images</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {test.images.map((img, imgIdx) => (
                                <div key={img._id || imgIdx} className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                                  {img.data ? (
                                    <>
                                      <img
                                        src={`data:${img.contentType};base64,${img.data}`}
                                        alt={img.description || `Diagnostic test image ${imgIdx + 1}`}
                                        className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setLightboxMedia({ src: `data:${img.contentType};base64,${img.data}`, contentType: img.contentType, description: img.description })}
                                      />
                                      {img.description && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-white text-[10px] px-2 py-1 truncate">
                                          {img.description}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                                      <ImageIcon className="w-5 h-5 text-gray-300" />
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
              )}

              {/* ===== PREGNANCY RESULTS ===== */}
              {record.pregnancyRecord && record.pregnancyRecord.isPregnant && (
                <div className="border border-pink-200 rounded-xl overflow-hidden bg-pink-50/30">
                  <div className="bg-pink-100/50 px-4 py-2 border-b border-pink-200">
                    <h2 className="text-xs font-semibold text-pink-900 uppercase tracking-wider flex items-center gap-2">
                      <Baby className="w-3.5 h-3.5" />
                      Pregnancy Results
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
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
                      {record.pregnancyRecord.litterNumber && (
                        <div className="bg-white rounded-lg p-3 border border-pink-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Expected Litter Size</p>
                          <p className="text-sm font-semibold text-[#4F4F4F]">{record.pregnancyRecord.litterNumber} puppies/kittens</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== DELIVERY RESULTS ===== */}
              {record.pregnancyDelivery && (
                <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50/30">
                  <div className="bg-green-100/50 px-4 py-2 border-b border-green-200">
                    <h2 className="text-xs font-semibold text-green-900 uppercase tracking-wider flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5" />
                      Delivery Results
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
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
                      <div className="bg-white rounded-lg p-3 border border-green-100 mt-2">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Vet Remarks</p>
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{record.pregnancyDelivery.vetRemarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== SURGERY RESULTS ===== */}
              {record.surgeryRecord && (
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <div className="bg-amber-100/50 px-4 py-2 border-b border-amber-200">
                    <h2 className="text-xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5" />
                      Surgery Results
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
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
                              {img.data ? (
                                <>
                                  <img
                                    src={`data:${img.contentType};base64,${img.data}`}
                                    alt={img.description || `Surgery image ${idx + 1}`}
                                    className="w-full h-32 object-cover cursor-pointer hover:opacity-75 transition-opacity"
                                    onClick={() => setLightboxMedia({ src: `data:${img.contentType};base64,${img.data}`, contentType: img.contentType, description: img.description })}
                                  />
                                  {img.description && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate">
                                      {img.description}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-gray-300" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== VACCINATIONS ADMINISTERED ===== */}
              {Array.isArray(record.vaccinations) && record.vaccinations.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
                      <Syringe className="w-3.5 h-3.5" />
                      Vaccinations Administered ({record.vaccinations.length})
                    </h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {record.vaccinations.map((vac, idx) => (
                      <div key={vac._id || idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-[#4F4F4F]">
                              {vac.vaccineTypeId?.name || vac.vaccineName || 'Unknown Vaccine'}
                              {vac.doseNumber != null && (
                                <span className="ml-2 text-xs font-normal text-gray-400">Dose {vac.doseNumber}</span>
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
                          {vac.route && (
                            <div>
                              <p className="text-gray-400 uppercase font-medium">Route</p>
                              <p className="text-[#4F4F4F] capitalize">{vac.route}</p>
                            </div>
                          )}
                          {vac.manufacturer && (
                            <div>
                              <p className="text-gray-400 uppercase font-medium">Manufacturer</p>
                              <p className="text-[#4F4F4F]">{vac.manufacturer}</p>
                            </div>
                          )}
                          {vac.batchNumber && (
                            <div className="col-span-2">
                              <p className="text-gray-400 uppercase font-medium">Batch/Lot Number</p>
                              <p className="text-[#4F4F4F] font-mono">{vac.batchNumber}</p>
                            </div>
                          )}
                        </div>
                        {vac.notes && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Clinical Notes</p>
                            <p className="text-xs text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{vac.notes}</p>
                          </div>
                        )}
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

              {Array.isArray(record.preventiveAssociatedExclusions) && record.preventiveAssociatedExclusions.length > 0 && (
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
                          title={item}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
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

              {/* ===== CONFINEMENT LOG ===== */}
              {record.confinementAction && record.confinementAction !== 'none' && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${record.confinementAction === 'confined' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <span className="text-lg shrink-0">{record.confinementAction === 'confined' ? '🔒' : '🔓'}</span>
                  <div>
                    <p className={`text-sm font-semibold ${record.confinementAction === 'confined' ? 'text-amber-800' : 'text-green-800'}`}>
                      {record.confinementAction === 'confined'
                        ? 'Pet was confined during this visit'
                        : `Pet was released from confinement${record.confinementDays ? ` after ${record.confinementDays} day${record.confinementDays !== 1 ? 's' : ''}` : ' during this visit'}`}
                    </p>
                    <p className={`text-xs ${record.confinementAction === 'confined' ? 'text-amber-600' : 'text-green-600'}`}>
                      Logged on {new Date(record.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              {record.confinementAction === 'confined' && record.confinementRecordId && (
                <ConfinementMonitoringPanel
                  token={token}
                  confinementRecordId={record.confinementRecordId}
                  isActive
                />
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

              {/* ===== REFERRAL, DISCHARGE & SCHEDULED SURGERY ===== */}
              {(record.referral || record.discharge || record.scheduledSurgery) && (
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
            </div>

            {/* ===== ACTION BAR ===== */}
            <div className="bg-white border-t border-gray-100 px-8 py-4 flex items-center justify-between shrink-0">
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

        {/* ===== VET NOTEPAD PANEL (right, collapsible) ===== */}
        {record && (
          <div className={`bg-white rounded-xl shadow-xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${notesMinimized ? 'w-10' : 'w-[22rem]'}`}>
            {notesMinimized ? (
              <button
                onClick={() => setNotesMinimized(false)}
                className="flex flex-col items-center justify-center h-full gap-3 text-[#476B6B] hover:bg-gray-50 w-full px-1"
              >
                <ChevronLeftIcon className="w-4 h-4 shrink-0" />
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase text-[#476B6B]"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Vet Notes
                </span>
              </button>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                  <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5" />
                    Vet Notes
                  </h2>
                  <div className="flex items-center gap-2">
                    {petNotesSaving && <span className="text-[10px] text-gray-400">Saving…</span>}
                    {petNotesSaved && !petNotesSaving && <span className="text-[10px] text-green-500 font-medium">Saved</span>}
                    <button
                      onClick={() => setNotesMinimized(true)}
                      className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                      title="Minimize panel"
                    >
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2">
                  <p className="text-[10px] text-gray-400 leading-relaxed">Private notepad for this patient — same across all visits.</p>
                  <textarea
                    value={petNotesDraft}
                    onChange={(e) => setPetNotesDraft(e.target.value)}
                    onBlur={handleSaveNotes}
                    placeholder="Write your notes about this patient here…"
                    className="flex-1 w-full text-sm text-[#4F4F4F] resize-none focus:outline-none bg-white border border-gray-200 rounded-lg p-2.5 leading-relaxed focus:ring-1 focus:ring-[#7FA5A3]"
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={petNotesSaving}
                    className="px-3 py-1.5 text-xs font-medium bg-[#476B6B] text-white rounded-lg hover:bg-[#3a5858] disabled:opacity-50 transition-colors self-end"
                  >
                    {petNotesSaving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== HISTORICAL MEDICAL RECORD PANEL (right, collapsible) ===== */}
      {record && (
        <div className={`bg-white rounded-xl shadow-xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${historyMinimized ? 'w-10' : 'w-[22rem]'}`}>
          {historyMinimized ? (
            <button
              onClick={() => setHistoryMinimized(false)}
              className="flex flex-col items-center justify-center h-full gap-3 text-[#476B6B] hover:bg-gray-50 w-full px-1"
            >
              <ChevronLeftIcon className="w-4 h-4 shrink-0" />
              <span
                className="text-[10px] font-semibold tracking-widest uppercase text-[#476B6B]"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                History
              </span>
            </button>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  Medical History
                </h2>
                <button
                  onClick={() => setHistoryMinimized(true)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                  title="Minimize panel"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <HistoricalMedicalRecord
                  petId={typeof record.petId === 'object' ? (record.petId as any)?._id : record.petId}
                  token={token}
                  refreshTrigger={historyRefresh}
                  isReadOnly={true}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== BILLING MODAL ===== */}
      <BillingFromRecordModal
        open={billingModalOpen}
        mode='view'
        onClose={() => setBillingModalOpen(false)}
        patientName={typeof record?.petId === 'object' ? (record?.petId as any)?.name ?? '' : ''}
        appointmentId={
          record
            ? typeof record.appointmentId === 'object'
              ? (record.appointmentId as any)?._id ?? null
              : record.appointmentId ?? null
            : null
        }
        vetName={
          record && typeof record.vetId === 'object' && record.vetId
            ? `Dr. ${(record.vetId as any).firstName ?? ''} ${(record.vetId as any).lastName ?? ''}`.trim()
            : '—'
        }
        record={record ?? undefined}
        token={token}
        existingBillingId={
          record?.billingId
            ? typeof record.billingId === 'object'
              ? (record.billingId as any)?._id
              : record.billingId
            : undefined
        }
      />

      {/* ===== LIGHTBOX ===== */}
      {lightboxMedia && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxMedia(null)}
        >
          <div className="relative max-w-[85%] max-h-[85%] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute -top-8 right-0 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {lightboxMedia.contentType.startsWith('video/') ? (
              <video
                src={lightboxMedia.src}
                controls
                autoPlay
                className="max-w-full max-h-[75vh] rounded-lg"
              />
            ) : (
              <img
                src={lightboxMedia.src}
                alt={lightboxMedia.description || 'Attachment'}
                className="max-w-full max-h-[75vh] rounded-lg object-contain"
              />
            )}
            {lightboxMedia.description && (
              <p className="text-white/70 text-xs text-center mt-2">{lightboxMedia.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== FOLLOW-UP RECORD MODAL ====================

function FollowUpRecordModal({
  open,
  onClose,
  patient,
  record,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  patient: PatientPet
  record: MedicalRecord | null
  onCreated: () => void
}) {
  const { token } = useAuthStore()

  const emptyObs = {
    appetite: 'Normal', waterIntake: 'Normal', energyLevel: 'Normal',
    moodChanges: ['None'] as string[], sleepChanges: 'Normal',
    vomiting: 'no', vomitingDetails: '',
    stoolChanges: 'Normal', stoolDetails: '',
    urinationChanges: ['Normal'] as string[],
    coughing: 'no', coughingDetails: '',
    breathingChanges: ['Normal'] as string[],
    weightChanges: 'No change', limping: 'no', limpingDetails: '',
    scratchingLicking: 'no', scratchingDetails: '',
    woundAppearance: ['Looks normal'] as string[],
    medicationCompliance: 'Yes, as directed', medicationDifficulties: '',
    sideEffects: 'no', sideEffectsDetails: '',
    newSymptoms: 'no', newSymptomsDetails: '',
    overallImpression: 'Same',
  }
  const [obs, setObs] = useState({ ...emptyObs })
  const [respiratoryExpanded, setRespiratoryExpanded] = useState(false)
  const [medicationExpanded, setMedicationExpanded] = useState(false)

  const setField = (key: keyof typeof emptyObs, value: string) => setObs(prev => ({ ...prev, [key]: value }))
  const toggleCheck = (key: 'moodChanges' | 'urinationChanges' | 'breathingChanges' | 'woundAppearance', value: string) =>
    setObs(prev => {
      const arr = prev[key] as string[]
      const singleChoiceByKey: Record<typeof key, string | null> = {
        moodChanges: 'None',
        urinationChanges: 'Normal',
        breathingChanges: 'Normal',
        woundAppearance: 'Looks normal',
      }
      const singleChoice = singleChoiceByKey[key]
      if (singleChoice && value === singleChoice) {
        return { ...prev, [key]: arr.includes(value) ? [] : [value] }
      }

      const withoutSingle = singleChoice ? arr.filter(v => v !== singleChoice) : arr
      const next = withoutSingle.includes(value)
        ? withoutSingle.filter(v => v !== value)
        : [...withoutSingle, value]

      return { ...prev, [key]: next }
    })

  const serializeObs = (o: typeof emptyObs): string => {
    const lines: string[] = []
    if (o.appetite) lines.push(`Appetite: ${o.appetite}`)
    if (o.waterIntake) lines.push(`Water Intake: ${o.waterIntake}`)
    if (o.energyLevel) lines.push(`Energy/Activity Level: ${o.energyLevel}`)
    if (o.moodChanges.length) lines.push(`Mood/Behavior Changes: ${o.moodChanges.join(', ')}`)
    if (o.sleepChanges) lines.push(`Sleep Pattern: ${o.sleepChanges}`)
    if (o.vomiting) lines.push(`Vomiting: ${o.vomiting === 'yes' ? `Yes${o.vomitingDetails ? ` — ${o.vomitingDetails}` : ''}` : 'No'}`)
    if (o.stoolChanges) lines.push(`Stool Changes: ${o.stoolChanges}${o.stoolDetails ? ` — ${o.stoolDetails}` : ''}`)
    if (o.urinationChanges.length) lines.push(`Urination Changes: ${o.urinationChanges.join(', ')}`)
    if (o.coughing) lines.push(`Coughing/Sneezing: ${o.coughing === 'yes' ? `Yes${o.coughingDetails ? ` — ${o.coughingDetails}` : ''}` : 'No'}`)
    if (o.breathingChanges.length) lines.push(`Breathing Changes: ${o.breathingChanges.join(', ')}`)
    if (o.weightChanges) lines.push(`Weight Changes: ${o.weightChanges}`)
    if (o.limping) lines.push(`Limping/Difficulty Moving: ${o.limping === 'yes' ? `Yes${o.limpingDetails ? ` — ${o.limpingDetails}` : ''}` : 'No'}`)
    if (o.scratchingLicking) lines.push(`Scratching/Licking/Biting: ${o.scratchingLicking === 'yes' ? `Yes${o.scratchingDetails ? ` — ${o.scratchingDetails}` : ''}` : 'No'}`)
    if (o.woundAppearance.length) lines.push(`Wound/Incision: ${o.woundAppearance.join(', ')}`)
    if (o.medicationCompliance) lines.push(`Medication Compliance: ${o.medicationCompliance}${o.medicationDifficulties ? ` — ${o.medicationDifficulties}` : ''}`)
    if (o.sideEffects) lines.push(`Side Effects: ${o.sideEffects === 'yes' ? `Yes${o.sideEffectsDetails ? ` — ${o.sideEffectsDetails}` : ''}` : 'No'}`)
    if (o.newSymptoms) lines.push(`New/Worsening Symptoms: ${o.newSymptoms === 'yes' ? `Yes${o.newSymptomsDetails ? ` — ${o.newSymptomsDetails}` : ''}` : 'No'}`)
    if (o.overallImpression) lines.push(`Overall Impression: ${o.overallImpression}`)
    return lines.join('\n')
  }

  const [vetNotes, setVetNotes] = useState('')
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [media, setMedia] = useState<{ data: string; contentType: string; description: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setObs({ ...emptyObs })
      setVetNotes('')
      setSharedWithOwner(false)
      setMedia([])
    }
  }, [open])

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        setMedia((prev) => [...prev, { data: base64, contentType: file.type, description: file.name }])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!token) return
    if (!record) return
    if (!obs.overallImpression) {
      toast.error('Please select an overall impression before saving.')
      return
    }
    const ownerObservations = serializeObs(obs)
    setSubmitting(true)
    try {
      const res = await createFollowUp(
        record._id,
        { ownerObservations, vetNotes: vetNotes || undefined, sharedWithOwner, media: media.length > 0 ? media : undefined },
        token
      )
      if (res.status === 'SUCCESS') {
        toast.success('Follow-up record created successfully!')
        onCreated()
      } else {
        toast.error(res.message || 'Failed to create follow-up record')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#476B6B]" />
            Follow-up Record — {patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 mt-1">
          Record the pet owner's observations and your clinical notes for this follow-up visit.
        </div>

        <div className="space-y-7 mt-6">
          {/* Owner Observations — structured */}
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Owner's Observations <span className="text-red-500">*</span></h3>
              <p className="text-sm text-gray-500 mt-1">Fill in what the pet owner reports since the last visit.</p>
            </div>

            {(() => {
              const cardCls = 'bg-gray-50 border border-gray-100 rounded-xl p-5 md:p-6 space-y-4'
              const cardTitleCls = 'text-lg font-semibold text-gray-900'
              const fieldLabelCls = 'block text-sm font-semibold text-[#2C3E2D] mb-2'
              const fieldGridCls = 'grid grid-cols-1 md:grid-cols-2 gap-4'
              const textCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#DEEDED] resize-none bg-white'

              const chipGroup = (
                value: string,
                onChange: (v: string) => void,
                options: string[]
              ) => (
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => {
                    const active = value === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors ${active ? 'bg-[#DEEDED] border-[#476B6B] text-[#476B6B]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )

              const toggleYesNo = (key: keyof typeof emptyObs) => (
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setField(key, 'no')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${obs[key] === 'no' ? 'bg-[#DEEDED] text-[#476B6B]' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setField(key, 'yes')}
                    className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${obs[key] === 'yes' ? 'bg-[#DEEDED] text-[#476B6B]' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Yes
                  </button>
                </div>
              )

              const pillMultiSelect = (
                key: 'moodChanges' | 'urinationChanges' | 'breathingChanges' | 'woundAppearance',
                options: string[]
              ) => (
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => {
                    const active = (obs[key] as string[]).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleCheck(key, opt)}
                        className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors ${active ? 'bg-[#DEEDED] border-[#476B6B] text-[#476B6B]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )

              return (
                <div className="space-y-6 md:space-y-7">
                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>General Condition</h4>
                    <div className={fieldGridCls}>
                      <div>
                        <label className={fieldLabelCls}>Appetite</label>
                        {chipGroup(obs.appetite, v => setField('appetite', v), ['Normal', 'Eating more', 'Eating less', 'Refusing food'])}
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Water Intake</label>
                        {chipGroup(obs.waterIntake, v => setField('waterIntake', v), ['Normal', 'Drinking more than usual', 'Drinking less than usual'])}
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelCls}>Weight Changes</label>
                      {chipGroup(obs.weightChanges, v => setField('weightChanges', v), ['No change', 'Gained weight', 'Lost weight'])}
                    </div>
                  </div>

                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>Behavior & Activity</h4>
                    <div className={fieldGridCls}>
                      <div>
                        <label className={fieldLabelCls}>Energy / Activity Level</label>
                        {chipGroup(obs.energyLevel, v => setField('energyLevel', v), ['Normal', 'Lethargic', 'Hyperactive'])}
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Sleeping Pattern</label>
                        {chipGroup(obs.sleepChanges, v => setField('sleepChanges', v), ['Normal', 'Sleeping more', 'Sleeping less', 'Restless / Disturbed'])}
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelCls}>Mood / Behavior Changes</label>
                      {pillMultiSelect('moodChanges', ['None', 'Anxious', 'Aggressive', 'Withdrawn', 'Clingy'])}
                    </div>
                  </div>

                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>Digestive</h4>
                    <div className={fieldGridCls}>
                      <div>
                        <label className={fieldLabelCls}>Vomiting</label>
                        {toggleYesNo('vomiting')}
                        {obs.vomiting === 'yes' && (
                          <textarea
                            value={obs.vomitingDetails}
                            onChange={(e) => setField('vomitingDetails', e.target.value)}
                            placeholder="Frequency, appearance, timing..."
                            rows={2}
                            className={`${textCls} mt-2`}
                          />
                        )}
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Diarrhea / Constipation</label>
                        {chipGroup(obs.stoolChanges, v => setField('stoolChanges', v), ['Normal', 'Diarrhea', 'Constipation'])}
                        {obs.stoolChanges !== 'Normal' && (
                          <textarea
                            value={obs.stoolDetails}
                            onChange={(e) => setField('stoolDetails', e.target.value)}
                            placeholder="Frequency, consistency, color..."
                            rows={2}
                            className={`${textCls} mt-2`}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>Urinary</h4>
                    <div>
                      <label className={fieldLabelCls}>Urination Changes</label>
                      {pillMultiSelect('urinationChanges', ['Normal', 'More frequent', 'Less frequent', 'Unusual color', 'Straining', 'Accidents'])}
                    </div>
                  </div>

                  <div className={cardCls}>
                    <button
                      type="button"
                      onClick={() => setRespiratoryExpanded(v => !v)}
                      className="w-full flex items-center justify-between"
                    >
                      <h4 className={cardTitleCls}>Respiratory</h4>
                      {respiratoryExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    {respiratoryExpanded && (
                      <div className="space-y-4">
                        <div>
                          <label className={fieldLabelCls}>Coughing or Sneezing</label>
                          {toggleYesNo('coughing')}
                          {obs.coughing === 'yes' && (
                            <textarea
                              value={obs.coughingDetails}
                              onChange={(e) => setField('coughingDetails', e.target.value)}
                              placeholder="Frequency, severity (mild / moderate / severe)..."
                              rows={2}
                              className={`${textCls} mt-2`}
                            />
                          )}
                        </div>
                        <div>
                          <label className={fieldLabelCls}>Breathing Changes</label>
                          {pillMultiSelect('breathingChanges', ['Normal', 'Labored', 'Rapid', 'Noisy'])}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>Mobility & Skin</h4>
                    <div className={fieldGridCls}>
                      <div>
                        <label className={fieldLabelCls}>Limping / Difficulty Moving</label>
                        {toggleYesNo('limping')}
                        {obs.limping === 'yes' && (
                          <input
                            type="text"
                            value={obs.limpingDetails}
                            onChange={(e) => setField('limpingDetails', e.target.value)}
                            placeholder="Which limb, description..."
                            className={`${textCls} mt-2`}
                          />
                        )}
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Scratching, Licking, or Biting a Specific Area</label>
                        {toggleYesNo('scratchingLicking')}
                        {obs.scratchingLicking === 'yes' && (
                          <input
                            type="text"
                            value={obs.scratchingDetails}
                            onChange={(e) => setField('scratchingDetails', e.target.value)}
                            placeholder="Which area..."
                            className={`${textCls} mt-2`}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabelCls}>Wound / Incision Appearance</label>
                      {pillMultiSelect('woundAppearance', ['Looks normal', 'Redness', 'Swelling', 'Discharge', 'Pet licking it'])}
                    </div>
                  </div>

                  <div className={cardCls}>
                    <button
                      type="button"
                      onClick={() => setMedicationExpanded(v => !v)}
                      className="w-full flex items-center justify-between"
                    >
                      <h4 className={cardTitleCls}>Medication</h4>
                      {medicationExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                    {medicationExpanded && (
                      <div className="space-y-4">
                        <div>
                          <label className={fieldLabelCls}>Medication Given as Directed</label>
                          {chipGroup(obs.medicationCompliance, v => setField('medicationCompliance', v), ['Yes, as directed', 'Had difficulties', 'Not on medication'])}
                          {obs.medicationCompliance === 'Had difficulties' && (
                            <textarea
                              value={obs.medicationDifficulties}
                              onChange={(e) => setField('medicationDifficulties', e.target.value)}
                              placeholder="Describe the difficulties..."
                              rows={2}
                              className={`${textCls} mt-2`}
                            />
                          )}
                        </div>
                        <div>
                          <label className={fieldLabelCls}>Side Effects Noticed After Medication</label>
                          {toggleYesNo('sideEffects')}
                          {obs.sideEffects === 'yes' && (
                            <textarea
                              value={obs.sideEffectsDetails}
                              onChange={(e) => setField('sideEffectsDetails', e.target.value)}
                              placeholder="Describe the side effects..."
                              rows={2}
                              className={`${textCls} mt-2`}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cardCls}>
                    <h4 className={cardTitleCls}>Overall Assessment</h4>
                    <div className="space-y-4">
                      <div>
                        <label className={fieldLabelCls}>New or Worsening Symptoms Since Last Visit</label>
                        {toggleYesNo('newSymptoms')}
                        {obs.newSymptoms === 'yes' && (
                          <textarea
                            value={obs.newSymptomsDetails}
                            onChange={(e) => setField('newSymptomsDetails', e.target.value)}
                            placeholder="Describe the new or worsening symptoms..."
                            rows={2}
                            className={`${textCls} mt-2`}
                          />
                        )}
                      </div>
                      <div>
                        <label className={fieldLabelCls}>Overall Impression <span className="text-red-500">*</span></label>
                        {chipGroup(obs.overallImpression, v => setField('overallImpression', v), ['Better', 'Same', 'Worse'])}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Vet Notes */}
          <div>
            <h3 className="text-base font-semibold text-[#2C3E2D] mb-1">Vet Notes / Assessment</h3>
            <p className="text-sm text-gray-500 mb-3">Your clinical impression and any recommendations based on the online consultation.</p>
            <textarea
              value={vetNotes}
              onChange={(e) => setVetNotes(e.target.value)}
              placeholder="Based on the owner's description, possible differential diagnosis, advice given, next steps..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#DEEDED] resize-none"
            />
          </div>

          {/* Media Upload */}
          <div>
            <h3 className="text-base font-semibold text-[#2C3E2D] mb-1">Photos, Images & Videos</h3>
            <p className="text-sm text-gray-500 mb-3">Attach images or videos shared during the consultation (e.g. lesion photos, movement videos).</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Click to upload</p>
              <p className="text-xs text-gray-500 mt-1">Images (JPG, PNG) and videos (MP4, MOV) supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaUpload}
              className="hidden"
            />
            {media.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {media.map((item, idx) => {
                  const isVideo = item.contentType.startsWith('video/')
                  return (
                    <div key={idx} className="relative bg-gray-50 rounded-lg px-3 py-2 pr-8 text-xs text-gray-600 border border-gray-200 flex items-center gap-2">
                      {isVideo
                        ? <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                        : <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      }
                      <span className="truncate max-w-[140px]">{item.description || `File ${idx + 1}`}</span>
                      <button
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Share with owner toggle */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setSharedWithOwner((v) => !v)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${sharedWithOwner ? 'bg-[#476B6B]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sharedWithOwner ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-[#2C3E2D]">Share this record with the pet owner</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-3 text-sm font-medium text-white bg-[#476B6B] rounded-lg hover:bg-[#3f6161] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Follow-up Record'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}