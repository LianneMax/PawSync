'use client'

import React, { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, 
  Plus, 
  Trash2, 
  Filter, 
  Edit2, 
  ChevronDown,
  Receipt,
  Download
} from 'lucide-react'

// Types
interface BillingRecord {
  id: string
  client: string
  patient: string
  veterinarian: string
  branchAvailed: string
  amountDue: string
  status: 'Awaiting Approval' | 'Paid' | 'Pending Payment'
}

// Sample data
const initialBillingData: BillingRecord[] = [
  {
    id: '1',
    client: 'Lianne Balbastro',
    patient: 'Oscar',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Awaiting Approval'
  },
  {
    id: '2',
    client: 'Lianne Balbastro',
    patient: 'Orbit',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Paid'
  },
  {
    id: '3',
    client: 'Juls Lammoglia',
    patient: 'Sylvester',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Pending Payment'
  },
  {
    id: '4',
    client: 'Miguel Reano',
    patient: 'Rojo',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Paid'
  },
  {
    id: '5',
    client: 'Alyssa Mansueto',
    patient: 'Pichi',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Pending Payment'
  },
  {
    id: '6',
    client: 'Miguel Reano',
    patient: 'Blue',
    veterinarian: 'Dr. DoLittle',
    branchAvailed: 'Dr. DoLittle',
    amountDue: 'Php 1000',
    status: 'Awaiting Approval'
  }
]

const BillingInvoicing: React.FC = () => {
  const [billingData, setBillingData] = useState<BillingRecord[]>(initialBillingData)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Search functionality
  const filteredData = billingData.filter(record => {
    const searchLower = searchQuery.toLowerCase()
    return (
      record.client.toLowerCase().includes(searchLower) ||
      record.patient.toLowerCase().includes(searchLower) ||
      record.id.toLowerCase().includes(searchLower)
    )
  })

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedRecords)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRecords(newSelected)
  }

  // Toggle all selections
  const toggleAllSelections = () => {
    if (selectedRecords.size === filteredData.length) {
      setSelectedRecords(new Set())
    } else {
      setSelectedRecords(new Set(filteredData.map(r => r.id)))
    }
  }

  // Delete selected records
  const handleDelete = () => {
    if (selectedRecords.size === 0) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedRecords.size} record(s)?`
    )
    
    if (confirmed) {
      setBillingData(billingData.filter(record => !selectedRecords.has(record.id)))
      setSelectedRecords(new Set())
    }
  }

  // Open edit modal
  const handleEdit = (record: BillingRecord) => {
    setEditingRecord(record)
    setShowEditModal(true)
  }

  // Get status badge style
  const getStatusStyle = (status: BillingRecord['status']) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-700'
      case 'Pending Payment':
        return 'bg-blue-100 text-blue-700'
      case 'Awaiting Approval':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <DashboardLayout userType="clinic-admin" notificationCount={12}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing and Invoicing</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Invoices Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Invoices</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-5 h-5" />
                Filter
              </button>
            </div>

            {/* Create New Billing Button */}
            <div className="mb-6 flex justify-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-6 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Billing
              </button>
            </div>
            {/* Search and Actions Bar */}
            <div className="mb-4 flex items-center justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter a Client, Patients Name or ID Tag"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={selectedRecords.size === 0}
                  className="inline-flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
                <button
                  className="inline-flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

            {/* Table */}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Client <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Patient <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Veterinarian <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Branch Availed <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Amount Due <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Status <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Action <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((record) => (
                    <tr 
                      key={record.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={() => toggleSelection(record.id)}
                          className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-[#7FA5A3] hover:text-[#6A8E8C] cursor-pointer underline">
                          {record.client}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {record.patient}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {record.veterinarian}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {record.branchAvailed}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {record.amountDue}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(record.status)}`}>
                          ● {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleEdit(record)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
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
                  <p className="text-sm text-gray-400">
                    Try adjusting your search or create a new billing record.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create New Billing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Create New Billing</h2>
            <p className="text-gray-600 mb-6">
              This modal will contain the form to create a new billing record.
              Connect to your backend API here.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Connect to backend
                  console.log('Create billing record')
                  setShowCreateModal(false)
                }}
                className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg hover:bg-[#6A8E8C] transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Billing Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Edit Billing Record</h2>
            <p className="text-gray-600 mb-4">
              Editing record for: <strong>{editingRecord.client}</strong> - {editingRecord.patient}
            </p>
            <p className="text-gray-600 mb-6">
              This modal will contain the form to edit the billing record.
              Connect to your backend API here.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingRecord(null)
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Connect to backend
                  console.log('Update billing record:', editingRecord)
                  setShowEditModal(false)
                  setEditingRecord(null)
                }}
                className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg hover:bg-[#6A8E8C] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default BillingInvoicing