'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Syringe,
  Search,
  ChevronRight,
  AlertCircle,
  Loader,
  Plus,
  Pencil,
  X,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react'
import {
  getVetVaccinations,
  getStatusLabel,
  getStatusClasses,
  getAllVaccineTypes,
  createVaccineType,
  updateVaccineType,
  type Vaccination,
  type VaccineType,
} from '@/lib/vaccinations'

// ── Vaccination Records ──────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'expired', label: 'Expired' },
  { value: 'declined', label: 'Declined' },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getPetName(vax: Vaccination): string {
  if (typeof vax.petId === 'object' && vax.petId !== null) return (vax.petId as any).name || 'Unknown Pet'
  return 'Unknown Pet'
}

function getPetSpecies(vax: Vaccination): string {
  if (typeof vax.petId === 'object' && vax.petId !== null) return (vax.petId as any).species || ''
  return ''
}

function getPetPhoto(vax: Vaccination): string | null {
  if (typeof vax.petId === 'object' && vax.petId !== null) return (vax.petId as any).photo || null
  return null
}

// ── Vaccine Types ────────────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Canine' },
  { value: 'cat', label: 'Feline' },
  { value: 'both', label: 'Both' },
]

const ROUTE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'subcutaneous', label: 'Subcutaneous (SC)' },
  { value: 'intramuscular', label: 'Intramuscular (IM)' },
  { value: 'intranasal', label: 'Intranasal (IN)' },
  { value: 'oral', label: 'Oral' },
]

interface FormState {
  name: string
  species: string[]
  validityDays: string
  requiresBooster: boolean
  boosterIntervalDays: string
  minAgeMonths: string
  maxAgeMonths: string
  route: string
  defaultManufacturer: string
  defaultBatchNumber: string
}

