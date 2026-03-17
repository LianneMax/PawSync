'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, updateMedicalRecord, emptyVitals, getDiagnosticTestServices, getMedicationServices, getPreventiveCareServices, getSurgeryServices, getHistoricalRecords, type ProductService, type MedicalRecord as MedicalRecordFull } from '@/lib/medicalRecords'
import { getMedicalHistory, type MedicalHistory } from '@/lib/medicalHistory'
import { getPetById, updatePetConfinement, updatePetPregnancyStatus } from '@/lib/pets'
import { updateAppointmentStatus } from '@/lib/appointments'
import { getVaccineTypes, getVaccinationsByPet, createVaccination, updateVaccination, type VaccineType, type Vaccination } from '@/lib/vaccinations'
import type { Medication, DiagnosticTest, PreventiveCare, Vitals } from '@/lib/medicalRecords'
import type { Pet } from '@/lib/pets'
import SurgeryAppointmentModal from './SurgeryAppointmentModal'
import { HistoricalMedicalRecord } from './HistoricalMedicalRecord'
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
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  History,
  RotateCcw,
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
import { syncBillingFromRecord } from '@/lib/billingSync'

interface Props {
  recordId: string
  appointmentId?: string
  petId: string
  appointmentTypes?: string[]
  appointmentDate?: string | null
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

const emptyDiagnosticTest = (): Omit<DiagnosticTest, '_id'> & { images?: { data: string; contentType: string; description: string }[] } => ({
  testType: 'other',
  name: '',
  date: null,
  result: '',
  normalRange: '',
  notes: '',
  images: [],
})

const emptyPreventiveCare = (): Omit<PreventiveCare, '_id'> => ({
  careType: 'other',
  product: '',
  dateAdministered: null,
  nextDueDate: null,
  notes: '',
})

interface VaccineFormItem {
  vaccineTypeId: string
  manufacturer: string
  batchNumber: string
  route: string
  dateAdministered: string
  notes: string
  nextDueDate: string
  doseNumber: number
  vaccineCreated: boolean
  createdVaccineId: string | null
}

const emptyVaccine = (): VaccineFormItem => ({
  vaccineTypeId: '',
  manufacturer: '',
  batchNumber: '',
  route: '',
  dateAdministered: new Date().toISOString().split('T')[0],
  notes: '',
  nextDueDate: '',
  doseNumber: 1,
  vaccineCreated: false,
  createdVaccineId: null,
})

function getIntervalForDose(
  vaccineType: { boosterIntervalDays: number | null; boosterIntervalDaysList?: number[] },
  doseNumber: number
): number | null {
  const list = vaccineType.boosterIntervalDaysList
  if (list && list.length > 0) {
    const interval = list[doseNumber - 1]
    if (interval != null) return interval
  }
  return vaccineType.boosterIntervalDays ?? null
}

// Map product names to careType enum values
// Handles: Deworming, Flea and Tick Prevention
const mapProductToCareType = (productName: string): 'flea' | 'tick' | 'heartworm' | 'deworming' | 'other' => {
  const productLower = productName.toLowerCase()
  if (productLower.includes('deworming')) return 'deworming'
  if (productLower.includes('flea') || productLower.includes('tick')) return 'flea' // "Flea and Tick Prevention" → 'flea'
  if (productLower.includes('heartworm')) return 'heartworm'
  return 'other'
}

const COMPLAINT_CATEGORIES = [
  { id: 'vomiting', label: 'Vomiting / GI', suggestedTests: ['Abdominal Ultrasound', 'Blood Chemistry'] },
  { id: 'respiratory', label: 'Respiratory', suggestedTests: ['Chest X-Ray'] },
  { id: 'skin', label: 'Skin / Coat', suggestedTests: ['Skin Scraping', 'Fungal Culture'] },
  { id: 'lethargy', label: 'Lethargy / Weakness', suggestedTests: ['CBC', 'Blood Chemistry', 'Urinalysis'] },
  { id: 'injury', label: 'Injury / Trauma', suggestedTests: ['X-Ray'] },
  { id: 'urinary', label: 'Urinary Issues', suggestedTests: ['Urinalysis', 'Abdominal Ultrasound'] },
  { id: 'eye-ear', label: 'Eye / Ear', suggestedTests: ['Ophthalmoscopy', 'Ear Cytology'] },
  { id: 'routine', label: 'Routine Check', suggestedTests: [] },
] as const

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

export default function MedicalRecordStagedModal({ recordId, appointmentId, petId, appointmentTypes = [], appointmentDate, onComplete, onClose }: Props) {
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
  
  // Billing sync
  const [billingId, setBillingId] = useState<string | null>(null)
  const [recordCreatedAt, setRecordCreatedAt] = useState<string>('')

  // Clinic and vet info for surgery appointment modal
  const [clinicId, setClinicId] = useState<string>('')
  const [clinicBranchId, setClinicBranchId] = useState<string>('')
  const [vetId, setVetId] = useState<string>('')

  // Vet notepad (pet-level)
  const [petNotesDraft, setPetNotesDraft] = useState('')
  const [petNotesSaving, setPetNotesSaving] = useState(false)
  const [petNotesSaved, setPetNotesSaved] = useState(false)
  const [notesMinimized, setNotesMinimized] = useState(false)

  // Historical medical record panel
  const [historyMinimized, setHistoryMinimized] = useState(true)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  // Previous visit data for system-driven context
  const [previousRecord, setPreviousRecord] = useState<MedicalRecordFull | null>(null)
  const [medHistoryData, setMedHistoryData] = useState<MedicalHistory | null>(null)
  const [complaintCategory, setComplaintCategory] = useState('')
  const [carryoverMeds, setCarryoverMeds] = useState<{ med: Omit<Medication, '_id'>; action: 'continue' | 'stop' }[]>([])
  const [carryoverApplied, setCarryoverApplied] = useState(false)
  const [prevContextOpen, setPrevContextOpen] = useState(true)

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

  // Vaccine form state (step 3 for vaccination appointments) — supports multiple vaccines per appointment
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])
  const [vaccines, setVaccines] = useState<VaccineFormItem[]>([emptyVaccine()])
  const [vaccineSaving, setVaccineSaving] = useState(false)
  const [allPetVaccinations, setAllPetVaccinations] = useState<Vaccination[]>([])

  // Step 1 fields
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())
  const [vitalsErrors, setVitalsErrors] = useState<Partial<Record<keyof Vitals, string>>>({})
  const [showRequiredErrors, setShowRequiredErrors] = useState(false)

  // Step 2 fields
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('') // maps to overallObservation
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [xray] = useState(false)
  const [ultrasound] = useState(false)
  const [availedProducts] = useState(false)

  // Pregnancy tracking (from ultrasound diagnostic)
  const [ultrasoundPregnant, setUltrasoundPregnant] = useState(false)
  const [gestationDate, setGestationDate] = useState('')
  const [expectedDueDate, setExpectedDueDate] = useState('')
  const [litterNumber, setLitterNumber] = useState('')

  // Pregnancy delivery
  const [pregnancyDelivery, setPregnancyDelivery] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryType, setDeliveryType] = useState<'natural' | 'c-section'>('natural')
  const [laborDuration, setLaborDuration] = useState('')
  const [liveBirths, setLiveBirths] = useState('')
  const [stillBirths, setStillBirths] = useState('')
  const [motherCondition, setMotherCondition] = useState<'stable' | 'critical' | 'recovering'>('stable')
  const [deliveryVetRemarks, setDeliveryVetRemarks] = useState('')

  // Step 3 fields
  const [visitSummary, setVisitSummary] = useState('')
  const [medications, setMedications] = useState<Omit<Medication, '_id'>[]>([])
  const [diagnosticTests, setDiagnosticTests] = useState<(Omit<DiagnosticTest, '_id'> & { images?: { data: string; contentType: string; description: string }[] })[]>([])
  const [preventiveCare, setPreventiveCare] = useState<Omit<PreventiveCare, '_id'>[]>([])
  const [preventiveCareManuallyEdited, setPreventiveCareManuallyEdited] = useState<Set<number>>(new Set())
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])

  // Collapsible sections in step 3
  const [medsOpen, setMedsOpen] = useState(true)
  const [testsOpen, setTestsOpen] = useState(true)
  const [preventiveOpen, setPreventiveOpen] = useState(true)

  const loadData = useCallback(async () => {
    if (!token) return
    const [recordRes, petRes, diagServicesRes, medServicesRes, prevCareServicesRes, histRes, medHistRes] = await Promise.all([
      getRecordById(recordId, token),
      getPetById(petId, token),
      getDiagnosticTestServices(token),
      getMedicationServices(token),
      getPreventiveCareServices(token),
      getHistoricalRecords(petId, token),
      getMedicalHistory(petId, token).catch(() => null),
    ])

    // Resolve previous (most recent completed) record and medical history
    let prevRecord: MedicalRecordFull | null = null
    if (histRes.status === 'SUCCESS' && histRes.data?.records && histRes.data.records.length > 0) {
      const sorted = [...histRes.data.records].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      prevRecord = sorted[0]
      setPreviousRecord(prevRecord)
    }
    if (medHistRes) {
      setMedHistoryData(medHistRes)
    }

    // Build carryover meds from previous record's active medications
    if (prevRecord?.medications && prevRecord.medications.length > 0) {
      const activePrevMeds = prevRecord.medications
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter((m) => m.status === 'active')
        .map(({ _id, ...rest }) => ({ med: rest as Omit<Medication, '_id'>, action: 'continue' as const }))
      if (activePrevMeds.length > 0) {
        setCarryoverMeds(activePrevMeds)
      }
    }
    if (recordRes.status === 'SUCCESS' && recordRes.data?.record) {
      const r = recordRes.data.record
      setChiefComplaint(r.chiefComplaint || '')
      const baseVitals = r.vitals || emptyVitals()
      // Auto-fill weight from pet registration if not yet recorded by vet
      const petWeight = petRes.status === 'SUCCESS' ? petRes.data?.pet?.weight : null
      if (!baseVitals.weight?.value && petWeight) {
        baseVitals.weight = { value: petWeight, notes: '' }
      }
      setVitals(baseVitals)
      setSubjective(r.subjective || r.chiefComplaint || '')
      setObjective(r.overallObservation || '')
      setAssessment(r.assessment || '')
      setPlan(r.plan || '')
      setVisitSummary(r.visitSummary || '')
      setReferral(r.referral ?? false)
      setDischarge(r.discharge ?? false)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setMedications((r.medications || []).map(({ _id, ...rest }: Omit<Medication, '_id'> & { _id?: string }) => rest))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setDiagnosticTests((r.diagnosticTests || []).map(({ _id, ...rest }: Omit<DiagnosticTest, '_id'> & { _id?: string } & { images?: any[] }) => ({
        ...rest,
        images: rest.images || [],
      })))
      if (r.pregnancyRecord) {
        setUltrasoundPregnant(r.pregnancyRecord.isPregnant)
        setGestationDate(r.pregnancyRecord.gestationDate ? r.pregnancyRecord.gestationDate.split('T')[0] : '')
        setExpectedDueDate(r.pregnancyRecord.expectedDueDate ? r.pregnancyRecord.expectedDueDate.split('T')[0] : '')
        setLitterNumber(r.pregnancyRecord.litterNumber != null ? String(r.pregnancyRecord.litterNumber) : '')
      }
      if (r.pregnancyDelivery) {
        setPregnancyDelivery(true)
        setDeliveryDate(r.pregnancyDelivery.deliveryDate ? r.pregnancyDelivery.deliveryDate.split('T')[0] : '')
        setDeliveryType(r.pregnancyDelivery.deliveryType || 'natural')
        setLaborDuration(r.pregnancyDelivery.laborDuration || '')
        setLiveBirths(r.pregnancyDelivery.liveBirths != null ? String(r.pregnancyDelivery.liveBirths) : '')
        setStillBirths(r.pregnancyDelivery.stillBirths != null ? String(r.pregnancyDelivery.stillBirths) : '')
        setMotherCondition(r.pregnancyDelivery.motherCondition || 'stable')
        setDeliveryVetRemarks(r.pregnancyDelivery.vetRemarks || '')
      }
      
      // Auto-populate preventive care only for preventive care appointment types
      const isPreventiveCareApptType = appointmentTypes.some((t) =>
        ['flea-tick-prevention', 'deworming', 'heartworm', 'preventive-care'].includes(t)
      )
      if ((!r.preventiveCare || r.preventiveCare.length === 0) && appointmentDate && isPreventiveCareApptType) {
        const addDays = (dateStr: string, days: number): string => {
          let normalized = dateStr
          if (dateStr.includes('T')) {
            normalized = dateStr.split('T')[0]
          }
          const [year, month, day] = normalized.split('-').map(Number)
          const date = new Date(year, month - 1, day)
          date.setDate(date.getDate() + days)
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          const d = String(date.getDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
        let normalizedDate = appointmentDate
        if (appointmentDate.includes('T')) {
          normalizedDate = appointmentDate.split('T')[0]
        }
        // Only auto-populate care items that are actually due (nextDueDate <= appointment date)
        const isItemDue = (careTypes: string[], intervalDays: number): boolean => {
          if (!prevRecord?.preventiveCare) return true
          const prev = prevRecord.preventiveCare.find((c) => careTypes.includes(c.careType))
          if (!prev?.nextDueDate) return true
          return new Date(prev.nextDueDate) <= new Date(normalizedDate)
        }
        const autoPop: typeof preventiveCare = []
        if (isItemDue(['deworming'], 90)) {
          autoPop.push({ careType: 'deworming', product: 'Deworming', dateAdministered: normalizedDate, nextDueDate: addDays(normalizedDate, 90), notes: '' })
        }
        if (isItemDue(['flea', 'tick'], 30)) {
          autoPop.push({ careType: 'flea', product: 'Flea & Tick Prevention', dateAdministered: normalizedDate, nextDueDate: addDays(normalizedDate, 30), notes: '' })
        }
        if (isItemDue(['heartworm'], 30)) {
          autoPop.push({ careType: 'heartworm', product: 'Heartworm Prevention', dateAdministered: normalizedDate, nextDueDate: addDays(normalizedDate, 30), notes: '' })
        }
        setPreventiveCare(autoPop)
      } else {
        // Normalize old 'Flea and Tick Prevention' to new 'Flea & Tick Prevention'
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const normalizedCare = (r.preventiveCare || []).map(({ _id, ...rest }: Omit<PreventiveCare, '_id'> & { _id?: string }) => ({
          ...rest,
          product: rest.product === 'Flea and Tick Prevention' ? 'Flea & Tick Prevention' : rest.product
        }))
        setPreventiveCare(normalizedCare)
      }
      setSharedWithOwner(r.sharedWithOwner || false)
      
      // Store billing id and record creation date for auto-sync
      if (r.billingId) {
        const bid = typeof r.billingId === 'object' ? (r.billingId as any)._id ?? String(r.billingId) : String(r.billingId)
        setBillingId(bid)
      }
      setRecordCreatedAt(r.createdAt)

      // Store clinic and vet info for surgery appointment modal
      if (r.clinicId?._id) setClinicId(r.clinicId._id)
      if (r.clinicBranchId?._id) setClinicBranchId(r.clinicBranchId._id)
      if (r.vetId?._id) setVetId(r.vetId._id)
      
      const stageToStep: Record<string, StepKey> = (isVaccinationAppt || isSurgeryAppt)
        ? { pre_procedure: 1, in_procedure: 2, post_procedure: 4, completed: 4 }
        : { pre_procedure: 1, in_procedure: 2, post_procedure: 3, completed: 3 }
      let currentStep = stageToStep[r.stage] || 1

      // Pre-fill vaccination rows from any existing vaccination records linked to this appointment.
      // Supports multiple vaccines — all matching records are loaded into the vaccines[] array.
      if (isVaccinationAppt && appointmentId && token) {
        try {
          const existingVaccinations: Vaccination[] = await getVaccinationsByPet(petId, token)
          setAllPetVaccinations(existingVaccinations)
          const matches = existingVaccinations.filter(
            (v) => v.appointmentId === appointmentId || (typeof v.appointmentId === 'string' && v.appointmentId === appointmentId)
          )
          if (matches.length > 0) {
            const matchIds = new Set(matches.map((m) => m._id))
            setVaccines(matches.map((match) => {
              const vtId = typeof match.vaccineTypeId === 'object' && match.vaccineTypeId !== null
                ? (match.vaccineTypeId as VaccineType)._id
                : (match.vaccineTypeId as string) || ''
              // Compute the correct next dose — ignore other records for this appointment
              const priorForType = existingVaccinations.filter((pv) => {
                if (matchIds.has(pv._id)) return false
                const pvVtId = typeof pv.vaccineTypeId === 'object' && pv.vaccineTypeId !== null
                  ? (pv.vaccineTypeId as VaccineType)._id
                  : (pv.vaccineTypeId as string)
                return pvVtId === vtId
              })
              const maxPriorDose = priorForType.length > 0
                ? Math.max(...priorForType.map((pv) => pv.doseNumber || 1))
                : 0
              const correctDose = Math.max(match.doseNumber || 1, maxPriorDose + 1)
              return {
                vaccineTypeId: vtId,
                manufacturer: match.manufacturer || '',
                batchNumber: match.batchNumber || '',
                route: match.route || '',
                dateAdministered: match.dateAdministered
                  ? match.dateAdministered.split('T')[0]
                  : new Date().toISOString().split('T')[0],
                notes: match.notes || '',
                nextDueDate: match.nextDueDate ? match.nextDueDate.split('T')[0] : '',
                doseNumber: correctDose,
                vaccineCreated: true,
                createdVaccineId: match._id,
              }
            }))
            // Only jump to step 3 if still mid-vaccination
            if (r.stage === 'in_procedure') currentStep = 3
          }
        } catch {
          // silent — fall back to step derived from stage
        }
      }

      setStep(currentStep)
      setAlreadyCompleted(r.stage === 'completed')
      if (isSurgeryAppt && r.surgeryRecord) {
        setSurgeryVetRemarks(r.surgeryRecord.vetRemarks || '')
      }
      if (isSurgeryAppt && r.images && r.images.length > 0) {
        setSurgeryImages((prev) =>
          prev.map((slot) => {
            const saved = r.images.find(
              (img) => img.description === `${slot.type} surgery image` && !!img.data
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
        const speciesMap: Record<string, string> = { canine: 'dog', feline: 'cat' }
        const apiSpecies = speciesMap[loadedPet.species] ?? loadedPet.species
        const vts = await getVaccineTypes(apiSpecies)
        const activeVts = vts.filter((vt) => vt.isActive)
        setVaccineTypes(activeVts)

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
  }, [recordId, petId, token, isVaccinationAppt, isSurgeryAppt, appointmentId, appointmentTypes, appointmentDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-populate preventive care when appointment date is set — only for preventive care appointments
  const isPreventiveCareAppt = appointmentTypes.some((t) =>
    ['flea-tick-prevention', 'deworming', 'heartworm', 'preventive-care'].includes(t)
  )

  useEffect(() => {
    // Only proceed if we have an appointment date AND it's a preventive care appointment
    if (!appointmentDate || !isPreventiveCareAppt) {
      return
    }

    // Check if record already has preventive care saved
    if (preventiveCare.length > 0) {
      return // Already has data (either saved or already auto-populated)
    }

    // Helper to calculate next due date
    const addDays = (dateStr: string, days: number): string => {
      let normalized = dateStr
      if (dateStr.includes('T')) {
        normalized = dateStr.split('T')[0]
      }
      
      const [year, month, day] = normalized.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + days)
      
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    // Normalize appointment date
    let normalizedDate = appointmentDate
    if (appointmentDate.includes('T')) {
      normalizedDate = appointmentDate.split('T')[0]
    }

    // Always add all preventive care services (Deworming, Flea & Tick Prevention, Heartworm Prevention)
    const autoPop: typeof preventiveCare = [
      {
        careType: 'deworming',
        product: 'Deworming',
        dateAdministered: normalizedDate,
        nextDueDate: addDays(normalizedDate, 90),
        notes: ''
      },
      {
        careType: 'flea',
        product: 'Flea & Tick Prevention',
        dateAdministered: normalizedDate,
        nextDueDate: addDays(normalizedDate, 30),
        notes: ''
      },
      {
        careType: 'heartworm',
        product: 'Heartworm Prevention',
        dateAdministered: normalizedDate,
        nextDueDate: addDays(normalizedDate, 30),
        notes: ''
      }
    ]

    setPreventiveCare(autoPop)
    setPreventiveCareManuallyEdited(new Set()) // Reset manual edits on auto-populate
  }, [appointmentDate, isPreventiveCareAppt, preventiveCare.length])

  // Convert surgery images state into the base64 payload for updateMedicalRecord
  const buildSurgeryImagesPayload = () =>
    surgeryImages
      .filter((img) => img.preview !== null)
      .map((img) => ({
        data: img.preview!.split(',')[1] ?? img.preview!,
        contentType: img.file?.type || 'image/jpeg',
        description: `${img.type} surgery image`,
      }))

  const buildDiagnosticTestImages = () => {
    const diagImages: { data: string; contentType: string; description: string }[] = []
    diagnosticTests.forEach((test, idx) => {
      if (test.images && test.images.length > 0) {
        test.images.forEach((img, imgIdx) => {
          diagImages.push({
            data: img.data,
            contentType: img.contentType,
            description: `${test.name ? test.name : 'Diagnostic Test'} #${idx + 1} - ${img.description || `Image ${imgIdx + 1}`}`,
          })
        })
      }
    })
    return diagImages
  }

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

  // Build a one-paragraph draft visit summary from existing form data
  const buildDraftSummary = (): string => {
    const parts: string[] = []
    if (chiefComplaint) parts.push(`Chief complaint: ${chiefComplaint}.`)
    if (assessment) parts.push(`Assessment: ${assessment}.`)
    if (medications.length > 0) {
      const names = medications
        .filter((m) => m.name)
        .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`)
        .join('; ')
      if (names) parts.push(`Medications prescribed: ${names}.`)
    }
    if (preventiveCare.length > 0) {
      const care = preventiveCare.filter((c) => c.product).map((c) => c.product).join(', ')
      if (care) parts.push(`Preventive care administered: ${care}.`)
    }
    if (plan) parts.push(`Plan: ${plan}.`)
    return parts.join(' ')
  }

  const handleSaveAndClose = async () => {
    if (!token) return
    setSaving(true)
    try {
      if (step === 3 && isVaccinationAppt) await trySaveVaccinations()
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      const surgImgs = isSurgeryAppt ? buildSurgeryImagesPayload() : undefined
      const diagImgs = buildDiagnosticTestImages()
      const selectedSurgery = isSurgeryAppt ? surgeryServices.find((s) => s._id === surgeryTypeId) : undefined
      
      // Combine all images: diagnostic test images + general images
      const allImages = [...diagImgs, ...images]
      
      // Remove images from diagnostic tests before sending to API
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      
      await updateMedicalRecord(recordId, {
        chiefComplaint,
        vitals,
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        visitSummary,
        medications,
        diagnosticTests: diagnosticTestsToSend,
        preventiveCare,
        sharedWithOwner,
        confinementAction,
        confinementDays,
        referral,
        discharge,
        scheduledSurgery: surgery,
        ...(allImages.length > 0 ? { images: allImages } : {}),
        ...buildPregnancyPayload(),
        ...(isSurgeryAppt ? {
          ...(surgImgs && surgImgs.length > 0 ? { images: surgImgs } : {}),
          surgeryRecord: {
            surgeryType: selectedSurgery?.name || '',
            vetRemarks: surgeryVetRemarks,
            images: surgImgs,
          },
        } : {}),
      }, token)
      if (billingId && recordCreatedAt) {
        syncBillingFromRecord({ billingId, petId, medications, diagnosticTests: diagnosticTestsToSend, preventiveCare, recordCreatedAt, token, recordVaccinations: vaccines.filter(v => v.vaccineCreated && v.vaccineTypeId).map(v => ({ vaccineTypeId: v.vaccineTypeId, vaccineName: vaccineTypes.find(vt => vt._id === v.vaccineTypeId)?.name || '', _id: v.createdVaccineId })) }).catch(() => {})
      }
      await handleSaveNotes()
      setHistoryRefresh(prev => prev + 1)
      toast.success('Progress saved')
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const REQUIRED_VITAL_KEYS = ['weight', 'temperature', 'pulseRate', 'spo2', 'bodyConditionScore', 'dentalScore', 'crt'] as const

  const handleProceedStep1 = async () => {
    if (!token) return
    // Check all required fields are filled
    const hasVitalsErrors = Object.values(vitalsErrors).some((e) => !!e)
    const missingVitals = REQUIRED_VITAL_KEYS.some((k) => !vitals[k]?.value && vitals[k]?.value !== 0)
    const missingComplaint = !chiefComplaint.trim()
    if (hasVitalsErrors || missingVitals || missingComplaint) {
      setShowRequiredErrors(true)
      toast.error('Please fill in all required fields before proceeding')
      return
    }
    setShowRequiredErrors(false)

    // SOAP template pre-fill — only populate empty fields
    const petName = pet?.name || 'the patient'
    if (!subjective) {
      if (isVaccinationAppt) {
        setSubjective(chiefComplaint || `Owner presents ${petName} for scheduled vaccination. No acute concerns reported.`)
      } else if (isSurgeryAppt) {
        setSubjective(chiefComplaint || `Owner presents ${petName} for scheduled surgical procedure.`)
      } else if (isPreventiveCareAppt) {
        setSubjective(chiefComplaint || `Owner presents ${petName} for routine preventive care.`)
      } else {
        setSubjective(chiefComplaint)
      }
    }
    if (!assessment) {
      if (isVaccinationAppt) {
        setAssessment(`${petName} presented for scheduled vaccination. Vitals within acceptable limits. No contraindications observed.`)
      } else if (isPreventiveCareAppt) {
        setAssessment(`${petName} in good health. Preventive care administered without complications.`)
      } else if (previousRecord?.assessment) {
        setAssessment(`Follow-up. Previous: ${previousRecord.assessment}`)
      }
    }
    if (!plan) {
      if (isVaccinationAppt) {
        setPlan(`Vaccinations administered today. Owner advised to monitor for 15–30 minutes post-vaccination for adverse reactions (facial swelling, lethargy, vomiting). Return immediately if reaction occurs. Next booster scheduled per vaccine protocol.`)
      } else if (isSurgeryAppt) {
        setPlan(`Pre-surgical assessment completed. Owner consented to procedure. Post-operative care instructions to be provided at discharge.`)
      } else if (isPreventiveCareAppt) {
        setPlan(`Preventive care administered as scheduled. Owner reminded of next due dates. Continue as advised.`)
      } else if (previousRecord?.plan) {
        setPlan(`Previous plan: ${previousRecord.plan}\n\nCurrent plan: `)
      }
    }

    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        stage: 'in_procedure',
        chiefComplaint,
        vitals,
      }, token)
      setHistoryRefresh(prev => prev + 1)
      setStep(2)
    } catch {
      toast.error('Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  const buildPregnancyPayload = () => {
    const hasUltrasound = diagnosticTests.some(
      (t) => t.testType === 'ultrasound' || t.name.toLowerCase().includes('ultrasound')
    )
    return {
      ...(hasUltrasound ? {
        pregnancyRecord: {
          isPregnant: ultrasoundPregnant,
          gestationDate: ultrasoundPregnant && gestationDate ? gestationDate : null,
          expectedDueDate: ultrasoundPregnant && expectedDueDate ? expectedDueDate : null,
          litterNumber: ultrasoundPregnant && litterNumber ? parseInt(litterNumber) : null,
        },
      } : {}),
      ...(pregnancyDelivery ? {
        pregnancyDelivery: {
          deliveryDate: deliveryDate || null,
          deliveryType,
          laborDuration,
          liveBirths: parseInt(liveBirths) || 0,
          stillBirths: parseInt(stillBirths) || 0,
          motherCondition,
          vetRemarks: deliveryVetRemarks,
        },
      } : {}),
    }
  }

  const syncPregnancyStatus = async () => {
    const hasUltrasoundTest = diagnosticTests.some(
      (t) => t.testType === 'ultrasound' || t.name.toLowerCase().includes('ultrasound')
    )
    if (pregnancyDelivery) {
      await updatePetPregnancyStatus(petId, 'not_pregnant', token!)
    } else if (hasUltrasoundTest && ultrasoundPregnant) {
      await updatePetPregnancyStatus(petId, 'pregnant', token!)
    }
  }

  const handleProceedStep2 = async () => {
    if (!token) return
    
    // Validate SOAP notes are filled
    if (!subjective.trim() || !objective.trim() || !assessment.trim() || !plan.trim()) {
      toast.error('Please fill in all SOAP notes (Subjective, Objective, Assessment, Plan) before proceeding')
      return
    }
    
    setSaving(true)
    try {
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      const diagImgs = buildDiagnosticTestImages()
      const allImages = [...diagImgs, ...images]
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      
      await updateMedicalRecord(recordId, {
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        diagnosticTests: diagnosticTestsToSend,
        confinementAction,
        confinementDays,
        referral,
        discharge,
        scheduledSurgery: surgery,
        ...(allImages.length > 0 ? { images: allImages } : {}),
        ...buildPregnancyPayload(),
        // Only advance stage to post_procedure if not a vaccination or surgery appointment
        // (those have an intermediate step 3)
        ...(!isVaccinationAppt && !isSurgeryAppt ? { stage: 'post_procedure' } : {}),
      }, token)
      await syncPregnancyStatus()
      await handleSaveNotes()
      setHistoryRefresh(prev => prev + 1)
      setStep(isVaccinationAppt ? 3 : 3)
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  // Silently save all vaccination rows — used by Save & Close, X, Back, Proceed, and Complete.
  // Runs sequentially (not Promise.all) so booster appointments don't race for the same time slot.
  const trySaveVaccinations = async () => {
    if (!token || vaccineSaving) return
    setVaccineSaving(true)
    try {
      const updated: VaccineFormItem[] = []
      for (const v of vaccines) {
        if (!v.vaccineTypeId) { updated.push(v); continue }
        // Skip ineligible vaccines
        const vt = vaccineTypes.find((x) => x._id === v.vaccineTypeId)
        if (vt && pet?.dateOfBirth) {
          const validation = validateVaccineAge(pet.dateOfBirth, vt.minAgeMonths || 0, vt.maxAgeMonths || null)
          if (!validation.isValid) { updated.push(v); continue }
        }
        if (!v.vaccineCreated) {
          try {
            const res = await createVaccination({
              petId,
              vaccineTypeId: v.vaccineTypeId,
              manufacturer: v.manufacturer || undefined,
              batchNumber: v.batchNumber || undefined,
              route: v.route || undefined,
              dateAdministered: v.dateAdministered,
              notes: v.notes || undefined,
              nextDueDate: v.nextDueDate || undefined,
              medicalRecordId: recordId,
              appointmentId: appointmentId || undefined,
              clinicId: clinicId || undefined,
              clinicBranchId: clinicBranchId || undefined,
              doseNumber: v.doseNumber,
            }, token)
            if (res.boosterDate) {
              const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              toast.success(`${vt?.name || 'Vaccination'} saved! Next booster auto-scheduled for ${d}.`)
            }
            updated.push({ ...v, vaccineCreated: true, createdVaccineId: res._id })
          } catch (err) {
            console.error('Vaccination creation error:', err)
            updated.push(v)
          }
        } else if (v.createdVaccineId) {
          try {
            await updateVaccination(v.createdVaccineId, {
              vaccineTypeId: v.vaccineTypeId,
              manufacturer: v.manufacturer || undefined,
              batchNumber: v.batchNumber || undefined,
              route: v.route || undefined,
              dateAdministered: v.dateAdministered,
              notes: v.notes || undefined,
              nextDueDate: v.nextDueDate || undefined,
            }, token)
          } catch (err) {
            console.error('Vaccination update error:', err)
          }
          updated.push(v)
        } else {
          updated.push(v)
        }
      }
      setVaccines(updated)
    } finally {
      setVaccineSaving(false)
    }
  }

  const handleProceedStep3Vaccination = async () => {
    if (!token) return
    setSaving(true)
    try {
      await trySaveVaccinations()
      await updateMedicalRecord(recordId, { stage: 'post_procedure' }, token)
      setHistoryRefresh(prev => prev + 1)
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
      setHistoryRefresh(prev => prev + 1)
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
      // Ensure vaccination is saved (with nextDueDate) before completing so the booster gets scheduled
      if (isVaccinationAppt) await trySaveVaccinations()

      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      
      // Ensure preventiveCare items have correct careType mapping
      const sanitizedPreventiveCare = preventiveCare.map((care) => ({
        careType: mapProductToCareType(care.product),
        product: care.product,
        dateAdministered: care.dateAdministered,
        nextDueDate: care.nextDueDate,
        notes: care.notes,
      }))
      
      // Extract diagnostic test images and combine with general images
      const diagImgs = buildDiagnosticTestImages()
      const allImages = [...diagImgs, ...images]
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      
      await updateMedicalRecord(recordId, {
        stage: 'completed',
        visitSummary,
        medications,
        diagnosticTests: diagnosticTestsToSend,
        preventiveCare: sanitizedPreventiveCare,
        sharedWithOwner,
        ...(allImages.length > 0 ? { images: allImages } : {}),
        confinementAction,
        confinementDays,
        referral,
        discharge,
        scheduledSurgery: surgery,
        ...buildPregnancyPayload(),
        ...(isSurgeryAppt ? {
          surgeryRecord: {
            surgeryType: surgeryServices.find((s) => s._id === surgeryTypeId)?.name || '',
            vetRemarks: surgeryVetRemarks,
          },
        } : {}),
      }, token)
      if (billingId && recordCreatedAt) {
        syncBillingFromRecord({ billingId, petId, medications, diagnosticTests: diagnosticTestsToSend, preventiveCare: sanitizedPreventiveCare, recordCreatedAt, token, recordVaccinations: vaccines.filter(v => v.vaccineCreated && v.vaccineTypeId).map(v => ({ vaccineTypeId: v.vaccineTypeId, vaccineName: vaccineTypes.find(vt => vt._id === v.vaccineTypeId)?.name || '', _id: v.createdVaccineId })) }).catch(() => {})
      }
      await syncPregnancyStatus()
      if (!alreadyCompleted && appointmentId) {
        await updateAppointmentStatus(appointmentId, 'completed', token)
      }
      await handleSaveNotes()
      setHistoryRefresh(prev => prev + 1)
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

  const handleDiagnosticTestImageUpload = (testIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        setDiagnosticTests((prev) => {
          const updated = [...prev]
          if (!updated[testIndex].images) {
            updated[testIndex].images = []
          }
          // Check if image already exists to prevent duplicates
          const isDuplicate = updated[testIndex].images!.some((img) => img.description === file.name && img.data === base64)
          if (!isDuplicate) {
            updated[testIndex].images!.push({ data: base64, contentType: file.type, description: file.name })
          }
          return updated
        })
      }
      reader.readAsDataURL(file)
    })
    // Clear the input so the same file can be uploaded again if needed
    e.target.value = ''
  }

  const updateVital = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => {
      const updated = { ...prev, [key]: { ...prev[key], [field]: val } }
      if (showRequiredErrors && field === 'value') {
        const allFilled = REQUIRED_VITAL_KEYS.every((k) => !!updated[k]?.value || updated[k]?.value === 0)
        if (allFilled && chiefComplaint.trim()) setShowRequiredErrors(false)
      }
      return updated
    })
    if (field === 'value') {
      const num = Number(val)
      const isEmpty = val === ''
      let error = ''
      if (key === 'bodyConditionScore') {
        if (!isEmpty && (isNaN(num) || num < 1 || num > 5 || !Number.isInteger(num)))
          error = 'Must be a whole number between 1 and 5'
      } else if (key === 'dentalScore') {
        if (!isEmpty && (isNaN(num) || num < 1 || num > 3 || !Number.isInteger(num)))
          error = 'Must be a whole number between 1 and 3'
      } else if (key === 'spo2') {
        if (!isEmpty && (isNaN(num) || num < 0 || num > 100))
          error = 'Must be between 0 and 100'
      } else if (['weight', 'temperature', 'pulseRate', 'crt'].includes(key)) {
        if (!isEmpty && (isNaN(num) || num < 0))
          error = 'Must be a valid number'
      }
      setVitalsErrors((prev) => ({ ...prev, [key]: error }))
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
              if (step === 3 && isVaccinationAppt) await trySaveVaccinations()
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
                      <p className="text-gray-400 text-xs mb-0.5">Color</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.color || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Date of Birth</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.dateOfBirth ? new Date(pet.dateOfBirth).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Age</p>
                      <p className="font-medium text-[#4F4F4F]">{calcAge(pet.dateOfBirth)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Sex</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.sex}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Sterilization</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.sterilization || '-'}</p>
                    </div>
                    {pet.nfcTagId && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Pet Tag ID</p>
                        <p className="font-medium text-[#4F4F4F] text-xs">{pet.nfcTagId}</p>
                      </div>
                    )}
                    {pet.microchipNumber && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Microchip</p>
                        <p className="font-medium text-[#4F4F4F] text-xs">{pet.microchipNumber}</p>
                      </div>
                    )}
                    {pet.sex === 'female' && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Pregnancy</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          pet.pregnancyStatus === 'pregnant'
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {pet.pregnancyStatus === 'pregnant' ? 'Pregnant' : 'Not Pregnant'}
                        </span>
                      </div>
                    )}
                  </div>
                  {pet.allergies && pet.allergies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#7FA5A3]/20">
                      <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
                        Allergies
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {pet.allergies.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confinement alert */}
              {pet?.isConfined && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
                  <Lock className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">This pet is currently confined</p>
                    <p className="text-xs text-blue-600">
                      {(() => {
                        if (!pet.confinedSince) return 'Release the pet from confinement in the Post-Procedure step.'
                        const days = Math.max(1, Math.ceil((Date.now() - new Date(pet.confinedSince).getTime()) / 86400000))
                        return `Confined for ${days} day${days !== 1 ? 's' : ''}. Release from confinement in the Post-Procedure step.`
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* ── LAST VISIT CONTEXT STRIP ── */}
              {previousRecord && (
                <div className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/40">
                  <button
                    type="button"
                    onClick={() => setPrevContextOpen((p) => !p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Last Visit — {new Date(previousRecord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {previousRecord.chiefComplaint && (
                        <span className="font-normal text-amber-700 ml-1 truncate max-w-xs">· {previousRecord.chiefComplaint}</span>
                      )}
                    </span>
                    {prevContextOpen ? <ChevronUp className="w-3.5 h-3.5 text-amber-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                  </button>
                  {prevContextOpen && (
                    <div className="px-4 pb-3 space-y-2.5 border-t border-amber-100">
                      {previousRecord.plan && (
                        <div className="mt-2.5">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <ClipboardList className="w-3 h-3" /> Previous Plan
                          </p>
                          <p className="text-xs text-amber-900 bg-white border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">{previousRecord.plan}</p>
                        </div>
                      )}
                      {carryoverMeds.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <Pill className="w-3 h-3" /> Active Medications from Last Visit
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {carryoverMeds.map((item, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white border border-amber-200 rounded-full text-[11px] text-amber-800 font-medium">
                                {item.med.name} · {item.med.dosage}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-amber-600 mt-1.5">Review and reconcile these on the Post-Procedure step.</p>
                        </div>
                      )}
                      {!previousRecord.plan && carryoverMeds.length === 0 && (
                        <p className="text-xs text-amber-700 mt-2">No previous plan or active medications on record.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Chief complaint */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">
                  Chief Complaint / Reason for Visit <span className="text-[#900B09]">*</span>
                </label>

                {/* Complaint category chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMPLAINT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setComplaintCategory(complaintCategory === cat.id ? '' : cat.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        complaintCategory === cat.id
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={chiefComplaint}
                  onChange={(e) => { setChiefComplaint(e.target.value); if (showRequiredErrors && e.target.value.trim()) setShowRequiredErrors(false) }}
                  rows={3}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none ${showRequiredErrors && !chiefComplaint.trim() ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                  placeholder="Describe the owner's complaint and reason for today's visit…"
                />
                {showRequiredErrors && !chiefComplaint.trim() && (
                  <p className="text-xs text-[#900B09] mt-1">Chief complaint is required</p>
                )}
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
                      { key: 'weight' as const, label: 'Weight', unit: 'kg', min: 0, max: undefined, step: 'any' },
                      { key: 'temperature' as const, label: 'Temperature', unit: '°C', min: 0, max: undefined, step: 'any' },
                      { key: 'pulseRate' as const, label: 'Pulse Rate', unit: 'bpm', min: 0, max: undefined, step: 1 },
                      { key: 'spo2' as const, label: 'SpO₂', unit: '%', min: 0, max: 100, step: 'any' },
                      { key: 'bodyConditionScore' as const, label: 'Body Condition Score', unit: '1–5', min: 1, max: 5, step: 1 },
                      { key: 'dentalScore' as const, label: 'Dental Score', unit: '1–3', min: 1, max: 3, step: 1 },
                      { key: 'crt' as const, label: 'CRT', unit: 'sec', min: 0, max: undefined, step: 'any' },
                    ] as const).map(({ key, label, unit, min, max, step }) => {
                      const prevVal = previousRecord?.vitals?.[key]?.value
                      const prevNum = prevVal != null && prevVal !== '' ? Number(prevVal) : null
                      const currNum = vitals[key]?.value != null && vitals[key].value !== '' ? Number(vitals[key].value) : null
                      const pct = prevNum != null && currNum != null && prevNum !== 0
                        ? ((currNum - prevNum) / prevNum) * 100
                        : null
                      const trend = pct != null ? (Math.abs(pct) < 5 ? 'stable' : pct > 0 ? 'up' : 'down') : null
                      return (
                        <div key={key} className="grid grid-cols-2 gap-2 pt-3 first:pt-0 border-t border-gray-50 first:border-0">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">{label} <span className="text-gray-300">({unit})</span> <span className="text-[#900B09]">*</span></label>
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step={step}
                              value={String(vitals[key]?.value ?? '')}
                              onChange={(e) => updateVital(key, 'value', e.target.value)}
                              className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${vitalsErrors[key] ? 'border-[#900B09] focus:ring-[#900B09]' : showRequiredErrors && !vitals[key]?.value && vitals[key]?.value !== 0 ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                              placeholder={unit}
                            />
                            {prevNum != null && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {trend === 'up' && <TrendingUp className="w-3 h-3 text-amber-500 shrink-0" />}
                                {trend === 'down' && <TrendingDown className="w-3 h-3 text-blue-400 shrink-0" />}
                                {trend === 'stable' && <Minus className="w-3 h-3 text-gray-400 shrink-0" />}
                                <span className="text-[10px] text-gray-400">
                                  Prev: {prevNum} {unit}
                                  {pct != null && Math.abs(pct) >= 5 && (
                                    <span className={trend === 'up' ? 'text-amber-500 ml-1' : 'text-blue-400 ml-1'}>
                                      ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Notes <span className="text-gray-300">(optional)</span></label>
                            <input
                              type="text"
                              value={vitals[key]?.notes ?? ''}
                              onChange={(e) => updateVital(key, 'notes', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                              placeholder="Optional"
                            />
                          </div>
                          {vitalsErrors[key] ? (
                            <p className="col-span-2 text-xs text-[#900B09] -mt-1">{vitalsErrors[key]}</p>
                          ) : showRequiredErrors && !vitals[key]?.value && vitals[key]?.value !== 0 ? (
                            <p className="col-span-2 text-xs text-[#900B09] -mt-1">This field is required</p>
                          ) : null}
                        </div>
                      )
                    })}
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
                      S — Subjective <span className="text-[#900B09]">*</span> <span className="font-normal text-gray-400">(Patient history / owner complaint)</span>
                    </label>
                    <textarea
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      rows={2}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${!subjective.trim() && showRequiredErrors ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                      placeholder="Owner's description, patient history, presenting complaint…"
                    />
                    {!subjective.trim() && showRequiredErrors && (
                      <p className="text-xs text-[#900B09] mt-1">Subjective notes are required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      O — Objective <span className="text-[#900B09]">*</span> <span className="font-normal text-gray-400">(Physical examination findings)</span>
                    </label>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={3}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${!objective.trim() && showRequiredErrors ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                      placeholder="Physical exam findings, measurable observations, test results…"
                    />
                    {!objective.trim() && showRequiredErrors && (
                      <p className="text-xs text-[#900B09] mt-1">Objective notes are required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      A — Assessment <span className="text-[#900B09]">*</span> <span className="font-normal text-gray-400">(Diagnosis / differential diagnosis)</span>
                    </label>
                    <textarea
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      rows={2}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${!assessment.trim() && showRequiredErrors ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                      placeholder="Clinical diagnosis, differential diagnoses, clinical impression…"
                    />
                    {!assessment.trim() && showRequiredErrors && (
                      <p className="text-xs text-[#900B09] mt-1">Assessment notes are required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      P — Plan <span className="text-[#900B09]">*</span> <span className="font-normal text-gray-400">(Treatment plan / next steps)</span>
                    </label>
                    <textarea
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      rows={2}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${!plan.trim() && showRequiredErrors ? 'border-[#900B09] focus:ring-[#900B09]' : 'border-gray-200 focus:ring-[#7FA5A3]'}`}
                      placeholder="Treatment plan, follow-up instructions, referrals…"
                    />
                    {!plan.trim() && showRequiredErrors && (
                      <p className="text-xs text-[#900B09] mt-1">Plan notes are required</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Diagnostic test suggestions from complaint category */}
              {(() => {
                const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaintCategory)
                const suggestions = cat?.suggestedTests ?? []
                const alreadyAdded = new Set(diagnosticTests.map((t) => t.name))
                const available = suggestions.filter((s) => !alreadyAdded.has(s))
                if (!cat || available.length === 0) return null
                return (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-[#f0f7f7] border border-[#7FA5A3]/30 rounded-xl">
                    <Sparkles className="w-3.5 h-3.5 text-[#476B6B] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#476B6B] uppercase tracking-wide mb-1.5">
                        Suggested tests for &quot;{cat.label}&quot;
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {available.map((test) => (
                          <button
                            key={test}
                            type="button"
                            onClick={() => {
                              const isUltrasound = test.toLowerCase().includes('ultrasound')
                              setDiagnosticTests((prev) => [
                                ...prev,
                                { testType: isUltrasound ? 'ultrasound' : 'other', name: test, date: null, result: '', normalRange: '', notes: '', images: [] },
                              ])
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#7FA5A3]/40 rounded-full text-[11px] text-[#476B6B] font-medium hover:bg-[#476B6B] hover:text-white transition-colors"
                          >
                            <Plus className="w-3 h-3" /> {test}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

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
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Test {i + 1}</span>
                          <button onClick={() => setDiagnosticTests((prev) => prev.filter((_, j) => j !== i))} className="text-[#900B09] hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <select value={test.name} onChange={(e) => {
                            const name = e.target.value
                            const isUltrasound = name.toLowerCase().includes('ultrasound')
                            setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, name, testType: isUltrasound ? 'ultrasound' : 'other' } : t))
                          }} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="">Select a diagnostic test service</option>
                            {diagnosticTestServices.map((service) => (
                              <option key={service._id} value={service.name}>{service.name} {service.price ? `(₱${service.price})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <textarea rows={2} placeholder="Result" value={test.result} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, result: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] resize-none" />
                        <input type="text" placeholder="Notes (optional)" value={test.notes} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, notes: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                        
                        {/* Image Upload for Diagnostic Test */}
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <label className="flex text-xs font-semibold text-gray-600 mb-2 items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#7FA5A3]" />
                            Test Images
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#7FA5A3] transition-colors w-fit bg-white">
                            <Upload className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">Upload images</span>
                            <input type="file" accept="image/*" multiple onChange={(e) => handleDiagnosticTestImageUpload(i, e)} className="hidden" />
                          </label>
                          {test.images && test.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {test.images.map((img, imgIdx) => (
                                <div key={imgIdx} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                                  <span className="text-xs text-blue-700">{img.description}</span>
                                  <button onClick={() => setDiagnosticTests((prev) => {
                                    const updated = [...prev]
                                    updated[i].images = updated[i].images!.filter((_, j) => j !== imgIdx)
                                    return updated
                                  })} className="text-blue-400 hover:text-red-500">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setDiagnosticTests((prev) => [...prev, emptyDiagnosticTest()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Test
                    </button>
                  </div>
                )}
              </div>

              {/* ── ULTRASOUND PREGNANCY RESULT ── */}
              {pet?.sex === 'female' && diagnosticTests.some((t) => t.testType === 'ultrasound' || t.name.toLowerCase().includes('ultrasound')) && (
                <div className="border border-green-100 rounded-2xl overflow-hidden bg-green-50/30">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-green-100">
                    <span className="text-sm font-semibold text-green-700">Ultrasound — Pregnancy Result</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ultrasoundPregnant}
                        onChange={(e) => setUltrasoundPregnant(e.target.checked)}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className="text-sm text-gray-700 font-medium">Pet is Pregnant</span>
                    </label>
                    {ultrasoundPregnant && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Gestation Date</label>
                          <input
                            type="date"
                            value={gestationDate}
                            onChange={(e) => {
                              setGestationDate(e.target.value)
                              if (e.target.value) {
                                const date = new Date(e.target.value)
                                date.setDate(date.getDate() + 63)
                                setExpectedDueDate(date.toISOString().split('T')[0])
                              }
                            }}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expected Due Date</label>
                          <input
                            type="date"
                            value={expectedDueDate}
                            onChange={(e) => setExpectedDueDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Litter Number</label>
                          <input
                            type="number"
                            min="0"
                            value={litterNumber}
                            onChange={(e) => setLitterNumber(e.target.value)}
                            placeholder="e.g. 1"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PREGNANCY DELIVERY ── */}
              {pet?.sex === 'female' && <div className="border border-blue-100 rounded-2xl overflow-hidden bg-blue-50/30">
                <div className="px-4 py-3 border-b border-blue-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pregnancyDelivery}
                      onChange={(e) => setPregnancyDelivery(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm font-semibold text-blue-700">Pregnancy Delivery Performed</span>
                  </label>
                </div>
                {pregnancyDelivery && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Delivery Date</label>
                        <input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Delivery Type</label>
                        <select
                          value={deliveryType}
                          onChange={(e) => setDeliveryType(e.target.value as 'natural' | 'c-section')}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="natural">Natural</option>
                          <option value="c-section">C-Section</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Labor Duration</label>
                        <input
                          type="text"
                          value={laborDuration}
                          onChange={(e) => setLaborDuration(e.target.value)}
                          placeholder="e.g. 3 hours"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Mother Condition</label>
                        <select
                          value={motherCondition}
                          onChange={(e) => setMotherCondition(e.target.value as 'stable' | 'critical' | 'recovering')}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="stable">Stable</option>
                          <option value="recovering">Recovering</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Live Births</label>
                        <input
                          type="number"
                          min="0"
                          value={liveBirths}
                          onChange={(e) => setLiveBirths(e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Still Births</label>
                        <input
                          type="number"
                          min="0"
                          value={stillBirths}
                          onChange={(e) => setStillBirths(e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Vet Remarks</label>
                      <textarea
                        rows={3}
                        value={deliveryVetRemarks}
                        onChange={(e) => setDeliveryVetRemarks(e.target.value)}
                        placeholder="Post-delivery observations, complications, instructions…"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                    </div>
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      Completing this visit will automatically update the pet&apos;s pregnancy status to <strong>Not Pregnant</strong>.
                    </p>
                  </div>
                )}
              </div>
              }


            </>
          )}

          {/* ── STEP 3: VACCINATION (vaccination appointments only) ── */}
          {step === 3 && isVaccinationAppt && (
            <div className="space-y-4">
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

              {/* Due / Overdue vaccine alert banner */}
              {(() => {
                if (!medHistoryData?.vaccinations) return null
                const due = medHistoryData.vaccinations.filter((v) =>
                  v.status === 'overdue' || v.status === 'pending' || (v.nextDueDate && new Date(v.nextDueDate) <= new Date(Date.now() + 14 * 86400000))
                )
                if (due.length === 0) return null
                return (
                  <div className="border border-orange-200 rounded-2xl overflow-hidden bg-orange-50/50">
                    <div className="px-4 py-2.5 border-b border-orange-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="text-xs font-semibold text-orange-800">Due / Overdue Vaccines for {pet?.name}</span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {due.map((v, i) => {
                        const isOverdue = v.status === 'overdue' || (v.nextDueDate && new Date(v.nextDueDate) < new Date())
                        const alreadyInForm = vaccines.some((fv) => {
                          const vt = vaccineTypes.find((x) => x._id === fv.vaccineTypeId)
                          return vt?.name?.toLowerCase() === v.name?.toLowerCase()
                        })
                        return (
                          <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                            <div>
                              <p className="text-xs font-semibold text-gray-700">{v.name}</p>
                              <p className="text-[10px] text-gray-500">
                                {isOverdue
                                  ? <span className="text-red-600 font-medium">Overdue{v.nextDueDate ? ` since ${new Date(v.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
                                  : <span className="text-orange-600">Due {v.nextDueDate ? new Date(v.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'soon'}</span>
                                }
                              </p>
                            </div>
                            {!alreadyInForm && (
                              <button
                                type="button"
                                onClick={() => {
                                  const match = vaccineTypes.find((vt) => vt.name.toLowerCase() === v.name?.toLowerCase())
                                  if (match) {
                                    setVaccines((prev) => [...prev.filter((fv) => fv.vaccineTypeId), {
                                      ...emptyVaccine(),
                                      vaccineTypeId: match._id,
                                      manufacturer: match.defaultManufacturer || '',
                                      batchNumber: match.defaultBatchNumber || '',
                                      route: match.route || '',
                                    }])
                                  } else {
                                    setVaccines((prev) => [...prev, emptyVaccine()])
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#476B6B] text-white rounded-lg hover:bg-[#3a5858] transition-colors shrink-0"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            )}
                            {alreadyInForm && (
                              <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                                <CheckCircle className="w-3 h-3" /> Added
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Vaccines list */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-[#7FA5A3]" />
                  Vaccinations <span className="text-xs font-normal text-gray-400 ml-1">({vaccines.length})</span>
                </p>
              </div>

              <div className="space-y-3">
                {vaccines.map((v, i) => {
                  const vt = vaccineTypes.find((x) => x._id === v.vaccineTypeId)
                  const ageValidation = vt && pet?.dateOfBirth
                    ? validateVaccineAge(pet.dateOfBirth, vt.minAgeMonths || 0, vt.maxAgeMonths || null)
                    : null
                  const base = v.dateAdministered ? new Date(v.dateAdministered) : null
                  const expiry = base && vt
                    ? (() => { const d = new Date(base); d.setDate(d.getDate() + (vt.validityDays || 0)); return d })()
                    : null
                  const doseInterval = vt ? getIntervalForDose(vt, v.doseNumber) : null
                  const isLastDose = vt ? v.doseNumber >= (vt.numberOfBoosters + 1) : false
                  const nextDue = vt?.requiresBooster && doseInterval != null && !isLastDose && base
                    ? (() => { const d = new Date(base); d.setDate(d.getDate() + doseInterval); return d })()
                    : null

                  // Determine if this row's dose was already administered in a prior appointment
                  const currentEditingIds = new Set(vaccines.map((item) => item.createdVaccineId).filter(Boolean))
                  const priorAdministeredDoses = new Set(
                    allPetVaccinations
                      .filter((pv) => {
                        if (currentEditingIds.has(pv._id)) return false
                        const pvVtId = typeof pv.vaccineTypeId === 'object' && pv.vaccineTypeId !== null
                          ? (pv.vaccineTypeId as VaccineType)._id
                          : (pv.vaccineTypeId as string)
                        return pvVtId === v.vaccineTypeId
                      })
                      .map((pv) => pv.doseNumber)
                  )
                  const isViewOnly = priorAdministeredDoses.has(v.doseNumber)

                  // View-only row for already-administered doses
                  if (isViewOnly) {
                    const doseLabel = v.doseNumber === 1 ? 'Dose 1 (Initial)' : `Dose ${v.doseNumber} (Booster ${v.doseNumber - 1})`
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                            <Syringe className="w-3.5 h-3.5" /> {vt?.name || 'Vaccine'}
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Previously Administered</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border bg-[#476B6B] text-white border-[#476B6B]">{doseLabel} ✓</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div><span className="text-[10px] text-gray-400 block">Date Administered</span>{v.dateAdministered || '—'}</div>
                          <div><span className="text-[10px] text-gray-400 block">Route</span>{v.route || '—'}</div>
                          <div><span className="text-[10px] text-gray-400 block">Manufacturer</span>{v.manufacturer || '—'}</div>
                          <div><span className="text-[10px] text-gray-400 block">Batch/Lot No</span>{v.batchNumber || '—'}</div>
                        </div>
                        {v.notes && <p className="text-xs text-gray-500 italic">{v.notes}</p>}
                      </div>
                    )
                  }

                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2.5">
                      {/* Row header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                          <Syringe className="w-3.5 h-3.5" /> Vaccine {i + 1}
                        </span>
                        {vaccines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setVaccines((prev) => prev.filter((_, j) => j !== i))}
                            className="text-[#900B09] hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Vaccine Type */}
                      <select
                        value={v.vaccineTypeId}
                        onChange={(e) => {
                          const newVtId = e.target.value
                          const newVt = vaccineTypes.find((x) => x._id === newVtId)
                          // Determine next dose: find the highest doseNumber already administered for this vaccine type
                          // Exclude any records from the current appointment (being edited now)
                          const currentEditingIds = new Set(vaccines.map((item) => item.createdVaccineId).filter(Boolean))
                          const priorDoses = allPetVaccinations.filter((pv) => {
                            if (currentEditingIds.has(pv._id)) return false
                            const pvVtId = typeof pv.vaccineTypeId === 'object' && pv.vaccineTypeId !== null
                              ? (pv.vaccineTypeId as VaccineType)._id
                              : (pv.vaccineTypeId as string)
                            return pvVtId === newVtId
                          })
                          const maxDose = priorDoses.length > 0
                            ? Math.max(...priorDoses.map((pv) => pv.doseNumber || 1))
                            : 0
                          const nextDose = maxDose + 1
                          setVaccines((prev) => prev.map((item, j) => j === i ? {
                            ...item,
                            vaccineTypeId: newVtId,
                            doseNumber: nextDose,
                            manufacturer: newVt?.defaultManufacturer || item.manufacturer,
                            batchNumber: newVt?.defaultBatchNumber || item.batchNumber,
                            route: newVt?.route || item.route,
                          } : item))
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                      >
                        <option value="">Select vaccine type…</option>
                        {vaccineTypes.map((vt) => (
                          <option key={vt._id} value={vt._id}>{vt.name}</option>
                        ))}
                      </select>

                      {/* Dose selector (only for vaccines with boosters) */}
                      {vt?.requiresBooster && (() => {
                        const totalDoses = Math.max(vt.numberOfBoosters || 0, 1) + 1
                        // reuse priorAdministeredDoses computed above
                        const administeredDoses = priorAdministeredDoses
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: totalDoses }, (_, d) => d + 1).map((n) => {
                              const isDone = administeredDoses.has(n)
                              const isSelected = v.doseNumber === n
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={isDone}
                                  onClick={() => !isDone && setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, doseNumber: n } : item))}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                                    isDone
                                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                      : isSelected
                                        ? 'bg-[#476B6B] text-white border-[#476B6B]'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                                  }`}
                                >
                                  {n === 1 ? 'Dose 1 (Initial)' : `Dose ${n} (Booster ${n - 1})`}
                                  {isDone && ' ✓'}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* Expires | Next Due badges */}
                      {vt && base && (
                        <div className="grid grid-cols-2 gap-2">
                          {expiry && (
                            <div className="bg-[#F4D3D2] border border-[#983232] rounded-lg p-2">
                              <p className="text-[9px] font-bold text-[#983232] uppercase tracking-wide">Expires</p>
                              <p className="font-bold text-[#983232] text-xs mt-0.5">{expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                          )}
                          {nextDue && (
                            <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-lg p-2">
                              <p className="text-[9px] font-bold text-[#4569B1] uppercase tracking-wide">Next Due</p>
                              <p className="font-bold text-[#4569B1] text-xs mt-0.5">
                                {v.nextDueDate
                                  ? new Date(v.nextDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pet eligibility indicator */}
                      {ageValidation && (
                        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs ${
                          ageValidation.isValid
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                          {ageValidation.isValid
                            ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          }
                          <span>{ageValidation.message}</span>
                        </div>
                      )}

                      {/* Date Administered | Next Due Date */}
                      {(() => {
                        const today = new Date().toISOString().split('T')[0]
                        const dateInFuture = v.dateAdministered && v.dateAdministered > today
                        const nextDueInvalid = v.nextDueDate && v.dateAdministered && v.nextDueDate <= v.dateAdministered
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Date Administered <span className="text-[#900B09]">*</span></label>
                              <input
                                type="date"
                                value={v.dateAdministered}
                                max={today}
                                onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, dateAdministered: e.target.value } : item))}
                                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] ${dateInFuture ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                              />
                              {dateInFuture && (
                                <p className="text-[10px] text-red-500 mt-0.5">Date cannot be in the future.</p>
                              )}
                            </div>
                            {vt?.requiresBooster && (
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Next Due Date</label>
                                <input
                                  type="date"
                                  value={v.nextDueDate}
                                  min={v.dateAdministered ? (() => { const d = new Date(v.dateAdministered); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })() : undefined}
                                  onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, nextDueDate: e.target.value } : item))}
                                  className={`w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] ${nextDueInvalid ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                />
                                {nextDueInvalid && (
                                  <p className="text-[10px] text-red-500 mt-0.5">Must be after date administered.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Dosage | Route | Manufacturer | Batch/Lot No */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Dosage</label>
                          <div className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-600 min-h-[30px] flex items-center">
                            {vt?.doseVolumeMl != null ? `${vt.doseVolumeMl} mL` : '—'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Route</label>
                          <select
                            value={v.route}
                            onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, route: e.target.value } : item))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                          >
                            <option value="">Route…</option>
                            <option value="subcutaneous">Subcutaneous (SC)</option>
                            <option value="intramuscular">Intramuscular (IM)</option>
                            <option value="intranasal">Intranasal (IN)</option>
                            <option value="oral">Oral</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Manufacturer</label>
                          <input
                            type="text"
                            value={v.manufacturer}
                            onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, manufacturer: e.target.value } : item))}
                            placeholder="Manufacturer"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Batch/Lot No</label>
                          <input
                            type="text"
                            value={v.batchNumber}
                            onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, batchNumber: e.target.value } : item))}
                            placeholder="Batch No."
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                          />
                        </div>
                      </div>

                      {/* Clinical Notes */}
                      <input
                        type="text"
                        value={v.notes}
                        onChange={(e) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, notes: e.target.value } : item))}
                        placeholder="Clinical notes (optional)"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Add Vaccine button */}
              <button
                type="button"
                onClick={() => setVaccines((prev) => [...prev, emptyVaccine()])}
                className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Vaccine
              </button>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-[#4F4F4F]">Visit Summary and Diagnosis</label>
                  {!visitSummary && (
                    <button
                      type="button"
                      onClick={() => setVisitSummary(buildDraftSummary())}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#476B6B] border border-[#7FA5A3]/50 rounded-lg hover:bg-[#f0f7f7] transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Draft from record
                    </button>
                  )}
                </div>
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
                    {/* Medication reconciliation from previous visit */}
                    {carryoverMeds.length > 0 && !carryoverApplied && medications.length === 0 && (
                      <div className="mt-3 border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40">
                        <div className="px-3 py-2 border-b border-amber-100 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" />
                            Active Medications from Last Visit
                          </span>
                          <span className="text-[10px] text-amber-600">Select which to continue</span>
                        </div>
                        <div className="p-2.5 space-y-1.5">
                          {carryoverMeds.map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                              <div className="flex-1 min-w-0 mr-2">
                                <p className="text-xs font-semibold text-gray-700 truncate">{item.med.name}</p>
                                <p className="text-[10px] text-gray-500">{item.med.dosage} · {item.med.route} · {item.med.frequency}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setCarryoverMeds((prev) => prev.map((c, j) => j === i ? { ...c, action: 'continue' } : c))}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${item.action === 'continue' ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-green-400'}`}
                                >
                                  Continue
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCarryoverMeds((prev) => prev.map((c, j) => j === i ? { ...c, action: 'stop' } : c))}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${item.action === 'stop' ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-red-400'}`}
                                >
                                  Stop
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const toAdd = carryoverMeds.filter((c) => c.action === 'continue').map((c) => c.med)
                              setMedications((prev) => [...prev, ...toAdd])
                              setCarryoverApplied(true)
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors w-full justify-center mt-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Apply Selected Medications to This Visit
                          </button>
                        </div>
                      </div>
                    )}
                    {carryoverApplied && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        <CheckCircle className="w-3 h-3" />
                        Previous medications applied. Review and adjust as needed below.
                      </div>
                    )}

                    {medications.map((med, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Medication {i + 1}</span>
                          <button onClick={() => setMedications((prev) => prev.filter((_, j) => j !== i))} className="text-[#900B09] hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={med.name} onChange={(e) => {
                            const selectedName = e.target.value
                            const selectedService = medicationServices.find((s) => s.name === selectedName)
                            setMedications((prev) => prev.map((m, j) => {
                              if (j !== i) return m
                              // Auto-populate from service data when a medication is selected
                              if (selectedService) {
                                return {
                                  ...m,
                                  name: selectedName,
                                  dosage: selectedService.dosageAmount || m.dosage,
                                  route: (selectedService.administrationRoute as Medication['route']) || m.route,
                                  frequency: selectedService.frequency?.toString() || m.frequency,
                                  duration: selectedService.duration?.toString() || m.duration,
                                }
                              }
                              return { ...m, name: selectedName }
                            }))
                          }} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="">Select a medication</option>
                            {medicationServices.map((service) => (
                              <option key={service._id} value={service.name}>{service.name} {service.price ? `(₱${service.price})` : ''}</option>
                            ))}
                          </select>
                          <input type="text" placeholder="Dosage (e.g. 10mg)" value={med.dosage} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.route} disabled className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed">
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
                      const selectedService = preventiveCareServices.find((s) => s.name.toLowerCase() === care.product.toLowerCase())
                      const base = care.dateAdministered ? new Date(care.dateAdministered) : null
                      const calculatedNextDue = base && selectedService?.intervalDays
                        ? (() => { const d = new Date(base); d.setDate(d.getDate() + (selectedService.intervalDays as number)); return d })()
                        : null
                      
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500">Preventive Care {i + 1}</span>
                            <button onClick={() => setPreventiveCare((prev) => prev.filter((_, j) => j !== i))} className="text-[#900B09] hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select 
                              value={care.product} 
                              onChange={(e) => {
                                const selected = preventiveCareServices.find((s) => s.name.toLowerCase() === e.target.value.toLowerCase())
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
                                // Reset manual edit flag when product changes
                                setPreventiveCareManuallyEdited((prev) => {
                                  const newSet = new Set(prev)
                                  newSet.delete(i)
                                  return newSet
                                })
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
                                  const selected = preventiveCareServices.find((s) => s.name.toLowerCase() === care.product.toLowerCase())
                                  
                                  // Always recalculate nextDueDate UNLESS vet has manually edited it
                                  let newNextDueDate = care.nextDueDate
                                  if (dateValue && selected?.intervalDays && !preventiveCareManuallyEdited.has(i)) {
                                    const d = new Date(dateValue)
                                    d.setDate(d.getDate() + (selected.intervalDays as number))
                                    newNextDueDate = d.toISOString().split('T')[0]
                                  }
                                  
                                  setPreventiveCare((prev) => prev.map((c, j) => 
                                    j === i 
                                      ? { ...c, dateAdministered: dateValue || null, nextDueDate: newNextDueDate }
                                      : c
                                  ))
                                }}
                                placeholder="mm/dd/yyyy"
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
                              onChange={(e) => {
                                setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, nextDueDate: e.target.value || null } : c))
                                // Mark this item as manually edited
                                setPreventiveCareManuallyEdited((prev) => new Set([...prev, i]))
                              }}
                              placeholder="mm/dd/yyyy"
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
                        className="data-checked:bg-green-600"
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
                  if (step === 3 && isVaccinationAppt) await trySaveVaccinations()
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
            {step === 3 && isVaccinationAppt && (() => {
              const today = new Date().toISOString().split('T')[0]
              const hasAgeError = vaccines.some((v) => {
                if (!v.vaccineTypeId) return false
                const vt = vaccineTypes.find((x) => x._id === v.vaccineTypeId)
                if (!vt || !pet?.dateOfBirth) return false
                return !validateVaccineAge(pet.dateOfBirth, vt.minAgeMonths || 0, vt.maxAgeMonths || null).isValid
              })
              const hasDateError = vaccines.some((v) =>
                (v.dateAdministered && v.dateAdministered > today) ||
                (v.nextDueDate && v.dateAdministered && v.nextDueDate <= v.dateAdministered)
              )
              return (
              <button
                onClick={handleProceedStep3Vaccination}
                disabled={saving || hasAgeError || hasDateError}
                title={hasAgeError ? 'One or more vaccines: pet age is outside the allowed range' : hasDateError ? 'Fix date errors before proceeding' : undefined}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Post-Procedure
                <ChevronRight className="w-4 h-4" />
              </button>
              )
            })()}
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

      {/* ===== HISTORICAL MEDICAL RECORD PANEL (right, collapsible) ===== */}
      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${historyMinimized ? 'w-10' : 'w-96'}`}>
        {historyMinimized ? (
          <button
            onClick={() => setHistoryMinimized(false)}
            className="flex flex-col items-center justify-center h-full gap-3 text-[#476B6B] hover:bg-gray-50 w-full px-1"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span
              className="text-[10px] font-semibold tracking-widest uppercase text-[#476B6B]"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              History
            </span>
          </button>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                Medical History
              </h2>
              <button
                onClick={() => setHistoryMinimized(true)}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
                title="Minimize"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <HistoricalMedicalRecord
                petId={petId}
                token={token}
                refreshTrigger={historyRefresh}
                isReadOnly={true}
              />
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

