'use client'

/**
 * Clinic Admin — Create / Edit Vaccination Record
 *
 * Same flow as the vet vaccination form but:
 *  - Accessible to clinic-admin and branch-admin roles
 *  - Requires selecting which vet administered the vaccine (vetId from body)
 *  - Clinic/branch pre-filled from auth context
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  getVaccineTypes,
  getVaccinationById,
  createVaccination,
  updateVaccination,
  declineVaccination,
  type VaccineType,
  type Vaccination,
  type CreateVaccinationInput,
} from '@/lib/vaccinations'

import {
  ArrowLeft,
  Search,
  Save,
  AlertTriangle,
  ChevronDown,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

interface Owner {
  _id: string
  firstName: string
  lastName: string
  email: string
}

interface Pet {
  _id: string
  name: string
  species: 'dog' | 'cat' | string
  breed: string
  dateOfBirth?: string
  photo?: string
}

interface VetUser {
  _id: string
  firstName: string
  lastName: string
  email: string
}

function ClinicVaccinationFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const token = useAuthStore((s) => s.token)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Owner search
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerResults, setOwnerResults] = useState<Owner[]>([])
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)

  // Vet search
  const [vetSearch, setVetSearch] = useState('')
  const [vetResults, setVetResults] = useState<VetUser[]>([])
  const [selectedVet, setSelectedVet] = useState<VetUser | null>(null)

  // Vaccine types
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([])
  const [selectedVaccineType, setSelectedVaccineType] = useState<VaccineType | null>(null)



  // Form fields
  const [dateAdministered, setDateAdministered] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [route, setRoute] = useState<string>('')
  const [manufacturer, setManufacturer] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)

  // Age validation state
  const [ageValid, setAgeValid] = useState(true)
  const [ageMessage, setAgeMessage] = useState<string | null>(null)
  const [boosterInfo, setBoosterInfo] = useState<string | null>(null)

  // Computed preview
  const computedExpiry = selectedVaccineType && dateAdministered
    ? (() => {
        const d = new Date(dateAdministered)
        d.setDate(d.getDate() + selectedVaccineType.validityDays)
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      })()
    : null

  const computedNextDue = selectedVaccineType?.requiresBooster && selectedVaccineType.boosterIntervalDays && dateAdministered
    ? (() => {
        const d = new Date(dateAdministered)
        d.setDate(d.getDate() + selectedVaccineType.boosterIntervalDays!)
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      })()
    : null

  // Load edit record
  const loadRecord = useCallback(async (id: string) => {
    if (!token) return
    setLoading(true)
    try {
      const vax = await getVaccinationById(id, token) as any
      if (vax) {
        setDateAdministered(vax.dateAdministered ? vax.dateAdministered.split('T')[0] : '')
        setRoute(vax.route || '')
        setManufacturer(vax.manufacturer || '')
        setBatchNumber(vax.batchNumber || '')
        setNotes(vax.notes || '')
        if (typeof vax.petId === 'object') {
          setSelectedPet({
            _id: vax.petId._id,
            name: vax.petId.name,
            species: vax.petId.species,
            breed: vax.petId.breed,
            dateOfBirth: vax.petId.dateOfBirth,
          })
        }
        if (typeof vax.vetId === 'object') {
          setSelectedVet({ _id: vax.vetId._id, firstName: vax.vetId.firstName, lastName: vax.vetId.lastName, email: '' })
        }
        if (vax.vaccineTypeId && typeof vax.vaccineTypeId === 'object') {
          setSelectedVaccineType(vax.vaccineTypeId)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (editId) loadRecord(editId)
  }, [editId, loadRecord])

  // Load vaccine types when pet selected
  useEffect(() => {
    if (!selectedPet) return
    getVaccineTypes(selectedPet.species === 'dog' || selectedPet.species === 'cat' ? selectedPet.species : undefined)
      .then((types) => setVaccineTypes(types || []))
      .catch(() => { /* ignore */ })
  }, [selectedPet])

  // Auto-set route from vaccine type + validate pet age
  useEffect(() => {
    if (selectedVaccineType?.route && !route) {
      setRoute(selectedVaccineType.route)
    }
    if (selectedVaccineType && selectedPet?.dateOfBirth) {
      const dob = selectedPet.dateOfBirth
      const now = new Date()
      const d = new Date(dob)
      const ageMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      const ageWeeks = Math.round(ageMonths * 4.3)
      const minMonths = selectedVaccineType.minAgeMonths || 0
      const maxMonths = selectedVaccineType.maxAgeMonths || null
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
  }, [selectedVaccineType, selectedPet?.dateOfBirth])



  // Owner search debounce
  useEffect(() => {
    if (editId) return
    if (ownerSearch.length < 2) { setOwnerResults([]); return }
    const t = setTimeout(async () => {
      if (!token) return
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/owners?q=${encodeURIComponent(ownerSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') setOwnerResults(data.data.owners || [])
    }, 350)
    return () => clearTimeout(t)
  }, [ownerSearch, token, editId])

  // Vet search debounce
  useEffect(() => {
    if (vetSearch.length < 2) { setVetResults([]); return }
    const t = setTimeout(async () => {
      if (!token) return
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/owners?q=${encodeURIComponent(vetSearch)}&type=vet`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      // The search/owners endpoint returns all users; filter for vets on the client side isn't ideal
      // but for clinic admin, they know their vets. We use a separate approach: search via user endpoint.
      // For now we just show results and let admin pick.
      if (data.status === 'SUCCESS') setVetResults(data.data.owners || [])
    }, 350)
    return () => clearTimeout(t)
  }, [vetSearch, token])

  // Load pets when owner selected
  useEffect(() => {
    if (!selectedOwner || !token) return
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/pets?ownerId=${selectedOwner._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => { if (data.status === 'SUCCESS') setPets(data.data.pets || []) })
  }, [selectedOwner, token])

  const handleSave = async () => {
    setError('')
    if (!selectedPet) return setError('Please select a patient')
    if (!selectedVaccineType) return setError('Please select a vaccine type')
    if (!dateAdministered) return setError('Date administered is required')
    if (!ageValid) return setError(ageMessage || 'Pet does not meet the age requirements for this vaccine.')

    setSaving(true)
    setBoosterInfo(null)
    try {
      const payload: CreateVaccinationInput = {
        petId: selectedPet._id,
        vaccineTypeId: selectedVaccineType._id,
        dateAdministered,
        route: route as any || undefined,
        manufacturer,
        batchNumber,
        notes,
        vetId: selectedVet?._id,
      }

      if (editId) {
        await updateVaccination(editId, payload, token!)
        setSuccess(true)
        setTimeout(() => router.push('/clinic-admin/vaccinations'), 1500)
      } else {
        const res = await createVaccination(payload, token!)
        setSuccess(true)
        if (res.boosterDate) {
          const d = new Date(res.boosterDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          setBoosterInfo(`Next booster automatically scheduled for ${d}.`)
        }
        setTimeout(() => router.push('/clinic-admin/vaccinations'), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save vaccination')
    } finally {
      setSaving(false)
    }
  }

  const handleDecline = async () => {
    if (!editId || !declineReason.trim()) {
      setError('A reason is required to decline a vaccination')
      return
    }
    setDeclining(true)
    try {
      await declineVaccination(editId, declineReason, token!)
      setSuccess(true)
      setTimeout(() => router.push('/clinic-admin/vaccinations'), 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to decline vaccination')
    } finally {
      setDeclining(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-[#4F4F4F]">
            {editId ? 'Edit Vaccination' : 'Record Vaccination'}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 space-y-2">
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Saved successfully! Redirecting…
            </div>
            {boosterInfo && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {boosterInfo}
              </div>
            )}
          </div>
        )}

        <div className="space-y-5">
          {/* Administering Vet */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-[#4F4F4F] mb-3">Administering Vet</h2>
            {!selectedVet ? (
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vet by name…"
                  value={vetSearch}
                  onChange={(e) => setVetSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B]"
                />
                {vetResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {vetResults.map((v) => (
                      <button
                        key={v._id}
                        onClick={() => { setSelectedVet(v); setVetSearch(''); setVetResults([]) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#f0f7f7] text-sm border-b last:border-b-0"
                      >
                        <span className="font-medium">Dr. {v.firstName} {v.lastName}</span>
                        <span className="text-gray-400 ml-2">{v.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#4F4F4F]">Dr. {selectedVet.firstName} {selectedVet.lastName}</p>
                <button onClick={() => setSelectedVet(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">If left blank, you will be recorded as the administering user.</p>
          </div>

          {/* Patient */}
          {!editId && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-[#4F4F4F] mb-3">Patient</h2>
              {!selectedOwner ? (
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search owner by name or email…"
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B]"
                  />
                  {ownerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      {ownerResults.map((o) => (
                        <button
                          key={o._id}
                          onClick={() => { setSelectedOwner(o); setOwnerSearch(''); setOwnerResults([]) }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#f0f7f7] text-sm border-b last:border-b-0"
                        >
                          <span className="font-medium">{o.firstName} {o.lastName}</span>
                          <span className="text-gray-400 ml-2">{o.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : !selectedPet ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">Owner: <strong>{selectedOwner.firstName} {selectedOwner.lastName}</strong></p>
                    <button onClick={() => { setSelectedOwner(null); setPets([]) }} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                  </div>
                  {pets.length === 0 ? (
                    <p className="text-sm text-gray-400">No pets found for this owner</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {pets.map((p) => (
                        <button
                          key={p._id}
                          onClick={() => setSelectedPet(p)}
                          className="text-left p-3 border border-gray-200 rounded-xl hover:border-[#476B6B] transition-colors text-sm"
                        >
                          <p className="font-medium text-[#4F4F4F]">{p.name}</p>
                          <p className="text-gray-400 capitalize">{p.species} · {p.breed}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#4F4F4F]">{selectedPet.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{selectedPet.species} · {selectedPet.breed}</p>
                  </div>
                  <button onClick={() => setSelectedPet(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
                </div>
              )}
            </div>
          )}

          {editId && selectedPet && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-[#4F4F4F] mb-2">Patient</h2>
              <p className="font-medium text-[#4F4F4F]">{selectedPet.name}</p>
              <p className="text-sm text-gray-500 capitalize">{selectedPet.species} · {selectedPet.breed}</p>
            </div>
          )}

          {/* Vaccination details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-[#4F4F4F]">Vaccination Details</h2>

            {/* Vaccine type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Vaccine Type *</label>
              <div className="relative">
                <select
                  value={selectedVaccineType?._id || ''}
                  onChange={(e) => {
                    const vt = vaccineTypes.find((v) => v._id === e.target.value)
                    setSelectedVaccineType(vt || null)
                    if (vt?.route) setRoute(vt.route)
                  }}
                  disabled={!selectedPet && !editId}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{selectedPet || editId ? '— Select vaccine type —' : 'Select patient first'}</option>
                  {vaccineTypes.map((vt) => (
                    <option key={vt._id} value={vt._id}>{vt.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Computed preview */}
            {selectedVaccineType && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#f0f7f7] rounded-xl text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Expires</p>
                  <p className="font-medium text-[#476B6B]">{computedExpiry ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Next Booster Due {computedNextDue ? '(auto-schedules)' : ''}</p>
                  <p className="font-medium text-[#476B6B]">{computedNextDue ?? 'No booster required'}</p>
                </div>
              </div>
            )}

            {/* Age eligibility */}
            {ageMessage && selectedVaccineType && (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${
                ageValid
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {ageValid
                  ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                {ageMessage}
              </div>
            )}



            {/* Date administered */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date Administered *</label>
              <input
                type="date"
                value={dateAdministered}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDateAdministered(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B]"
              />
            </div>

            {/* Route */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Route of Administration</label>
              <div className="relative">
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] bg-white"
                >
                  <option value="">— Not specified —</option>
                  <option value="subcutaneous">Subcutaneous</option>
                  <option value="intramuscular">Intramuscular</option>
                  <option value="intranasal">Intranasal</option>
                  <option value="oral">Oral</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Manufacturer + Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Zoetis"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Batch / Lot No.</label>
                <input
                  type="text"
                  placeholder="e.g. B2025-01"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B]"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Clinical Notes</label>
              <textarea
                rows={2}
                placeholder="Any observations, reactions, or notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] resize-none"
              />
            </div>
          </div>

          {/* Decline section (edit only) */}
          {editId && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <button
                onClick={() => setShowDecline(!showDecline)}
                className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4" />
                Mark as Declined
              </button>
              {showDecline && (
                <div className="mt-3 space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Reason for declining (required)…"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-400 resize-none"
                  />
                  <button
                    onClick={handleDecline}
                    disabled={declining || !declineReason.trim()}
                    className="w-full py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {declining ? 'Processing…' : 'Confirm Decline'}
                  </button>
                  <p className="text-xs text-red-400">This action is permanent and cannot be reversed.</p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !ageValid}
              title={!ageValid ? (ageMessage || 'Pet does not meet age requirements') : undefined}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#476B6B] text-white rounded-xl font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Record Vaccination'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function ClinicVaccinationFormPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <ClinicVaccinationFormInner />
    </Suspense>
  )
}
