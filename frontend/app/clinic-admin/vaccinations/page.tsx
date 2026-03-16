'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getStatusLabel, getStatusClasses, deleteVaccineType, deleteVaccination, getClinicVaccinations, type Vaccination, type VaccineType } from '@/lib/vaccinations'
import {
  Syringe,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  Loader,
  X,
  CheckCircle2,
  Pencil,
  Trash2,
  ClipboardList,
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

// ── Shared ──────────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'active', 'pending', 'overdue'] as const
type StatusTab = (typeof STATUS_TABS)[number]

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Vaccine Types helpers ────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Canine' },
  { value: 'cat', label: 'Feline' },
  { value: 'all', label: 'Both' },
]

const ROUTE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
  { value: 'intramuscular', label: 'Intramuscular (IM)' },
  { value: 'intranasal', label: 'Intranasal (IN)' },
  { value: 'oral', label: 'Oral' },
]

const VACCINE_SUGGESTIONS: Record<string, string[]> = {
  dog: [
    'DHPPiL', 'DA2PPL', 'DHPP', 'DA2PP', 'Anti-Rabies', 'Bordetella',
    'Leptospira', 'Canine Influenza', 'Lyme Disease', 'Parvovirus',
    'Distemper', 'Ehrlichia Canis',
  ],
  cat: [
    'FVRCP', 'Anti-Rabies', 'FeLV', 'FIV', 'Chlamydia',
    'Panleukopenia', 'Herpesvirus', 'Calicivirus',
  ],
  all: [
    'Anti-Rabies', 'DHPPiL', 'DA2PPL', 'DHPP', 'DA2PP', 'FVRCP',
    'Bordetella', 'Leptospira', 'FeLV', 'FIV', 'Canine Influenza',
    'Lyme Disease', 'Parvovirus', 'Distemper', 'Ehrlichia Canis',
    'Chlamydia', 'Panleukopenia', 'Herpesvirus', 'Calicivirus',
  ],
}

interface TypeFormState {
  name: string
  species: string[]
  validityDays: string
  requiresBooster: boolean
  lifetimeBooster: boolean
  numberOfBoosters: string
  boosterIntervalDays: string
  minAgeMonths: string
  minAgeUnit: 'weeks' | 'months'
  maxAgeMonths: string
  maxAgeUnit: 'weeks' | 'months'
  route: string
  defaultManufacturer: string
  defaultBatchNumber: string
}

const emptyTypeForm = (): TypeFormState => ({
  name: '',
  species: ['dog'],
  validityDays: '365',
  requiresBooster: false,
  lifetimeBooster: false,
  numberOfBoosters: '1',
  boosterIntervalDays: '',
  minAgeMonths: '0',
  minAgeUnit: 'months',
  maxAgeMonths: '',
  maxAgeUnit: 'months',
  route: '',
  defaultManufacturer: '',
  defaultBatchNumber: '',
})

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  both: 'Canine + Feline',
  all: 'Canine + Feline',
}

