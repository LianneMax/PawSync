'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { refreshBillingPrices } from '@/lib/billingSync'
import {
  Search,

  Trash2,
  ChevronDown,
  Receipt,
  Download,
  Eye,
  QrCode,
  X,
  Upload,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'

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
  vaccineTypeId?: string
  name: string
  type: 'Service' | 'Product'
  unitPrice: number
  quantity: number
}

interface ApiBilling {
  _id: string
  ownerId: { _id: string; firstName: string; lastName: string; email: string }
  petId: { _id: string; name: string; species: string; breed: string }
  vetId: { _id: string; firstName: string; lastName: string }
  clinicId: { _id: string; name: string }
  clinicBranchId: { _id: string; name: string }
  medicalRecordId: { _id: string; stage: string } | null
  items: ApiBillingItem[]
  subtotal: number
  discount: number
  totalAmountDue: number
  status: 'pending_payment' | 'paid'
  serviceLabel: string
  serviceDate: string
  createdAt: string
  paidAt?: string
  amountPaid?: number
  paymentMethod?: 'cash' | 'card' | 'qr'
  qrPaymentProof?: string | null
  qrPaymentSubmittedAt?: string | null
  pendingQrApproval?: boolean
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

type AdminStatus = 'Running' | 'Paid' | 'Pending Payment'
type OwnerStatus = 'Paid' | 'Pending Payment' | 'Running'

function mapAdminStatus(billing: ApiBilling): AdminStatus {
  if (billing.status === 'paid') return 'Paid'
  if (billing.status === 'pending_payment' && billing.medicalRecordId?.stage === 'completed') return 'Pending Payment'
  return 'Running'
}

function mapOwnerStatus(billing: ApiBilling): OwnerStatus {
  if (billing.status === 'paid') return 'Paid'
  if (billing.status === 'pending_payment' && billing.medicalRecordId?.stage === 'completed') return 'Pending Payment'
  return 'Running'
}

function getAdminStatusStyle(status: AdminStatus) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending Payment': return 'bg-blue-100 text-blue-700'
    case 'Running': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function getOwnerStatusStyle(status: OwnerStatus) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending Payment': return 'bg-blue-100 text-blue-700'
    case 'Running': return 'bg-yellow-100 text-yellow-700'
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
  const [viewingBilling, setViewingBilling] = useState<ApiBilling | null>(null)
  const [payingBilling, setPayingBilling] = useState<ApiBilling | null>(null)

