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
  getVaccinationsByPet,
  updateVaccination,
  type VaccineType,
} from '@/lib/vaccinations'
import VaccineCardPreview from '@/components/VaccineCardPreview'


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetOption {
  _id: string
  name: string
  species: 'canine' | 'feline'
  breed: string
  photo?: string | null
  dateOfBirth?: string
}

interface VetOption {
  _id: string
  firstName: string
  lastName: string
  email: string
  photo?: string | null
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

/** Returns the booster interval for the dose being administered (dose 1 → interval to dose 2, etc.) */
function getIntervalForDose(vt: { boosterIntervalDays: number | null; boosterIntervalDaysList?: number[] }, doseNumber: number): number | null {
  const list = vt.boosterIntervalDaysList
  if (list && list.length > 0) {
    const interval = list[doseNumber - 1]
    if (interval != null) return interval
  }
  return vt.boosterIntervalDays ?? null
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

export default function ClinicVaccinationFormClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token } = useAuthStore()

  // Pre-filled from URL
  const petIdParam = searchParams.get('petId')
  const editId = searchParams.get('edit')
  const viewId = searchParams.get('view')
  const isViewOnly = !!viewId

  // Vaccine types
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])

  // Vet search
  const [vetSearch, setVetSearch] = useState('')
  const [vetResults, setVetResults] = useState<VetOption[]>([])
  const [selectedVet, setSelectedVet] = useState<VetOption | null>(null)
  const [vetLoading, setVetLoading] = useState(false)

  // Selected pet
  const [selectedPet, setSelectedPet] = useState<PetOption | null>(null)
  const [petLoading, setPetLoading] = useState(false)

  // Form fields
  const [vaccineTypeId, setVaccineTypeId] = useState('')
  const [doseNumber, setDoseNumber] = useState(1)
  const [manufacturer, setManufacturer] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [route, setRoute] = useState('')
  const [dateAdministered, setDateAdministered] = useState(formatDateInput(new Date()))
  const [nextDueDate, setNextDueDate] = useState('')
  const [notes, setNotes] = useState('')

  // Date validation errors
  const [dateAdminError, setDateAdminError] = useState<string | null>(null)
  const [nextDueDateError, setNextDueDateError] = useState<string | null>(null)

  // Computed preview
  const [selectedVaccineType, setSelectedVaccineType] = useState<VaccineType | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [boosterInfo, setBoosterInfo] = useState<string | null>(null)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)

  // Age validation state
  const [ageValid, setAgeValid] = useState(true)
  const [ageMessage, setAgeMessage] = useState<string | null>(null)

  // Doses already taken for this pet + vaccine type (new mode only)
  const [takenDoses, setTakenDoses] = useState<number[]>([])

  // Date validation: run whenever either date changes
  useEffect(() => {
    const today = formatDateInput(new Date())
    // dateAdministered cannot be in the future
    if (dateAdministered && dateAdministered > today) {
      setDateAdminError('Date administered cannot be in the future.')
    } else {
      setDateAdminError(null)
    }
    // nextDueDate must be after dateAdministered (at least +1 day) and not in the past
    if (nextDueDate) {
      if (dateAdministered && nextDueDate <= dateAdministered) {
        setNextDueDateError('Next due date must be after the date administered.')
      } else {
        setNextDueDateError(null)
      }
    } else {
      setNextDueDateError(null)
    }
  }, [dateAdministered, nextDueDate])

  const isFormValid = !dateAdminError && !nextDueDateError && ageValid

  // Load vaccine types
  useEffect(() => {
    const species = selectedPet?.species === 'canine' ? 'dog' : selectedPet?.species === 'feline' ? 'cat' : undefined
    getVaccineTypes(species).then(setVaccineTypes).catch(() => {})
  }, [selectedPet?.species])

  // Sync selected vaccine type for computed preview + validate pet age
  useEffect(() => {
    const vt = vaccineTypes.find((v) => v._id === vaccineTypeId) || null
    setSelectedVaccineType(vt)
    if (vt?.route && !route) {
      setRoute(vt.route)
    }
    if (vt && selectedPet?.dateOfBirth) {
      const dob = selectedPet.dateOfBirth
      const now = new Date()
      const d = new Date(dob)
      const ageMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      const ageWeeks = Math.round(ageMonths * 4.3)
      const minMonths = vt.minAgeMonths || 0
      const maxMonths = vt.maxAgeMonths || null
      const ageLabel = `${ageMonths} months (${ageWeeks} weeks)`
      if (ageMonths < minMonths) {
        const minWeeks = Math.round(minMonths * 4.3)
        setAgeValid(false)
        setAgeMessage(`Pet is ${ageLabel} old. This vaccine requires a minimum of ${minMonths} months (${minWeeks} weeks).`)
      } else if (maxMonths && ageMonths > maxMonths) {
        const maxWeeks = Math.round(maxMonths * 4.3)
        setAgeValid(false)
        setAgeMessage(`Pet is ${ageLabel} old. This vaccine is only for pets up to ${maxMonths} months (${maxWeeks} weeks).`)
      } else {
        setAgeValid(true)
        setAgeMessage(`Pet is ${ageLabel} old — eligible for this vaccine.`)
      }
    } else {
      setAgeValid(true)
      setAgeMessage(null)
    }
  }, [vaccineTypeId, vaccineTypes, route, selectedPet?.dateOfBirth])

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

  // Load existing record for edit/view mode
  useEffect(() => {
    if ((!editId && !viewId) || !token) return
    setLoadingEdit(true)
    const recordId = editId || viewId
    if (!recordId) {
      setLoadingEdit(false)
      return
    }
    getVaccinationById(recordId, token)
      .then((vax) => {
        if (typeof vax.petId === 'object' && vax.petId) {
          setSelectedPet(vax.petId as unknown as PetOption)
        }
        if (typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId) {
          setVaccineTypeId((vax.vaccineTypeId as VaccineType)._id)
        } else if (typeof vax.vaccineTypeId === 'string') {
          setVaccineTypeId(vax.vaccineTypeId)
        }
        setDoseNumber(vax.doseNumber || 1)
        setManufacturer(vax.manufacturer || '')
        setBatchNumber(vax.batchNumber || '')
        setRoute(vax.route || '')
        setDateAdministered(
          vax.dateAdministered ? formatDateInput(new Date(vax.dateAdministered)) : formatDateInput(new Date())
        )
        setNextDueDate(vax.nextDueDate ? formatDateInput(new Date(vax.nextDueDate)) : '')
        setNotes(vax.notes || '')
        if (typeof vax.vetId === 'object' && vax.vetId) {
          setSelectedVet(vax.vetId as unknown as VetOption)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEdit(false))
  }, [editId, viewId, token])

  // In new mode: fetch taken dose numbers for this pet + vaccine type so we can lock untaken doses
  useEffect(() => {
    if (editId || viewId || !selectedPet || !vaccineTypeId || !token) {
      setTakenDoses([])
      return
    }
    getVaccinationsByPet(selectedPet._id, token)
      .then((vaxes) => {
        const doses = vaxes
          .filter((v) => {
            const vtId = typeof v.vaccineTypeId === 'object' && v.vaccineTypeId
              ? (v.vaccineTypeId as VaccineType)._id
              : v.vaccineTypeId as string
            return vtId === vaccineTypeId
          })
          .map((v) => v.doseNumber)
        setTakenDoses(doses)
      })
      .catch(() => setTakenDoses([]))
  }, [editId, viewId, selectedPet, vaccineTypeId, token])

  // Vet search with debounce
  const searchVetsFn = useCallback(async (q: string) => {
    if (!token || q.trim().length < 2) {
      setVetResults([])
      return
    }
    setVetLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/vaccinations/search/owners?q=${encodeURIComponent(q)}&type=vet`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (json.status === 'SUCCESS') setVetResults(json.data.owners)
    } catch {
      /* silent */
    } finally {
      setVetLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = setTimeout(() => searchVetsFn(vetSearch), 350)
    return () => clearTimeout(timer)
  }, [vetSearch, searchVetsFn])

  const selectVet = (vet: VetOption) => {
    setSelectedVet(vet)
    setVetResults([])
    setVetSearch(`${vet.firstName} ${vet.lastName}`)
  }

  const computedExpiryDate =
    selectedVaccineType && dateAdministered
      ? formatDisplayDate(formatDateInput(addDays(new Date(dateAdministered), selectedVaccineType.validityDays)))
      : null

  const totalDoses = selectedVaccineType ? Math.max(selectedVaccineType.numberOfBoosters || 0, 1) + 1 : 1
  const isLastDose = doseNumber >= totalDoses
  const doseInterval = selectedVaccineType ? getIntervalForDose(selectedVaccineType, doseNumber) : null
  const computedNextDueDate =
    selectedVaccineType?.requiresBooster && doseInterval && dateAdministered && !isLastDose
      ? formatDisplayDate(formatDateInput(addDays(new Date(dateAdministered), doseInterval)))
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedPet || !vaccineTypeId) {
      setError('Please select a pet and vaccine type.')
      return
    }
    if (!ageValid) {
      setError(ageMessage || 'Pet does not meet the age requirements for this vaccine.')
      return
    }
    if (!isFormValid) {
      setError('Please fix the date errors before submitting.')
      return
    }

    setLoading(true)
    setError(null)
    setBoosterInfo(null)
    try {
      if (editId) {
        await updateVaccination(
          editId,
          { vaccineTypeId, manufacturer, batchNumber, route, dateAdministered, nextDueDate: nextDueDate || undefined, notes, doseNumber, vetId: selectedVet?._id },
          token
        )
        setSuccess(true)
        setPreviewRefreshKey((k) => k + 1)
        setTimeout(() => router.push('/clinic-admin/vaccinations'), 1500)
      } else {
        const res = await createVaccination(
          {
            petId: selectedPet._id,
            vaccineTypeId,
            manufacturer,
            batchNumber,
            route,
            dateAdministered,
            nextDueDate: nextDueDate || undefined,
            notes,
            doseNumber,
            vetId: selectedVet?._id,
          },
          token
        )
        setSuccess(true)
        setPreviewRefreshKey((k) => k + 1)
        if (res.boosterDate) {
          const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          setBoosterInfo(`Next booster automatically scheduled for ${d}.`)
        }
        setTimeout(() => router.push('/clinic-admin/vaccinations'), 2000)
      }
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
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/clinic-admin/vaccinations')}
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
          {isViewOnly ? 'View Vaccination Record' : editId ? 'Edit Vaccination Record' : 'New Vaccination Record'}
        </h1>
      </div>

      {isViewOnly && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">This is a read-only view of the vaccination record.</p>
        </div>
      )}

      <div className={`grid gap-8 ${selectedPet ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
      {/* ── Left: Form ────────────────────────────────── */}
      <div>

      {success && (
        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Vaccination saved! Redirecting...
          </div>
          {boosterInfo && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {boosterInfo}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Administering Vet ─────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide">Administering Vet</h2>

          {!selectedVet ? (
            <>
              {/* Vet search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Search vet
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={vetSearch}
                    onChange={(e) => {
                      setVetSearch(e.target.value)
                      setSelectedVet(null)
                    }}
                    disabled={isViewOnly}
                    placeholder="Type vet name..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[#F8F6F2] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                  {vetLoading && (
                    <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>

                {/* Vet results dropdown */}
                {vetResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {vetResults.map((vet) => (
                      <button
                        key={vet._id}
                        type="button"
                        onClick={() => selectVet(vet)}
                        disabled={isViewOnly}
                        className="w-full px-4 py-3 text-left hover:bg-[#F8F6F2] flex items-center gap-3 border-b border-gray-50 last:border-0 disabled:cursor-not-allowed"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-[#476B6B]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#4F4F4F]">
                            Dr. {vet.firstName} {vet.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{vet.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Pre-filled vet display */
            <div className="flex items-center gap-3 bg-[#F8F6F2] rounded-xl px-4 py-3">
              {selectedVet.photo ? (
                <img src={selectedVet.photo} alt={`${selectedVet.firstName} ${selectedVet.lastName}`} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#476B6B]" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-[#4F4F4F] text-sm">Dr. {selectedVet.firstName} {selectedVet.lastName}</p>
                <p className="text-xs text-gray-400">{selectedVet.email}</p>
              </div>
              {!isViewOnly && (
                <button
                  type="button"
                  onClick={() => { setSelectedVet(null); setVetSearch('') }}
                  className="text-xs text-[#7FA5A3] hover:text-[#476B6B] font-semibold"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Pet Selection ─────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide">Patient</h2>

          {selectedPet || petIdParam || editId || viewId ? (
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
                </>
              ) : (
                <p className="text-sm text-gray-400">Loading pet...</p>
              )}
            </div>
          ) : null}
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
                onChange={(e) => { setVaccineTypeId(e.target.value); setDoseNumber(1) }}
                disabled={isViewOnly}
                required
                className="w-full appearance-none bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:cursor-not-allowed"
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

            {/* Dose number selector */}
            {selectedVaccineType?.requiresBooster && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Dose Number</label>
                {editId ? (
                  // Edit mode: dose is locked — cannot change which dose a historical record represents
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: totalDoses }, (_, i) => i + 1).map((n) => (
                      <div
                        key={n}
                        title={n !== doseNumber ? 'Cannot change dose number of an existing record' : undefined}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border select-none ${
                          doseNumber === n
                            ? 'bg-[#476B6B] text-white border-[#476B6B]'
                            : 'bg-gray-100 text-gray-400 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {n === 1 ? 'Dose 1 (Initial)' : `Dose ${n} (Booster ${n - 1})`}
                        {doseNumber === n && <span className="ml-1.5 text-[9px] opacity-75">(this record)</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  // New mode: only allow doses that are either taken or the immediate next dose
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: totalDoses }, (_, i) => i + 1).map((n) => {
                      const isTaken = takenDoses.includes(n)
                      const nextDose = takenDoses.length + 1
                      const isSelectable = n === nextDose
                      const isDisabled = isTaken || !isSelectable || isViewOnly
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setDoseNumber(n)}
                          title={isTaken ? 'This dose has already been recorded' : !isSelectable ? 'Previous dose must be administered first' : undefined}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:cursor-not-allowed ${
                            doseNumber === n
                              ? 'bg-[#476B6B] text-white border-[#476B6B]'
                              : isDisabled
                              ? 'bg-gray-100 text-gray-400 border-gray-200 opacity-50'
                              : 'bg-[#F8F6F2] text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                          }`}
                        >
                          {n === 1 ? 'Dose 1 (Initial)' : `Dose ${n} (Booster ${n - 1})`}
                          {isTaken && <span className="ml-1 opacity-60">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  {doseNumber} of {totalDoses} total doses
                </p>
              </div>
            )}

            {/* Computed preview */}
            {selectedVaccineType && dateAdministered && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {computedExpiryDate && (
                  <div className="bg-[#F4D3D2] border border-[#983232] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#983232] uppercase tracking-wide font-semibold mb-0.5">Expires</p>
                    <p className="text-xs font-bold text-[#983232]">{computedExpiryDate}</p>
                  </div>
                )}
                {(nextDueDate || computedNextDueDate) && (
                  <div className="bg-[#C5D8FF] border border-[#4569B1] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#4569B1] uppercase tracking-wide font-semibold mb-0.5">
                      {nextDueDate ? 'Next Due (overridden)' : 'Next Due (auto-schedules)'}
                    </p>
                    <p className="text-xs font-bold text-[#4569B1]">
                      {nextDueDate
                        ? formatDisplayDate(nextDueDate)
                        : computedNextDueDate}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Age eligibility */}
            {ageMessage && vaccineTypeId && (
              <div className={`mt-2 flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${
                ageValid
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {ageValid
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                {ageMessage}
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
              max={formatDateInput(new Date())}
              onChange={(e) => setDateAdministered(e.target.value)}
              disabled={isViewOnly}
              required
              className={`w-full bg-[#F8F6F2] border rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:cursor-not-allowed ${dateAdminError ? 'border-red-400 focus:ring-red-300' : 'border-transparent focus:ring-[#7FA5A3]'}`}
            />
            {dateAdminError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {dateAdminError}
              </p>
            )}
          </div>

          {/* Next Due Date */}
          {selectedVaccineType?.requiresBooster && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                Next Due Date <span className="text-gray-400 font-normal">(optional override)</span>
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                disabled={isViewOnly}
                className={`w-full bg-[#F8F6F2] border rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:cursor-not-allowed ${nextDueDateError ? 'border-red-400 focus:ring-red-300' : 'border-transparent focus:ring-[#7FA5A3]'}`}
              />
              {nextDueDateError && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {nextDueDateError}
                </p>
              )}
              {!nextDueDateError && !nextDueDate && computedNextDueDate && (
                <p className="text-xs text-gray-400 mt-1">Auto-scheduled: {computedNextDueDate}</p>
              )}
            </div>
          )}

          {/* Route */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Route</label>
            <div className="relative">
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                disabled={isViewOnly}
                className="w-full appearance-none bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:cursor-not-allowed"
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
              disabled={isViewOnly}
              placeholder="e.g. Merial, Zoetis..."
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Batch Number */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Batch / Lot Number</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              disabled={isViewOnly}
              placeholder="e.g. A12345"
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Clinical Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isViewOnly}
              placeholder="Any observations, reactions, or special instructions..."
              rows={3}
              className="w-full bg-[#F8F6F2] border border-transparent rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Submit buttons */}
        {!isViewOnly && (
          <button
            type="submit"
            disabled={loading || success || !selectedPet || !vaccineTypeId || !ageValid || !isFormValid}
            title={!ageValid ? (ageMessage || 'Pet does not meet age requirements') : (!isFormValid ? 'Please fix date errors before submitting' : undefined)}
            className="w-full py-3.5 bg-[#476B6B] text-white rounded-2xl font-semibold text-sm hover:bg-[#3d5c5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        )}
      </form>
      </div>{/* end left */}

      {/* ── Right: Vaccine Card Preview ───────────────── */}
      {selectedPet && token && (
        <div className="hidden lg:block">
          <VaccineCardPreview
            petId={selectedPet._id}
            token={token}
            refreshKey={previewRefreshKey}
          />
        </div>
      )}
      </div>{/* end grid */}
    </div>
  )
}
