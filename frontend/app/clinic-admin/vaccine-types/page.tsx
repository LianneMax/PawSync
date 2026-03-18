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
import { getVaccineTypes, type VaccineType } from '@/lib/vaccinations'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

const VALIDITY_OPTIONS = [
  { label: '6 Months', days: 182 },
  { label: '1 Year', days: 365 },
  { label: '3 Years', days: 1095 },
]

function snapToValidityOption(days: number): number {
  return VALIDITY_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr.days - days) < Math.abs(prev.days - days) ? curr : prev
  ).days
}

function validityDaysToLabel(days: number): string {
  return VALIDITY_OPTIONS.find((o) => o.days === days)?.label ?? `${days}d`
}

/** Auto dose volume by species selection */
function getAutoDoseVolume(species: string): number | null {
  if (species === 'dog') return 1.0
  if (species === 'cat') return 0.5
  return null // 'all' or unset — must be set manually
}

interface FormState {
  name: string
  species: string
  validityDays: string
  isSeries: boolean
  totalSeries: string
  seriesIntervalDays: string
  boosterValid: boolean
  boosterIntervalDays: string
  minAgeMonths: string
  minAgeUnit: 'weeks' | 'months'
  maxAgeMonths: string
  maxAgeUnit: 'weeks' | 'months'
  route: string
  doseVolumeMl: string
}

