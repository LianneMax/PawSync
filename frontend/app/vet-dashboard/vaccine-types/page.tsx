'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Syringe,
  Plus,
  Pencil,
  AlertCircle,
  Loader,
  X,
  CheckCircle2,
} from 'lucide-react'
import { getAllVaccineTypes, createVaccineType, updateVaccineType, type VaccineType } from '@/lib/vaccinations'

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
  const display = isBoth ? [{ key: 'both', label: 'Canine + Feline', cls: 'bg-teal-100 text-teal-700' }] : species.map((s) => ({
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

export default function VetVaccineTypesPage() {
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
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAllVaccineTypes(token)
      setTypes(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load vaccine types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

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
      await load()
      setTimeout(() => {
        setShowModal(false)
        setSaveSuccess(false)
      }, 800)
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
      await load()
    } catch {
      // ignore
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#476B6B] rounded-2xl flex items-center justify-center">
              <Syringe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#4F4F4F]">Vaccine Types</h1>
              <p className="text-sm text-gray-400">Manage your practice vaccine catalog</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vaccine Type
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 animate-spin text-[#476B6B]" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
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
                className={`bg-white border rounded-2xl px-5 py-4 flex items-center justify-between gap-4 transition-all ${
                  !vt.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[#4F4F4F] text-sm">{vt.name}</p>
                    <SpeciesBadge species={vt.species} />
                    {!vt.isActive && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                    <span>Valid: <span className="font-medium text-[#4F4F4F]">{vt.validityDays}d</span></span>
                    {vt.requiresBooster && vt.boosterIntervalDays && (
                      <span>Booster every: <span className="font-medium text-[#4F4F4F]">{vt.boosterIntervalDays}d</span></span>
                    )}
                    {vt.route && (
                      <span>Route: <span className="font-medium text-[#4F4F4F] capitalize">{vt.route}</span></span>
                    )}
                    {vt.defaultManufacturer && (
                      <span>Mfr: <span className="font-medium text-[#4F4F4F]">{vt.defaultManufacturer}</span></span>
                    )}
                    {vt.defaultBatchNumber && (
                      <span>Batch: <span className="font-medium text-[#4F4F4F]">{vt.defaultBatchNumber}</span></span>
                    )}
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
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${vt.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
              {/* Name */}
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

              {/* Species */}
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

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">
                    Validity (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.validityDays}
                    onChange={(e) => setForm((p) => ({ ...p, validityDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Min Age (months)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minAgeMonths}
                    onChange={(e) => setForm((p) => ({ ...p, minAgeMonths: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              </div>

              {/* Requires Booster */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresBooster}
                    onChange={(e) => setForm((p) => ({ ...p, requiresBooster: e.target.checked }))}
                    className="w-4 h-4 accent-[#476B6B]"
                  />
                  <span className="text-sm font-semibold text-[#4F4F4F]">Requires Booster</span>
                </label>
                {form.requiresBooster && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Booster interval (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={form.boosterIntervalDays}
                      onChange={(e) => setForm((p) => ({ ...p, boosterIntervalDays: e.target.value }))}
                      placeholder="e.g. 365"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                )}
              </div>

              {/* Route */}
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

              {/* Default Manufacturer */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Default Manufacturer</label>
                <input
                  type="text"
                  value={form.defaultManufacturer}
                  onChange={(e) => setForm((p) => ({ ...p, defaultManufacturer: e.target.value }))}
                  placeholder="e.g. Merial, Zoetis, Boehringer…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-filled when this vaccine is selected in a visit record</p>
              </div>

              {/* Default Batch Number */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1">Default Batch / Lot Number</label>
                <input
                  type="text"
                  value={form.defaultBatchNumber}
                  onChange={(e) => setForm((p) => ({ ...p, defaultBatchNumber: e.target.value }))}
                  placeholder="e.g. A12345"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-filled when this vaccine is selected in a visit record</p>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Saved successfully
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
