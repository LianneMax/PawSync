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
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'all', label: 'All (Dog & Cat)' },
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
  route: string
}

const emptyForm = (): FormState => ({
  name: '',
  species: ['dog'],
  validityDays: '365',
  requiresBooster: false,
  boosterIntervalDays: '',
  minAgeMonths: '0',
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
    setForm({
      name: vt.name,
      species: [...vt.species],
      validityDays: String(vt.validityDays),
      requiresBooster: vt.requiresBooster,
      boosterIntervalDays: vt.boosterIntervalDays ? String(vt.boosterIntervalDays) : '',
      minAgeMonths: String(vt.minAgeMonths),
      route: vt.route || '',
    })
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const handleSpeciesToggle = (s: string) => {
    if (s === 'all') {
      setForm((f) => ({ ...f, species: ['all'] }))
      return
    }
    setForm((f) => {
      const filtered = f.species.filter((x) => x !== 'all')
      if (filtered.includes(s)) {
        return { ...f, species: filtered.filter((x) => x !== s) || [s] }
      }
      return { ...f, species: [...filtered, s] }
    })
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
        boosterIntervalDays: form.requiresBooster && form.boosterIntervalDays ? Number(form.boosterIntervalDays) : null,
        minAgeMonths: Number(form.minAgeMonths) || 0,
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
                    <span>Valid: {vt.validityDays}d</span>
                    {vt.requiresBooster && vt.boosterIntervalDays && (
                      <span>Booster: {vt.boosterIntervalDays}d</span>
                    )}
                    {vt.minAgeMonths > 0 && <span>Min age: {vt.minAgeMonths}mo</span>}
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
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#476B6B] hover:bg-[#F8F6F2] transition-colors disabled:opacity-50"
                  >
                    {togglingId === vt._id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : vt.isActive ? (
                      <ToggleRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
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
                <div className="flex gap-2 flex-wrap">
                  {SPECIES_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSpeciesToggle(s.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
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

              {/* Validity Days */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Validity (days) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.validityDays}
                  onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))}
                  className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
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

              {/* Booster Interval */}
              {form.requiresBooster && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                    Booster Interval (days) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.boosterIntervalDays}
                    onChange={(e) => setForm((f) => ({ ...f, boosterIntervalDays: e.target.value }))}
                    placeholder="e.g. 21"
                    className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              )}

              {/* Min Age */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Minimum Age (months)</label>
                <input
                  type="number"
                  min="0"
                  value={form.minAgeMonths}
                  onChange={(e) => setForm((f) => ({ ...f, minAgeMonths: e.target.value }))}
                  className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
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
