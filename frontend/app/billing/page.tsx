'use client'

import React, { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Search,
  Plus,
  Trash2,
  Filter,
  Edit2,
  ChevronDown,
  Receipt,
  Download,
  Eye
} from 'lucide-react'

// ==================== TYPES ====================

interface BillingRecord {
  id: string
  client: string
  patient: string
  veterinarian: string
  branchAvailed: string
  amountDue: string
  status: 'Awaiting Approval' | 'Paid' | 'Pending Payment'
}

interface PetOwnerInvoice {
  id: string
  pet: string
  service: string
  clinic: string
  date: string
  amount: string
  status: 'Paid' | 'Pending' | 'Overdue'
}

interface VetBillingRecord {
  id: string
  client: string
  patient: string
  service: string
  date: string
  amount: string
  status: 'Paid' | 'Pending' | 'Overdue' | 'Awaiting Approval'
}

// ==================== MOCK DATA ====================

const clinicAdminData: BillingRecord[] = [
  { id: '1', client: 'Lianne Balbastro', patient: 'Oscar', veterinarian: 'Dr. DoLittle', branchAvailed: 'Main Branch', amountDue: 'Php 1,000', status: 'Awaiting Approval' },
  { id: '2', client: 'Lianne Balbastro', patient: 'Orbit', veterinarian: 'Dr. DoLittle', branchAvailed: 'Main Branch', amountDue: 'Php 1,000', status: 'Paid' },
  { id: '3', client: 'Juls Lammoglia', patient: 'Sylvester', veterinarian: 'Dr. Santos', branchAvailed: 'Makati Branch', amountDue: 'Php 1,500', status: 'Pending Payment' },
  { id: '4', client: 'Miguel Reano', patient: 'Rojo', veterinarian: 'Dr. DoLittle', branchAvailed: 'Main Branch', amountDue: 'Php 800', status: 'Paid' },
  { id: '5', client: 'Alyssa Mansueto', patient: 'Pichi', veterinarian: 'Dr. Castro', branchAvailed: 'BGC Branch', amountDue: 'Php 2,000', status: 'Pending Payment' },
  { id: '6', client: 'Miguel Reano', patient: 'Blue', veterinarian: 'Dr. Santos', branchAvailed: 'Makati Branch', amountDue: 'Php 1,200', status: 'Awaiting Approval' },
]

const petOwnerData: PetOwnerInvoice[] = [
  { id: '1', pet: 'Oscar', service: 'Annual Checkup & Vaccination', clinic: 'BaiVet Main Clinic', date: 'Jan 15, 2026', amount: 'Php 1,000', status: 'Paid' },
  { id: '2', pet: 'Oscar', service: 'Dental Cleaning', clinic: 'BaiVet Main Clinic', date: 'Feb 3, 2026', amount: 'Php 2,500', status: 'Pending' },
  { id: '3', pet: 'Orbit', service: 'Skin Allergy Treatment', clinic: 'BaiVet Makati', date: 'Jan 20, 2026', amount: 'Php 1,500', status: 'Paid' },
  { id: '4', pet: 'Orbit', service: 'Follow-up Checkup', clinic: 'BaiVet Makati', date: 'Feb 10, 2026', amount: 'Php 800', status: 'Pending' },
  { id: '5', pet: 'Oscar', service: 'Blood Test', clinic: 'BaiVet Main Clinic', date: 'Dec 5, 2025', amount: 'Php 1,200', status: 'Overdue' },
]

const vetBillingData: VetBillingRecord[] = [
  { id: '1', client: 'Lianne Balbastro', patient: 'Oscar', service: 'Annual Checkup & Vaccination', date: 'Jan 15, 2026', amount: 'Php 1,000', status: 'Paid' },
  { id: '2', client: 'Lianne Balbastro', patient: 'Orbit', service: 'Skin Allergy Treatment', date: 'Jan 20, 2026', amount: 'Php 1,500', status: 'Paid' },
  { id: '3', client: 'Miguel Reano', patient: 'Rojo', service: 'Post-Surgery Checkup', date: 'Jan 25, 2026', amount: 'Php 800', status: 'Pending' },
  { id: '4', client: 'Alyssa Mansueto', patient: 'Pichi', service: 'Vaccination', date: 'Feb 1, 2026', amount: 'Php 2,000', status: 'Awaiting Approval' },
  { id: '5', client: 'Juls Lammoglia', patient: 'Sylvester', service: 'Dental Cleaning', date: 'Feb 5, 2026', amount: 'Php 1,500', status: 'Overdue' },
]

// ==================== STATUS HELPERS ====================