const emptyForm = (): FormState => ({
  name: '',
  species: ['dog'],
  validityDays: '365',
  requiresBooster: false,
  boosterIntervalDays: '',
  minAgeMonths: '0',
  maxAgeMonths: '',
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

export default function VetVaccinationsPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [tab, setTab] = useState<'records' | 'types'>('records')

  // ── Records state ──
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [recError, setRecError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const loadVaccinations = useCallback(async () => {
    if (!token) return
    try {
      setRecLoading(true)
      setRecError(null)
      const data = await getVetVaccinations(token, { status: statusFilter !== 'all' ? statusFilter : undefined })
      setVaccinations(data)
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Failed to load vaccinations')
    } finally {
      setRecLoading(false)
    }
  }, [token, statusFilter])

  useEffect(() => { if (tab === 'records') loadVaccinations() }, [loadVaccinations, tab])

  const filtered = vaccinations.filter((vax) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return getPetName(vax).toLowerCase().includes(term) || vax.vaccineName.toLowerCase().includes(term)
  })

  // ── Vaccine Types state ──
  const [types, setTypes] = useState<VaccineType[]>([])
  const [typesLoading, setTypesLoading] = useState(false)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<VaccineType | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    if (!token) return
    setTypesLoading(true)
    setTypesError(null)
    try {
      setTypes(await getAllVaccineTypes(token))
    } catch (e: any) {
      setTypesError(e.message || 'Failed to load vaccine types')
    } finally {
      setTypesLoading(false)
    }
  }, [token])

  useEffect(() => { if (tab === 'types') loadTypes() }, [loadTypes, tab])

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm())
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const openEdit = (vt: VaccineType) => {
    setEditTarget(vt)
    setForm({
      name: vt.name,
      species: vt.species,
      validityDays: String(vt.validityDays),
      requiresBooster: vt.requiresBooster,
      boosterIntervalDays: vt.boosterIntervalDays != null ? String(vt.boosterIntervalDays) : '',
      minAgeMonths: String(vt.minAgeMonths),
      maxAgeMonths: vt.maxAgeMonths != null ? String(vt.maxAgeMonths) : '',
      route: vt.route || '',
      defaultManufacturer: vt.defaultManufacturer || '',
      defaultBatchNumber: vt.defaultBatchNumber || '',
    })
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const handleSpeciesSelect = (val: string) => {
    setForm((prev) => ({ ...prev, species: val === 'both' ? ['dog', 'cat'] : [val] }))
  }

  const activeSpeciesOption = (val: string) => {
    if (val === 'both') return form.species.length === 2
    return form.species.length === 1 && form.species[0] === val
  }

  const handleSave = async () => {
    if (!token) return
    setSaveError(null)
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        species: form.species,
        validityDays: Number(form.validityDays),
        requiresBooster: form.requiresBooster,
        boosterIntervalDays: form.requiresBooster && form.boosterIntervalDays ? Number(form.boosterIntervalDays) : null,
        minAgeMonths: Number(form.minAgeMonths) || 0,
        maxAgeMonths: form.maxAgeMonths ? Number(form.maxAgeMonths) : null,
        route: form.route || null,
        defaultManufacturer: form.defaultManufacturer.trim() || null,
        defaultBatchNumber: form.defaultBatchNumber.trim() || null,
      }
      if (editTarget) {
        await updateVaccineType(editTarget._id, payload, token)
      } else {
        await createVaccineType(payload, token)
      }
      setSaveSuccess(true)
      await loadTypes()
      setTimeout(() => { setShowModal(false); setSaveSuccess(false) }, 800)
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (vt: VaccineType) => {
    if (!token) return
    setTogglingId(vt._id)
    try {
      await updateVaccineType(vt._id, { isActive: !vt.isActive }, token)
      await loadTypes()
    } catch { /* ignore */ } finally {
      setTogglingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
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
          {tab === 'types' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vaccine Type
            </button>
          )}
        </div>

        {/* Tabs */}
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

        {/* Status filters */}
        {tab === 'records' && (
          <div className="flex bg-white rounded-full p-1.5 shadow-sm mb-6">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex-1 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === f.value ? 'bg-[#476B6B] text-white shadow-sm' : 'text-[#4F4F4F] hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── RECORDS TAB ── */}
        {tab === 'records' && (
          <>

            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by pet name or vaccine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8F6F2] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>

            {recLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
              </div>
            ) : recError ? (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {recError}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No vaccination records found</p>
                <p className="text-gray-400 text-sm mt-1">
                  {search ? 'Try a different search term.' : 'Vaccinations will appear here after completing a visit.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((vax) => (
                  <button
                    key={vax._id}
                    onClick={() => router.push(`/vet-dashboard/vaccinations/new?edit=${vax._id}`)}
                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-[#7FA5A3]/40 hover:bg-[#F8F6F2] transition-all text-left"
                  >
                    {getPetPhoto(vax) ? (
                      <img src={getPetPhoto(vax)!} alt={getPetName(vax)} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                        <span className="text-[#476B6B] font-bold text-sm">{getPetName(vax).charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-[#4F4F4F] text-sm truncate">{vax.vaccineName}</p>
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full shrink-0 ${getStatusClasses(vax.status)}`}>
                          {getStatusLabel(vax.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate capitalize">
                        {getPetName(vax)}{getPetSpecies(vax) ? ` · ${getPetSpecies(vax)}` : ''}
                      </p>
                      <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                        <span>Given: {formatDate(vax.dateAdministered)}</span>
                        {vax.expiryDate && <span>Expires: {formatDate(vax.expiryDate)}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {!recLoading && !recError && filtered.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-4">
                {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
              </p>
            )}
          </>
        )}

        {/* ── VACCINE TYPES TAB ── */}
        {tab === 'types' && (
          <>
            {typesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-6 h-6 animate-spin text-[#476B6B]" />
              </div>
            ) : typesError ? (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
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
                        <span>Valid: <span className="font-medium text-[#4F4F4F]">{vt.validityDays}d</span></span>
                        {vt.requiresBooster && vt.boosterIntervalDays && (
                          <span>Booster every: <span className="font-medium text-[#4F4F4F]">{vt.boosterIntervalDays}d</span></span>
                        )}
                        {vt.route && <span>Route: <span className="font-medium text-[#4F4F4F] capitalize">{vt.route}</span></span>}
                        {vt.defaultManufacturer && <span>Mfr: <span className="font-medium text-[#4F4F4F]">{vt.defaultManufacturer}</span></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(vt)}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-[#476B6B] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(vt)}
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

      {/* Create / Edit Modal */}
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
                <div className="flex gap-2">
                  {SPECIES_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSpeciesSelect(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        activeSpeciesOption(opt.value)
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                    Validity (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" min="1" value={form.validityDays}
                    onChange={(e) => setForm((p) => ({ ...p, validityDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Min Age (months)</label>
                  <input
                    type="number" min="0" value={form.minAgeMonths}
                    onChange={(e) => setForm((p) => ({ ...p, minAgeMonths: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Max Age (months)</label>
                  <input
                    type="number" min="0" value={form.maxAgeMonths}
                    onChange={(e) => setForm((p) => ({ ...p, maxAgeMonths: e.target.value }))}
                    placeholder="Leave empty for no max age"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={form.requiresBooster}
                    onChange={(e) => setForm((p) => ({ ...p, requiresBooster: e.target.checked }))}
                    className="w-4 h-4 accent-[#476B6B]"
                  />
                  <span className="text-sm font-semibold text-[#4F4F4F]">Requires Booster</span>
                </label>
                {form.requiresBooster && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Booster interval (days)</label>
                    <input
                      type="number" min="1" value={form.boosterIntervalDays}
                      onChange={(e) => setForm((p) => ({ ...p, boosterIntervalDays: e.target.value }))}
                      placeholder="e.g. 365"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                )}
              </div>

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
