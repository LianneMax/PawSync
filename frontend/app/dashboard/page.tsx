'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, togglePetLost, removePet, transferPet, type Pet as APIPet } from '@/lib/pets'
import {
  Calendar,
  PawPrint,
  FileText,
  Syringe,
  AlertTriangle,
  Plus,
  Clock,
  MapPin,
  Filter,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// --- Types ---
interface Pet {
  id: string
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
  sterilization: string
  microchipNumber: string
  bloodType: string
  allergies: string[]
  nfcTagId: string
  vet: { name: string; clinic: string; verified: boolean }
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

function apiPetToDashboardPet(apiPet: APIPet): Pet {
  return {
    id: apiPet._id,
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
    sterilization: apiPet.sterilization === 'yes' ? 'NEUTERED' : apiPet.sterilization === 'no' ? 'UNNEUTERED' : 'UNKNOWN',
    microchipNumber: apiPet.microchipNumber || '-',
    bloodType: apiPet.bloodType || '-',
    allergies: apiPet.allergies,
    nfcTagId: apiPet.nfcTagId || '-',
    vet: { name: '-', clinic: '-', verified: false },
  }
}

const mockAppointments = [
  {
    id: '1',
    title: 'Rabies Vaccination',
    date: new Date(2026, 0, 25),
    time: '10:00 am - 10:30 am',
    clinic: 'BaiVet Animal Clinic',
    petName: 'Coco',
    petBreed: 'Pomeranian',
    status: 'CONFIRMED' as const,
  },
  {
    id: '2',
    title: 'Deworming',
    date: new Date(2026, 1, 17),
    time: '10:00 am - 10:30 am',
    clinic: 'BaiVet Animal Clinic',
    petName: 'Coco',
    petBreed: 'Pomeranian',
    status: 'PENDING' as const,
  },
]

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

function getStatusColor(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-500 text-white'
    case 'PENDING':
      return 'bg-amber-500 text-white'
    case 'CANCELLED':
      return 'bg-red-500 text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

// --- Pet Detail Modal ---
function PetDetailModal({
  pet,
  open,
  onClose,
  onReportLost,
  onRemovePet,
  onNavigateToMedicalRecords,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
  onReportLost: (pet: Pet) => void
  onRemovePet: (pet: Pet) => void
  onNavigateToMedicalRecords: () => void
}) {
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
            {pet.vet.name !== '-' ? (
              <div className="bg-[#7FA5A3] rounded-2xl p-4 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
                <div className="w-10 h-10 bg-white/20 rounded-full shrink-0 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{pet.vet.name.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{pet.vet.name}</p>
                  <p className="text-white/70 text-xs">{pet.vet.clinic}</p>
                </div>
                {pet.vet.verified && (
                  <span className="bg-[#9EC4C8] text-white text-[10px] font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#679D82] rounded-full animate-pulse" />
                    PRC Verified
                  </span>
                )}
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
              <div className="bg-[#F8F6F2] rounded-lg p-4 min-h-[80px]">
                <p className="text-xs text-gray-400">What Strangers See When Scanning:</p>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => {/* navigate to book appointment */}}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Book Appointment</p>
                <p className="text-xs text-gray-400">Schedule a Vet Visit for {pet.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={onNavigateToMedicalRecords}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">View Medical Records</p>
                <p className="text-xs text-gray-400">Medical History and Reports</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => {/* navigate to vaccine card */}}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Vaccine Card</p>
                <p className="text-xs text-gray-400">View Vaccination History</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => onReportLost(pet)}
            >
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Report {pet.name} as Lost</p>
                <p className="text-xs text-gray-400">Update NFC tag to show Lost Status</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-red-200 rounded-xl p-4 text-left hover:bg-red-50 transition-colors flex items-center justify-between"
              onClick={() => onRemovePet(pet)}
            >
              <div>
                <p className="font-semibold text-[#900B09] text-sm">Remove {pet.name}</p>
                <p className="text-xs text-gray-400">Transfer ownership or remove from profile</p>
              </div>
              <Trash2 className="w-4 h-4 text-[#900B09]" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Report Lost Pet Modal ---
function ReportLostPetModal({
  pet,
  open,
  onClose,
  onMarkedLost,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
  onMarkedLost?: () => void
}) {
  const [contactName, setContactName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [message, setMessage] = useState('')

  if (!pet) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] p-6">
        <DialogHeader className="mb-0">
          <DialogTitle
            className="text-2xl text-[#900B09]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Report Lost Pet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Report {pet.name} as lost
          </DialogDescription>
        </DialogHeader>

        {/* Info Box */}
        <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-[#B71C1C] mb-2">
            What happens when you report a pet as lost?
          </p>
          <p className="text-xs text-[#4F4F4F] leading-relaxed">
            When someone scans your pet&apos;s NFC tag, they will see a &quot;LOST PET&quot; alert with your basic
            contact information. This helps strangers who find your pet contact you immediately.
          </p>
          <p className="text-xs text-[#4F4F4F] mt-2 leading-relaxed">
            Note that you will be able to see the last scanned location of your pet
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">Select Pet</label>
            <div className="w-full border border-gray-200 rounded-xl p-3 bg-white text-sm text-[#4F4F4F]">
              {pet.name} - {pet.breed}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">Name Shown</label>
              <input
                type="text"
                placeholder="Your Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">Contact Number</label>
              <input
                type="text"
                placeholder="+63 123 456 7890"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">
              Additional Message (Optional)
            </label>
            <textarea
              placeholder="e.g., Please call immediately if found. Reward Offered"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
            />
          </div>
        </div>

        <button
          className="w-full bg-[#900B09] hover:bg-[#7A0A08] text-white font-semibold py-3 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
          onClick={async () => {
            try {
              const token = useAuthStore.getState().token
              if (token) {
                await togglePetLost(pet.id, true, token)
              }
              toast('Pet Reported as Lost', {
                description: `${pet.name} has been marked as lost. NFC tag updated.`,
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
          Mark as Lost &amp; Update NFC Tag
        </button>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setReason('')
    setDetails('')
    setNewOwnerEmail('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!pet) return null

  const isTransfer = reason === 'transfer'

  const handleConfirm = async () => {
    if (!reason) {
      setError('Please select a reason')
      return
    }
    if (isTransfer && !newOwnerEmail.trim()) {
      setError('Please enter the new owner\'s email')
      return
    }

    setLoading(true)
    setError('')

    try {
      const token = useAuthStore.getState().token
      if (!token) return

      if (isTransfer) {
        const response = await transferPet(pet.id, newOwnerEmail.trim(), token)
        if (response.status === 'ERROR') {
          setError(response.message || 'Transfer failed')
          setLoading(false)
          return
        }
        toast('Pet Transferred', {
          description: response.message || `${pet.name} has been transferred successfully.`,
          icon: <PawPrint className="w-4 h-4 text-[#7FA5A3]" />,
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
            and all associated data from your account. If you are transferring
            ownership, the pet&apos;s profile will be moved to the new owner.
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

        {/* Transfer email input (conditional) */}
        {isTransfer && (
          <div className="mb-4">
            <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">
              New Owner&apos;s Email
            </label>
            <input
              type="email"
              placeholder="Enter the pet-owner's email address"
              value={newOwnerEmail}
              onChange={(e) => {
                setNewOwnerEmail(e.target.value)
                setError('')
              }}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
            <p className="text-xs text-gray-400 mt-1">
              The recipient must have a PawSync pet-owner account
            </p>
          </div>
        )}

        {/* Details (optional for non-transfer) */}
        {!isTransfer && reason && (
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
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [petModalOpen, setPetModalOpen] = useState(false)
  const [reportLostOpen, setReportLostOpen] = useState(false)
  const [reportLostPet, setReportLostPet] = useState<Pet | null>(null)
  const [removePetOpen, setRemovePetOpen] = useState(false)
  const [removePetTarget, setRemovePetTarget] = useState<Pet | null>(null)

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

  // Fetch pets from API
  const fetchPets = useCallback(async () => {
    if (!token) {
      setPetsLoading(false)
      return
    }
    try {
      setPetsLoading(true)
      const response = await getMyPets(token)
      if (response.status === 'SUCCESS' && response.data?.pets) {
        setPets(response.data.pets.map(apiPetToDashboardPet))
      }
    } catch (error) {
      console.error('Failed to fetch pets:', error)
    } finally {
      setPetsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

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
    setTimeout(() => setReportLostOpen(true), 200)
  }

  const handleRemovePet = (pet: Pet) => {
    setPetModalOpen(false)
    setRemovePetTarget(pet)
    setTimeout(() => setRemovePetOpen(true), 200)
  }

  const handleQuickAction = (href: string) => {
    if (href === '#') {
      if (pets.length > 0) {
        setReportLostPet(pets[0])
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
        <div className="bg-[#476B6B] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h1
              className="text-2xl lg:text-3xl mb-2"
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
          <div className="absolute inset-0 opacity-5">
            <div className="auth-background" />
          </div>
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
              <div className="bg-white rounded-2xl border border-gray-200 p-5 w-[314px] h-[206px] shrink-0 flex items-center justify-center">
                <p className="text-sm text-gray-400 animate-pulse">Loading pets...</p>
              </div>
            )}
            {pets.map((pet) => (
              <div
                key={pet.id}
                className={`bg-white rounded-2xl p-5 w-[314px] h-[206px] shrink-0 cursor-pointer hover:shadow-md transition-shadow relative flex flex-col overflow-visible ${
                  pet.isLost
                    ? 'border-2 border-[#900B09]'
                    : 'border border-gray-200'
                }`}
                onClick={() => handlePetClick(pet)}
              >
                {pet.isLost && (
                  <div className="absolute -top-3 right-4 bg-[#900B09] text-white text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10">
                    Marked as LOST
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
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 w-[314px] h-[206px] shrink-0 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors"
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
            {quickActions.map((action) => (
              <div
                key={action.label}
                className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-[#7FA5A3] transition-all group"
                onClick={() => handleQuickAction(action.href)}
              >
                <div className="w-10 h-10 bg-[#F8F6F2] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#7FA5A3]/15 transition-colors">
                  {action.icon}
                </div>
                <p className="font-semibold text-[#4F4F4F] text-sm">{action.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{action.description}</p>
              </div>
            ))}
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
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {mockAppointments.map((appt) => (
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${getStatusColor(
                    appt.status
                  )}`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Pet Detail Modal */}
      <PetDetailModal
        pet={selectedPet}
        open={petModalOpen}
        onClose={() => setPetModalOpen(false)}
        onReportLost={handleReportLost}
        onRemovePet={handleRemovePet}
        onNavigateToMedicalRecords={() => router.push(`/dashboard/medical-records?petId=${selectedPet?.id}`)}
      />

      {/* Report Lost Pet Modal */}
      <ReportLostPetModal
        pet={reportLostPet}
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
    </DashboardLayout>
  )
}
