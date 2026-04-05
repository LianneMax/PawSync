'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import {
  Search, UserPlus, RefreshCw, Mail, Phone, PawPrint,
  CheckCircle, Clock, AlertCircle, Send, X,
  ArrowLeft, ArrowRight, ChevronDown, Dog, Cat, Plus,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BreedCombobox } from '@/components/ui/breed-combobox'
import { DatePicker } from '@/components/ui/date-picker'
import AvatarUpload from '@/components/avatar-upload'
import { uploadImage } from '@/lib/upload'
import { toast } from 'sonner'
import {
  getClinicPetOwners,
  createPetOwnerProfile,
  sendPetOwnerInvite,
  checkClientAvailability,
  type ClinicPetOwner,
  type OwnerInviteStatus,
} from '@/lib/clinics'
import { createPet } from '@/lib/pets'

// ==================== HELPERS ====================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ==================== STATUS CONFIG ====================
// Collapsed to 3 displayed statuses: Pending (not yet activated), Expired (token expired), Activated.
// Internally 'invited' and 'resent' both display as 'pending' since the invite has been sent but not activated.

type DisplayStatus = 'pending' | 'expired' | 'activated'

function toDisplayStatus(status: OwnerInviteStatus): DisplayStatus {
  if (status === 'activated') return 'activated'
  if (status === 'expired') return 'expired'
  return 'pending' // covers 'pending', 'invited', 'resent'
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    classes: '',
    icon: <Clock className="w-3 h-3" />,
  },
  expired: {
    label: 'Expired',
    classes: 'bg-red-50 text-red-700 border border-red-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  activated: {
    label: 'Activated',
    classes: '',
    icon: <CheckCircle className="w-3 h-3" />,
  },
}

