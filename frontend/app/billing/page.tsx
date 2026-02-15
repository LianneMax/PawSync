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
  status: 'Paid' | 'Pending' | 'Overdue'
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
  { id: '4', client: 'Alyssa Mansueto', patient: 'Pichi', service: 'Vaccination', date: 'Feb 1, 2026', amount: 'Php 2,000', status: 'Pending' },
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

// ==================== VET VIEW ====================

function VetBilling() {
  const [searchQuery, setSearchQuery] = useState('')

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create New Billing</h2>
            <p className="text-gray-600 mb-6">This modal will contain the form to create a new billing record.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-[#4F4F4F]">Cancel</button>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg hover:bg-[#6A8E8C] transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Edit Billing Record</h2>
            <p className="text-gray-600 mb-4">Editing record for: <strong>{editingRecord.client}</strong> - {editingRecord.patient}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowEditModal(false); setEditingRecord(null) }} className="px-4 py-2 text-[#4F4F4F]">Cancel</button>
              <button onClick={() => { setShowEditModal(false); setEditingRecord(null) }} className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg hover:bg-[#6A8E8C] transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function BillingInvoicing() {
  const user = useAuthStore((state) => state.user)
  const userType = user?.userType || 'pet-owner'

  return (
    <DashboardLayout>
      {userType === 'clinic-admin' ? (
        <ClinicAdminBilling />
      ) : userType === 'veterinarian' ? (
        <VetBilling />
      ) : (
        <PetOwnerBilling />
      )}
    </DashboardLayout>
  )
}
