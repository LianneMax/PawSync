'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import {
  Search, UserPlus, RefreshCw, Mail, Phone, PawPrint,
  CheckCircle, Clock, AlertCircle, Send, X, User, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getClinicPetOwners,
  createPetOwnerProfile,
  resendPetOwnerInvite,
  type ClinicPetOwner,
  type OwnerInviteStatus,
} from '@/lib/clinics'

// ==================== HELPERS ====================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ==================== STATUS BADGE ====================

const STATUS_CONFIG: Record<OwnerInviteStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  invited: {
    label: 'Invited',
    classes: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: <Send className="w-3 h-3" />,
  },
  resent: {
    label: 'Resent',
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  expired: {
    label: 'Expired',
    classes: 'bg-red-50 text-red-700 border border-red-200',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  activated: {
    label: 'Activated',
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    icon: <CheckCircle className="w-3 h-3" />,
  },
}

function StatusBadge({ status }: { status: OwnerInviteStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ==================== CREATE OWNER MODAL ====================

interface CreateOwnerModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  token: string | null
}

function CreateOwnerModal({ open, onClose, onCreated, token }: CreateOwnerModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setContactNumber('')
    setFieldErrors({})
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'Required'
    if (!lastName.trim()) errors.lastName = 'Required'
    if (!email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address'
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})
    setLoading(true)
    try {
      const res = await createPetOwnerProfile(
        { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), contactNumber: contactNumber.trim() || undefined },
        token ?? undefined
      )
      if (res.status === 'SUCCESS') {
        toast.success('Profile created and invite sent successfully.')
        reset()
        onCreated()
        onClose()
      } else {
        toast.error(res.message || 'Failed to create profile.')
      }
    } catch {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-[#4F4F4F]">Create Client Profile</h2>
            <p className="text-xs text-gray-400 mt-0.5">An activation invite will be sent to their email.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1">First Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFieldErrors(p => ({ ...p, firstName: '' })) }}
                placeholder="e.g. Maria"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${fieldErrors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1">Last Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setFieldErrors(p => ({ ...p, lastName: '' })) }}
                placeholder="e.g. Santos"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${fieldErrors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4F4F4F] mb-1">Email Address <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })) }}
                placeholder="client@email.com"
                className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
            </div>
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4F4F4F] mb-1">Contact Number <span className="text-gray-400 font-normal">(optional)</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 09171234567"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending Invite…</>
                : <><Send className="w-4 h-4" />Send Invite</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==================== MAIN PAGE ====================

type StatusFilter = 'All' | OwnerInviteStatus

export default function ClientsPage() {
  const token = useAuthStore((state) => state.token)

  const [owners, setOwners] = useState<ClinicPetOwner[]>([])
  const [filtered, setFiltered] = useState<ClinicPetOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const fetchOwners = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await getClinicPetOwners(token)
      if (res.status === 'SUCCESS' && res.data?.owners) {
        setOwners(res.data.owners)
        setFiltered(res.data.owners)
      } else {
        setOwners([]); setFiltered([])
      }
    } catch {
      toast.error('Failed to load clients.')
      setOwners([]); setFiltered([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const applyFilters = (data: ClinicPetOwner[], status: StatusFilter, query: string) => {
    let result = data
    if (status !== 'All') result = result.filter((o) => o.inviteStatus === status)
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (o) =>
          o.firstName.toLowerCase().includes(q) ||
          o.lastName.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          (o.contactNumber || '').includes(q)
      )
    }
    setFiltered(result)
  }

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status)
    applyFilters(owners, status, searchQuery)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(owners, statusFilter, query)
  }

  const handleResend = async (owner: ClinicPetOwner) => {
    setResendingId(owner.id)
    try {
      const res = await resendPetOwnerInvite(owner.id, token ?? undefined)
      if (res.status === 'SUCCESS') {
        toast.success(`Invite resent to ${owner.email}.`)
        fetchOwners()
      } else {
        toast.error(res.message || 'Failed to resend invite.')
      }
    } catch {
      toast.error('An error occurred. Please try again.')
    } finally {
      setResendingId(null)
    }
  }

  useEffect(() => { fetchOwners() }, [fetchOwners])

  // Status counts for filter pills
  const counts = owners.reduce<Record<string, number>>((acc, o) => {
    acc[o.inviteStatus] = (acc[o.inviteStatus] ?? 0) + 1
    return acc
  }, {})

  const STATUS_FILTERS: StatusFilter[] = ['All', 'invited', 'resent', 'expired', 'activated']

  const canResend = (status: OwnerInviteStatus) => status === 'expired' || status === 'invited' || status === 'resent'

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 w-full max-w-none h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            title="Clients"
            subtitle="Manage pet owner profiles and track onboarding status"
          />
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Client
          </button>
        </div>

        {/* Status Filter Pills */}
        <div className="mb-6 flex items-center gap-3 overflow-x-auto min-w-0">
          <span className="text-sm font-semibold text-[#2D5353] shrink-0">Status:</span>
          <div className="inline-flex bg-white border border-[#DCEAE3] rounded-full p-1 gap-1 min-w-max">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-white/70'
                }`}
              >
                {s === 'All' ? 'All' : STATUS_CONFIG[s as OwnerInviteStatus].label}
                {s !== 'All' && counts[s] !== undefined && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    statusFilter === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-md flex-1 w-full max-w-none">
          {/* Search + Actions */}
          <div className="bg-white px-6 py-5 border-b border-[#EAECF0] shadow-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or contact number"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>
              <button
                onClick={fetchOwners}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
            <span>Client</span>
            <span>Contact</span>
            <span>Pets</span>
            <span>Invite Sent</span>
            <span>Status</span>
            <span></span>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <User className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 mb-2">No clients found</h3>
                <p className="text-gray-400 text-sm text-center">
                  {owners.length === 0
                    ? 'No client profiles have been created yet. Click "Add Client" to get started.'
                    : 'Try adjusting your filters or search query.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((owner) => (
                  <div
                    key={owner.id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Mobile layout */}
                    <div className="lg:hidden space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#4F4F4F]">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {owner.email}
                          </p>
                          {owner.contactNumber && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {owner.contactNumber}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={owner.inviteStatus} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <PawPrint className="w-3 h-3" />
                            {owner.petCount} pet{owner.petCount !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(owner.lastInviteSentAt)}
                          </span>
                        </div>
                        {canResend(owner.inviteStatus) && (
                          <button
                            onClick={() => handleResend(owner)}
                            disabled={resendingId === owner.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#476B6B] border border-[#476B6B] rounded-lg hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50"
                          >
                            {resendingId === owner.id
                              ? <div className="w-3 h-3 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                              : <RefreshCw className="w-3 h-3" />}
                            Resend
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.5fr_1.5fr_auto] gap-4 items-center">
                      {/* Client */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-[#7FA5A3]/15 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-[#476B6B]">
                            {owner.firstName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#4F4F4F] truncate">
                            {owner.firstName} {owner.lastName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{owner.email}</p>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="min-w-0">
                        {owner.contactNumber
                          ? <p className="text-sm text-[#4F4F4F]">{owner.contactNumber}</p>
                          : <p className="text-sm text-gray-300">—</p>}
                      </div>

                      {/* Pets */}
                      <div className="flex items-center gap-1.5 text-sm text-[#4F4F4F]">
                        <PawPrint className="w-4 h-4 text-[#7FA5A3]" />
                        {owner.petCount}
                      </div>

                      {/* Invite Sent */}
                      <div>
                        <p className="text-sm text-[#4F4F4F]">{formatDate(owner.lastInviteSentAt)}</p>
                        {owner.inviteStatus === 'activated' && owner.activatedAt && (
                          <p className="text-xs text-gray-400">Activated {formatDate(owner.activatedAt)}</p>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <StatusBadge status={owner.inviteStatus} />
                      </div>

                      {/* Action */}
                      <div className="flex justify-end">
                        {canResend(owner.inviteStatus) ? (
                          <button
                            onClick={() => handleResend(owner)}
                            disabled={resendingId === owner.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#476B6B] border border-[#476B6B] rounded-lg hover:bg-[#476B6B]/5 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {resendingId === owner.id
                              ? <div className="w-3 h-3 border-2 border-[#476B6B] border-t-transparent rounded-full animate-spin" />
                              : <RefreshCw className="w-3 h-3" />}
                            Resend Invite
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 px-3 py-1.5">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
              <p className="text-xs text-gray-400">
                Showing {filtered.length} of {owners.length} client{owners.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Owner Modal */}
      <CreateOwnerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchOwners}
        token={token}
      />
    </DashboardLayout>
  )
}
