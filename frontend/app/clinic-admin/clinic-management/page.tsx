'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
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
  ChevronDown,
  Check,
} from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'
import { getCitiesByProvince, getPhilippineProvinces } from '@/lib/philippineLocations'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ==================== TYPES ====================

interface Veterinarian {
  id: string
  branchId: string
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
  isActive: boolean
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

// ==================== MOCK DATA (fallback) ====================

const emptyVets: Veterinarian[] = []
const emptyBranches: Branch[] = []

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

export default function ClinicManagementPage() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const isMainBranch = user?.isMainBranch ?? false

  const [activeTab, setActiveTab] = useState<'vets' | 'branches'>('vets')
  const [vets, setVets] = useState(emptyVets)
  const [branches, setBranches] = useState(emptyBranches)
  const [searchQuery, setSearchQuery] = useState('')
  const [vetBranchFilter, setVetBranchFilter] = useState<string>('all')
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinicEmail, setClinicEmail] = useState<string>('')
  const [loadingVets, setLoadingVets] = useState(true)
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchStats, setBranchStats] = useState<Record<string, { vets: number; patients: number; appointments: number }>>({})
  const [loadingStats, setLoadingStats] = useState(false)

  // Invite vet modal states
  const [inviteVetOpen, setInviteVetOpen] = useState(false)
  const [allVets, setAllVets] = useState<{ _id: string; firstName: string; lastName: string; email: string; currentBranch: string | null }[]>([])
  const [loadingAllVets, setLoadingAllVets] = useState(false)
  const [inviteVetSearch, setInviteVetSearch] = useState('')
  const [invitingVetId, setInvitingVetId] = useState<string | null>(null)
  const [inviteSuccessVetId, setInviteSuccessVetId] = useState<string | null>(null)
  const [inviteErrorMsg, setInviteErrorMsg] = useState<string | null>(null)

  // Modal states
  const [removeVetOpen, setRemoveVetOpen] = useState(false)
  const [selectedVet, setSelectedVet] = useState<Veterinarian | null>(null)
  const [editBranchOpen, setEditBranchOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [removeBranchOpen, setRemoveBranchOpen] = useState(false)
  const [branchToRemove, setBranchToRemove] = useState<Branch | null>(null)
  const [removeBranchStats, setRemoveBranchStats] = useState<{ vets: number; patients: number } | null>(null)
  const [removeBranchLoading, setRemoveBranchLoading] = useState(false)
  const [transferToBranchId, setTransferToBranchId] = useState('')
  const [reassignVetsToBranchId, setReassignVetsToBranchId] = useState('')
  const [addBranchOpen, setAddBranchOpen] = useState(false)
  const [addingBranch, setAddingBranch] = useState(false)
  const [editIs24h, setEditIs24h] = useState(false)
  const [addIs24h, setAddIs24h] = useState(false)

  // Edit branch form
  const [editForm, setEditForm] = useState({
    name: '', address: '', city: '', province: '', phone: '', email: '', openingTime: '', closingTime: '', operatingDays: [] as string[],
  })

  // Add branch form (simplified — no adminFirstName/adminLastName)
  const [addForm, setAddForm] = useState({
    name: '', address: '', city: '', province: '', phone: '', email: '', openingTime: '', closingTime: '', operatingDays: [] as string[],
    adminPassword: '',
  })
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({})
  const [addFormTouched, setAddFormTouched] = useState<Record<string, boolean>>({})

  // OTP states
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpError, setOtpError] = useState('')

  // Main branch email (fetched from branches list)
  const mainBranchEmail = branches.find(b => b.isMain)?.email ?? ''

  const normalizePhoneToE164 = (phone?: string | null) => {
    const raw = (phone || '').trim()
    if (!raw) return ''
    if (raw.startsWith('+63')) return raw
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('63')) return `+${digits}`
    if (digits.startsWith('0')) return `+63${digits.slice(1)}`
    return `+63${digits}`
  }

  const validateAddField = (field: string, value: string | string[]): string => {
    switch (field) {
      case 'name':
        return (value as string).trim() ? '' : 'Branch name is required.'
      case 'address':
        return (value as string).trim() ? '' : 'Street address is required.'
      case 'city':
        return (value as string).trim() ? '' : 'City is required.'
      case 'province':
        return (value as string).trim() ? '' : 'Province/Region is required.'
      case 'phone':
        if (!(value as string).trim()) return 'Phone number is required.'
        return /^[0-9+\-\s()]{7,15}$/.test(value as string) ? '' : 'Enter a valid phone number.'
      case 'email':
        if (!(value as string).trim()) return 'Email address is required.'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) ? '' : 'Enter a valid email address.'
      case 'openingTime':
        return (value as string).trim() ? '' : 'Opening time is required.'
      case 'closingTime':
        return (value as string).trim() ? '' : 'Closing time is required.'
      case 'operatingDays':
        return (value as string[]).length > 0 ? '' : 'Select at least one operating day.'
      case 'adminPassword':
        if (!(value as string).trim()) return 'Password is required.'
        return (value as string).length >= 8 ? '' : 'Password must be at least 8 characters.'
      default:
        return ''
    }
  }

  const touchAddField = (field: string) => {
    setAddFormTouched(prev => ({ ...prev, [field]: true }))
    const value = addForm[field as keyof typeof addForm]
    setAddFormErrors(prev => ({ ...prev, [field]: validateAddField(field, value as string | string[]) }))
  }

  const validateAllAddFields = () => {
    const requiredFields = ['name', 'address', 'city', 'province', 'phone', 'email', 'openingTime', 'closingTime', 'operatingDays', 'adminPassword']
    const errors: Record<string, string> = {}
    const touched: Record<string, boolean> = {}
    for (const field of requiredFields) {
      const value = addForm[field as keyof typeof addForm]
      errors[field] = validateAddField(field, value as string | string[])
      touched[field] = true
    }
    setAddFormErrors(errors)
    setAddFormTouched(touched)
    return Object.values(errors).every(e => !e)
  }

  const handleSendOtp = async () => {
    if (!token) return
    const emailErr = validateAddField('email', addForm.email)
    if (emailErr) {
      setAddFormErrors(prev => ({ ...prev, email: emailErr }))
      setAddFormTouched(prev => ({ ...prev, email: true }))
      return
    }
    setSendingOtp(true)
    setOtpError('')
    try {
      const res = await authenticatedFetch('/clinics/branch-otp/send', {
        method: 'POST',
        body: JSON.stringify({ email: addForm.email, branchName: addForm.name || undefined }),
      }, token)
      if (res.status === 'SUCCESS') {
        // Don't reset otpValue if OTP was already sent (reuse flow — keep whatever they typed)
        setOtpModalOpen(true)
        setOtpError('')
      } else {
        setAddFormErrors(prev => ({ ...prev, email: res.message || 'Failed to send OTP.' }))
        setAddFormTouched(prev => ({ ...prev, email: true }))
      }
    } catch {
      setAddFormErrors(prev => ({ ...prev, email: 'Failed to send OTP. Please try again.' }))
      setAddFormTouched(prev => ({ ...prev, email: true }))
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!token) return
    if (!otpValue.trim()) { setOtpError('Please enter the OTP.'); return }
    setVerifyingOtp(true)
    setOtpError('')
    try {
      const res = await authenticatedFetch('/clinics/branch-otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email: addForm.email, otp: otpValue.trim() }),
      }, token)
      if (res.status === 'SUCCESS') {
        setOtpVerified(true)
        setOtpModalOpen(false)
      } else {
        setOtpError(res.message || 'Incorrect OTP.')
      }
    } catch {
      setOtpError('Failed to verify OTP. Please try again.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Fetch real clinic data
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return

      try {
        // Get clinic ID first
        const clinicsRes = await authenticatedFetch('/clinics/mine', {}, token)
        if (clinicsRes.status === 'SUCCESS' && clinicsRes.data.clinics.length > 0) {
          const myClinic = clinicsRes.data.clinics[0]
          setClinicId(myClinic._id)
          const resolvedClinicEmail: string = myClinic.email || ''
          if (resolvedClinicEmail) setClinicEmail(resolvedClinicEmail)

          // Fetch vets and branches in parallel
          const [vetsRes, branchesRes] = await Promise.all([
            authenticatedFetch('/clinics/mine/vets', {}, token),
            authenticatedFetch(`/clinics/${myClinic._id}/branches?includeInactive=true`, {}, token),
          ])

          if (vetsRes.status === 'SUCCESS') {
            const apiVets: Veterinarian[] = (vetsRes.data.vets || []).map((v: { _id: string; clinicBranchId?: string; name: string; email: string; initials: string; branch: string; prcLicense: string; status: string }) => ({
              id: v._id,
              branchId: v.clinicBranchId || '',
              name: v.name,
              email: v.email,
              initials: v.initials,
              role: 'VET' as const,
              branch: v.branch,
              prcLicense: v.prcLicense,
              status: (v.status || 'Active') as 'Active' | 'On Leave',
              activePatients: 0,
            }))
            setVets(apiVets)
          }

          if (branchesRes.status === 'SUCCESS') {
            const apiBranches: Branch[] = (branchesRes.data.branches || []).map((b: { _id: string; name: string; address: string; isMain: boolean; isActive?: boolean; phone: string; email: string; city: string; province: string; openingTime: string; closingTime: string; operatingDays: string[] }) => ({
              id: b._id,
              name: b.name,
              address: b.address || '',
              isMain: b.isMain,
              isActive: !!b.isActive,
              vets: 0,
              patients: 0,
              today: 0,
              phone: b.phone || '',
              hours: b.openingTime && b.closingTime ? `${b.openingTime} - ${b.closingTime}` : '-',
              email: b.email || (b.isMain ? (resolvedClinicEmail || user?.email || '') : ''),
              isOpen: !!b.isActive,
              city: b.city || '',
              province: b.province || '',
              openingTime: b.openingTime || '',
              closingTime: b.closingTime || '',
              operatingDays: (b.operatingDays || []).join(', '),
            }))
            setBranches(apiBranches)

            // Fetch statistics for each branch
            setLoadingStats(true)
            try {
              const statsMap: Record<string, { vets: number; patients: number; appointments: number }> = {}
              await Promise.all(
                apiBranches.map(async (branch) => {
                  try {
                    const statsRes = await authenticatedFetch(`/clinics/${myClinic._id}/branches/${branch.id}/stats`, {}, token)
                    if (statsRes.status === 'SUCCESS') {
                      statsMap[branch.id] = statsRes.data.stats
                    }
                  } catch (err) {
                    console.error(`Failed to fetch stats for branch ${branch.id}:`, err)
                  }
                })
              )
              setBranchStats(statsMap)
            } catch (err) {
              console.error('Failed to fetch branch stats:', err)
            } finally {
              setLoadingStats(false)
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch clinic data:', err)
      } finally {
        setLoadingVets(false)
        setLoadingBranches(false)
      }
    }

    fetchData()
  }, [token])

  const filteredVets = vets.filter(v => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q)
    const matchesBranch = !isMainBranch || vetBranchFilter === 'all' || v.branchId === vetBranchFilter
    return matchesSearch && matchesBranch
  })

  const activeBranchesCount = branches.filter((b) => b.isActive).length
  const allProvinceOptions = getPhilippineProvinces()
  const editProvinceOptions = editForm.province && !allProvinceOptions.includes(editForm.province)
    ? [editForm.province, ...allProvinceOptions]
    : allProvinceOptions
  const editCityOptions = editForm.province ? getCitiesByProvince(editForm.province) : []
  const addProvinceOptions = addForm.province && !allProvinceOptions.includes(addForm.province)
    ? [addForm.province, ...allProvinceOptions]
    : allProvinceOptions
  const addCityOptions = addForm.province ? getCitiesByProvince(addForm.province) : []

  const openEditBranch = async (branch: Branch) => {
    setSelectedBranch(branch)
    setEditBranchOpen(true)

    // Populate immediately from cached state so the modal opens fast
    const cachedDays = branch.operatingDays ? branch.operatingDays.split(', ').filter(Boolean) : []
    const cachedIs24h = branch.openingTime === '00:00' && branch.closingTime === '23:59' && cachedDays.length === 7
    setEditIs24h(cachedIs24h)
    setEditForm({
      name: branch.name,
      address: branch.address,
      city: branch.city,
      province: branch.province,
      phone: normalizePhoneToE164(branch.phone),
      email: branch.email,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      operatingDays: cachedDays,
    })

    // Then re-fetch the branch from the DB to get the latest values (especially email)
    if (!clinicId || !token) return
    try {
      const res = await authenticatedFetch(`/clinics/${clinicId}/branches/${branch.id}`, {}, token)
      if (res.status === 'SUCCESS' && res.data?.branch) {
        const b = res.data.branch
        const days = (b.operatingDays || []) as string[]
        const is24h = b.openingTime === '00:00' && b.closingTime === '23:59' && days.length === 7
        setEditIs24h(is24h)
        const freshEmail = b.email || (b.isMain ? (clinicEmail || user?.email || '') : '') || ''
        setEditForm({
          name: b.name || '',
          address: b.address || '',
          city: b.city || '',
          province: b.province || '',
          phone: normalizePhoneToE164(b.phone),
          email: freshEmail,
          openingTime: b.openingTime || '',
          closingTime: b.closingTime || '',
          operatingDays: days,
        })
        // Sync the selectedBranch with fresh isMain flag
        setSelectedBranch(prev => prev ? { ...prev, isMain: b.isMain, email: freshEmail } : prev)
      }
    } catch (err) {
      console.error('Failed to refresh branch data for edit:', err)
    }
  }

  const handleSaveBranch = async () => {
    if (!selectedBranch || !clinicId || !token) return
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        address: editForm.address,
        city: editForm.city || null,
        province: editForm.province || null,
        phone: editForm.phone || null,
        openingTime: editForm.openingTime || null,
        closingTime: editForm.closingTime || null,
        operatingDays: editForm.operatingDays,
      }
      const res = await authenticatedFetch(`/clinics/${clinicId}/branches/${selectedBranch.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }, token)
      if (res.status === 'SUCCESS') {
        const daysStr = editForm.operatingDays.join(', ')
        setBranches(prev => prev.map(b =>
          b.id === selectedBranch.id ? { ...b, ...editForm, operatingDays: daysStr, hours: editForm.openingTime && editForm.closingTime ? `${editForm.openingTime} - ${editForm.closingTime}` : '-' } : b
        ))
        setEditBranchOpen(false)
      } else {
        console.error('Failed to update branch:', res.message)
      }
    } catch (err) {
      console.error('Failed to update branch:', err)
    }
  }

  const handleRemoveVet = () => {
    if (!selectedVet) return
    setVets(prev => prev.filter(v => v.id !== selectedVet.id))
    setRemoveVetOpen(false)
    setSelectedVet(null)
  }

  const openRemoveBranch = async (branch: Branch) => {
    setBranchToRemove(branch)
    setRemoveBranchStats(null)
    setTransferToBranchId('')
    setReassignVetsToBranchId('')
    setRemoveBranchOpen(true)
    if (!clinicId || !token) return
    setRemoveBranchLoading(true)
    try {
      const statsRes = await authenticatedFetch(`/clinics/${clinicId}/branches/${branch.id}/stats`, {}, token)
      if (statsRes.status === 'SUCCESS') {
        setRemoveBranchStats({ vets: statsRes.data.stats.vets, patients: statsRes.data.stats.patients })
      }
    } finally {
      setRemoveBranchLoading(false)
    }
  }

  const handleRemoveBranch = async () => {
    if (!branchToRemove || !clinicId || !token) return
    try {
      const body: Record<string, string> = {}
      if (reassignVetsToBranchId) body.reassignVetsToBranchId = reassignVetsToBranchId
      if (transferToBranchId) body.transferToBranchId = transferToBranchId
      const res = await authenticatedFetch(`/clinics/${clinicId}/branches/${branchToRemove.id}`, {
        method: 'DELETE',
        body: JSON.stringify(body),
      }, token)
      if (res.status === 'SUCCESS') {
        setBranches(prev => prev.filter(b => b.id !== branchToRemove.id))
        setRemoveBranchOpen(false)
        setBranchToRemove(null)
      } else {
        console.error('Failed to delete branch:', res.message)
      }
    } catch (err) {
      console.error('Failed to delete branch:', err)
    }
  }

  const resetAddForm = () => {
    setAddForm({ name: '', address: '', city: '', province: '', phone: '', email: '', openingTime: '', closingTime: '', operatingDays: [], adminPassword: '' })
    setAddFormErrors({})
    setAddFormTouched({})
    setAddIs24h(false)
    setOtpVerified(false)
    setOtpModalOpen(false)
    setOtpValue('')
    setOtpError('')
  }

  const handleAddBranch = async () => {
    if (!clinicId || !token) return
    if (!validateAllAddFields()) return

    if (!otpVerified) {
      setAddFormErrors(prev => ({ ...prev, email: 'Please verify the branch email with an OTP before saving.' }))
      setAddFormTouched(prev => ({ ...prev, email: true }))
      return
    }

    setAddingBranch(true)
    try {
      // Single request — branch + admin user created atomically on the backend
      const res = await authenticatedFetch(`/clinics/${clinicId}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          name: addForm.name,
          address: addForm.address,
          city: addForm.city || null,
          province: addForm.province || null,
          phone: addForm.phone || null,
          email: addForm.email || null,
          openingTime: addForm.openingTime || null,
          closingTime: addForm.closingTime || null,
          operatingDays: addForm.operatingDays,
          isMain: false,
          adminPassword: addForm.adminPassword,
        }),
      }, token)

      if (res.status === 'SUCCESS' && res.data?.branch) {
        const b = res.data.branch
        setBranches(prev => [...prev, {
          id: b._id,
          name: b.name,
          address: b.address || '',
          isMain: b.isMain,
          isActive: !!b.isActive,
          vets: 0,
          patients: 0,
          today: 0,
          phone: b.phone || '',
          hours: b.openingTime && b.closingTime ? `${b.openingTime} - ${b.closingTime}` : '-',
          email: b.email || '',
          isOpen: !!b.isActive,
          city: b.city || '',
          province: b.province || '',
          openingTime: b.openingTime || '',
          closingTime: b.closingTime || '',
          operatingDays: (b.operatingDays || []).join(', '),
        }])
        setAddBranchOpen(false)
        resetAddForm()
      } else {
        setAddFormErrors(prev => ({ ...prev, general: res.message || 'Failed to create branch' }))
      }
    } catch (err) {
      console.error('Failed to add branch:', err)
    } finally {
      setAddingBranch(false)
    }
  }

  const handleOpenInviteModal = async () => {
    setInviteVetOpen(true)
    setInviteVetSearch('')
    setInviteSuccessVetId(null)
    setInviteErrorMsg(null)
    setLoadingAllVets(true)
    try {
      const res = await authenticatedFetch('/clinics/mine/registered-vets', {}, token ?? undefined)
      if (res.status === 'SUCCESS') {
        setAllVets(res.data.vets || [])
      }
    } catch (err) {
      console.error('Failed to fetch registered vets:', err)
    } finally {
      setLoadingAllVets(false)
    }
  }

  const handleInviteVet = async (vetId: string) => {
    const branchId = user?.clinicBranchId
    if (!branchId) {
      setInviteErrorMsg('Could not determine your current branch. Please refresh and try again.')
      return
    }
    setInvitingVetId(vetId)
    setInviteErrorMsg(null)
    try {
      const res = await authenticatedFetch('/clinics/mine/invite-vet', {
        method: 'POST',
        body: JSON.stringify({ vetId, branchId }),
      }, token ?? undefined)
      if (res.status === 'SUCCESS') {
        setInviteSuccessVetId(vetId)
      } else {
        setInviteErrorMsg(res.message || 'Failed to send invitation.')
      }
    } catch (err) {
      console.error('Failed to invite vet:', err)
      setInviteErrorMsg('An unexpected error occurred.')
    } finally {
      setInvitingVetId(null)
    }
  }

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-6 lg:p-8">
        <PageHeader
          title="Clinic Management"
          subtitle="Manage veterinarians, branches, and clinic-wide administration"
          className="mb-8"
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-[#4F4F4F]">{vets.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Veterinarians</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-[#4F4F4F]">{activeBranchesCount}</p>
            <p className="text-sm text-gray-500 mt-1">Active Branches</p>
          </div>
        </div>

        {/* Tab Switcher - Pill Style */}
        <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm mb-8">
          <button
            onClick={() => setActiveTab('vets')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'vets'
                ? 'bg-[#476B6B] text-white shadow-sm'
                : 'text-[#4F4F4F] hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Veterinarians
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'vets' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {vets.length}
            </span>
          </button>
          {isMainBranch && (
            <button
              onClick={() => setActiveTab('branches')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'branches'
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Branches
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'branches' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {activeBranchesCount}
              </span>
            </button>
          )}
        </div>

        {/* ==================== VETERINARIANS TAB ==================== */}
        {activeTab === 'vets' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-[#4F4F4F]">Veterinarians</h2>
                <p className="text-gray-500 text-sm">Manage your clinic&apos;s veterinary staff</p>
              </div>
              <button
                onClick={handleOpenInviteModal}
                className="flex items-center gap-2 bg-[#476B6B] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a5a5a] transition-colors text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Invite Veterinarian
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm mt-4">
              {/* Header */}
              <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <h3 className="font-semibold text-[#4F4F4F]">All Veterinarians</h3>
                <div className="flex items-center gap-2">
                  {isMainBranch && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-between gap-2 min-w-[180px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-[#4F4F4F] hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                          aria-label="Filter vets by branch"
                        >
                          <span className="truncate">
                            {vetBranchFilter === 'all'
                              ? 'All Branches'
                              : (branches.find((branch) => branch.id === vetBranchFilter)?.isMain
                                  ? 'Main Branch'
                                  : branches.find((branch) => branch.id === vetBranchFilter)?.name || 'All Branches')}
                          </span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setVetBranchFilter('all')} className="flex items-center justify-between">
                          All Branches
                          {vetBranchFilter === 'all' && <Check className="w-4 h-4 text-[#476B6B]" />}
                        </DropdownMenuItem>
                        {branches.filter((branch) => branch.isActive).map((branch) => (
                          <DropdownMenuItem
                            key={branch.id}
                            onClick={() => setVetBranchFilter(branch.id)}
                            className="flex items-center justify-between"
                          >
                            {branch.isMain ? 'Main Branch' : branch.name}
                            {vetBranchFilter === branch.id && <Check className="w-4 h-4 text-[#476B6B]" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
              <button
                onClick={() => { resetAddForm(); setAddBranchOpen(true) }}
                className="flex items-center gap-2 bg-[#476B6B] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a5a5a] transition-colors text-sm font-medium"
              >
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
                      <p className="text-xl font-bold text-[#4F4F4F]">{branchStats[branch.id]?.vets ?? branch.vets}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Vets</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl px-4 py-3 flex-1 text-center">
                      <p className="text-xl font-bold text-[#4F4F4F]">{branchStats[branch.id]?.patients ?? branch.patients}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Patients</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl px-4 py-3 flex-1 text-center">
                      <p className="text-xl font-bold text-[#4F4F4F]">{branchStats[branch.id]?.appointments ?? branch.today}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Appointments</p>
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
                        <button
                          onClick={() => openRemoveBranch(branch)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add New Branch Card */}
              <div
                onClick={() => { resetAddForm(); setAddBranchOpen(true) }}
                className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center min-h-75 cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2]/50 transition-colors"
              >
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

      {/* ==================== INVITE VET MODAL ==================== */}
      <Dialog open={inviteVetOpen} onOpenChange={(v) => { if (!v) { setInviteVetOpen(false); setInviteSuccessVetId(null); setInviteErrorMsg(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#4F4F4F]">
              <UserPlus className="w-5 h-5 text-[#476B6B]" />
              Invite Veterinarian
            </DialogTitle>
          </DialogHeader>

          {/* Read-only current branch display */}
          <div className="mt-2 flex items-center gap-3 bg-[#F8F6F2] px-4 py-3 rounded-xl">
            <Building2 className="w-4 h-4 text-[#7FA5A3] shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Inviting to Branch</p>
              <p className="text-sm font-semibold text-[#4F4F4F]">
                {branches.find(b => b.id === user?.clinicBranchId)?.name || 'Current Branch'}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={inviteVetSearch}
              onChange={(e) => setInviteVetSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
          </div>

          {/* Error message */}
          {inviteErrorMsg && (
            <p className="text-sm text-red-500 mt-1">{inviteErrorMsg}</p>
          )}

          {/* Vet list */}
          <div className="mt-2 max-h-80 overflow-y-auto space-y-2 pr-1">
            {loadingAllVets ? (
              <div className="text-center py-8 text-sm text-gray-400">Loading veterinarians...</div>
            ) : allVets.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">No registered veterinarians found.</div>
            ) : (
              allVets
                .filter((v) => {
                  const q = inviteVetSearch.toLowerCase()
                  return `${v.firstName} ${v.lastName}`.toLowerCase().includes(q) || v.email.toLowerCase().includes(q)
                })
                .map((vet) => {
                  const alreadySent = inviteSuccessVetId === vet._id
                  return (
                    <div key={vet._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/60">
                      <div className="w-9 h-9 bg-[#F1F0ED] rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[#4F4F4F] font-medium text-xs">
                          {vet.firstName[0]}{vet.lastName[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#4F4F4F] truncate">Dr. {vet.firstName} {vet.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{vet.email}</p>
                        {vet.currentBranch && (
                          <p className="text-xs text-[#7FA5A3] truncate">Current: {vet.currentBranch}</p>
                        )}
                      </div>
                      {alreadySent ? (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg shrink-0">Sent!</span>
                      ) : (
                        <button
                          onClick={() => handleInviteVet(vet._id)}
                          disabled={invitingVetId === vet._id}
                          className="text-xs font-medium text-white bg-[#476B6B] hover:bg-[#3a5a5a] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                        >
                          {invitingVetId === vet._id ? 'Sending...' : 'Invite'}
                        </button>
                      )}
                    </div>
                  )
                })
            )}
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => { setInviteVetOpen(false); setInviteSuccessVetId(null); setInviteErrorMsg(null) }}
              className="px-5 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
      <Dialog open={editBranchOpen} onOpenChange={(v) => { if (!v) { setEditIs24h(false); setEditBranchOpen(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-[#4F4F4F]">Edit Branch</DialogTitle>
          </DialogHeader>

          {/* Read-only main branch email */}
          {mainBranchEmail && selectedBranch && !selectedBranch.isMain && (
            <div className="mt-2 flex items-center gap-3 bg-[#F8F6F2] px-4 py-3 rounded-xl">
              <Mail className="w-4 h-4 text-[#7FA5A3] shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Main Branch Email (read-only)</p>
                <p className="text-sm font-medium text-[#4F4F4F]">{mainBranchEmail}</p>
              </div>
            </div>
          )}

          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Branch Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Street Address <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">City</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={!editForm.province}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#4F4F4F] bg-white hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-between"
                    >
                      <span className="truncate">{editForm.city || 'Select city'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {editCityOptions.map((city) => (
                      <DropdownMenuItem key={city} onSelect={() => setEditForm({ ...editForm, city })} className="flex items-center justify-between">
                        {city}
                        {editForm.city === city && <Check className="w-4 h-4 text-[#476B6B]" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Province/Region</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#4F4F4F] bg-white hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                    >
                      <span className="truncate">{editForm.province || 'Select province'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {editProvinceOptions.map((province) => (
                      <DropdownMenuItem
                        key={province}
                        onSelect={() => {
                          const nextCities = getCitiesByProvince(province)
                          setEditForm((prev) => ({
                            ...prev,
                            province,
                            city: nextCities.includes(prev.city) ? prev.city : '',
                          }))
                        }}
                        className="flex items-center justify-between"
                      >
                        {province}
                        {editForm.province === province && <Check className="w-4 h-4 text-[#476B6B]" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Phone Number</label>
              <PhoneInput
                value={editForm.phone}
                onChange={(value) => setEditForm({ ...editForm, phone: value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
                Branch Email Address
                <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
              </label>
              <input
                type="email"
                value={editForm.email || clinicEmail || user?.email || ''}
                readOnly
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 cursor-not-allowed text-gray-500"
              />
            </div>

            {/* Open 24/7 checkbox */}
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={editIs24h}
                onChange={(e) => {
                  const checked = e.target.checked
                  setEditIs24h(checked)
                  if (checked) {
                    setEditForm(prev => ({
                      ...prev,
                      openingTime: '00:00',
                      closingTime: '23:59',
                      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    }))
                  }
                }}
                className="w-4 h-4 rounded accent-[#476B6B]"
              />
              <div>
                <span className="text-sm font-medium text-[#4F4F4F]">Open 24/7</span>
                <p className="text-xs text-gray-400 mt-0.5">Automatically selects all days and sets hours to midnight–midnight</p>
              </div>
            </label>

            <div className={`grid grid-cols-2 gap-4 transition-opacity ${editIs24h ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Opening Time <span className="text-red-500">*</span></label>
                <input type="time" value={editForm.openingTime} onChange={(e) => setEditForm({...editForm, openingTime: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Closing Time <span className="text-red-500">*</span></label>
                <input type="time" value={editForm.closingTime} onChange={(e) => setEditForm({...editForm, closingTime: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm" />
              </div>
            </div>
            <div className={`transition-opacity ${editIs24h ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Operating Days <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const isSelected = editForm.operatingDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setEditForm(prev => ({
                          ...prev,
                          operatingDays: isSelected
                            ? prev.operatingDays.filter(d => d !== day)
                            : [...prev.operatingDays, day],
                        }))
                      }}
                      className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-[#4F4F4F] border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-white">
            <button onClick={() => setEditBranchOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveBranch} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors">
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== ADD BRANCH MODAL ==================== */}
      <Dialog open={addBranchOpen} onOpenChange={(v) => { if (!v) { setAddBranchOpen(false); resetAddForm() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-[#4F4F4F]">Add New Branch</DialogTitle>
          </DialogHeader>

          {/* Main branch email notification info */}
          {mainBranchEmail && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl mt-2 text-sm text-blue-700">
              <Mail className="w-4 h-4 mt-0.5 shrink-0" />
              <p>A notification will be sent to the main branch at <strong>{mainBranchEmail}</strong> when this branch is added.</p>
            </div>
          )}

          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Branch Name */}
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Branch Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => {
                  setAddForm({ ...addForm, name: e.target.value })
                  if (addFormTouched.name) setAddFormErrors(prev => ({ ...prev, name: validateAddField('name', e.target.value) }))
                }}
                onBlur={() => touchAddField('name')}
                placeholder="e.g. PawSync Makati Branch"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.name && addFormErrors.name ? 'border-red-400' : 'border-gray-200'}`}
              />
              {addFormTouched.name && addFormErrors.name && <p className="text-xs text-red-500 mt-1">{addFormErrors.name}</p>}
            </div>

            {/* Street Address */}
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Street Address <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addForm.address}
                onChange={(e) => {
                  setAddForm({ ...addForm, address: e.target.value })
                  if (addFormTouched.address) setAddFormErrors(prev => ({ ...prev, address: validateAddField('address', e.target.value) }))
                }}
                onBlur={() => touchAddField('address')}
                placeholder="e.g. 123 Main St, Brgy. San Antonio"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.address && addFormErrors.address ? 'border-red-400' : 'border-gray-200'}`}
              />
              {addFormTouched.address && addFormErrors.address && <p className="text-xs text-red-500 mt-1">{addFormErrors.address}</p>}
            </div>

            {/* City / Province */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">City <span className="text-red-500">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={!addForm.province}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm bg-white hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between ${
                        addFormTouched.city && addFormErrors.city ? 'border-red-400 text-[#4F4F4F]' : 'border-gray-200 text-[#4F4F4F]'
                      } disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
                    >
                      <span className="truncate">{addForm.city || 'Select city'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {addCityOptions.map((city) => (
                      <DropdownMenuItem
                        key={city}
                        onSelect={() => {
                          setAddForm({ ...addForm, city })
                          if (addFormTouched.city) setAddFormErrors(prev => ({ ...prev, city: validateAddField('city', city) }))
                        }}
                        className="flex items-center justify-between"
                      >
                        {city}
                        {addForm.city === city && <Check className="w-4 h-4 text-[#476B6B]" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {addFormTouched.city && addFormErrors.city && <p className="text-xs text-red-500 mt-1">{addFormErrors.city}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Province/Region <span className="text-red-500">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm bg-white hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between ${
                        addFormTouched.province && addFormErrors.province ? 'border-red-400 text-[#4F4F4F]' : 'border-gray-200 text-[#4F4F4F]'
                      }`}
                    >
                      <span className="truncate">{addForm.province || 'Select province'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {addProvinceOptions.map((province) => (
                      <DropdownMenuItem
                        key={province}
                        onSelect={() => {
                          const nextCities = getCitiesByProvince(province)
                          const nextCity = nextCities.includes(addForm.city) ? addForm.city : ''
                          setAddForm({ ...addForm, province, city: nextCity })
                          if (addFormTouched.province) setAddFormErrors(prev => ({ ...prev, province: validateAddField('province', province) }))
                          if (addFormTouched.city) setAddFormErrors(prev => ({ ...prev, city: validateAddField('city', nextCity) }))
                        }}
                        className="flex items-center justify-between"
                      >
                        {province}
                        {addForm.province === province && <Check className="w-4 h-4 text-[#476B6B]" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {addFormTouched.province && addFormErrors.province && <p className="text-xs text-red-500 mt-1">{addFormErrors.province}</p>}
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Phone Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={addForm.phone}
                onChange={(e) => {
                  setAddForm({ ...addForm, phone: e.target.value })
                  if (addFormTouched.phone) setAddFormErrors(prev => ({ ...prev, phone: validateAddField('phone', e.target.value) }))
                }}
                onBlur={() => touchAddField('phone')}
                placeholder="e.g. 0917-123-4567"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.phone && addFormErrors.phone ? 'border-red-400' : 'border-gray-200'}`}
              />
              {addFormTouched.phone && addFormErrors.phone && <p className="text-xs text-red-500 mt-1">{addFormErrors.phone}</p>}
            </div>

            {/* Email Address + OTP */}
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Branch Email Address <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => {
                    setAddForm({ ...addForm, email: e.target.value })
                    setOtpVerified(false)
                    if (addFormTouched.email) setAddFormErrors(prev => ({ ...prev, email: validateAddField('email', e.target.value) }))
                  }}
                  onBlur={() => touchAddField('email')}
                  placeholder="e.g. branch@clinic.com"
                  className={`flex-1 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.email && addFormErrors.email ? 'border-red-400' : otpVerified ? 'border-green-400' : 'border-gray-200'}`}
                />
                {otpVerified ? (
                  <span className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl shrink-0">
                    ✓ Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || !addForm.email.trim()}
                    className="px-3 py-2 text-xs font-medium text-white bg-[#476B6B] hover:bg-[#3a5a5a] rounded-xl transition-colors disabled:opacity-50 shrink-0"
                  >
                    {sendingOtp ? 'Sending...' : 'Send OTP'}
                  </button>
                )}
              </div>
              {addFormTouched.email && addFormErrors.email && <p className="text-xs text-red-500 mt-1">{addFormErrors.email}</p>}
              {!otpVerified && addForm.email && !addFormErrors.email && (
                <p className="text-xs text-amber-600 mt-1">Click &quot;Send OTP&quot; to verify this email before saving.</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Password <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={addForm.adminPassword}
                onChange={(e) => {
                  setAddForm({ ...addForm, adminPassword: e.target.value })
                  if (addFormTouched.adminPassword) setAddFormErrors(prev => ({ ...prev, adminPassword: validateAddField('adminPassword', e.target.value) }))
                }}
                onBlur={() => touchAddField('adminPassword')}
                placeholder="Min. 8 characters"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.adminPassword && addFormErrors.adminPassword ? 'border-red-400' : 'border-gray-200'}`}
              />
              {addFormTouched.adminPassword && addFormErrors.adminPassword && <p className="text-xs text-red-500 mt-1">{addFormErrors.adminPassword}</p>}
              <p className="text-xs text-gray-400 mt-1">This password will be used to log in as the branch admin.</p>
            </div>

            {/* Open 24/7 checkbox */}
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={addIs24h}
                onChange={(e) => {
                  const checked = e.target.checked
                  setAddIs24h(checked)
                  if (checked) {
                    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    setAddForm(prev => ({ ...prev, openingTime: '00:00', closingTime: '23:59', operatingDays: allDays }))
                    setAddFormErrors(prev => ({ ...prev, openingTime: '', closingTime: '', operatingDays: '' }))
                  }
                }}
                className="w-4 h-4 rounded accent-[#476B6B]"
              />
              <div>
                <span className="text-sm font-medium text-[#4F4F4F]">Open 24/7</span>
                <p className="text-xs text-gray-400 mt-0.5">Automatically selects all days and sets hours to midnight–midnight</p>
              </div>
            </label>

            <div className={`grid grid-cols-2 gap-4 transition-opacity ${addIs24h ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Opening Time <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  value={addForm.openingTime}
                  onChange={(e) => {
                    setAddForm({ ...addForm, openingTime: e.target.value })
                    if (addFormTouched.openingTime) setAddFormErrors(prev => ({ ...prev, openingTime: validateAddField('openingTime', e.target.value) }))
                  }}
                  onBlur={() => touchAddField('openingTime')}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.openingTime && addFormErrors.openingTime ? 'border-red-400' : 'border-gray-200'}`}
                />
                {addFormTouched.openingTime && addFormErrors.openingTime && <p className="text-xs text-red-500 mt-1">{addFormErrors.openingTime}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Closing Time <span className="text-red-500">*</span></label>
                <input
                  type="time"
                  value={addForm.closingTime}
                  onChange={(e) => {
                    setAddForm({ ...addForm, closingTime: e.target.value })
                    if (addFormTouched.closingTime) setAddFormErrors(prev => ({ ...prev, closingTime: validateAddField('closingTime', e.target.value) }))
                  }}
                  onBlur={() => touchAddField('closingTime')}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-sm ${addFormTouched.closingTime && addFormErrors.closingTime ? 'border-red-400' : 'border-gray-200'}`}
                />
                {addFormTouched.closingTime && addFormErrors.closingTime && <p className="text-xs text-red-500 mt-1">{addFormErrors.closingTime}</p>}
              </div>
            </div>
            <div className={`transition-opacity ${addIs24h ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Operating Days <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const isSelected = addForm.operatingDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? addForm.operatingDays.filter(d => d !== day)
                          : [...addForm.operatingDays, day]
                        setAddForm(prev => ({ ...prev, operatingDays: updated }))
                        setAddFormTouched(prev => ({ ...prev, operatingDays: true }))
                        setAddFormErrors(prev => ({ ...prev, operatingDays: validateAddField('operatingDays', updated) }))
                      }}
                      className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'bg-[#476B6B] text-white border-[#476B6B]'
                          : 'bg-white text-[#4F4F4F] border-gray-200 hover:border-[#7FA5A3]'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              {addFormTouched.operatingDays && addFormErrors.operatingDays && <p className="text-xs text-red-500 mt-1">{addFormErrors.operatingDays}</p>}
            </div>
          </div>

          {addFormErrors.general && (
            <div className="mx-6 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {addFormErrors.general}
            </div>
          )}

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-white">
            <button
              onClick={() => { setAddBranchOpen(false); resetAddForm() }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddBranch}
              disabled={addingBranch || !otpVerified}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors disabled:opacity-50"
            >
              {addingBranch ? 'Adding...' : 'Add Branch'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== OTP VERIFICATION MODAL ==================== */}
      <Dialog open={otpModalOpen} onOpenChange={(v) => { if (!v) { setOtpModalOpen(false); setOtpValue(''); setOtpError('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#4F4F4F]">
              <Mail className="w-5 h-5 text-[#476B6B]" />
              Verify Branch Email
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-gray-500">
              A 6-digit verification code was sent to <strong className="text-[#4F4F4F]">{addForm.email}</strong>. Enter it below to confirm the email address.
            </p>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Verification Code</label>
              <input
                type="text"
                value={otpValue}
                onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError('') }}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] text-lg tracking-widest text-center font-mono ${otpError ? 'border-red-400' : 'border-gray-200'}`}
              />
              {otpError && <p className="text-xs text-red-500 mt-1">{otpError}</p>}
            </div>
            <p className="text-xs text-gray-400">
              Code expires in 10 minutes.{' '}
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp}
                className="text-[#476B6B] underline disabled:opacity-50"
              >
                {sendingOtp ? 'Resending...' : 'Resend code'}
              </button>
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setOtpModalOpen(false); setOtpValue(''); setOtpError('') }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyOtp}
              disabled={verifyingOtp || otpValue.length < 6}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#476B6B] rounded-xl hover:bg-[#3a5a5a] transition-colors disabled:opacity-50"
            >
              {verifyingOtp ? 'Verifying...' : 'Verify'}
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
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">Remove this branch?</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>

          {branchToRemove && (
            <>
              {/* Stats */}
              <div className="bg-[#F8F6F2] rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Branch Name</span>
                  <span className="font-medium text-[#4F4F4F]">{branchToRemove.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Assigned Vets</span>
                  <span className="font-medium text-[#4F4F4F]">
                    {removeBranchLoading ? '—' : (removeBranchStats?.vets ?? branchToRemove.vets)} veterinarians
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active Patients</span>
                  <span className="font-medium text-[#4F4F4F]">
                    {removeBranchLoading ? '—' : (removeBranchStats?.patients ?? branchToRemove.patients)} patients
                  </span>
                </div>
              </div>

              {/* Vet reassignment — only shown if there are vets */}
              {!removeBranchLoading && (removeBranchStats?.vets ?? 0) > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
                    Reassign all vets to <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reassignVetsToBranchId}
                    onChange={(e) => setReassignVetsToBranchId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                  >
                    <option value="">Select a branch...</option>
                    {branches.filter(b => b.id !== branchToRemove.id).map(b => (
                      <option key={b.id} value={b.id}>{b.name}{b.isMain ? ' (Main)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Record transfer — only shown if there are patients */}
              {!removeBranchLoading && (removeBranchStats?.patients ?? 0) > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
                    Transfer patient records to <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={transferToBranchId}
                    onChange={(e) => setTransferToBranchId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                  >
                    <option value="">Select a branch...</option>
                    {branches.filter(b => b.id !== branchToRemove.id).map(b => (
                      <option key={b.id} value={b.id}>{b.name}{b.isMain ? ' (Main)' : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Medical records and vaccination records will be reassigned to this branch.</p>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setRemoveBranchOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleRemoveBranch}
              disabled={
                removeBranchLoading ||
                ((removeBranchStats?.vets ?? 0) > 0 && !reassignVetsToBranchId) ||
                ((removeBranchStats?.patients ?? 0) > 0 && !transferToBranchId)
              }
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Branch
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