function SpeciesBadge({ species }: { species: string[] }) {
  const isBoth = species.includes('dog') && species.includes('cat')
  const display = isBoth
    ? [{ key: 'both', label: 'Canine + Feline', cls: 'bg-teal-100 text-teal-700' }]
    : species.map((s) => ({
        key: s,
        label: SPECIES_LABEL[s] ?? s,
        cls: s === 'dog' ? 'bg-amber-100 text-amber-700' : s === 'cat' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700',
      }))
  return (
    <div className="flex gap-1 flex-wrap">
      {display.map((d) => (
        <span key={d.key} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.cls}`}>
          {d.label}
        </span>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClinicAdminVaccinationsPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [tab, setTab] = useState<'records' | 'types'>('records')

  // ── Records state ──
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')

  const fetchVaccinations = useCallback(async () => {
    if (!token) return
    setRecLoading(true)
    try {
      const data = await getClinicVaccinations(token, { status: activeTab !== 'all' ? activeTab : undefined })
      setVaccinations(data)
    } finally {
      setRecLoading(false)
    }
  }, [token, activeTab])

  useEffect(() => {
    if (tab === 'records') fetchVaccinations()
  }, [fetchVaccinations, tab])

  const filtered = vaccinations.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    const petName = typeof v.petId === 'object' ? (v.petId as any)?.name?.toLowerCase() ?? '' : ''
    return v.vaccineName.toLowerCase().includes(q) || petName.includes(q)
  })

  function getPetPhoto(v: Vaccination) {
    const pet = typeof v.petId === 'object' ? (v.petId as any) : null
    return pet?.photo ?? null
  }

  function getPetInitial(v: Vaccination) {
    const pet = typeof v.petId === 'object' ? (v.petId as any) : null
    if (pet?.name) return pet.name[0].toUpperCase()
    return '?'
  }

  function getPetName(v: Vaccination) {
    const pet = typeof v.petId === 'object' ? (v.petId as any) : null
    return pet?.name ?? '—'
  }

  function getVetName(v: Vaccination) {
    const vet = typeof v.vetId === 'object' ? (v.vetId as any) : null
    if (!vet) return '—'
    return `${vet.firstName || ''} ${vet.lastName || ''}`.trim() || '—'
  }

  function getVetName(v: Vaccination) {
    const vet = v.vetId as any
    if (!vet) return '—'
    return typeof vet === 'object' ? `Dr. ${vet.lastName ?? ''}`.trim() : '—'
  }

  // ── Vaccine Types state ──
  const [types, setTypes] = useState<VaccineType[]>([])
  const [typesLoading, setTypesLoading] = useState(false)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<VaccineType | null>(null)
  const [form, setForm] = useState<TypeFormState>(emptyTypeForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<VaccineType | null>(null)
  const [deletingType, setDeletingType] = useState(false)

  const loadTypes = useCallback(async () => {
    if (!token) return
    setTypesLoading(true)
    setTypesError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/vaccine-types?includeInactive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.status === 'SUCCESS') {
        setTypes(json.data.vaccineTypes)
      } else {
        setTypesError('Failed to load vaccine types')
      }
    } catch {
      setTypesError('Failed to load vaccine types')
    } finally {
      setTypesLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (tab === 'types') loadTypes()
  }, [loadTypes, tab])

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyTypeForm())
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const openEdit = (vt: VaccineType) => {
    setEditTarget(vt)
    const speciesVal = vt.species.includes('dog') && vt.species.includes('cat') ? ['all'] : [...vt.species]
    setForm({
      name: vt.name,
      species: speciesVal,
      validityDays: String(vt.validityDays),
      requiresBooster: vt.requiresBooster,
      lifetimeBooster: vt.lifetimeBooster ?? false,
      numberOfBoosters: vt.numberOfBoosters != null ? String(vt.numberOfBoosters) : '1',
      boosterIntervalDays: vt.boosterIntervalDays ? String(vt.boosterIntervalDays) : '',
      minAgeMonths: String(vt.minAgeMonths),
      minAgeUnit: vt.minAgeUnit as 'weeks' | 'months' || 'months',
      maxAgeMonths: vt.maxAgeMonths != null ? String(vt.maxAgeMonths) : '',
      maxAgeUnit: vt.maxAgeUnit as 'weeks' | 'months' || 'months',
      route: vt.route || '',
      defaultManufacturer: (vt as any).defaultManufacturer || '',
      defaultBatchNumber: (vt as any).defaultBatchNumber || '',
    })
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const handleSpeciesToggle = (s: string) => {
    setForm((f) => ({ ...f, species: [s] }))
  }

  const handleSave = async () => {
    if (!token) return
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    if (form.species.length === 0) { setSaveError('Select at least one species'); return }
    if (!form.validityDays || isNaN(Number(form.validityDays))) { setSaveError('Valid validity days required'); return }
    if (form.requiresBooster && (!form.boosterIntervalDays || isNaN(Number(form.boosterIntervalDays)))) {
      setSaveError('Booster interval required when booster is enabled')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name: form.name.trim(),
        species: form.species,
        validityDays: Number(form.validityDays),
        requiresBooster: form.requiresBooster,
        lifetimeBooster: form.requiresBooster ? form.lifetimeBooster : false,
        numberOfBoosters: form.requiresBooster && !form.lifetimeBooster ? (Number(form.numberOfBoosters) || 1) : 0,
        boosterIntervalDays: form.requiresBooster && form.boosterIntervalDays ? Number(form.boosterIntervalDays) : null,
        minAgeMonths: Number(form.minAgeMonths) || 0,
        minAgeUnit: form.minAgeUnit,
        maxAgeMonths: form.maxAgeMonths ? Number(form.maxAgeMonths) : null,
        maxAgeUnit: form.maxAgeUnit,
        route: form.route || null,
        defaultManufacturer: form.defaultManufacturer.trim() || null,
        defaultBatchNumber: form.defaultBatchNumber.trim() || null,
      }
      const url = editTarget
        ? `${API_BASE_URL}/vaccine-types/${editTarget._id}`
        : `${API_BASE_URL}/vaccine-types`
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.status !== 'SUCCESS') throw new Error(json.message || 'Failed to save')
      setSaveSuccess(true)
      await loadTypes()
      setTimeout(() => { setShowModal(false); setSaveSuccess(false) }, 800)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save vaccine type')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVaccineType = async () => {
    if (!token || !deleteTypeTarget) return
    setDeletingType(true)
    try {
      await deleteVaccineType(deleteTypeTarget._id, token)
      setTypes((prev) => prev.filter((t) => t._id !== deleteTypeTarget._id))
      setDeleteTypeTarget(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete vaccine type')
    } finally {
      setDeletingType(false)
    }
  }

  const handleToggle = async (vt: VaccineType) => {
    if (!token) return
    setTogglingId(vt._id)
    try {
      await fetch(`${API_BASE_URL}/vaccine-types/${vt._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !vt.isActive }),
      })
      await loadTypes()
    } catch { /* silent */ } finally {
      setTogglingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen overflow-hidden p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7FA5A3]/10 rounded-xl flex items-center justify-center">
              <Syringe className="w-5 h-5 text-[#7FA5A3]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#4F4F4F]">Vaccinations</h1>
              <p className="text-sm text-gray-500">Records and vaccine catalog</p>
            </div>
          </div>
          {tab === 'records' ? (
            <button
              onClick={() => router.push('/clinic-admin/vaccinations/new')}
              className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vaccination
            </button>
          ) : (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vaccine Type
            </button>
          )}
        </div>

        {/* Main tabs */}
        <div className="inline-grid grid-cols-2 bg-white rounded-full p-1.5 shadow-sm mb-3">
          {([
            { value: 'records', label: 'Records', icon: <ClipboardList className="w-4 h-4" /> },
            { value: 'types', label: 'Vaccine Types', icon: <Syringe className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.value ? 'bg-[#476B6B] text-white shadow-sm' : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── RECORDS TAB ── */}
        {tab === 'records' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Status filters */}
            <div className="flex bg-white rounded-full p-1.5 shadow-sm mb-5 shrink-0">
              {STATUS_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize ${
                    activeTab === t ? 'bg-[#476B6B] text-white shadow-sm' : 'text-[#4F4F4F] hover:bg-gray-50'
                  }`}
                >
                  {t === 'all' ? 'All' : getStatusLabel(t as Vaccination['status'])}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-5 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by pet name or vaccine…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8F6F2] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>

            {recLoading ? (
              <div className="space-y-3 shrink-0">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  No {activeTab !== 'all' ? activeTab : ''} vaccination records found
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="hidden md:grid grid-cols-[40px_1fr_1fr_140px_140px_140px_120px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide border-b sticky top-0 z-10">
                  <span />
                  <span>Pet</span>
                  <span>Vaccine</span>
                  <span>Date Given</span>
                  <span>Expires</span>
                  <span>Booster Due</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {filtered.map((v) => (
                    <button
                      key={v._id}
                      onClick={() => router.push(`/clinic-admin/vaccinations/new?view=${v._id}`)}
                      className="w-full text-left hover:bg-[#f8fbfb] transition-colors"
                    >
                      {/* Mobile card */}
                      <div className="md:hidden p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getPetPhoto(v) ? (
                              <img src={getPetPhoto(v)!} alt={getPetName(v)} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {getPetInitial(v)}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-[#4F4F4F] text-sm">{getPetName(v)}</p>
                              <p className="text-xs text-gray-500">{getVetName(v)}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusClasses(v.status)}`}>
                            {getStatusLabel(v.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium">{v.vaccineName}</p>
                        <p className="text-xs text-gray-400 mt-1">Given: {formatDate(v.dateAdministered)} · Expires: {formatDate(v.expiryDate)}</p>
                        {v.nextDueDate && <p className="text-xs text-amber-500 font-medium mt-0.5">Booster Due: {formatDate(v.nextDueDate)}</p>}
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-[40px_1fr_1fr_140px_140px_140px_120px] gap-4 items-center px-5 py-3.5">
                        <div>
                          {getPetPhoto(v) ? (
                            <img src={getPetPhoto(v)!} alt={getPetName(v)} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {getPetInitial(v)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[#4F4F4F] text-sm">{getPetName(v)}</p>
                          <p className="text-xs text-gray-400">{getVetName(v)}</p>
                        </div>
                        <p className="text-sm text-gray-700">{v.vaccineName}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(v.dateAdministered)}
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(v.expiryDate)}</p>
                        <p className="text-xs text-amber-500 font-medium">{v.nextDueDate ? formatDate(v.nextDueDate) : '—'}</p>
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusClasses(v.status)}`}>
                          {getStatusLabel(v.status)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VACCINE TYPES TAB ── */}
        {tab === 'types' && (
          <>
            {typesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
              </div>
            ) : typesError ? (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {typesError}
              </div>
            ) : types.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Syringe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No vaccine types yet</p>
                <p className="text-sm mt-1">Add your first vaccine type to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...types].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map((vt) => (
                  <div
                    key={vt._id}
                    className={`bg-white border rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition-all ${!vt.isActive ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#4F4F4F] text-sm">{vt.name}</p>
                        <SpeciesBadge species={vt.species} />
                        {!vt.isActive && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                        <span>Protection: <span className="font-medium text-[#4F4F4F]">{vt.validityDays}d</span></span>
                        {vt.requiresBooster && vt.boosterIntervalDays && (
                          <span>Booster every: <span className="font-medium text-[#4F4F4F]">{vt.boosterIntervalDays}d{vt.lifetimeBooster ? ' (lifetime)' : ` × ${vt.numberOfBoosters || 1} dose${(vt.numberOfBoosters || 1) !== 1 ? 's' : ''}`}</span></span>
                        )}
                        {vt.route && <span>Route: <span className="font-medium text-[#4F4F4F] capitalize">{vt.route}</span></span>}
                        {(vt as any).defaultManufacturer && <span>Mfr: <span className="font-medium text-[#4F4F4F]">{(vt as any).defaultManufacturer}</span></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDeleteTypeTarget(vt)}
                        className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(vt)}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-[#476B6B] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(vt)}
                        disabled={togglingId === vt._id}
                        title={vt.isActive ? 'Deactivate' : 'Activate'}
                        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 shrink-0 overflow-hidden ${vt.isActive ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                      >
                        {togglingId === vt._id ? (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                          </span>
                        ) : (
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${vt.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Vaccine Type Confirmation Modal */}
      {deleteTypeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#4F4F4F]">Delete Vaccine Type</h2>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-semibold">{deleteTypeTarget.name}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTypeTarget(null)}
                disabled={deletingType}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVaccineType}
                disabled={deletingType}
                className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingType && <Loader className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Vaccine Type Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-[#4F4F4F]">
                {editTarget ? 'Edit Vaccine Type' : 'New Vaccine Type'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                  Vaccine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. DHPPiL, FVRCP, Anti-Rabies…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">Species</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPECIES_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSpeciesToggle(opt.value)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                        form.species.includes(opt.value)
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                  Protection Duration (days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1" value={form.validityDays}
                  onChange={(e) => setForm((p) => ({ ...p, validityDays: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-xs text-gray-400 mt-1">How long immunity lasts after each dose — not the vial&apos;s shelf life</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Min Age</label>
                    <input
                      type="number" min="0" value={form.minAgeMonths}
                      onChange={(e) => setForm((p) => ({ ...p, minAgeMonths: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Unit</label>
                    <select
                      value={form.minAgeUnit}
                      onChange={(e) => setForm((p) => ({ ...p, minAgeUnit: e.target.value as 'weeks' | 'months' }))}
                      className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    >
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Max Age</label>
                    <input
                      type="number" min="0" value={form.maxAgeMonths}
                      onChange={(e) => setForm((p) => ({ ...p, maxAgeMonths: e.target.value }))}
                      placeholder="Leave empty for no maximum"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Unit</label>
                    <select
                      value={form.maxAgeUnit}
                      onChange={(e) => setForm((p) => ({ ...p, maxAgeUnit: e.target.value as 'weeks' | 'months' }))}
                      className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    >
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#F8F6F2] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Requires Booster</p>
                  <p className="text-xs text-gray-400">Puppy/kitten series or boosters</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, requiresBooster: !p.requiresBooster }))}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${form.requiresBooster ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${form.requiresBooster ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {form.requiresBooster && (
                <>
                  <div className="flex items-center justify-between bg-[#F8F6F2] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#4F4F4F]">Lifetime Boosters?</p>
                      <p className="text-xs text-gray-400">Required for the pet&apos;s entire life</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, lifetimeBooster: !p.lifetimeBooster }))}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${form.lifetimeBooster ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${form.lifetimeBooster ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className={form.lifetimeBooster ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
                    <div>
                      <label className="block text-xs text-gray-500 font-semibold mb-1">Booster Interval (days) <span className="text-red-400">*</span></label>
                      <input
                        type="number" min="1" value={form.boosterIntervalDays}
                        onChange={(e) => setForm((p) => ({ ...p, boosterIntervalDays: e.target.value }))}
                        placeholder="e.g. 365"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      />
                    </div>
                    {!form.lifetimeBooster && (
                      <div>
                        <label className="block text-xs text-gray-500 font-semibold mb-1">Number of Boosters <span className="text-red-400">*</span></label>
                        <input
                          type="number" min="1" value={form.numberOfBoosters}
                          onChange={(e) => setForm((p) => ({ ...p, numberOfBoosters: e.target.value }))}
                          placeholder="e.g. 3"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Total doses in series = boosters + 1</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Default Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm((p) => ({ ...p, route: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                >
                  {ROUTE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Default Manufacturer</label>
                <input
                  type="text" value={form.defaultManufacturer}
                  onChange={(e) => setForm((p) => ({ ...p, defaultManufacturer: e.target.value }))}
                  placeholder="e.g. Merial, Zoetis, Boehringer…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-filled when this vaccine is selected in a visit record</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Default Batch / Lot Number</label>
                <input
                  type="text" value={form.defaultBatchNumber}
                  onChange={(e) => setForm((p) => ({ ...p, defaultBatchNumber: e.target.value }))}
                  placeholder="e.g. A12345"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-filled when this vaccine is selected in a visit record</p>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />Saved successfully
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || form.species.length === 0 || !form.validityDays}
                className="px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {editTarget ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
