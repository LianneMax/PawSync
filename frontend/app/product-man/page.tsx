'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Trash2, SlidersHorizontal, Plus, Pencil, ChevronDown, Minus, X } from 'lucide-react'

type ProductType = 'Product' | 'Service'

interface ProductItem {
  id: string
  name: string
  type: ProductType
  price: number
  productQty: string
  lastUpdateDate: string
}

const mockData: ProductItem[] = [
  { id: '1', name: 'Lianne Balbastro', type: 'Product', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
  { id: '2', name: 'Lianne Balbastro', type: 'Service', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
  { id: '3', name: 'Juls Lammoglia', type: 'Product', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
  { id: '4', name: 'Miguel Reaño', type: 'Service', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
  { id: '5', name: 'Alyssa Mansueto', type: 'Service', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
  { id: '6', name: 'Miguel Reaño', type: 'Product', price: 1000, productQty: 'Dr. DoLittle', lastUpdateDate: 'Dr. DoLittle' },
]

type SortKey = keyof ProductItem | null

// ── Add Product Modal ────────────────────────────────────────────────────────

interface AddProductModalProps {
  onClose: () => void
}

function AddProductModal({ onClose }: AddProductModalProps) {
  const [form, setForm] = useState({ name: '', type: '', price: '', quantity: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = () => {
    // Backend will be connected later
    console.log('Save product:', form)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Add Product/Service</h2>
          <p className="text-sm text-gray-500">Add a new product/service to billing</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Text Input Here"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <div className="relative">
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all appearance-none bg-white cursor-pointer"
              >
                <option value="" disabled>Text Input Here</option>
                <option value="Product">Product</option>
                <option value="Service">Service</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Price</label>
            <input
              type="text"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Text Input Here"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
            <input
              type="text"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              placeholder="Text Input Here"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-7">
          <button
            onClick={handleSave}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Save Product Details
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProductManPage() {
  const user = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(['1', '2', '3']))
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const handleSelectAll = () => {
    if (selected.size === mockData.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(mockData.map((d) => d.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const handleDelete = () => {
    // Backend will handle deletion
    alert(`Delete ${selected.size} item(s) — backend to be connected`)
  }

  const filtered = mockData.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  const allSelected = selected.size === mockData.length
  const someSelected = selected.size > 0 && selected.size < mockData.length

  const TypeBadge = ({ type }: { type: ProductType }) => {
    const isProduct = type === 'Product'
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isProduct
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${isProduct ? 'bg-yellow-500' : 'bg-green-500'}`}
        />
        {type}
      </span>
    )
  }

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <button
      className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors group"
      onClick={() => handleSort(colKey)}
    >
      {label}
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform ${
          sortKey === colKey && !sortAsc ? 'rotate-180' : ''
        } ${sortKey === colKey ? 'text-[#7FA5A3]' : 'text-gray-400'}`}
      />
    </button>
  )

  return (
    <DashboardLayout>
      {showModal && <AddProductModal onClose={() => setShowModal(false)} />}
      <div className="p-6 lg:p-8 min-h-screen bg-gray-50">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Product and Service Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Efficiently manage your clinics products and services</p>
        </div>

        {/* Add New Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-gray-500" />
            Add New Product/Service
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 max-w-md bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter a Client, Patients Name or ID Tag"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* Delete */}
              <button
                onClick={handleDelete}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              {/* Filters */}
              <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3 text-left w-12">
                    <button
                      onClick={handleSelectAll}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        allSelected
                          ? 'bg-[#7FA5A3] border-[#7FA5A3]'
                          : someSelected
                          ? 'bg-[#7FA5A3] border-[#7FA5A3]'
                          : 'border-gray-300 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {(allSelected || someSelected) && (
                        <Minus className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Name" colKey="name" /></th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Type" colKey="type" /></th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Price" colKey="price" /></th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Product Qty." colKey="productQty" /></th>
                  <th className="px-4 py-3 text-left"><SortHeader label="Last Update Date" colKey="lastUpdateDate" /></th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selected.has(item.id)
                            ? 'bg-[#7FA5A3] border-[#7FA5A3]'
                            : 'border-gray-300 hover:border-[#7FA5A3]'
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
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      Php {item.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{item.productQty}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{item.lastUpdateDate}</td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => alert(`Edit ${item.name} — backend to be connected`)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors group"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#7FA5A3] transition-colors" />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                      No products or services found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}