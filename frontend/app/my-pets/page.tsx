'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, requestPetTag, getNfcTagPrice, togglePetLost, type Pet as APIPet } from '@/lib/pets'
import { Plus, PawPrint, Search, AlertTriangle, Nfc, CheckCircle2, Loader, ChevronDown, X, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'
import { getAllClinicsWithBranches, type ClinicBranch } from '@/lib/clinics'
import { toast } from 'sonner'

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  return `${y} year${y > 1 ? 's' : ''}`
}

export default function MyPetsPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const [pets, setPets] = useState<APIPet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [petTypeFilter, setPetTypeFilter] = useState<'all' | 'dog' | 'cat'>('all')
  const [lifeStatusFilter, setLifeStatusFilter] = useState<'all' | 'alive' | 'deceased'>('all')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState('')
  const [selectedPickupDate, setSelectedPickupDate] = useState('')
  const [clinicBranches, setClinicBranches] = useState<ClinicBranch[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)
  const [togglingLostPetId, setTogglingLostPetId] = useState<string | null>(null)
  const [nfcTagPrice, setNfcTagPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState(false)
  const [feeAgreed, setFeeAgreed] = useState(false)
  const [feeCheckboxError, setFeeCheckboxError] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchPets = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const response = await getMyPets(token)
      if (response.status === 'SUCCESS' && response.data?.pets) {
        setPets(response.data.pets)
      }
    } catch (error) {
      console.error('Failed to fetch pets:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  // Fetch clinic branches for pet tag pickup selection
  useEffect(() => {
    const fetchClinicBranches = async () => {
      setLoadingClinics(true)
      try {
        const response = await getAllClinicsWithBranches()
        if (response.status === 'SUCCESS' && response.data?.clinics) {
          // Flatten all branches from all clinics
          const allBranches = response.data.clinics.flatMap((clinic) =>
            clinic.branches.map((branch) => ({
              ...branch,
              clinicName: clinic.name,
            }))
          )
          setClinicBranches(allBranches)
        }
      } catch (error) {
        console.error('Failed to fetch clinic branches:', error)
      } finally {
        setLoadingClinics(false)
      }
    }

    fetchClinicBranches()
  }, [])

  const handleMarkFound = async (pet: APIPet) => {
    setTogglingLostPetId(pet._id)
    try {
      const response = await togglePetLost(pet._id, false, token ?? undefined)
      if (response.status === 'SUCCESS') {
        toast.success(`${pet.name} has been marked as found!`)
        fetchPets()
      } else {
        toast.error('Failed to update pet status')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setTogglingLostPetId(null)
    }
  }

  // Fetch NFC tag price whenever the request modal is opened
  useEffect(() => {
    if (!showConfirmation) return
    const fetchPrice = async () => {
      setPriceLoading(true)
      setPriceError(false)
      setNfcTagPrice(null)
      try {
        const response = await getNfcTagPrice()
        if (response.status === 'SUCCESS' && typeof response.data?.price === 'number') {
          setNfcTagPrice(response.data.price)
        } else {
          setPriceError(true)
        }
      } catch {
        setPriceError(true)
      } finally {
        setPriceLoading(false)
      }
    }
    fetchPrice()
  }, [showConfirmation])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) return
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getPetType = (pet: APIPet): 'dog' | 'cat' | 'other' => {
    const raw = String((pet as any).species || (pet as any).type || (pet as any).petType || '').toLowerCase()
    if (raw.includes('dog') || raw.includes('canine')) return 'dog'
    if (raw.includes('cat') || raw.includes('feline')) return 'cat'
    return 'other'
  }

  const filteredPets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return pets.filter((pet) => {
      const matchesType = petTypeFilter === 'all' ? true : getPetType(pet) === petTypeFilter
      const isDeceased = !pet.isAlive || pet.status === 'deceased'
      const matchesLifeStatus = lifeStatusFilter === 'all'
        ? true
        : lifeStatusFilter === 'deceased'
          ? isDeceased
          : !isDeceased
      const matchesSearch = query.length === 0 ? true : pet.name.toLowerCase().includes(query)
      return matchesType && matchesLifeStatus && matchesSearch
    })
  }, [pets, petTypeFilter, lifeStatusFilter, searchQuery])

  const suggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    return pets
      .filter((pet) => (petTypeFilter === 'all' ? true : getPetType(pet) === petTypeFilter))
      .filter((pet) => pet.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [pets, petTypeFilter, searchQuery])

  // Calculate minimum pickup date (tomorrow)
  const minPickupDate = new Date()
  minPickupDate.setDate(minPickupDate.getDate() + 1)
  minPickupDate.setHours(0, 0, 0, 0)

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Pet Count */}
        <div className="mb-6">
          <h1
            className="text-[32px] text-[#476B6B]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            My Pets
          </h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Loading...'
              : `You have ${pets.length} pet${pets.length !== 1 ? 's' : ''} registered under your account`}
          </p>
        </div>

        {/* Header */}
        <div className="mb-6 space-y-3">
          <div ref={searchContainerRef} className="relative inline-block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search pets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent w-56"
            />

            {showSuggestions && searchQuery.trim().length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {suggestions.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {suggestions.map((pet) => (
                      <button
                        key={pet._id}
                        type="button"
                        onClick={() => {
                          setSearchQuery(pet.name)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#F8F6F2] transition-colors"
                      >
                        {pet.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">No results found</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'dog', label: 'Dogs' },
                { key: 'cat', label: 'Cats' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPetTypeFilter(option.key as 'all' | 'dog' | 'cat')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    petTypeFilter === option.key
                      ? 'bg-[#7FA5A3] text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
              {[
                { key: 'all', label: 'All Status' },
                { key: 'alive', label: 'Alive' },
                { key: 'deceased', label: 'Deceased' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setLifeStatusFilter(option.key as 'all' | 'alive' | 'deceased')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    lifeStatusFilter === option.key
                      ? 'bg-[#7FA5A3] text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {(petTypeFilter !== 'all' || lifeStatusFilter !== 'all' || searchQuery.trim()) && (
              <div className="flex flex-wrap items-center gap-2">
                {petTypeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setPetTypeFilter('all')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF1F1] text-[#3D5E5C] hover:bg-[#dfe9e8] transition-colors"
                  >
                    {petTypeFilter === 'dog' ? 'Dogs' : 'Cats'}
                    <X className="w-3 h-3" />
                  </button>
                )}
                {lifeStatusFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setLifeStatusFilter('all')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF1F1] text-[#3D5E5C] hover:bg-[#dfe9e8] transition-colors"
                  >
                    {lifeStatusFilter === 'alive' ? 'Alive' : 'Deceased'}
                    <X className="w-3 h-3" />
                  </button>
                )}
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setShowSuggestions(false)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF1F1] text-[#3D5E5C] hover:bg-[#dfe9e8] transition-colors"
                  >
                    &quot;{searchQuery.trim()}&quot;
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pet Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 h-70 animate-pulse">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full mb-3" />
                  <div className="h-5 w-24 bg-gray-200 rounded mb-1" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPets.map((pet) => (
              (() => {
                const hasPendingRequest = pet.tag_request_status === 'pending' || pet.tag_request_status === 'approved'
                const isRequestDisabled = !pet.isAlive || pet.status === 'deceased' || hasPendingRequest

                return (
              <div
                key={pet._id}
                className={`bg-white rounded-2xl p-6 relative transition-all duration-300 ease-out hover:scale-103 hover:shadow-md ${
                  !pet.isAlive || pet.status === 'deceased'
                    ? 'border-2 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]'
                    : pet.isLost
                    ? 'border-2 border-[#900B09] shadow-[0_0_0_1px_rgba(144,11,9,0.15)]'
                    : pet.isConfined
                    ? 'border-2 border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.15)]'
                    : 'border border-gray-200 shadow-sm'
                }`}
              >
                {/* Deceased badge */}
                {(!pet.isAlive || pet.status === 'deceased') && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-400 text-amber-600 text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10">
                    Deceased
                  </div>
                )}

                {/* Lost badge */}
                {pet.isLost && pet.isAlive && pet.status !== 'deceased' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FEE2E2] border border-[#900B09] text-[#900B09] text-[10px] font-semibold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap z-10">
                    <AlertTriangle className="w-3 h-3" />
                    Marked as Lost
                  </div>
                )}

                {/* Confined badge */}
                {pet.isConfined && pet.isAlive && pet.status !== 'deceased' && !pet.isLost && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-50 border border-blue-400 text-blue-600 text-[10px] font-semibold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap z-10">
                    Confined
                  </div>
                )}

                {/* Pet Photo + Info */}
                <div className="flex flex-col items-center mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-3">
                    {pet.photo ? (
                      <Image
                        src={pet.photo}
                        alt={pet.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <PawPrint className="w-7 h-7 text-gray-300" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#4F4F4F]">{pet.name}</h3>
                  <p className="text-sm text-gray-500">
                    {pet.breed.charAt(0).toUpperCase() + pet.breed.slice(1)}
                    {pet.secondaryBreed ? ` · ${pet.secondaryBreed}` : ''}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#F8F6F2] rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Age</p>
                    <p className="text-sm font-bold text-[#4F4F4F]">{calculateAge(pet.dateOfBirth)}</p>
                  </div>
                  <div className="bg-[#F8F6F2] rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Weight</p>
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.weight} kg</p>
                  </div>
                </div>

                <div className="bg-[#F8F6F2] rounded-xl px-3 py-2 mb-5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sex and Sterilization</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#4F4F4F]">
                      {pet.sex && pet.sterilization
                        ? `${pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)} - ${
                            pet.sterilization === 'spayed'
                              ? 'Spayed'
                              : pet.sterilization === 'unspayed'
                              ? 'Unspayed'
                              : pet.sterilization === 'neutered'
                              ? 'Neutered'
                              : pet.sterilization === 'unneutered'
                              ? 'Unneutered'
                              : 'Unknown'
                          }`
                        : '-'}
                    </p>
                    {pet.sex === 'female' && pet.pregnancyStatus === 'pregnant' && (
                      <span className="inline-flex items-center bg-pink-100 border border-pink-400 text-pink-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0">
                        Pregnant
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push(`/my-pets/${pet._id}`)}
                    className="text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 bg-[#7FA5A3] text-white hover:bg-[#6b9391]"
                  >
                    <PawPrint className="w-3.5 h-3.5" />
                    View Profile
                  </button>
                  {!pet.nfcTagId ? (
                    <button
                      onClick={() => {
                        if (isRequestDisabled) return
                        setSelectedPetId(pet._id)
                        setFeeAgreed(false)
                        setFeeCheckboxError(false)
                        setShowConfirmation(true)
                      }}
                      disabled={isRequestDisabled}
                      className="text-sm font-semibold py-2.5 rounded-xl border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Nfc className="w-3.5 h-3.5" />
                      {!pet.isAlive || pet.status === 'deceased'
                        ? 'Tag Request Disabled'
                        : hasPendingRequest
                          ? 'Request Sent'
                          : 'Request Pet Tag'}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/my-pets/${pet._id}`)}
                      className="text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Nfc className="w-3.5 h-3.5" />
                      <span>Registered</span>
                    </button>
                  )}
                </div>

                {/* Found Button — only visible when pet is marked as lost */}
                {pet.isLost && pet.isAlive && pet.status !== 'deceased' && (
                  <button
                    onClick={() => handleMarkFound(pet)}
                    disabled={togglingLostPetId === pet._id}
                    className="mt-3 w-full py-2.5 bg-[#35785C] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-[#2D6B52] transition-colors disabled:opacity-50"
                  >
                    {togglingLostPetId === pet._id ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Found {pet.name}!
                      </>
                    )}
                  </button>
                )}
              </div>
                )
              })()
            ))}

            {/* Add New Pet Card — hidden when viewing deceased pets */}
            {lifeStatusFilter !== 'deceased' && (
              <div
                className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors min-h-70"
                onClick={() => router.push('/onboarding/pet?from=dashboard')}
              >
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Plus className="w-7 h-7 text-gray-400" />
                </div>
                <p className="font-semibold text-[#4F4F4F]">Add New Pet</p>
                <p className="text-xs text-gray-400 mt-1 text-center">Register a new pet to start tracking their health</p>
              </div>
            )}
          </div>
        ) : pets.length > 0 ? (
          /* Search returned no results */
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-2">No pets found</h2>
            <p className="text-gray-500">No pets match your active filters. Try adjusting search or pet type.</p>
          </div>
        ) : (
          /* Empty state - no pets at all */
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#4F4F4F] mb-2">No pets yet</h2>
            <p className="text-gray-500 mb-6">
              Start by adding your first pet to track their health records and appointments.
            </p>
            <button
              onClick={() => router.push('/onboarding/pet')}
              className="bg-[#7FA5A3] text-white px-8 py-3 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Pet
            </button>
          </div>
        )}
      </div>

      {/* Pet Tag Request Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Request Pet Tag for {selectedPetId && pets.find(p => p._id === selectedPetId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Clinic Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Select Pickup Clinic
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={loadingClinics}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 transition-colors hover:border-[#7FA5A3]"
                  >
                    <span className={selectedClinic ? 'text-gray-700' : 'text-gray-400'}>
                      {loadingClinics
                        ? 'Loading clinics...'
                        : selectedClinic
                          ? clinicBranches.find(b => b._id === selectedClinic)?.name
                          : 'Select a clinic branch'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
                  className="max-h-52 overflow-y-auto"
                >
                  {clinicBranches.map((branch) => (
                    <DropdownMenuItem
                      key={branch._id}
                      className={`cursor-pointer text-sm gap-2 focus:bg-[#F8F6F2] ${selectedClinic === branch._id ? 'text-[#7FA5A3] font-semibold' : 'text-gray-700'}`}
                      onClick={() => setSelectedClinic(branch._id)}
                    >
                      {selectedClinic === branch._id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      {branch.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <label htmlFor="pickup-date" className="text-sm font-semibold text-gray-700">
                Select Pickup Date
              </label>
              <DatePicker
                value={selectedPickupDate}
                onChange={setSelectedPickupDate}
                placeholder="MM/DD/YYYY"
                allowFutureDates={true}
                minDate={minPickupDate}
              />
              <p className="text-xs text-gray-500">Select a date from tomorrow onwards</p>
            </div>

            {/* Selected clinic details */}
            {selectedClinic && (
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-sm">
                <p className="text-gray-700">
                  <strong>Branch:</strong> {clinicBranches.find(c => c._id === selectedClinic)?.name}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {clinicBranches.find(c => c._id === selectedClinic)?.address}
                </p>
              </div>
            )}

            {/* NFC Tag Price */}
            <div className="rounded-lg border border-[#C8DCDB] bg-[#EAF4F4] px-4 py-3">
              <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-1">NFC Tag Fee</p>
              {priceLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  Loading price...
                </div>
              ) : priceError ? (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Unable to load price. Please try again later.
                </div>
              ) : (
                <p className="text-lg font-bold text-[#3D5E5C]">
                  ₱{nfcTagPrice !== null ? nfcTagPrice.toFixed(2) : '—'}
                </p>
              )}
            </div>

            {/* Fee consent checkbox */}
            <div className="space-y-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={feeAgreed}
                  onChange={(e) => {
                    setFeeAgreed(e.target.checked)
                    if (e.target.checked) setFeeCheckboxError(false)
                  }}
                  disabled={priceLoading || priceError || nfcTagPrice === null}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3] accent-[#7FA5A3] shrink-0 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors select-none">
                  I understand and agree to the NFC tag fee.
                </span>
              </label>
              {feeCheckboxError && (
                <p className="text-xs text-red-500 flex items-center gap-1 pl-7">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Please agree to the NFC tag fee before proceeding.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowConfirmation(false)
                setSelectedClinic('')
                setSelectedPickupDate('')
                setFeeAgreed(false)
                setFeeCheckboxError(false)
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                // Require fee checkbox before proceeding
                if (!feeAgreed) {
                  setFeeCheckboxError(true)
                  return
                }

                if (!selectedPetId || !selectedClinic || !selectedPickupDate) {
                  toast.error('Please fill in all fields', {
                    description: 'Select a clinic branch and pickup date to continue.'
                  })
                  return
                }

                if (nfcTagPrice === null) {
                  toast.error('Unable to load price. Please try again later.')
                  return
                }

                setIsSubmitting(true)
                try {
                  const selectedBranch = clinicBranches.find(c => c._id === selectedClinic)
                  const response = await requestPetTag(
                    selectedPetId,
                    selectedClinic,
                    selectedPickupDate,
                    undefined,
                    token ?? undefined,
                    nfcTagPrice
                  )

                  if (response.status === 'SUCCESS') {
                    toast.success('Pet Tag Request Submitted', {
                      description: `Your request has been submitted. Pickup at ${selectedBranch?.name} on ${new Date(selectedPickupDate).toLocaleDateString()}.`
                    })
                    await fetchPets()
                    setShowConfirmation(false)
                    setSelectedClinic('')
                    setSelectedPickupDate('')
                    setSelectedPetId(null)
                    setFeeAgreed(false)
                    setFeeCheckboxError(false)
                  } else {
                    toast.error('Error', {
                      description: response.message || 'Failed to submit request'
                    })
                  }
                } catch (error) {
                  console.error('Error submitting pet tag request:', error)
                  toast.error('Error', {
                    description: 'Something went wrong. Please try again.'
                  })
                } finally {
                  setIsSubmitting(false)
                }
              }}
              disabled={isSubmitting || !selectedClinic || !selectedPickupDate || priceLoading || priceError || nfcTagPrice === null}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Request Tag'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  )
}
