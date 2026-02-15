'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Users,
  Building2,
  Clock,
  PawPrint,
  Search,
  UserPlus,
  Plus,
  Trash2,
  Edit2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ==================== TYPES ====================

interface Veterinarian {
  id: string
  name: string
  email: string
  initials: string
  role: 'ADMIN' | 'VET' | 'STAFF'
  branch: string
  prcLicense: string
  status: 'Active' | 'On Leave'
  activePatients: number
}

interface Branch {
  id: string
  name: string
  address: string
  isMain: boolean
  vets: number
  patients: number
  today: number
  phone: string
  hours: string
  email: string
  isOpen: boolean
  city: string
  province: string
  openingTime: string
  closingTime: string
  operatingDays: string
}

// ==================== MOCK DATA ====================

const mockStats = [
  { label: 'Total Veterinarians', value: '8', icon: Users, color: 'bg-green-50', iconColor: 'text-green-600' },
  { label: 'Active Branches', value: '3', icon: Building2, color: 'bg-blue-50', iconColor: 'text-blue-600' },
  { label: 'Pending Applications', value: '2', icon: Clock, color: 'bg-yellow-50', iconColor: 'text-yellow-600' },
  { label: 'Total Patients', value: '1,247', icon: PawPrint, color: 'bg-purple-50', iconColor: 'text-purple-600' },
]

const initialVets: Veterinarian[] = [
  { id: '1', name: 'Dr. Gino Bailon', email: 'gino.bailon@baivet.com', initials: 'GB', role: 'ADMIN', branch: 'Main Branch', prcLicense: '0023456', status: 'Active', activePatients: 245 },
  { id: '2', name: 'Dr. Maria Santos', email: 'maria.santos@baivet.com', initials: 'MS', role: 'VET', branch: 'Main Branch', prcLicense: '0045678', status: 'Active', activePatients: 127 },
  { id: '3', name: 'Dr. Juan Reyes', email: 'juan.reyes@baivet.com', initials: 'JR', role: 'VET', branch: 'Makati Branch', prcLicense: '0034521', status: 'Active', activePatients: 98 },
  { id: '4', name: 'Dr. Ana Castro', email: 'ana.castro@baivet.com', initials: 'AC', role: 'VET', branch: 'BGC Branch', prcLicense: '0056789', status: 'Active', activePatients: 156 },
  { id: '5', name: 'Dr. Paolo Luna', email: 'paolo.luna@baivet.com', initials: 'PL', role: 'VET', branch: 'Makati Branch', prcLicense: '0067890', status: 'Active', activePatients: 87 },
  { id: '6', name: 'Dr. Rosa Cruz', email: 'rosa.cruz@baivet.com', initials: 'RC', role: 'STAFF', branch: 'Main Branch', prcLicense: '0078901', status: 'Active', activePatients: 0 },
  { id: '7', name: 'Dr. Miguel Valdez', email: 'miguel.valdez@baivet.com', initials: 'MV', role: 'VET', branch: 'BGC Branch', prcLicense: '0089012', status: 'On Leave', activePatients: 64 },
  { id: '8', name: 'Dr. Sofia Lim', email: 'sofia.lim@baivet.com', initials: 'SL', role: 'VET', branch: 'Main Branch', prcLicense: '0090123', status: 'Active', activePatients: 112 },
]

const initialBranches: Branch[] = [
  { id: '1', name: 'BaiVet Main Clinic', address: '123 Veterinary Street, Quezon City, Metro Manila', isMain: true, vets: 4, patients: 523, today: 5, phone: '+63 2 8123 4567', hours: 'Mon-Sat: 8:00 AM - 8:00 PM', email: 'main@baivet.com', isOpen: true, city: 'Quezon City', province: 'Metro Manila', openingTime: '08:00 AM', closingTime: '08:00 PM', operatingDays: 'Mon-Sat' },
  { id: '2', name: 'BaiVet Makati', address: '456 Pet Care Avenue, Makati City, Metro Manila', isMain: false, vets: 2, patients: 412, today: 4, phone: '+63 2 8765 4321', hours: 'Mon-Sat: 9:00 AM - 7:00 PM', email: 'makati@baivet.com', isOpen: true, city: 'Makati City', province: 'Metro Manila', openingTime: '09:00 AM', closingTime: '07:00 PM', operatingDays: 'Mon-Sat' },
  { id: '3', name: 'BaiVet BGC', address: '789 High Street, BGC, Taguig City, Metro Manila', isMain: false, vets: 2, patients: 312, today: 3, phone: '+63 2 8234 5678', hours: 'Mon-Sun: 10:00 AM - 9:00 PM', email: 'bgc@baivet.com', isOpen: false, city: 'Taguig City', province: 'Metro Manila', openingTime: '10:00 AM', closingTime: '09:00 PM', operatingDays: 'Mon-Sun' },
]

