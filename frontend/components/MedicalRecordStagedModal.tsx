'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, updateMedicalRecord, emptyVitals, getDiagnosticTestServices, getMedicationServices, getPreventiveCareServices, getSurgeryServices, getPregnancyDeliveryServices, getHistoricalRecords, type ProductService, type MedicalRecord as MedicalRecordFull } from '@/lib/medicalRecords'
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
import { DatePicker } from '@/components/ui/date-picker'
import { syncBillingFromRecord } from '@/lib/billingSync'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  recordId: string
  appointmentId?: string
  petId: string
  appointmentTypes?: string[]
  appointmentTiterFirst?: boolean
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

const VACC_STEP_ICONS: Record<StepKey, ReactNode> = {
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

const REG_STEP_ICONS: Record<1 | 2 | 3, ReactNode> = {
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

const SURG_STEP_ICONS: Record<StepKey, ReactNode> = {
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
  quantity: null,
  pricingType: '',
  piecesPerPack: null,
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
type TiterSpecies = 'canine' | 'feline'

interface TiterRow {
  disease: string
  score: number | null
  status: 'Positive' | 'Negative' | ''
  action: 'None' | 'Vaccinate' | ''
}

interface AntigenRow {
  disease: string
  result: 'Positive' | 'Negative' | ''
}

const TITERS_BY_SPECIES: Record<TiterSpecies, string[]> = {
  canine: ['CPV', 'CDV', 'CAV-1'],
  feline: ['FPV', 'FCV', 'FHV'],
}

const ANTIGEN_DISEASES_BY_SPECIES: Record<TiterSpecies, string[]> = {
  canine: ['CPV', 'CAV', 'CDV'],
  feline: ['FPV', 'FCV', 'FHV'],
}

const buildTiterRows = (species: TiterSpecies): TiterRow[] => {
  return TITERS_BY_SPECIES[species].map((disease) => ({
    disease,
    score: null,
    status: '',
    action: '',
  }))
}

const buildAntigenRows = (species: TiterSpecies): AntigenRow[] => {
  return ANTIGEN_DISEASES_BY_SPECIES[species].map((disease) => ({
    disease,
    result: '',
  }))
}

const computeTiterStatusAction = (score: number | null): Pick<TiterRow, 'status' | 'action'> => {
  if (score === null || Number.isNaN(score)) return { status: '', action: '' }
  if (score >= 3) return { status: 'Positive', action: 'None' }
  return { status: 'Negative', action: 'Vaccinate' }
}

const isTiterTestingService = (value: string) => {
  const normalized = String(value || '').toLowerCase()
  return normalized.includes('titer testing') || normalized.includes('titer-test') || normalized.includes('titer')
}

const isAntigenTestService = (value: string) => {
  const normalized = String(value || '').toLowerCase()
  return normalized.includes('3-in-1') || normalized.includes('antigen test') || normalized.includes('antigen')
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

function DropdownField({
  value,
  onValueChange,
  options,
  className,
  placeholder,
  disabled = false,
}: {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
  className: string
  placeholder: string
  disabled?: boolean
}) {
  const selected = options.find((opt) => opt.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`${className} flex items-center justify-between text-left disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed`}
        >
          <span>{selected?.label || placeholder}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) max-h-60 overflow-y-auto rounded-lg">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((opt) => (
            <DropdownMenuRadioItem
              key={`${opt.value || '__empty'}-${opt.label}`}
              value={opt.value}
              disabled={opt.disabled}
              className="text-xs"
            >
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Compute next-due date offset (days) for a given dose using the new series/booster model.
 * Returns null if no follow-up is required.
 */
function getNextDueInterval(
  vaccineType: {
    isSeries?: boolean;
    totalSeries?: number;
    seriesIntervalDays?: number;
    boosterValid?: boolean;
    boosterIntervalDays?: number | null;
  },
  doseNumber: number
): number | null {
  const isSeries = vaccineType.isSeries ?? false
  const totalSeries = isSeries ? (vaccineType.totalSeries || 3) : 1
  const boosterValid = vaccineType.boosterValid ?? false
  const seriesIntervalDays = vaccineType.seriesIntervalDays || 21
  const boosterIntervalDays = vaccineType.boosterIntervalDays || 365

  if (isSeries && doseNumber < totalSeries) {
    return seriesIntervalDays // still in series — schedule next series dose
  }
  if (boosterValid) {
    return boosterIntervalDays // series complete (or no series) — schedule booster
  }
  return null
}

function computeAutoNextDueDateString(
  vaccineType: {
    isSeries?: boolean;
    totalSeries?: number;
    seriesIntervalDays?: number;
    boosterValid?: boolean;
    boosterIntervalDays?: number | null;
  } | undefined,
  doseNumber: number,
  dateAdministered: string
): string {
  if (!vaccineType || !dateAdministered) return ''
  const interval = getNextDueInterval(vaccineType, doseNumber)
  if (interval == null) return ''
  const base = new Date(dateAdministered)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + interval)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Human-readable label for a dose number given vaccine type config. */
function getDoseLabel(
  vaccineType: { isSeries?: boolean; totalSeries?: number } | undefined,
  doseNumber: number
): string {
  if (!vaccineType) return `Dose ${doseNumber}`
  const isSeries = vaccineType.isSeries ?? false
  const totalSeries = isSeries ? (vaccineType.totalSeries || 3) : 1
  const boosterNum = Math.max(0, doseNumber - totalSeries)
  if (boosterNum > 0) return `Booster #${boosterNum}`
  if (isSeries) return `Series ${doseNumber}/${totalSeries}`
  return 'Initial Dose'
}

/** Returns the effective "series length" for a vaccine type (1 for non-series). */
function getEffectiveSeries(vaccineType: { isSeries?: boolean; totalSeries?: number } | undefined): number {
  if (!vaccineType) return 1
  return (vaccineType.isSeries) ? (vaccineType.totalSeries || 3) : 1
}

/** Auto dose volume by pet species. */
function autoDoseVolume(petSpecies: string | undefined): string {
  if (!petSpecies) return ''
  const s = petSpecies.toLowerCase()
  if (s === 'canine' || s === 'dog') return '1.0 mL'
  if (s === 'feline' || s === 'cat') return '0.5 mL'
  return ''
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

// Determine injection care type from a product/medication name
const getInjectionCareType = (name: string): 'flea' | 'deworming' | 'heartworm' | null => {
  const lower = name.toLowerCase()
  if (lower.includes('heartworm')) return 'heartworm'
  if (lower.includes('flea') || lower.includes('tick')) return 'flea'
  if (lower.includes('deworm')) return 'deworming'
  return null
}

function normalizeServiceToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const isInjectionService = (service: ProductService | undefined | null): boolean => {
  if (!service) return false
  const route = normalizeServiceToken(String(service.administrationRoute || ''))
  const method = normalizeServiceToken(String(service.administrationMethod || ''))
  return route.includes('injection') || method.includes('injection')
}

// Calculate injection dosage (mL) and adjusted price for mlPerKg injections
const calculateInjectionDosage = (
  service: { name: string; price: number; injectionPricingType?: string },
  weightKg: number,
  careTypeOverride?: 'flea' | 'deworming' | 'heartworm' | null,
): { dosageMl: number; price: number } | null => {
  if (normalizeServiceToken(String(service.injectionPricingType || '')) !== 'mlperkg') return null
  if (isNaN(weightKg) || weightKg <= 0) return null

  const type = careTypeOverride !== undefined ? careTypeOverride : getInjectionCareType(service.name)
  const basePrice = service.price ?? 0

  if (type === 'flea') {
    const increments = Math.ceil(weightKg / 5)
    return {
      dosageMl: parseFloat((increments * 0.4).toFixed(2)),
      price: parseFloat((basePrice * Math.pow(1.15, increments)).toFixed(2)),
    }
  }
  if (type === 'deworming') {
    const increments = Math.ceil(weightKg / 2)
    return {
      dosageMl: parseFloat((increments * 0.2).toFixed(2)),
      price: parseFloat((basePrice + increments * 100).toFixed(2)),
    }
  }
  if (type === 'heartworm') {
    const increments = Math.ceil(weightKg / 1)
    return {
      dosageMl: parseFloat((increments * 0.5).toFixed(2)),
      price: parseFloat((basePrice * Math.pow(1.05, increments)).toFixed(2)),
    }
  }
  return null
}

const formatInjectionPricingTypeLabel = (injectionPricingType?: string | null): string => {
  const normalized = normalizeServiceToken(String(injectionPricingType || ''))
  if (normalized === 'mlperkg') return 'mL per Kg'
  if (normalized === 'singledose') return 'Single Dose'
  return 'Not configured'
}

const deriveInjectionDosageDisplay = (service: ProductService | undefined, weightKg: number): string | null => {
  if (!service) return null

  if (isNaN(weightKg) || weightKg <= 0) return null

  const dosageFromAmount = (() => {
    if (!service.dosageAmount) return null
    const matched = String(service.dosageAmount).match(/\d+(?:\.\d+)?/)
    return matched ? parseFloat(matched[0]) : null
  })()

  const dosageUnitFromAmount = (() => {
    if (!service.dosageAmount) return null
    const matched = String(service.dosageAmount).match(/\b(mg|ml|mcg|g)\b/i)
    return matched ? matched[1] : null
  })()

  const dosageFactor = service.dosePerKg ?? dosageFromAmount
  if (dosageFactor == null || isNaN(dosageFactor)) return null

  const computedDosage = parseFloat((dosageFactor + (Math.floor(weightKg / 2) * 0.1)).toFixed(2))
  return `${computedDosage} ${service.doseUnit || dosageUnitFromAmount || 'mL'}`
}

const isProductMedicationService = (service: ProductService): boolean => {
  const normalizedType = String(service.type || '').toLowerCase()
  const normalizedCategory = String(service.category || '').toLowerCase()
  return normalizedType === 'product' && normalizedCategory === 'medication'
}

const getAssociatedServiceIdValue = (service: ProductService): string | null => {
  if (!service.associatedServiceId) return null
  if (typeof service.associatedServiceId === 'string') return service.associatedServiceId
  const nestedId = (service.associatedServiceId as { _id?: unknown })._id
  if (typeof nestedId === 'string') return nestedId
  if (nestedId != null) return String(nestedId)
  return null
}

const resolveMedicationServiceForEntry = (
  medicationServices: ProductService[],
  medication: Omit<Medication, '_id'>,
): ProductService | undefined => {
  const normalizedName = normalizeServiceToken(medication.name)
  if (!normalizedName) return undefined

  const candidates = medicationServices.filter(
    (service) => normalizeServiceToken(service.name) === normalizedName,
  )
  if (candidates.length === 0) return undefined

  const normalizedRoute = normalizeServiceToken(String(medication.route || ''))
  if (normalizedRoute) {
    const routeMatched = candidates.find((service) => {
      const routeToken = normalizeServiceToken(String(service.administrationRoute || ''))
      const methodToken = normalizeServiceToken(String(service.administrationMethod || ''))
      return routeToken === normalizedRoute || methodToken === normalizedRoute
    })
    if (routeMatched) return routeMatched
  }

  return candidates[0]
}

const DEBUG_PREVENTIVE_INJECTION_MAPPING =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEBUG_PREVENTIVE_INJECTION !== '0'

const derivePreventiveCareFromAppointment = (
  appointmentTypes: string[],
  preventiveServices: ProductService[],
  appointmentDate?: string | null,
): Omit<PreventiveCare, '_id'>[] => {
  if (!appointmentDate || !Array.isArray(appointmentTypes) || appointmentTypes.length === 0) return []

  const normalizedDate = appointmentDate.includes('T') ? appointmentDate.split('T')[0] : appointmentDate
  const normalizedServices = preventiveServices.map((service) => ({
    ...service,
    normalizedName: normalizeServiceToken(service.name),
  }))

  const matchedServices: ProductService[] = []
  for (const apptType of appointmentTypes) {
    const raw = String(apptType || '').trim()
    if (!raw) continue
    const normalizedType = normalizeServiceToken(raw)
    const matched = normalizedServices.find((service) =>
      service._id === raw ||
      service.normalizedName === normalizedType ||
      service.normalizedName.includes(normalizedType) ||
      normalizedType.includes(service.normalizedName),
    )
    if (matched && !matchedServices.some((service) => service._id === matched._id)) {
      matchedServices.push(matched)
    }
  }

  if (matchedServices.length > 0) {
    return matchedServices.map((service) => ({
      careType: mapProductToCareType(service.name),
      product: service.name,
      dateAdministered: normalizedDate,
      notes: '',
    }))
  }

  const legacyServiceByType: Record<string, string> = {
    deworming: 'Deworming',
    fleatickprevention: 'Flea & Tick Prevention',
    heartworm: 'Heartworm Prevention',
  }

  const seenProducts = new Set<string>()
  const legacyRows: Omit<PreventiveCare, '_id'>[] = []
  for (const apptType of appointmentTypes) {
    const normalizedType = normalizeServiceToken(apptType)
    const product = legacyServiceByType[normalizedType]
    if (!product || seenProducts.has(product)) continue
    seenProducts.add(product)
    legacyRows.push({
      careType: mapProductToCareType(product),
      product,
      dateAdministered: normalizedDate,
      notes: '',
    })
  }

  return legacyRows
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

export default function MedicalRecordStagedModal({ recordId, appointmentId, petId, appointmentTypes = [], appointmentTiterFirst = false, appointmentDate, onComplete, onClose }: Props) {
  const token = useAuthStore((s) => s.token)
  const [step, setStep] = useState<StepKey>(1)
  const [pet, setPet] = useState<Pet | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [vitalsOpen, setVitalsOpen] = useState(true)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  // Tracks the stage the record was in when first loaded (e.g. 'confined').
  const [recordStage, setRecordStage] = useState<string>('pre_procedure')
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
  const [capsuleWarnings, setCapsuleWarnings] = useState<Record<number, string>>({})
  const [selectedMedicationServiceIds, setSelectedMedicationServiceIds] = useState<Record<number, string>>({})
  const [prevContextOpen, setPrevContextOpen] = useState(true)

  // Whether this appointment includes vaccination/booster
  const isVaccinationAppt = appointmentTypes.some((t) => t === 'vaccination' || t === 'booster' || t === 'puppy-litter-vaccination' || t === 'rabies-vaccination')
  const hasTiterTestingService = appointmentTypes.some((t) => isTiterTestingService(t))

  // Whether this appointment is a surgery appointment
  const isSurgeryAppt = !isVaccinationAppt && appointmentTypes.some((t) =>
    t === 'sterilization' || t === 'Sterilization' ||
    t === 'abdominal-surgery' || t === 'orthopedic-surgery' ||
    t === 'dental-scaling' || t === 'laser-therapy'
  )
  const patientTiterSpecies: TiterSpecies = pet?.species === 'feline' ? 'feline' : 'canine'

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
  const [titerEnabled, setTiterEnabled] = useState<boolean>(appointmentTiterFirst || hasTiterTestingService)
  const [titerSpecies, setTiterSpecies] = useState<TiterSpecies>('canine')
  const [titerRows, setTiterRows] = useState<TiterRow[]>(buildTiterRows('canine'))
  const [titerKitName, setTiterKitName] = useState('VCheck')
  const [skipTiterSuggested, setSkipTiterSuggested] = useState(false)
  const [titerImages, setTiterImages] = useState<{ data: string; contentType: string; description: string }[]>([])
  const [antigenEnabled, setAntigenEnabled] = useState(false)
  const [antigenRows, setAntigenRows] = useState<AntigenRow[]>(buildAntigenRows('canine'))
  const [vaccinationSkippedDue, setVaccinationSkippedDue] = useState<string[]>([])
  const [xray] = useState(false)
  const [ultrasound] = useState(false)
  const [availedProducts] = useState(false)

  // Pregnancy tracking (from ultrasound diagnostic)
  const [ultrasoundPregnant, setUltrasoundPregnant] = useState(false)
  const [gestationDate, setGestationDate] = useState('')
  const [expectedDueDate, setExpectedDueDate] = useState('')
  const [litterNumber, setLitterNumber] = useState('')
  const [pregnancyConfirmationMethod, setPregnancyConfirmationMethod] = useState<'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown'>('unknown')
  const [pregnancyConfirmationSource, setPregnancyConfirmationSource] = useState<'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown'>('this_clinic')
  const [pregnancyConfidence, setPregnancyConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [pregnancyNotes, setPregnancyNotes] = useState('')

  // Pregnancy delivery
  const [pregnancyDelivery, setPregnancyDelivery] = useState(false)
  const [pregnancyDeliveryServices, setPregnancyDeliveryServices] = useState<ProductService[]>([])
  const [deliveryServiceId, setDeliveryServiceId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [laborDuration, setLaborDuration] = useState('')
  const [liveBirths, setLiveBirths] = useState('')
  const [stillBirths, setStillBirths] = useState('')
  const [motherCondition, setMotherCondition] = useState<'stable' | 'critical' | 'recovering'>('stable')
  const [deliveryVetRemarks, setDeliveryVetRemarks] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState<'in_clinic' | 'outside_clinic' | 'unknown'>('in_clinic')
  const [deliveryReportedBy, setDeliveryReportedBy] = useState<'vet' | 'owner' | 'external_vet' | 'unknown'>('vet')

  // Pregnancy loss
  const [pregnancyLoss, setPregnancyLoss] = useState(false)
  const [lossDate, setLossDate] = useState('')
  const [lossType, setLossType] = useState<'miscarriage' | 'reabsorption' | 'abortion' | 'other'>('miscarriage')
  const [gestationalAgeAtLoss, setGestationalAgeAtLoss] = useState('')
  const [lossNotes, setLossNotes] = useState('')
  const [lossReportedBy, setLossReportedBy] = useState<'vet' | 'owner' | 'external_vet' | 'unknown'>('vet')

  // Step 3 fields
  const [visitSummary, setVisitSummary] = useState('')
  const [medications, setMedications] = useState<Omit<Medication, '_id'>[]>([])
  const [diagnosticTests, setDiagnosticTests] = useState<(Omit<DiagnosticTest, '_id'> & { images?: { data: string; contentType: string; description: string }[] })[]>([])

  // Derived: which specialty panels to show in During Procedure (must be after diagnosticTests state)
  const titerInCatalog = diagnosticTestServices.some((s) => isTiterTestingService(s.name))
  const antigenInCatalog = diagnosticTestServices.some((s) => isAntigenTestService(s.name))
  const showTiterSection =
    hasTiterTestingService ||
    (isVaccinationAppt && titerInCatalog) ||
    diagnosticTests.some((t) => isTiterTestingService(t.name))
  const showAntigenSection =
    (isVaccinationAppt && antigenInCatalog) ||
    diagnosticTests.some((t) => isAntigenTestService(t.name))

  const [preventiveCare, setPreventiveCare] = useState<Omit<PreventiveCare, '_id'>[]>([])
  const [sharedWithOwner, setSharedWithOwner] = useState(true)
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])

  // Collapsible sections in step 3
  const [medsOpen, setMedsOpen] = useState(true)
  const [testsOpen, setTestsOpen] = useState(true)
  const [preventiveOpen, setPreventiveOpen] = useState(true)
  const [preventiveMedicationDispensing, setPreventiveMedicationDispensing] = useState<Record<string, 'singlePill' | 'pack' | ''>>({})
  const [preventiveInjectionDosageOverrides, setPreventiveInjectionDosageOverrides] = useState<Record<string, string>>({})
  const [preventiveMedicationDurationOverrides, setPreventiveMedicationDurationOverrides] = useState<Record<string, string>>({})
  const [preventiveMedicationIntervalOverrides, setPreventiveMedicationIntervalOverrides] = useState<Record<string, string>>({})
  // Tracks productServiceIds of associated preventive medications/injections the vet has opted out of
  const [preventiveAssociatedExclusions, setPreventiveAssociatedExclusions] = useState<Set<string>>(new Set())

  const isPreventiveCareAppt = appointmentTypes.some((apptType) => {
    const normalizedType = normalizeServiceToken(apptType)
    return (
      normalizedType === 'preventivecare' ||
      normalizedType === 'deworming' ||
      normalizedType === 'fleatickprevention' ||
      normalizedType === 'heartworm' ||
      preventiveCareServices.some((service) =>
        service._id === apptType || normalizeServiceToken(service.name) === normalizedType,
      )
    )
  })

  const getAssociatedPreventiveMedications = (preventiveServiceName: string): ProductService[] => {
    const normalizedServiceName = normalizeServiceToken(preventiveServiceName)
    const matchedPreventiveService = preventiveCareServices.find((service) =>
      normalizeServiceToken(service.name) === normalizedServiceName ||
      normalizeServiceToken(service.name).includes(normalizedServiceName) ||
      normalizedServiceName.includes(normalizeServiceToken(service.name)),
    )
    if (!matchedPreventiveService?._id) return []

    return medicationServices.filter((service) => {
      if (!isProductMedicationService(service)) return false
      if (String(service.administrationRoute || '').toLowerCase() !== 'preventive') return false

      const associatedServiceId = getAssociatedServiceIdValue(service)

      return associatedServiceId === matchedPreventiveService._id
    })
  }

  const getAssociatedInjectionMedications = (preventiveServiceName: string): ProductService[] => {
    const shouldDebug = DEBUG_PREVENTIVE_INJECTION_MAPPING && typeof window !== 'undefined'
    const normalizedServiceName = normalizeServiceToken(preventiveServiceName)
    const matchedPreventiveServices = preventiveCareServices.filter((service) =>
      normalizeServiceToken(service.name) === normalizedServiceName ||
      normalizeServiceToken(service.name).includes(normalizedServiceName) ||
      normalizedServiceName.includes(normalizeServiceToken(service.name)),
    )
    const preventiveServiceIds = new Set(matchedPreventiveServices.map((service) => String(service._id)))
    const careType = getInjectionCareType(preventiveServiceName)

    const candidateInjections = medicationServices.filter((service) => {
      if (!isProductMedicationService(service)) return false
      return String(service.administrationRoute || '').toLowerCase() === 'injection'
    })

    const evaluatedCandidates = candidateInjections.map((service) => {
      const pricingType = String(service.injectionPricingType || '').toLowerCase()
      const isMlPerKg = pricingType === 'mlperkg'
      const associatedServiceId = getAssociatedServiceIdValue(service)
      const directMatch = associatedServiceId ? preventiveServiceIds.has(String(associatedServiceId)) : false
      const linkedService = associatedServiceId
        ? [...preventiveCareServices, ...medicationServices].find((item) => String(item._id) === String(associatedServiceId))
        : null
      const linkedCareTypeMatch = linkedService && careType
        ? getInjectionCareType(linkedService.name) === careType
        : false
      const nameCareTypeMatch = careType ? getInjectionCareType(service.name) === careType : false
      const matches = isMlPerKg && (directMatch || linkedCareTypeMatch || nameCareTypeMatch)

      return {
        service,
        associatedServiceId,
        pricingType,
        isMlPerKg,
        directMatch,
        linkedServiceName: linkedService?.name || null,
        linkedCareTypeMatch,
        nameCareTypeMatch,
        matches,
      }
    })

    const matchedInjections = evaluatedCandidates
      .filter((candidate) => candidate.matches)
      .map((candidate) => candidate.service)

    if (shouldDebug && preventiveServiceName) {
      console.groupCollapsed(`[PreventiveInjectionDebug] ${preventiveServiceName}`)
      console.log('Context', {
        normalizedServiceName,
        careType,
        preventiveServiceIds: Array.from(preventiveServiceIds),
        matchedPreventiveServices: matchedPreventiveServices.map((service) => ({ _id: service._id, name: service.name })),
        medicationServiceCount: medicationServices.length,
        candidateInjectionCount: candidateInjections.length,
      })
      console.table(evaluatedCandidates.map((candidate) => ({
        id: candidate.service._id,
        name: candidate.service.name,
        associatedServiceId: candidate.associatedServiceId,
        injectionPricingType: candidate.pricingType || '(empty)',
        isMlPerKg: candidate.isMlPerKg,
        directMatch: candidate.directMatch,
        linkedServiceName: candidate.linkedServiceName,
        linkedCareTypeMatch: candidate.linkedCareTypeMatch,
        nameCareTypeMatch: candidate.nameCareTypeMatch,
        matches: candidate.matches,
      })))
      console.log('Matched injections', matchedInjections.map((service) => ({ _id: service._id, name: service.name })))
      console.groupEnd()
    }

    return matchedInjections
  }

  const deriveSinglePillQuantity = (service: ProductService): number | null => {
    const administrationMethod = service.administrationMethod?.toLowerCase() ?? ''
    const bodyWeight = parseFloat(String(vitals?.weight?.value ?? ''))

    if (administrationMethod === 'syrup' || service.administrationRoute?.toLowerCase() === 'topical' || administrationMethod === 'topical') {
      return 1
    }

    const isTabletOrCapsule = administrationMethod === 'tablets' || administrationMethod === 'capsules'
    if (!isTabletOrCapsule || service.dosePerKg == null || isNaN(bodyWeight) || bodyWeight <= 0) {
      return null
    }

    const rawMg = service.dosePerKg * bodyWeight
    const netContent = service.netContent
    const durationDays = service.duration
    let dosesPerDay: number | null = service.frequency ?? null
    if (!dosesPerDay && service.frequencyLabel) {
      const everyHoursMatch = service.frequencyLabel.match(/every\s+(\d+(?:\.\d+)?)\s+hours?/i)
      if (everyHoursMatch) dosesPerDay = 24 / parseFloat(everyHoursMatch[1])
      const timesPerDayMatch = service.frequencyLabel.match(/(\d+)\s+times?\s+per\s+day/i)
      if (timesPerDayMatch) dosesPerDay = parseInt(timesPerDayMatch[1])
    }
    if (netContent && netContent > 0 && dosesPerDay && durationDays) {
      return Math.ceil((rawMg / netContent) * dosesPerDay * durationDays)
    }
    return null
  }

  const loadData = useCallback(async () => {
    if (!token) return
    const [recordRes, petRes, diagServicesRes, medServicesRes, prevCareServicesRes, deliveryServicesRes, histRes, medHistRes] = await Promise.all([
      getRecordById(recordId, token),
      getPetById(petId, token),
      getDiagnosticTestServices(token),
      getMedicationServices(token),
      getPreventiveCareServices(token),
      getPregnancyDeliveryServices(token),
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

      if (r.immunityTesting) {
        const savedSpecies = (r.immunityTesting.species || 'canine') as TiterSpecies
        setTiterEnabled(r.immunityTesting.enabled === true)
        setTiterSpecies(savedSpecies)
        setTiterKitName(r.immunityTesting.kitName || 'VCheck')
        setSkipTiterSuggested(r.immunityTesting.skipSuggested === true)
        if (Array.isArray(r.immunityTesting.rows) && r.immunityTesting.rows.length > 0) {
          setTiterRows(r.immunityTesting.rows.map((row) => {
            const score = typeof row.score === 'number' ? row.score : null
            const computed = computeTiterStatusAction(score)
            return {
              disease: row.disease,
              score,
              status: (row.status || computed.status) as TiterRow['status'],
              action: (row.action || computed.action) as TiterRow['action'],
            }
          }))
        } else {
          setTiterRows(buildTiterRows(savedSpecies))
        }
        if (r.immunityTesting.antigenEnabled !== undefined) {
          setAntigenEnabled(r.immunityTesting.antigenEnabled === true)
        }
        if (Array.isArray(r.immunityTesting.antigenRows) && r.immunityTesting.antigenRows.length > 0) {
          setAntigenRows(r.immunityTesting.antigenRows.map((row) => ({
            disease: row.disease,
            result: (row.result || '') as AntigenRow['result'],
          })))
          const positives = r.immunityTesting.antigenRows
            .filter((row) => row.result === 'Positive')
            .map((row) => row.disease)
          if (positives.length > 0 && r.immunityTesting.antigenEnabled === true) {
            setVaccinationSkippedDue(positives)
          }
        }
      } else {
        setTiterEnabled(appointmentTiterFirst || hasTiterTestingService)
      }
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
        setPregnancyConfirmationMethod(r.pregnancyRecord.confirmationMethod || 'unknown')
        setPregnancyConfirmationSource(r.pregnancyRecord.confirmationSource || 'this_clinic')
        setPregnancyConfidence(r.pregnancyRecord.confidence || 'medium')
        setPregnancyNotes(r.pregnancyRecord.notes || '')
      } else if (petRes.data?.pet?.pregnancyStatus === 'pregnant') {
        // Pet is already pregnant from a previous record — auto-check and lock
        setUltrasoundPregnant(true)
        setPregnancyConfirmationMethod(medHistRes?.pregnancyEpisode?.latestConfirmationMethod || 'unknown')
        setPregnancyConfirmationSource(medHistRes?.pregnancyEpisode?.latestConfirmationSource || 'unknown')
        setPregnancyConfidence(medHistRes?.pregnancyEpisode?.confidence || 'low')
        if (medHistRes?.pregnancyEpisode?.expectedDueDate) {
          setExpectedDueDate(medHistRes.pregnancyEpisode.expectedDueDate.split('T')[0])
        }
        if (medHistRes?.pregnancyEpisode?.litterNumber != null) {
          setLitterNumber(String(medHistRes.pregnancyEpisode.litterNumber))
        }
      }
      if (r.pregnancyDelivery) {
        setPregnancyDelivery(true)
        setDeliveryDate(r.pregnancyDelivery.deliveryDate ? r.pregnancyDelivery.deliveryDate.split('T')[0] : '')
        // deliveryServiceId is restored after delivery services load in the services block below
        setLaborDuration(r.pregnancyDelivery.laborDuration || '')
        setLiveBirths(r.pregnancyDelivery.liveBirths != null ? String(r.pregnancyDelivery.liveBirths) : '')
        setStillBirths(r.pregnancyDelivery.stillBirths != null ? String(r.pregnancyDelivery.stillBirths) : '')
        setMotherCondition(r.pregnancyDelivery.motherCondition || 'stable')
        setDeliveryVetRemarks(r.pregnancyDelivery.vetRemarks || '')
        setDeliveryLocation(r.pregnancyDelivery.deliveryLocation || 'in_clinic')
        setDeliveryReportedBy(r.pregnancyDelivery.reportedBy || 'vet')
      }
      if ((r as any).pregnancyLoss) {
        const pl = (r as any).pregnancyLoss
        setPregnancyLoss(true)
        setLossDate(pl.lossDate ? pl.lossDate.split('T')[0] : '')
        setLossType(pl.lossType || 'miscarriage')
        setGestationalAgeAtLoss(pl.gestationalAgeAtLoss != null ? String(pl.gestationalAgeAtLoss) : '')
        setLossNotes(pl.notes || '')
        setLossReportedBy(pl.reportedBy || 'vet')
      }
      
      const autoPreventiveCare = derivePreventiveCareFromAppointment(
        appointmentTypes,
        prevCareServicesRes.status === 'SUCCESS' && prevCareServicesRes.data?.items ? prevCareServicesRes.data.items : [],
        appointmentDate,
      )
      if ((!r.preventiveCare || r.preventiveCare.length === 0) && autoPreventiveCare.length > 0) {
        setPreventiveCare(autoPreventiveCare)
      } else {
        // Normalize old 'Flea and Tick Prevention' to new 'Flea & Tick Prevention'
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const normalizedCare = (r.preventiveCare || []).map(({ _id, ...rest }: Omit<PreventiveCare, '_id'> & { _id?: string }) => ({
          ...rest,
          product: rest.product === 'Flea and Tick Prevention' ? 'Flea & Tick Prevention' : rest.product
        }))
        setPreventiveCare(normalizedCare)
      }
      setSharedWithOwner(r.sharedWithOwner ?? true)
      if (r.preventiveAssociatedExclusions?.length) {
        setPreventiveAssociatedExclusions(new Set(r.preventiveAssociatedExclusions))
      }

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
        ? { pre_procedure: 1, in_procedure: 2, post_procedure: 4, confined: 4, completed: 4 }
        : { pre_procedure: 1, in_procedure: 2, post_procedure: 3, confined: 3, completed: 3 }
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
      setRecordStage(r.stage)
      // 'confined' records have already had their appointment closed — treat them the same
      // as 'completed' for the purpose of not re-closing the appointment on subsequent saves.
      setAlreadyCompleted(r.stage === 'completed' || r.stage === 'confined')
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
      const autoSpecies: TiterSpecies = loadedPet.species === 'feline' ? 'feline' : 'canine'
      setTiterSpecies((prev) => {
        if (prev !== autoSpecies) {
          setTiterRows(buildTiterRows(autoSpecies))
          setAntigenRows(buildAntigenRows(autoSpecies))
        }
        return autoSpecies
      })
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
    if (DEBUG_PREVENTIVE_INJECTION_MAPPING && typeof window !== 'undefined') {
      console.log('[PreventiveInjectionDebug] Loaded service catalogs', {
        medicationServicesLoaded: medServicesRes.status === 'SUCCESS' ? (medServicesRes.data?.items?.length || 0) : 0,
        preventiveServicesLoaded: prevCareServicesRes.status === 'SUCCESS' ? (prevCareServicesRes.data?.items?.length || 0) : 0,
        medicationInjectionSamples:
          medServicesRes.status === 'SUCCESS'
            ? (medServicesRes.data?.items || [])
                .filter((service) => String(service.administrationRoute || '').toLowerCase() === 'injection')
                .slice(0, 10)
                .map((service) => ({
                  _id: service._id,
                  name: service.name,
                  associatedServiceId: getAssociatedServiceIdValue(service),
                  type: service.type,
                  category: service.category,
                  administrationRoute: service.administrationRoute,
                  injectionPricingType: service.injectionPricingType,
                }))
            : [],
      })
    }
    if (deliveryServicesRes.status === 'SUCCESS' && deliveryServicesRes.data?.items) {
      setPregnancyDeliveryServices(deliveryServicesRes.data.items)
      // Restore saved delivery service from existing record
      const savedDeliveryType = recordRes.data?.record?.pregnancyDelivery?.deliveryType
      if (savedDeliveryType) {
        const match = deliveryServicesRes.data.items.find((s: ProductService) =>
          s.name.toLowerCase() === savedDeliveryType.toLowerCase()
        )
        if (match) setDeliveryServiceId(match._id)
      }
    }
  }, [recordId, petId, token, isVaccinationAppt, hasTiterTestingService, isSurgeryAppt, appointmentId, appointmentTypes, appointmentDate, appointmentTiterFirst])

  useEffect(() => {
    loadData()
  }, [loadData])

  const inferPregnancyMethodFromDiagnostics = () => {
    const hasUltrasoundTest = diagnosticTests.some(
      (t) => t.testType === 'ultrasound' || t.name.toLowerCase().includes('ultrasound')
    )
    if (hasUltrasoundTest) return 'ultrasound' as const

    const hasPalpation = diagnosticTests.some((t) => {
      const text = `${t.name || ''} ${t.result || ''} ${t.notes || ''}`.toLowerCase()
      return text.includes('palpation') || text.includes('abdominal palpation')
    })
    if (hasPalpation) return 'abdominal_palpation' as const

    const hasClinicalObservation = diagnosticTests.some((t) => {
      const text = `${t.name || ''} ${t.result || ''} ${t.notes || ''}`.toLowerCase()
      return text.includes('clinical observation') || text.includes('pregnan') || text.includes('gravid') || text.includes('fetal')
    })
    if (hasClinicalObservation) return 'clinical_observation' as const

    return 'unknown' as const
  }

  const hasPregnancyEvidence = () => {
    return inferPregnancyMethodFromDiagnostics() !== 'unknown' || pet?.pregnancyStatus === 'pregnant' || pregnancyConfirmationMethod !== 'unknown'
  }

  // Gestation age in days (from gestationDate to today)
  const getGestationAgeDays = (): number | null => {
    if (!gestationDate) return null
    const start = new Date(gestationDate)
    if (isNaN(start.getTime())) return null
    return Math.floor((Date.now() - start.getTime()) / 86400000)
  }

  // Species-appropriate due date suggestion (midpoint: canine ~63d, feline ~63d)
  const suggestDueDate = (fromDate: string): string => {
    const d = new Date(fromDate)
    if (isNaN(d.getTime())) return ''
    d.setDate(d.getDate() + 63)
    return d.toISOString().split('T')[0]
  }

  // Date validation errors
  const pregnancyDateError = (): string | null => {
    if (gestationDate && expectedDueDate) {
      if (new Date(expectedDueDate) <= new Date(gestationDate)) {
        return 'Expected due date must be after the gestation date'
      }
    }
    return null
  }

  const deliveryDateError = (): string | null => {
    if (deliveryDate && gestationDate) {
      if (new Date(deliveryDate) < new Date(gestationDate)) {
        return 'Delivery date cannot be before the gestation date'
      }
    }
    if (deliveryDate && new Date(deliveryDate) > new Date()) {
      return 'Delivery date cannot be in the future'
    }
    return null
  }

  // Auto-populate preventive care based on appointment-selected preventive services
  useEffect(() => {
    if (!appointmentDate || preventiveCare.length > 0) return
    const autoPop = derivePreventiveCareFromAppointment(appointmentTypes, preventiveCareServices, appointmentDate)
    if (autoPop.length > 0) {
      setPreventiveCare(autoPop)
    }
  }, [appointmentDate, appointmentTypes, preventiveCare.length, preventiveCareServices])

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
  const buildImmunityTestingPayload = () => {
    if (!showTiterSection && !showAntigenSection) return null
    const lockedSpecies = patientTiterSpecies
    const scoreByDisease = new Map(titerRows.map((row) => [row.disease, row.score]))
    const normalizedRows = buildTiterRows(lockedSpecies).map((row) => {
      const score = scoreByDisease.has(row.disease) ? (scoreByDisease.get(row.disease) ?? null) : null
      const computed = computeTiterStatusAction(score)
      return {
        disease: row.disease,
        score,
        status: computed.status,
        action: computed.action,
      }
    })

    const positiveCount = normalizedRows.filter((row) => row.status === 'Positive').length
    const vaccinateFor = normalizedRows.filter((row) => row.action === 'Vaccinate').map((row) => row.disease)
    const titerDate = new Date().toISOString().split('T')[0]
    const speciesLabel = lockedSpecies === 'canine' ? 'Canine' : 'Feline'
    const planLine = vaccinateFor.length > 0
      ? `Retest ${vaccinateFor.join(', ')} in 7 days.`
      : 'Cleared to vaccinate.'
    const summary = `# Positive: ${positiveCount}/3 | Vaccinate for: ${vaccinateFor.length > 0 ? vaccinateFor.join(', ') : 'None'}`
    const markdown = [
      `Titer: ${titerDate} (${speciesLabel} ${titerKitName || 'VCheck'})`,
      '| Disease | Score | Status | Action |',
      '|---------|-------|--------|--------|',
      ...normalizedRows.map((row) => `| ${row.disease} | ${row.score ?? '-'} | ${row.status || '-'} | ${row.action || '-'} |`),
      `Plan: ${planLine}`,
    ].join('\n')

    const antigenDate = titerDate
    const antigenNormalizedRows = buildAntigenRows(lockedSpecies).map((row) => {
      const saved = antigenRows.find((r) => r.disease === row.disease)
      return { disease: row.disease, result: saved?.result || ('' as AntigenRow['result']) }
    })

    return {
      enabled: titerEnabled,
      species: lockedSpecies,
      kitName: titerKitName || 'VCheck',
      testDate: titerDate,
      rows: normalizedRows,
      positiveCount,
      summary,
      markdown,
      tag: `#titer-${lockedSpecies}-${titerDate}`,
      linkedAppointmentId: appointmentId || null,
      followUpAppointmentId: null,
      followUpDate: null,
      skipSuggested: skipTiterSuggested,
      antigenEnabled,
      antigenRows: antigenNormalizedRows,
      antigenDate,
    }
  }

  const mergePlanWithTiterMarkdown = (basePlan: string, immunityPayload: ReturnType<typeof buildImmunityTestingPayload>) => {
    const planText = (basePlan || '').trim()
    const sanitized = planText.includes('Immunity Testing\nTiter:')
      ? planText.split('Immunity Testing\nTiter:')[0].trimEnd()
      : planText

    if (!immunityPayload || immunityPayload.enabled !== true || skipTiterSuggested) {
      return sanitized
    }

    return `${sanitized}${sanitized ? '\n\n' : ''}Immunity Testing\n${immunityPayload.markdown}`
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
      const immunityPayload = buildImmunityTestingPayload()
      const effectivePlan = mergePlanWithTiterMarkdown(plan, immunityPayload)
      const selectedSurgery = isSurgeryAppt ? surgeryServices.find((s) => s._id === surgeryTypeId) : undefined
      
      // Combine all images: diagnostic test images + general images
      const allImages = [...diagImgs, ...images, ...titerImages]
      
      // Remove images from diagnostic tests before sending to API
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      
      await updateMedicalRecord(recordId, {
        chiefComplaint,
        vitals,
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan: effectivePlan,
        immunityTesting: immunityPayload,
        visitSummary,
        medications,
        diagnosticTests: diagnosticTestsToSend,
        preventiveCare,
        preventiveAssociatedExclusions: [...preventiveAssociatedExclusions],
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
        syncBillingFromRecord({
          billingId,
          petId,
          medications,
          diagnosticTests: diagnosticTestsToSend,
          preventiveCare,
          recordCreatedAt,
          token,
          recordVaccinations: vaccines.filter(v => v.vaccineCreated && v.vaccineTypeId).map(v => ({ vaccineTypeId: v.vaccineTypeId, vaccineName: vaccineTypes.find(vt => vt._id === v.vaccineTypeId)?.name || '', _id: v.createdVaccineId })),
          titerEnabled: titerEnabled && !skipTiterSuggested,
          deliveryServiceName: pregnancyDelivery ? (pregnancyDeliveryServices.find(s => s._id === deliveryServiceId)?.name || '') : undefined,
          appointmentTypes,
          petSpecies: pet?.species,
          petWeightKg: parseFloat(String(vitals?.weight?.value ?? '')) || undefined,
          preventiveExclusions: [...preventiveAssociatedExclusions],
        }).catch((e) => console.error('[BillingSync] Frontend billing sync error:', e))
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
    const hasEvidence = hasPregnancyEvidence()
    const alreadyPregnant = pet?.pregnancyStatus === 'pregnant'
    const inferredMethod = inferPregnancyMethodFromDiagnostics()
    const effectiveMethod = pregnancyConfirmationMethod === 'unknown' ? inferredMethod : pregnancyConfirmationMethod
    const effectiveConfidence = effectiveMethod === 'ultrasound' ? 'high' : pregnancyConfidence
    const resolvedDeliveryType = pregnancyDeliveryServices.find(s => s._id === deliveryServiceId)?.name || ''

    // When loss is recorded, override pregnancyRecord.isPregnant to false
    const effectiveIsPregnant = pregnancyLoss ? false : ultrasoundPregnant

    return {
      ...((hasEvidence || alreadyPregnant || pregnancyLoss) ? {
        pregnancyRecord: {
          isPregnant: effectiveIsPregnant,
          gestationDate: effectiveIsPregnant && gestationDate ? gestationDate : null,
          expectedDueDate: effectiveIsPregnant && expectedDueDate ? expectedDueDate : null,
          litterNumber: effectiveIsPregnant && litterNumber ? parseInt(litterNumber) : null,
          confirmationMethod: effectiveIsPregnant ? effectiveMethod : 'unknown',
          confirmationSource: effectiveIsPregnant ? pregnancyConfirmationSource : 'unknown',
          confidence: effectiveIsPregnant ? effectiveConfidence : 'low',
          confirmedAt: effectiveIsPregnant ? new Date().toISOString() : null,
          notes: pregnancyNotes,
        },
      } : {}),
      ...(pregnancyDelivery ? {
        pregnancyDelivery: {
          deliveryDate: deliveryDate || null,
          deliveryType: resolvedDeliveryType,
          laborDuration,
          liveBirths: parseInt(liveBirths) || 0,
          stillBirths: parseInt(stillBirths) || 0,
          motherCondition,
          vetRemarks: deliveryVetRemarks,
          deliveryLocation,
          reportedBy: deliveryReportedBy,
        },
      } : {}),
      ...(pregnancyLoss ? {
        pregnancyLoss: {
          lossDate: lossDate || null,
          lossType,
          gestationalAgeAtLoss: gestationalAgeAtLoss ? parseInt(gestationalAgeAtLoss) : null,
          notes: lossNotes,
          reportedBy: lossReportedBy,
        },
      } : {}),
    }
  }

  const syncPregnancyStatus = async () => {
    const hasEvidence = hasPregnancyEvidence()
    if (pregnancyDelivery || pregnancyLoss) {
      await updatePetPregnancyStatus(petId, 'not_pregnant', token!)
    } else if (hasEvidence && ultrasoundPregnant) {
      await updatePetPregnancyStatus(petId, 'pregnant', token!)
    }
  }

  const getEffectiveLitterNumber = (): number | null => {
    if (ultrasoundPregnant && litterNumber) return parseInt(litterNumber)
    if (medHistoryData?.pregnancyEpisode?.litterNumber != null) return medHistoryData.pregnancyEpisode.litterNumber
    if (previousRecord?.pregnancyRecord?.isPregnant && previousRecord.pregnancyRecord.litterNumber != null) {
      return previousRecord.pregnancyRecord.litterNumber
    }
    return null
  }

  const handleProceedStep2 = async () => {
    if (!token) return

    if (ultrasoundPregnant && pregnancyConfirmationMethod === 'unknown' && inferPregnancyMethodFromDiagnostics() === 'unknown') {
      toast.error('Please select a pregnancy confirmation method')
      return
    }

    // Validate delivery birth counts match litter number
    if (pregnancyDelivery) {
      const effectiveLitterNumber = getEffectiveLitterNumber()
      if (effectiveLitterNumber != null) {
        const totalBirths = (parseInt(liveBirths) || 0) + (parseInt(stillBirths) || 0)
        if (totalBirths !== effectiveLitterNumber) {
          toast.error(`Total births (${totalBirths}) must equal the litter number (${effectiveLitterNumber})`)
          return
        }
      }
    }

    // Validate SOAP notes are filled
    if (!subjective.trim() || !objective.trim() || !assessment.trim() || !plan.trim()) {
      toast.error('Please fill in all SOAP notes (Subjective, Objective, Assessment, Plan) before proceeding')
      return
    }

    const immunityPayload = buildImmunityTestingPayload()
    const hasUnscoredTiter = titerEnabled && !skipTiterSuggested && (immunityPayload?.rows || []).some((row) => row.score === null)
    if (hasUnscoredTiter) {
      toast.error('Please complete all titer scores before proceeding')
      return
    }

    if (antigenEnabled) {
      const unscoredAntigen = antigenRows.some((r) => r.result === '')
      if (unscoredAntigen) {
        toast.error('Please select a result for all 3-in-1 Antigen Test diseases before proceeding')
        return
      }
    }

    const positiveAntigenDiseases = antigenEnabled
      ? antigenRows.filter((r) => r.result === 'Positive').map((r) => r.disease)
      : []
    const antigenSkipsVaccination = positiveAntigenDiseases.length > 0
    
    setSaving(true)
    try {
      const { action: confinementAction, days: confinementDays } = await syncConfinement()
      const diagImgs = buildDiagnosticTestImages()
      const allImages = [...diagImgs, ...images, ...titerImages]
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      const effectivePlan = mergePlanWithTiterMarkdown(plan, immunityPayload)
      
      await updateMedicalRecord(recordId, {
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan: effectivePlan,
        immunityTesting: immunityPayload,
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
      if (isVaccinationAppt && antigenSkipsVaccination) {
        setVaccinationSkippedDue(positiveAntigenDiseases)
        setStep(4)
      } else {
        setStep(3)
      }
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
      const seenCreatedIds = new Set<string>()
      let duplicateIdDetected = false
      for (const v of vaccines) {
        let current = v

        // Safety: if two rows point to the same existing vaccination record,
        // treat later duplicates as NEW rows to avoid overwriting the first row's schedule.
        if (current.createdVaccineId) {
          if (seenCreatedIds.has(current.createdVaccineId)) {
            duplicateIdDetected = true
            current = {
              ...current,
              vaccineCreated: false,
              createdVaccineId: null,
            }
          } else {
            seenCreatedIds.add(current.createdVaccineId)
          }
        }

        if (!current.vaccineTypeId) { updated.push(current); continue }
        // Skip ineligible vaccines
        const vt = vaccineTypes.find((x) => x._id === current.vaccineTypeId)
        if (vt && pet?.dateOfBirth) {
          const validation = validateVaccineAge(pet.dateOfBirth, vt.minAgeMonths || 0, vt.maxAgeMonths || null)
          if (!validation.isValid) { updated.push(current); continue }
        }
        if (!current.vaccineCreated) {
          try {
            const res = await createVaccination({
              petId,
              vaccineTypeId: current.vaccineTypeId,
              manufacturer: current.manufacturer || undefined,
              batchNumber: current.batchNumber || undefined,
              route: current.route || undefined,
              dateAdministered: current.dateAdministered,
              notes: current.notes || undefined,
              nextDueDate: current.nextDueDate || undefined,
              medicalRecordId: recordId,
              appointmentId: appointmentId || undefined,
              clinicId: clinicId || undefined,
              clinicBranchId: clinicBranchId || undefined,
              doseNumber: current.doseNumber,
            }, token)
            if (res.boosterDate) {
              const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              toast.success(`${vt?.name || 'Vaccination'} saved! Next booster auto-scheduled for ${d}.`)
            }
            updated.push({ ...current, vaccineCreated: true, createdVaccineId: res._id })
          } catch (err) {
            console.error('Vaccination creation error:', err)
            updated.push(current)
          }
        } else if (current.createdVaccineId) {
          try {
            await updateVaccination(current.createdVaccineId, {
              vaccineTypeId: current.vaccineTypeId,
              manufacturer: current.manufacturer || undefined,
              batchNumber: current.batchNumber || undefined,
              route: current.route || undefined,
              dateAdministered: current.dateAdministered,
              notes: current.notes || undefined,
              nextDueDate: current.nextDueDate || undefined,
            }, token)
          } catch (err) {
            console.error('Vaccination update error:', err)
          }
          updated.push(current)
        } else {
          updated.push(current)
        }
      }
      if (duplicateIdDetected) {
        toast.message('Duplicate vaccine rows were detected and saved as separate schedules.')
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

    if (ultrasoundPregnant && pregnancyConfirmationMethod === 'unknown' && inferPregnancyMethodFromDiagnostics() === 'unknown') {
      toast.error('Please select a pregnancy confirmation method')
      return
    }

    const pregDateErr = pregnancyDateError()
    if (pregDateErr) {
      toast.error(pregDateErr)
      return
    }

    const delivDateErr = deliveryDateError()
    if (delivDateErr) {
      toast.error(delivDateErr)
      return
    }

    // Validate delivery birth counts match litter number
    if (pregnancyDelivery) {
      const effectiveLitterNumber = getEffectiveLitterNumber()
      if (effectiveLitterNumber != null) {
        const totalBirths = (parseInt(liveBirths) || 0) + (parseInt(stillBirths) || 0)
        if (totalBirths !== effectiveLitterNumber) {
          toast.error(`Total births (${totalBirths}) must equal the litter number (${effectiveLitterNumber})`)
          return
        }
      }
    }

    setCompleting(true)
    try {
      // Ensure vaccination is saved (with nextDueDate) before completing so the booster gets scheduled
      if (isVaccinationAppt) await trySaveVaccinations()

      const { action: confinementAction, days: confinementDays } = await syncConfinement()

      // When the pet is marked as confined the appointment closes but the medical record
      // stays open (stage = 'confined') so billing can continue during the stay.
      // When the confined toggle is turned off on a previously-confined record the record
      // moves to 'completed' and the confinement period ends.
      const targetStage: 'confined' | 'completed' = confined ? 'confined' : 'completed'

      // Ensure preventiveCare items have correct careType mapping
      const sanitizedPreventiveCare = preventiveCare.map((care) => ({
        careType: mapProductToCareType(care.product),
        product: care.product,
        dateAdministered: care.dateAdministered,
        notes: care.notes,
      }))

      // Extract diagnostic test images and combine with general images
      const diagImgs = buildDiagnosticTestImages()
      const allImages = [...diagImgs, ...images, ...titerImages]
      const diagnosticTestsToSend = diagnosticTests.map(({ images: _images, ...rest }) => rest)
      const immunityPayload = buildImmunityTestingPayload()
      const effectivePlan = mergePlanWithTiterMarkdown(plan, immunityPayload)

      await updateMedicalRecord(recordId, {
        stage: targetStage,
        visitSummary,
        plan: effectivePlan,
        immunityTesting: immunityPayload,
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
        // Compute live confinement days from confinedSince for the running-bill line item
        const liveConfinementDays = confined && pet?.confinedSince
          ? Math.max(1, Math.ceil((Date.now() - new Date(pet.confinedSince).getTime()) / 86_400_000))
          : confinementDays
        syncBillingFromRecord({
          billingId, petId, medications, diagnosticTests: diagnosticTestsToSend,
          preventiveCare: sanitizedPreventiveCare, recordCreatedAt, token,
          recordVaccinations: vaccines.filter(v => v.vaccineCreated && v.vaccineTypeId).map(v => ({
            vaccineTypeId: v.vaccineTypeId,
            vaccineName: vaccineTypes.find(vt => vt._id === v.vaccineTypeId)?.name || '',
            _id: v.createdVaccineId,
          })),
          titerEnabled: titerEnabled && !skipTiterSuggested,
          deliveryServiceName: pregnancyDelivery ? (pregnancyDeliveryServices.find(s => s._id === deliveryServiceId)?.name || '') : undefined,
          appointmentTypes,
          confinementAction: confinementAction || 'none',
          confinementDays: liveConfinementDays,
        }).catch(() => {})
      }
      await syncPregnancyStatus()
      // Close the appointment on first completion (confined or fully completed).
      // alreadyCompleted is true when we are re-saving a record that was already
      // in 'confined' stage, so we skip the appointment update to avoid duplicates.
      if (!alreadyCompleted && appointmentId) {
        await updateAppointmentStatus(appointmentId, 'completed', token)
      }
      await handleSaveNotes()
      setHistoryRefresh(prev => prev + 1)
      setShowCompleteConfirm(false)
      if (targetStage === 'confined') {
        toast.success(recordStage === 'confined' ? 'Confinement record updated!' : 'Pet admitted. Visit closed, record stays open.')
      } else {
        toast.success('Visit completed!')
      }
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

  const handleTiterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        setTiterImages((prev) => [...prev, {
          data: base64,
          contentType: file.type,
          description: `Titer cassette - ${file.name}`,
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
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

  const updateAllVitalNotes = (value: string) => {
    setVitals((prev) => {
      const updated = { ...prev }
      REQUIRED_VITAL_KEYS.forEach((key) => {
        updated[key] = {
          ...prev[key],
          notes: value,
        }
      })
      return updated
    })
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
              const icons = isVaccinationAppt ? VACC_STEP_ICONS : isSurgeryAppt ? SURG_STEP_ICONS : REG_STEP_ICONS as Record<StepKey, ReactNode>
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  {(() => {
                    const isSkippedVaccStep = isVaccinationAppt && s === 3 && vaccinationSkippedDue.length > 0 && s < step
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSkippedVaccStep
                          ? 'bg-red-100 text-red-700'
                          : s === step
                          ? 'bg-[#476B6B] text-white'
                          : s < step
                          ? 'bg-[#7FA5A3]/20 text-[#476B6B]'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isSkippedVaccStep ? <X className="w-3 h-3" /> : s < step ? <CheckCircle className="w-3 h-3" /> : icons[s]}
                        <span className="hidden sm:inline">{isSkippedVaccStep ? 'Vaccination Skipped' : labels[s]}</span>
                        <span className="sm:hidden">{s}</span>
                      </div>
                    )
                  })()}
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
                        <div key={key} className="pt-3 first:pt-0 border-t border-gray-50 first:border-0">
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
                          {vitalsErrors[key] ? (
                            <p className="text-xs text-[#900B09] -mt-1">{vitalsErrors[key]}</p>
                          ) : showRequiredErrors && !vitals[key]?.value && vitals[key]?.value !== 0 ? (
                            <p className="text-xs text-[#900B09] -mt-1">This field is required</p>
                          ) : null}
                        </div>
                      )
                    })}

                    <div className="pt-3 border-t border-gray-50">
                      <label className="block text-xs text-gray-400 mb-1">Notes <span className="text-gray-300">(for all vitals)</span></label>
                      <input
                        type="text"
                        value={vitals.crt?.notes ?? ''}
                        onChange={(e) => updateAllVitalNotes(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                        placeholder="Add one note for all vitals"
                      />
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

              {/* ── TITER TESTING ── */}
              {showTiterSection && (
                <div className="border border-[#7FA5A3]/30 rounded-2xl overflow-hidden bg-[#f0f7f7]">
                  <div className="px-4 py-3 border-b border-[#7FA5A3]/20 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#476B6B]">Titer Testing</p>
                      <p className="text-[11px] text-[#5A7C7A]">Document titer immunity scores during procedure</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#2C3E2D]">
                      <input
                        type="checkbox"
                        checked={titerEnabled}
                        onChange={(e) => setTiterEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#476B6B]"
                      />
                      Perform Titer Test
                    </label>
                  </div>

                  {titerEnabled && (
                    <div className="px-4 py-3 space-y-3">
                      {allPetVaccinations.length > 0 && (
                        <label className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <input
                            type="checkbox"
                            checked={skipTiterSuggested}
                            onChange={(e) => setSkipTiterSuggested(e.target.checked)}
                            className="w-4 h-4 accent-amber-600"
                          />
                          Past titer/vaccine history found. Skip titer?
                        </label>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Species</label>
                          <input
                            type="text"
                            value={patientTiterSpecies === 'canine' ? 'Canine' : 'Feline'}
                            readOnly
                            disabled
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Test Kit</label>
                          <input
                            type="text"
                            value={titerKitName}
                            onChange={(e) => setTiterKitName(e.target.value)}
                            placeholder="VCheck"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                          />
                        </div>
                      </div>

                      {!skipTiterSuggested && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-2 py-1.5">Disease</th>
                                <th className="text-left px-2 py-1.5">Score (1–6)</th>
                                <th className="text-left px-2 py-1.5">Status</th>
                                <th className="text-left px-2 py-1.5">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {titerRows.map((row, idx) => {
                                const computed = computeTiterStatusAction(row.score)
                                return (
                                  <tr key={row.disease} className="border-t border-gray-100">
                                    <td className="px-2 py-1.5 font-medium text-gray-700">{row.disease}</td>
                                    <td className="px-2 py-1.5">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={row.score === null ? '' : String(row.score)}
                                        placeholder="1–6"
                                        onChange={(e) => {
                                          const raw = e.target.value.trim()
                                          if (raw === '') {
                                            setTiterRows((prev) => prev.map((item, j) =>
                                              j !== idx ? item : { ...item, score: null, status: '', action: '' }
                                            ))
                                            return
                                          }
                                          const num = parseInt(raw, 10)
                                          if (isNaN(num) || num < 1 || num > 6 || String(num) !== raw) return
                                          const next = computeTiterStatusAction(num)
                                          setTiterRows((prev) => prev.map((item, j) =>
                                            j !== idx ? item : { ...item, score: num, status: next.status, action: next.action }
                                          ))
                                        }}
                                        className="w-16 border border-gray-200 rounded px-2 py-1 bg-white text-center focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                                      />
                                    </td>
                                    <td className={`px-2 py-1.5 font-medium ${computed.status === 'Positive' ? 'text-green-600' : computed.status === 'Negative' ? 'text-red-600' : 'text-gray-400'}`}>
                                      {computed.status || '-'}
                                    </td>
                                    <td className="px-2 py-1.5 text-gray-700">{computed.action || '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 border border-dashed border-gray-300 rounded-lg bg-white hover:border-[#7FA5A3] transition-colors">
                          <Upload className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600">Take/Upload cassette photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={handleTiterImageUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[11px] text-[#476B6B]">
                          # Positive: {(titerRows || []).filter((r) => (r.score ?? 0) >= 3).length}/3 |
                          {' '}Vaccinate for: {(titerRows || []).filter((r) => r.score !== null && (r.score ?? 7) < 3).map((r) => r.disease).join(', ') || 'None'}
                        </p>
                      </div>

                      {titerImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {titerImages.map((img, idx) => (
                            <div key={`${img.description}-${idx}`} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1">
                              <span className="text-[11px] text-gray-600">{img.description}</span>
                              <button
                                type="button"
                                onClick={() => setTiterImages((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── 3-IN-1 ANTIGEN TEST KIT ── */}
              {showAntigenSection && (
                <div className="border border-[#7FA5A3]/30 rounded-2xl overflow-hidden bg-[#f0f7f7]">
                  <div className="px-4 py-3 border-b border-[#7FA5A3]/20 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#476B6B]">3-in-1 Antigen Test Kit</p>
                      <p className="text-[11px] text-[#5A7C7A]">Record antigen test results — positive results will skip vaccination</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#2C3E2D]">
                      <input
                        type="checkbox"
                        checked={antigenEnabled}
                        onChange={(e) => setAntigenEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#476B6B]"
                      />
                      Perform Antigen Test
                    </label>
                  </div>

                  {antigenEnabled && (
                    <div className="px-4 py-3 space-y-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Species</label>
                        <input
                          type="text"
                          value={patientTiterSpecies === 'canine' ? 'Canine' : 'Feline'}
                          readOnly
                          disabled
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-2 py-1.5">Disease</th>
                              <th className="text-left px-2 py-1.5">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {antigenRows.map((row, idx) => (
                              <tr key={row.disease} className="border-t border-gray-100">
                                <td className="px-2 py-1.5 font-medium text-gray-700">{row.disease}</td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={row.result}
                                    onChange={(e) => {
                                      const result = e.target.value as AntigenRow['result']
                                      setAntigenRows((prev) => prev.map((item, j) =>
                                        j !== idx ? item : { ...item, result }
                                      ))
                                    }}
                                    className={`border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] ${
                                      row.result === 'Positive' ? 'border-red-300 text-red-700' :
                                      row.result === 'Negative' ? 'border-green-300 text-green-700' :
                                      'border-gray-200 text-gray-500'
                                    }`}
                                  >
                                    <option value="">Select</option>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {antigenRows.some((r) => r.result === 'Positive') && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          Vaccination will be skipped due to positive result for: <strong>{antigenRows.filter((r) => r.result === 'Positive').map((r) => r.disease).join(', ')}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                          <DropdownField
                            value={test.name}
                            onValueChange={(name) => {
                              const isUltrasound = name.toLowerCase().includes('ultrasound')
                              setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, name, testType: isUltrasound ? 'ultrasound' : 'other' } : t))
                            }}
                            placeholder="Select a diagnostic test service"
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] w-full"
                            options={[
                              { value: '', label: 'Select a diagnostic test service' },
                              ...diagnosticTestServices
                                .filter((service) =>
                                  !(showTiterSection && isTiterTestingService(service.name)) &&
                                  !(showAntigenSection && isAntigenTestService(service.name))
                                )
                                .map((service) => ({
                                  value: service.name,
                                  label: `${service.name}${service.price ? ` (₱${service.price})` : ''}`,
                                })),
                            ]}
                          />
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

              {/* ── PREGNANCY ASSESSMENT ── */}
              {pet?.sex === 'female' && pet?.sterilization !== 'spayed' && (
                <div className="border border-green-100 rounded-2xl overflow-hidden bg-green-50/30">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-green-100">
                    <span className="text-sm font-semibold text-green-700">Pregnancy Assessment</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    {pet?.pregnancyStatus === 'pregnant' && (
                      <p className="text-xs text-green-700 bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                        This pet is already recorded as pregnant. Pregnancy status is locked until delivery is recorded.
                      </p>
                    )}
                    <label className={`flex items-center gap-2 ${pet?.pregnancyStatus === 'pregnant' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={ultrasoundPregnant}
                        onChange={(e) => { if (pet?.pregnancyStatus !== 'pregnant') setUltrasoundPregnant(e.target.checked) }}
                        disabled={pet?.pregnancyStatus === 'pregnant'}
                        className="w-4 h-4 accent-green-600 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm text-gray-700 font-medium">Pet is Pregnant</span>
                    </label>
                    {ultrasoundPregnant && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Confirmation Method</label>
                            <DropdownField
                              value={pregnancyConfirmationMethod}
                              onValueChange={(value) => setPregnancyConfirmationMethod(value as 'ultrasound' | 'abdominal_palpation' | 'clinical_observation' | 'external_documentation' | 'unknown')}
                              placeholder="Select method"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                              options={[
                                { value: 'unknown', label: 'Unknown / Not specified' },
                                { value: 'ultrasound', label: 'Ultrasound' },
                                { value: 'abdominal_palpation', label: 'Abdominal Palpation' },
                                { value: 'clinical_observation', label: 'Clinical Observation' },
                                { value: 'external_documentation', label: 'External Documentation' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Confirmation Source</label>
                            <DropdownField
                              value={pregnancyConfirmationSource}
                              onValueChange={(value) => setPregnancyConfirmationSource(value as 'this_clinic' | 'external_clinic' | 'owner_reported' | 'inferred' | 'unknown')}
                              placeholder="Select source"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                              options={[
                                { value: 'this_clinic', label: 'This Clinic' },
                                { value: 'external_clinic', label: 'External Clinic' },
                                { value: 'owner_reported', label: 'Owner Reported' },
                                { value: 'inferred', label: 'Inferred from Records' },
                                { value: 'unknown', label: 'Unknown' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Confidence</label>
                            <DropdownField
                              value={pregnancyConfidence}
                              onValueChange={(value) => setPregnancyConfidence(value as 'high' | 'medium' | 'low')}
                              placeholder="Select confidence"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                              options={[
                                { value: 'high', label: 'High' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'low', label: 'Low' },
                              ]}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-500">Gestation Date</label>
                            {(() => { const days = getGestationAgeDays(); return days !== null && days >= 0 ? <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{days}d pregnant</span> : null })()}
                          </div>
                          <DatePicker
                            value={gestationDate}
                            onChange={(value) => {
                              setGestationDate(value)
                              if (value && !expectedDueDate) {
                                setExpectedDueDate(suggestDueDate(value))
                              }
                            }}
                            compact
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expected Due Date</label>
                          <DatePicker
                            value={expectedDueDate}
                            onChange={setExpectedDueDate}
                            allowFutureDates
                            compact
                            className="w-full"
                          />
                          {pregnancyDateError() && (
                            <p className="text-xs text-red-600 mt-1">{pregnancyDateError()}</p>
                          )}
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
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pregnancy Notes</label>
                          <textarea
                            rows={2}
                            value={pregnancyNotes}
                            onChange={(e) => setPregnancyNotes(e.target.value)}
                            placeholder="Supporting findings, signs, or provenance details…"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── PREGNANCY LOSS ── */}
                    {!pregnancyDelivery && (
                      <div className="border border-rose-100 rounded-xl overflow-hidden bg-rose-50/30 mt-2">
                        <div className="px-3 py-2 border-b border-rose-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pregnancyLoss}
                              onChange={(e) => {
                                setPregnancyLoss(e.target.checked)
                                if (e.target.checked) setUltrasoundPregnant(false)
                              }}
                              className="w-4 h-4 accent-rose-600"
                            />
                            <span className="text-xs font-semibold text-rose-700">Pregnancy Loss / Ended Without Delivery</span>
                          </label>
                        </div>
                        {pregnancyLoss && (
                          <div className="px-3 py-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Loss Date</label>
                                <DatePicker
                                  value={lossDate}
                                  onChange={setLossDate}
                                  compact
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Loss Type</label>
                                <DropdownField
                                  value={lossType}
                                  onValueChange={(v) => setLossType(v as typeof lossType)}
                                  placeholder="Select type"
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                                  options={[
                                    { value: 'miscarriage', label: 'Miscarriage' },
                                    { value: 'reabsorption', label: 'Reabsorption' },
                                    { value: 'abortion', label: 'Abortion / Termination' },
                                    { value: 'other', label: 'Other' },
                                  ]}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Gestational Age at Loss (days)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={gestationalAgeAtLoss}
                                  onChange={(e) => setGestationalAgeAtLoss(e.target.value)}
                                  placeholder="e.g. 30"
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Reported By</label>
                                <DropdownField
                                  value={lossReportedBy}
                                  onValueChange={(v) => setLossReportedBy(v as typeof lossReportedBy)}
                                  placeholder="Select"
                                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
                                  options={[
                                    { value: 'vet', label: 'Veterinarian' },
                                    { value: 'owner', label: 'Owner' },
                                    { value: 'external_vet', label: 'External Vet' },
                                    { value: 'unknown', label: 'Unknown' },
                                  ]}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Notes</label>
                              <textarea
                                rows={2}
                                value={lossNotes}
                                onChange={(e) => setLossNotes(e.target.value)}
                                placeholder="Clinical details, context, or observations…"
                                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400 resize-none"
                              />
                            </div>
                            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                              Recording a pregnancy loss will update the pet&apos;s pregnancy status to Not Pregnant.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PREGNANCY DELIVERY ── */}
              {pet?.sex === 'female' && pet?.sterilization !== 'spayed' && <div className="border border-blue-100 rounded-2xl overflow-hidden bg-blue-50/30">
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
                        <DatePicker
                          value={deliveryDate}
                          onChange={setDeliveryDate}
                          allowFutureDates
                          compact
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Delivery Type</label>
                        <DropdownField
                          value={deliveryServiceId}
                          onValueChange={setDeliveryServiceId}
                          placeholder="Select delivery type"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          options={pregnancyDeliveryServices.map(s => ({ value: s._id, label: s.name }))}
                        />
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
                        <DropdownField
                          value={motherCondition}
                          onValueChange={(value) => setMotherCondition(value as 'stable' | 'critical' | 'recovering')}
                          placeholder="Stable"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          options={[
                            { value: 'stable', label: 'Stable' },
                            { value: 'recovering', label: 'Recovering' },
                            { value: 'critical', label: 'Critical' },
                          ]}
                        />
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
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Delivery Location</label>
                        <DropdownField
                          value={deliveryLocation}
                          onValueChange={(value) => setDeliveryLocation(value as 'in_clinic' | 'outside_clinic' | 'unknown')}
                          placeholder="Select location"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          options={[
                            { value: 'in_clinic', label: 'In Clinic' },
                            { value: 'outside_clinic', label: 'Outside Clinic' },
                            { value: 'unknown', label: 'Unknown' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Reported By</label>
                        <DropdownField
                          value={deliveryReportedBy}
                          onValueChange={(value) => setDeliveryReportedBy(value as 'vet' | 'owner' | 'external_vet' | 'unknown')}
                          placeholder="Select reporter"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          options={[
                            { value: 'vet', label: 'Veterinarian' },
                            { value: 'owner', label: 'Owner' },
                            { value: 'external_vet', label: 'External Veterinarian' },
                            { value: 'unknown', label: 'Unknown' },
                          ]}
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
                    {(() => {
                      const effectiveLitterNumber = getEffectiveLitterNumber()
                      if (effectiveLitterNumber == null) return null
                      const totalBirths = (parseInt(liveBirths) || 0) + (parseInt(stillBirths) || 0)
                      const matched = totalBirths === effectiveLitterNumber
                      return (
                        <p className={`text-xs px-3 py-2 rounded-lg border ${matched ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                          {matched
                            ? `Total births match the litter number (${effectiveLitterNumber}).`
                            : `Total births (${totalBirths}) must equal the litter number (${effectiveLitterNumber}). Adjust live or still births.`}
                        </p>
                      )
                    })()}
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      Completing this visit will automatically update the pet&apos;s pregnancy status to <strong>Not Pregnant</strong>.
                    </p>
                    {motherCondition === 'critical' && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        A post-delivery follow-up appointment will be automatically scheduled in <strong>3 days</strong> due to critical maternal condition.
                      </p>
                    )}
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

              {/* ── Vaccination eligibility check ── */}
              {(() => {
                const temp = Number(vitals.temperature?.value || 0)
                const bcs = Number(vitals.bodyConditionScore?.value || 0)
                const isPregnant = pet?.pregnancyStatus === 'pregnant' || ultrasoundPregnant
                const issues: string[] = []

                if (temp > 0 && (temp > 39.17 || temp < 37.5)) {
                  issues.push(`Temperature ${temp}°C is outside safe range (37.5–39.17°C)`)
                }
                if (bcs > 0 && bcs < 3) {
                  issues.push(`Body condition score ${bcs}/5 is below minimum (3/5)`)
                }
                if (isPregnant) {
                  issues.push('Pet is pregnant')
                }

                if (issues.length === 0) return null

                return (
                  <div className="border border-red-200 rounded-2xl overflow-hidden bg-red-50/50">
                    <div className="px-4 py-2.5 flex items-center gap-2 border-b border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs font-semibold text-red-800">Vaccination Not Recommended</span>
                    </div>
                    <div className="px-4 py-3 space-y-1">
                      {issues.map((issue, idx) => (
                        <p key={idx} className="text-xs text-red-700 flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5">•</span> {issue}
                        </p>
                      ))}
                      <p className="text-[10px] text-red-600 mt-2 pt-1 border-t border-red-100">
                        The pet does not meet eligibility criteria. You may discard the vaccination and proceed to Post-Procedure below.
                      </p>
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
                  const doseInterval = vt ? getNextDueInterval(vt, v.doseNumber) : null
                  const nextDue = doseInterval != null && base
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

                  // Auto dose volume from pet species (overridden by vaccine type if set)
                  const displayDose = vt?.doseVolumeMl != null
                    ? `${vt.doseVolumeMl} mL`
                    : autoDoseVolume(pet?.species) || '—'

                  // View-only row for already-administered doses
                  if (isViewOnly) {
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                            <Syringe className="w-3.5 h-3.5" /> {vt?.name || 'Vaccine'}
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Previously Administered</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border bg-[#476B6B] text-white border-[#476B6B]">
                            {getDoseLabel(vt, v.doseNumber)} ✓
                          </span>
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
                      <DropdownField
                        value={v.vaccineTypeId}
                        onValueChange={(newVtId) => {
                          const newVt = vaccineTypes.find((x) => x._id === newVtId)
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
                          const autoNextDueDate = computeAutoNextDueDateString(newVt, nextDose, v.dateAdministered)
                          setVaccines((prev) => prev.map((item, j) => j === i ? {
                            ...item,
                            vaccineTypeId: newVtId,
                            doseNumber: nextDose,
                            manufacturer: newVt?.defaultManufacturer || item.manufacturer,
                            batchNumber: newVt?.defaultBatchNumber || item.batchNumber,
                            route: newVt?.route || item.route,
                            nextDueDate: autoNextDueDate,
                          } : item))
                        }}
                        placeholder="Select vaccine type…"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                        options={[
                          { value: '', label: 'Select vaccine type…' },
                          ...vaccineTypes.map((vt) => ({ value: vt._id, label: vt.name })),
                        ]}
                      />

                      {/* Dose timeline — extends boosters progressively without fixed cap */}
                      {vt && (() => {
                        const effectiveSeries = getEffectiveSeries(vt)
                        const maxPriorDose = Math.max(0, ...Array.from(priorAdministeredDoses))
                        const latestDose = Math.max(maxPriorDose, v.doseNumber)
                        const timelineLength = Math.max(effectiveSeries, latestDose + 1)
                        const doses = Array.from({ length: timelineLength }, (_, d) => d + 1)
                        return (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-2">Dose Timeline</p>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                              {doses.map((n, index) => {
                                const isDone = priorAdministeredDoses.has(n)
                                const isSelected = v.doseNumber === n
                                const isBooster = n > effectiveSeries
                                const label = getDoseLabel(vt, n)
                                return (
                                  <div key={n} className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isDone}
                                      onClick={() => !isDone && setVaccines((prev) => prev.map((item, j) => {
                                        if (j !== i) return item
                                        const nextDueDate = computeAutoNextDueDateString(vt, n, item.dateAdministered)
                                        return { ...item, doseNumber: n, nextDueDate }
                                      }))}
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                                        isDone
                                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                          : isSelected
                                            ? 'bg-[#476B6B] text-white border-[#476B6B]'
                                            : isBooster
                                              ? 'bg-[#C5D8FF] text-[#4569B1] border-[#8FAEE6] hover:border-[#4569B1]'
                                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                                      }`}
                                    >
                                      {label}{isDone ? ' ✓' : ''}
                                    </button>
                                    {index < doses.length - 1 && <div className="w-5 h-px bg-gray-300" />}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Next Due / Next Expiry badges */}
                      {vt && base && (
                        <div className="grid grid-cols-2 gap-2">
                          {nextDue && (
                            <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-lg p-2">
                              <p className="text-[9px] font-bold text-[#4569B1] uppercase tracking-wide">
                                {getEffectiveSeries(vt) > 1 && v.doseNumber < getEffectiveSeries(vt)
                                  ? 'Next Series Dose'
                                  : 'Next Booster Due'}
                              </p>
                              <p className="font-bold text-[#4569B1] text-xs mt-0.5">
                                {v.nextDueDate
                                  ? new Date(v.nextDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                }
                              </p>
                            </div>
                          )}
                          {vt.isSeries && expiry && (
                            <div className="bg-[#F4D3D2] border border-[#983232] rounded-lg p-2">
                              <p className="text-[9px] font-bold text-[#983232] uppercase tracking-wide">Next Expiry</p>
                              <p className="font-bold text-[#983232] text-xs mt-0.5">{expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pet eligibility indicator (age) */}
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
                        const showNextDueField = vt ? (vt.isSeries || vt.boosterValid) : false
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Date Administered <span className="text-[#900B09]">*</span></label>
                              <DatePicker
                                value={v.dateAdministered}
                                onChange={(value) => setVaccines((prev) => prev.map((item, j) => {
                                  if (j !== i) return item
                                  const nextDueDate = computeAutoNextDueDateString(vt, item.doseNumber, value)
                                  return { ...item, dateAdministered: value, nextDueDate }
                                }))}
                                maxDate={new Date()}
                                error={!!dateInFuture}
                                compact
                                className="w-full"
                              />
                              {dateInFuture && (
                                <p className="text-[10px] text-red-500 mt-0.5">Date cannot be in the future.</p>
                              )}
                            </div>
                            {showNextDueField && (
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">
                                  {vt?.isSeries && v.doseNumber < getEffectiveSeries(vt)
                                    ? 'Next Series Dose Date'
                                    : 'Next Booster Date'}
                                </label>
                                <DatePicker
                                  value={v.nextDueDate}
                                  onChange={(value) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, nextDueDate: value } : item))}
                                  minDate={v.dateAdministered ? (() => { const d = new Date(v.dateAdministered); d.setDate(d.getDate() + 1); return d })() : undefined}
                                  allowFutureDates
                                  error={!!nextDueInvalid}
                                  compact
                                  className="w-full"
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
                          <div className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-600 min-h-7.5 flex items-center font-medium">
                            {displayDose}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1">Route</label>
                          <DropdownField
                            value={v.route}
                            onValueChange={(value) => setVaccines((prev) => prev.map((item, j) => j === i ? { ...item, route: value } : item))}
                            placeholder="Route…"
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] bg-white"
                            options={[
                              { value: '', label: 'Route…' },
                              { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
                              { value: 'intramuscular', label: 'Intramuscular (IM)' },
                              { value: 'intranasal', label: 'Intranasal (IN)' },
                              { value: 'oral', label: 'Oral' },
                            ]}
                          />
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

              {/* Add Vaccine / Discard buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVaccines((prev) => [...prev, emptyVaccine()])}
                  className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Vaccine
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Discard vaccination: skip to post-procedure without saving any vaccine records
                    if (!token) return
                    setSaving(true)
                    try {
                      await updateMedicalRecord(recordId, { stage: 'post_procedure' }, token)
                      setHistoryRefresh(prev => prev + 1)
                      setStep(4)
                    } catch {
                      toast.error('Failed to proceed')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#900B09] font-medium border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Discard Vaccination
                </button>
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
                          <DropdownField
                            value={surgeryTypeId}
                            onValueChange={setSurgeryTypeId}
                            placeholder="Select surgery type…"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                            options={[
                              { value: '', label: 'Select surgery type…' },
                              ...surgeryServices.map((s) => ({ value: s._id, label: `${s.name}${s.price ? ` — ₱${s.price}` : ''}` })),
                            ]}
                          />
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
              {/* Vaccination skipped notice */}
              {isVaccinationAppt && vaccinationSkippedDue.length > 0 && (
                <div className="border border-red-200 rounded-2xl px-4 py-3 bg-red-50 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    <span className="font-semibold">Vaccination was skipped</span> due to pet being positive for:{' '}
                    <strong>{vaccinationSkippedDue.join(', ')}</strong>.
                  </p>
                </div>
              )}
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
                          <button onClick={() => {
                            setMedications((prev) => prev.filter((_, j) => j !== i))
                            setCapsuleWarnings((prev) => {
                              const next: Record<number, string> = {}
                              Object.entries(prev).forEach(([k, v]) => {
                                const ki = parseInt(k)
                                if (ki < i) next[ki] = v
                                else if (ki > i) next[ki - 1] = v
                              })
                              return next
                            })
                            setSelectedMedicationServiceIds((prev) => {
                              const next: Record<number, string> = {}
                              Object.entries(prev).forEach(([k, v]) => {
                                const ki = parseInt(k)
                                if (ki < i) next[ki] = v
                                else if (ki > i) next[ki - 1] = v
                              })
                              return next
                            })
                          }} className="text-[#900B09] hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(() => {
                          const selectedServiceId = selectedMedicationServiceIds[i] || ''
                          const medService =
                            (selectedServiceId
                              ? medicationServices.find((s) => String(s._id) === String(selectedServiceId))
                              : undefined) ||
                            resolveMedicationServiceForEntry(medicationServices, med)
                          const isTopical = medService?.administrationRoute?.toLowerCase() === 'topical' || medService?.administrationMethod?.toLowerCase() === 'topical'
                          const isInjectionMedication = isInjectionService(medService) || normalizeServiceToken(String(med.route || '')) === 'injection' || !!medService?.injectionPricingType
                          const bodyWeightVal = parseFloat(String(vitals?.weight?.value ?? ''))
                          const injectionDosageDisplay = deriveInjectionDosageDisplay(medService, bodyWeightVal)
                          const injectionPricingTypeLabel = formatInjectionPricingTypeLabel(medService?.injectionPricingType)
                          return (
                        <div className="grid grid-cols-2 gap-2">
                          <DropdownField
                            value={selectedServiceId || medService?._id || ''}
                            onValueChange={(selectedServiceId) => {
                              const selectedService = medicationServices.find((s) => String(s._id) === String(selectedServiceId))
                              setSelectedMedicationServiceIds((prev) => ({ ...prev, [i]: selectedServiceId }))
                              setMedications((prev) => prev.map((m, j) => {
                                if (j !== i) return m
                                // Auto-populate from service data when a medication is selected
                                if (selectedService) {
                                  const administrationMethod = selectedService.administrationMethod?.toLowerCase() ?? ''
                                  const administrationRoute = selectedService.administrationRoute?.toLowerCase() ?? ''
                                  const isTablet = administrationMethod === 'tablets'
                                  const isCapsule = administrationMethod === 'capsules'
                                  const isSyrup = administrationMethod === 'syrup'
                                  const isOralSyrup = administrationRoute === 'oral' && isSyrup
                                  const isSelectedInjection = administrationRoute === 'injection' || administrationMethod === 'injection' || !!selectedService.injectionPricingType
                                  const bodyWeight = parseFloat(String(vitals?.weight?.value ?? ''))
                                  let autoDosage = selectedService.dosageAmount || m.dosage
                                  let autoQuantity: number | null = null
                                  if (isTablet && selectedService.dosePerKg != null && !isNaN(bodyWeight) && bodyWeight > 0) {
                                    const rawMg = selectedService.dosePerKg * bodyWeight
                                    autoDosage = `${parseFloat(rawMg.toFixed(2))} mg`
                                    // quantity = ceil((mg dose / netContent per tablet) × doses per day × days)
                                    const netContent = selectedService.netContent
                                    const durationDays = selectedService.duration
                                    // Derive doses per day from numeric frequency, or parse frequencyLabel (e.g. "every 12 hours" → 2)
                                    let dosesPerDay: number | null = selectedService.frequency ?? null
                                    if (!dosesPerDay && selectedService.frequencyLabel) {
                                      const everyHoursMatch = selectedService.frequencyLabel.match(/every\s+(\d+(?:\.\d+)?)\s+hours?/i)
                                      if (everyHoursMatch) dosesPerDay = 24 / parseFloat(everyHoursMatch[1])
                                      const timesPerDayMatch = selectedService.frequencyLabel.match(/(\d+)\s+times?\s+per\s+day/i)
                                      if (timesPerDayMatch) dosesPerDay = parseInt(timesPerDayMatch[1])
                                    }
                                    if (netContent && netContent > 0 && dosesPerDay && durationDays) {
                                      autoQuantity = Math.ceil((rawMg / netContent) * dosesPerDay * durationDays)
                                    }
                                  } else if (isCapsule && selectedService.dosePerKg != null && !isNaN(bodyWeight) && bodyWeight > 0) {
                                    const rawMg = selectedService.dosePerKg * bodyWeight
                                    autoDosage = `${parseFloat(rawMg.toFixed(2))} mg`
                                    const netContent = selectedService.netContent
                                    const durationDays = selectedService.duration
                                    let dosesPerDay: number | null = selectedService.frequency ?? null
                                    if (!dosesPerDay && selectedService.frequencyLabel) {
                                      const everyHoursMatch = selectedService.frequencyLabel.match(/every\s+(\d+(?:\.\d+)?)\s+hours?/i)
                                      if (everyHoursMatch) dosesPerDay = 24 / parseFloat(everyHoursMatch[1])
                                      const timesPerDayMatch = selectedService.frequencyLabel.match(/(\d+)\s+times?\s+per\s+day/i)
                                      if (timesPerDayMatch) dosesPerDay = parseInt(timesPerDayMatch[1])
                                    }
                                    if (netContent && netContent > 0) {
                                      // Capsules cannot be split — pet must meet minimum weight for one capsule
                                      if (rawMg < netContent) {
                                        setCapsuleWarnings((prev) => ({ ...prev, [i]: `This pet's calculated dose (${parseFloat(rawMg.toFixed(2))} mg) is less than one capsule (${netContent} mg). This capsule may not be appropriate for this patient's weight.` }))
                                      } else {
                                        setCapsuleWarnings((prev) => { const next = { ...prev }; delete next[i]; return next })
                                        if (dosesPerDay && durationDays) {
                                          autoQuantity = Math.ceil((rawMg / netContent) * dosesPerDay * durationDays)
                                        }
                                      }
                                    }
                                  } else if (isOralSyrup && selectedService.dosePerKg != null && !isNaN(bodyWeight) && bodyWeight > 0) {
                                    const syrupDose = selectedService.dosePerKg * bodyWeight
                                    autoDosage = `${parseFloat(syrupDose.toFixed(2))} ${selectedService.doseUnit || 'mL'}`
                                    autoQuantity = 1
                                  } else if (isSyrup) {
                                    autoQuantity = 1
                                  } else if (administrationMethod === 'topical' || selectedService.administrationRoute?.toLowerCase() === 'topical') {
                                    autoQuantity = 1
                                  } else if (isInjectionService(selectedService) || selectedService.injectionPricingType) {
                                    const computedInjectionDosage = deriveInjectionDosageDisplay(selectedService, bodyWeight)
                                    if (computedInjectionDosage) autoDosage = computedInjectionDosage
                                    else if (selectedService.dosageAmount) autoDosage = selectedService.dosageAmount
                                  }
                                  const isSelectedTopical = administrationMethod === 'topical' || selectedService.administrationRoute?.toLowerCase() === 'topical'
                                  return {
                                    ...m,
                                    name: selectedService.name,
                                    dosage: autoDosage,
                                    route: (selectedService.administrationRoute as Medication['route']) || m.route,
                                    frequency: isSelectedInjection
                                      ? ''
                                      : isSelectedTopical
                                      ? (selectedService.frequencyNotes || m.frequency)
                                      : (selectedService.frequencyLabel || selectedService.frequency?.toString() || m.frequency),
                                    duration: isSelectedInjection
                                      ? ''
                                      : (selectedService.durationLabel || selectedService.duration?.toString() || m.duration),
                                    quantity: isSelectedInjection
                                      ? null
                                      : (selectedService.pricingType === 'pack' ? 1 : autoQuantity),
                                    pricingType: isSelectedInjection ? '' : (selectedService.pricingType || ''),
                                    piecesPerPack: selectedService.piecesPerPack ?? null,
                                  }
                                }
                                return m
                              }))
                            }}
                            placeholder="Select a medication"
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] w-full"
                            options={[
                              { value: '', label: 'Select a medication' },
                              ...medicationServices
                                .filter((service) => {
                                  // Keep injections with associated preventive service in Preventive Care; allow unassociated injections here
                                  if (String(service.administrationRoute || '').toLowerCase() === 'injection' && getAssociatedServiceIdValue(service)) return false
                                  return true
                                })
                                .map((service) => ({
                                  value: service._id,
                                  label: `${service.name}${service.price ? ` (₱${service.price})` : ''}`,
                                })),
                            ]}
                          />
                          {!isTopical && !isInjectionMedication && <input type="text" placeholder="Dosage (e.g. 10mg)" value={med.dosage} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />}
                          {isInjectionMedication && (
                            <input
                              type="text"
                              value={med.dosage || injectionDosageDisplay || ''}
                              onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))}
                              placeholder={injectionDosageDisplay || 'Calculated dosage'}
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            />
                          )}
                          {!isTopical && !isInjectionMedication && <DropdownField
                            value={med.route}
                            onValueChange={() => {}}
                            disabled
                            placeholder="Route"
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                            options={[
                              { value: 'oral', label: 'Oral' },
                              { value: 'topical', label: 'Topical' },
                              { value: 'injection', label: 'Injection' },
                              { value: 'other', label: 'Other' },
                            ]}
                          />}
                          {!isInjectionMedication && <input type="text" placeholder={isTopical ? 'Application instructions (e.g. apply twice daily)' : 'Frequency (e.g. twice daily)'} value={med.frequency} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))} className={`border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]${isTopical ? ' col-span-2' : ''}`} />}
                          {!isInjectionMedication && <input type="text" placeholder="Duration (e.g. 7 days)" value={med.duration} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, duration: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />}
                          {!isInjectionMedication && <input type="number" placeholder="Qty" min="1" value={med.quantity ?? ''} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, quantity: e.target.value ? parseInt(e.target.value) : null } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />}
                          {isInjectionMedication ? (
                            <input
                              type="text"
                              value={injectionPricingTypeLabel}
                              readOnly
                              placeholder="Injection Pricing Type"
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-gray-50 text-gray-600"
                            />
                          ) : (
                            <DropdownField
                              value={med.pricingType || ''}
                              onValueChange={(value) => setMedications((prev) => prev.map((m, j) => {
                                if (j !== i) return m
                                const nextPricingType = value as Medication['pricingType']
                                const selectedService = medicationServices.find((service) => service.name === m.name)
                                const recomputedSinglePillQty = selectedService ? deriveSinglePillQuantity(selectedService) : null
                                return {
                                  ...m,
                                  pricingType: nextPricingType,
                                  quantity:
                                    nextPricingType === 'pack'
                                      ? 1
                                      : nextPricingType === 'singlePill'
                                        ? (recomputedSinglePillQty ?? m.quantity)
                                        : m.quantity,
                                }
                              }))}
                              placeholder="Dispensing"
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                              options={[
                                { value: '', label: 'Dispensing' },
                                { value: 'singlePill', label: 'Individual Pill Packages' },
                                { value: 'pack', label: `Bottle${med.piecesPerPack ? ` (${med.piecesPerPack} pcs)` : ''}` },
                              ]}
                            />
                          )}
                          {!isTopical && !isInjectionMedication && <DropdownField
                            value={med.status}
                            onValueChange={(value) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, status: value as Medication['status'] } : m))}
                            placeholder="Status"
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            options={[
                              { value: 'active', label: 'Active' },
                              { value: 'completed', label: 'Completed' },
                              { value: 'discontinued', label: 'Discontinued' },
                            ]}
                          />}
                        </div>
                          )
                        })()}
                        {capsuleWarnings[i] && (
                          <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                            <span>{capsuleWarnings[i]}</span>
                          </div>
                        )}
                        {!(() => {
                          const selectedServiceId = selectedMedicationServiceIds[i] || ''
                          const medService =
                            (selectedServiceId
                              ? medicationServices.find((s) => String(s._id) === String(selectedServiceId))
                              : undefined) ||
                            resolveMedicationServiceForEntry(medicationServices, med)
                          return isInjectionService(medService) || normalizeServiceToken(String(med.route || '')) === 'injection' || !!medService?.injectionPricingType
                        })() && (
                          <input type="text" placeholder="Notes (optional)" value={med.notes} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, notes: e.target.value } : m))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                        )}
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
                      const associatedPreventiveMeds = getAssociatedPreventiveMedications(care.product)
                      const associatedInjectionMeds = getAssociatedInjectionMedications(care.product)
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500">Preventive Care {i + 1}</span>
                            <button onClick={() => {
                              setPreventiveCare((prev) => prev.filter((_, j) => j !== i))
                              setPreventiveMedicationDispensing((prev) => {
                                const next: Record<string, 'singlePill' | 'pack' | ''> = {}
                                Object.entries(prev).forEach(([key, value]) => {
                                  const keyMatch = key.match(/^(\d+)-(.*)$/)
                                  if (!keyMatch) return
                                  const keyIndex = parseInt(keyMatch[1], 10)
                                  const suffix = keyMatch[2]
                                  if (keyIndex < i) next[key] = value
                                  else if (keyIndex > i) next[`${keyIndex - 1}-${suffix}`] = value
                                })
                                return next
                              })
                              setPreventiveInjectionDosageOverrides((prev) => {
                                const next: Record<string, string> = {}
                                Object.entries(prev).forEach(([key, value]) => {
                                  const keyMatch = key.match(/^(\d+)-(.*)$/)
                                  if (!keyMatch) return
                                  const keyIndex = parseInt(keyMatch[1], 10)
                                  const suffix = keyMatch[2]
                                  if (keyIndex < i) next[key] = value
                                  else if (keyIndex > i) next[`${keyIndex - 1}-${suffix}`] = value
                                })
                                return next
                              })
                              setPreventiveMedicationDurationOverrides((prev) => {
                                const next: Record<string, string> = {}
                                Object.entries(prev).forEach(([key, value]) => {
                                  const keyMatch = key.match(/^(\d+)-(.*)$/)
                                  if (!keyMatch) return
                                  const keyIndex = parseInt(keyMatch[1], 10)
                                  const suffix = keyMatch[2]
                                  if (keyIndex < i) next[key] = value
                                  else if (keyIndex > i) next[`${keyIndex - 1}-${suffix}`] = value
                                })
                                return next
                              })
                              setPreventiveMedicationIntervalOverrides((prev) => {
                                const next: Record<string, string> = {}
                                Object.entries(prev).forEach(([key, value]) => {
                                  const keyMatch = key.match(/^(\d+)-(.*)$/)
                                  if (!keyMatch) return
                                  const keyIndex = parseInt(keyMatch[1], 10)
                                  const suffix = keyMatch[2]
                                  if (keyIndex < i) next[key] = value
                                  else if (keyIndex > i) next[`${keyIndex - 1}-${suffix}`] = value
                                })
                                return next
                              })
                            }} className="text-[#900B09] hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <DropdownField
                              value={care.product}
                              onValueChange={(value) => {
                                setPreventiveCare((prev) => prev.map((c, j) =>
                                  j === i
                                    ? { ...c, product: value, careType: mapProductToCareType(value) }
                                    : c
                                ))
                              }}
                              placeholder="Select a preventive care service"
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                              options={[
                                { value: '', label: 'Select a preventive care service' },
                                ...preventiveCareServices.map((service) => ({
                                  value: service.name,
                                  label: `${service.name}${service.price ? ` (₱${service.price})` : ''}`,
                                })),
                              ]}
                            />
                          </div>

                          {associatedInjectionMeds.filter((inj) => !preventiveAssociatedExclusions.has(inj._id!)).length > 0 && (
                            <div className="rounded-lg border border-[#7FA5A3]/25 bg-[#f0f7f7] p-2.5 space-y-2">
                              <p className="text-[11px] font-semibold text-[#476B6B]">Associated Injection</p>
                              {associatedInjectionMeds.filter((inj) => !preventiveAssociatedExclusions.has(inj._id!)).map((inj, injIndex) => {
                                const bodyWeightVal = parseFloat(String(vitals?.weight?.value ?? ''))
                                const inferredCareType = care.careType || getInjectionCareType(care.product)
                                const effectiveCareType: 'flea' | 'deworming' | 'heartworm' | null =
                                  inferredCareType === 'tick'
                                    ? 'flea'
                                    : inferredCareType === 'other'
                                      ? null
                                      : inferredCareType
                                const injectionCalc = calculateInjectionDosage(inj, bodyWeightVal, effectiveCareType)
                                const fallbackDosage = !isNaN(bodyWeightVal) && bodyWeightVal > 0 && inj.dosePerKg != null
                                  ? `${parseFloat((inj.dosePerKg * bodyWeightVal).toFixed(2))} ${inj.doseUnit || 'mL'}`
                                  : null
                                const dosageKey = `${i}-${inj._id}`
                                const computedDosage = injectionCalc
                                  ? `${injectionCalc.dosageMl} mL`
                                  : (fallbackDosage || '')
                                return (
                                  <div key={`${inj._id}-${injIndex}`} className="rounded-lg border border-[#7FA5A3]/20 bg-white p-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-semibold text-[#4F4F4F]">{inj.name}</p>
                                      <button
                                        onClick={() => setPreventiveAssociatedExclusions((prev) => new Set([...prev, inj._id!]))}
                                        className="text-[#900B09] hover:text-red-600"
                                        title="Remove from billing"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="mt-1.5">
                                      <p className="text-[10px] text-gray-400 mb-0.5">Dosage</p>
                                      <input
                                        type="text"
                                        value={preventiveInjectionDosageOverrides[dosageKey] ?? computedDosage}
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setPreventiveInjectionDosageOverrides((prev) => ({
                                            ...prev,
                                            [dosageKey]: nextValue,
                                          }))
                                        }}
                                        placeholder={computedDosage || '—'}
                                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="rounded-lg border border-[#7FA5A3]/25 bg-[#f0f7f7] p-2.5 space-y-2">
                            <p className="text-[11px] font-semibold text-[#476B6B]">Associated Preventive Medication</p>
                            {associatedPreventiveMeds.filter((med) => !preventiveAssociatedExclusions.has(med._id!)).length > 0 ? (
                              associatedPreventiveMeds.filter((med) => !preventiveAssociatedExclusions.has(med._id!)).map((med, medIndex) => (
                                <div key={`${med._id}-${medIndex}`} className="rounded-lg border border-[#7FA5A3]/20 bg-white p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-semibold text-[#4F4F4F]">{med.name}</p>
                                    <button
                                      onClick={() => setPreventiveAssociatedExclusions((prev) => new Set([...prev, med._id!]))}
                                      className="text-[#900B09] hover:text-red-600"
                                      title="Remove from billing"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {(() => {
                                    const medKey = `${i}-${med._id}`
                                    return (
                                  <>
                                  <div className="mt-1.5">
                                    <p className="text-[10px] text-gray-400 mb-1">Dispensing</p>
                                    <DropdownField
                                      value={preventiveMedicationDispensing[medKey] || med.pricingType || ''}
                                      onValueChange={(value) => {
                                        setPreventiveMedicationDispensing((prev) => ({
                                          ...prev,
                                          [medKey]: value as 'singlePill' | 'pack' | '',
                                        }))
                                      }}
                                      placeholder="Dispensing"
                                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                                      options={[
                                        { value: '', label: 'Dispensing' },
                                        { value: 'singlePill', label: 'Individual Pill Packages' },
                                        { value: 'pack', label: `Bottle${med.piecesPerPack ? ` (${med.piecesPerPack} pcs)` : ''}` },
                                      ]}
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                                    <div>
                                      <p className="text-[10px] text-gray-400">Administration Method</p>
                                      <p className="text-xs text-gray-600">{med.administrationMethod || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-400">Duration</p>
                                      <input
                                        type="text"
                                        value={preventiveMedicationDurationOverrides[medKey] ?? (med.preventiveDuration != null ? String(med.preventiveDuration) : '')}
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setPreventiveMedicationDurationOverrides((prev) => ({
                                            ...prev,
                                            [medKey]: nextValue,
                                          }))
                                        }}
                                        placeholder={med.preventiveDuration != null ? `${med.preventiveDuration}` : '—'}
                                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                                      />
                                      {med.preventiveDurationUnit && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">{med.preventiveDurationUnit}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-gray-400">Interval Days</p>
                                      <input
                                        type="number"
                                        min="0"
                                        value={preventiveMedicationIntervalOverrides[medKey] ?? (med.intervalDays != null ? String(med.intervalDays) : '')}
                                        onChange={(e) => {
                                          const nextValue = e.target.value
                                          setPreventiveMedicationIntervalOverrides((prev) => ({
                                            ...prev,
                                            [medKey]: nextValue,
                                          }))
                                        }}
                                        placeholder={med.intervalDays != null ? String(med.intervalDays) : '—'}
                                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                                      />
                                    </div>
                                  </div>
                                  </>
                                    )
                                  })()}
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-gray-500">
                                {associatedPreventiveMeds.length > 0
                                  ? 'All associated medications have been removed from billing.'
                                  : 'No preventive medication linked to this preventive care service.'}
                              </p>
                            )}
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
                {confined
                  ? (recordStage === 'confined' ? 'Save Confinement Update' : 'Admit & Close Visit')
                  : (recordStage === 'confined' ? 'Release & Complete Visit' : 'Complete Record & Finish Visit')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Complete & Finish Visit */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confined
                ? (recordStage === 'confined' ? 'Save Confinement Update?' : 'Admit Pet for Confinement?')
                : (recordStage === 'confined' ? 'Release Pet & Complete Visit?' : 'Complete Visit?')}
            </DialogTitle>
            <DialogDescription>
              {confined && recordStage !== 'confined'
                ? 'The appointment will be closed but the medical record will stay open. You can add medications and services during confinement from Patient Records.'
                : confined && recordStage === 'confined'
                  ? 'This will save the current medications and services and update the running bill.'
                  : recordStage === 'confined'
                    ? 'The pet will be released from confinement, the confinement charge will be finalized, and the visit will be completed.'
                    : 'Are you sure you want to complete this visit? This action cannot be undone.'}
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
      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-200 shrink-0 ${notesMinimized ? 'w-10' : 'w-80'}`}>
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

