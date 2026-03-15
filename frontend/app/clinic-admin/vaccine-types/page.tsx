'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Syringe,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader,
  X,
  CheckCircle2,
} from 'lucide-react'
import { getVaccineTypes, type VaccineType } from '@/lib/vaccinations'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

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

interface FormState {
  name: string
  species: string[]
  validityDays: string
  requiresBooster: boolean
  lifetimeBooster: boolean
  numberOfBoosters: string
  boosterIntervalDays: string
  boosterIntervalDaysList: string[] // per-dose overrides, indexed by dose transition
  minAgeMonths: string
  minAgeUnit: 'weeks' | 'months'
  maxAgeMonths: string
  maxAgeUnit: 'weeks' | 'months'
  route: string
}

const emptyForm = (): FormState => ({
  name: '',
  species: ['dog'],
  validityDays: '365',
  requiresBooster: false,
  lifetimeBooster: false,
  numberOfBoosters: '1',
  boosterIntervalDays: '',
  boosterIntervalDaysList: [],
  minAgeMonths: '0',
  minAgeUnit: 'months',
  maxAgeMonths: '',
  maxAgeUnit: 'months',
  route: '',
})

function SpeciesBadge({ species }: { species: string[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {species.map((s) => (
        <span
          key={s}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
            s === 'dog' ? 'bg-amber-100 text-amber-700' :
            s === 'cat' ? 'bg-purple-100 text-purple-700' :
            'bg-teal-100 text-teal-700'
          }`}
        >
          {s === 'all' ? 'Dog + Cat' : s}
        </span>
      ))}
    </div>
  )
}

export default function VaccineTypesPage() {
  const { token } = useAuthStore()
  const [types, setTypes] = useState<VaccineType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<VaccineType | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch all (including inactive) for admin view
      const res = await fetch(`${API_BASE_URL}/vaccine-types?includeInactive=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (json.status === 'SUCCESS') {
        setTypes(json.data.vaccineTypes)
      } else {
        // Fallback: public list (active only)
        const fallback = await getVaccineTypes()
        setTypes(fallback)
      }
    } catch {
      setError('Failed to load vaccine types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm())
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
      boosterIntervalDaysList: vt.boosterIntervalDaysList?.map(String) ?? [],
      minAgeMonths: String(vt.minAgeMonths),
      minAgeUnit: vt.minAgeUnit as 'weeks' | 'months' || 'months',
      maxAgeMonths: vt.maxAgeMonths != null ? String(vt.maxAgeMonths) : '',
      maxAgeUnit: vt.maxAgeUnit as 'weeks' | 'months' || 'months',
      route: vt.route || '',
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
        boosterIntervalDaysList: form.requiresBooster && !form.lifetimeBooster
          ? form.boosterIntervalDaysList.map(Number).filter(n => n > 0)
          : [],
        minAgeMonths: Number(form.minAgeMonths) || 0,
        minAgeUnit: form.minAgeUnit,
        maxAgeMonths: form.maxAgeMonths ? Number(form.maxAgeMonths) : null,
        maxAgeUnit: form.maxAgeUnit,
        route: form.route || null,
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
      setTimeout(() => {
        setShowModal(false)
        load()
      }, 1000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save vaccine type')
    } finally {
      setSaving(false)
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
      await load()
    } catch {
      /* silent */
    } finally {
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
              <h1 className="text-xl font-bold text-[#4F4F4F]">Vaccine Types</h1>
              <p className="text-sm text-gray-500">Manage available vaccine options for your clinic</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#476B6B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3d5c5c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vaccine Type
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="space-y-2">
            {types.map((vt) => (
              <div
                key={vt._id}
                className={`bg-white border rounded-2xl px-5 py-4 flex items-center gap-4 transition-all ${
                  vt.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[#4F4F4F] text-sm">{vt.name}</p>
                    {!vt.isActive && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <SpeciesBadge species={vt.species} />
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
                    <span>Protection: {vt.validityDays}d</span>
                    {vt.requiresBooster && vt.boosterIntervalDays && (
                      <span>Booster every: {vt.boosterIntervalDays}d{vt.lifetimeBooster ? ' (lifetime)' : ` × ${vt.numberOfBoosters || 1} dose${(vt.numberOfBoosters || 1) !== 1 ? 's' : ''}`}</span>
                    )}
                    {vt.minAgeMonths > 0 && <span>Min age: {vt.minAgeMonths}mo</span>}
                    {vt.maxAgeMonths && <span>Max age: {vt.maxAgeMonths}mo</span>}
                    {vt.route && <span className="capitalize">Route: {vt.route}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(vt)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#476B6B] hover:bg-[#F8F6F2] transition-colors"
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
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${vt.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {types.length === 0 && (
              <div className="text-center py-16">
                <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No vaccine types yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <h2 className="font-bold text-[#4F4F4F]">
                {editTarget ? 'Edit Vaccine Type' : 'Add Vaccine Type'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {saveSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Saved successfully!
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Vaccine Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rabies, DHPPiL..."
                  className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>

              {/* Species */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Species <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SPECIES_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSpeciesToggle(s.value)}
                      className={`py-2.5 rounded-xl text-sm font-normal border transition-colors ${
                        form.species.includes(s.value)
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Protection Duration */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Protection Duration (days) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.validityDays}
                  onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))}
                  className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-[10px] text-gray-400 mt-1">How long immunity lasts after each dose — not the vial&apos;s shelf life</p>
              </div>

              {/* Requires Booster */}
              <div className="flex items-center justify-between bg-[#F8F6F2] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Requires Booster</p>
                  <p className="text-xs text-gray-400">Puppy/kitten series or boosters</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, requiresBooster: !f.requiresBooster }))}
                  className="text-gray-400 hover:text-[#476B6B] transition-colors"
                >
                  {form.requiresBooster
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft className="w-6 h-6" />
                  }
                </button>
              </div>

              {/* Booster details */}
              {form.requiresBooster && (
                <>
                  <div className="flex items-center justify-between bg-[#F8F6F2] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#4F4F4F]">Lifetime Boosters?</p>
                      <p className="text-xs text-gray-400">Required for the pet&apos;s entire life</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, lifetimeBooster: !f.lifetimeBooster }))}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${form.lifetimeBooster ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${form.lifetimeBooster ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className={form.lifetimeBooster ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                        Booster Interval (days) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.boosterIntervalDays}
                        onChange={(e) => setForm((f) => ({ ...f, boosterIntervalDays: e.target.value }))}
                        placeholder="e.g. 365"
                        className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      />
                    </div>
                    {!form.lifetimeBooster && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                          Number of Boosters <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={form.numberOfBoosters}
                          onChange={(e) => {
                            const n = Math.max(1, parseInt(e.target.value) || 1)
                            setForm((f) => ({
                              ...f,
                              numberOfBoosters: e.target.value,
                              // resize per-dose list to match number of transitions (= numberOfBoosters)
                              boosterIntervalDaysList: Array.from({ length: n }, (_, i) => f.boosterIntervalDaysList[i] ?? ''),
                            }))
                          }}
                          placeholder="e.g. 3"
                          className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Total doses in series = boosters + 1</p>
                      </div>
                    )}
                  </div>

                  {/* Per-dose interval overrides — shown when there are 2+ transitions */}
                  {!form.lifetimeBooster && Number(form.numberOfBoosters) >= 2 && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                        Per-Dose Intervals (days)
                        <span className="text-gray-400 font-normal ml-1">— overrides the default above per dose</span>
                      </label>
                      <div className="space-y-2">
                        {Array.from({ length: Number(form.numberOfBoosters) }, (_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-28 shrink-0">Dose {i + 1} → {i + 2}:</span>
                            <input
                              type="number"
                              min="1"
                              value={form.boosterIntervalDaysList[i] ?? ''}
                              onChange={(e) => setForm((f) => {
                                const list = [...f.boosterIntervalDaysList]
                                list[i] = e.target.value
                                return { ...f, boosterIntervalDaysList: list }
                              })}
                              placeholder={form.boosterIntervalDays || 'days'}
                              className="w-full bg-[#F8F6F2] rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Leave blank to use the default interval for that dose</p>
                    </div>
                  )}
                </>
              )}

              {/* Min Age / Max Age */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Min Age</label>
                    <input
                      type="number"
                      min="0"
                      value={form.minAgeMonths}
                      onChange={(e) => setForm((f) => ({ ...f, minAgeMonths: e.target.value }))}
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Unit</label>
                    <select
                      value={form.minAgeUnit}
                      onChange={(e) => setForm((f) => ({ ...f, minAgeUnit: e.target.value as 'weeks' | 'months' }))}
                      className="w-full appearance-none bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    >
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Max Age</label>
                    <input
                      type="number"
                      min="0"
                      value={form.maxAgeMonths}
                      onChange={(e) => setForm((f) => ({ ...f, maxAgeMonths: e.target.value }))}
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Unit</label>
                    <select
                      value={form.maxAgeUnit}
                      onChange={(e) => setForm((f) => ({ ...f, maxAgeUnit: e.target.value as 'weeks' | 'months' }))}
                      className="w-full appearance-none bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    >
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Route */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Default Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))}
                  className="w-full appearance-none bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  {ROUTE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className="w-full py-3 bg-[#476B6B] text-white rounded-2xl font-semibold text-sm hover:bg-[#3d5c5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Saving...' : editTarget ? 'Update Vaccine Type' : 'Add Vaccine Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
