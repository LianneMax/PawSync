'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  Receipt,
  Download,
  Eye,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ==================== TYPES ====================

interface ApiBillingItem {
  _id: string
  productServiceId: string
  name: string
  type: 'Service' | 'Product'
  unitPrice: number
}

interface ApiBilling {
  _id: string
  ownerId: { _id: string; firstName: string; lastName: string; email: string }
  petId: { _id: string; name: string; species: string; breed: string }
  vetId: { _id: string; firstName: string; lastName: string }
  clinicId: { _id: string; name: string }
  clinicBranchId: { _id: string; name: string }
  items: ApiBillingItem[]
  subtotal: number
  discount: number
  totalAmountDue: number
  status: 'awaiting_approval' | 'pending_payment' | 'paid'
  serviceLabel: string
  serviceDate: string
  createdAt: string
}

interface ProductServiceOption {
  _id: string
  name: string
  type: 'Service' | 'Product'
  price: number
}

interface ApiMedicalRecord {
  _id: string
  petId: { _id: string; name: string }
  createdAt: string
}

// ==================== STATUS HELPERS ====================

type AdminStatus = 'Awaiting Approval' | 'Paid' | 'Pending Payment'
type OwnerStatus = 'Paid' | 'Pending'

function mapAdminStatus(status: string): AdminStatus {
  if (status === 'paid') return 'Paid'
  if (status === 'pending_payment') return 'Pending Payment'
  return 'Awaiting Approval'
}

function mapOwnerStatus(status: string): OwnerStatus {
  if (status === 'paid') return 'Paid'
  return 'Pending'
}

function getAdminStatusStyle(status: AdminStatus) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending Payment': return 'bg-blue-100 text-blue-700'
    case 'Awaiting Approval': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function getOwnerStatusStyle(status: OwnerStatus) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return `Php ${(amount || 0).toLocaleString()}`
}

// ==================== PET OWNER VIEW ====================

