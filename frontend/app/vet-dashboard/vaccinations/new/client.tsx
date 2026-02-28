'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  ArrowLeft,
  Syringe,
  Search,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader,
  User,
} from 'lucide-react'
import {
  getVaccineTypes,
  createVaccination,
  getVaccinationById,
  updateVaccination,
  type VaccineType,
  type Vaccination,
} from '@/lib/vaccinations'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetOption {
  _id: string
  name: string
  species: 'dog' | 'cat'
  breed: string
  photo?: string | null
}

interface OwnerOption {
  _id: string
  firstName: string
  lastName: string
  email: string
}

const ROUTE_OPTIONS = [
  { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
  { value: 'intramuscular', label: 'Intramuscular (IM)' },
  { value: 'intranasal', label: 'Intranasal (IN)' },
  { value: 'oral', label: 'Oral' },
]

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function VaccinationFormClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user } = useAuthStore()

  // Pre-filled from URL
  const petIdParam = searchParams.get('petId')
  const editId = searchParams.get('edit')

  // Vaccine types
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])

  // Owner / pet search
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerResults, setOwnerResults] = useState<OwnerOption[]>([])
  const [selectedOwner, setSelectedOwner] = useState<OwnerOption | null>(null)
  const [ownerPets, setOwnerPets] = useState<PetOption[]>([])
  const [ownerLoading, setOwnerLoading] = useState(false)

  // Selected pet
  const [selectedPet, setSelectedPet] = useState<PetOption | null>(null)
  const [petLoading, setPetLoading] = useState(false)

  // Form fields
  const [vaccineTypeId, setVaccineTypeId] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [route, setRoute] = useState('')
  const [dateAdministered, setDateAdministered] = useState(formatDateInput(new Date()))
  const [notes, setNotes] = useState('')

  // Computed preview
  const [selectedVaccineType, setSelectedVaccineType] = useState<VaccineType | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load vaccine types
  useEffect(() => {
    const species = selectedPet?.species
    getVaccineTypes(species).then(setVaccineTypes).catch(() => {})
  }, [selectedPet?.species])

  // Sync selected vaccine type for computed preview
  useEffect(() => {
    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId) || null
    setSelectedVaccineType(vt)
    if (vt?.route && !route) {
      setRoute(vt.route)
    }
  }, [vaccineTypeId, vaccineTypes, route])

  // Load pet from URL param
  useEffect(() => {
    if (!petIdParam || !token) return
    setPetLoading(true)
    fetch(`${API_BASE_URL}/pets/${petIdParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.status === 'SUCCESS' && json.data?.pet) {
          setSelectedPet(json.data.pet)
        }
      })
      .catch(() => {})
      .finally(() => setPetLoading(false))
  }, [petIdParam, token])

  // Load existing record for edit mode
  useEffect(() => {
    if (!editId || !token) return
    setLoadingEdit(true)
    getVaccinationById(editId, token)
      .then((vax) => {
        if (typeof vax.petId === 'object' && vax.petId) {
          setSelectedPet(vax.petId as unknown as PetOption)
        }
        if (typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId) {
          setVaccineTypeId((vax.vaccineTypeId as VaccineType)._id)
        } else if (typeof vax.vaccineTypeId === 'string') {
          setVaccineTypeId(vax.vaccineTypeId)
        }
        setManufacturer(vax.manufacturer || '')
        setBatchNumber(vax.batchNumber || '')
        setRoute(vax.route || '')
        setDateAdministered(
          vax.dateAdministered ? formatDateInput(new Date(vax.dateAdministered)) : formatDateInput(new Date())
        )
        setNotes(vax.notes || '')
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false))
  }, [editId, token])

  // Owner search with debounce
  const searchOwnersFn = useCallback(async (q: string) => {
    if (!token || q.trim().length < 2) {
      setOwnerResults([])
      return
    }
    setOwnerLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/vaccinations/search/owners?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (json.status === 'SUCCESS') setOwnerResults(json.data.owners)
    } catch {
      /* silent */
    } finally {
      setOwnerLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = setTimeout(() => searchOwnersFn(ownerSearch), 350)
    return () => clearTimeout(timer)
  }, [ownerSearch, searchOwnersFn])

  const selectOwner = async (owner: OwnerOption) => {
    setSelectedOwner(owner)
    setOwnerResults([])
    setOwnerSearch(`${owner.firstName} ${owner.lastName}`)
    setOwnerPets([])
    setSelectedPet(null)

    if (!token) return
    try {
      const res = await fetch(
        `${API_BASE_URL}/vaccinations/search/pets?ownerId=${owner._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (json.status === 'SUCCESS') setOwnerPets(json.data.pets)
    } catch {
      /* silent */
    }
  }

  const computedExpiryDate =
    selectedVaccineType && dateAdministered
      ? formatDisplayDate(formatDateInput(addDays(new Date(dateAdministered), selectedVaccineType.validityDays)))
      : null

  const computedNextDueDate =
    selectedVaccineType?.requiresBooster && selectedVaccineType.boosterIntervalDays && dateAdministered
      ? formatDisplayDate(formatDateInput(addDays(new Date(dateAdministered), selectedVaccineType.boosterIntervalDays)))
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedPet || !vaccineTypeId) {
      setError('Please select a pet and vaccine type.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (editId) {
        await updateVaccination(
          editId,
          { vaccineTypeId, manufacturer, batchNumber, route, dateAdministered, notes },
          token
        )
      } else {
        await createVaccination(
          {
            petId: selectedPet._id,
            vaccineTypeId,
            manufacturer,
            batchNumber,
            route,
            dateAdministered,
            notes,
          },
          token
        )
      }
      setSuccess(true)
      setTimeout(() => router.push('/vet-dashboard/vaccinations'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vaccination')
    } finally {
      setLoading(false)
    }
  }

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/vet-dashboard/vaccinations')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#4F4F4F] mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vaccinations
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#7FA5A3]/10 rounded-xl flex items-center justify-center">
          <Syringe className="w-5 h-5 text-[#7FA5A3]" />
        </div>
        <h1 className="text-xl font-bold text-[#4F4F4F]">
          {editId ? 'Edit Vaccination Record' : 'New Vaccination Record'}
        </h1>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm mb-5">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          Vaccination saved! Redirecting...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Pet Selection ─────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide">Patient</h2>

          {!selectedPet && !petIdParam ? (
            <>
              {/* Owner search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Search by owner name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={ownerSearch}
                    onChange={(e) => {
                      setOwnerSearch(e.target.value)
                      setSelectedOwner(null)
                      setOwnerPets([])
                      setSelectedPet(null)
                    }}
                    placeholder="Type owner name or email..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[#F8F6F2] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                  {ownerLoading && (
                    <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>

                {/* Owner results dropdown */}
                {ownerResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {ownerResults.map((owner) => (
                      <button
                        key={owner._id}
                        type="button"
                        onClick={() => selectOwner(owner)}
                        className="w-full px-4 py-3 text-left hover:bg-[#F8F6F2] flex items-center gap-3 border-b border-gray-50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-[#476B6B]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#4F4F4F]">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{owner.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pet selection */}
              {selectedOwner && ownerPets.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                    Select pet
                  </label>
                  <div className="space-y-2">
                    {ownerPets.map((pet) => {
                      const isSelected = (selectedPet as PetOption | null)?._id === pet._id
                      return (
                        <button
                          key={pet._id}
                          type="button"
                          onClick={() => setSelectedPet(pet)}
                          className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 border transition-colors text-left ${
                            isSelected
                              ? 'border-[#476B6B] bg-[#476B6B]/5'
                              : 'border-gray-100 bg-[#F8F6F2] hover:border-[#7FA5A3]/40'
                          }`}
                        >
                          {pet.photo ? (
                            <img src={pet.photo} alt={pet.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                              <span className="text-[#476B6B] font-bold text-xs">{pet.name.charAt(0)}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#4F4F4F]">{pet.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{pet.species} · {pet.breed}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#476B6B] ml-auto shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedOwner && ownerPets.length === 0 && (
                <p className="text-sm text-gray-400 italic">No pets found for this owner.</p>
              )}
            </>
          ) : (
            /* Pre-filled pet display */
            <div className="flex items-center gap-3 bg-[#F8F6F2] rounded-xl px-4 py-3">
              {petLoading ? (
                <Loader className="w-5 h-5 text-gray-400 animate-spin" />
              ) : selectedPet ? (
                <>
                  {selectedPet.photo ? (
                    <img src={selectedPet.photo} alt={selectedPet.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#476B6B] font-bold text-sm">{selectedPet.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-[#4F4F4F] text-sm">{selectedPet.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{selectedPet.species} · {selectedPet.breed}</p>
                  </div>
                  {!petIdParam && !editId && (
                    <button
                      type="button"
                      onClick={() => { setSelectedPet(null); setSelectedOwner(null); setOwnerSearch('') }}
                      className="text-xs text-[#7FA5A3] hover:text-[#476B6B] font-semibold"
                    >
                      Change
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Loading pet...</p>
              )}
            </div>
          )}
        </div>

        {/* ── Vaccine Details ────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide">Vaccine Details</h2>

          {/* Vaccine Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Vaccine Type <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={vaccineTypeId}
                onChange={(e) => setVaccineTypeId(e.target.value)}
                required
                className="w-full appearance-none bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              >
                <option value="">Select vaccine type...</option>
                {vaccineTypes.map((vt) => (
                  <option key={vt._id} value={vt._id}>
                    {vt.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Computed preview */}
            {selectedVaccineType && dateAdministered && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {computedExpiryDate && (
                  <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-green-600 uppercase tracking-wide font-semibold mb-0.5">Expires</p>
                    <p className="text-xs font-bold text-green-700">{computedExpiryDate}</p>
                  </div>
                )}
                {computedNextDueDate && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold mb-0.5">Next Due</p>
                    <p className="text-xs font-bold text-blue-700">{computedNextDueDate}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date Administered */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Date Administered <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={dateAdministered}
              onChange={(e) => setDateAdministered(e.target.value)}
              required
              max={formatDateInput(new Date())}
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
          </div>

          {/* Route */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Route</label>
            <div className="relative">
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full appearance-none bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              >
                <option value="">Not specified</option>
                {ROUTE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Manufacturer */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Merial, Zoetis..."
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
          </div>

          {/* Batch Number */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Batch / Lot Number</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="e.g. A12345"
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Clinical Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations, reactions, or special instructions..."
              rows={3}
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || success || !selectedPet || !vaccineTypeId}
          className="w-full py-3.5 bg-[#476B6B] text-white rounded-2xl font-semibold text-sm hover:bg-[#3d5c5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Syringe className="w-4 h-4" />
              {editId ? 'Update Vaccination' : 'Save Vaccination Record'}
            </>
          )}
        </button>
      </form>
    </div>
  )
}
