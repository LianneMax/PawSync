'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import {
  Search, UserPlus, RefreshCw, Mail, Phone, PawPrint,
  CheckCircle, Clock, AlertCircle, Send, X, User,
  ArrowLeft, ArrowRight, ChevronDown, Dog, Cat,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BreedCombobox } from '@/components/ui/breed-combobox'
import { DatePicker } from '@/components/ui/date-picker'
import AvatarUpload from '@/components/avatar-upload'
import { uploadImage } from '@/lib/upload'
import { toast } from 'sonner'
import {
  getClinicPetOwners,
  createPetOwnerProfile,
  sendPetOwnerInvite,
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

const STATUS_CONFIG: Record<OwnerInviteStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: <Clock className="w-3 h-3" />,
  },
  invited: {
    label: 'Invited',
    classes: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: <Send className="w-3 h-3" />,
  },
  resent: {
    label: 'Resent',
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  expired: {
    label: 'Expired',
    classes: 'bg-red-50 text-red-700 border border-red-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  activated: {
    label: 'Activated',
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
}

function StatusBadge({ status }: { status: OwnerInviteStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ==================== CREATE OWNER MODAL (2-step) ====================

type ModalStep = 1 | 2

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

function CreateOwnerModal({ open, onClose, onCreated, token }: CreateOwnerModalProps) {
  const [step, setStep] = useState<ModalStep>(1)

  // Step 1 — owner fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [ownerErrors, setOwnerErrors] = useState<Record<string, string>>({})

  // Step 2 — pet fields
  const [pet, setPet] = useState<PetFormState>(EMPTY_PET)
  const [petErrors, setPetErrors] = useState<Record<string, boolean>>({})

  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep(1)
    setFirstName(''); setLastName(''); setEmail(''); setContactNumber('')
    setOwnerErrors({})
    setPet(EMPTY_PET)
    setPetErrors({})
  }

  const handleClose = () => { reset(); onClose() }

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  const handleNextStep = () => {
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'Required'
    if (!lastName.trim()) errors.lastName = 'Required'
    if (!email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email'
    if (Object.keys(errors).length > 0) { setOwnerErrors(errors); return }
    setOwnerErrors({})
    setStep(2)
  }

  // ── Final submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate pet fields
    const errors: Record<string, boolean> = {}
    if (!pet.species) errors.species = true
    if (!pet.name.trim()) errors.name = true
    if (!pet.breed) errors.breed = true
    if (!pet.sex) errors.sex = true
    if (!pet.sterilization) errors.sterilization = true
    if (!pet.weight.trim() || isNaN(parseFloat(pet.weight))) errors.weight = true
    if (!pet.dateOfBirth) errors.dateOfBirth = true
    if (pet.dateOfBirth && new Date(pet.dateOfBirth) > new Date()) errors.dateOfBirthFuture = true
    if (Object.keys(errors).length > 0) { setPetErrors(errors); return }
    setPetErrors({})
    setLoading(true)

    try {
      // 1. Create owner profile (no invite sent yet)
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

      // 2. Create pet under the new owner
      const petRes = await createPet({
        ownerId,
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
      }, token ?? undefined)

      if (petRes.status !== 'SUCCESS') {
        toast.error(petRes.message || 'Failed to create pet profile.')
        setLoading(false)
        return
      }

      // 3. Send the activation invite now that the pet exists
      const inviteRes = await sendPetOwnerInvite(ownerId, token ?? undefined)
      if (inviteRes.status !== 'SUCCESS') {
        // Profile + pet are created — just warn, clinic can resend from the table
        toast.warning('Profile and pet created, but the invite email failed. You can resend it from the Clients list.')
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

  const updatePet = (field: keyof PetFormState, value: any) => {
    setPet(prev => {
      const updated = { ...prev, [field]: value }
      // Reset sterilization when sex changes
      if (field === 'sex') updated.sterilization = ''
      return updated
    })
    setPetErrors(prev => ({ ...prev, [field]: false }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#4F4F4F]">
              {step === 1 ? 'Client Details' : 'Pet Details'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 1
                ? 'Step 1 of 2 — Owner information'
                : 'Step 2 of 2 — Register at least one pet'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-[#476B6B]' : 'bg-[#7FA5A3]'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-[#476B6B]' : 'bg-gray-200'}`} />
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
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                />
              </div>
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
                className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Next: Add Pet
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Pet Details ───────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

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
                  onChange={(v) => { updatePet('dateOfBirth', v); setPetErrors(p => ({ ...p, dateOfBirthFuture: false })) }}
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

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating Profile…</>
                  : <><Send className="w-4 h-4" />Create & Send Invite</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ==================== MAIN PAGE ====================

type StatusFilter = 'All' | OwnerInviteStatus

const canSendInvite = (status: OwnerInviteStatus) =>
  status === 'pending' || status === 'expired' || status === 'invited' || status === 'resent'

const STATUS_FILTERS: StatusFilter[] = ['All', 'pending', 'invited', 'resent', 'expired', 'activated']

export default function ClientsPage() {
  const token = useAuthStore((state) => state.token)

  const [owners, setOwners] = useState<ClinicPetOwner[]>([])
  const [filtered, setFiltered] = useState<ClinicPetOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null)

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

  const applyFilters = (data: ClinicPetOwner[], status: StatusFilter, query: string) => {
    let result = data
    if (status !== 'All') result = result.filter((o) => o.inviteStatus === status)
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
  }

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

  useEffect(() => { fetchOwners() }, [fetchOwners])

  // Status counts for filter pills
  const counts = owners.reduce<Record<string, number>>((acc, o) => {
    acc[o.inviteStatus] = (acc[o.inviteStatus] ?? 0) + 1
    return acc
  }, {})

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
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-white/70'
                }`}
              >
                {s === 'All' ? 'All' : STATUS_CONFIG[s as OwnerInviteStatus].label}
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
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
            <span>Client</span>
            <span>Contact</span>
            <span>Pets</span>
            <span>Last Action</span>
            <span>Status</span>
            <span />
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <User className="w-16 h-16 text-gray-300 mb-4" />
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
                        <div>
                          <p className="font-semibold text-[#4F4F4F]">{owner.firstName} {owner.lastName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{owner.email}</p>
                          {owner.contactNumber && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{owner.contactNumber}</p>
                          )}
                        </div>
                        <StatusBadge status={owner.inviteStatus} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><PawPrint className="w-3 h-3" />{owner.petCount} pet{owner.petCount !== 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(owner.lastInviteSentAt)}</span>
                        </div>
                        {canSendInvite(owner.inviteStatus) && (
                          <button
                            onClick={() => handleSendInvite(owner)}
                            disabled={sendingInviteId === owner.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#476B6B] border border-[#476B6B] rounded-lg hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50"
                          >
                            {sendingInviteId === owner.id
                              ? <div className="w-3 h-3 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                              : <Send className="w-3 h-3" />}
                            {owner.inviteStatus === 'pending' ? 'Send Invite' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_auto] gap-4 items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-[#7FA5A3]/15 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-[#476B6B]">{owner.firstName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#4F4F4F] truncate">{owner.firstName} {owner.lastName}</p>
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

                      <div className="flex justify-end">
                        {canSendInvite(owner.inviteStatus) ? (
                          <button
                            onClick={() => handleSendInvite(owner)}
                            disabled={sendingInviteId === owner.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#476B6B] border border-[#476B6B] rounded-lg hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {sendingInviteId === owner.id
                              ? <div className="w-3 h-3 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                              : <Send className="w-3 h-3" />}
                            {owner.inviteStatus === 'pending' ? 'Send Invite' : 'Resend Invite'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 px-3 py-1.5">—</span>
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
    </DashboardLayout>
  )
}
