'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, togglePetLost, markPetDeceased, removePet, transferPet, searchTransferOwnerEmails, type Pet as APIPet } from '@/lib/pets'
import { getMyAppointments, type Appointment as APIAppointment } from '@/lib/appointments'
import { getProfile } from '@/lib/users'
import {
  Calendar,
  PawPrint,
  FileText,
  Syringe,
  AlertTriangle,
  Phone,
  MessageSquare,
  Plus,
  Clock,
  MapPin,
  Filter,
  ChevronRight,
  Trash2,
  Skull,
  Search,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// --- Types ---
interface Pet {
  id: string
  status: 'alive' | 'lost' | 'deceased'
  isAlive: boolean
  deceasedAt: string | null
  name: string
  species: string
  breed: string
  secondaryBreed: string | null
  sex: string
  age: string
  weight: string
  birthDate: string
  lastVisit: string
  nextVisit: string
  image: string | null
  isLost: boolean
  lostReportedByStranger: boolean
  lostContactName: string | null
  lostContactNumber: string | null
  lostMessage: string | null
  sterilization: string
  microchipNumber: string
  bloodType: string
  allergies: string[]
  nfcTagId: string
  previousOwners: { id: string; name: string; until: string }[]
  vet: { name: string; photo: string | null; verified: boolean } | null
}

// --- Helpers ---
function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} Month${totalMonths > 1 ? 's' : ''} Old`
  const y = Math.floor(totalMonths / 12)
  return `${y} Year${y > 1 ? 's' : ''} Old`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

function formatLongDate(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown date'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatSterilizationStatus(status: string, sex: string): string {
  switch (status) {
    case 'spayed':
    case 'unspayed':
    case 'neutered':
    case 'unneutered':
      return status.charAt(0).toUpperCase() + status.slice(1)
    case 'unknown':
      return 'Unknown'
    // Handle legacy values
    case 'yes':
      return sex === 'female' ? 'Spayed' : 'Neutered'
    case 'no':
      return sex === 'female' ? 'Unspayed' : 'Unneutered'
    default:
      return 'Unknown'
  }
}

function apiPetToDashboardPet(apiPet: APIPet): Pet {
  return {
    id: apiPet._id,
    status: apiPet.status,
    isAlive: apiPet.isAlive,
    deceasedAt: apiPet.deceasedAt,
    name: apiPet.name,
    species: apiPet.species.charAt(0).toUpperCase() + apiPet.species.slice(1),
    breed: apiPet.breed,
    secondaryBreed: apiPet.secondaryBreed || null,
    sex: apiPet.sex.charAt(0).toUpperCase() + apiPet.sex.slice(1),
    age: calculateAge(apiPet.dateOfBirth),
    weight: `${apiPet.weight} kg`,
    birthDate: formatDate(apiPet.dateOfBirth),
    lastVisit: '-',
    nextVisit: '-',
    image: apiPet.photo,
    isLost: apiPet.isLost,
    lostReportedByStranger: apiPet.lostReportedByStranger,
    lostContactName: apiPet.lostContactName ?? null,
    lostContactNumber: apiPet.lostContactNumber ?? null,
    lostMessage: apiPet.lostMessage ?? null,
    sterilization: formatSterilizationStatus(apiPet.sterilization, apiPet.sex),
    microchipNumber: apiPet.microchipNumber || '-',
    bloodType: apiPet.bloodType || '-',
    allergies: apiPet.allergies,
    nfcTagId: apiPet.nfcTagId || '-',
    previousOwners: apiPet.previousOwners || [],
    vet: apiPet.assignedVetId
      ? { name: `Dr. ${apiPet.assignedVetId.firstName} ${apiPet.assignedVetId.lastName}`, photo: apiPet.assignedVetId.photo ?? null, verified: true }
      : null,
  }
}

function hasRegisteredNfcTag(pet: Pick<Pet, 'nfcTagId'> | null | undefined): boolean {
  if (!pet) return false
  const tagId = pet.nfcTagId?.trim()
  return Boolean(tagId && tagId !== '-')
}

interface DashboardAppointment {
  id: string
  title: string
  date: Date
  time: string
  clinic: string
  petName: string
  petBreed: string
  status: 'CONFIRMED' | 'PENDING' | 'IN PROGRESS' | 'CANCELLED' | 'COMPLETED'
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m}${ampm}`
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

function apiAppointmentToDashboard(appt: APIAppointment): DashboardAppointment {
  const appointmentDate = new Date(appt.date)
  const startTimeFormatted = formatSlotTime(appt.startTime)
  const endTimeFormatted = formatSlotTime(appt.endTime)
  const clinicName = appt.clinicBranchId?.name || appt.clinicId?.name || 'Unknown Clinic'
  const petName = appt.petId?.name || 'Pet'
  const petBreed = appt.petId?.breed || 'Unknown Breed'
  const normalizedStatus = String(appt.status || '').trim().toLowerCase()
  const statusMap: { [key: string]: 'CONFIRMED' | 'PENDING' | 'IN PROGRESS' | 'CANCELLED' | 'COMPLETED' } = {
    confirmed: 'CONFIRMED',
    pending: 'PENDING',
    in_clinic: 'IN PROGRESS',
    in_progress: 'IN PROGRESS',
    cancelled: 'CANCELLED',
    completed: 'COMPLETED',
  }

  return {
    id: appt._id,
    title: appt.types.length > 0 ? appt.types.map(formatAppointmentTypeDisplay).join(', ') : 'Appointment',
    date: appointmentDate,
    time: `${startTimeFormatted} - ${endTimeFormatted}`,
    clinic: clinicName,
    petName,
    petBreed,
    status: statusMap[normalizedStatus] || 'PENDING',
  }
}