function getAdminStatusStyle(status: BillingRecord['status']) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending Payment': return 'bg-blue-100 text-blue-700'
    case 'Awaiting Approval': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function getOwnerStatusStyle(status: PetOwnerInvoice['status']) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending': return 'bg-yellow-100 text-yellow-700'
    case 'Overdue': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function getVetStatusStyle(status: VetBillingRecord['status']) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending': return 'bg-yellow-100 text-yellow-700'
    case 'Awaiting Approval': return 'bg-yellow-100 text-yellow-700'
    case 'Overdue': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

// ==================== PET OWNER VIEW ====================

function PetOwnerBilling() {
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = petOwnerData.filter(inv => {
    const q = searchQuery.toLowerCase()
    return inv.pet.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q) || inv.clinic.toLowerCase().includes(q)
  })

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-[#4F4F4F] mb-2">My Invoices</h1>
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
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{inv.pet}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{inv.service}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{inv.clinic}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{inv.date}</td>
                  <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{inv.amount}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOwnerStatusStyle(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
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

function VetApprovalModal({ record, onClose }: { record: VetBillingRecord; onClose: () => void }) {
  // TODO: BACKEND — replace with real ProductServiceItem[] fetched from the billing record
  // e.g. GET /billings/{record.id}/items
  const items: { id: string; name: string; type: 'Service' | 'Product'; price: number }[] = []

  // TODO: BACKEND — replace with real discount value from the billing record
  const discount = 0

  const total = items.reduce((sum, p) => sum + p.price, 0)

  const handleApprove = () => {
    // TODO: BACKEND — call PATCH /billings/{record.id} with { status: 'Approved' }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#4F4F4F] mb-1">Products and Services</h2>
          <p className="text-sm text-gray-400">You can edit and review the billing details before approval</p>
        </div>

        {/* Product search — read-only display for vet, no add/remove */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Product/Service to Add"
            disabled
            // TODO: BACKEND — enable and wire to GET /products-services?search={value} if vets can add items
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
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
              {items.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm font-medium text-[#4F4F4F]">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${p.type === 'Service' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#4F4F4F]">Php {p.price.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button className="text-gray-400 hover:text-red-500 transition-colors">
                      {/* TODO: BACKEND — wire to remove item from billing record if vet editing is allowed */}
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 9l6 6M15 9l-6 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  {/* TODO: BACKEND — this empty state goes away once items are loaded from the API */}
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading billing items...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom: order summary left, buttons right */}
        <div className="flex items-end justify-between gap-6">
          <div className="border border-gray-200 rounded-xl p-4 w-56 shrink-0">
            <p className="text-sm font-semibold text-[#3D5A58] mb-1">Order Summary</p>
            <p className="text-xs text-gray-400 mb-3">Amount Due</p>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Services / Products Fee</span>
              {/* TODO: BACKEND — total comes from billing record items */}
              <span className="text-[#4F4F4F] font-medium">₱ {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-500">Discount</span>
              {/* TODO: BACKEND — discount comes from billing record */}
              <span className="text-red-500 font-medium">-₱ {discount.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold">
              <span className="text-[#4F4F4F]">Total Amount Due</span>
              <span className="text-[#4F4F4F]">₱ {Math.max(0, total - discount).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors"
            >
              Approve
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
  const [searchQuery, setSearchQuery] = useState('')
  const [approvingRecord, setApprovingRecord] = useState<VetBillingRecord | null>(null)

  const filtered = vetBillingData.filter(r => {
    const q = searchQuery.toLowerCase()
    return r.client.toLowerCase().includes(q) || r.patient.toLowerCase().includes(q) || r.service.toLowerCase().includes(q)
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
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-sm text-[#7FA5A3] hover:text-[#6A8E8C] cursor-pointer underline">{r.client}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{r.patient}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{r.service}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{r.date}</td>
                  <td className="px-4 py-4 text-sm font-medium text-[#4F4F4F]">{r.amount}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVetStatusStyle(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {r.status === 'Awaiting Approval' && (
                      <button
                        onClick={() => setApprovingRecord(r)}
                        className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No billing records found</p>
            </div>
          )}
        </div>
      </div>

      {approvingRecord && (
        <VetApprovalModal
          record={approvingRecord}
          onClose={() => setApprovingRecord(null)}
        />
      )}
    </div>
  )
}

// ==================== CREATE BILLING MODAL (3-STEP) ====================

// TODO: BACKEND — replace this type with the real Product/Service model from your API
interface ProductServiceItem {
  id: string
  name: string
  type: 'Service' | 'Product'
  price: number
}

// TODO: BACKEND — replace this type with the real MedicalRecord model from your API
interface MedicalRecordResult {
  id: string
  patientName: string
  date: string
}

function CreateBillingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('')

  // TODO: BACKEND — replace with real API call: GET /medical-records?search={patientSearch}
  // Should return MedicalRecordResult[] and populate a dropdown/list below the search input
  const medicalRecordResults: MedicalRecordResult[] = []

  // TODO: BACKEND — store the selected medical record ID to pass along to the billing payload
  const [selectedMedicalRecordId, setSelectedMedicalRecordId] = useState<string | null>(null)

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<ProductServiceItem[]>([])

  // TODO: BACKEND — replace with real API call: GET /products-services?search={productSearch}
  // Should return ProductServiceItem[] for the search dropdown
  const productSearchResults: ProductServiceItem[] = []

  const addProduct = (p: ProductServiceItem) => {
    setSelectedProducts(prev => [...prev, p])
    setProductSearch('')
  }

  const removeProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id))
  }

  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0)

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [veterinarianId, setVeterinarianId] = useState('')
  const [discount, setDiscount] = useState(0)

  // TODO: BACKEND — replace with real API calls:
  // GET /clients           → populate Client ID dropdown
  // GET /patients?clientId={clientId}  → populate Patient dropdown (filter by selected client)
  // GET /veterinarians     → populate Veterinarian dropdown
  const clientOptions: { id: string; name: string }[] = []
  const patientOptions: { id: string; name: string }[] = []
  const veterinarianOptions: { id: string; name: string }[] = []

  const handleSendForApproval = () => {
    // TODO: BACKEND — submit billing record via POST /billings with payload:
    // {
    //   medicalRecordId: selectedMedicalRecordId,
    //   clientId,
    //   patientId,
    //   veterinarianId,
    //   products: selectedProducts.map(p => ({ id: p.id, price: p.price })),
    //   discount,
    //   totalAmountDue: Math.max(0, total - discount),
    //   status: 'Awaiting Approval',
    // }
    onClose()
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
              // TODO: BACKEND — trigger search API call on onChange (debounced)
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
            {/* TODO: BACKEND — render medicalRecordResults here as a dropdown list */}
            {medicalRecordResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 text-left">
                {medicalRecordResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedMedicalRecordId(r.id); setStep(2) }}
                    className="w-full px-4 py-2.5 text-sm hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span>{r.patientName}</span>
                    <span className="text-gray-400">{r.date}</span>
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
              // TODO: BACKEND — trigger GET /products-services?search={value} on change (debounced)
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-gray-50"
            />
            {/* TODO: BACKEND — render productSearchResults here once API is wired */}
            {productSearch && productSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {productSearchResults
                  .filter(p => !selectedProducts.find(s => s.id === p.id))
                  .map(p => (
                    <button
                      key={p.id}
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
                {selectedProducts.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-[#4F4F4F]">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${p.type === 'Service' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#4F4F4F]">Php {p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeProduct(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 9l6 6M15 9l-6 6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
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
            {/* Left: form fields */}
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Client ID</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /clients
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {clientOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Patient</label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /patients?clientId={clientId}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {patientOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Veterinarian</label>
                <select
                  value={veterinarianId}
                  onChange={(e) => setVeterinarianId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /veterinarians
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {veterinarianOptions.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: order summary */}
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
                  {/* TODO: BACKEND — discount value should come from applied promo/voucher logic */}
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
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors"
            >
              Send For Approval
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

// ==================== EDIT BILLING MODAL (2-step: Products & Services → Billing Information) ====================

function EditBillingModal({ record, onClose }: { record: BillingRecord; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<ProductServiceItem[]>([])
  // TODO: BACKEND — pre-populate selectedProducts by fetching GET /billings/{record.id}/items on mount

  // TODO: BACKEND — replace with real API call: GET /products-services?search={productSearch}
  const productSearchResults: ProductServiceItem[] = []

  const addProduct = (p: ProductServiceItem) => {
    setSelectedProducts(prev => [...prev, p])
    setProductSearch('')
  }

  const removeProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id))
  }

  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0)

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [veterinarianId, setVeterinarianId] = useState('')
  // TODO: BACKEND — pre-populate clientId, patientId, veterinarianId from GET /billings/{record.id} on mount

  // TODO: BACKEND — replace with real discount from billing record
  const discount = 0

  // TODO: BACKEND — populate from GET /clients
  const clientOptions: { id: string; name: string }[] = []
  // TODO: BACKEND — populate from GET /patients?clientId={clientId}
  const patientOptions: { id: string; name: string }[] = []
  // TODO: BACKEND — populate from GET /veterinarians
  const veterinarianOptions: { id: string; name: string }[] = []

  const handleSendForApproval = () => {
    // TODO: BACKEND — call PATCH /billings/{record.id} with payload:
    // {
    //   clientId,
    //   patientId,
    //   veterinarianId,
    //   products: selectedProducts.map(p => ({ id: p.id, price: p.price })),
    //   discount,
    //   totalAmountDue: Math.max(0, total - discount),
    //   status: 'Awaiting Approval',
    // }
    onClose()
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
              // TODO: BACKEND — trigger GET /products-services?search={value} on change (debounced)
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-gray-50"
            />
            {/* TODO: BACKEND — render productSearchResults here once API is wired */}
            {productSearch && productSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {productSearchResults
                  .filter(p => !selectedProducts.find(s => s.id === p.id))
                  .map(p => (
                    <button
                      key={p.id}
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
                {selectedProducts.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm text-[#4F4F4F]">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${p.type === 'Service' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#4F4F4F]">Php {p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeProduct(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 9l6 6M15 9l-6 6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {selectedProducts.length === 0 && (
                  <tr>
                    {/* TODO: BACKEND — empty state goes away once items are loaded from GET /billings/{record.id}/items */}
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
            {/* Left: form fields */}
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Client ID</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /clients
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {clientOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Patient</label>
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /patients?clientId={clientId}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {patientOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Veterinarian</label>
                <select
                  value={veterinarianId}
                  onChange={(e) => setVeterinarianId(e.target.value)}
                  // TODO: BACKEND — populate options from GET /veterinarians
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                >
                  <option value="">Select</option>
                  {veterinarianOptions.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: order summary */}
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
                  {/* TODO: BACKEND — discount value should come from applied promo/voucher logic */}
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
              className="px-8 py-2 bg-[#3D5A58] text-white rounded-lg text-sm font-medium hover:bg-[#2e4341] transition-colors"
            >
              Send For Approval
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

function ClinicAdminBilling() {
  const [billingData, setBillingData] = useState<BillingRecord[]>(clinicAdminData)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null)

  const filteredData = billingData.filter(record => {
    const q = searchQuery.toLowerCase()
    return record.client.toLowerCase().includes(q) || record.patient.toLowerCase().includes(q) || record.id.toLowerCase().includes(q)
  })

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRecords)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedRecords(newSelected)
  }

  const toggleAllSelections = () => {
    if (selectedRecords.size === filteredData.length) setSelectedRecords(new Set())
    else setSelectedRecords(new Set(filteredData.map(r => r.id)))
  }

  const handleDelete = () => {
    if (selectedRecords.size === 0) return
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedRecords.size} record(s)?`)
    if (confirmed) {
      setBillingData(billingData.filter(record => !selectedRecords.has(record.id)))
      setSelectedRecords(new Set())
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
                  <input type="checkbox" checked={selectedRecords.size === filteredData.length && filteredData.length > 0} onChange={toggleAllSelections} className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]" />
                </th>
                {['Client', 'Patient', 'Veterinarian', 'Branch Availed', 'Amount Due', 'Status', 'Action'].map(col => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1">{col} <ChevronDown className="w-3 h-3" /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selectedRecords.has(record.id)} onChange={() => toggleSelection(record.id)} className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]" />
                  </td>
                  <td className="px-4 py-4"><span className="text-sm text-[#7FA5A3] hover:text-[#6A8E8C] cursor-pointer underline">{record.client}</span></td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{record.patient}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{record.veterinarian}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{record.branchAvailed}</td>
                  <td className="px-4 py-4 text-sm text-[#4F4F4F]">{record.amountDue}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={() => { setEditingRecord(record); setShowEditModal(true) }} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No billing records found</p>
              <p className="text-sm text-gray-400">Try adjusting your search or create a new billing record.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateBillingModal onClose={() => setShowCreateModal(false)} />
      )}

      {showEditModal && editingRecord && (
        <EditBillingModal
          record={editingRecord}
          onClose={() => { setShowEditModal(false); setEditingRecord(null) }}
        />
      )}
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function BillingInvoicing() {
  const user = useAuthStore((state) => state.user)
  const userType = user?.userType || 'pet-owner'

  // TEMP DEV ONLY: remove before production
  const [devRole, setDevRole] = useState(userType)

  return (
    <DashboardLayout>
      {/* TEMP DEV ONLY: remove before production */}
      <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-white border-2 border-dashed border-gray-300 rounded-xl px-3 py-2 shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Dev View</span>
        {(['clinic-admin', 'veterinarian', 'pet-owner'] as const).map((role) => (
          <button
            key={role}
            onClick={() => setDevRole(role)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              devRole === role
                ? 'bg-[#7FA5A3] text-white border-[#7FA5A3] scale-105 shadow-sm'
                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            {role === 'clinic-admin' ? '🏥 Clinic Admin' : role === 'veterinarian' ? '🩺 Veterinarian' : '🐾 Pet Owner'}
          </button>
        ))}
      </div>
      {/* END TEMP */}

      {devRole === 'clinic-admin' ? (
        <ClinicAdminBilling />
      ) : devRole === 'veterinarian' ? (
        <VetBilling />
      ) : (
        <PetOwnerBilling />
      )}
    </DashboardLayout>
  )
}