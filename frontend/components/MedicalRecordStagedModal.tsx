'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, updateMedicalRecord, emptyVitals, getDiagnosticTestServices, getMedicationServices, getPreventiveCareServices, getSurgeryServices, type ProductService } from '@/lib/medicalRecords'
import { getPetById, updatePetConfinement } from '@/lib/pets'
import { updateAppointmentStatus } from '@/lib/appointments'
import { getVaccineTypes, createVaccination, updateVaccination, type VaccineType } from '@/lib/vaccinations'
import type { Medication, DiagnosticTest, PreventiveCare, Vitals } from '@/lib/medicalRecords'
import type { Pet } from '@/lib/pets'
import SurgeryAppointmentModal from './SurgeryAppointmentModal'
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
  Scissors,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getPetNotes, savePetNotes } from '@/lib/petNotes'
import { Switch } from '@/components/ui/switch'

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

// Steps for surgery appointments (4 steps)
const SURG_STEP_LABELS: Record<StepKey, string> = {
  1: 'Pre-Procedure',
  2: 'During Procedure',
  3: 'Surgery',
  4: 'Post-Procedure',
}

const SURG_STEP_ICONS: Record<StepKey, React.ReactNode> = {
  1: <Stethoscope className="w-4 h-4" />,
  2: <ClipboardList className="w-4 h-4" />,
  3: <Scissors className="w-4 h-4" />,
  4: <FileCheck className="w-4 h-4" />,
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

// Map product names to careType enum values
// Handles: Deworming, Flea and Tick Prevention
const mapProductToCareType = (productName: string): 'flea' | 'tick' | 'heartworm' | 'deworming' | 'other' => {
  const productLower = productName.toLowerCase()
  if (productLower.includes('deworming')) return 'deworming'
  if (productLower.includes('flea') || productLower.includes('tick')) return 'flea' // "Flea and Tick Prevention" → 'flea'
  if (productLower.includes('heartworm')) return 'heartworm'
  return 'other'
}

function calcAge(dob: string): string {
  const d = new Date(dob)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`
}

function calculateAgeInMonths(dob: string): number {
  const d = new Date(dob)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  return months < 0 ? 0 : months
}

function monthsToWeeks(months: number): number {
  return Math.round(months * 4.3)
}

function validateVaccineAge(petDob: string, minAgeMonths: number, maxAgeMonths: number | null): { isValid: boolean; message: string } {
  const petAgeMonths = calculateAgeInMonths(petDob)
  const petAgeWeeks = monthsToWeeks(petAgeMonths)
  const minWeeks = monthsToWeeks(minAgeMonths)
  const maxWeeks = maxAgeMonths ? monthsToWeeks(maxAgeMonths) : null

  const ageLabel = `${petAgeMonths} months (${petAgeWeeks} weeks)`

  if (petAgeMonths < minAgeMonths) {
    return {
      isValid: false,
      message: `Pet is ${ageLabel} old. This vaccine requires minimum ${minAgeMonths} months (${minWeeks} weeks).`,
    }
  }

  if (maxWeeks && petAgeMonths > (maxAgeMonths || 0)) {
    return {
      isValid: false,
      message: `Pet is ${ageLabel} old. This vaccine is only for ${minAgeMonths}-${maxAgeMonths} months (${minWeeks}-${maxWeeks} weeks) old pets.`,
    }
  }

  return {
    isValid: true,
    message: `Pet is ${ageLabel} old - eligible for this vaccine.`,
  }
}

export default function MedicalRecordStagedModal({ recordId, appointmentId, petId, appointmentTypes = [], onComplete, onClose }: Props) {
  const token = useAuthStore((s) => s.token)
  const [step, setStep] = useState<StepKey>(1)
  const [pet, setPet] = useState<Pet | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [vitalsOpen, setVitalsOpen] = useState(true)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [confined, setConfined] = useState(false)
  const [discharge, setDischarge] = useState(false)
  const [referral, setReferral] = useState(false)
  const [surgery, setSurgery] = useState(false)
  const [showSurgeryModal, setShowSurgeryModal] = useState(false)
  const [carePlanOpen, setCarePlanOpen] = useState(true)
  const [diagnosticTestServices, setDiagnosticTestServices] = useState<ProductService[]>([])
  const [medicationServices, setMedicationServices] = useState<ProductService[]>([])
  const [preventiveCareServices, setPreventiveCareServices] = useState<ProductService[]>([])
  
  // Clinic and vet info for surgery appointment modal
  const [clinicId, setClinicId] = useState<string>('')
  const [clinicBranchId, setClinicBranchId] = useState<string>('')
  const [vetId, setVetId] = useState<string>('')

  // Vet notepad (pet-level)
  const [petNotesDraft, setPetNotesDraft] = useState('')
  const [petNotesSaving, setPetNotesSaving] = useState(false)
  const [petNotesSaved, setPetNotesSaved] = useState(false)
  const [notesMinimized, setNotesMinimized] = useState(false)

  // Whether this appointment includes vaccination/booster
  const isVaccinationAppt = appointmentTypes.some((t) => t === 'vaccination' || t === 'booster' || t === 'puppy-litter-vaccination' || t === 'rabies-vaccination')

  // Whether this appointment is a surgery appointment
  const isSurgeryAppt = !isVaccinationAppt && appointmentTypes.some((t) =>
    t === 'sterilization' || t === 'Sterilization' ||
    t === 'abdominal-surgery' || t === 'orthopedic-surgery' ||
    t === 'dental-scaling' || t === 'laser-therapy'
  )

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

  // Surgery form state (step 3 for surgery appointments)
  const [surgeryServices, setSurgeryServices] = useState<ProductService[]>([])
  const [surgeryServicesLoading, setSurgeryServicesLoading] = useState(false)
  const [surgeryTypeId, setSurgeryTypeId] = useState('')
  const [surgeryVetRemarks, setSurgeryVetRemarks] = useState('')
  const [surgeryImages, setSurgeryImages] = useState<{
    type: 'before' | 'during' | 'after'
    file: File | null
    preview: string | null
  }[]>([
    { type: 'before', file: null, preview: null },
    { type: 'during', file: null, preview: null },
    { type: 'after', file: null, preview: null },
  ])

  // Vaccine form state (step 3 for vaccination appointments)
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])
  const [vaccineTypeId, setVaccineTypeId] = useState('')
  const [vaccineManufacturer, setVaccineManufacturer] = useState('')
  const [vaccineBatchNumber, setVaccineBatchNumber] = useState('')
  const [vaccineRoute, setVaccineRoute] = useState('')
  const [vaccineDateAdministered, setVaccineDateAdministered] = useState(new Date().toISOString().split('T')[0])
  const [vaccineNotes, setVaccineNotes] = useState('')
  const [vaccineNextDueDate, setVaccineNextDueDate] = useState('')
  const [vaccineSubmitting, setVaccineSubmitting] = useState(false)
  const [vaccineCreated, setVaccineCreated] = useState(false)
  const [createdVaccineId, setCreatedVaccineId] = useState<string | null>(null)
  const [vaccineSaving, setVaccineSaving] = useState(false)
  const [vaccineAgeError, setVaccineAgeError] = useState<string | null>(null)
  const [vaccineAgeValid, setVaccineAgeValid] = useState(true)

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
      
      // Store clinic and vet info for surgery appointment modal
      if (r.clinicId?._id) setClinicId(r.clinicId._id)
      if (r.clinicBranchId?._id) setClinicBranchId(r.clinicBranchId._id)
      if (r.vetId?._id) setVetId(r.vetId._id)
      
      const stageToStep: Record<string, StepKey> = (isVaccinationAppt || isSurgeryAppt)
        ? { pre_procedure: 1, in_procedure: 2, post_procedure: 4, completed: 4 }
        : { pre_procedure: 1, in_procedure: 2, post_procedure: 3, completed: 3 }
      const currentStep = stageToStep[r.stage] || 1
      setStep(currentStep)
      setAlreadyCompleted(r.stage === 'completed')
      if (isSurgeryAppt && r.surgeryRecord) {
        setSurgeryVetRemarks(r.surgeryRecord.vetRemarks || '')
      }
      if (isSurgeryAppt && r.images && r.images.length > 0) {
        setSurgeryImages((prev) =>
          prev.map((slot) => {
            const saved = r.images.find(
              (img: any) => img.description === `${slot.type} surgery image` && img.data
            )
            if (!saved) return slot
            return { ...slot, preview: `data:${saved.contentType};base64,${saved.data}`, file: null }
          })
        )
      }
    }
    if (petRes.status === 'SUCCESS' && petRes.data?.pet) {
      const loadedPet = petRes.data.pet
      setPet(loadedPet)
      setConfined(loadedPet.isConfined || false)
      if (isVaccinationAppt) {
        const vts = await getVaccineTypes(loadedPet.species)
        setVaccineTypes(vts.filter((vt) => vt.isActive))
      }
      if (isSurgeryAppt) {
        setSurgeryServicesLoading(true)
        const sres = await getSurgeryServices(token as string)
        if (sres.status === 'SUCCESS' && sres.data?.items) {
          setSurgeryServices(sres.data.items)
          // Restore saved surgery type from surgeryRecord if available
          if (recordRes.data?.record?.surgeryRecord?.surgeryType) {
            const saved = sres.data.items.find((s: ProductService) =>
              s.name.toLowerCase() === recordRes.data!.record!.surgeryRecord!.surgeryType.toLowerCase()
            )
            if (saved) setSurgeryTypeId(saved._id)
          } else if (appointmentTypes.length > 0 && sres.data.items.length > 0) {
            // Auto-select surgery type based on appointmentTypes
            const surgeryType = appointmentTypes.find(t =>
              t === 'sterilization' || t === 'Sterilization' ||
              t === 'abdominal-surgery' || t === 'orthopedic-surgery' ||
              t === 'dental-scaling' || t === 'laser-therapy'
            )
            if (surgeryType) {
              const typeMap: Record<string, string> = {
                'sterilization': 'Sterilization',
                'Sterilization': 'Sterilization',
                'abdominal-surgery': 'Abdominal Surgery',
                'orthopedic-surgery': 'Orthopedic Surgery',
                'dental-scaling': 'Dental Scaling',
                'laser-therapy': 'Laser Therapy',
              }
              const surgeryName = typeMap[surgeryType]
              const matchedService = sres.data.items.find((s: ProductService) =>
                s.name.toLowerCase() === surgeryName.toLowerCase()
              )
              if (matchedService) setSurgeryTypeId(matchedService._id)
            }
          }
        }
        setSurgeryServicesLoading(false)
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

  // Auto-populate preventive care based on appointment types
  useEffect(() => {
    if (preventiveCare.length > 0 || appointmentTypes.length === 0 || preventiveCareServices.length === 0) {
      return // Already has preventive care or no appointment types to process
    }

    const preventiveCareTypes = appointmentTypes.filter(t => 
      t === 'deworming' || t === 'flea-tick-prevention' || 
      t === 'Preventive Care' || t === 'heartworm'
    )

    if (preventiveCareTypes.length === 0) return

    const serviceNameMap: Record<string, string> = {
      'deworming': 'Deworming',
      'flea-tick-prevention': 'Flea and Tick Prevention',
      'Preventive Care': 'Preventive Care',
      'heartworm': 'Heartworm Prevention'
    }

    const autoPop: any[] = []
    for (const type of preventiveCareTypes) {
      const serviceName = serviceNameMap[type]
      if (serviceName) {
        const service = preventiveCareServices.find((s) => 
          s.name.toLowerCase() === serviceName.toLowerCase()
        )
        if (service) {
          autoPop.push({
            careType: mapProductToCareType(service.name),
            product: service.name,
            dateAdministered: null,
            nextDueDate: null,
            notes: ''
          })
        }
      }
    }

    if (autoPop.length > 0) {
      setPreventiveCare(autoPop)
    }
  }, [appointmentTypes, preventiveCareServices, preventiveCare.length])

  // Auto-fill manufacturer and batch number from vaccine type defaults
  // Also validate pet age against vaccine type age requirements
  useEffect(() => {
    if (!vaccineTypeId) {
      setVaccineAgeError(null)
      setVaccineAgeValid(true)
      return
    }
    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId)
    if (!vt) return
    
    // Auto-fill defaults
    if (vt.defaultManufacturer) setVaccineManufacturer(vt.defaultManufacturer)
    if (vt.defaultBatchNumber) setVaccineBatchNumber(vt.defaultBatchNumber)
    if (vt.route) setVaccineRoute(vt.route)
    
    // Validate pet age
    if (pet?.dateOfBirth) {
      const validation = validateVaccineAge(pet.dateOfBirth, vt.minAgeMonths || 0, vt.maxAgeMonths || null)
      setVaccineAgeValid(validation.isValid)
      setVaccineAgeError(validation.message)
    }
  }, [vaccineTypeId, vaccineTypes, pet?.dateOfBirth])

  // Convert surgery images state into the base64 payload for updateMedicalRecord
  const buildSurgeryImagesPayload = () =>
    surgeryImages
      .filter((img) => img.preview !== null)
      .map((img) => ({
        data: img.preview!.split(',')[1] ?? img.preview!,
        contentType: img.file?.type || 'image/jpeg',
        description: `${img.type} surgery image`,
      }))

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
      const surgImgs = isSurgeryAppt ? buildSurgeryImagesPayload() : undefined
      const selectedSurgery = isSurgeryAppt ? surgeryServices.find((s) => s._id === surgeryTypeId) : undefined
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
        ...(isSurgeryAppt ? {
          ...(surgImgs && surgImgs.length > 0 ? { images: surgImgs } : {}),
          surgeryRecord: {
            surgeryType: selectedSurgery?.name || '',
            vetRemarks: surgeryVetRemarks,
          },
        } : {}),
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
    if (!vaccineAgeValid) {
      toast.error('Cannot save: pet does not meet the age requirements for this vaccine.')
      return
    }
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
          nextDueDate: vaccineNextDueDate || undefined,
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
          nextDueDate: vaccineNextDueDate || undefined,
          medicalRecordId: recordId,
          appointmentId: appointmentId || undefined,
          clinicId: clinicId || undefined,
          clinicBranchId: clinicBranchId || undefined,
        }, token)
        setVaccineCreated(true)
        setCreatedVaccineId(res._id)
        if (res.boosterDate) {
          const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          toast.success(`Vaccination saved! Next booster auto-scheduled for ${d}.`)
        } else {
          toast.success('Vaccination record saved')
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save vaccination')
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
        // Only advance stage to post_procedure if not a vaccination or surgery appointment
        // (those have an intermediate step 3)
        ...(!isVaccinationAppt && !isSurgeryAppt ? { stage: 'post_procedure' } : {}),
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
    if (!token || !vaccineTypeId || vaccineSaving) return
    if (!vaccineAgeValid) return // do not persist an ineligible vaccination
    
    // Only save if we haven't already created the vaccination, or if it's an update
    if (!vaccineCreated) {
      setVaccineSaving(true)
      try {
        const res = await createVaccination({
          petId,
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
          nextDueDate: vaccineNextDueDate || undefined,
          medicalRecordId: recordId,
          appointmentId: appointmentId || undefined,
          clinicId: clinicId || undefined,
          clinicBranchId: clinicBranchId || undefined,
        }, token)
        setVaccineCreated(true)
        setCreatedVaccineId(res._id)
        if (res.boosterDate) {
          const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          toast.success(`Vaccination saved! Next booster auto-scheduled for ${d}.`)
        }
      } catch (err) {
        console.error('Vaccination creation error:', err)
        // silent — don't block close/back on a vaccination save error
      } finally {
        setVaccineSaving(false)
      }
    } else if (createdVaccineId) {
      // Only update if already created
      setVaccineSaving(true)
      try {
        await updateVaccination(createdVaccineId, {
          vaccineTypeId,
          manufacturer: vaccineManufacturer || undefined,
          batchNumber: vaccineBatchNumber || undefined,
          route: (vaccineRoute as any) || undefined,
          dateAdministered: vaccineDateAdministered,
          notes: vaccineNotes || undefined,
          nextDueDate: vaccineNextDueDate || undefined,
        }, token)
      } catch (err) {
        console.error('Vaccination update error:', err)
        // silent — don't block close/back on a vaccination save error
      } finally {
        setVaccineSaving(false)
      }
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

  const handleProceedStep3Surgery = async () => {
    if (!token) return
    setSaving(true)
    try {
      const surgImageData = buildSurgeryImagesPayload()
      const selectedSurgery = surgeryServices.find((s) => s._id === surgeryTypeId)
      // Populate images state so they're included if completing later
      setImages(surgImageData)
      // Prefill visit summary with surgery name if not already set
      if (selectedSurgery && !visitSummary) {
        setVisitSummary(`Surgical procedure: ${selectedSurgery.name}`)
      }
      await updateMedicalRecord(recordId, {
        stage: 'post_procedure',
        ...(surgImageData.length > 0 ? { images: surgImageData } : {}),
        surgeryRecord: {
          surgeryType: selectedSurgery?.name || '',
          vetRemarks: surgeryVetRemarks,
        },
      }, token)
      setStep(4)
    } catch {
      toast.error('Failed to save surgery record')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteRecord = async () => {
    if (!token) return
    setCompleting(true)
    try {
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      
      // Ensure preventiveCare items have correct careType mapping
      const sanitizedPreventiveCare = preventiveCare.map((care) => ({
        careType: mapProductToCareType(care.product),
        product: care.product,
        dateAdministered: care.dateAdministered,
        nextDueDate: care.nextDueDate,
        notes: care.notes,
      }))
      
      await updateMedicalRecord(recordId, {
        stage: 'completed',
        visitSummary,
        medications,
        diagnosticTests,
        preventiveCare: sanitizedPreventiveCare,
        sharedWithOwner,
        images,
        confinementAction,
        confinementDays,
        ...(isSurgeryAppt ? {
          surgeryRecord: {
            surgeryType: surgeryServices.find((s) => s._id === surgeryTypeId)?.name || '',
            vetRemarks: surgeryVetRemarks,
          },
        } : {}),
      }, token)
      if (!alreadyCompleted && appointmentId) {
        await updateAppointmentStatus(appointmentId, 'completed', token)
      }
      await handleSaveNotes()
      setShowCompleteConfirm(false)
      toast.success('Visit completed!')
      onComplete()
    } catch {
      toast.error('Failed to complete visit')
    } finally {
      setCompleting(false)
    }
  }

  const handleCompleteClick = () => {
    setShowCompleteConfirm(true)
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
            onClick={async () => {
              if (step === 3 && isVaccinationAppt) await trySaveVaccination()
              if (isSurgeryAppt && token) {
                const selectedSurgery = surgeryServices.find((s) => s._id === surgeryTypeId)
                const xImgs = buildSurgeryImagesPayload()
                await updateMedicalRecord(recordId, {
                  ...(xImgs.length > 0 ? { images: xImgs } : {}),
                  surgeryRecord: { surgeryType: selectedSurgery?.name || '', vetRemarks: surgeryVetRemarks },
                }, token).catch(() => {})
              }
              onClose()
            }}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {((isVaccinationAppt || isSurgeryAppt) ? ([1, 2, 3, 4] as StepKey[]) : ([1, 2, 3] as StepKey[])).map((s, idx, arr) => {
              const labels = isVaccinationAppt ? VACC_STEP_LABELS : isSurgeryAppt ? SURG_STEP_LABELS : REG_STEP_LABELS as Record<StepKey, string>
              const icons = isVaccinationAppt ? VACC_STEP_ICONS : isSurgeryAppt ? SURG_STEP_ICONS : REG_STEP_ICONS as Record<StepKey, React.ReactNode>
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

                  {/* Expiry and Next Due */}
                  {vaccineTypeId && (() => {
                    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId)
                    if (!vt) return null
                    const base = new Date(vaccineDateAdministered)
                    const expiry = new Date(base); expiry.setDate(expiry.getDate() + (vt.validityDays || 0))
                    const nextDue = vt.requiresBooster && vt.boosterIntervalDays != null
                      ? (() => { const d = new Date(base); d.setDate(d.getDate() + (vt.boosterIntervalDays as number)); return d })()
                      : null
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#F4D3D2] border border-[#983232] rounded-xl p-3">
                            <p className="text-[10px] font-bold text-[#983232] uppercase tracking-wide">Expires</p>
                            <p className="font-bold text-[#983232] text-sm mt-0.5">{expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          {nextDue && (
                            <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-xl p-3">
                              <p className="text-[10px] font-bold text-[#4569B1] uppercase tracking-wide">Next Due</p>
                              <p className="font-bold text-[#4569B1] text-sm mt-0.5">
                                {vaccineNextDueDate 
                                  ? new Date(vaccineNextDueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                  : nextDue.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                }
                              </p>
                            </div>
                          )}
                        </div>
                        {vt.requiresBooster && (
                          <div>
                            <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Next Due Date (Optional)</label>
                            <div className="relative">
                              <input
                                type="date"
                                value={vaccineNextDueDate}
                                onChange={(e) => setVaccineNextDueDate(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                              />
                              {vaccineNextDueDate && (
                                <button
                                  type="button"
                                  onClick={() => setVaccineNextDueDate('')}
                                  className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            {!vaccineNextDueDate && nextDue && (
                              <p className="text-xs text-gray-500 mt-1">Default: {nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* Age eligibility validation */}
                  {vaccineTypeId && pet?.dateOfBirth && (
                    <div className={`flex items-start gap-3 p-3 rounded-xl ${
                      vaccineAgeValid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      {vaccineAgeValid ? (
                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          vaccineAgeValid ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {vaccineAgeError}
                        </p>
                      </div>
                    </div>
                  )}

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

          {/* ── STEP 3: SURGERY (surgery appointments only) ── */}
          {step === 3 && isSurgeryAppt && (
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

              {/* Surgery Details */}
              <div>
                <p className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">Surgery Details</p>

                <div className="space-y-4">
                  {/* Surgery Type */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                      Surgery Type <span className="text-red-500">*</span>
                    </label>
                    {surgeryServicesLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading surgery types…
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {surgeryTypeId ? (
                          <>
                            <div className="flex-1 p-3 bg-[#7FA5A3]/10 rounded-xl border border-[#7FA5A3]/30">
                              <p className="text-sm font-medium text-[#4F4F4F]">
                                {surgeryServices.find(s => s._id === surgeryTypeId)?.name}
                                {surgeryServices.find(s => s._id === surgeryTypeId)?.price && (
                                  <span className="text-gray-500 ml-2">— ₱{surgeryServices.find(s => s._id === surgeryTypeId)?.price}</span>
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSurgeryTypeId('')}
                              className="px-3 py-2.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
                              title="Clear selection"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <select
                            value={surgeryTypeId}
                            onChange={(e) => setSurgeryTypeId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                          >
                            <option value="">Select surgery type…</option>
                            {surgeryServices.map((s) => (
                              <option key={s._id} value={s._id}>{s.name}{s.price ? ` — ₱${s.price}` : ''}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Surgery Images */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-3">Surgery Images</label>
                    <div className="grid grid-cols-3 gap-4">
                      {surgeryImages.map((img) => (
                        <div key={img.type} className="flex flex-col gap-2">
                          <p className="text-xs font-medium text-gray-600 capitalize">{img.type} Surgery</p>
                          {img.preview ? (
                            <div className="relative rounded-xl overflow-hidden border-2 border-[#7FA5A3] bg-gray-50">
                              <img
                                src={img.preview}
                                alt={`${img.type} surgery`}
                                className="w-full h-28 object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setSurgeryImages((prev) =>
                                  prev.map((i) => i.type === img.type ? { type: img.type, file: null, preview: null } : i)
                                )}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="absolute bottom-1 left-1 bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Uploaded
                              </div>
                            </div>
                          ) : (
                            <label className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#7FA5A3] bg-gray-50 hover:bg-[#7FA5A3]/5 transition-colors flex flex-col items-center justify-center cursor-pointer gap-1.5">
                              <Upload className="w-5 h-5 text-gray-400" />
                              <span className="text-xs text-gray-500">Upload image</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    setSurgeryImages((prev) =>
                                      prev.map((i) => i.type === img.type
                                        ? { type: img.type, file, preview: reader.result as string }
                                        : i
                                      )
                                    )
                                  }
                                  reader.readAsDataURL(file)
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vet Remarks */}
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Vet Remarks</label>
                    <textarea
                      value={surgeryVetRemarks}
                      onChange={(e) => setSurgeryVetRemarks(e.target.value)}
                      rows={4}
                      placeholder="Observations, surgical findings, post-operative instructions…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 (regular) / STEP 4 (vaccination or surgery): POST-PROCEDURE ── */}
          {((step === 3 && !isVaccinationAppt && !isSurgeryAppt) || step === 4) && (
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
                    {preventiveCare.map((care, i) => {
                      const selectedService = preventiveCareServices.find((s) => s.name === care.product)
                      const base = care.dateAdministered ? new Date(care.dateAdministered) : null
                      const calculatedNextDue = base && selectedService?.intervalDays
                        ? (() => { const d = new Date(base); d.setDate(d.getDate() + (selectedService.intervalDays as number)); return d })()
                        : null
                      
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500">Preventive Care {i + 1}</span>
                            <button onClick={() => setPreventiveCare((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select 
                              value={care.product} 
                              onChange={(e) => {
                                const selected = preventiveCareServices.find((s) => s.name === e.target.value)
                                setPreventiveCare((prev) => prev.map((c, j) => 
                                  j === i 
                                    ? { 
                                        ...c, 
                                        product: e.target.value, 
                                        careType: mapProductToCareType(e.target.value),
                                        // Auto-calculate nextDueDate if dateAdministered is set and selected service has interval
                                        ...(c.dateAdministered && selected?.intervalDays 
                                          ? { nextDueDate: (() => {
                                              const d = new Date(c.dateAdministered)
                                              d.setDate(d.getDate() + (selected.intervalDays as number))
                                              return d.toISOString().split('T')[0]
                                            })() 
                                          }
                                          : {}
                                        )
                                      }
                                    : c
                                ))
                              }}
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            >
                              <option value="">Select a preventive care service</option>
                              {preventiveCareServices.map((service) => (
                                <option key={service._id} value={service.name}>
                                  {service.name} {service.price ? `(₱${service.price})` : ''}{service.intervalDays ? ` [${service.intervalDays}d]` : ''}
                                </option>
                              ))}
                            </select>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Date Administered</label>
                              <input 
                                type="date" 
                                value={care.dateAdministered || ''} 
                                onChange={(e) => {
                                  const dateValue = e.target.value
                                  const selected = preventiveCareServices.find((s) => s.name === care.product)
                                  setPreventiveCare((prev) => prev.map((c, j) => 
                                    j === i 
                                      ? { 
                                          ...c, 
                                          dateAdministered: dateValue || null,
                                          // Auto-calculate nextDueDate if dateAdministered is set and selected service has interval
                                          ...(dateValue && selected?.intervalDays 
                                            ? { nextDueDate: (() => {
                                                const d = new Date(dateValue)
                                                d.setDate(d.getDate() + (selected.intervalDays as number))
                                                return d.toISOString().split('T')[0]
                                              })() 
                                            }
                                            : {}
                                          )
                                        }
                                      : c
                                  ))
                                }}
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" 
                              />
                            </div>
                          </div>
                          
                          {/* Auto-calculated Next Due Date Display */}
                          {calculatedNextDue && (
                            <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-lg p-2">
                              <p className="text-[10px] font-bold text-[#4569B1] uppercase tracking-wide">Suggested Next Due Date</p>
                              <p className="font-semibold text-[#4569B1] text-xs mt-0.5">
                                {care.nextDueDate && care.nextDueDate !== calculatedNextDue.toISOString().split('T')[0]
                                  ? new Date(care.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : calculatedNextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                }
                              </p>
                            </div>
                          )}
                          
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Next Due Date (Optional - Override)</label>
                            <input 
                              type="date" 
                              value={care.nextDueDate || ''} 
                              onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, nextDueDate: e.target.value || null } : c))}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" 
                            />
                          </div>
                          <input 
                            type="text" 
                            placeholder="Notes (optional)" 
                            value={care.notes} 
                            onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, notes: e.target.value } : c))} 
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" 
                          />
                        </div>
                      )
                    })}
                    <button onClick={() => setPreventiveCare((prev) => [...prev, emptyPreventiveCare()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Image uploads */}
              <div>
                <label className="flex text-sm font-semibold text-[#4F4F4F] mb-2 items-center gap-2">
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

              {/* Care Plan */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setCarePlanOpen(!carePlanOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#7FA5A3]" />
                    Care Plan
                  </span>
                  {carePlanOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {carePlanOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {/* Confinement Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-xs font-semibold text-[#4F4F4F]">
                          {confined ? 'Release from Confinement' : 'Mark as Confined'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {confined ? 'Pet is confined' : 'Pet will be confined'}
                        </p>
                      </div>
                      <Switch
                        checked={confined}
                        onCheckedChange={setConfined}
                        className="data-checked:bg-amber-500"
                      />
                    </div>

                    {/* Discharge Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-xs font-semibold text-[#4F4F4F]">
                          {discharge ? 'Discharge Approved' : 'Discharge for At Home Care'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {discharge ? 'Pet approved for discharge' : 'Mark for at-home care'}
                        </p>
                      </div>
                      <Switch
                        checked={discharge}
                        onCheckedChange={setDischarge}
                        className="data-checked:bg-green-500"
                      />
                    </div>

                    {/* Referral Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-xs font-semibold text-[#4F4F4F]">
                          {referral ? 'Referral Required' : 'Referral to Another Vet'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {referral ? 'Specialist referral needed' : 'Refer to another veterinarian'}
                        </p>
                      </div>
                      <Switch
                        checked={referral}
                        onCheckedChange={setReferral}
                        className="data-checked:bg-blue-500"
                      />
                    </div>

                    {/* Surgery Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-xs font-semibold text-[#4F4F4F]">
                          {surgery ? 'Proceed to Surgery' : 'Schedule Surgery'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {surgery ? 'Surgery scheduled' : 'Schedule surgical procedure'}
                        </p>
                      </div>
                      <Switch
                        checked={surgery}
                        onCheckedChange={(checked) => {
                          setSurgery(checked)
                          if (checked) {
                            setShowSurgeryModal(true)
                          }
                        }}
                        className="data-checked:bg-red-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Share with owner */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Share with Owner</p>
                  <p className="text-xs text-gray-500">{sharedWithOwner ? 'Owner can view this record' : 'Record is private'}</p>
                </div>
                <Switch
                  checked={sharedWithOwner}
                  onCheckedChange={setSharedWithOwner}
                  className="data-checked:bg-[#476B6B]"
                />
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
                {isVaccinationAppt ? 'Proceed to Vaccination' : isSurgeryAppt ? 'Proceed to Surgery' : 'Proceed to Post-Procedure'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && isVaccinationAppt && (
              <button
                onClick={handleProceedStep3Vaccination}
                disabled={saving || !vaccineAgeValid || !vaccineTypeId}
                title={!vaccineAgeValid ? 'Pet age is outside the allowed range for this vaccine' : !vaccineTypeId ? 'Please select a vaccine type' : undefined}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Post-Procedure
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && isSurgeryAppt && (
              <button
                onClick={handleProceedStep3Surgery}
                disabled={saving || !surgeryTypeId}
                title={!surgeryTypeId ? 'Please select a surgery type' : undefined}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Post-Procedure
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {((step === 3 && !isVaccinationAppt && !isSurgeryAppt) || step === 4) && (
              <button
                onClick={handleCompleteClick}
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

      {/* Confirmation Dialog for Complete & Finish Visit */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Visit?</DialogTitle>
            <DialogDescription>
              Are you sure you want to complete this visit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowCompleteConfirm(false)}
              disabled={completing}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteRecord}
              disabled={completing}
              className="flex items-center gap-2 px-4 py-2 bg-[#35785C] text-white rounded-lg hover:bg-[#2a6049] transition-colors disabled:opacity-60 font-medium text-sm"
            >
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Continue
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== VET NOTEPAD PANEL (right, collapsible) ===== */}
      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${notesMinimized ? 'w-10' : 'w-88'}`}>
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

      {/* Surgery Appointment Modal */}
      <SurgeryAppointmentModal
        open={showSurgeryModal}
        onOpenChange={setShowSurgeryModal}
        petId={petId}
        petName={pet?.name || 'Pet'}
        clinicId={clinicId}
        clinicBranchId={clinicBranchId}
        vetId={vetId}
      />

      </div>
    </div>
  )
}
