'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Trash2, Plus, Pencil, ChevronDown, Minus, X, Syringe, Eye } from 'lucide-react'

// ==================== TYPES ====================

type Tab = 'Products' | 'Services' | 'Vaccines'

interface BranchInfo {
  id: string
  name: string
  isMain: boolean
}

interface BranchAvailabilityEntry {
  branchId: string
  branchName: string
  isActive: boolean
}

interface ProductItem {
  id: string
  name: string
  category: string
  price: number
  lastUpdateDate: string
  administrationRoute?: string
  administrationMethod?: string
  dosageAmount?: string
  dosePerKg?: number
  doseUnit?: string
  frequency?: number
  frequencyLabel?: string
  duration?: number
  durationLabel?: string
  intervalDays?: number
  weightMin?: number
  weightMax?: number
  branchAvailability: BranchAvailabilityEntry[]
}

/** Returns true if the item type/category qualifies for branch availability tracking */
function qualifiesForBranchAvailability(tab: 'Products' | 'Services', category: string): boolean {
  if (tab === 'Products') return category === 'Medication'
  return true
}

interface VaccineItem {
  id: string
  name: string
  species: string[]
  pricePerDose: number
}

// ==================== CONSTANTS ====================

const PRODUCT_CATEGORIES = ['Medication', 'Others'] as const
const SERVICE_CATEGORIES = ['Diagnostic Tests', 'Preventive Care', 'Surgeries', 'General Consultation', 'Grooming', 'Others'] as const
const ORAL_METHODS = ['Tablets', 'Capsules', 'Syrup'] as const
const TOPICAL_METHODS = ['Skin', 'Ears', 'Eyes', 'Wounds'] as const
const INJECTION_METHODS = ['IV', 'IM', 'SC'] as const
const PREVENTIVE_METHODS = ['Spot-on', 'Chewable'] as const
const DOSE_UNITS = ['mg', 'mcg', 'mL', 'IU', 'drops', 'tablet'] as const

type AdmRoute = 'oral' | 'topical' | 'injection' | 'preventive'

// ==================== HELPERS ====================

function formatAdministration(route?: string, method?: string): string {
  if (!route) return '—'
  if (route === 'injection') return 'Injection'
  const routeLabel = route.charAt(0).toUpperCase() + route.slice(1)
  const methodLabel = method ? method.charAt(0).toUpperCase() + method.slice(1) : ''
  return methodLabel ? `${routeLabel} · ${methodLabel}` : routeLabel
}

// ==================== ADD MODAL ====================

interface AddModalProps {
  tab: 'Products' | 'Services'
  token: string | null
  branches: BranchInfo[]
  onClose: () => void
  onSaved: (item: ProductItem) => void
}