const quickActions = [
  {
    label: 'Book Appointment',
    description: 'Schedule a vet visit',
    icon: <Calendar className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/my-appointments',
  },
  {
    label: 'View Pet Records',
    description: 'Access medical history',
    icon: <FileText className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/my-pets',
  },
  {
    label: 'View Vaccine Cards',
    description: 'View Vaccination Cards',
    icon: <Syringe className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/vaccine-cards',
  },
  {
    label: 'Mark Pet as Lost',
    description: 'Report a Missing Pet',
    icon: <AlertTriangle className="w-5 h-5 text-[#7FA5A3]" />,
    href: '#',
  },
]

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// --- Pet Detail Modal ---
function PetDetailModal({
  pet,
  open,
  onClose,
  onReportLost,
  onMarkFound,
  onRemovePet,
  onNavigateToMedicalRecords,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
  onReportLost: (pet: Pet) => void
  onMarkFound: (pet: Pet) => void
  onRemovePet: (pet: Pet) => void
  onNavigateToMedicalRecords: () => void
}) {
  const router = useRouter()
  const canUseLostPetFeature = hasRegisteredNfcTag(pet)
  const lostPetLockedMessage = 'Purchase a pet tag first to unlock this feature.'
  const isDeceased = Boolean(pet?.status === 'deceased' || !pet?.isAlive)

  if (!pet) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">{pet.name} - Pet Details</DialogTitle>
        <DialogDescription className="sr-only">Pet profile details for {pet.name}</DialogDescription>
        <div className="flex flex-col lg:flex-row">
          {/* Left Column - Pet Info */}
          <div className="lg:w-1/2 p-6 lg:p-8 flex flex-col">
            {/* Pet Details Container */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.1)] p-6 mb-4">
              {/* Avatar */}
              <div className="flex justify-center mb-4">
                <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {pet.image ? (
                    <Image src={pet.image} alt={pet.name} width={112} height={112} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <PawPrint className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              </div>
              {/* Name */}
              <h2
                className="text-[24px] text-center text-[#476B6B] mb-4"
                style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
              >
                {pet.name}
              </h2>
              {isDeceased && (
                <div className="mb-4 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
                    <Skull className="w-3.5 h-3.5" />
                    Deceased {formatLongDate(pet.deceasedAt)}
                  </span>
                </div>
              )}
              {pet.previousOwners.length > 0 && (
                <div className="mb-4 flex justify-center">
                  <span className="inline-flex items-center rounded-full bg-[#F1F0ED] text-[#4F4F4F] px-3 py-1 text-xs font-medium">
                    Past Owner: {pet.previousOwners[pet.previousOwners.length - 1].name}
                  </span>
                </div>
              )}
              {/* Breed / Sex / Age pills */}
              <div className={`bg-[#F1F0ED] rounded-[10px] p-2 grid gap-2 mb-6 ${pet.secondaryBreed ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div className={`bg-[#476B6B] text-white rounded-[10px] py-2 px-3 ${pet.secondaryBreed ? 'col-span-2' : ''}`}>
                  <p className="text-[9px] text-white/70 text-left">{pet.secondaryBreed ? 'Crossbreed' : 'Breed'}</p>
                  <p className="text-[12px] text-center">
                    {pet.secondaryBreed ? `${pet.breed} · ${pet.secondaryBreed}` : pet.breed}
                  </p>
                </div>
                <div className="bg-[#476B6B] text-white rounded-[10px] py-2 px-3">
                  <p className="text-[9px] text-white/70 text-left">Sex</p>
                  <p className="text-[12px] text-center">{pet.sex}</p>
                </div>
                <div className="bg-[#476B6B] text-white rounded-[10px] py-2 px-3">
                  <p className="text-[9px] text-white/70 text-left">Age</p>
                  <p className="text-[12px] text-center">{pet.age}</p>
                </div>
              </div>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-[#F1F0ED] rounded-2xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Weight</p>
                  <p className="text-[14px] font-bold text-[#4F4F4F]">{pet.weight.replace(' kg', '')} KG</p>
                </div>
                <div className="bg-[#F1F0ED] rounded-2xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Birth Date</p>
                  <p className="text-[14px] font-bold text-[#4F4F4F]">{pet.birthDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[#F1F0ED] rounded-2xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Sterilization</p>
                  <p className="text-[14px] font-bold text-[#4F4F4F]">{pet.sterilization}</p>
                </div>
                <div className="bg-[#F1F0ED] rounded-2xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Blood Type</p>
                  <p className="text-[14px] font-bold text-[#4F4F4F]">{pet.bloodType}</p>
                </div>
              </div>
              {/* Allergies */}
              {pet.allergies.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F] mb-3">Known Allergies</p>
                  <div className="bg-[#F1F0ED] rounded-2xl p-2 flex gap-2">
                    {pet.allergies.map((allergy) => (
                      <span
                        key={allergy}
                        className="bg-[#476B6B] text-white py-2 rounded-2xl text-[12px] font-medium flex-1 text-center"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Vet Info - separate card with shadow */}
            {pet.vet ? (
              <div className="bg-[#7FA5A3] rounded-2xl p-4 flex items-center gap-3 shadow-[0_8px_32px_rgba(71,107,107,0.35)]">
                <div className="w-12 h-12 bg-white rounded-full shrink-0 overflow-hidden flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
                  {pet.vet.photo ? (
                    <img src={pet.vet.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#476B6B] font-bold text-base">{pet.vet.name.charAt(4)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{pet.vet.name}</p>
                  <p className="text-white/80 text-xs">Assigned Veterinarian</p>
                </div>
                <span className="bg-[#9EC4C8] text-white text-[10px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#679D82] rounded-full animate-pulse" />
                  PRC Verified
                </span>
              </div>
            ) : (
              <div className="bg-gray-100 border border-dashed border-gray-300 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0 flex items-center justify-center">
                  <span className="text-gray-400 font-bold text-sm">?</span>
                </div>
                <div className="flex-1">
                  <p className="text-gray-500 font-semibold text-sm">No veterinarian assigned</p>
                  <p className="text-gray-400 text-xs">Book an appointment to get a vet assigned</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - NFC & Actions */}
          <div className="lg:w-1/2 p-6 lg:p-8 space-y-4">
            {/* NFC Tag Status */}
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="font-semibold text-[#4F4F4F] text-sm">NFC Tag Status</p>
              <p className="text-xs text-gray-400 mb-3">Tag ID: {pet.nfcTagId}</p>
              <div className={`rounded-lg p-3 mb-3 ${pet.isLost ? 'bg-red-50' : 'bg-[#F8F6F2]'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${pet.isLost ? 'bg-red-500' : 'bg-[#679D82] animate-pulse'}`} />
                  <p className="text-sm font-medium text-[#4F4F4F]">
                    {pet.isLost ? 'LOST - Showing Lost Pet Alert' : 'Normal - Showing Pet Profile'}
                  </p>
                </div>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-4 min-h-20">
                <p className="text-xs text-gray-400 mb-2">What Strangers See When Scanning:</p>
                <p className="text-xs text-gray-400 mb-3">
                  {pet.isLost ? 'Lost pet profile with alert and contact info.' : 'Normal pet profile will be shown.'}
                </p>
                <button
                  onClick={() => { onClose(); router.push(`/pet/${pet.id}`) }}
                  className="w-full text-xs text-[#7FA5A3] hover:text-[#5A7C7A] font-medium underline text-left transition-colors"
                >
                  View public NFC profile →
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              disabled={isDeceased}
              className={`w-full border rounded-xl p-4 text-left transition-colors flex items-center justify-between ${
                isDeceased ? 'border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { if (!isDeceased) { onClose(); router.push(`/my-appointments?petId=${pet.id}`) } }}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Book Appointment</p>
                <p className="text-xs text-gray-400">{isDeceased ? `Pet deceased on ${formatLongDate(pet.deceasedAt)}` : `Schedule a Vet Visit for ${pet.name}`}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            {/* <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={onNavigateToMedicalRecords}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">View Medical Records</p>
                <p className="text-xs text-gray-400">Medical History and Reports</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button> */}
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => { onClose(); router.push(`/my-pets/${pet.id}/vaccine-card`) }}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Vaccine Card</p>
                <p className="text-xs text-gray-400">View Vaccination History</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            {!isDeceased && pet.isLost ? (
              <button
                className="w-full border border-[#679D82] rounded-xl p-4 text-left hover:bg-green-50 transition-colors flex items-center justify-between"
                onClick={() => onMarkFound(pet)}
              >
                <div>
                  <p className="font-semibold text-[#679D82] text-sm">Mark {pet.name} as Found</p>
                  <p className="text-xs text-gray-400">Remove Lost Alert from NFC tag</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#679D82]" />
              </button>
            ) : !isDeceased ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <button
                      type="button"
                      disabled={!canUseLostPetFeature}
                      className={`w-full border rounded-xl p-4 text-left transition-colors flex items-center justify-between ${
                        canUseLostPetFeature
                          ? 'border-gray-200 hover:bg-gray-50'
                          : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-70'
                      }`}
                      onClick={() => canUseLostPetFeature && onReportLost(pet)}
                    >
                      <div>
                        <p className="font-semibold text-[#4F4F4F] text-sm">Report {pet.name} as Lost</p>
                        <p className="text-xs text-gray-400">Update NFC tag to show Lost Status</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${canUseLostPetFeature ? 'text-gray-400' : 'text-gray-300'}`} />
                    </button>
                  </span>
                </TooltipTrigger>
                {!canUseLostPetFeature && (
                  <TooltipContent side="top" sideOffset={8}>
                    {lostPetLockedMessage}
                  </TooltipContent>
                )}
              </Tooltip>
            ) : (
              <div className="w-full border border-gray-100 rounded-xl p-4 bg-gray-50 opacity-80">
                <p className="font-semibold text-gray-500 text-sm">Lost toggle unavailable</p>
                <p className="text-xs text-gray-400">Pet deceased on {formatLongDate(pet.deceasedAt)}</p>
              </div>
            )}
            {!isDeceased && (
              <button
                className="w-full border border-red-200 rounded-xl p-4 text-left hover:bg-red-50 transition-colors flex items-center justify-between"
                onClick={() => onRemovePet(pet)}
              >
                <div>
                  <p className="font-semibold text-[#900B09] text-sm">Remove {pet.name}</p>
                  <p className="text-xs text-gray-400">Transfer ownership or mark as deceased</p>
                </div>
                <Trash2 className="w-4 h-4 text-[#900B09]" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Report Lost Pet Modal ---
function ReportLostPetModal({
  pet,
  pets,
  open,
  onClose,
  onMarkedLost,
}: {
  pet: Pet | null
  pets?: Pet[]
  open: boolean
  onClose: () => void
  onMarkedLost?: () => void
}) {
  const token = useAuthStore((state) => state.token)
  const [contactName, setContactName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [message, setMessage] = useState('')
  const [selectedPet, setSelectedPet] = useState<Pet | null>(pet)

  // Update selectedPet when pet prop changes
  useEffect(() => {
    setSelectedPet(pet)
  }, [pet])

  // Auto-populate fields whenever selected pet changes
  useEffect(() => {
    if (!selectedPet) return
    setContactName(selectedPet.name)
    setContactNumber(selectedPet.lostContactNumber || '')
    setMessage(
      selectedPet.lostMessage ||
      'If you found me, please call or message my owner and feel free to share your current location with them.'
    )
  }, [selectedPet?.id])

  // Always prefer the logged-in owner's contact number when modal opens
  useEffect(() => {
    const fetchOwnerContact = async () => {
      if (!open || !token || !selectedPet) return
      try {
        const profile = await getProfile(token)
        const ownerContact = (profile?.data?.user as { contactNumber?: string } | undefined)?.contactNumber || ''
        setContactNumber(ownerContact || selectedPet.lostContactNumber || '')
      } catch {
        setContactNumber(selectedPet.lostContactNumber || '')
      }
    }

    fetchOwnerContact()
  }, [open, token, selectedPet?.id])

  if (!pet && (!pets || pets.length === 0)) return null

  const displayPets = pets && pets.length > 0 ? pets : (pet ? [pet] : [])
  const selectablePets = displayPets.filter((p) => p.isAlive && p.status !== 'deceased')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] p-6">
        <DialogHeader className="mb-0">
          <DialogTitle
            className="text-2xl font-normal text-[#900B09] flex items-center gap-2"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            <AlertTriangle className="w-6 h-6" />
            Report Lost Pet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Report {pet?.name} as lost
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="space-y-4">
          {/* Pet Preview */}
          {selectedPet && (
            <div className="flex items-center gap-3 bg-[#F8F6F2] rounded-xl p-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/20 overflow-hidden flex items-center justify-center shrink-0">
                {selectedPet.image ? (
                  <Image src={selectedPet.image} alt={selectedPet.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <PawPrint className="w-5 h-5 text-[#7FA5A3]" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">{selectedPet.name}</p>
                <p className="text-xs text-gray-500">{selectedPet.breed}</p>
              </div>
            </div>
          )}

          {selectablePets.length > 1 && (
            <div>
              <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">Select Pet</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full border border-gray-200 rounded-xl p-3 bg-white text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-left"
                  >
                    {selectedPet ? `${selectedPet.name} - ${selectedPet.breed}` : 'Select Pet'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-xl max-h-56 overflow-y-auto">
                  <DropdownMenuRadioGroup
                    value={selectedPet?.id || ''}
                    onValueChange={(value) => {
                      const selected = displayPets.find((p) => p.id === value)
                      if (selected) setSelectedPet(selected)
                    }}
                  >
                    {selectablePets.map((p) => (
                      <DropdownMenuRadioItem key={p.id} value={p.id}>
                        {p.name} - {p.breed}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-600">Name Shown on Tag</label>
            <input
              type="text"
              placeholder="Name to display on lost pet alert"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Contact Number
            </label>
            <input
              type="text"
              placeholder="Your contact number"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Additional Message <span className="text-gray-400 text-xs font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Any details that may help identify your pet..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30 resize-none"
            />
          </div>

          {/* Warning */}
          <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#900B09] shrink-0 mt-0.5" />
            <p className="text-xs text-[#900B09]">
              Marking as lost will update your pet&apos;s NFC tag. Anyone who scans it will see a lost pet alert and can share their location with you.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors flex items-center justify-center gap-2"
            onClick={async () => {
              try {
                const token = useAuthStore.getState().token
                if (token && selectedPet) {
                  await togglePetLost(selectedPet.id, true, token, {
                    lostContactName: contactName || undefined,
                    lostContactNumber: contactNumber || undefined,
                    lostMessage: message || undefined,
                  })
                }
                toast('Pet Reported as Lost', {
                  description: `${selectedPet?.name} has been marked as lost. NFC tag updated.`,
                  icon: <AlertTriangle className="w-4 h-4 text-[#900B09]" />,
                })
                onMarkedLost?.()
              } catch {
                toast('Error', { description: 'Failed to update pet status. Please try again.' })
              }
              onClose()
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="text-center leading-tight">Mark as Lost &amp;<br />Update NFC Tag</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Remove Pet Modal ---
const REMOVAL_REASONS = [
  { value: 'passed-away', label: 'Pet passed away' },
  { value: 'relocated', label: 'Pet was relocated' },
  { value: 'transfer', label: 'Transferred to another owner' },
  { value: 'other', label: 'Other' },
] as const

function RemovePetModal({
  pet,
  open,
  onClose,
  onPetRemoved,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
  onPetRemoved?: () => void
}) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([])
  const [isTransferSearchOpen, setIsTransferSearchOpen] = useState(false)
  const [isLoadingEmailSuggestions, setIsLoadingEmailSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const transferDebounceRef = useRef<NodeJS.Timeout>(null)

  const resetForm = () => {
    setReason('')
    setDetails('')
    setNewOwnerEmail('')
    setEmailSuggestions([])
    setIsTransferSearchOpen(false)
    setIsLoadingEmailSuggestions(false)
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const isTransfer = reason === 'transfer'
  const isPassedAway = reason === 'passed-away'

  useEffect(() => {
    if (!open || !isTransfer) {
      setEmailSuggestions([])
      setIsTransferSearchOpen(false)
      setIsLoadingEmailSuggestions(false)
      return
    }

    const query = newOwnerEmail.trim().toLowerCase()
    if (query.length < 2) {
      setEmailSuggestions([])
      setIsLoadingEmailSuggestions(false)
      return
    }

    if (transferDebounceRef.current) clearTimeout(transferDebounceRef.current)
    transferDebounceRef.current = setTimeout(async () => {
      try {
        setIsLoadingEmailSuggestions(true)
        const token = useAuthStore.getState().token
        const response = await searchTransferOwnerEmails(query, token || undefined)
        setEmailSuggestions(response.status === 'SUCCESS' ? (response.data?.emails || []) : [])
      } catch {
        setEmailSuggestions([])
      } finally {
        setIsLoadingEmailSuggestions(false)
      }
    }, 300)

    return () => {
      if (transferDebounceRef.current) clearTimeout(transferDebounceRef.current)
    }
  }, [open, isTransfer, newOwnerEmail])

  if (!pet) return null

  const handleConfirm = async () => {
    if (!reason) {
      setError('Please select a reason')
      return
    }

    if (isTransfer && !newOwnerEmail.trim()) {
      setError('Please enter the new owner email')
      return
    }

    if (isTransfer && !newOwnerEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const token = useAuthStore.getState().token
      if (!token) return

      if (isTransfer) {
        const recipient = newOwnerEmail.trim()
        const response = await transferPet(
          pet.id,
          { newOwnerEmail: recipient || undefined },
          token
        )
        if (response.status === 'ERROR') {
          setError(response.message || 'Transfer failed')
          setLoading(false)
          return
        }
        toast('Pet Transferred', {
          description: response.message || `${pet.name} has been transferred successfully.`,
          icon: <PawPrint className="w-4 h-4 text-[#7FA5A3]" />,
        })
      } else if (isPassedAway) {
        const response = await markPetDeceased(pet.id, token)
        if (response.status === 'ERROR') {
          setError(response.message || 'Unable to mark pet as deceased')
          setLoading(false)
          return
        }
        toast('Pet Marked as Deceased', {
          description: `${pet.name} is now read-only and remains in dashboard history.`,
          icon: <Skull className="w-4 h-4 text-amber-700" />,
        })
      } else {
        const reasonLabel = REMOVAL_REASONS.find((r) => r.value === reason)?.label || reason
        const response = await removePet(pet.id, reasonLabel, details || undefined, token)
        if (response.status === 'ERROR') {
          setError(response.message || 'Removal failed')
          setLoading(false)
          return
        }
        toast('Pet Removed', {
          description: `${pet.name} has been removed from your profile.`,
          icon: <Trash2 className="w-4 h-4 text-[#900B09]" />,
        })
      }

      onPetRemoved?.()
      handleClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-[95vw] p-6">
        <DialogHeader className="mb-0">
          <DialogTitle
            className="text-2xl text-[#900B09]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Remove Pet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Remove {pet.name} from your profile
          </DialogDescription>
        </DialogHeader>

        {/* Info Box */}
        <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-[#B71C1C] mb-2">
            This action cannot be undone
          </p>
          <p className="text-xs text-[#4F4F4F] leading-relaxed">
            Removing a pet will permanently delete their profile, medical records,
            and associated data from your account. Selecting “Pet passed away” marks
            the profile as deceased instead of deleting records.
          </p>
        </div>

        {/* Pet info */}
        <div className="w-full border border-gray-200 rounded-xl p-3 bg-white text-sm text-[#4F4F4F] mb-4">
          {pet.name} — {pet.breed}
        </div>

        {/* Reason Selection */}
        <div className="space-y-3 mb-4">
          <label className="text-sm font-semibold text-[#4F4F4F] block">Reason for Removal</label>
          {REMOVAL_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-colors ${
                reason === r.value
                  ? 'border-[#7FA5A3] bg-[#F8F6F2]'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="removal-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={(e) => {
                  setReason(e.target.value)
                  setError('')
                }}
                className="accent-[#7FA5A3]"
              />
              <span className="text-sm text-[#4F4F4F]">{r.label}</span>
            </label>
          ))}
        </div>

        {/* Transfer email input (optional) */}
        {isTransfer && (
          <div className="mb-4 relative">
            <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">New Owner Email</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Search pet owner email..."
                value={newOwnerEmail}
                onChange={(e) => {
                  setNewOwnerEmail(e.target.value)
                  setIsTransferSearchOpen(true)
                  setError('')
                }}
                onFocus={() => setIsTransferSearchOpen(true)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] transition-colors"
              />
              {isLoadingEmailSuggestions && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {isTransferSearchOpen && emailSuggestions.length > 0 && (
              <div className="absolute left-6 right-6 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                {emailSuggestions.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => {
                      setNewOwnerEmail(email)
                      setIsTransferSearchOpen(false)
                      setError('')
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors text-[#4F4F4F]"
                  >
                    <span className="text-[#4F4F4F]">{email}</span>
                  </button>
                ))}
              </div>
            )}
            {isTransferSearchOpen && newOwnerEmail.trim().length >= 2 && !isLoadingEmailSuggestions && emailSuggestions.length === 0 && (
              <div className="absolute left-6 right-6 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3 text-sm text-gray-400">
                No pet owners found
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Recipient must have an existing PawSync pet-owner account.
            </p>
          </div>
        )}

        {/* Details (optional for non-transfer) */}
        {!isTransfer && !isPassedAway && reason && (
          <div className="mb-4">
            <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">
              Additional Details (Optional)
            </label>
            <textarea
              placeholder="Any additional notes..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Confirm button */}
        <button
          disabled={loading}
          className={`w-full font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
            isTransfer
              ? 'bg-[#476B6B] hover:bg-[#3a5a5a] text-white'
              : 'bg-[#900B09] hover:bg-[#7A0A08] text-white'
          }`}
          onClick={handleConfirm}
        >
          {loading ? (
            'Processing...'
          ) : isTransfer ? (
            <>
              <PawPrint className="w-4 h-4" />
              Transfer {pet.name}
            </>
          ) : isPassedAway ? (
            <>
              <Skull className="w-4 h-4" />
              Mark {pet.name} as Deceased
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Remove {pet.name}
            </>
          )}
        </button>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Dashboard ---
export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const [userName, setUserName] = useState('User')
  const [pets, setPets] = useState<Pet[]>([])
  const [petsLoading, setPetsLoading] = useState(true)
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [allApiAppointments, setAllApiAppointments] = useState<APIAppointment[]>([])
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [petModalOpen, setPetModalOpen] = useState(false)
  const [reportLostOpen, setReportLostOpen] = useState(false)
  const [reportLostPet, setReportLostPet] = useState<Pet | null>(null)
  const [reportLostFromDetail, setReportLostFromDetail] = useState(false)
  const [removePetOpen, setRemovePetOpen] = useState(false)
  const [removePetTarget, setRemovePetTarget] = useState<Pet | null>(null)
  const [strangerReportedLostPet, setStrangerReportedLostPet] = useState<Pet | null>(null)
  const [showStrangerReportedLostModal, setShowStrangerReportedLostModal] = useState(false)

  useEffect(() => {
    if (user?.firstName) {
      setUserName(user.firstName)
    } else {
      const signupData = sessionStorage.getItem('signupData')
      if (signupData) {
        const parsed = JSON.parse(signupData)
        setUserName(parsed.firstName || 'User')
      }
    }
  }, [user])

  // Fetch pets from API — redirect to onboarding if pet-owner has no pets
  const fetchPets = useCallback(async () => {
    if (!token) {
      setPetsLoading(false)
      return
    }
    try {
      setPetsLoading(true)
      const response = await getMyPets(token)
      if (response.status === 'SUCCESS' && response.data?.pets) {
        if (response.data.pets.length === 0) {
          router.replace('/onboarding/pet')
          return
        }
        const mappedPets = response.data.pets.map(apiPetToDashboardPet)
        setPets(mappedPets)

        const strangerReportedPet = mappedPets.find((p) => p.isLost && p.lostReportedByStranger)
        if (strangerReportedPet) {
          const seenKey = `stranger-lost-alert-seen-${strangerReportedPet.id}`
          const hasSeen = typeof window !== 'undefined' && sessionStorage.getItem(seenKey) === '1'
          if (!hasSeen) {
            setStrangerReportedLostPet(strangerReportedPet)
            setShowStrangerReportedLostModal(true)
          }
        }
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setPetsLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  // Fetch appointments from API
  const fetchAppointments = useCallback(async () => {
    if (!token) {
      setAppointmentsLoading(false)
      return
    }
    try {
      setAppointmentsLoading(true)
      const [upcomingRes, previousRes] = await Promise.all([
        getMyAppointments('upcoming', token),
        getMyAppointments('previous', token),
      ])
      const upcoming = upcomingRes.status === 'SUCCESS' ? upcomingRes.data?.appointments ?? [] : []
      const previous = previousRes.status === 'SUCCESS' ? previousRes.data?.appointments ?? [] : []
      setAllApiAppointments([...upcoming, ...previous])
      const dashboardAppointments = upcoming.map(apiAppointmentToDashboard).slice(0, 5)
      setAppointments(dashboardAppointments)
    } catch (error) {
      // Handle error silently
    } finally {
      setAppointmentsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchAppointments()
      // Auto-refresh appointments every 15 seconds
      const interval = setInterval(() => {
        fetchAppointments()
      }, 15000)
      return () => clearInterval(interval)
    }
  }, [token])

  // Derive last visit / next visit per pet card from fetched appointments
  useEffect(() => {
    if (allApiAppointments.length === 0) return
    const now = new Date()
    setPets((prev) =>
      prev.map((pet) => {
        const petAppts = allApiAppointments.filter((a) => {
          const apptPetId = typeof a.petId === 'object' ? a.petId?._id : a.petId
          return apptPetId === pet.id
        })
        const completed = petAppts
          .filter((a) => a.status === 'completed')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const lastVisitDate = completed[0] ? formatDate(completed[0].date) : '-'
        const upcoming = petAppts
          .filter(
            (a) =>
              ['pending', 'confirmed', 'in_progress'].includes(a.status) &&
              new Date(a.date) >= now,
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const nextVisitDate = upcoming[0] ? formatDate(upcoming[0].date) : '-'
        return { ...pet, lastVisit: lastVisitDate, nextVisit: nextVisitDate }
      }),
    )
  }, [allApiAppointments])

  // Show login toast notifications on first load
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem('justLoggedIn')
    if (justLoggedIn) {
      sessionStorage.removeItem('justLoggedIn')

      setTimeout(() => {
        toast('Welcome!', {
          description: 'You have successfully logged in.',
          icon: <Calendar className="w-4 h-4 text-green-500" />,
        })
      }, 500)
    }
  }, [])

  const handlePetClick = (pet: Pet) => {
    setSelectedPet(pet)
    setPetModalOpen(true)
  }

  const handleReportLost = (pet: Pet) => {
    setPetModalOpen(false)
    setReportLostPet(pet)
    setReportLostFromDetail(true)
    setTimeout(() => setReportLostOpen(true), 200)
  }

  const handleMarkFound = async (pet: Pet) => {
    try {
      await togglePetLost(pet.id, false, token ?? undefined, {
        lostContactName: null,
        lostContactNumber: null,
        lostMessage: null,
      })
      toast('Pet Found!', {
        description: `${pet.name} has been marked as found. NFC tag restored to normal.`,
      })
      await fetchPets()
      setPetModalOpen(false)
    } catch {
      toast('Error', { description: 'Failed to update pet status. Please try again.' })
    }
  }

  const handleRemovePet = (pet: Pet) => {
    setPetModalOpen(false)
    setRemovePetTarget(pet)
    setTimeout(() => setRemovePetOpen(true), 200)
  }

  const handleQuickAction = (href: string) => {
    if (href === '#') {
      const firstPetWithTag = pets.find((pet) => hasRegisteredNfcTag(pet) && pet.isAlive && pet.status !== 'deceased')
      if (!firstPetWithTag) return
      if (pets.length > 0) {
        setReportLostPet(firstPetWithTag)
        setReportLostFromDetail(false)
        setReportLostOpen(true)
      }
    } else {
      router.push(href)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 pt-5 lg:p-6 lg:pt-5 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-[#476B6B] to-[#7FA5A3] rounded-2xl p-6 lg:p-8">
          <h1
            className="text-2xl lg:text-3xl mb-2 text-white"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Welcome Back, {userName}
          </h1>
          <p className="text-white/80 text-sm lg:text-base">
            {pets.length > 0
              ? `You have ${pets.length} pet${pets.length > 1 ? 's' : ''} registered. Keep their records up to date!`
              : 'Add your first pet to get started with PawSync!'}
          </p>
        </div>

        {/* My Pets Section */}
        <section>
          <div className="mb-4">
            <h2
              className="text-[32px] text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              My Pets
            </h2>
            <p className="text-sm text-gray-500">Manage your Furry Family Members</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 pt-4">
            {petsLoading && pets.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 w-78.5 h-51.5 shrink-0 flex items-center justify-center">
                <p className="text-sm text-gray-400 animate-pulse">Loading pets...</p>
              </div>
            )}
            {pets.map((pet) => (
              <div
                key={pet.id}
                className={`bg-white rounded-2xl p-5 w-78.5 h-51.5 shrink-0 cursor-pointer hover:shadow-md transition-shadow relative flex flex-col overflow-visible ${
                  pet.status === 'deceased'
                    ? 'border-2 border-amber-400'
                    : pet.isLost
                    ? 'border-2 border-[#900B09]'
                    : 'border border-gray-200'
                }`}
                onClick={() => handlePetClick(pet)}
              >
                {pet.status === 'deceased' ? (
                  <div className="absolute -top-3 right-4 bg-amber-500 text-white text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10 flex items-center gap-1">
                    <Skull className="w-3 h-3" />
                    Deceased
                  </div>
                ) : pet.isLost ? (
                  <div className="absolute -top-3 right-4 bg-[#900B09] text-white text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10">
                    Marked as LOST
                  </div>
                ) : null}
                {pet.previousOwners.length > 0 && (
                  <div className="absolute -top-3 left-4 bg-[#F1F0ED] text-[#4F4F4F] text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10">
                    Past Owner: {pet.previousOwners[pet.previousOwners.length - 1].name}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {pet.image ? (
                      <Image src={pet.image} alt={pet.name} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      <PawPrint className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#4F4F4F] text-base">{pet.name}</p>
                    <p className="text-xs text-gray-500">
                      {pet.breed} | {pet.sex} | {pet.age}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-200 my-3" />
                <div className="flex gap-2 mt-auto">
                  <div className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.weight}</p>
                    <p className="text-[10px] text-gray-400">Weight</p>
                  </div>
                  <div className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.lastVisit}</p>
                    <p className="text-[10px] text-gray-400">Last Visit</p>
                  </div>
                  <div className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.nextVisit}</p>
                    <p className="text-[10px] text-gray-400">Next Visit</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Add New Pet Card */}
            <div
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 w-78.5 h-51.5 shrink-0 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors"
              onClick={() => router.push('/onboarding/pet?from=dashboard')}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-semibold text-[#4F4F4F]">Add New Pet</p>
              <p className="text-xs text-gray-400 mt-0.5">Register another Furry Friend</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className="mb-4">
            <h2
              className="text-[32px] text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Quick Actions
            </h2>
            <p className="text-sm text-gray-500">Common tasks at your Fingertips</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const isLostPetAction = action.href === '#'
              const canUseAction = isLostPetAction ? pets.some((pet) => hasRegisteredNfcTag(pet) && pet.isAlive && pet.status !== 'deceased') : true
              const actionTooltip = !canUseAction && isLostPetAction
                ? 'Purchase a pet tag first to unlock this feature.'
                : undefined

              return (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`bg-white rounded-2xl border p-5 transition-all group ${
                        canUseAction
                          ? 'border-gray-200 cursor-pointer hover:shadow-md hover:border-[#7FA5A3]'
                          : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-70'
                      }`}
                      onClick={() => canUseAction && handleQuickAction(action.href)}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${
                        canUseAction
                          ? 'bg-[#F8F6F2] group-hover:bg-[#7FA5A3]/15'
                          : 'bg-gray-100'
                      }`}>
                        {action.icon}
                      </div>
                      <p className="font-semibold text-[#4F4F4F] text-sm">{action.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{action.description}</p>
                    </div>
                  </TooltipTrigger>
                  {actionTooltip && (
                    <TooltipContent side="top" sideOffset={8}>
                      {actionTooltip}
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </div>
        </section>

        {/* Upcoming Appointments */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-[32px] text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Upcoming Appointments
            </h2>
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#7FA5A3] transition-colors"
              onClick={() => router.push('/my-appointments')}
            >
              View all
              <Filter className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 max-h-100 overflow-y-auto">
            {appointments.length > 0 ? (
              appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="bg-[#F8F6F2] rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center bg-[#7FA5A3]/20 rounded-xl w-14 h-14 shrink-0">
                    <span className="text-lg font-bold text-[#476B6B] leading-tight">
                      {appt.date.getDate()}
                    </span>
                    <span className="text-[10px] text-[#476B6B] font-medium">
                      {monthNames[appt.date.getMonth()]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#4F4F4F]">{appt.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {appt.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {appt.clinic}
                      </span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <PawPrint className="w-3 h-3 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#4F4F4F]">{appt.petName}</p>
                      <p className="text-[10px] text-gray-400">{appt.petBreed}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                      appt.status === 'CONFIRMED'
                        ? 'bg-green-100 text-green-700'
                        : appt.status === 'IN PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : appt.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : appt.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>
              ))
            ) : appointmentsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading appointments...</div>
            ) : (
              <div className="text-center py-8 text-gray-500">No upcoming appointments</div>
            )}
          </div>
        </section>
      </div>

      {/* Pet Detail Modal */}
      <PetDetailModal
        pet={selectedPet}
        open={petModalOpen}
        onClose={() => setPetModalOpen(false)}
        onReportLost={handleReportLost}
        onMarkFound={handleMarkFound}
        onRemovePet={handleRemovePet}
        onNavigateToMedicalRecords={() => router.push(`/dashboard/medical-records?petId=${selectedPet?.id}`)}
      />

      {/* Report Lost Pet Modal */}
      <ReportLostPetModal
        pet={reportLostPet}
        pets={reportLostFromDetail ? undefined : pets}
        open={reportLostOpen}
        onClose={() => setReportLostOpen(false)}
        onMarkedLost={fetchPets}
      />

      {/* Remove Pet Modal */}
      <RemovePetModal
        pet={removePetTarget}
        open={removePetOpen}
        onClose={() => setRemovePetOpen(false)}
        onPetRemoved={fetchPets}
      />

      <Dialog
        open={showStrangerReportedLostModal}
        onOpenChange={(open) => {
          if (!open && strangerReportedLostPet) {
            sessionStorage.setItem(`stranger-lost-alert-seen-${strangerReportedLostPet.id}`, '1')
          }
          setShowStrangerReportedLostModal(open)
        }}
      >
        <DialogContent className="max-w-md w-[95vw] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#900B09] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Pet Marked as Lost
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Someone found <span className="font-semibold text-[#4F4F4F]">{strangerReportedLostPet?.name}</span> and marked this pet as lost on the public profile. This report has already notified you.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <button
              onClick={() => {
                if (strangerReportedLostPet) {
                  sessionStorage.setItem(`stranger-lost-alert-seen-${strangerReportedLostPet.id}`, '1')
                }
                setShowStrangerReportedLostModal(false)
              }}
              className="w-full px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors"
            >
              Okay
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