// ==================== ROLE BADGE ====================

function RoleBadge({ role }: { role: Veterinarian['role'] }) {
  const styles = {
    ADMIN: 'bg-[#476B6B] text-white',
    VET: 'bg-[#476B6B] text-white',
    STAFF: 'bg-[#7FA5A3] text-white',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${styles[role]}`}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: Veterinarian['status'] }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
      {status}
    </span>
  )
}

// ==================== MAIN COMPONENT ====================

export default function ClinicAdminDashboard() {
  const [activeTab, setActiveTab] = useState<'vets' | 'branches'>('vets')
  const [vets, setVets] = useState(initialVets)
  const [branches, setBranches] = useState(initialBranches)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [removeVetOpen, setRemoveVetOpen] = useState(false)
  const [selectedVet, setSelectedVet] = useState<Veterinarian | null>(null)
  const [editBranchOpen, setEditBranchOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [changeMainOpen, setChangeMainOpen] = useState(false)
  const [selectedMainBranchId, setSelectedMainBranchId] = useState<string>('')
  const [removeBranchOpen, setRemoveBranchOpen] = useState(false)
  const [branchToRemove, setBranchToRemove] = useState<Branch | null>(null)

  // Edit branch form
  const [editForm, setEditForm] = useState({
    name: '', address: '', city: '', province: '', phone: '', email: '', openingTime: '', closingTime: '', operatingDays: '',
  })

  const filteredVets = vets.filter(v => {
    const q = searchQuery.toLowerCase()
    return v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q)
  })

  const openEditBranch = (branch: Branch) => {
    setSelectedBranch(branch)
    setEditForm({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      province: branch.province,
      phone: branch.phone,
      email: branch.email,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      operatingDays: branch.operatingDays,
    })
    setEditBranchOpen(true)
  }

  const handleSaveBranch = () => {
    if (!selectedBranch) return
    setBranches(prev => prev.map(b =>
      b.id === selectedBranch.id ? { ...b, ...editForm, hours: `${editForm.operatingDays}: ${editForm.openingTime} - ${editForm.closingTime}` } : b
    ))
    setEditBranchOpen(false)
  }

  const openChangeMain = () => {
    const currentMain = branches.find(b => b.isMain)
    setSelectedMainBranchId(currentMain?.id || '')
    setChangeMainOpen(true)
  }

  const handleSetMainBranch = () => {
    setBranches(prev => prev.map(b => ({
      ...b,
      isMain: b.id === selectedMainBranchId,
    })))
    setChangeMainOpen(false)
  }

  const handleRemoveVet = () => {
    if (!selectedVet) return
    setVets(prev => prev.filter(v => v.id !== selectedVet.id))
    setRemoveVetOpen(false)
    setSelectedVet(null)
  }

  const handleRemoveBranch = () => {
    if (!branchToRemove) return
    setBranches(prev => prev.filter(b => b.id !== branchToRemove.id))
    setRemoveBranchOpen(false)
    setBranchToRemove(null)
  }

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-6 lg:p-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {mockStats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <p className="text-3xl font-bold text-[#4F4F4F]">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('vets')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'vets'
                ? 'bg-[#476B6B] text-white'
                : 'bg-white text-[#4F4F4F] hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Veterinarians
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'vets' ? 'bg-white/20' : 'bg-gray-200'}`}>
              {vets.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'branches'
                ? 'bg-[#476B6B] text-white'
                : 'bg-white text-[#4F4F4F] hover:bg-gray-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Branches
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'branches' ? 'bg-white/20' : 'bg-gray-200'}`}>
              {branches.length}
            </span>
          </button>
        </div>

        {/* ==================== VETERINARIANS TAB ==================== */}
        {activeTab === 'vets' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-[#4F4F4F]">Veterinarians</h2>
                <p className="text-gray-500 text-sm">Manage your clinic&apos;s veterinary staff</p>
              </div>
              <button className="flex items-center gap-2 bg-[#476B6B] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a5a5a] transition-colors text-sm font-medium">
                <UserPlus className="w-4 h-4" />
                Invite Veterinarian
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm mt-4">
              {/* Header */}
              <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <h3 className="font-semibold text-[#4F4F4F]">All Veterinarians</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] w-64"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Veterinarian</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRC License</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredVets.map((vet) => (
                      <tr key={vet.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#F1F0ED] rounded-full flex items-center justify-center shrink-0">
                              <span className="text-[#4F4F4F] font-medium text-sm">{vet.initials}</span>
                            </div>
                            <div>
                              <p className="font-medium text-[#4F4F4F] text-sm">{vet.name}</p>
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${vet.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
                                <p className="text-xs text-gray-500">{vet.email}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><RoleBadge role={vet.role} /></td>
                        <td className="px-6 py-4 text-sm text-[#4F4F4F]">{vet.branch}</td>
                        <td className="px-6 py-4 text-sm text-[#4F4F4F]">{vet.prcLicense}</td>
                        <td className="px-6 py-4"><StatusBadge status={vet.status} /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {vet.role !== 'ADMIN' && (
                              <>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { setSelectedVet(vet); setRemoveVetOpen(true) }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== BRANCHES TAB ==================== */}
        {activeTab === 'branches' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#4F4F4F]">Branches</h2>
                <p className="text-gray-500 text-sm">Manage your clinic locations</p>
              </div>
              <button className="flex items-center gap-2 bg-[#476B6B] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a5a5a] transition-colors text-sm font-medium">
                <Plus className="w-4 h-4" />
                Add Branch
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {branches.map((branch) => (
                <div key={branch.id} className={`bg-white rounded-2xl p-6 shadow-sm ${branch.isMain ? 'ring-2 ring-[#476B6B]' : ''}`}>
                  {/* Branch header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#F1F0ED] rounded-xl flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-[#4F4F4F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#4F4F4F]">{branch.name}</h3>
                        {branch.isMain && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#476B6B] text-white">
                            MAIN
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {branch.address}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-3 mb-4">
                    <div className="bg-[#F8F6F2] rounded-xl px-4 py-3 flex-1 text-center">
                      <p className="text-xl font-bold text-[#4F4F4F]">{branch.vets}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Vets</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl px-4 py-3 flex-1 text-center">
                      <p className="text-xl font-bold text-[#4F4F4F]">{branch.patients}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Patients</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl px-4 py-3 flex-1 text-center">
                      <p className="text-xl font-bold text-[#4F4F4F]">{branch.today}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Today</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-2 mb-4 text-sm text-[#4F4F4F]">
                    <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {branch.phone}</p>
                    <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-gray-400" /> {branch.hours}</p>
                    <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {branch.email}</p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className={`flex items-center gap-1.5 text-sm font-medium ${branch.isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${branch.isOpen ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {branch.isOpen ? 'Currently Open' : 'Closed'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditBranch(branch)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {!branch.isMain && (
                        <>
                          <button
                            onClick={openChangeMain}
                            className="px-3 py-1.5 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                          >
                            Set as Main
                          </button>
                          <button
                            onClick={() => { setBranchToRemove(branch); setRemoveBranchOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add New Branch Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[300px] cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2]/50 transition-colors">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <p className="font-semibold text-[#4F4F4F]">Add New Branch</p>
                <p className="text-sm text-gray-400 mt-1">Expand your clinic network</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== REMOVE VET MODAL ==================== */}
      <Dialog open={removeVetOpen} onOpenChange={setRemoveVetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#4F4F4F]">
              Remove Veterinarian
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">Remove this veterinarian?</h3>
            <p className="text-sm text-gray-500">
              They will lose access to the clinic system. Their patient records will be preserved.
            </p>
          </div>

          {selectedVet && (
            <div className="bg-[#F8F6F2] rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-[#4F4F4F]">{selectedVet.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Branch</span>
                <span className="font-medium text-[#4F4F4F]">{selectedVet.branch}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Active Patients</span>
                <span className="font-medium text-[#4F4F4F]">{selectedVet.activePatients} patients</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setRemoveVetOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveVet}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
            >
              Remove Veterinarian
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== EDIT BRANCH MODAL ==================== */}
      <Dialog open={editBranchOpen} onOpenChange={setEditBranchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Edit Branch</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Branch Name <span className="text-red-500">*</span></label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Street Address <span className="text-red-500">*</span></label>
              <input type="text" value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">City <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.city} onChange={(e) => setEditForm({...editForm, city: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Province/Region <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.province} onChange={(e) => setEditForm({...editForm, province: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Phone Number <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Email Address <span className="text-red-500">*</span></label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Opening Time <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.openingTime} onChange={(e) => setEditForm({...editForm, openingTime: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Closing Time <span className="text-red-500">*</span></label>
                <input type="text" value={editForm.closingTime} onChange={(e) => setEditForm({...editForm, closingTime: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Operating Days <span className="text-red-500">*</span></label>
              <select
                value={editForm.operatingDays}
                onChange={(e) => setEditForm({...editForm, operatingDays: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm bg-white"
              >
                <option value="Mon-Fri">Monday - Friday</option>
                <option value="Mon-Sat">Monday - Saturday</option>
                <option value="Mon-Sun">Monday - Sunday</option>
                <option value="Custom Schedule">Custom Schedule</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setEditBranchOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveBranch} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors">
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== CHANGE MAIN BRANCH MODAL ==================== */}
      <Dialog open={changeMainOpen} onOpenChange={setChangeMainOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Change Main Branch</DialogTitle>
          </DialogHeader>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">Important Notice</p>
                <p className="text-xs text-amber-700 mt-1">
                  Changing the main branch will update the primary contact information displayed to pet owners. The current main branch will become a regular branch.
                </p>
              </div>
            </div>
          </div>

          {/* Branch selection */}
          <div className="mt-4">
            <p className="text-sm font-medium text-[#4F4F4F] mb-3">Select New Main Branch</p>
            <div className="space-y-2">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    selectedMainBranchId === branch.id
                      ? 'border-amber-400 bg-amber-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="mainBranch"
                    checked={selectedMainBranchId === branch.id}
                    onChange={() => setSelectedMainBranchId(branch.id)}
                    className="w-4 h-4 text-[#476B6B] focus:ring-[#476B6B]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#4F4F4F] text-sm">{branch.name}</span>
                      {branch.isMain && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">CURRENT MAIN</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setChangeMainOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSetMainBranch} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors">
              Set as Main Branch
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== REMOVE BRANCH MODAL ==================== */}
      <Dialog open={removeBranchOpen} onOpenChange={setRemoveBranchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Remove Branch</DialogTitle>
          </DialogHeader>

          <div className="text-center py-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">Remove this branch?</h3>
            <p className="text-sm text-gray-500">
              This action cannot be undone. All staff assigned to this branch will need to be reassigned.
            </p>
          </div>

          {branchToRemove && (
            <>
              <div className="bg-[#F8F6F2] rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Branch Name</span>
                  <span className="font-medium text-[#4F4F4F]">{branchToRemove.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Assigned Vets</span>
                  <span className="font-medium text-[#4F4F4F]">{branchToRemove.vets} veterinarians</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active Patients</span>
                  <span className="font-medium text-[#4F4F4F]">{branchToRemove.patients} patients</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 text-sm">Before Removing</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Please reassign all veterinarians and transfer patient records to another branch before removing.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setRemoveBranchOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleRemoveBranch} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
              Remove Branch
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