function AddModal({ tab, token, branches, onClose, onSaved }: AddModalProps) {
  const isProducts = tab === 'Products'
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

  // --- Simple form state (Services tab + Products "Others") ---
  const [simpleForm, setSimpleForm] = useState({
    name: '',
    price: '',
    description: '',
    category: (isProducts ? 'Others' : SERVICE_CATEGORIES[0]) as string,
  })

  // --- Branch availability selection ---
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set())
  const [localBranches, setLocalBranches] = useState<BranchInfo[]>([])
  const [branchLoading, setBranchLoading] = useState(true)
  const [branchFetchError, setBranchFetchError] = useState(false)

  // Fetch branches on mount so the modal doesn't depend on the parent having loaded them
  useEffect(() => {
    if (!token) { setBranchLoading(false); return }
    const fetchBranches = async () => {
      try {
        // Always use mine/branches — controller resolves the clinic from the JWT so
        // the URL clinicId param is irrelevant. Only fetch active branches.
        const url = `${apiUrl}/clinics/mine/branches`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (data.status === 'SUCCESS') {
          const list = Array.isArray(data.data) ? data.data : (data.data.branches ?? [])
          const mapped: BranchInfo[] = list.map((b: any) => ({ id: b._id, name: b.name, isMain: b.isMain ?? false }))
          setLocalBranches(mapped)
          setSelectedBranches(new Set(mapped.map((b) => b.id)))
        } else {
          setBranchFetchError(true)
        }
      } catch {
        setBranchFetchError(true)
      } finally {
        setBranchLoading(false)
      }
    }
    fetchBranches()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Products: type selection ---
  const [productType, setProductType] = useState<'medication' | 'others' | null>(null)

  // --- Medication sub-flow ---
  const [variantMode, setVariantMode] = useState<'new' | 'variant'>('new')
  const [existingMeds, setExistingMeds] = useState<string[]>([])
  const [loadingMeds, setLoadingMeds] = useState(false)
  const [medName, setMedName] = useState('')
  const [admRoute, setAdmRoute] = useState<AdmRoute | null>(null)
  const [admMethod, setAdmMethod] = useState('')
  const [medPrice, setMedPrice] = useState('')
  const [medDesc, setMedDesc] = useState('')
  const [medDosePerKg, setMedDosePerKg] = useState('')
  const [medDoseUnit, setMedDoseUnit] = useState('')
  const [medFreqType, setMedFreqType] = useState<'per_day' | 'every_hours' | ''>('')
  const [medFreqValue, setMedFreqValue] = useState('')
  const [medDurationType, setMedDurationType] = useState<'days' | 'until_healed' | 'as_needed' | ''>('')
  const [medDurationDays, setMedDurationDays] = useState('')
  const [medIntervalDays, setMedIntervalDays] = useState('')
  const [medWeightMin, setMedWeightMin] = useState('')
  const [medWeightMax, setMedWeightMax] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetch existing medication names for variant dropdown
  useEffect(() => {
    if (isProducts && productType === 'medication') {
      setLoadingMeds(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      fetch(`${apiUrl}/product-services?type=Product&category=Medication`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'SUCCESS') {
            const names = [...new Set<string>(data.data.items.map((i: any) => i.name as string))].sort()
            setExistingMeds(names)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMeds(false))
    }
  }, [isProducts, productType, token])

  // Reset method when route changes
  useEffect(() => { setAdmMethod('') }, [admRoute])

  const handleVariantModeChange = (mode: 'new' | 'variant') => {
    setVariantMode(mode)
    setMedName('')
    setAdmRoute(null)
    setAdmMethod('')
  }

  const handleExistingMedSelect = (name: string) => {
    setMedName(name)
    setAdmRoute(null)
    setAdmMethod('')
  }

  const handleProductTypeChange = (type: 'medication' | 'others') => {
    setProductType(type)
    setError('')
    // Reset medication state when switching
    setVariantMode('new')
    setMedName('')
    setAdmRoute(null)
    setAdmMethod('')
    setMedPrice('')
    setMedDesc('')
    setMedDosePerKg('')
    setMedDoseUnit('')
    setMedFreqType('')
    setMedFreqValue('')
    setMedDurationType('')
    setMedDurationDays('')
    setMedIntervalDays('')
    setMedWeightMin('')
    setMedWeightMax('')
  }

  const branchAvailabilityPayload = localBranches.map((b) => ({ branchId: b.id, isActive: selectedBranches.has(b.id) }))

  const mapBranchAvailability = (raw: any[]): BranchAvailabilityEntry[] =>
    (raw || []).map((ba: any) => ({
      branchId: typeof ba.branchId === 'object' ? ba.branchId._id : ba.branchId,
      branchName: typeof ba.branchId === 'object' ? ba.branchId.name : (branches.find((b) => b.id === ba.branchId)?.name ?? ''),
      isActive: ba.isActive,
    }))

  // ---- SAVE: simple form (Services tab or Products "Others") ----
  const handleSaveSimple = async () => {
    if (!simpleForm.name.trim() || !simpleForm.price) {
      setError('Name and price are required.')
      return
    }
    const parsed = parseFloat(simpleForm.price)
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid price.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const qualifies = qualifiesForBranchAvailability(tab, simpleForm.category)
      const res = await fetch(`${apiUrl}/product-services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: simpleForm.name.trim(),
          type: isProducts ? 'Product' : 'Service',
          category: simpleForm.category,
          price: parsed,
          description: simpleForm.description.trim(),
          ...(qualifies ? { branchAvailability: branchAvailabilityPayload } : {}),
        }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onSaved({
          id: data.data.item._id,
          name: data.data.item.name,
          category: data.data.item.category ?? 'Others',
          price: data.data.item.price,
          lastUpdateDate: new Date(data.data.item.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          }),
          branchAvailability: mapBranchAvailability(data.data.item.branchAvailability),
        })
        onClose()
      } else {
        setError(data.message || 'Failed to create item.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ---- SAVE: medication ----
  const handleSaveMedication = async () => {
    if (!medName.trim()) { setError('Medication name is required.'); return }
    if (!admRoute) { setError('Please select an administration route.'); return }
    if ((admRoute === 'oral' || admRoute === 'topical' || admRoute === 'preventive') && !admMethod) {
      setError('Please select an administration method.'); return
    }
    if (!medPrice) { setError('Price is required.'); return }
    const parsed = parseFloat(medPrice)
    if (isNaN(parsed) || parsed < 0) { setError('Please enter a valid price.'); return }

    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const body: any = {
        name: medName.trim(),
        type: 'Product',
        category: 'Medication',
        administrationRoute: admRoute,
        administrationMethod: admMethod ? admMethod.toLowerCase() : null,
        price: parsed,
        description: medDesc.trim(),
        branchAvailability: branchAvailabilityPayload,
        ...(medDosePerKg ? { dosePerKg: parseFloat(medDosePerKg) } : {}),
        ...(medDoseUnit ? { doseUnit: medDoseUnit } : {}),
        ...(medFreqType === 'per_day' && medFreqValue
          ? { frequency: parseInt(medFreqValue), frequencyLabel: `${medFreqValue} times per day` }
          : medFreqType === 'every_hours' && medFreqValue
          ? { frequencyLabel: `every ${medFreqValue} hours` }
          : {}),
        ...(medDurationType === 'days' && medDurationDays
          ? { duration: parseInt(medDurationDays), durationLabel: `${medDurationDays} days` }
          : medDurationType === 'until_healed'
          ? { durationLabel: 'until healed' }
          : medDurationType === 'as_needed'
          ? { durationLabel: 'as needed' }
          : {}),
        ...(medIntervalDays ? { intervalDays: parseInt(medIntervalDays) } : {}),
        ...(medWeightMin ? { weightMin: parseFloat(medWeightMin) } : {}),
        ...(medWeightMax ? { weightMax: parseFloat(medWeightMax) } : {}),
      }
      const res = await fetch(`${apiUrl}/product-services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        const i = data.data.item
        onSaved({
          id: i._id,
          name: i.name,
          category: 'Medication',
          price: i.price,
          lastUpdateDate: new Date(i.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          }),
          administrationRoute: i.administrationRoute,
          administrationMethod: i.administrationMethod,
          dosageAmount: i.dosageAmount,
          dosePerKg: i.dosePerKg,
          doseUnit: i.doseUnit,
          frequency: i.frequency,
          frequencyLabel: i.frequencyLabel,
          duration: i.duration,
          durationLabel: i.durationLabel,
          intervalDays: i.intervalDays,
          weightMin: i.weightMin,
          weightMax: i.weightMax,
          branchAvailability: mapBranchAvailability(i.branchAvailability),
        })
        onClose()
      } else {
        setError(data.message || 'Failed to create medication.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isMedMode = isProducts && productType === 'medication'
  const isOthersMode = !isProducts || productType === 'others'
  const methodOptions = admRoute === 'oral' ? ORAL_METHODS : admRoute === 'topical' ? TOPICAL_METHODS : admRoute === 'injection' ? INJECTION_METHODS : admRoute === 'preventive' ? PREVENTIVE_METHODS : []

  const canSave = isProducts ? productType !== null : true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Add {tab === 'Products' ? 'Product' : 'Service'}</h2>
          <p className="text-sm text-gray-500">Add a new {tab === 'Products' ? 'product' : 'service'} to billing</p>
        </div>

        <div className="space-y-5">

          {/* PRODUCTS: Type selector — Medication or Others */}
          {isProducts && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['medication', 'others'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleProductTypeChange(type)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      productType === type
                        ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                    }`}
                  >
                    {type === 'medication' ? 'Medication' : 'Others'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MEDICATION FLOW */}
          {isMedMode && (
            <>
              {/* New vs Variant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Medication Entry</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['new', 'variant'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleVariantModeChange(mode)}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        variantMode === mode
                          ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {mode === 'new' ? 'New Medication' : 'New Variant'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing Med Dropdown — variant only */}
              {variantMode === 'variant' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Existing Medication</label>
                  {loadingMeds ? (
                    <p className="text-xs text-gray-400 py-2">Loading medications...</p>
                  ) : (
                    <select
                      value={medName}
                      onChange={(e) => handleExistingMedSelect(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                    >
                      <option value="">— Select medication —</option>
                      {existingMeds.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Medication Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Medication Name</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  readOnly={variantMode === 'variant' && !!medName}
                  className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all ${
                    variantMode === 'variant' && medName ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Administration Route — show once name is set (or always for 'new') */}
              {(variantMode === 'new' || medName) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Administration Route</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['oral', 'topical', 'injection', 'preventive'] as const).map((route) => (
                      <button
                        key={route}
                        onClick={() => { setAdmRoute(route); setAdmMethod('') }}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          admRoute === route
                            ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                        }`}
                      >
                        {route.charAt(0).toUpperCase() + route.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Administration Method */}
              {admRoute && methodOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Method {admRoute === 'injection' ? <span className="text-xs text-gray-400 font-normal">(Optional)</span> : null}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {methodOptions.map((method) => (
                      <button
                        key={method}
                        onClick={() => setAdmMethod(admMethod === method ? '' : method)}
                        className={`px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                          admMethod === method
                            ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Price <span className="text-xs text-gray-400 font-normal">(per piece / dose)</span>
                </label>
                <input
                  type="number"
                  value={medPrice}
                  onChange={(e) => setMedPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  value={medDesc}
                  onChange={(e) => setMedDesc(e.target.value)}
                  placeholder="Enter description"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                />
              </div>

              {/* Standard Information */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Standard Information <span className="text-xs text-gray-400 font-normal">(Optional — used as guide when prescribing)</span>
                </p>
                <div className="space-y-3">

                  {/* Dose basis — oral / topical / injection only */}
                  {admRoute && admRoute !== 'preventive' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dose per kg (mg/kg)</label>
                        <input
                          type="number"
                          value={medDosePerKg}
                          onChange={(e) => setMedDosePerKg(e.target.value)}
                          placeholder="e.g. 10"
                          min="0"
                          step="any"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dose unit</label>
                        <select
                          value={medDoseUnit}
                          onChange={(e) => setMedDoseUnit(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                        >
                          <option value="">Select unit</option>
                          {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Frequency — oral / topical / injection */}
                  {admRoute && admRoute !== 'preventive' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={medFreqType}
                          onChange={(e) => { setMedFreqType(e.target.value as any); setMedFreqValue('') }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                        >
                          <option value="">Select type</option>
                          <option value="per_day">X times per day</option>
                          <option value="every_hours">Every X hours</option>
                        </select>
                        {medFreqType && (
                          <input
                            type="number"
                            value={medFreqValue}
                            onChange={(e) => setMedFreqValue(e.target.value)}
                            placeholder={medFreqType === 'per_day' ? 'e.g. 2' : 'e.g. 8'}
                            min="1"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Duration — oral / topical / injection */}
                  {admRoute && admRoute !== 'preventive' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={medDurationType}
                          onChange={(e) => { setMedDurationType(e.target.value as any); setMedDurationDays('') }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                        >
                          <option value="">Select duration</option>
                          <option value="days">Number of days</option>
                          <option value="until_healed">Until healed</option>
                          <option value="as_needed">As needed</option>
                        </select>
                        {medDurationType === 'days' && (
                          <input
                            type="number"
                            value={medDurationDays}
                            onChange={(e) => setMedDurationDays(e.target.value)}
                            placeholder="e.g. 7"
                            min="1"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preventive-specific fields */}
                  {admRoute === 'preventive' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Repeat every (days)</label>
                        <input
                          type="number"
                          value={medIntervalDays}
                          onChange={(e) => setMedIntervalDays(e.target.value)}
                          placeholder="e.g. 30"
                          min="1"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Min weight (kg)</label>
                          <input
                            type="number"
                            value={medWeightMin}
                            onChange={(e) => setMedWeightMin(e.target.value)}
                            placeholder="e.g. 5"
                            min="0"
                            step="any"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Max weight (kg)</label>
                          <input
                            type="number"
                            value={medWeightMax}
                            onChange={(e) => setMedWeightMax(e.target.value)}
                            placeholder="e.g. 20"
                            min="0"
                            step="any"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                </div>
              </div>
            </>
          )}

          {/* SIMPLE FORM — Services tab or Products "Others" */}
          {isOthersMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={simpleForm.name}
                  onChange={(e) => setSimpleForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                />
              </div>

              {/* Category selector — Services tab only (Products "Others" is always 'Others') */}
              {!isProducts && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <select
                    value={simpleForm.category}
                    onChange={(e) => setSimpleForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
                <input
                  type="number"
                  value={simpleForm.price}
                  onChange={(e) => setSimpleForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  value={simpleForm.description}
                  onChange={(e) => setSimpleForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                />
              </div>
            </>
          )}

          {/* Branch availability — shown for Medication and all services (including Others) */}
          {(isMedMode || !isProducts) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Availability</label>
              {branchLoading ? (
                <p className="text-xs text-gray-400 py-1">Loading branches...</p>
              ) : branchFetchError ? (
                <p className="text-xs text-red-400 py-1">Failed to load branches. Please close and try again.</p>
              ) : localBranches.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">No branches found.</p>
              ) : (
                <div className="space-y-2">
                  {localBranches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => setSelectedBranches((prev) => {
                        const next = new Set(prev)
                        next.has(branch.id) ? next.delete(branch.id) : next.add(branch.id)
                        return next
                      })}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                        selectedBranches.has(branch.id)
                          ? 'bg-[#EAF1F1] border-[#7FA5A3] text-[#3D5E5C]'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      <span className="font-medium">{branch.name}{branch.isMain ? ' (Main)' : ''}</span>
                      <span className={`text-xs font-semibold ${selectedBranches.has(branch.id) ? 'text-[#476B6B]' : 'text-gray-400'}`}>
                        {selectedBranches.has(branch.id) ? 'Available' : 'Not Available'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={isMedMode ? handleSaveMedication : handleSaveSimple}
            disabled={saving || !canSave}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : `Save ${tab === 'Products' ? 'Product' : 'Service'}`}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== EDIT MODAL ====================

interface EditModalProps {
  tab: 'Products' | 'Services'
  item: ProductItem
  token: string | null
  branches: BranchInfo[]
  onClose: () => void
  onSaved: (updated: ProductItem) => void
}

function EditModal({ tab, item, token, branches, onClose, onSaved }: EditModalProps) {
  const isMedication = item.category === 'Medication'
  const categories = tab === 'Products' ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES

  const [form, setForm] = useState({
    name: item.name,
    price: String(item.price),
    description: '',
    category: item.category,
  })

  const [admRoute, setAdmRoute] = useState<AdmRoute | null>((item.administrationRoute as AdmRoute) || null)
  const [admMethod, setAdmMethod] = useState(item.administrationMethod || '')
  const [dosePerKg, setDosePerKg] = useState(item.dosePerKg != null ? String(item.dosePerKg) : '')
  const [doseUnit, setDoseUnit] = useState(item.doseUnit || '')
  const [freqType, setFreqType] = useState<'per_day' | 'every_hours' | ''>(() => {
    if (item.frequencyLabel?.toLowerCase().includes('every') && item.frequencyLabel?.toLowerCase().includes('hour')) return 'every_hours'
    if (item.frequency != null) return 'per_day'
    return ''
  })
  const [freqValue, setFreqValue] = useState(() => {
    if (item.frequencyLabel?.toLowerCase().includes('every') && item.frequencyLabel?.toLowerCase().includes('hour')) {
      const m = item.frequencyLabel.match(/\d+/); return m ? m[0] : ''
    }
    return item.frequency != null ? String(item.frequency) : ''
  })
  const [durationType, setDurationType] = useState<'days' | 'until_healed' | 'as_needed' | ''>(() => {
    if (item.durationLabel === 'until healed') return 'until_healed'
    if (item.durationLabel === 'as needed') return 'as_needed'
    if (item.duration != null) return 'days'
    return ''
  })
  const [durationDays, setDurationDays] = useState(item.duration != null ? String(item.duration) : '')
  const [intervalDays, setIntervalDays] = useState(item.intervalDays != null ? String(item.intervalDays) : '')
  const [weightMin, setWeightMin] = useState(item.weightMin != null ? String(item.weightMin) : '')
  const [weightMax, setWeightMax] = useState(item.weightMax != null ? String(item.weightMax) : '')

  // Branch availability state: map of branchId -> isActive
  const [branchState, setBranchState] = useState<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>()
    // seed from existing item data
    item.branchAvailability.forEach((ba) => map.set(ba.branchId, ba.isActive))
    // ensure all known branches are present (default active if new)
    branches.forEach((b) => { if (!map.has(b.id)) map.set(b.id, false) })
    return map
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const showBranchSection = qualifiesForBranchAvailability(tab, form.category)

  // When branches load after modal opens, add any missing ones to branchState
  useEffect(() => {
    if (branches.length === 0) return
    setBranchState((prev) => {
      const updated = new Map(prev)
      branches.forEach((b) => { if (!updated.has(b.id)) updated.set(b.id, false) })
      return updated
    })
  }, [branches])

  // Reset method when route changes
  useEffect(() => {
    if (!isMedication) return
    setAdmMethod('')
  }, [admRoute, isMedication])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      setError('Name and price are required.')
      return
    }
    const parsed = parseFloat(form.price)
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid price.')
      return
    }
    if (isMedication) {
      if (!admRoute) { setError('Please select an administration route.'); return }
      if ((admRoute === 'oral' || admRoute === 'topical' || admRoute === 'preventive') && !admMethod) {
        setError('Please select an administration method.'); return
      }
    }
    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const body: any = {
        name: form.name.trim(),
        category: form.category,
        price: parsed,
        description: form.description.trim(),
      }
      if (isMedication) {
        body.administrationRoute = admRoute
        body.administrationMethod = admMethod ? admMethod.toLowerCase() : null
        body.dosePerKg = dosePerKg ? parseFloat(dosePerKg) : null
        body.doseUnit = doseUnit || null
        body.frequency = freqType === 'per_day' && freqValue ? parseInt(freqValue) : null
        body.frequencyLabel = freqType === 'per_day' && freqValue
          ? `${freqValue} times per day`
          : freqType === 'every_hours' && freqValue
          ? `every ${freqValue} hours`
          : null
        body.duration = durationType === 'days' && durationDays ? parseInt(durationDays) : null
        body.durationLabel = durationType === 'days' && durationDays
          ? `${durationDays} days`
          : durationType === 'until_healed' ? 'until healed'
          : durationType === 'as_needed' ? 'as needed'
          : null
        body.intervalDays = intervalDays ? parseInt(intervalDays) : null
        body.weightMin = weightMin ? parseFloat(weightMin) : null
        body.weightMax = weightMax ? parseFloat(weightMax) : null
      }
      if (showBranchSection) {
        body.branchAvailability = Array.from(branchState.entries()).map(([branchId, isActive]) => ({ branchId, isActive }))
      }
      const res = await fetch(`${apiUrl}/product-services/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        const rawBA: any[] = data.data.item.branchAvailability ?? []
        onSaved({
          id: item.id,
          name: data.data.item.name,
          category: data.data.item.category ?? 'Others',
          price: data.data.item.price,
          lastUpdateDate: new Date(data.data.item.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          }),
          administrationRoute: data.data.item.administrationRoute,
          administrationMethod: data.data.item.administrationMethod,
          dosageAmount: data.data.item.dosageAmount,
          dosePerKg: data.data.item.dosePerKg,
          doseUnit: data.data.item.doseUnit,
          frequency: data.data.item.frequency,
          frequencyLabel: data.data.item.frequencyLabel,
          duration: data.data.item.duration,
          durationLabel: data.data.item.durationLabel,
          intervalDays: data.data.item.intervalDays,
          weightMin: data.data.item.weightMin,
          weightMax: data.data.item.weightMax,
          branchAvailability: rawBA.map((ba) => ({
            branchId: typeof ba.branchId === 'object' ? ba.branchId._id : ba.branchId,
            branchName: typeof ba.branchId === 'object' ? ba.branchId.name : (branches.find((b) => b.id === ba.branchId)?.name ?? ''),
            isActive: ba.isActive,
          })),
        })
        onClose()
      } else {
        setError(data.message || 'Failed to update item.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const label = tab === 'Products' ? 'Product' : 'Service'
  const methodOptions = admRoute === 'oral' ? ORAL_METHODS : admRoute === 'topical' ? TOPICAL_METHODS : admRoute === 'injection' ? INJECTION_METHODS : admRoute === 'preventive' ? PREVENTIVE_METHODS : []

  // Build the branch display list from item's own embedded data (always available)
  // plus any additional branches from the fetched list (marked NEW)
  const existingBranchIds = new Set(item.branchAvailability.map((ba) => ba.branchId))
  const displayBranches: { id: string; name: string; isNew: boolean }[] = [
    ...item.branchAvailability.map((ba) => ({
      id: ba.branchId,
      name: ba.branchName || ba.branchId.slice(-6),
      isNew: false,
    })),
    ...branches
      .filter((b) => !existingBranchIds.has(b.id))
      .map((b) => ({ id: b.id, name: b.name + (b.isMain ? ' (Main)' : ''), isNew: true })),
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Edit {label}</h2>
          <p className="text-sm text-gray-500">Update the details for this {label.toLowerCase()}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter name"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          {/* Category — locked for Medication; editable for Services/Others */}
          {isMedication ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <div className="px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500">Medication</div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Administration Route — Medications only */}
          {isMedication && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Administration Route</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['oral', 'topical', 'injection', 'preventive'] as const).map((route) => (
                    <button
                      key={route}
                      onClick={() => { setAdmRoute(route); setAdmMethod('') }}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        admRoute === route
                          ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {route.charAt(0).toUpperCase() + route.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {admRoute && methodOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Method {admRoute === 'injection' ? <span className="text-xs text-gray-400 font-normal">(Optional)</span> : null}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {methodOptions.map((method) => (
                      <button
                        key={method}
                        onClick={() => setAdmMethod(admMethod.toLowerCase() === method.toLowerCase() ? '' : method)}
                        className={`px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                          admMethod.toLowerCase() === method.toLowerCase()
                            ? 'bg-[#3D5E5C] text-white border-[#3D5E5C]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#7FA5A3]'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Price{isMedication && <span className="text-xs text-gray-400 font-normal ml-1">(per piece / dose)</span>}
            </label>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter description"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          {/* Standard Information — Medications only */}
          {isMedication && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Standard Information <span className="text-xs text-gray-400 font-normal">(Optional — used as guide when prescribing)</span>
              </p>
              <div className="space-y-3">

                {admRoute && admRoute !== 'preventive' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dose per kg (mg/kg)</label>
                      <input
                        type="number"
                        value={dosePerKg}
                        onChange={(e) => setDosePerKg(e.target.value)}
                        placeholder="e.g. 10"
                        min="0"
                        step="any"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dose unit</label>
                      <select
                        value={doseUnit}
                        onChange={(e) => setDoseUnit(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                      >
                        <option value="">Select unit</option>
                        {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {admRoute && admRoute !== 'preventive' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={freqType}
                          onChange={(e) => { setFreqType(e.target.value as any); setFreqValue('') }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                        >
                          <option value="">Select type</option>
                          <option value="per_day">X times per day</option>
                          <option value="every_hours">Every X hours</option>
                        </select>
                        {freqType && (
                          <input
                            type="number"
                            value={freqValue}
                            onChange={(e) => setFreqValue(e.target.value)}
                            placeholder={freqType === 'per_day' ? 'e.g. 2' : 'e.g. 8'}
                            min="1"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={durationType}
                          onChange={(e) => { setDurationType(e.target.value as any); setDurationDays('') }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all bg-white"
                        >
                          <option value="">Select duration</option>
                          <option value="days">Number of days</option>
                          <option value="until_healed">Until healed</option>
                          <option value="as_needed">As needed</option>
                        </select>
                        {durationType === 'days' && (
                          <input
                            type="number"
                            value={durationDays}
                            onChange={(e) => setDurationDays(e.target.value)}
                            placeholder="e.g. 7"
                            min="1"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}

                {admRoute === 'preventive' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Repeat every (days)</label>
                      <input
                        type="number"
                        value={intervalDays}
                        onChange={(e) => setIntervalDays(e.target.value)}
                        placeholder="e.g. 30"
                        min="1"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Min weight (kg)</label>
                        <input
                          type="number"
                          value={weightMin}
                          onChange={(e) => setWeightMin(e.target.value)}
                          placeholder="e.g. 5"
                          min="0"
                          step="any"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Max weight (kg)</label>
                        <input
                          type="number"
                          value={weightMax}
                          onChange={(e) => setWeightMax(e.target.value)}
                          placeholder="e.g. 20"
                          min="0"
                          step="any"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          )}

          {/* Branch availability */}
          {showBranchSection && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Availability</label>
              {displayBranches.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">No branches found.</p>
              ) : (
                <div className="space-y-2">
                  {displayBranches.map((branch) => {
                    const isActive = branchState.get(branch.id) ?? false
                    return (
                      <div key={branch.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">
                          {branch.name}
                          {branch.isNew && <span className="ml-2 text-[10px] text-blue-500 font-semibold">NEW</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBranchState((prev) => new Map(prev).set(branch.id, !isActive))}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 overflow-hidden ${isActive ? 'bg-[#476B6B]' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : `Save ${label}`}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== EDIT VACCINE PRICE MODAL ====================

interface EditVaccinePriceModalProps {
  vaccine: VaccineItem
  token: string | null
  onClose: () => void
  onSaved: (updated: VaccineItem) => void
}

function EditVaccinePriceModal({ vaccine, token, onClose, onSaved }: EditVaccinePriceModalProps) {
  const [price, setPrice] = useState(String(vaccine.pricePerDose))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid price.')
      return
    }
    setSaving(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const res = await fetch(`${apiUrl}/vaccine-types/${vaccine.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pricePerDose: parsed }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onSaved({ ...vaccine, pricePerDose: parsed })
        onClose()
      } else {
        setError(data.message || 'Failed to update price.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Edit Price Per Dose</h2>
          <p className="text-sm text-gray-500">{vaccine.name}</p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Price Per Dose (₱)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setError('') }}
            placeholder="0.00"
            min="0"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
          />
          {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : 'Save Price'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== SORT HEADER ====================

function SortHeader({
  label,
  colKey,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string
  colKey: string
  sortKey: string | null
  sortAsc: boolean
  onSort: (k: string) => void
}) {
  return (
    <button
      className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      onClick={() => onSort(colKey)}
    >
      {label}
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform ${sortKey === colKey && !sortAsc ? 'rotate-180' : ''} ${sortKey === colKey ? 'text-[#7FA5A3]' : 'text-gray-400'}`}
      />
    </button>
  )
}

// ==================== PRODUCTS / SERVICES TAB ====================

function ProductServiceTab({ tab, token, isMainBranch, userBranchId }: {
  tab: 'Products' | 'Services'
  token: string | null
  isMainBranch: boolean
  userBranchId: string | null
}) {
  const [data, setData] = useState<ProductItem[]>([])
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string | null>('category')
  const [sortAsc, setSortAsc] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null)
  const [popoverItemId, setPopoverItemId] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isProducts = tab === 'Products'
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

  const mapBranchAvailability = (raw: any[]): BranchAvailabilityEntry[] =>
    (raw || []).map((ba: any) => ({
      branchId: typeof ba.branchId === 'object' ? ba.branchId._id : ba.branchId,
      branchName: typeof ba.branchId === 'object' ? ba.branchId.name : '',
      isActive: ba.isActive,
    }))

  // Fetch branches once on mount
  useEffect(() => {
    if (!token) return
    const fetchBranches = async () => {
      try {
        const branchRes = await fetch(`${apiUrl}/clinics/mine/branches`, { headers: { Authorization: `Bearer ${token}` } })
        const branchData = await branchRes.json()
        if (branchData.status === 'SUCCESS') {
          const list = Array.isArray(branchData.data) ? branchData.data : (branchData.data.branches ?? [])
          setBranches(list.map((b: any) => ({
            id: b._id,
            name: b.name,
            isMain: b.isMain ?? false,
          })))
        }
      } catch {
        // non-fatal
      }
    }
    fetchBranches()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchData = async () => {
      try {
        const typeParam = isProducts ? 'Product' : 'Service'
        const res = await fetch(`${apiUrl}/product-services?type=${typeParam}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const result = await res.json()

        if (result.status === 'SUCCESS') {
          const items = result.data.items.map((item: any) => ({
            id: item._id,
            name: item.name,
            category: item.category ?? 'Others',
            price: item.price,
            lastUpdateDate: new Date(item.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            administrationRoute: item.administrationRoute,
            administrationMethod: item.administrationMethod,
            dosageAmount: item.dosageAmount,
            dosePerKg: item.dosePerKg,
            doseUnit: item.doseUnit,
            frequency: item.frequency,
            frequencyLabel: item.frequencyLabel,
            duration: item.duration,
            durationLabel: item.durationLabel,
            intervalDays: item.intervalDays,
            weightMin: item.weightMin,
            weightMax: item.weightMax,
            branchAvailability: mapBranchAvailability(item.branchAvailability),
          }))
          setData(items)
        } else {
          setError('Failed to load items.')
        }
      } catch {
        setError('Could not connect to server.')
      } finally {
        setLoading(false)
      }
    }

    setSelected(new Set())
    setSearch('')
    setFilterCategory('')
    setFilterBranch('')
    setLoading(true)
    setError('')
    fetchData()
  }, [tab, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = selected.size === data.length && data.length > 0
  const someSelected = selected.size > 0 && selected.size < data.length

  const handleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(data.map((d) => d.id)))
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} item(s)?`)) return

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const ids = Array.from(selected)

      for (const id of ids) {
        await fetch(`${apiUrl}/product-services/${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      }

      setData((prev) => prev.filter((d) => !selected.has(d.id)))
      setSelected(new Set())
    } catch {
      alert('Error deleting items. Please try again.')
    }
  }

  const filtered = data.filter((item) => {
    if (!item.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCategory && item.category !== filterCategory) return false
    if (filterBranch) {
      // Only filter by branch for items that track branch availability
      if (qualifiesForBranchAvailability(tab, item.category) && item.branchAvailability.length > 0) {
        const ba = item.branchAvailability.find((b) => b.branchId === filterBranch)
        if (!ba || !ba.isActive) return false
      }
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    const av = (a as any)[sortKey]
    const bv = (b as any)[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const handleSaved = (newItem: ProductItem) => {
    setData((prev) => [newItem, ...prev])
  }

  const handleUpdated = (updated: ProductItem) => {
    setData((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
  }

  const handleToggleBranchAvailability = async (itemId: string, currentIsActive: boolean) => {
    if (!userBranchId) return
    const next = !currentIsActive
    // Optimistic update
    setData((prev) => prev.map((d) => {
      if (d.id !== itemId) return d
      return {
        ...d,
        branchAvailability: d.branchAvailability.map((ba) =>
          ba.branchId === userBranchId ? { ...ba, isActive: next } : ba
        ),
      }
    }))
    try {
      const res = await fetch(`${apiUrl}/product-services/${itemId}/branch-availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: next }),
      })
      const result = await res.json()
      if (result.status !== 'SUCCESS') {
        // Revert on error
        setData((prev) => prev.map((d) => {
          if (d.id !== itemId) return d
          return {
            ...d,
            branchAvailability: d.branchAvailability.map((ba) =>
              ba.branchId === userBranchId ? { ...ba, isActive: currentIsActive } : ba
            ),
          }
        }))
      }
    } catch {
      // Revert on network error
      setData((prev) => prev.map((d) => {
        if (d.id !== itemId) return d
        return {
          ...d,
          branchAvailability: d.branchAvailability.map((ba) =>
            ba.branchId === userBranchId ? { ...ba, isActive: currentIsActive } : ba
          ),
        }
      }))
    }
  }

  // Columns: Products tab has Administration column; Services tab does not
  // Main branch has an extra checkbox column for bulk delete
  const colSpan = isProducts ? (isMainBranch ? 9 : 8) : (isMainBranch ? 7 : 6)

  return (
    <>
      {isMainBranch && showModal && <AddModal tab={tab} token={token} branches={branches} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
      {isMainBranch && editingItem && (
        <EditModal
          tab={tab}
          item={editingItem}
          token={token}
          branches={branches}
          onClose={() => setEditingItem(null)}
          onSaved={handleUpdated}
        />
      )}

      {isMainBranch && (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-gray-500" />
            Add New {isProducts ? 'Product' : 'Service'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={`Search ${tab.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 outline-none focus:border-[#476B6B] transition-colors"
            >
              <option value="">All Categories</option>
              {(isProducts ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {branches.length > 0 && (
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 outline-none focus:border-[#476B6B] transition-colors"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.isMain ? ' (Main)' : ''}</option>
                ))}
              </select>
            )}
            {(filterCategory || filterBranch) && (
              <button
                onClick={() => { setFilterCategory(''); setFilterBranch('') }}
                className="text-xs text-[#476B6B] hover:text-[#3D5E5C] font-medium transition-colors"
              >
                Clear
              </button>
            )}
            {isMainBranch && (
              <button
                onClick={handleDelete}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading...</div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-400">{error}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {isMainBranch && (
                    <th className="px-5 py-3 text-left w-12">
                      <button
                        onClick={handleSelectAll}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          allSelected || someSelected
                            ? 'bg-[#7FA5A3] border-[#7FA5A3]'
                            : 'border-gray-300 hover:border-[#7FA5A3]'
                        }`}
                      >
                        {(allSelected || someSelected) && <Minus className="w-3 h-3 text-white" />}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Name" colKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Category" colKey="category" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  {isProducts && (
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Administration</th>
                  )}
                  {isProducts && (
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">mg/kg</th>
                  )}
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Price" colKey="price" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Branches</th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Last Update Date" colKey="lastUpdateDate" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    {isMainBranch && (
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            selected.has(item.id) ? 'bg-[#7FA5A3] border-[#7FA5A3]' : 'border-gray-300 hover:border-[#7FA5A3]'
                          }`}
                        >
                          {selected.has(item.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-[#476B6B] underline underline-offset-2 cursor-pointer hover:text-[#7FA5A3] transition-colors">
                        {item.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EAF1F1] text-[#3D5E5C]">
                        {item.category}
                      </span>
                    </td>
                    {isProducts && (
                      <td className="px-4 py-3.5">
                        {item.administrationRoute ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {formatAdministration(item.administrationRoute, item.administrationMethod)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    {isProducts && (
                      <td className="px-4 py-3.5 text-sm text-gray-700">
                        {item.administrationRoute === 'preventive' ? '—' : (item.dosePerKg != null ? item.dosePerKg : '—')}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-sm text-gray-700">₱ {item.price.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      {qualifiesForBranchAvailability(tab, item.category) ? (
                        item.branchAvailability.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None</span>
                        ) : item.branchAvailability.every((ba) => ba.isActive) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            All
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {item.branchAvailability.map((ba) => (
                              <span
                                key={ba.branchId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  ba.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${ba.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                {ba.branchName || ba.branchId.slice(-6)}
                              </span>
                            ))}
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{item.lastUpdateDate}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {item.category === 'Medication' && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                if (popoverItemId === item.id) {
                                  setPopoverItemId(null)
                                } else {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                                  setPopoverPos({ top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 8 })
                                  setPopoverItemId(item.id)
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors group"
                            >
                              <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#7FA5A3] transition-colors" />
                            </button>
                            {popoverItemId === item.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setPopoverItemId(null)} />
                                <div
                                  className="fixed z-20 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 -translate-y-1/2"
                                  style={{ top: popoverPos.top, right: popoverPos.right }}
                                >
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Standard Information</p>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500">Dose</span>
                                      <span className="text-xs font-medium text-gray-800">
                                        {item.dosePerKg != null ? `${item.dosePerKg} mg/kg` : '—'}
                                        {item.doseUnit ? ` · ${item.doseUnit}` : ''}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500">Frequency</span>
                                      <span className="text-xs font-medium text-gray-800">{item.frequencyLabel || '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500">Duration</span>
                                      <span className="text-xs font-medium text-gray-800">{item.durationLabel || '—'}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {isMainBranch ? (
                          <button
                            onClick={() => setEditingItem(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors group"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#7FA5A3] transition-colors" />
                          </button>
                        ) : qualifiesForBranchAvailability(tab, item.category) ? (() => {
                          const ba = item.branchAvailability.find((b) => b.branchId === userBranchId)
                          const isActive = ba?.isActive ?? false
                          return (
                            <button
                              onClick={() => handleToggleBranchAvailability(item.id, isActive)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                isActive
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {isActive ? 'Available' : 'Unavailable'}
                            </button>
                          )
                        })() : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-gray-400">
                      No {tab.toLowerCase()} found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ==================== VACCINES TAB ====================

function VaccinesTab({ token }: { token: string | null }) {
  const [vaccines, setVaccines] = useState<VaccineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [editingVaccine, setEditingVaccine] = useState<VaccineItem | null>(null)

  useEffect(() => {
    const fetchVaccines = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        const res = await fetch(`${apiUrl}/vaccine-types`)
        const data = await res.json()
        if (data.status === 'SUCCESS') {
          setVaccines(
            data.data.vaccineTypes.map((v: any) => ({
              id: v._id,
              name: v.name,
              species: v.species ?? [],
              pricePerDose: v.pricePerDose ?? 0,
            }))
          )
        } else {
          setError('Failed to load vaccines.')
        }
      } catch {
        setError('Could not connect to server.')
      } finally {
        setLoading(false)
      }
    }
    fetchVaccines()
  }, [])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = vaccines.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    const av = (a as any)[sortKey]
    const bv = (b as any)[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const handleSaved = (updated: VaccineItem) => {
    setVaccines((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
  }

  return (
    <>
      {editingVaccine && (
        <EditVaccinePriceModal
          vaccine={editingVaccine}
          token={token}
          onClose={() => setEditingVaccine(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search vaccines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 ml-auto">
            Pulled from vaccine database · updates dynamically
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading vaccines...</div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-400">{error}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left">
                    <SortHeader label="Vaccine Name" colKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Species</th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Price Per Dose" colKey="pricePerDose" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((vaccine) => (
                  <tr key={vaccine.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Syringe className="w-3.5 h-3.5 text-[#7FA5A3] flex-shrink-0" />
                        <span className="text-sm font-medium text-[#476B6B]">{vaccine.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 flex-wrap">
                        {vaccine.species.map((s) => (
                          <span
                            key={s}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              s === 'dog' ? 'bg-amber-100 text-amber-700' :
                              s === 'cat' ? 'bg-purple-100 text-purple-700' :
                              'bg-teal-100 text-teal-700'
                            }`}
                          >
                            {s === 'dog' ? 'Canine' : s === 'cat' ? 'Feline' : 'Canine + Feline'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      {vaccine.pricePerDose > 0 ? `₱ ${vaccine.pricePerDose.toLocaleString()}` : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setEditingVaccine(vaccine)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors group"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#7FA5A3] transition-colors" />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                      No vaccines found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ==================== MAIN PAGE ====================

export default function ProductManPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const isMainBranch = user?.isMainBranch ?? false
  const userBranchId = user?.clinicBranchId ?? null
  const [activeTab, setActiveTab] = useState<Tab>('Products')

  const tabs: Tab[] = ['Products', 'Services', 'Vaccines']

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 min-h-screen bg-gray-50">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Product and Service Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Efficiently manage your clinic's products, services, and vaccines</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[#3D5E5C] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Products' && <ProductServiceTab tab="Products" token={token} isMainBranch={isMainBranch} userBranchId={userBranchId} />}
        {activeTab === 'Services' && <ProductServiceTab tab="Services" token={token} isMainBranch={isMainBranch} userBranchId={userBranchId} />}
        {activeTab === 'Vaccines' && <VaccinesTab token={token} />}
      </div>
    </DashboardLayout>
  )
}
