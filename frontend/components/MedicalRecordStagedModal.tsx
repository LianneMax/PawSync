'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, updateMedicalRecord, emptyVitals, getDiagnosticTestServices, getMedicationServices, getPreventiveCareServices, type ProductService } from '@/lib/medicalRecords'
import { getPetById, updatePetConfinement } from '@/lib/pets'
import { updateAppointmentStatus } from '@/lib/appointments'
import { getVaccineTypes, createVaccination, updateVaccination, type VaccineType } from '@/lib/vaccinations'
import type { Medication, DiagnosticTest, PreventiveCare, Vitals } from '@/lib/medicalRecords'
import type { Pet } from '@/lib/pets'
import {
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Plus,
  Trash2,
  CheckCircle,
  Stethoscope,
  ClipboardList,
  FileCheck,
  PawPrint,
  Loader2,
  Save,
  Syringe,
  Pill,
  FlaskConical,
  Shield,
  Upload,
  AlertCircle,
  Lock,
  StickyNote,
} from 'lucide-react'
import { toast } from 'sonner'
import { getPetNotes, savePetNotes } from '@/lib/petNotes'

interface Props {
  recordId: string
  appointmentId?: string
  petId: string
  appointmentTypes?: string[]
  onComplete: () => void
  onClose: () => void
}

type StepKey = 1 | 2 | 3 | 4

// Steps for vaccination appointments (4 steps)
const VACC_STEP_LABELS: Record<StepKey, string> = {
  1: 'Pre-Procedure',
  2: 'During Procedure',
  3: 'Vaccination',
  4: 'Post-Procedure',
}

const VACC_STEP_ICONS: Record<StepKey, React.ReactNode> = {
  1: <Stethoscope className="w-4 h-4" />,
  2: <ClipboardList className="w-4 h-4" />,
  3: <Syringe className="w-4 h-4" />,
  4: <FileCheck className="w-4 h-4" />,
}

// Steps for regular appointments (3 steps)
const REG_STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Pre-Procedure',
  2: 'During Procedure',
  3: 'Post-Procedure',
}

const REG_STEP_ICONS: Record<1 | 2 | 3, React.ReactNode> = {
  1: <Stethoscope className="w-4 h-4" />,
  2: <ClipboardList className="w-4 h-4" />,
  3: <FileCheck className="w-4 h-4" />,
}

const emptyMedication = (): Omit<Medication, '_id'> => ({
  name: '',
  dosage: '',
  route: 'oral',
  frequency: '',
  duration: '',
  startDate: null,
  endDate: null,
  notes: '',
  status: 'active',
})

const emptyDiagnosticTest = (): Omit<DiagnosticTest, '_id'> => ({
  testType: 'other',
  name: '',
  date: null,
  result: '',
  normalRange: '',
  notes: '',
})

const emptyPreventiveCare = (): Omit<PreventiveCare, '_id'> => ({
  careType: 'other',
  product: '',
  dateAdministered: null,
  nextDueDate: null,
  notes: '',
})

