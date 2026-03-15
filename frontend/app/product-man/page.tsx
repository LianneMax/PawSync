'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Trash2, Plus, Pencil, ChevronDown, Minus, X, Syringe } from 'lucide-react'

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
  branchAvailability: BranchAvailabilityEntry[]
}

/** Returns true if the item type/category qualifies for branch availability tracking */
function qualifiesForBranchAvailability(tab: 'Products' | 'Services', category: string): boolean {
  if (tab === 'Products') return category === 'Medication'
  return category !== 'Others'
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
const ORAL_METHODS = ['Pills', 'Capsules', 'Tablets', 'Liquid', 'Suspension'] as const
const TOPICAL_METHODS = ['Skin', 'Eyes', 'Ears'] as const

type AdmRoute = 'oral' | 'topical' | 'injection'

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

  // --- Simple form state (Services tab + Products "Others") ---
  const [simpleForm, setSimpleForm] = useState({
    name: '',
    price: '',
    description: '',
    category: (isProducts ? 'Others' : SERVICE_CATEGORIES[0]) as string,
  })

  // --- Branch availability selection ---
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    new Set(branches.map((b) => b.id)) // default: all branches selected
  )

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
  }

  const branchAvailabilityPayload = Array.from(selectedBranches).map((id) => ({ branchId: id, isActive: true }))

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
    if ((admRoute === 'oral' || admRoute === 'topical') && !admMethod) {
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
        price: parsed,
        description: medDesc.trim(),
        branchAvailability: branchAvailabilityPayload,
      }
      if (admRoute !== 'injection') {
        body.administrationMethod = admMethod.toLowerCase()
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
        onSaved({
          id: data.data.item._id,
          name: data.data.item.name,
          category: 'Medication',
          price: data.data.item.price,
          lastUpdateDate: new Date(data.data.item.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          }),
          administrationRoute: data.data.item.administrationRoute,
          administrationMethod: data.data.item.administrationMethod,
          branchAvailability: mapBranchAvailability(data.data.item.branchAvailability),
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
  const methodOptions = admRoute === 'oral' ? ORAL_METHODS : admRoute === 'topical' ? TOPICAL_METHODS : []

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
                  <div className="grid grid-cols-3 gap-2">
                    {(['oral', 'topical', 'injection'] as const).map((route) => (
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

              {/* Administration Method — Oral or Topical only */}
              {admRoute && admRoute !== 'injection' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                  <div className="flex flex-wrap gap-2">
                    {methodOptions.map((method) => (
                      <button
                        key={method}
                        onClick={() => setAdmMethod(method)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
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

          {/* Branch availability — shown for Medication and non-Others services */}
          {branches.length > 0 && (isMedMode || (!isProducts && simpleForm.category !== 'Others')) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Availability</label>
              <div className="space-y-2">
                {branches.map((branch) => (
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
      if ((admRoute === 'oral' || admRoute === 'topical') && !admMethod) {
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
        body.administrationMethod = admRoute !== 'injection' ? admMethod.toLowerCase() : null
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
  const methodOptions = admRoute === 'oral' ? ORAL_METHODS : admRoute === 'topical' ? TOPICAL_METHODS : []

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
                <div className="grid grid-cols-3 gap-2">
                  {(['oral', 'topical', 'injection'] as const).map((route) => (
                    <button
                      key={route}
                      onClick={() => setAdmRoute(route)}
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

              {admRoute && admRoute !== 'injection' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                  <div className="flex flex-wrap gap-2">
                    {methodOptions.map((method) => (
                      <button
                        key={method}
                        onClick={() => setAdmMethod(method)}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
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

          {/* Branch availability — toggle active/inactive per branch, add missing branches */}
          {showBranchSection && branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch Availability</label>
              <div className="space-y-2">
                {branches.map((branch) => {
                  const isActive = branchState.get(branch.id) ?? false
                  const isInItem = item.branchAvailability.some((ba) => ba.branchId === branch.id)
                  return (
                    <div key={branch.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                      <span className="text-sm font-medium text-gray-700">
                        {branch.name}{branch.isMain ? ' (Main)' : ''}
                        {!isInItem && <span className="ml-2 text-[10px] text-blue-500 font-semibold">NEW</span>}
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

function ProductServiceTab({ tab, token }: { tab: 'Products' | 'Services'; token: string | null }) {
  const [data, setData] = useState<ProductItem[]>([])
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null)
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

  // Fetch branches once and run migration
  useEffect(() => {
    if (!token) return
    const init = async () => {
      try {
        // Use the auth-based endpoint — works without knowing clinicId
        const branchRes = await fetch(`${apiUrl}/appointments/clinic-branches`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const branchData = await branchRes.json()
        if (branchData.status === 'SUCCESS') {
          setBranches((branchData.data.branches ?? []).map((b: any) => ({
            id: b._id,
            name: b.name,
            isMain: b.isMain,
          })))
        }
        // Run idempotent migration for existing records
        await fetch(`${apiUrl}/product-services/migrate-branches`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // non-fatal
      }
    }
    init()
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

  const filtered = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

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

  // Columns: Products tab has Administration column; Services tab does not
  const colSpan = isProducts ? 8 : 7

  return (
    <>
      {showModal && <AddModal tab={tab} token={token} branches={branches} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
      {editingItem && (
        <EditModal
          tab={tab}
          item={editingItem}
          token={token}
          branches={branches}
          onClose={() => setEditingItem(null)}
          onSaved={handleUpdated}
        />
      )}

      <div className="flex justify-center mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-gray-500" />
          Add New {isProducts ? 'Product' : 'Service'}
        </button>
      </div>

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
          <button
            onClick={handleDelete}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
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
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Name" colKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Category" colKey="category" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  {isProducts && (
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Administration</th>
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
                    <td className="px-4 py-3.5 text-sm text-gray-700">₱ {item.price.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      {qualifiesForBranchAvailability(tab, item.category) ? (
                        item.branchAvailability.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None</span>
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
                      <button
                        onClick={() => setEditingItem(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors group"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#7FA5A3] transition-colors" />
                      </button>
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

        {activeTab === 'Products' && <ProductServiceTab tab="Products" token={token} />}
        {activeTab === 'Services' && <ProductServiceTab tab="Services" token={token} />}
        {activeTab === 'Vaccines' && <VaccinesTab token={token} />}
      </div>
    </DashboardLayout>
  )
}
