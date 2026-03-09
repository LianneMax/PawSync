'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Trash2, Plus, Pencil, ChevronDown, Minus, X, Syringe } from 'lucide-react'

// ==================== TYPES ====================

type Tab = 'Products' | 'Services' | 'Vaccines'

interface ProductItem {
  id: string
  name: string
  category: string
  price: number
  lastUpdateDate: string
}

interface VaccineItem {
  id: string
  name: string
  pricePerDose: number
}

// ==================== ADD MODAL ====================

interface AddModalProps {
  tab: 'Products' | 'Services'
  token: string | null
  onClose: () => void
  onSaved: (item: ProductItem) => void
}

const PRODUCT_CATEGORIES = ['Medication', 'Others'] as const
const SERVICE_CATEGORIES = ['Diagnostic Tests', 'Preventive Care', 'Others'] as const

function AddModal({ tab, token, onClose, onSaved }: AddModalProps) {
  const categories = tab === 'Products' ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES
  const [form, setForm] = useState({ name: '', price: '', description: '', category: categories[0] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

    setSaving(true)
    setError('')

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const res = await fetch(`${apiUrl}/product-services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          type: tab === 'Products' ? 'Product' : 'Service',
          category: form.category,
          price: parsed,
          description: form.description.trim(),
        }),
      })

      const data = await res.json()

      if (data.status === 'SUCCESS') {
        const newItem: ProductItem = {
          id: data.data.item._id,
          name: data.data.item.name,
          category: data.data.item.category ?? 'Others',
          price: data.data.item.price,
          lastUpdateDate: new Date(data.data.item.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        }
        onSaved(newItem)
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

  const label = tab === 'Products' ? 'Product' : 'Service'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Add {label}</h2>
          <p className="text-sm text-gray-500">Add a new {label.toLowerCase()} to billing</p>
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

// ==================== EDIT MODAL ====================

interface EditModalProps {
  tab: 'Products' | 'Services'
  item: ProductItem
  token: string | null
  onClose: () => void
  onSaved: (updated: ProductItem) => void
}

function EditModal({ tab, item, token, onClose, onSaved }: EditModalProps) {
  const categories = tab === 'Products' ? PRODUCT_CATEGORIES : SERVICE_CATEGORIES
  const [form, setForm] = useState({
    name: item.name,
    price: String(item.price),
    description: '',
    category: item.category,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    setSaving(true)
    setError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const res = await fetch(`${apiUrl}/product-services/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          price: parsed,
          description: form.description.trim(),
        }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onSaved({
          id: item.id,
          name: data.data.item.name,
          category: data.data.item.category ?? 'Others',
          price: data.data.item.price,
          lastUpdateDate: new Date(data.data.item.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200">
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
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        const typeParam = tab === 'Products' ? 'Product' : 'Service'
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
  }, [tab, token])

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

  return (
    <>
      {showModal && <AddModal tab={tab} token={token} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
      {editingItem && (
        <EditModal
          tab={tab}
          item={editingItem}
          token={token}
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
          Add New {tab === 'Products' ? 'Product' : 'Service'}
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
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Price" colKey="price" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
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
                    <td className="px-4 py-3.5 text-sm text-gray-700">₱ {item.price.toLocaleString()}</td>
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
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
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
                    <td colSpan={3} className="px-5 py-12 text-center text-sm text-gray-400">
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