function calcAge(dob: string): string {
  const d = new Date(dob)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`
}

export default function MedicalRecordStagedModal({ recordId, appointmentId, petId, appointmentTypes = [], onComplete, onClose }: Props) {
  const token = useAuthStore((s) => s.token)
  const [step, setStep] = useState<StepKey>(1)
  const [pet, setPet] = useState<Pet | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [vitalsOpen, setVitalsOpen] = useState(true)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [confined, setConfined] = useState(false)
  const [diagnosticTestServices, setDiagnosticTestServices] = useState<ProductService[]>([])
  const [medicationServices, setMedicationServices] = useState<ProductService[]>([])
  const [preventiveCareServices, setPreventiveCareServices] = useState<ProductService[]>([])

  // Vet notepad (pet-level)
  const [petNotesDraft, setPetNotesDraft] = useState('')
  const [petNotesSaving, setPetNotesSaving] = useState(false)
  const [petNotesSaved, setPetNotesSaved] = useState(false)
  const [notesMinimized, setNotesMinimized] = useState(false)

  // Whether this appointment includes vaccination/booster
  const isVaccinationAppt = appointmentTypes.some((t) => t === 'vaccination' || t === 'booster' || t === 'puppy-litter-vaccination')

  // Load pet-level vet notes on mount
  useEffect(() => {
    if (!petId || !token) return
    getPetNotes(petId, token).then((res) => {
      if (res.status === 'SUCCESS') setPetNotesDraft(res.data?.notes || '')
    })
  }, [petId, token])

  const handleSaveNotes = async () => {
    if (!token || !petId) return
    setPetNotesSaving(true)
    try {
      const res = await savePetNotes(petId, petNotesDraft, token)
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

  // Vaccine form state (step 3 for vaccination appointments)
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])
  const [vaccineTypeId, setVaccineTypeId] = useState('')
  const [vaccineManufacturer, setVaccineManufacturer] = useState('')
  const [vaccineBatchNumber, setVaccineBatchNumber] = useState('')
  const [vaccineRoute, setVaccineRoute] = useState('')
  const [vaccineDateAdministered, setVaccineDateAdministered] = useState(new Date().toISOString().split('T')[0])
  const [vaccineNotes, setVaccineNotes] = useState('')
  const [vaccineSubmitting, setVaccineSubmitting] = useState(false)
  const [vaccineCreated, setVaccineCreated] = useState(false)
  const [createdVaccineId, setCreatedVaccineId] = useState<string | null>(null)

  // Step 1 fields
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())
  const [vitalsErrors, setVitalsErrors] = useState<Partial<Record<keyof Vitals, string>>>({})

  // Step 2 fields
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('') // maps to overallObservation
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [xray, setXray] = useState(false)
  const [ultrasound, setUltrasound] = useState(false)
  const [availedProducts, setAvailedProducts] = useState(false)

  // Step 3 fields
  const [visitSummary, setVisitSummary] = useState('')
  const [medications, setMedications] = useState<Omit<Medication, '_id'>[]>([])
  const [diagnosticTests, setDiagnosticTests] = useState<Omit<DiagnosticTest, '_id'>[]>([])
  const [preventiveCare, setPreventiveCare] = useState<Omit<PreventiveCare, '_id'>[]>([])
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])

  // Collapsible sections in step 3
  const [medsOpen, setMedsOpen] = useState(true)
  const [testsOpen, setTestsOpen] = useState(true)
  const [preventiveOpen, setPreventiveOpen] = useState(true)

  const loadData = useCallback(async () => {
    if (!token) return
    const [recordRes, petRes, diagServicesRes, medServicesRes, prevCareServicesRes] = await Promise.all([
      getRecordById(recordId, token),
      getPetById(petId, token),
      getDiagnosticTestServices(token),
      getMedicationServices(token),
      getPreventiveCareServices(token),
    ])
    if (recordRes.status === 'SUCCESS' && recordRes.data?.record) {
      const r = recordRes.data.record
      setChiefComplaint(r.chiefComplaint || '')
      setVitals(r.vitals || emptyVitals())
      setSubjective(r.subjective || r.chiefComplaint || '')
      setObjective(r.overallObservation || '')
      setAssessment(r.assessment || '')
      setPlan(r.plan || '')
      setVisitSummary(r.visitSummary || '')
      setMedications((r.medications || []).map(({ _id: _, ...rest }) => rest))
      setDiagnosticTests((r.diagnosticTests || []).map(({ _id: _, ...rest }) => rest))
      setPreventiveCare((r.preventiveCare || []).map(({ _id: _, ...rest }) => rest))
      setSharedWithOwner(r.sharedWithOwner || false)
      const stageToStep: Record<string, StepKey> = isVaccinationAppt
        ? { pre_procedure: 1, in_procedure: 2, post_procedure: 4, completed: 4 }
        : { pre_procedure: 1, in_procedure: 2, post_procedure: 3, completed: 3 }
      const currentStep = stageToStep[r.stage] || 1
      setStep(currentStep)
      setAlreadyCompleted(r.stage === 'completed')
    }
    if (petRes.status === 'SUCCESS' && petRes.data?.pet) {
      const loadedPet = petRes.data.pet
      setPet(loadedPet)
      setConfined(loadedPet.isConfined || false)
      if (isVaccinationAppt) {
        const vts = await getVaccineTypes(loadedPet.species)
        setVaccineTypes(vts.filter((vt) => vt.isActive))
      }
    }
    if (diagServicesRes.status === 'SUCCESS' && diagServicesRes.data?.items) {
      setDiagnosticTestServices(diagServicesRes.data.items)
    }
    if (medServicesRes.status === 'SUCCESS' && medServicesRes.data?.items) {
      setMedicationServices(medServicesRes.data.items)
    }
    if (prevCareServicesRes.status === 'SUCCESS' && prevCareServicesRes.data?.items) {
      setPreventiveCareServices(prevCareServicesRes.data.items)
    }
  }, [recordId, petId, token, isVaccinationAppt])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-fill manufacturer and batch number from vaccine type defaults
  useEffect(() => {
    if (!vaccineTypeId) return
    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId)
    if (!vt) return
    if (vt.defaultManufacturer) setVaccineManufacturer(vt.defaultManufacturer)
    if (vt.defaultBatchNumber) setVaccineBatchNumber(vt.defaultBatchNumber)
    if (vt.route) setVaccineRoute(vt.route)
  }, [vaccineTypeId, vaccineTypes])

  const buildExtraObservation = () => {
    const extras: string[] = []
    if (xray) extras.push('X-Ray')
    if (ultrasound) extras.push('Ultrasound')
    if (availedProducts) extras.push('Availed Products')
    if (extras.length === 0) return objective
    return objective + (objective ? '\n\n' : '') + `Services availed: ${extras.join(', ')}`
  }

  // Computes the confinement action for logging and syncs the pet's isConfined flag.
  // Returns 'confined', 'released', or 'none'.
  const syncConfinement = async (): Promise<{ action: 'none' | 'confined' | 'released'; days: number }> => {
    const wasConfined = pet?.isConfined || false
    let days = 0
    if (confined !== wasConfined) {
      const result = await updatePetConfinement(petId, confined, token!)
      if (result.status !== 'SUCCESS') {
        throw new Error(result.message || 'Failed to update pet confinement status')
      }
      days = result.data?.confinementDays ?? 0
      setPet((prev) => prev ? { ...prev, isConfined: confined } : prev)
    }
    if (confined) return { action: 'confined', days }
    if (wasConfined && !confined) return { action: 'released', days }
    return { action: 'none', days: 0 }
  }

  const handleSaveAndClose = async () => {
    if (!token) return
    setSaving(true)
    try {
      if (step === 3 && isVaccinationAppt) await trySaveVaccination()
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      await updateMedicalRecord(recordId, {
        chiefComplaint,
        vitals,
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        visitSummary,
        medications,
        diagnosticTests,
        preventiveCare,
        sharedWithOwner,
        confinementAction,
        confinementDays,
      }, token)
      await handleSaveNotes()
      toast.success('Progress saved')
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleProceedStep1 = async () => {
    if (!token) return
    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        stage: 'in_procedure',
        chiefComplaint,
        vitals,
      }, token)
      setSubjective((prev) => prev || chiefComplaint)
      setStep(2)
    } catch {
      toast.error('Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitVaccine = async () => {
    if (!token || !vaccineTypeId) return
    setVaccineSubmitting(true)
    try {
      if (vaccineCreated && createdVaccineId) {
        // Update the existing record if the vet changes something
        await updateVaccination(createdVaccineId, {
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
        }, token)
        toast.success('Vaccination record updated')
      } else {
        const res = await createVaccination({
          petId,
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
          medicalRecordId: recordId,
          appointmentId: appointmentId || undefined,
        }, token)
        toast.success('Vaccination record saved')
        setVaccineCreated(true)
        setCreatedVaccineId(res._id)
      }
    } catch {
      toast.error('Failed to save vaccination')
    } finally {
      setVaccineSubmitting(false)
    }
  }

  const handleProceedStep2 = async () => {
    if (!token) return
    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        // Only advance stage to post_procedure if not a vaccination appointment
        // (vaccination appointments have an intermediate step)
        ...(!isVaccinationAppt ? { stage: 'post_procedure' } : {}),
      }, token)
      await handleSaveNotes()
      setStep(isVaccinationAppt ? 3 : 3)
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  // Silently save vaccination data if a vaccine type has been selected — used by
  // Save & Close, X, and Back so progress is never lost.
  const trySaveVaccination = async () => {
    if (!token || !vaccineTypeId) return
    try {
      if (vaccineCreated && createdVaccineId) {
        await updateVaccination(createdVaccineId, {
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
        }, token)
      } else {
        const res = await createVaccination({
          petId,
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
          medicalRecordId: recordId,
          appointmentId: appointmentId || undefined,
        }, token)
        setVaccineCreated(true)
        setCreatedVaccineId(res._id)
      }
    } catch {
      // silent — don't block close/back on a vaccination save error
    }
  }

  const handleProceedStep3Vaccination = async () => {
    if (!token) return
    setSaving(true)
    try {
      await trySaveVaccination()
      await updateMedicalRecord(recordId, { stage: 'post_procedure' }, token)
      setStep(4)
    } catch {
      toast.error('Failed to save vaccination')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteRecord = async () => {
    if (!token) return
    setCompleting(true)
    try {
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      await updateMedicalRecord(recordId, {
        stage: 'completed',
        visitSummary,
        medications,
        diagnosticTests,
        preventiveCare,
        sharedWithOwner,
        images,
        confinementAction,
        confinementDays,
      }, token)
      if (!alreadyCompleted && appointmentId) {
        await updateAppointmentStatus(appointmentId, 'completed', token)
      }
      await handleSaveNotes()
      toast.success('Visit completed!')
      onComplete()
    } catch {
      toast.error('Failed to complete visit')
    } finally {
      setCompleting(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        setImages((prev) => [...prev, { data: base64, contentType: file.type, description: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  const updateVital = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }))
    if (field === 'value') {
      if (key === 'bodyConditionScore') {
        const num = Number(val)
        const hasError = val !== '' && (isNaN(num) || num < 1 || num > 5)
        setVitalsErrors((prev) => ({ ...prev, bodyConditionScore: hasError ? 'Must be between 1 and 5' : '' }))
      } else if (key === 'dentalScore') {
        const num = Number(val)
        const hasError = val !== '' && (isNaN(num) || num < 1 || num > 3)
        setVitalsErrors((prev) => ({ ...prev, dentalScore: hasError ? 'Must be between 1 and 3' : '' }))
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex items-stretch gap-3 w-full max-w-[88vw] h-[92vh]">

      {/* ===== MAIN MODAL ===== */}
      <div className="bg-white rounded-3xl shadow-2xl flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#476B6B] rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#4F4F4F]">Visit Record</h2>
              {pet && (
                <p className="text-xs text-gray-500">{pet.name} · {pet.breed}</p>
              )}
            </div>
          </div>
          <button
            onClick={async () => { if (step === 3 && isVaccinationAppt) await trySaveVaccination(); onClose() }}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {(isVaccinationAppt ? ([1, 2, 3, 4] as StepKey[]) : ([1, 2, 3] as StepKey[])).map((s, idx, arr) => {
              const labels = isVaccinationAppt ? VACC_STEP_LABELS : REG_STEP_LABELS as Record<StepKey, string>
              const icons = isVaccinationAppt ? VACC_STEP_ICONS : REG_STEP_ICONS as Record<StepKey, React.ReactNode>
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    s === step
                      ? 'bg-[#476B6B] text-white'
                      : s < step
                      ? 'bg-[#7FA5A3]/20 text-[#476B6B]'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {s < step ? <CheckCircle className="w-3 h-3" /> : icons[s]}
                    <span className="hidden sm:inline">{labels[s]}</span>
                    <span className="sm:hidden">{s}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── STEP 1: PRE-PROCEDURE ── */}
          {step === 1 && (
            <>
              {/* Pet identification */}
              {pet && (
                <div className="bg-[#f0f7f7] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PawPrint className="w-4 h-4 text-[#476B6B]" />
                    <span className="text-sm font-semibold text-[#476B6B]">Patient Identification</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Name</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Species</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.species}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Breed</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.breed}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Age</p>
                      <p className="font-medium text-[#4F4F4F]">{calcAge(pet.dateOfBirth)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Sex</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.sex}</p>
                    </div>
                    {pet.microchipNumber && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Microchip</p>
                        <p className="font-medium text-[#4F4F4F] text-xs">{pet.microchipNumber}</p>
                      </div>
                    )}
                  </div>
                  {pet.allergies && pet.allergies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#7FA5A3]/20">
                      <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Allergies
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {pet.allergies.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confinement alert */}
              {pet?.isConfined && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">This pet is currently confined</p>
                    <p className="text-xs text-amber-600">
                      {(() => {
                        if (!pet.confinedSince) return 'Release the pet from confinement in the Post-Procedure step.'
                        const days = Math.max(1, Math.ceil((Date.now() - new Date(pet.confinedSince).getTime()) / 86400000))
                        return `Confined for ${days} day${days !== 1 ? 's' : ''}. Release from confinement in the Post-Procedure step.`
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* Chief complaint */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">
                  Chief Complaint / Reason for Visit
                </label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                  placeholder="Describe the owner's complaint and reason for today's visit…"
                />
              </div>

              {/* Vitals */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setVitalsOpen(!vitalsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#7FA5A3]" />
                    Vitals
                  </span>
                  {vitalsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {vitalsOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                    {([
                      { key: 'weight' as const, label: 'Weight', unit: 'kg' },
                      { key: 'temperature' as const, label: 'Temperature', unit: '°C' },
                      { key: 'pulseRate' as const, label: 'Pulse Rate', unit: 'bpm' },
                      { key: 'spo2' as const, label: 'SpO₂', unit: '%' },
                      { key: 'bodyConditionScore' as const, label: 'Body Condition Score', unit: '/5' },
                      { key: 'dentalScore' as const, label: 'Dental Score', unit: '/3' },
                      { key: 'crt' as const, label: 'CRT', unit: 'sec' },
                    ] as const).map(({ key, label, unit }) => (
                      <div key={key} className="grid grid-cols-2 gap-2 pt-3 first:pt-0 border-t border-gray-50 first:border-0">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">{label} <span className="text-gray-300">({unit})</span></label>
                          <input
                            type="text"
                            value={String(vitals[key]?.value ?? '')}
                            onChange={(e) => updateVital(key, 'value', e.target.value)}
                            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${vitalsErrors[key] ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                            placeholder={unit}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Notes</label>
                          <input
                            type="text"
                            value={vitals[key]?.notes ?? ''}
                            onChange={(e) => updateVital(key, 'notes', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            placeholder="Optional"
                          />
                        </div>
                        {vitalsErrors[key] && (
                          <p className="col-span-2 text-xs text-red-500 -mt-1">{vitalsErrors[key]}</p>
                        )}
                      </div>
                    ))}
                    {/* Checkboxes */}
                    <div className="flex gap-4 pt-3 border-t border-gray-50">
                      {([
                        { key: 'pregnancy' as const, label: 'Pregnancy' },
                        { key: 'vaccinated' as const, label: 'Vaccinated' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vitals[key]?.value === 'yes'}
                            onChange={(e) => updateVital(key, 'value', e.target.checked ? 'yes' : 'no')}
                            className="w-4 h-4 accent-[#476B6B]"
                          />
                          <span className="text-sm text-gray-600">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 2: DURING PROCEDURE ── */}
          {step === 2 && (
            <>
              {/* Vitals summary (collapsible) */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setVitalsOpen(!vitalsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    Vitals Summary
                  </span>
                  {vitalsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {vitalsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                      {([
                        { key: 'weight' as const, label: 'Weight', unit: 'kg' },
                        { key: 'temperature' as const, label: 'Temp', unit: '°C' },
                        { key: 'pulseRate' as const, label: 'Pulse', unit: 'bpm' },
                        { key: 'spo2' as const, label: 'SpO₂', unit: '%' },
                      ] as const).map(({ key, label, unit }) => (
                        <div key={key} className="bg-white rounded-xl p-2 text-center">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-[#4F4F4F]">
                            {vitals[key]?.value ? `${vitals[key].value} ${unit}` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SOAP Notes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-[#476B6B]" />
                  <h3 className="text-sm font-semibold text-[#4F4F4F]">SOAP Notes</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      S — Subjective <span className="font-normal text-gray-400">(Patient history / owner complaint)</span>
                    </label>
                    <textarea
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Owner's description, patient history, presenting complaint…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      O — Objective <span className="font-normal text-gray-400">(Physical examination findings)</span>
                    </label>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Physical exam findings, measurable observations, test results…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      A — Assessment <span className="font-normal text-gray-400">(Diagnosis / differential diagnosis)</span>
                    </label>
                    <textarea
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Clinical diagnosis, differential diagnoses, clinical impression…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      P — Plan <span className="font-normal text-gray-400">(Treatment plan / next steps)</span>
                    </label>
                    <textarea
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Treatment plan, follow-up instructions, referrals…"
                    />
                  </div>
                </div>
              </div>

              {/* Diagnostic Tests */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setTestsOpen(!testsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#7FA5A3]" />
                    Diagnostic Tests <span className="text-xs font-normal text-gray-400 ml-1">({diagnosticTests.length})</span>
                  </span>
                  {testsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {testsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {diagnosticTests.map((test, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Test {i + 1}</span>
                          <button onClick={() => setDiagnosticTests((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={test.name} onChange={(e) => {
                            const selectedService = diagnosticTestServices.find((s) => s.name === e.target.value)
                            setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, name: e.target.value, testType: 'other' } : t))
                          }} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="">Select a diagnostic test service</option>
                            {diagnosticTestServices.map((service) => (
                              <option key={service._id} value={service.name}>{service.name} {service.price ? `(₱${service.price})` : ''}</option>
                            ))}
                          </select>
                          <input type="date" value={test.date || ''} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, date: e.target.value || null } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" placeholder="Test date" />
                          <input type="text" placeholder="Normal range" value={test.normalRange} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, normalRange: e.target.value } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                        </div>
                        <textarea rows={2} placeholder="Result" value={test.result} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, result: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] resize-none" />
                        <input type="text" placeholder="Notes (optional)" value={test.notes} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, notes: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setDiagnosticTests((prev) => [...prev, emptyDiagnosticTest()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Test
                    </button>
                  </div>
                )}
              </div>

            </>
          )}

          {/* ── STEP 3: VACCINATION (vaccination appointments only) ── */}
          {step === 3 && isVaccinationAppt && (
            <div className="space-y-5">
              {/* Patient card */}
              {pet && (
                <div className="bg-[#f0f7f7] rounded-2xl p-4">
                  <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-3 flex items-center gap-2">
                    <PawPrint className="w-4 h-4" /> Patient
                  </p>
                  <div className="flex items-center gap-3">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#7FA5A3]/20 flex items-center justify-center">
                        <PawPrint className="w-6 h-6 text-[#476B6B]" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[#4F4F4F]">{pet.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{pet.species} · {pet.breed}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vaccine Details */}
              <div>
                <p className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">Vaccine Details</p>

                <div className="space-y-4">
                  {/* Vaccine Type */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                      Vaccine Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={vaccineTypeId}
                      onChange={(e) => setVaccineTypeId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                    >
                      <option value="">Select vaccine type…</option>
                      {vaccineTypes.map((vt) => (
                        <option key={vt._id} value={vt._id}>{vt.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Validity preview */}
                  {vaccineTypeId && (() => {
                    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId)
                    if (!vt) return null
                    const base = new Date(vaccineDateAdministered)
                    const expiry = new Date(base); expiry.setDate(expiry.getDate() + (vt.validityDays || 0))
                    const nextDue = vt.requiresBooster && vt.boosterIntervalDays != null
                      ? (() => { const d = new Date(base); d.setDate(d.getDate() + (vt.boosterIntervalDays as number)); return d })()
                      : null
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#F4D3D2] border border-[#983232] rounded-xl p-3">
                          <p className="text-[10px] font-bold text-[#983232] uppercase tracking-wide">Expires</p>
                          <p className="font-bold text-[#983232] text-sm mt-0.5">{expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        {nextDue && (
                          <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-xl p-3">
                            <p className="text-[10px] font-bold text-[#4569B1] uppercase tracking-wide">Next Due</p>
                            <p className="font-bold text-[#4569B1] text-sm mt-0.5">{nextDue.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Date Administered */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                      Date Administered <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={vaccineDateAdministered}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setVaccineDateAdministered(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>

                  {/* Route */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Route</label>
                    <select
                      value={vaccineRoute}
                      onChange={(e) => setVaccineRoute(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                    >
                      <option value="">Select route…</option>
                      <option value="subcutaneous">Subcutaneous (SC)</option>
                      <option value="intramuscular">Intramuscular (IM)</option>
                      <option value="intranasal">Intranasal (IN)</option>
                      <option value="oral">Oral</option>
                    </select>
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={vaccineManufacturer}
                      onChange={(e) => setVaccineManufacturer(e.target.value)}
                      placeholder="e.g. Merial, Zoetis…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>

                  {/* Batch / Lot Number */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Batch / Lot Number</label>
                    <input
                      type="text"
                      value={vaccineBatchNumber}
                      onChange={(e) => setVaccineBatchNumber(e.target.value)}
                      placeholder="e.g. A12345"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>

                  {/* Clinical Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Clinical Notes</label>
                    <textarea
                      value={vaccineNotes}
                      onChange={(e) => setVaccineNotes(e.target.value)}
                      rows={3}
                      placeholder="Any observations, reactions, or special instructions…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                    />
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 (regular) / STEP 4 (vaccination): POST-PROCEDURE ── */}
          {((step === 3 && !isVaccinationAppt) || step === 4) && (
            <>
              {/* Visit Summary */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">Visit Summary and Diagnosis</label>
                <textarea
                  value={visitSummary}
                  onChange={(e) => setVisitSummary(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                  placeholder="Brief summary of today's visit, key findings, outcome…"
                />
              </div>

              {/* Medications */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setMedsOpen(!medsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Pill className="w-4 h-4 text-[#7FA5A3]" />
                    Medications <span className="text-xs font-normal text-gray-400 ml-1">({medications.length})</span>
                  </span>
                  {medsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {medsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {medications.map((med, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Medication {i + 1}</span>
                          <button onClick={() => setMedications((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={med.name} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="">Select a medication</option>
                            {medicationServices.map((service) => (
                              <option key={service._id} value={service.name}>{service.name} {service.price ? `(₱${service.price})` : ''}</option>
                            ))}
                          </select>
                          <input type="text" placeholder="Dosage (e.g. 10mg)" value={med.dosage} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.route} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, route: e.target.value as Medication['route'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="oral">Oral</option>
                            <option value="topical">Topical</option>
                            <option value="injection">Injection</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Frequency (e.g. twice daily)" value={med.frequency} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Duration (e.g. 7 days)" value={med.duration} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, duration: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.status} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, status: e.target.value as Medication['status'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="discontinued">Discontinued</option>
                          </select>
                        </div>
                        <input type="text" placeholder="Notes (optional)" value={med.notes} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, notes: e.target.value } : m))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setMedications((prev) => [...prev, emptyMedication()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Medication
                    </button>
                  </div>
                )}
              </div>

              {/* Preventive Care */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setPreventiveOpen(!preventiveOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#7FA5A3]" />
                    Preventive Care <span className="text-xs font-normal text-gray-400 ml-1">({preventiveCare.length})</span>
                  </span>
                  {preventiveOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {preventiveOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {preventiveCare.map((care, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Preventive Care {i + 1}</span>
                          <button onClick={() => setPreventiveCare((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={care.product} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, product: e.target.value, careType: 'other' } : c))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="">Select a preventive care service</option>
                            {preventiveCareServices.map((service) => (
                              <option key={service._id} value={service.name}>{service.name} {service.price ? `(₱${service.price})` : ''}</option>
                            ))}
                          </select>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Date Administered</label>
                            <input type="date" value={care.dateAdministered || ''} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, dateAdministered: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Next Due Date</label>
                            <input type="date" value={care.nextDueDate || ''} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, nextDueDate: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                        </div>
                        <input type="text" placeholder="Notes (optional)" value={care.notes} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, notes: e.target.value } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setPreventiveCare((prev) => [...prev, emptyPreventiveCare()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Image uploads */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#7FA5A3]" />
                  Attachments
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#7FA5A3] transition-colors w-fit">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload images</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {images.map((img, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1">
                        <span className="text-xs text-gray-600">{img.description}</span>
                        <button onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pet confinement */}
              <div className={`flex items-center justify-between p-4 rounded-2xl border ${confined ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-transparent'}`}>
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">
                    {confined ? 'Release Pet from Confinement' : 'Mark Pet as Confined'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {confined
                      ? 'Toggle off to release this pet from confinement after saving'
                      : 'Toggle to mark this pet as confined after saving'}
                  </p>
                </div>
                <button
                  onClick={() => setConfined(!confined)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${confined ? 'bg-amber-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${confined ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Share with owner */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Share with Owner</p>
                  <p className="text-xs text-gray-500">{sharedWithOwner ? 'Owner can view this record' : 'Record is private'}</p>
                </div>
                <button
                  onClick={() => setSharedWithOwner(!sharedWithOwner)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${sharedWithOwner ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sharedWithOwner ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <button
            onClick={handleSaveAndClose}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Close
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={async () => {
                  if (step === 3 && isVaccinationAppt) await trySaveVaccination()
                  setStep((s) => (s - 1) as StepKey)
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            )}
            {step === 1 && (
              <button
                onClick={handleProceedStep1}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Consultation
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleProceedStep2}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isVaccinationAppt ? 'Proceed to Vaccination' : 'Proceed to Post-Procedure'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && isVaccinationAppt && (
              <button
                onClick={handleProceedStep3Vaccination}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Post-Procedure
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {((step === 3 && !isVaccinationAppt) || step === 4) && (
              <button
                onClick={handleCompleteRecord}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2 bg-[#35785C] text-white rounded-xl text-sm font-medium hover:bg-[#2a6049] transition-colors disabled:opacity-60"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Complete Record & Finish Visit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== VET NOTEPAD PANEL (right, collapsible) ===== */}
      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${notesMinimized ? 'w-10' : 'w-[22rem]'}`}>
        {notesMinimized ? (
          <button
            onClick={() => setNotesMinimized(false)}
            className="flex flex-col items-center justify-center h-full gap-3 text-[#476B6B] hover:bg-gray-50 w-full px-1"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span
              className="text-[10px] font-semibold tracking-widest uppercase text-[#476B6B]"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Vet Notes
            </span>
          </button>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
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
                  title="Minimize"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
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
                className="flex-1 w-full text-sm text-[#4F4F4F] resize-none focus:outline-none bg-white border border-gray-200 rounded-xl p-2.5 leading-relaxed focus:ring-1 focus:ring-[#7FA5A3]"
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

      </div>
    </div>
  )
}