  const fetchBillings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/billings/my-invoices`, { headers: authHeaders() })
      const data = await res.json()
      if (data.status === 'SUCCESS') setBillings(data.data.billings || [])
    } catch (e) {
      console.error('Failed to fetch invoices:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

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
      <PageHeader
        title="My Invoices"
        subtitle="View and manage your billing history"
        className="mb-8"
      />

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
                const status = mapOwnerStatus(b)
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
                      <div className="flex items-center gap-2">
                        {b.status === 'pending_payment' && b.medicalRecordId?.stage === 'completed' && b.pendingQrApproval && (
                          <span className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-lg">
                            Awaiting Approval
                          </span>
                        )}
                        {b.status === 'pending_payment' && b.medicalRecordId?.stage === 'completed' && !b.pendingQrApproval && (
                          <button
                            onClick={() => setPayingBilling(b)}
                            className="inline-flex items-center px-3 py-1.5 bg-[#3D5A58] hover:bg-[#2e4341] text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Pay Now
                          </button>
                        )}
                        <button
                          onClick={() => setViewingBilling(b)}
                          className="text-gray-400 hover:text-[#476B6B] transition-colors"
                          title="View billing details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
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

      {viewingBilling && (
        <ViewBillingModal
          billing={viewingBilling}
          onClose={() => setViewingBilling(null)}
        />
      )}

      {payingBilling && (
        <PayNowModal
          billing={payingBilling}
          onClose={() => setPayingBilling(null)}
          onSubmitted={() => { setPayingBilling(null); fetchBillings() }}
        />
      )}
    </div>
  )
}

// ==================== HELPERS ====================

const CATEGORY_ORDER_BILLING = ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Pregnancy Delivery', 'Vaccines', 'Others']

function groupByCategory(items: ProductServiceOption[]) {
  const map = new Map<string, ProductServiceOption[]>()
  for (const item of items) {
    const cat = (item as any).category || item.type
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  const result: { category: string; items: ProductServiceOption[] }[] = []
  for (const cat of CATEGORY_ORDER_BILLING) {
    if (map.has(cat)) result.push({ category: cat, items: map.get(cat)! })
  }
  for (const [cat, items] of map) {
    if (!CATEGORY_ORDER_BILLING.includes(cat)) result.push({ category: cat, items })
  }
  return result
}

// ==================== VET VIEW ====================

function VetBilling() {
  const [billings, setBillings] = useState<ApiBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingBilling, setViewingBilling] = useState<ApiBilling | null>(null)

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
      <PageHeader
        title="Client Billing"
        subtitle="View billing records for your clients"
        className="mb-8"
      />

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
                const adminStatus = mapAdminStatus(b)
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
                      <button
                        onClick={() => setViewingBilling(b)}
                        className="text-gray-400 hover:text-[#476B6B] transition-colors"
                        title="View billing details"
                      >
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
              <p className="text-gray-500">No billing records found</p>
            </div>
          )}
        </div>
      </div>

      {viewingBilling && (
        <ViewBillingModal
          billing={viewingBilling}
          onClose={() => setViewingBilling(null)}
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">

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
            <p className="text-sm text-gray-400">Review and confirm the billing information</p>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Client</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                    >
                      <span className={clientId ? 'text-[#4F4F4F]' : 'text-gray-400'}>
                        {clientOptions.find((c) => c.id === clientId)?.name || 'Select'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg max-h-56 overflow-y-auto">
                    <DropdownMenuRadioGroup
                      value={clientId}
                      onValueChange={(value) => {
                        setClientId(value)
                        setPatientId('')
                      }}
                    >
                      <DropdownMenuRadioItem value="">Select</DropdownMenuRadioItem>
                      {clientOptions.map((c) => (
                        <DropdownMenuRadioItem key={c.id} value={c.id}>{c.name}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Patient</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                    >
                      <span className={patientId ? 'text-[#4F4F4F]' : 'text-gray-400'}>
                        {patientOptions.find((p: any) => p._id === patientId)?.name || 'Select'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg max-h-56 overflow-y-auto">
                    <DropdownMenuRadioGroup value={patientId} onValueChange={setPatientId}>
                      <DropdownMenuRadioItem value="">Select</DropdownMenuRadioItem>
                      {patientOptions.map((p: any) => (
                        <DropdownMenuRadioItem key={p._id} value={p._id}>{p.name}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Veterinarian</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                    >
                      <span className={veterinarianId ? 'text-[#4F4F4F]' : 'text-gray-400'}>
                        {vetOptions.find((v) => v.id === veterinarianId)?.name || 'Select'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg max-h-56 overflow-y-auto">
                    <DropdownMenuRadioGroup value={veterinarianId} onValueChange={setVeterinarianId}>
                      <DropdownMenuRadioItem value="">Select</DropdownMenuRadioItem>
                      {vetOptions.map((v) => (
                        <DropdownMenuRadioItem key={v.id} value={v.id}>{v.name}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              {submitting ? 'Creating...' : 'Create Billing'}
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

// ==================== VIEW QR MODAL ====================

interface PaymentQRItem {
  _id: string
  label: string
  imageData: string
  createdAt: string
}

function ViewQRsModal({ onClose }: { onClose: () => void }) {
  const [qrItems, setQrItems] = useState<PaymentQRItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editImageData, setEditImageData] = useState<string | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchQRs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/payment-qr`, { headers: authHeaders() })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setQrItems(data.data.items || [])
      }
    } catch {
      setError('Failed to load QR codes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQRs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (item: PaymentQRItem) => {
    setEditingId(item._id)
    setEditLabel(item.label)
    setEditImageData(null)
    setEditPreview(item.imageData)
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditLabel('')
    setEditImageData(null)
    setEditPreview(null)
    setError('')
  }

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setEditImageData(result)
      setEditPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) { setError('Label is required.'); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, string> = { label: editLabel.trim() }
      if (editImageData) body.imageData = editImageData
      const res = await fetch(`${API_BASE}/payment-qr/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        await fetchQRs()
        cancelEdit()
      } else {
        setError(data.message || 'Failed to update QR code.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this QR code?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API_BASE}/payment-qr/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setQrItems((prev) => prev.filter((q) => q._id !== id))
        if (editingId === id) cancelEdit()
      } else {
        setError(data.message || 'Failed to delete QR code.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 relative animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center pt-8 pb-4 px-8">
          <div className="w-12 h-12 bg-[#EAF1F1] rounded-full flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-6 h-6 text-[#3D5E5C]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Current Payment QR Codes</h2>
          <p className="text-sm text-gray-500">Manage your uploaded payment QR codes</p>
        </div>

        {error && (
          <div className="mx-8 mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-500 text-xs">{error}</p>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading QR codes…
            </div>
          ) : qrItems.length === 0 ? (
            <div className="text-center py-12">
              <QrCode className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No QR codes uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {qrItems.map((item) => (
                <div key={item._id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {editingId === item._id ? (
                    /* ---- Edit mode ---- */
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="e.g. GCash, Maya"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">QR Image</label>
                        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#7FA5A3] hover:bg-gray-50 transition-all p-4">
                          {editPreview ? (
                            <img src={editPreview} alt="QR Preview" className="max-h-36 object-contain rounded-lg" />
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-gray-300 mb-1" />
                              <span className="text-xs text-gray-400">Click to replace image</span>
                            </>
                          )}
                          <input type="file" accept="image/*" onChange={handleEditFileChange} className="hidden" />
                        </label>
                        {editPreview && (
                          <button
                            onClick={() => { setEditImageData(null); setEditPreview(null) }}
                            className="mt-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
                          >
                            Remove image
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(item._id)}
                          disabled={saving}
                          className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
                        >
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-lg transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ---- View mode ---- */
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-20 h-20 shrink-0 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden">
                        <img src={item.imageData} alt={item.label} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#4F4F4F] text-sm truncate">{item.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Added {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-gray-400 hover:text-[#3D5E5C] hover:bg-[#f0f7f7] rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item._id)}
                          disabled={deletingId === item._id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== UPLOAD QR MODAL ====================

function UploadQRModal({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImageData(result)
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!label.trim()) { setError('Label is required.'); return }
    if (!imageData) { setError('Please upload a QR code image.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/payment-qr`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ label: label.trim(), imageData }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onClose()
      } else {
        setError(data.message || 'Failed to save QR code.')
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-[#EAF1F1] rounded-full flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-6 h-6 text-[#3D5E5C]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Upload Payment QR</h2>
          <p className="text-sm text-gray-500">Add a QR code for payment collection</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. GCash, Maya, Bank Transfer"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Code Image</label>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#7FA5A3] hover:bg-gray-50 transition-all p-5">
              {preview ? (
                <img src={preview} alt="QR Preview" className="max-h-48 object-contain rounded-lg" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mb-2" />
                  <span className="text-sm text-gray-400">Click to upload image</span>
                  <span className="text-xs text-gray-300 mt-1">PNG, JPG, WEBP</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            {preview && (
              <button
                onClick={() => { setImageData(null); setPreview(null) }}
                className="mt-2 text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Remove image
              </button>
            )}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {saving ? 'Saving...' : 'Save QR Code'}
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

// ==================== VIEW BILLING MODAL (read-only) ====================

const VIEW_BILLING_CATEGORY_ORDER = ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Pregnancy Delivery', 'Vaccines', 'Others']

function groupBillingItemsByCategory(
  items: ApiBillingItem[],
  categoryMap: Map<string, string>,
): { category: string; items: ApiBillingItem[] }[] {
  const map = new Map<string, ApiBillingItem[]>()
  for (const item of items) {
    const cat = item.vaccineTypeId
      ? 'Vaccines'
      : (item.productServiceId ? (categoryMap.get(item.productServiceId) ?? 'Others') : 'Others')
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  const result: { category: string; items: ApiBillingItem[] }[] = []
  for (const cat of VIEW_BILLING_CATEGORY_ORDER) {
    if (map.has(cat)) result.push({ category: cat, items: map.get(cat)! })
  }
  for (const [cat, catItems] of map) {
    if (!VIEW_BILLING_CATEGORY_ORDER.includes(cat)) result.push({ category: cat, items: catItems })
  }
  return result
}

function ViewBillingModal({
  billing: initialBilling,
  onClose,
}: {
  billing: ApiBilling
  onClose: () => void
}) {
  const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', qr: 'QR' }
  const { token } = useAuthStore()
  const [billing, setBilling] = useState<ApiBilling>(initialBilling)
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map())

  // Fetch catalog to resolve item categories
  useEffect(() => {
    const run = async () => {
      try {
        const [psRes, vtRes] = await Promise.all([
          fetch(`${API_BASE}/product-services`, { headers: authHeaders() }).then((r) => r.json()),
          fetch(`${API_BASE}/vaccine-types`).then((r) => r.json()),
        ])
        const map = new Map<string, string>()
        for (const p of psRes?.data?.items ?? []) map.set(p._id, p.category)
        for (const v of vtRes?.data?.vaccineTypes ?? []) map.set(v._id, 'Vaccines')
        setCategoryMap(map)
      } catch {
        // non-fatal — items will fall under 'Others'
      }
    }
    run()
  }, [initialBilling._id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh prices from the current catalog whenever this modal opens for an unpaid bill
  useEffect(() => {
    if (initialBilling.status === 'paid' || !token) return
    refreshBillingPrices(initialBilling._id, token)
      .then((updated) => { if (updated) setBilling(updated as ApiBilling) })
      .catch(() => {})
  }, [initialBilling._id]) // eslint-disable-line react-hooks/exhaustive-deps

  const modalStatus = mapAdminStatus(billing)
  const groupedItems = groupBillingItemsByCategory(billing.items, categoryMap)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 relative max-h-[90vh] overflow-y-auto">
        {/* Modal header bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-5 pb-4 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#4F4F4F]">Billing Details</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(modalStatus)}`}>
                  {modalStatus}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate">
                <span className="font-medium text-[#4F4F4F]">{billing.petId?.name}</span>
                {billing.petId?.breed ? <span className="text-gray-400"> · {billing.petId.species} {billing.petId.breed}</span> : null}
                {' '}&mdash;{' '}
                {billing.ownerId?.firstName} {billing.ownerId?.lastName}
              </p>
            </div>
          </div>
          {/* Meta row: vet, date */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            {billing.vetId?.firstName && (
              <span>Dr. {billing.vetId.firstName} {billing.vetId.lastName}</span>
            )}
            {(billing.serviceDate || billing.createdAt) && (
              <span>{formatDate(billing.serviceDate || billing.createdAt)}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Contextual status banners */}
          {billing.status === 'pending_payment' && billing.medicalRecordId?.stage !== 'completed' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
              The visit is still in progress. This invoice will update automatically as the medical record is completed.
            </div>
          )}
          {billing.status === 'pending_payment' && billing.medicalRecordId?.stage === 'completed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              The visit is complete. This invoice is ready for payment.
            </div>
          )}

          {/* Items table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product / Service</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billing.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No items yet</td>
                  </tr>
                ) : (
                  groupedItems.map(({ category, items: catItems }) => (
                    <React.Fragment key={category}>
                      <tr>
                        <td colSpan={4} className="px-4 py-1.5 bg-gray-50 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{category}</p>
                        </td>
                      </tr>
                      {catItems.map((item) => (
                        <tr key={item._id}>
                          <td className="px-4 py-3 text-sm font-medium text-[#4F4F4F]">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-center text-[#4F4F4F]">{item.quantity ?? 1}</td>
                          <td className="px-4 py-3 text-sm text-right text-[#4F4F4F]">₱{item.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-[#4F4F4F]">₱{((item.unitPrice ?? 0) * (item.quantity ?? 1)).toLocaleString()}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Order summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-[#4F4F4F] font-medium">₱{billing.subtotal.toLocaleString()}</span>
            </div>
            {billing.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-500 font-medium">-₱{billing.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
              <span className="text-[#3D5A58]">Total Amount Due</span>
              <span className="text-[#3D5A58] text-base">₱{billing.totalAmountDue.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment details (paid only) */}
          {billing.status === 'paid' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-green-700 mb-1">Payment Received</p>
              {billing.amountPaid !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="text-green-700 font-medium">₱{billing.amountPaid.toLocaleString()}</span>
                </div>
              )}
              {billing.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="text-[#4F4F4F]">{PAYMENT_METHOD_LABEL[billing.paymentMethod] ?? billing.paymentMethod}</span>
                </div>
              )}
              {billing.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid On</span>
                  <span className="text-[#4F4F4F]">{formatDate(billing.paidAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-[#3D5E5C] hover:bg-[#2F4C4A] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== PAY NOW MODAL (Pet Owner) ====================

function PayNowModal({
  billing,
  onClose,
  onSubmitted,
}: {
  billing: ApiBilling
  onClose: () => void
  onSubmitted: () => void
}) {
  const [step, setStep] = useState<'choose' | 'upload' | 'success'>('choose')
  const [qrItems, setQrItems] = useState<PaymentQRItem[]>([])
  const [loadingQRs, setLoadingQRs] = useState(true)
  const [selectedQR, setSelectedQR] = useState<PaymentQRItem | null>(null)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/payment-qr`, { headers: authHeaders() })
        const data = await res.json()
        if (data.status === 'SUCCESS') setQrItems(data.data.items || [])
      } catch {
        setError('Failed to load payment options.')
      } finally {
        setLoadingQRs(false)
      }
    })()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setScreenshot(result)
      setScreenshotPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!screenshot) { setError('Please upload a screenshot of your payment.'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/billings/${billing._id}/submit-qr-proof`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ screenshot }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setStep('success')
      } else {
        setError(data.message || 'Failed to submit payment proof.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'success' && !submitting) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 relative">
        {step !== 'success' && (
          <button
            onClick={onClose}
            disabled={submitting}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* ── Step: choose QR ── */}
        {step === 'choose' && (
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#EAF1F1] rounded-full flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-6 h-6 text-[#3D5E5C]" />
              </div>
              <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Pay via QR</h2>
              <p className="text-sm text-gray-400">
                {billing.petId?.name} &mdash; {formatCurrency(billing.totalAmountDue)}
              </p>
            </div>

            {loadingQRs ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Loading payment options…
              </div>
            ) : qrItems.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No QR payment options available from the clinic at this time.</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-1">
                {qrItems.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => setSelectedQR(item)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      selectedQR?._id === item._id
                        ? 'border-[#476B6B] bg-[#f0f7f7]'
                        : 'border-gray-200 hover:border-[#7FA5A3] hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-14 h-14 shrink-0 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden">
                      <img src={item.imageData} alt={item.label} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#4F4F4F] text-sm">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Scan to pay</p>
                    </div>
                    {selectedQR?._id === item._id && (
                      <div className="w-5 h-5 rounded-full bg-[#476B6B] flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { if (selectedQR) setStep('upload') }}
                disabled={!selectedQR || qrItems.length === 0}
                className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Continue
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Step: upload proof ── */}
        {step === 'upload' && selectedQR && (
          <div className="p-8">
            <button
              onClick={() => { setStep('choose'); setError('') }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>

            <div className="text-center mb-5">
              <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Scan &amp; Upload Proof</h2>
              <p className="text-sm text-gray-400">Scan the QR below, then upload your payment screenshot</p>
            </div>

            {/* Show selected QR large */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">{selectedQR.label}</p>
              <div className="w-48 h-48 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                <img src={selectedQR.imageData} alt={selectedQR.label} className="w-full h-full object-contain p-2" />
              </div>
              <p className="text-xs text-gray-400 mt-2">Amount to pay: <span className="font-semibold text-[#4F4F4F]">{formatCurrency(billing.totalAmountDue)}</span></p>
            </div>

            {/* Screenshot upload */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1.5">
                Upload Payment Screenshot <span className="text-red-500">*</span>
              </label>
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#7FA5A3] hover:bg-gray-50 transition-all p-4">
                {screenshotPreview ? (
                  <img src={screenshotPreview} alt="Payment proof" className="max-h-36 object-contain rounded-lg" />
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-gray-300 mb-2" />
                    <span className="text-sm text-gray-400">Click to upload screenshot</span>
                    <span className="text-xs text-gray-300 mt-1">PNG, JPG, WEBP</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              {screenshotPreview && (
                <button
                  onClick={() => { setScreenshot(null); setScreenshotPreview(null) }}
                  className="mt-1 text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || !screenshot}
                className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {submitting ? 'Submitting…' : 'Submit Payment'}
              </button>
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Step: success ── */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Payment Submitted!</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your payment screenshot has been sent to the clinic for review. You'll be notified once it's approved.
            </p>
            <button
              onClick={onSubmitted}
              className="w-full bg-[#3D5E5C] hover:bg-[#2F4C4A] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== MARK AS PAID MODAL ====================

function MarkAsPaidModal({
  billing,
  onClose,
  onPaid,
}: {
  billing: ApiBilling
  onClose: () => void
  onPaid: () => void
}) {
  const [amountPaid, setAmountPaid] = useState(billing.totalAmountDue.toString())
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [qrItems, setQrItems] = useState<PaymentQRItem[]>([])
  const [loadingQRs, setLoadingQRs] = useState(false)
  const [selectedQR, setSelectedQR] = useState<PaymentQRItem | null>(null)

  useEffect(() => {
    if (paymentMethod !== 'qr') return
    if (qrItems.length > 0) return
    setLoadingQRs(true)
    fetch(`${API_BASE}/payment-qr`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'SUCCESS') setQrItems(data.data.items || [])
      })
      .catch(() => {})
      .finally(() => setLoadingQRs(false))
  }, [paymentMethod]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    const parsed = parseFloat(amountPaid)
    if (!amountPaid || isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid amount.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/billings/${billing._id}/pay`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ amountPaid: parsed, paymentMethod }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onPaid()
        onClose()
      } else {
        setError(data.message || 'Failed to mark as paid.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const PAYMENT_METHODS: { value: 'cash' | 'card' | 'qr'; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'qr', label: 'QR' },
  ]

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
          <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Mark as Paid</h2>
          <p className="text-sm text-gray-400">
            {billing.petId?.name} &mdash; {billing.ownerId?.firstName} {billing.ownerId?.lastName}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1.5">Amount Paid (₱)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#4F4F4F] outline-none focus:border-[#476B6B] focus:ring-2 focus:ring-[#476B6B]/10 transition-all"
              placeholder="Enter amount paid"
            />
            <p className="text-xs text-gray-400 mt-1">
              Total due: ₱ {billing.totalAmountDue.toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1.5">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setPaymentMethod(value); setSelectedQR(null) }}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    paymentMethod === value
                      ? 'bg-[#476B6B] text-white border-[#476B6B]'
                      : 'bg-white text-[#4F4F4F] border-gray-200 hover:border-[#476B6B] hover:text-[#476B6B]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* QR options for the admin to reference */}
          {paymentMethod === 'qr' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Available QR Codes</label>
              {loadingQRs ? (
                <p className="text-xs text-gray-400">Loading QR options…</p>
              ) : qrItems.length === 0 ? (
                <p className="text-xs text-gray-400">No QR codes uploaded yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {qrItems.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => setSelectedQR(selectedQR?._id === item._id ? null : item)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        selectedQR?._id === item._id
                          ? 'border-[#476B6B] bg-[#f0f7f7]'
                          : 'border-gray-100 hover:border-[#7FA5A3]'
                      }`}
                    >
                      <div className="w-10 h-10 shrink-0 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                        <img src={item.imageData} alt={item.label} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-sm font-medium text-[#4F4F4F]">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedQR && (
                <div className="mt-3 flex justify-center">
                  <div className="w-36 h-36 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                    <img src={selectedQR.imageData} alt={selectedQR.label} className="w-full h-full object-contain p-2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-[#3D5E5C] hover:bg-[#2F4C4A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? 'Saving...' : 'Confirm Payment'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== APPROVE QR PAYMENT MODAL (Clinic Admin) ====================

function ApproveQRPaymentModal({
  billing,
  onClose,
  onApproved,
}: {
  billing: ApiBilling
  onClose: () => void
  onApproved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleApprove = async () => {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/billings/${billing._id}/approve-qr-payment`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        onApproved()
        onClose()
      } else {
        setError(data.message || 'Failed to approve payment.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 relative">
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Review QR Payment</h2>
            <p className="text-sm text-gray-400">
              {billing.petId?.name} &mdash; {billing.ownerId?.firstName} {billing.ownerId?.lastName}
            </p>
            <p className="text-sm font-semibold text-[#476B6B] mt-1">{formatCurrency(billing.totalAmountDue)}</p>
          </div>

          {/* Payment proof screenshot */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Screenshot</p>
            {billing.qrPaymentProof ? (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-40">
                <img
                  src={billing.qrPaymentProof}
                  alt="Payment proof"
                  className="max-h-72 max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center h-40 text-gray-400 text-sm">
                No screenshot available
              </div>
            )}
            {billing.qrPaymentSubmittedAt && (
              <p className="text-xs text-gray-400 mt-1.5">
                Submitted {formatDate(billing.qrPaymentSubmittedAt)}
              </p>
            )}
          </div>

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {submitting ? 'Approving…' : 'Approve Payment'}
            </button>
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-colors text-sm disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== CLINIC ADMIN VIEW ====================

function ClinicAdminBilling({ currentUser }: { currentUser: { clinicId?: string; clinicBranchId?: string } | null }) {
  const [billings, setBillings] = useState<ApiBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'pending_payment' | 'paid'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showQRModal, setShowQRModal] = useState(false)
  const [showViewQRModal, setShowViewQRModal] = useState(false)
  const [markingPaidBilling, setMarkingPaidBilling] = useState<ApiBilling | null>(null)
  const [approvingQrBilling, setApprovingQrBilling] = useState<ApiBilling | null>(null)
  const [viewingBilling, setViewingBilling] = useState<ApiBilling | null>(null)

  const fetchBillings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billings?limit=1000`, { headers: authHeaders() })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setBillings(data.data.billings || [])
      } else {
        console.error('Fetch billings error:', data.message)
      }
    } catch (e) {
      console.error('Failed to fetch billings:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

  const toLocalYmd = (value?: string | null) => {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const filteredData = billings.filter((b) => {
    const q = searchQuery.toLowerCase()
    const clientName = `${b.ownerId?.firstName || ''} ${b.ownerId?.lastName || ''}`.toLowerCase()
    const invoiceDateYmd = toLocalYmd(b.serviceDate || b.createdAt)
    let rangeStart = startDateFilter
    let rangeEnd = endDateFilter

    // If only one end of the range is selected, treat it as a single-day filter.
    if (rangeStart && !rangeEnd) rangeEnd = rangeStart
    if (!rangeStart && rangeEnd) rangeStart = rangeEnd

    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      const temp = rangeStart
      rangeStart = rangeEnd
      rangeEnd = temp
    }

    const matchesSearch =
      clientName.includes(q) ||
      (b.petId?.name || '').toLowerCase().includes(q) ||
      b._id.toLowerCase().includes(q)
    const matchesDate = !rangeStart || !rangeEnd || (invoiceDateYmd >= rangeStart && invoiceDateYmd <= rangeEnd)
    let matchesStatus = true
    if (statusFilter === 'running') {
      matchesStatus = b.status === 'pending_payment' && b.medicalRecordId?.stage !== 'completed'
    } else if (statusFilter === 'pending_payment') {
      matchesStatus = b.status === 'pending_payment' && b.medicalRecordId?.stage === 'completed'
    } else if (statusFilter === 'paid') {
      matchesStatus = b.status === 'paid'
    }
    return matchesSearch && matchesStatus && matchesDate
  })

  const itemsPerPage = 6
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const displayedInvoices = filteredData.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, startDateFilter, endDateFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRecords)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedRecords(newSelected)
  }

  const toggleAllSelections = () => {
    const pageIds = displayedInvoices.map((r) => r._id)
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedRecords.has(id))

    if (allPageSelected) {
      const next = new Set(selectedRecords)
      pageIds.forEach((id) => next.delete(id))
      setSelectedRecords(next)
      return
    }

    const next = new Set(selectedRecords)
    pageIds.forEach((id) => next.add(id))
    setSelectedRecords(next)
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
      <div className="flex items-center justify-between mb-8">
        <PageHeader
          title="Billing and Invoicing"
          subtitle="Manage invoices, payments, and QR billing workflows"
          className="mb-0"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowViewQRModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#3D5E5C] text-[#3D5E5C] hover:bg-[#f0f7f7] text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <QrCode className="w-4 h-4" />
            View Current QR&apos;s
          </button>
          <button
            onClick={() => setShowQRModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#3D5E5C] hover:bg-[#2F4C4A] text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Upload QR
          </button>
        </div>
      </div>

      {showQRModal && <UploadQRModal onClose={() => setShowQRModal(false)} />}
      {showViewQRModal && <ViewQRsModal onClose={() => setShowViewQRModal(false)} />}

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#4F4F4F]">Invoices</h2>
        </div>

        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {([
              { value: 'all', label: 'All' },
              { value: 'running', label: 'Running' },
              { value: 'pending_payment', label: 'Pending Payment' },
              { value: 'paid', label: 'Paid' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setStatusFilter(value); setSelectedRecords(new Set()) }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-[#476B6B] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
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

        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-3 min-w-[420px] justify-end">
            <div className="w-48 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 shrink-0">From</span>
              <DatePicker
                value={startDateFilter}
                onChange={setStartDateFilter}
                placeholder="Start date"
                allowFutureDates={true}
                compact
                className="w-full"
              />
            </div>
            <div className="w-48 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 shrink-0">To</span>
              <DatePicker
                value={endDateFilter}
                onChange={setEndDateFilter}
                placeholder="End date"
                allowFutureDates={true}
                compact
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 min-h-[520px]">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={displayedInvoices.length > 0 && displayedInvoices.every((record) => selectedRecords.has(record._id))}
                    onChange={toggleAllSelections}
                    className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                  />
                </th>
                {['View', 'Client', 'Patient', 'Veterinarian', 'Branch Availed', 'Service', 'Date', 'Amount Due', 'Status', 'Action'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">{col} <ChevronDown className="w-3 h-3" /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td>
                </tr>
              )}
              {!loading && displayedInvoices.map((b) => {
                const status = mapAdminStatus(b)
                const canMarkPaid = b.status === 'pending_payment' && b.medicalRecordId?.stage === 'completed'
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
                      <button
                        onClick={() => setViewingBilling(b)}
                        className="text-gray-400 hover:text-[#476B6B] transition-colors"
                        title="View billing details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{b.serviceLabel || '-'}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{formatDate(b.serviceDate || b.createdAt)}</td>
                    <td className="px-4 py-4 text-sm text-[#4F4F4F]">{formatCurrency(b.totalAmountDue)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {canMarkPaid && b.pendingQrApproval && (
                          <button
                            onClick={() => setApprovingQrBilling(b)}
                            className="inline-flex items-center px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Approve Payment
                          </button>
                        )}
                        {canMarkPaid && !b.pendingQrApproval && (
                          <button
                            onClick={() => setMarkingPaidBilling(b)}
                            className="inline-flex items-center px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Mark as Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && filteredData.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No invoices available.</p>
            </div>
          )}

        </div>

        {!loading && filteredData.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-[#4F4F4F] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-8 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
                    safeCurrentPage === page
                      ? 'bg-[#476B6B] text-white border-[#476B6B]'
                      : 'text-[#4F4F4F] border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-[#4F4F4F] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {markingPaidBilling && (
        <MarkAsPaidModal
          billing={markingPaidBilling}
          onClose={() => setMarkingPaidBilling(null)}
          onPaid={fetchBillings}
        />
      )}

      {approvingQrBilling && (
        <ApproveQRPaymentModal
          billing={approvingQrBilling}
          onClose={() => setApprovingQrBilling(null)}
          onApproved={fetchBillings}
        />
      )}

      {viewingBilling && (
        <ViewBillingModal
          billing={viewingBilling}
          onClose={() => setViewingBilling(null)}
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
      {userType === 'clinic-admin' ? (
        <ClinicAdminBilling currentUser={user} />
      ) : userType === 'veterinarian' ? (
        <VetBilling />
      ) : (
        <PetOwnerBilling />
      )}
    </DashboardLayout>
  )
}