function StatusBadge({ status }: { status: OwnerInviteStatus }) {
  const ds = toDisplayStatus(status)
  const cfg = STATUS_CONFIG[ds]
  const isActivated = ds === 'activated'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.classes}`}
      style={isActivated ? { backgroundColor: '#D5F4D2', color: '#35785C' } : ds === 'pending' ? { backgroundColor: '#C5D8FF', color: '#4569B1' } : undefined}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

const canSendInvite = (status: OwnerInviteStatus) =>
  status !== 'activated'

// ==================== CREATE OWNER MODAL (3-step) ====================

type ModalStep = 1 | 2 | 3

interface PetFormState {
  species: 'canine' | 'feline' | null
  photo: string | null
  name: string
  breed: string
  secondaryBreed: string
  sex: string
  sterilization: string
  weight: string
  dateOfBirth: string
  color: string
}

const EMPTY_PET: PetFormState = {
  species: null, photo: null, name: '', breed: '',
  secondaryBreed: '', sex: '', sterilization: '',
  weight: '', dateOfBirth: '', color: '',
}

interface CreateOwnerModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  token: string | null
}

function PetForm({
  pet,
  petErrors,
  updatePet,
  title,
}: {
  pet: PetFormState
  petErrors: Record<string, boolean>
  updatePet: (field: keyof PetFormState, value: any) => void
  title?: string
}) {
  return (
    <div className="space-y-4">
      {title && <p className="text-xs text-gray-500 font-medium">{title}</p>}

      {/* Species */}
      <div>
        <label className="block text-xs font-medium text-[#4F4F4F] mb-2">
          Species <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['canine', 'feline'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updatePet('species', s)}
              className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                petErrors.species && !pet.species
                  ? 'border-red-400'
                  : pet.species === s
                    ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${pet.species === s ? 'bg-[#5A7C7A]' : 'bg-gray-200'}`}>
                {s === 'canine'
                  ? <Dog className="w-5 h-5 text-white" />
                  : <Cat className="w-5 h-5 text-white" />}
              </div>
              <span className="text-sm font-medium text-[#4F4F4F]">
                {s === 'canine' ? 'Dog' : 'Cat'}
              </span>
            </button>
          ))}
        </div>
        {petErrors.species && <p className="text-xs text-red-500 mt-1">Please select a species</p>}
      </div>

      {/* Photo */}
      <div className="bg-gray-50 rounded-xl p-4">
        <AvatarUpload
          className="w-full"
          maxSize={5 * 1024 * 1024}
          placeholderIcon={<PawPrint className="w-5 h-5 text-gray-400" />}
          onFileChange={(file) => {
            if (file?.file instanceof File) {
              uploadImage(file.file, 'pets').then((url) => updatePet('photo', url)).catch(console.error)
            } else {
              updatePet('photo', null)
            }
          }}
        >
          <div className="flex-1 pt-1">
            <h3 className="text-sm font-semibold text-[#4F4F4F]">Upload a photo <span className="text-gray-400 font-normal">(optional)</span></h3>
            <p className="text-xs text-gray-500 mt-0.5">Helps vets identify the pet. Can be added later.</p>
          </div>
        </AvatarUpload>
      </div>

      {/* Name */}
      <div>
        <input
          type="text"
          placeholder="Pet name *"
          value={pet.name}
          onChange={(e) => updatePet('name', e.target.value)}
          className={`w-full px-4 py-2.5 bg-gray-50 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${petErrors.name ? 'border-red-400' : 'border-gray-200'}`}
        />
        {petErrors.name && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
      </div>

      {/* Breeds */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <BreedCombobox
            species={pet.species}
            value={pet.breed}
            onChange={(v) => {
              updatePet('breed', v)
              if (pet.secondaryBreed.toLowerCase() === v.toLowerCase()) {
                updatePet('secondaryBreed', '')
                toast.error('Primary and secondary breeds cannot be the same')
              }
            }}
            placeholder="Primary Breed *"
            error={petErrors.breed}
          />
          {petErrors.breed && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
        </div>
        <BreedCombobox
          species={pet.species}
          value={pet.secondaryBreed}
          onChange={(v) => {
            if (v.toLowerCase() === pet.breed.toLowerCase()) {
              toast.error('Primary and secondary breeds cannot be the same')
            } else {
              updatePet('secondaryBreed', v)
            }
          }}
          placeholder="Secondary Breed (optional)"
          error={false}
        />
      </div>

      {/* Sex / Sterilization / Weight */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-full px-3 py-2.5 bg-gray-50 rounded-xl border text-sm flex items-center justify-between ${petErrors.sex ? 'border-red-400' : 'border-gray-200'}`}
              >
                <span className={pet.sex ? 'text-gray-900' : 'text-gray-400'}>
                  {pet.sex ? (pet.sex === 'male' ? 'Male' : 'Female') : 'Sex *'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
              <DropdownMenuRadioGroup value={pet.sex} onValueChange={(v) => updatePet('sex', v)}>
                <DropdownMenuRadioItem value="male">Male</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="female">Female</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {petErrors.sex && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
        </div>

        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-full px-3 py-2.5 bg-gray-50 rounded-xl border text-sm flex items-center justify-between ${petErrors.sterilization ? 'border-red-400' : 'border-gray-200'}`}
              >
                <span className={pet.sterilization ? 'text-gray-900' : 'text-gray-400'} style={{ fontSize: '12px' }}>
                  {pet.sterilization
                    ? pet.sterilization.charAt(0).toUpperCase() + pet.sterilization.slice(1)
                    : 'Sterilization *'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
              <DropdownMenuRadioGroup value={pet.sterilization} onValueChange={(v) => updatePet('sterilization', v)}>
                {pet.sex === 'female' ? (
                  <>
                    <DropdownMenuRadioItem value="spayed">Spayed</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="unspayed">Unspayed</DropdownMenuRadioItem>
                  </>
                ) : pet.sex === 'male' ? (
                  <>
                    <DropdownMenuRadioItem value="neutered">Neutered</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="unneutered">Unneutered</DropdownMenuRadioItem>
                  </>
                ) : null}
                <DropdownMenuRadioItem value="unknown">Unknown</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {!pet.sex && <p className="text-xs text-gray-400 mt-1 ml-1">Select sex first</p>}
          {petErrors.sterilization && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
        </div>

        <div>
          <input
            type="number"
            placeholder="Weight (kg) *"
            value={pet.weight}
            onChange={(e) => updatePet('weight', e.target.value)}
            className={`w-full px-3 py-2.5 bg-gray-50 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${petErrors.weight ? 'border-red-400' : 'border-gray-200'}`}
          />
          {petErrors.weight && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <DatePicker
          value={pet.dateOfBirth}
          onChange={(v) => updatePet('dateOfBirth', v)}
          placeholder="Date of Birth *"
          error={petErrors.dateOfBirth || petErrors.dateOfBirthFuture}
        />
        {petErrors.dateOfBirthFuture
          ? <p className="text-xs text-red-500 mt-1 ml-1">Date of birth cannot be in the future</p>
          : <p className="text-xs text-gray-400 mt-1 ml-1">If unsure, enter an approximate date</p>}
      </div>

      {/* Color */}
      <div>
        <textarea
          placeholder="Pet color (e.g. white, brown, bicolor, tricolor)"
          value={pet.color}
          onChange={(e) => updatePet('color', e.target.value)}
          rows={2}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all resize-none"
        />
      </div>
    </div>
  )
}

function validatePet(pet: PetFormState): Record<string, boolean> {
  const errors: Record<string, boolean> = {}
  if (!pet.species) errors.species = true
  if (!pet.name.trim()) errors.name = true
  if (!pet.breed) errors.breed = true
  if (!pet.sex) errors.sex = true
  if (!pet.sterilization) errors.sterilization = true
  if (!pet.weight.trim() || isNaN(parseFloat(pet.weight))) errors.weight = true
  if (!pet.dateOfBirth) errors.dateOfBirth = true
  if (pet.dateOfBirth && new Date(pet.dateOfBirth) > new Date()) errors.dateOfBirthFuture = true
  return errors
}

function CreateOwnerModal({ open, onClose, onCreated, token }: CreateOwnerModalProps) {
  const [step, setStep] = useState<ModalStep>(1)

  // Step 1 — owner fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [ownerErrors, setOwnerErrors] = useState<Record<string, string>>({})
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Step 2 — required pet
  const [pet1, setPet1] = useState<PetFormState>(EMPTY_PET)
  const [pet1Errors, setPet1Errors] = useState<Record<string, boolean>>({})

  // Step 3 — optional second pet
  const [pet2, setPet2] = useState<PetFormState>(EMPTY_PET)
  const [pet2Errors, setPet2Errors] = useState<Record<string, boolean>>({})

  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep(1)
    setFirstName(''); setLastName(''); setEmail(''); setContactNumber('')
    setOwnerErrors({})
    setPet1(EMPTY_PET); setPet1Errors({})
    setPet2(EMPTY_PET); setPet2Errors({})
  }

  const handleClose = () => { reset(); onClose() }

  const updatePet1 = (field: keyof PetFormState, value: any) => {
    setPet1(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'sex') updated.sterilization = ''
      return updated
    })
    setPet1Errors(prev => ({ ...prev, [field]: false }))
  }

  const updatePet2 = (field: keyof PetFormState, value: any) => {
    setPet2(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'sex') updated.sterilization = ''
      return updated
    })
    setPet2Errors(prev => ({ ...prev, [field]: false }))
  }

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  const handleNextStep = async () => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'Required'
    if (!lastName.trim()) errors.lastName = 'Required'
    if (!email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email'
    if (Object.keys(errors).length > 0) { setOwnerErrors(errors); return }

    // Live duplicate check
    setCheckingAvailability(true)
    try {
      const res = await checkClientAvailability(
        { email: email.trim(), contactNumber: contactNumber.trim() || undefined },
        token ?? undefined
      )
      if (res.status === 'SUCCESS' && res.data?.conflicts) {
        const conflicts = res.data.conflicts
        const newErrors: Record<string, string> = {}
        if (conflicts.email) newErrors.email = conflicts.email
        if (conflicts.contactNumber) newErrors.contactNumber = conflicts.contactNumber
        if (Object.keys(newErrors).length > 0) { setOwnerErrors(newErrors); return }
      }
    } catch {
      // non-fatal — let backend catch it at submit
    } finally {
      setCheckingAvailability(false)
    }

    setOwnerErrors({})
    setStep(2)
  }

  // ── Step 2 → Step 3 ────────────────────────────────────────────────────────
  const handleNextToStep3 = () => {
    const errors = validatePet(pet1)
    if (Object.keys(errors).length > 0) { setPet1Errors(errors); return }
    setPet1Errors({})
    setStep(3)
  }

  // ── Final submit (from step 2 OR step 3) ───────────────────────────────────
  const handleSubmit = async (skipSecondPet: boolean) => {
    // Validate second pet only if not skipping and has any data
    if (!skipSecondPet) {
      const errors = validatePet(pet2)
      if (Object.keys(errors).length > 0) { setPet2Errors(errors); return }
      setPet2Errors({})
    }

    setLoading(true)
    try {
      // 1. Create owner profile
      const ownerRes = await createPetOwnerProfile(
        { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), contactNumber: contactNumber.trim() || undefined },
        token ?? undefined
      )
      if (ownerRes.status !== 'SUCCESS' || !ownerRes.data?.owner?.id) {
        toast.error(ownerRes.message || 'Failed to create client profile.')
        setLoading(false)
        return
      }
      const ownerId = ownerRes.data.owner.id

      // 2. Create first pet
      const pet1Res = await createPet({
        ownerId,
        name: pet1.name.trim(),
        species: pet1.species!,
        breed: pet1.breed,
        secondaryBreed: pet1.secondaryBreed || undefined,
        sex: pet1.sex as 'male' | 'female',
        dateOfBirth: pet1.dateOfBirth,
        weight: parseFloat(pet1.weight),
        sterilization: pet1.sterilization as any,
        photo: pet1.photo || undefined,
        color: pet1.color || undefined,
      }, token ?? undefined)

      if (pet1Res.status !== 'SUCCESS') {
        toast.error(pet1Res.message || 'Failed to create pet profile.')
        setLoading(false)
        return
      }

      // 3. Optionally create second pet
      if (!skipSecondPet) {
        const pet2Res = await createPet({
          ownerId,
          name: pet2.name.trim(),
          species: pet2.species!,
          breed: pet2.breed,
          secondaryBreed: pet2.secondaryBreed || undefined,
          sex: pet2.sex as 'male' | 'female',
          dateOfBirth: pet2.dateOfBirth,
          weight: parseFloat(pet2.weight),
          sterilization: pet2.sterilization as any,
          photo: pet2.photo || undefined,
          color: pet2.color || undefined,
        }, token ?? undefined)

        if (pet2Res.status !== 'SUCCESS') {
          toast.warning(`First pet saved, but second pet failed: ${pet2Res.message || 'Unknown error'}`)
        }
      }

      // 4. Send activation invite
      const inviteRes = await sendPetOwnerInvite(ownerId, token ?? undefined)
      if (inviteRes.status !== 'SUCCESS') {
        toast.warning('Profile and pet(s) created, but the invite email failed. You can resend from the Clients list.')
      } else {
        toast.success(`Profile created and invite sent to ${email.trim()}.`)
      }

      reset()
      onCreated()
      onClose()
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const stepDots = [1, 2, 3] as const

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#4F4F4F]">
              {step === 1 ? 'Client Details' : step === 2 ? 'Pet Details' : 'Add Another Pet'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 1
                ? 'Step 1 of 3 — Owner information'
                : step === 2
                  ? 'Step 2 of 3 — Register at least one pet'
                  : 'Step 3 of 3 — Optional additional pet'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {stepDots.map((s) => (
                <div
                  key={s}
                  className={`rounded-full transition-colors ${
                    step === s ? 'w-2 h-2 bg-[#476B6B]' : step > s ? 'w-2 h-2 bg-[#7FA5A3]' : 'w-2 h-2 bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── STEP 1: Owner Details ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4F4F4F] mb-1">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setOwnerErrors(p => ({ ...p, firstName: '' })) }}
                  placeholder="e.g. Maria"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${ownerErrors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                {ownerErrors.firstName && <p className="text-xs text-red-500 mt-1">{ownerErrors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4F4F4F] mb-1">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setOwnerErrors(p => ({ ...p, lastName: '' })) }}
                  placeholder="e.g. Santos"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${ownerErrors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                {ownerErrors.lastName && <p className="text-xs text-red-500 mt-1">{ownerErrors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setOwnerErrors(p => ({ ...p, email: '' })) }}
                  placeholder="client@email.com"
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${ownerErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
              </div>
              {ownerErrors.email && <p className="text-xs text-red-500 mt-1">{ownerErrors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1">
                Contact Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => { setContactNumber(e.target.value); setOwnerErrors(p => ({ ...p, contactNumber: '' })) }}
                  placeholder="e.g. 09171234567"
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${ownerErrors.contactNumber ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
              </div>
              {ownerErrors.contactNumber && <p className="text-xs text-red-500 mt-1">{ownerErrors.contactNumber}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={checkingAvailability}
                className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {checkingAvailability
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Checking…</>
                  : <>Next: Add Pet <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Required Pet ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <PetForm pet={pet1} petErrors={pet1Errors} updatePet={updatePet1} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleNextToStep3}
                className="flex-1 px-4 py-2.5 border border-[#476B6B] text-[#476B6B] rounded-lg text-sm font-semibold transition-colors hover:bg-[#476B6B]/5 flex items-center justify-center gap-2"
              >
                Add Another Pet <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const errors = validatePet(pet1)
                  if (Object.keys(errors).length > 0) { setPet1Errors(errors); return }
                  handleSubmit(true)
                }}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>
                  : <><Send className="w-4 h-4" />Create & Send Invite</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Optional Second Pet ───────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-[#7FA5A3]/10 border border-[#7FA5A3]/30 rounded-xl text-xs text-[#4F4F4F]">
                This step is optional. You can skip it and the owner will still receive their activation invite.
              </div>
              <PetForm pet={pet2} petErrors={pet2Errors} updatePet={updatePet2} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Skip & Send Invite
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>
                  : <><Send className="w-4 h-4" />Create & Send Invite</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== ADD PET MODAL ====================

interface AddPetModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  token: string | null
  owner: ClinicPetOwner | null
}

function AddPetModal({ open, onClose, onCreated, token, owner }: AddPetModalProps) {
  const [pet, setPet] = useState<PetFormState>(EMPTY_PET)
  const [petErrors, setPetErrors] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const reset = () => { setPet(EMPTY_PET); setPetErrors({}) }
  const handleClose = () => { reset(); onClose() }

  const updatePet = (field: keyof PetFormState, value: any) => {
    setPet((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'sex') updated.sterilization = ''
      return updated
    })
    setPetErrors((prev) => ({ ...prev, [field]: false }))
  }

  const handleSubmit = async () => {
    const errors = validatePet(pet)
    if (Object.keys(errors).length > 0) { setPetErrors(errors); return }
    if (!owner || !token) return
    setLoading(true)
    try {
      const res = await createPet({
        ownerId: owner.id,
        name: pet.name.trim(),
        species: pet.species!,
        breed: pet.breed,
        secondaryBreed: pet.secondaryBreed || undefined,
        sex: pet.sex as 'male' | 'female',
        dateOfBirth: pet.dateOfBirth,
        weight: parseFloat(pet.weight),
        sterilization: pet.sterilization as any,
        photo: pet.photo || undefined,
        color: pet.color || undefined,
      }, token)
      if (res.status !== 'SUCCESS') {
        toast.error(res.message || 'Failed to create pet profile.')
        return
      }
      toast.success(`Pet added to ${owner.firstName} ${owner.lastName}.`)
      reset()
      onCreated()
      onClose()
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !owner) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#4F4F4F]">Add Pet</h2>
            <p className="text-xs text-gray-400 mt-0.5">Adding a pet for {owner.firstName} {owner.lastName}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <PetForm pet={pet} petErrors={petErrors} updatePet={updatePet} />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              : <><Plus className="w-4 h-4" />Add Pet</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== OWNER AVATAR ====================

function OwnerAvatar({ owner }: { owner: ClinicPetOwner }) {
  if (owner.photo) {
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-gray-200">
        <Image
          src={owner.photo}
          alt={`${owner.firstName} ${owner.lastName}`}
          width={36}
          height={36}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 bg-[#7FA5A3]/15 rounded-full flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-[#476B6B]">{owner.firstName.charAt(0).toUpperCase()}</span>
    </div>
  )
}

// ==================== MAIN PAGE ====================

type StatusFilter = 'All' | DisplayStatus

const DISPLAY_FILTERS: StatusFilter[] = ['All', 'pending', 'expired', 'activated']

function ClientsPageContent() {
  const token = useAuthStore((state) => state.token)
  const searchParams = useSearchParams()
  const router = useRouter()

  const [owners, setOwners] = useState<ClinicPetOwner[]>([])
  const [filtered, setFiltered] = useState<ClinicPetOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [addPetTarget, setAddPetTarget] = useState<ClinicPetOwner | null>(null)
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null)
  const [resendingAll, setResendingAll] = useState(false)

  // Auto-open modal if ?addClient=true
  useEffect(() => {
    if (searchParams.get('addClient') === 'true') {
      setCreateModalOpen(true)
      // Clean the URL param without reloading
      router.replace('/clinic-admin/clients', { scroll: false })
    }
  }, [searchParams, router])

  const fetchOwners = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await getClinicPetOwners(token)
      if (res.status === 'SUCCESS' && res.data?.owners) {
        setOwners(res.data.owners)
        setFiltered(res.data.owners)
      } else {
        setOwners([]); setFiltered([])
      }
    } catch {
      toast.error('Failed to load clients.')
      setOwners([]); setFiltered([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const applyFilters = useCallback((data: ClinicPetOwner[], status: StatusFilter, query: string) => {
    let result = data
    if (status !== 'All') {
      result = result.filter((o) => toDisplayStatus(o.inviteStatus) === status)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (o) =>
          o.firstName.toLowerCase().includes(q) ||
          o.lastName.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          (o.contactNumber || '').includes(q)
      )
    }
    setFiltered(result)
  }, [])

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status)
    applyFilters(owners, status, searchQuery)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(owners, statusFilter, query)
  }

  const handleSendInvite = async (owner: ClinicPetOwner) => {
    setSendingInviteId(owner.id)
    try {
      const res = await sendPetOwnerInvite(owner.id, token ?? undefined)
      if (res.status === 'SUCCESS') {
        toast.success(owner.inviteStatus === 'pending'
          ? `Invite sent to ${owner.email}.`
          : `Invite resent to ${owner.email}.`)
        fetchOwners()
      } else {
        toast.error(res.message || 'Failed to send invite.')
      }
    } catch {
      toast.error('An error occurred. Please try again.')
    } finally {
      setSendingInviteId(null)
    }
  }

  const handleResendAll = async () => {
    const expiredOwners = owners.filter((o) => o.inviteStatus === 'expired')
    if (expiredOwners.length === 0) return
    setResendingAll(true)
    let successCount = 0
    let failCount = 0
    for (const owner of expiredOwners) {
      try {
        const res = await sendPetOwnerInvite(owner.id, token ?? undefined)
        if (res.status === 'SUCCESS') successCount++
        else failCount++
      } catch {
        failCount++
      }
    }
    setResendingAll(false)
    if (successCount > 0) toast.success(`Resent invite to ${successCount} owner${successCount !== 1 ? 's' : ''}.`)
    if (failCount > 0) toast.error(`Failed to resend ${failCount} invite${failCount !== 1 ? 's' : ''}.`)
    fetchOwners()
  }

  useEffect(() => { fetchOwners() }, [fetchOwners])

  // Status counts for filter pills (using display status)
  const counts = owners.reduce<Record<string, number>>((acc, o) => {
    const ds = toDisplayStatus(o.inviteStatus)
    acc[ds] = (acc[ds] ?? 0) + 1
    return acc
  }, {})

  const expiredCount = counts['expired'] ?? 0

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 w-full max-w-none h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Clients"
            subtitle="Manage pet owner profiles and track onboarding status"
          />
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Client
          </button>
        </div>

        {/* Status Filter Pills */}
        <div className="mb-6 flex items-center gap-3 overflow-x-auto min-w-0">
          <span className="text-sm font-semibold text-[#2D5353] shrink-0">Status:</span>
          <div className="inline-flex bg-white border border-[#DCEAE3] rounded-full p-1 gap-1 min-w-max">
            {DISPLAY_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-white/70'
                }`}
              >
                {s === 'All' ? 'All' : STATUS_CONFIG[s].label}
                {s !== 'All' && counts[s] !== undefined && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    statusFilter === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Resend All — only shown when Expired filter is active */}
          {statusFilter === 'expired' && expiredCount > 0 && (
            <button
              onClick={handleResendAll}
              disabled={resendingAll}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {resendingAll
                ? <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Resend All ({expiredCount})
            </button>
          )}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-md flex-1 w-full max-w-none">
          {/* Search + Actions */}
          <div className="bg-white px-6 py-5 border-b border-[#EAECF0] shadow-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or contact number"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>
              <button
                onClick={fetchOwners}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_120px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
            <span>Client</span>
            <span>Contact</span>
            <span>Pets</span>
            <span>Last Action</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <UserPlus className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 mb-2">No clients found</h3>
                <p className="text-gray-400 text-sm text-center">
                  {owners.length === 0
                    ? 'No client profiles have been created yet. Click "Add Client" to get started.'
                    : 'Try adjusting your filters or search query.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((owner) => (
                  <div key={owner.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    {/* Mobile */}
                    <div className="lg:hidden space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <OwnerAvatar owner={owner} />
                          <div>
                            <Link href={`/clinic-admin/clients/${owner.id}`} className="font-semibold text-[#476B6B] hover:underline">
                              {owner.firstName} {owner.lastName}
                            </Link>
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{owner.email}</p>
                            {owner.contactNumber && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{owner.contactNumber}</p>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={owner.inviteStatus} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><PawPrint className="w-3 h-3" />{owner.petCount} pet{owner.petCount !== 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(owner.lastInviteSentAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canSendInvite(owner.inviteStatus) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleSendInvite(owner)}
                                  disabled={sendingInviteId === owner.id}
                                  className="flex items-center justify-center p-2 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50"
                                >
                                  {sendingInviteId === owner.id
                                    ? <div className="w-3.5 h-3.5 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                {owner.inviteStatus === 'pending' ? 'Send Invite' : 'Resend Invite'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {canSendInvite(owner.inviteStatus) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setAddPetTarget(owner)}
                                  className="flex items-center justify-center p-2 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>Add Pet</TooltipContent>
                            </Tooltip>
                          ) : (
                            <button
                              onClick={() => setAddPetTarget(owner)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors text-xs font-semibold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Pet
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_120px] gap-4 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <OwnerAvatar owner={owner} />
                        <div className="min-w-0">
                          <Link href={`/clinic-admin/clients/${owner.id}`} className="font-semibold text-[#476B6B] hover:underline truncate block">
                            {owner.firstName} {owner.lastName}
                          </Link>
                          <p className="text-xs text-gray-400 truncate">{owner.email}</p>
                        </div>
                      </div>

                      <div className="min-w-0">
                        {owner.contactNumber
                          ? <p className="text-sm text-[#4F4F4F]">{owner.contactNumber}</p>
                          : <p className="text-sm text-gray-300">—</p>}
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-[#4F4F4F]">
                        <PawPrint className="w-4 h-4 text-[#7FA5A3]" />
                        {owner.petCount}
                      </div>

                      <div>
                        <p className="text-sm text-[#4F4F4F]">{formatDate(owner.lastInviteSentAt)}</p>
                        {owner.inviteStatus === 'activated' && owner.activatedAt && (
                          <p className="text-xs text-gray-400">Activated {formatDate(owner.activatedAt)}</p>
                        )}
                      </div>

                      <div><StatusBadge status={owner.inviteStatus} /></div>

                      <div className="flex items-center gap-1.5 w-full">
                        {canSendInvite(owner.inviteStatus) ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleSendInvite(owner)}
                                  disabled={sendingInviteId === owner.id}
                                  className="flex flex-1 items-center justify-center py-1.5 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50"
                                >
                                  {sendingInviteId === owner.id
                                    ? <div className="w-3.5 h-3.5 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" sideOffset={6}>
                                {owner.inviteStatus === 'pending' ? 'Send Invite' : 'Resend Invite'}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setAddPetTarget(owner)}
                                  className="flex flex-1 items-center justify-center py-1.5 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" sideOffset={6}>
                                Add Pet
                              </TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <button
                            onClick={() => setAddPetTarget(owner)}
                            className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[#476B6B] border border-[#476B6B]/30 hover:bg-[#476B6B]/5 transition-colors text-xs font-semibold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Pet
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
              <p className="text-xs text-gray-400">
                Showing {filtered.length} of {owners.length} client{owners.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      <CreateOwnerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchOwners}
        token={token}
      />

      <AddPetModal
        open={addPetTarget !== null}
        onClose={() => setAddPetTarget(null)}
        onCreated={fetchOwners}
        token={token}
        owner={addPetTarget}
      />
    </DashboardLayout>
  )
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-8 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" /></div></DashboardLayout>}>
      <ClientsPageContent />
    </Suspense>
  )
}