function PetOwnerBilling() {
  const [billings, setBillings] = useState<ApiBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/billings/my-invoices`, { headers: authHeaders() })
        const data = await res.json()
        if (data.status === 'SUCCESS') setBillings(data.data.billings || [])
      } catch (e) {
        console.error('Failed to fetch invoices:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = billings.filter((b) => {
    const q = searchQuery.toLowerCase()
    return (
      (b.petId?.name || '').toLowerCase().includes(q) ||
      (b.serviceLabel || '').toLowerCase().includes(q) ||
      (b.clinicId?.name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8">
      <h1
        className="text-[32px] text-[#476B6B] mb-2"
        style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
      >
        My Invoices
      </h1>
      <p className="text-gray-500 mb-8">View and manage your billing history</p>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by pet, service, or clinic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pet</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td>
                </tr>
              )}
              {!loading && filtered.map((b) => {
                const status = mapOwnerStatus(b.status)
                return (
                  <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{b.petId?.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.serviceLabel || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.clinicId?.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{formatDate(b.serviceDate)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{formatCurrency(b.totalAmountDue)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOwnerStatusStyle(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button className="text-gray-400 hover:text-gray-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== VET APPROVAL MODAL ====================

function VetApprovalModal({
  billing,
  onClose,
  onApproved,
}: {
  billing: ApiBilling
  onClose: () => void
  onApproved: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billings/${billing._id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onApproved()
        onClose()
      } else {
        alert(data.message || 'Failed to approve billing')
      }
    } catch (e) {
      console.error('Approve billing error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Products and Services</h2>
          <p className="text-sm text-gray-400">Review the billing details before approval</p>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product / Service ↓</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Type ↓</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Price ↓</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billing.items.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3 text-sm font-medium text-[#4F4F4F]">{item.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${item.type === 'Service' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#4F4F4F]">₱ {item.unitPrice.toLocaleString()}</td>
                </tr>
              ))}
              {billing.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No items in this billing record</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-end justify-between gap-6">
          <div className="border border-gray-200 rounded-xl p-4 w-56 shrink-0">
            <p className="text-sm font-semibold text-[#3D5A58] mb-1">Order Summary</p>
            <p className="text-xs text-gray-400 mb-3">Amount Due</p>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Services / Products Fee</span>
              <span className="text-[#4F4F4F] font-medium">₱ {billing.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-500">Discount</span>
              <span className="text-red-500 font-medium">-₱ {billing.discount.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold">
              <span className="text-[#4F4F4F]">Total Amount Due</span>
              <span className="text-[#4F4F4F]">₱ {billing.totalAmountDue.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== VET VIEW ====================

function VetBilling() {
  const [billings, setBillings] = useState<ApiBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [approvingBilling, setApprovingBilling] = useState<ApiBilling | null>(null)

  const fetchBillings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billings/vet`, { headers: authHeaders() })
      const data = await res.json()
      if (data.status === 'SUCCESS') setBillings(data.data.billings || [])
    } catch (e) {
      console.error('Failed to fetch vet billings:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

  const filtered = billings.filter((b) => {
    const q = searchQuery.toLowerCase()
    const clientName = `${b.ownerId?.firstName || ''} ${b.ownerId?.lastName || ''}`.toLowerCase()
    return (
      clientName.includes(q) ||
      (b.petId?.name || '').toLowerCase().includes(q) ||
      (b.serviceLabel || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-[#4F4F4F] mb-2">Client Billing</h1>
      <p className="text-gray-500 mb-8">View billing records for your clients</p>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client, patient, or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td>
                </tr>
              )}
              {!loading && filtered.map((b) => {
                const adminStatus = mapAdminStatus(b.status)
                return (
                  <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-sm text-[#7FA5A3] hover:text-[#6A8E8C] cursor-pointer underline">
                        {b.ownerId?.firstName} {b.ownerId?.lastName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.petId?.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.serviceLabel || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{formatDate(b.serviceDate)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{formatCurrency(b.totalAmountDue)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(adminStatus)}`}>
                        {adminStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {b.status === 'awaiting_approval' && (
                        <button
                          onClick={() => setApprovingBilling(b)}
                          className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No billing records found</p>
            </div>
          )}
        </div>
      </div>

      {approvingBilling && (
        <VetApprovalModal
          billing={approvingBilling}
          onClose={() => setApprovingBilling(null)}
          onApproved={fetchBillings}
        />
      )}
    </div>
  )
}

// ==================== PRODUCT ITEM ROW (shared UI) ====================

function ProductItemRow({
  item,
  onRemove,
}: {
  item: { _id: string; name: string; type: 'Service' | 'Product'; price: number }
  onRemove: (id: string) => void
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm text-[#4F4F4F]">{item.name}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${item.type === 'Service' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {item.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#4F4F4F]">Php {item.price.toLocaleString()}</td>
      <td className="px-4 py-3">
        <button onClick={() => onRemove(item._id)} className="text-gray-400 hover:text-red-500 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

// ==================== CREATE BILLING MODAL (3-STEP) ====================

function CreateBillingModal({
  currentUser,
  onClose,
  onCreated,
}: {
  currentUser: { clinicId?: string; clinicBranchId?: string } | null
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [patientSearch, setPatientSearch] = useState('')
  const [medicalRecords, setMedicalRecords] = useState<ApiMedicalRecord[]>([])
  const [selectedMedicalRecordId, setSelectedMedicalRecordId] = useState<string | null>(null)

  // Step 2 state
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductServiceOption[]>([])
  const [selectedProducts, setSelectedProducts] = useState<{ _id: string; name: string; type: 'Service' | 'Product'; price: number }[]>([])

  // Step 3 state
  const [clientId, setClientId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [veterinarianId, setVeterinarianId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [allPatients, setAllPatients] = useState<any[]>([])
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])
  const [vetOptions, setVetOptions] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Load medical records for step 1 search
  useEffect(() => {
    fetch(`${API_BASE}/medical-records/vet/my-records`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => { if (data.status === 'SUCCESS') setMedicalRecords(data.data.records || []) })
      .catch(() => {})
  }, [])

  // Load patients and vets when entering step 3
  useEffect(() => {
    if (step !== 3) return
    if (currentUser?.clinicId) {
      fetch(`${API_BASE}/clinics/${currentUser.clinicId}/patients`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'SUCCESS') {
            const pets = data.data.pets || []
            setAllPatients(pets)
            const clientMap = new Map<string, { id: string; name: string }>()
            pets.forEach((p: any) => {
              if (p.owner?._id) {
                clientMap.set(p.owner._id.toString(), {
                  id: p.owner._id.toString(),
                  name: `${p.owner.firstName} ${p.owner.lastName}`,
                })
              }
            })
            setClientOptions([...clientMap.values()])
          }
        })
        .catch(() => {})
    }
    fetch(`${API_BASE}/clinics/mine/vets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'SUCCESS') {
          setVetOptions(
            (data.data.vets || []).map((v: any) => ({
              id: v.vetId?.toString() || v._id?.toString() || '',
              name: v.name,
            }))
          )
        }
      })
      .catch(() => {})
  }, [step, currentUser?.clinicId])

  // Product search with debounce
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProductResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/product-services?search=${encodeURIComponent(productSearch)}`,
          { headers: authHeaders() }
        )
        const data = await res.json()
        if (data.status === 'SUCCESS') {
          setProductResults(
            (data.data.items || []).map((i: any) => ({ _id: i._id, name: i.name, type: i.type, price: i.price }))
          )
        }
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  const medicalRecordResults = medicalRecords.filter(
    (r) => patientSearch && (r.petId?.name || '').toLowerCase().includes(patientSearch.toLowerCase())
  )

  const patientOptions = allPatients.filter(
    (p: any) => !clientId || p.owner?._id?.toString() === clientId
  )

  const total = selectedProducts.reduce((s, p) => s + p.price, 0)

  const addProduct = (p: ProductServiceOption) => {
    if (!selectedProducts.find((s) => s._id === p._id)) {
      setSelectedProducts((prev) => [...prev, p])
    }
    setProductSearch('')
    setProductResults([])
  }

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p._id !== id))
  }

  const handleSendForApproval = async () => {
    if (!clientId || !patientId || !veterinarianId) {
      alert('Please select a client, patient, and veterinarian')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        ownerId: clientId,
        petId: patientId,
        vetId: veterinarianId,
        clinicBranchId: currentUser?.clinicBranchId,
        medicalRecordId: selectedMedicalRecordId || undefined,
        items: selectedProducts.map((p) => ({
          productServiceId: p._id,
          name: p.name,
          type: p.type,
          unitPrice: p.price,
        })),
        discount,
      }
      const res = await fetch(`${API_BASE}/billings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onCreated()
        onClose()
      } else {
        alert(data.message || 'Failed to create billing')
      }
    } catch (e) {
      console.error('Create billing error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

      {/* ── Step 1: Attach to Medical Record ─────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-10 w-full max-w-sm mx-4 text-center shadow-xl">
          <h2 className="text-2xl font-bold text-[#4F4F4F] mb-2">Attach to Medical Record</h2>
          <p className="text-sm text-gray-400 mb-8">Pull acquired products/services from medical record</p>

          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="search medical record by patient name..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
            {medicalRecordResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 text-left">
                {medicalRecordResults.map((r) => (
                  <button
                    key={r._id}
                    onClick={() => { setSelectedMedicalRecordId(r._id); setStep(2) }}
                    className="w-full px-4 py-2.5 text-sm hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span>{r.petId?.name || 'Unknown'}</span>
                    <span className="text-gray-400">{formatDate(r.createdAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep(2)}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Products and Services ────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Products and Services</h2>
            <p className="text-sm text-gray-400">Add/Edit acquired products and services</p>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Product/Service to Add"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-gray-50"
            />
            {productSearch && productResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {productResults
                  .filter((p) => !selectedProducts.find((s) => s._id === p._id))
                  .map((p) => (
                    <button
                      key={p._id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex justify-between items-center"
                    >
                      <span>{p.name}</span>
                      <span className="text-gray-400">Php {p.price.toLocaleString()}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product / Service ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Type ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Price ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Action ↓</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedProducts.map((p) => (
                  <ProductItemRow key={p._id} item={p} onRemove={removeProduct} />
                ))}
                {selectedProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No products or services added yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-center text-sm font-medium text-[#4F4F4F] mb-6">
            Total amount : Php {total.toLocaleString()}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep(3)}
              disabled={selectedProducts.length === 0}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Billing Information ───────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-8 w-full max-w-xl mx-4 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Billing Information</h2>
            <p className="text-sm text-gray-400">View and edit the billing information accordingly before sending to veterinarian</p>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setPatientId('') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Patient</label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {patientOptions.map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Veterinarian</label>
                <select
                  value={veterinarianId}
                  onChange={(e) => setVeterinarianId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {vetOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Discount (₱)</label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>
            </div>

            <div className="w-52 shrink-0">
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#3D5A58] mb-3">Order Summary</p>
                <p className="text-xs text-gray-400 mb-2">Amount Due</p>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Services / Products Fee</span>
                  <span className="text-[#4F4F4F] font-medium">₱ {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-500 font-medium">-₱ {discount.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold">
                  <span className="text-[#4F4F4F]">Total Amount Due</span>
                  <span className="text-[#4F4F4F]">₱ {Math.max(0, total - discount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={handleSendForApproval}
              disabled={submitting}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending...' : 'Send For Approval'}
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== EDIT BILLING MODAL ====================

function EditBillingModal({
  billing,
  currentUser,
  onClose,
  onUpdated,
}: {
  billing: ApiBilling
  currentUser: { clinicId?: string; clinicBranchId?: string } | null
  onClose: () => void
  onUpdated: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state — pre-populated from billing
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductServiceOption[]>([])
  const [selectedProducts, setSelectedProducts] = useState<{ _id: string; name: string; type: 'Service' | 'Product'; price: number }[]>(
    billing.items.map((item) => ({
      _id: item.productServiceId || item._id,
      name: item.name,
      type: item.type,
      price: item.unitPrice,
    }))
  )

  // Step 2 state — pre-populated from billing
  const [clientId, setClientId] = useState(billing.ownerId?._id || '')
  const [patientId, setPatientId] = useState(billing.petId?._id || '')
  const [veterinarianId, setVeterinarianId] = useState(billing.vetId?._id || '')
  const [discount, setDiscount] = useState(billing.discount || 0)
  const [allPatients, setAllPatients] = useState<any[]>([])
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])
  const [vetOptions, setVetOptions] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Load patients and vets when reaching step 2
  useEffect(() => {
    if (step !== 2) return
    if (currentUser?.clinicId) {
      fetch(`${API_BASE}/clinics/${currentUser.clinicId}/patients`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'SUCCESS') {
            const pets = data.data.pets || []
            setAllPatients(pets)
            const clientMap = new Map<string, { id: string; name: string }>()
            pets.forEach((p: any) => {
              if (p.owner?._id) {
                clientMap.set(p.owner._id.toString(), {
                  id: p.owner._id.toString(),
                  name: `${p.owner.firstName} ${p.owner.lastName}`,
                })
              }
            })
            // Ensure current owner is included even if not in clinic patients yet
            if (billing.ownerId?._id && !clientMap.has(billing.ownerId._id)) {
              clientMap.set(billing.ownerId._id, {
                id: billing.ownerId._id,
                name: `${billing.ownerId.firstName} ${billing.ownerId.lastName}`,
              })
            }
            setClientOptions([...clientMap.values()])
          }
        })
        .catch(() => {})
    }
    fetch(`${API_BASE}/clinics/mine/vets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'SUCCESS') {
          setVetOptions(
            (data.data.vets || []).map((v: any) => ({
              id: v.vetId?.toString() || v._id?.toString() || '',
              name: v.name,
            }))
          )
        }
      })
      .catch(() => {})
  }, [step, currentUser?.clinicId, billing.ownerId])

  // Product search with debounce
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) {
      setProductResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/product-services?search=${encodeURIComponent(productSearch)}`,
          { headers: authHeaders() }
        )
        const data = await res.json()
        if (data.status === 'SUCCESS') {
          setProductResults(
            (data.data.items || []).map((i: any) => ({ _id: i._id, name: i.name, type: i.type, price: i.price }))
          )
        }
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  const patientOptions = allPatients.filter(
    (p: any) => !clientId || p.owner?._id?.toString() === clientId
  )
  // Always include the current pet in the list
  const currentPetInOptions = patientOptions.find((p: any) => p._id?.toString() === patientId)
  const fullPatientOptions = currentPetInOptions
    ? patientOptions
    : [{ _id: billing.petId?._id, name: billing.petId?.name }, ...patientOptions]

  const total = selectedProducts.reduce((s, p) => s + p.price, 0)

  const addProduct = (p: ProductServiceOption) => {
    if (!selectedProducts.find((s) => s._id === p._id)) {
      setSelectedProducts((prev) => [...prev, p])
    }
    setProductSearch('')
    setProductResults([])
  }

  const removeProduct = (id: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p._id !== id))
  }

  const handleSendForApproval = async () => {
    setSubmitting(true)
    try {
      const body = {
        ownerId: clientId,
        petId: patientId,
        vetId: veterinarianId,
        items: selectedProducts.map((p) => ({
          productServiceId: p._id,
          name: p.name,
          type: p.type,
          unitPrice: p.price,
        })),
        discount,
      }
      const res = await fetch(`${API_BASE}/billings/${billing._id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onUpdated()
        onClose()
      } else {
        alert(data.message || 'Failed to update billing')
      }
    } catch (e) {
      console.error('Update billing error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">

      {/* ── Step 1: Products and Services ────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Products and Services</h2>
            <p className="text-sm text-gray-400">Add/Edit acquired products and services</p>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Product/Service to Add"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-gray-50"
            />
            {productSearch && productResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {productResults
                  .filter((p) => !selectedProducts.find((s) => s._id === p._id))
                  .map((p) => (
                    <button
                      key={p._id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex justify-between items-center"
                    >
                      <span>{p.name}</span>
                      <span className="text-gray-400">Php {p.price.toLocaleString()}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product / Service ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Type ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Price ↓</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Action ↓</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedProducts.map((p) => (
                  <ProductItemRow key={p._id} item={p} onRemove={removeProduct} />
                ))}
                {selectedProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No products or services added yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-center text-sm font-medium text-[#4F4F4F] mb-6">
            Total amount : Php {total.toLocaleString()}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep(2)}
              disabled={selectedProducts.length === 0}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Billing Information ───────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl p-8 w-full max-w-xl mx-4 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Billing Information</h2>
            <p className="text-sm text-gray-400">View and edit the billing information accordingly before sending to veterinarian</p>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => { setClientId(e.target.value); setPatientId('') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Patient</label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {fullPatientOptions.map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Veterinarian</label>
                <select
                  value={veterinarianId}
                  onChange={(e) => setVeterinarianId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {vetOptions.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Discount (₱)</label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>
            </div>

            <div className="w-52 shrink-0">
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-[#3D5A58] mb-3">Order Summary</p>
                <p className="text-xs text-gray-400 mb-2">Amount Due</p>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Services / Products Fee</span>
                  <span className="text-[#4F4F4F] font-medium">₱ {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-500 font-medium">-₱ {discount.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold">
                  <span className="text-[#4F4F4F]">Total Amount Due</span>
                  <span className="text-[#4F4F4F]">₱ {Math.max(0, total - discount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={handleSendForApproval}
              disabled={submitting}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Send For Approval'}
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2 border border-gray-300 text-[#4F4F4F] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== CLINIC ADMIN VIEW ====================

function ClinicAdminBilling({ currentUser }: { currentUser: { clinicId?: string; clinicBranchId?: string } | null }) {
  const [billings, setBillings] = useState<ApiBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBilling, setEditingBilling] = useState<ApiBilling | null>(null)

  const fetchBillings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billings`, { headers: authHeaders() })
      const data = await res.json()
      if (data.status === 'SUCCESS') setBillings(data.data.billings || [])
    } catch (e) {
      console.error('Failed to fetch billings:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

  const filteredData = billings.filter((b) => {
    const q = searchQuery.toLowerCase()
    const clientName = `${b.ownerId?.firstName || ''} ${b.ownerId?.lastName || ''}`.toLowerCase()
    return (
      clientName.includes(q) ||
      (b.petId?.name || '').toLowerCase().includes(q) ||
      b._id.toLowerCase().includes(q)
    )
  })

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRecords)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedRecords(newSelected)
  }

  const toggleAllSelections = () => {
    if (selectedRecords.size === filteredData.length) setSelectedRecords(new Set())
    else setSelectedRecords(new Set(filteredData.map((r) => r._id)))
  }

  const handleDelete = async () => {
    if (selectedRecords.size === 0) return
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRecords.size} record(s)?`)
    if (!confirmed) return
    try {
      const res = await fetch(`${API_BASE}/billings`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ ids: [...selectedRecords] }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setSelectedRecords(new Set())
        fetchBillings()
      } else {
        alert(data.message || 'Failed to delete records')
      }
    } catch (e) {
      console.error('Delete billing error:', e)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-[#4F4F4F] mb-8">Billing and Invoicing</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#4F4F4F]">Invoices</h2>
        </div>

        <div className="mb-6 flex justify-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-6 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Billing
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Enter a Client, Patients Name or ID Tag"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={selectedRecords.size === 0}
              className="inline-flex items-center px-4 py-2 text-sm text-[#4F4F4F] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
            <button className="inline-flex items-center px-4 py-2 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRecords.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleAllSelections}
                    className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                  />
                </th>
                {['Client', 'Patient', 'Veterinarian', 'Branch Availed', 'Amount Due', 'Status', 'Action'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">{col} <ChevronDown className="w-3 h-3" /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td>
                </tr>
              )}
              {!loading && filteredData.map((b) => {
                const status = mapAdminStatus(b.status)
                return (
                  <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRecords.has(b._id)}
                        onChange={() => toggleSelection(b._id)}
                        className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[#7FA5A3] hover:text-[#6A8E8C] cursor-pointer underline">
                        {b.ownerId?.firstName} {b.ownerId?.lastName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.petId?.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">
                      Dr. {b.vetId?.firstName} {b.vetId?.lastName}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.clinicBranchId?.name || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{formatCurrency(b.totalAmountDue)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => { setEditingBilling(b); setShowEditModal(true) }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filteredData.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No billing records found</p>
              <p className="text-sm text-gray-400">Try adjusting your search or create a new billing record.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateBillingModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchBillings}
        />
      )}

      {showEditModal && editingBilling && (
        <EditBillingModal
          billing={editingBilling}
          currentUser={currentUser}
          onClose={() => { setShowEditModal(false); setEditingBilling(null) }}
          onUpdated={fetchBillings}
        />
      )}
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function BillingInvoicing() {
  const user = useAuthStore((state) => state.user)
  const userType = user?.userType

  return (
    <DashboardLayout>
      {userType === 'clinic-admin' || userType === 'branch-admin' ? (
        <ClinicAdminBilling currentUser={user} />
      ) : userType === 'veterinarian' ? (
        <VetBilling />
      ) : (
        <PetOwnerBilling />
      )}
    </DashboardLayout>
  )
}