const emptyForm = (): FormState => ({
  name: '',
  species: 'dog',
  validityDays: '365', // maps to "1 Year"
  isSeries: false,
  totalSeries: '3',
  seriesIntervalDays: '21',
  boosterValid: false,
  boosterIntervalDays: '365',
  minAgeMonths: '0',
  minAgeUnit: 'months',
  maxAgeMonths: '',
  maxAgeUnit: 'months',
  route: '',
  doseVolumeMl: '1.0', // default for canine
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

function Toggle({ on, onToggle, label, sublabel }: { on: boolean; onToggle: () => void; label: string; sublabel?: string }) {
  return (
    <div className="flex items-center justify-between bg-[#F8F6F2] rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-[#4F4F4F]">{label}</p>
        {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${on ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out will-change-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
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
      const res = await fetch(`${API_BASE_URL}/vaccine-types?includeInactive=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (json.status === 'SUCCESS') {
        setTypes(json.data.vaccineTypes)
      } else {
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
    const sp = vt.species.includes('dog') && vt.species.includes('cat') ? 'all' : (vt.species[0] ?? 'dog')
    setForm({
      name: vt.name,
      species: sp,
      validityDays: String(snapToValidityOption(vt.validityDays)),
      isSeries: vt.isSeries ?? false,
      totalSeries: String(vt.totalSeries ?? 3),
      seriesIntervalDays: String(vt.seriesIntervalDays ?? 21),
      boosterValid: vt.boosterValid ?? false,
      boosterIntervalDays: vt.boosterIntervalDays ? String(vt.boosterIntervalDays) : '365',
      minAgeMonths: String(vt.minAgeMonths ?? 0),
      minAgeUnit: vt.minAgeUnit ?? 'months',
      maxAgeMonths: vt.maxAgeMonths != null ? String(vt.maxAgeMonths) : '',
      maxAgeUnit: vt.maxAgeUnit ?? 'months',
      route: vt.route || '',
      doseVolumeMl: vt.doseVolumeMl != null ? String(vt.doseVolumeMl) : '',
    })
    setSaveError(null)
    setSaveSuccess(false)
    setShowModal(true)
  }

  const handleSpeciesChange = (s: string) => {
    const autoVol = getAutoDoseVolume(s)
    setForm((f) => ({
      ...f,
      species: s,
      doseVolumeMl: autoVol != null ? String(autoVol) : '',
    }))
  }

  const handleSave = async () => {
    if (!token) return
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    if (!form.species) { setSaveError('Select species'); return }
    if (!form.validityDays || isNaN(Number(form.validityDays))) { setSaveError('Valid validity days required'); return }
    if (form.boosterValid && (!form.boosterIntervalDays || isNaN(Number(form.boosterIntervalDays)))) {
      setSaveError('Booster interval required when boosters are enabled')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name: form.name.trim(),
        species: form.species === 'all' ? ['dog', 'cat'] : [form.species],
        validityDays: Number(form.validityDays),
        isSeries: form.isSeries,
        totalSeries: form.isSeries ? (Number(form.totalSeries) || 3) : 1,
        seriesIntervalDays: form.isSeries ? (Number(form.seriesIntervalDays) || 21) : 21,
        boosterValid: form.boosterValid,
        boosterIntervalDays: form.boosterValid ? (Number(form.boosterIntervalDays) || 365) : null,
        minAgeMonths: Number(form.minAgeMonths) || 0,
        minAgeUnit: form.minAgeUnit,
        maxAgeMonths: form.maxAgeMonths ? Number(form.maxAgeMonths) : null,
        maxAgeUnit: form.maxAgeUnit,
        route: form.route || null,
        doseVolumeMl: form.doseVolumeMl !== '' ? Number(form.doseVolumeMl) : null,
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
                    <span>Protection: {validityDaysToLabel(vt.validityDays)}</span>
                    {vt.isSeries && (
                      <span>Series: {vt.totalSeries ?? 3} doses × {vt.seriesIntervalDays ?? 21}d apart</span>
                    )}
                    {vt.boosterValid && vt.boosterIntervalDays && (
                      <span>Booster: every {vt.boosterIntervalDays}d (lifetime)</span>
                    )}
                    {vt.doseVolumeMl != null && <span>Dose: {vt.doseVolumeMl} mL</span>}
                    {vt.minAgeMonths > 0 && <span>Min age: {vt.minAgeMonths}{vt.minAgeUnit === 'weeks' ? 'wk' : 'mo'}</span>}
                    {vt.maxAgeMonths != null && <span>Max age: {vt.maxAgeMonths}{vt.maxAgeUnit === 'weeks' ? 'wk' : 'mo'}</span>}
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
                  placeholder="e.g. Rabies, DHPPiL, FVRCP…"
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
                      onClick={() => handleSpeciesChange(s.value)}
                      className={`py-2.5 rounded-xl text-sm font-normal border transition-colors ${
                        form.species === s.value
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {form.species !== 'all' && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Dose volume auto-set: {form.species === 'dog' ? '1.0 mL (canine)' : '0.5 mL (feline)'}
                  </p>
                )}
              </div>

              {/* Protection Duration */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  Protection Duration <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {VALIDITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, validityDays: String(opt.days) }))}
                      className={`py-2.5 rounded-xl text-sm font-normal border transition-colors ${
                        form.validityDays === String(opt.days)
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">How long immunity lasts after each dose</p>
              </div>

              {/* Has Series toggle */}
              <Toggle
                on={form.isSeries}
                onToggle={() => setForm((f) => ({ ...f, isSeries: !f.isSeries }))}
                label="Has Series"
                sublabel="Vaccine requires multiple doses before protection is complete"
              />

              {/* Series details */}
              {form.isSeries && (
                <div className="grid grid-cols-2 gap-3 pl-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                      Total Doses in Series <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={form.totalSeries}
                      onChange={(e) => setForm((f) => ({ ...f, totalSeries: e.target.value }))}
                      placeholder="3"
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Default: 3</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                      Interval Between Doses (days) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.seriesIntervalDays}
                      onChange={(e) => setForm((f) => ({ ...f, seriesIntervalDays: e.target.value }))}
                      placeholder="21"
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Default: 21 days</p>
                  </div>
                </div>
              )}

              {/* Requires Booster toggle */}
              <Toggle
                on={form.boosterValid}
                onToggle={() => setForm((f) => ({ ...f, boosterValid: !f.boosterValid }))}
                label="Requires Booster"
                sublabel={form.isSeries
                  ? 'Lifetime annual boosters after series completion'
                  : 'Lifetime boosters after the initial single dose'}
              />

              {/* Booster interval */}
              {form.boosterValid && (
                <div className="pl-2">
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                    Booster Interval (days) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.boosterIntervalDays}
                    onChange={(e) => setForm((f) => ({ ...f, boosterIntervalDays: e.target.value }))}
                    placeholder="365"
                    className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Default: 365 days (annual). Boosters continue for the pet&apos;s lifetime.</p>
                </div>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-left"
                        >
                          {form.minAgeUnit === 'weeks' ? 'Weeks' : 'Months'}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                        <DropdownMenuRadioGroup
                          value={form.minAgeUnit}
                          onValueChange={(value) => setForm((f) => ({ ...f, minAgeUnit: value as 'weeks' | 'months' }))}
                        >
                          <DropdownMenuRadioItem value="weeks">Weeks</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="months">Months</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      placeholder="No limit"
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Unit</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-left"
                        >
                          {form.maxAgeUnit === 'weeks' ? 'Weeks' : 'Months'}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                        <DropdownMenuRadioGroup
                          value={form.maxAgeUnit}
                          onValueChange={(value) => setForm((f) => ({ ...f, maxAgeUnit: value as 'weeks' | 'months' }))}
                        >
                          <DropdownMenuRadioItem value="weeks">Weeks</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="months">Months</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Default Route */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Default Route</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-left"
                    >
                      {ROUTE_OPTIONS.find((r) => r.value === form.route)?.label || 'Not specified'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                    <DropdownMenuRadioGroup value={form.route} onValueChange={(value) => setForm((f) => ({ ...f, route: value }))}>
                      {ROUTE_OPTIONS.map((r) => (
                        <DropdownMenuRadioItem key={r.value || '__empty'} value={r.value}>{r.label}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Dose Volume */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Dose Volume (mL)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.doseVolumeMl}
                  onChange={(e) => setForm((f) => ({ ...f, doseVolumeMl: e.target.value }))}
                  placeholder="e.g. 1.0"
                  readOnly={form.species !== 'all'}
                  className={`w-full bg-[#F8F6F2] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] ${form.species !== 'all' ? 'opacity-60 cursor-default' : ''}`}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {form.species === 'all' ? 'Enter volume manually for both species' : `Auto-set: ${form.species === 'dog' ? '1.0 mL (canine)' : '0.5 mL (feline)'}`}
                </p>
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
                {saving ? 'Saving…' : editTarget ? 'Update Vaccine Type' : 'Add Vaccine Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
