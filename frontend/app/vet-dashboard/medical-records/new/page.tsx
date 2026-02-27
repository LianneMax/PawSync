'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  createMedicalRecord,
  updateMedicalRecord,
  getRecordById,
  getRecordByAppointment,
  emptyVitals,
  type Vitals,
} from '@/lib/medicalRecords'
import {
  Save,
  ArrowLeft,
  Search,
  Syringe,
  Share2,
  Eye,
  EyeOff,
  ChevronDown,
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
  species: string
  breed: string
}

interface AppointmentInfo {
  _id: string
  petId: { _id: string; name: string; species: string; breed: string }
  ownerId: { _id: string; firstName: string; lastName: string }
  clinicId: string
  clinicBranchId: string
  vetId: string
  types: string[]
  date: string
  startTime: string
}

const VITALS_CONFIG: { key: keyof Vitals; label: string; unit: string; placeholder: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', placeholder: 'e.g. 4.5' },
  { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: 'e.g. 38.5' },
  { key: 'pulseRate', label: 'Pulse Rate', unit: 'bpm', placeholder: 'e.g. 80' },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: 'e.g. 98' },
  { key: 'bodyConditionScore', label: 'Body Condition Score', unit: '/9', placeholder: '1–9' },
  { key: 'dentalScore', label: 'Dental Score', unit: '/4', placeholder: '0–4' },
  { key: 'crt', label: 'CRT', unit: 'sec', placeholder: 'e.g. 2' },
  { key: 'pregnancy', label: 'Pregnancy', unit: '', placeholder: 'e.g. Not pregnant' },
  { key: 'xray', label: 'X-Ray Findings', unit: '', placeholder: 'e.g. Normal' },
  { key: 'vaccinated', label: 'Vaccination Status', unit: '', placeholder: 'e.g. Up to date' },
]

function MedicalRecordFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const appointmentId = searchParams.get('appointmentId')
  const token = useAuthStore((s) => s.token)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Appointment pre-fill
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)

  // Owner / pet selection (when not from appointment)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerResults, setOwnerResults] = useState<Owner[]>([])
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)

  // Clinic info (pre-filled from auth or appointment)
  const [clinicId, setClinicId] = useState('')
  const [clinicBranchId, setClinicBranchId] = useState('')

  // Form state
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())
  const [visitSummary, setVisitSummary] = useState('')
  const [vetNotes, setVetNotes] = useState('')
  const [overallObservation, setOverallObservation] = useState('')
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [showVitals, setShowVitals] = useState(true)
  const [hasVaccinationDraft, setHasVaccinationDraft] = useState(false)
  const [vaccinationDraftId, setVaccinationDraftId] = useState<string | null>(null)

  // Load appointment info
  const loadAppointment = useCallback(async (apptId: string) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/appointments/${apptId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        const appt = data.data.appointment
        setAppointment(appt)
        setClinicId(appt.clinicId)
        setClinicBranchId(appt.clinicBranchId || '')
        if (typeof appt.petId === 'object') {
          setSelectedPet({ _id: appt.petId._id, name: appt.petId.name, species: appt.petId.species, breed: appt.petId.breed })
        }
        // Check if there's a vaccination draft for this appointment
        if (appt.types?.includes('vaccination')) {
          checkVaccinationDraft(apptId)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  const checkVaccinationDraft = async (apptId: string) => {
    if (!token) return
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/pets?ownerId=placeholder`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // Try to find vaccination linked to appointment
      const vaxRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/vet/my-records`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const vaxData = await vaxRes.json()
      if (vaxData.status === 'SUCCESS') {
        const draft = (vaxData.data.vaccinations || []).find(
          (v: any) => v.appointmentId === apptId || v.appointmentId?._id === apptId
        )
        if (draft) {
          setHasVaccinationDraft(true)
          setVaccinationDraftId(draft._id)
        }
      }
    } catch { /* ignore */ }
  }

  // Load existing record for edit
  const loadRecord = useCallback(async (id: string) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await getRecordById(id, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        const rec = res.data.record
        setVitals(rec.vitals || emptyVitals())
        setVisitSummary(rec.visitSummary || '')
        setVetNotes(rec.vetNotes || '')
        setOverallObservation(rec.overallObservation || '')
        setSharedWithOwner(rec.sharedWithOwner)
        setClinicId(typeof rec.clinicId === 'object' ? rec.clinicId._id : rec.clinicId)
        setClinicBranchId(typeof rec.clinicBranchId === 'object' ? rec.clinicBranchId._id : rec.clinicBranchId)
        if (typeof rec.petId === 'object') {
          setSelectedPet({ _id: rec.petId._id, name: rec.petId.name, species: rec.petId.species, breed: rec.petId.breed })
        }
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (editId) {
      loadRecord(editId)
    } else if (appointmentId) {
      loadAppointment(appointmentId)
    }
  }, [editId, appointmentId, loadRecord, loadAppointment])

  // Owner search
  useEffect(() => {
    if (appointment || editId) return // don't search if from appointment or editing
    if (ownerSearch.length < 2) {
      setOwnerResults([])
      return
    }
    const timer = setTimeout(async () => {
      if (!token) return
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/owners?q=${encodeURIComponent(ownerSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') setOwnerResults(data.data.owners || [])
    }, 350)
    return () => clearTimeout(timer)
  }, [ownerSearch, token, appointment, editId])

  // Load pets when owner selected
  useEffect(() => {
    if (!selectedOwner || !token) return
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/search/pets?ownerId=${selectedOwner._id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'SUCCESS') setPets(data.data.pets || [])
      })
  }, [selectedOwner, token])

  const handleVitalChange = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }))
  }

  const handleSave = async () => {
    setError('')
    if (!selectedPet) {
      setError('Please select a patient')
      return
    }
    if (!clinicId) {
      setError('Clinic information is missing. Please log in again or select a clinic.')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        const res = await updateMedicalRecord(
          editId,
          { vitals, visitSummary, vetNotes, overallObservation, sharedWithOwner },
          token!
        )
        if (res.status === 'SUCCESS') {
          setSuccess(true)
          setTimeout(() => router.push('/vet-dashboard/medical-records'), 1500)
        } else {
          setError(res.message || 'Failed to update record')
        }
      } else {
        const payload: any = {
          petId: selectedPet._id,
          clinicId,
          clinicBranchId: clinicBranchId || undefined,
          vitals,
          visitSummary,
          vetNotes,
          overallObservation,
          sharedWithOwner,
        }
        if (appointmentId) payload.appointmentId = appointmentId
        const res = await createMedicalRecord(payload, token!)
        if (res.status === 'SUCCESS') {
          setSuccess(true)
          setTimeout(() => router.push('/vet-dashboard/medical-records'), 1500)
        } else {
          setError(res.message || 'Failed to create record')
        }
      }
    } finally {
      setSaving(false)
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
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">
              {editId ? 'Edit Medical Record' : 'New Medical Record'}
            </h1>
            {appointment && (
              <p className="text-sm text-gray-500 mt-0.5">
                From appointment · {new Date(appointment.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} {appointment.startTime}
              </p>
            )}
          </div>
        </div>

        {/* Vaccination draft notice */}
        {hasVaccinationDraft && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 text-sm">
              <Syringe className="w-4 h-4" />
              <span>There is a pending vaccination record for this appointment.</span>
            </div>
            <button
              onClick={() => router.push(`/vet-dashboard/vaccinations/new?edit=${vaccinationDraftId}`)}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Fill it now →
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            Record saved successfully! Redirecting…
          </div>
        )}

        <div className="space-y-5">
          {/* Patient selection */}
          {!appointment && !editId && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-[#4F4F4F] mb-4">Patient</h2>
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
                          onClick={() => {
                            setSelectedOwner(o)
                            setOwnerSearch('')
                            setOwnerResults([])
                          }}
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
                    <p className="text-sm text-gray-600">
                      Owner: <strong>{selectedOwner.firstName} {selectedOwner.lastName}</strong>
                    </p>
                    <button
                      onClick={() => { setSelectedOwner(null); setPets([]) }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Change
                    </button>
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
                  <button
                    onClick={() => { setSelectedPet(null) }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Change pet
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pre-filled patient (from appointment or edit) */}
          {(appointment || editId) && selectedPet && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-[#4F4F4F] mb-2">Patient</h2>
              <p className="font-medium text-[#4F4F4F]">{selectedPet.name}</p>
              <p className="text-sm text-gray-500 capitalize">{selectedPet.species} · {selectedPet.breed}</p>
            </div>
          )}

          {/* Vitals */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <button
              onClick={() => setShowVitals(!showVitals)}
              className="w-full flex items-center justify-between p-5"
            >
              <h2 className="font-semibold text-[#4F4F4F]">Vitals <span className="text-gray-400 font-normal text-sm">(optional)</span></h2>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showVitals ? 'rotate-180' : ''}`} />
            </button>
            {showVitals && (
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VITALS_CONFIG.map(({ key, label, unit, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {label} {unit && <span className="text-gray-400">{unit}</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={String(vitals[key]?.value ?? '')}
                      onChange={(e) => handleVitalChange(key, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#476B6B]"
                    />
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={vitals[key]?.notes ?? ''}
                      onChange={(e) => handleVitalChange(key, 'notes', e.target.value)}
                      className="w-full px-3 py-1.5 border-x border-b border-gray-200 rounded-b-lg text-xs text-gray-500 focus:outline-none focus:border-[#476B6B] -mt-px"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical notes */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-[#4F4F4F]">Clinical Notes</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Visit Summary</label>
              <textarea
                rows={3}
                placeholder="Brief summary of the visit, chief complaint, diagnosis…"
                value={visitSummary}
                onChange={(e) => setVisitSummary(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Overall Observation</label>
              <textarea
                rows={2}
                placeholder="Physical exam findings, clinical impression…"
                value={overallObservation}
                onChange={(e) => setOverallObservation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                Vet Notes <span className="text-gray-400">(private — not visible to owner)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Private notes, reminders, follow-up instructions…"
                value={vetNotes}
                onChange={(e) => setVetNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] resize-none"
              />
            </div>
          </div>

          {/* Share toggle */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">Share with Owner</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sharedWithOwner
                    ? 'Owner can view this record in their patient records page'
                    : 'Record is private — only you and clinic admins can see it'}
                </p>
              </div>
              <button
                onClick={() => setSharedWithOwner(!sharedWithOwner)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  sharedWithOwner ? 'bg-[#476B6B]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    sharedWithOwner ? 'left-5.5 translate-x-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#476B6B] text-white rounded-xl font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Record'}
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

export default function MedicalRecordFormPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <MedicalRecordFormInner />
    </Suspense>
  )
}
