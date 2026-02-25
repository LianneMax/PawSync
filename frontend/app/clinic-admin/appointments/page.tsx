'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  getClinicAppointments,
  getAvailableSlots,
  createClinicAppointment,
  searchPetOwners,
  getPetsForOwner,
  cancelAppointment,
  rescheduleAppointment,
  type Appointment,
  type TimeSlot,
  type PetOwner,
} from '@/lib/appointments'
import {
  getVetsForBranch,
  type BranchVet,
} from '@/lib/clinics'
import { authenticatedFetch } from '@/lib/auth'
import {
  Calendar,
  Plus,
  Clock,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Video,
  Users,
  Check,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'

// ==================== CONSTANTS ====================

const appointmentModes = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'face-to-face', label: 'Face to Face', icon: Users },
]

const faceToFaceTypes = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'check-up', label: 'Check Up' },
]

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-l-green-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' },
}

// ==================== HELPERS ====================

function formatSlotTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m} ${ampm}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generateMockSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = 7; h < 17; h++) {
    const hStr = h.toString().padStart(2, '0')
    const nextH = (h + 1).toString().padStart(2, '0')
    slots.push({ startTime: `${hStr}:00`, endTime: `${hStr}:30`, status: 'available' })
    slots.push({ startTime: `${hStr}:30`, endTime: `${nextH}:00`, status: 'available' })
  }
  slots[0].status = 'unavailable'
  slots[7].status = 'unavailable'
  slots[12].status = 'unavailable'
  return slots
}

// ==================== DROPDOWN COMPONENT ====================

function Dropdown({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled,
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onSelect: (val: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div>
      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">{label}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          className={`w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl text-left text-sm transition-colors ${
            disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white hover:border-[#7FA5A3]'
          }`}
        >
          <span className={selected ? 'text-[#4F4F4F]' : 'text-gray-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(opt.value); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors ${
                  opt.value === value ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium' : 'text-[#4F4F4F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== OWNER SEARCH COMPONENT ====================

function OwnerSearch({
  value,
  onSelect,
  token,
}: {
  value: PetOwner | null
  onSelect: (owner: PetOwner | null) => void
  token: string | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PetOwner[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchPetOwners(query, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setResults(res.data.owners)
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, token])

  return (
    <div>
      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Owner name</p>
      <div className="relative">
        {value ? (
          <div className="flex items-center justify-between px-4 py-2.5 border border-[#7FA5A3] rounded-xl bg-[#7FA5A3]/5">
            <span className="text-sm text-[#4F4F4F] font-medium">
              {value.firstName} {value.lastName}
              <span className="text-gray-400 font-normal ml-2">{value.email}</span>
            </span>
            <button
              type="button"
              onClick={() => { onSelect(null); setQuery('') }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder="Search pet owner by name or email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] transition-colors"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {open && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                {results.map((owner) => (
                  <button
                    key={owner._id}
                    type="button"
                    onClick={() => { onSelect(owner); setOpen(false); setQuery('') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors text-[#4F4F4F]"
                  >
                    <span className="font-medium">{owner.firstName} {owner.lastName}</span>
                    <span className="text-gray-400 ml-2">{owner.email}</span>
                  </button>
                ))}
              </div>
            )}
            {open && query.trim().length >= 2 && !loading && results.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3 text-sm text-gray-400">
                No pet owners found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ==================== CALENDAR GRID VIEW ====================

function CalendarGridView({
  appointments,
  selectedDate,
  onDateChange,
  vets,
}: {
  appointments: Appointment[]
  selectedDate: string
  onDateChange: (date: string) => void
  vets: BranchVet[]
}) {
  const hours = Array.from({ length: 11 }, (_, i) => i + 7) // 7AM to 5PM

  // Navigate date
  const goToDay = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    onDateChange(d.toISOString().split('T')[0])
  }

  const dateLabel = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Only show confirmed appointments for the selected date in the calendar view
  const confirmedAppointments = appointments.filter((a) => {
    if (a.status !== 'confirmed') return false
    // Match by date (compare YYYY-MM-DD)
    const apptDate = new Date(a.date).toISOString().split('T')[0]
    return apptDate === selectedDate
  })

  // Map appointments by vetId for quick lookup
  const apptMap: Record<string, Appointment[]> = {}
  confirmedAppointments.forEach((appt) => {
    const vetKey = appt.vetId?._id || 'unknown'
    if (!apptMap[vetKey]) apptMap[vetKey] = []
    apptMap[vetKey].push(appt)
  })

  const displayVets = vets.length > 0
    ? vets
    : Object.keys(apptMap).map((id) => {
        const appt = confirmedAppointments.find((a) => a.vetId?._id === id)
        return {
          _id: id,
          firstName: appt?.vetId?.firstName || 'Unknown',
          lastName: appt?.vetId?.lastName || '',
          email: appt?.vetId?.email || '',
        }
      })

  if (displayVets.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No veterinarians assigned to this clinic yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Date Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={() => goToDay(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-[#4F4F4F]">{dateLabel}</p>
        </div>
        <button onClick={() => goToDay(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Vet Headers */}
          <div className="flex border-b border-gray-100">
            {/* Time column header */}
            <div className="w-20 shrink-0 px-3 py-3 bg-gray-50" />
            {/* Vet columns */}
            {displayVets.map((vet) => (
              <div key={vet._id} className="flex-1 min-w-[160px] px-3 py-3 bg-gray-50 border-l border-gray-100 text-center">
                <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center mx-auto mb-1.5">
                  <span className="text-sm font-semibold text-[#5A7C7A]">
                    {vet.firstName?.[0]}{vet.lastName?.[0]}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Veterinarian</p>
              </div>
            ))}
          </div>

          {/* Time Rows */}
          {hours.map((hour) => {
            const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`

            return (
              <div key={hour} className="flex border-b border-gray-50 min-h-[64px]">
                {/* Time label */}
                <div className="w-20 shrink-0 px-3 py-2 text-right">
                  <span className="text-xs text-gray-400 font-medium">{timeLabel}</span>
                </div>
                {/* Vet columns */}
                {displayVets.map((vet) => {
                  const vetAppts = (apptMap[vet._id] || []).filter((a) => {
                    const apptHour = parseInt(a.startTime.split(':')[0])
                    return apptHour === hour
                  })

                  return (
                    <div key={vet._id} className="flex-1 min-w-[160px] px-2 py-1.5 border-l border-gray-100">
                      {vetAppts.map((appt) => {
                        const colors = statusColors[appt.status] || statusColors.pending
                        return (
                          <div
                            key={appt._id}
                            className={`rounded-lg px-2.5 py-1.5 mb-1 border-l-[3px] ${colors.border} ${colors.bg}`}
                          >
                            <p className="text-xs font-medium text-[#4F4F4F] truncate">
                              {appt.petId?.name || 'Pet'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">
                                {formatSlotTime(appt.startTime)}
                              </span>
                              <span className={`text-[10px] font-medium capitalize ${colors.text}`}>
                                {appt.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100 text-gray-500 capitalize">
                                {appt.mode === 'face-to-face' ? 'Face to Face' : 'Online'}
                              </span>
                              {appt.types.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 text-[9px] rounded bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                  {t.replace('-', ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 px-6 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-[10px] text-gray-500">Confirmed</span>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN PAGE ====================

interface ClinicBranchItem {
  _id: string
  name: string
  address: string
  isMain: boolean
}

interface ClinicInfo {
  _id: string
  name: string
}

export default function ClinicAdminAppointmentsPage() {
  const { token } = useAuthStore()
  const user = useAuthStore((state) => state.user)
  const isBranchAdmin = user?.userType === 'branch-admin'
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)

  // Clinic data
  const [clinic, setClinic] = useState<ClinicInfo | null>(null)
  const [branches, setBranches] = useState<ClinicBranchItem[]>([])
  const [allVets, setAllVets] = useState<BranchVet[]>([])

  // Calendar date
  const [calendarDate, setCalendarDate] = useState(() => new Date().toISOString().split('T')[0])

  // Load clinic + branches (only for clinic admins, branch admins only manage their branch)
  useEffect(() => {
    const load = async () => {
      try {
        const clinicRes = await authenticatedFetch('/clinics/mine', {}, token || undefined)
        if (clinicRes.status === 'SUCCESS' && clinicRes.data?.clinics?.length > 0) {
          const c = clinicRes.data.clinics[0]
          setClinic({ _id: c._id, name: c.name })

          // Only fetch branches for clinic admins
          if (!isBranchAdmin) {
            const branchRes = await authenticatedFetch(`/clinics/${c._id}/branches`, {}, token || undefined)
            if (branchRes.status === 'SUCCESS' && branchRes.data?.branches) {
              setBranches(branchRes.data.branches)
            }
          }
        }
      } catch { /* silent */ }
    }
    if (token) load()
  }, [token, isBranchAdmin])

  // Load all vets for the clinic (for calendar headers)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await authenticatedFetch('/clinics/mine/vets', {}, token || undefined)
        if (res.status === 'SUCCESS' && res.data?.vets) {
          setAllVets(res.data.vets.map((v: any) => ({
            _id: v.vetId || v._id,
            firstName: v.name?.replace('Dr. ', '').split(' ')[0] || '',
            lastName: v.name?.replace('Dr. ', '').split(' ').slice(1).join(' ') || '',
            email: v.email || '',
          })))
        }
      } catch { /* silent */ }
    }
    if (token) load()
  }, [token])

  // Load appointments (backend auto-filters by branch from JWT)
  const loadAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (viewMode === 'calendar') {
        params.filter = 'upcoming'
      } else {
        params.filter = activeTab
      }
      const res = await getClinicAppointments(params, token || undefined)
      if (res.status === 'SUCCESS' && res.data) {
        setAppointments(res.data.appointments)

        // On initial calendar load, auto-navigate to the first confirmed appointment's date
        if (viewMode === 'calendar' && res.data.appointments.length > 0) {
          const firstConfirmed = res.data.appointments.find((a) => a.status === 'confirmed')
          if (firstConfirmed) {
            const apptDate = new Date(firstConfirmed.date).toISOString().split('T')[0]
            setCalendarDate((prev) => {
              const today = new Date().toISOString().split('T')[0]
              return prev === today ? apptDate : prev
            })
          }
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [activeTab, viewMode, token])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  const handleCancel = async (id: string) => {
    try {
      const res = await cancelAppointment(id, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Appointment cancelled')
        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to cancel')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-8">
        {/* Header */}
        <div className="mb-2">
          <h1
            className="text-[32px] text-[#476B6B]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Appointments
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage and schedule appointments for your clinic</p>
        </div>

        {/* Tabs + Actions */}
        <div className="flex items-center justify-between mt-6 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveTab('upcoming'); setViewMode('calendar') }}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'upcoming'
                  ? 'bg-[#7FA5A3] text-white'
                  : 'bg-[#7FA5A3]/15 text-[#5A7C7A] hover:bg-[#7FA5A3]/25'
              }`}
            >
              Upcoming appointments
            </button>
            <button
              onClick={() => { setActiveTab('previous'); setViewMode('list') }}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'previous'
                  ? 'bg-[#7FA5A3] text-white'
                  : 'bg-[#7FA5A3]/15 text-[#5A7C7A] hover:bg-[#7FA5A3]/25'
              }`}
            >
              Previous appointments
            </button>

            {/* Branch name indicator */}
            {branches.length > 0 && (
              <span className="px-3 py-2 rounded-xl text-sm bg-[#F8F6F2] text-[#4F4F4F] font-medium">
                {branches[0]?.name || 'My Branch'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'upcoming' && (
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'calendar' ? 'bg-white shadow-sm text-[#4F4F4F]' : 'text-gray-500'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-[#4F4F4F]' : 'text-gray-500'
                  }`}
                >
                  List
                </button>
              </div>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-[#7FA5A3] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors"
            >
              Set an appointment
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === 'calendar' && activeTab === 'upcoming' ? (
          /* ---- CALENDAR VIEW ---- */
          <CalendarGridView
            appointments={appointments}
            selectedDate={calendarDate}
            onDateChange={setCalendarDate}
            vets={allVets}
          />
        ) : appointments.length > 0 ? (
          /* ---- LIST VIEW ---- */
          <div className="space-y-4">
            {appointments.map((appt) => (
              <div key={appt._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {appt.petId?.photo ? (
                    <img src={appt.petId.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                      <PawPrint className="w-6 h-6 text-[#5A7C7A]" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[#4F4F4F]">{appt.petId?.name || 'Pet'}</p>
                    <p className="text-xs text-gray-500">
                      Owner: {appt.ownerId?.firstName} {appt.ownerId?.lastName} &middot; Dr. {appt.vetId?.firstName} {appt.vetId?.lastName}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(appt.date)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatSlotTime(appt.startTime)} - {formatSlotTime(appt.endTime)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {appt.types.map((t) => (
                      <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">{t.replace('-', ' ')}</span>
                    ))}
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${
                    appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    appt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    appt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {appt.status}
                  </span>
                  {appt.status === 'confirmed' && activeTab === 'upcoming' && (
                    <button
                      onClick={() => handleCancel(appt._id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ---- EMPTY STATE ---- */
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              {activeTab === 'upcoming' ? (
                <>
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-6">No upcoming appointments</p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Set an Appointment
                  </button>
                </>
              ) : (
                <>
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No past appointments</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Appointment Modal */}
      <ClinicScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onBooked={(bookedDate) => {
          setModalOpen(false)
          // Navigate calendar to the booked appointment's date
          if (bookedDate) {
            setCalendarDate(bookedDate)
            setActiveTab('upcoming')
            setViewMode('calendar')
          }
          loadAppointments()
        }}
        clinic={clinic}
        branches={branches}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={() => {
          setRescheduleTarget(null)
          loadAppointments()
        }}
      />
    </DashboardLayout>
  )
}

// ==================== CLINIC SCHEDULE MODAL ====================

function ClinicScheduleModal({
  open,
  onClose,
  onBooked,
  clinic,
  branches,
}: {
  open: boolean
  onClose: () => void
  onBooked: (bookedDate?: string) => void
  clinic: ClinicInfo | null
  branches: ClinicBranchItem[]
}) {
  const { token } = useAuthStore()

  // Form state
  const [selectedOwner, setSelectedOwner] = useState<PetOwner | null>(null)
  const [ownerPets, setOwnerPets] = useState<{ _id: string; name: string; species: string; breed: string; photo: string | null }[]>([])
  const [branchVets, setBranchVets] = useState<BranchVet[]>([])
  const [loadingVets, setLoadingVets] = useState(false)
  const [loadingPets, setLoadingPets] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedVetId, setSelectedVetId] = useState('')
  const [mode, setMode] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load pets when owner changes
  useEffect(() => {
    if (!selectedOwner) { setOwnerPets([]); setSelectedPetId(''); return }
    const load = async () => {
      setLoadingPets(true)
      try {
        const res = await getPetsForOwner(selectedOwner._id, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setOwnerPets(res.data.pets)
        } else {
          setOwnerPets([])
        }
      } catch { setOwnerPets([]) }
      finally { setLoadingPets(false) }
    }
    load()
  }, [selectedOwner, token])

  // Load vets when branch changes
  useEffect(() => {
    if (!selectedBranchId) { setBranchVets([]); return }
    const load = async () => {
      setLoadingVets(true)
      try {
        const res = await getVetsForBranch(selectedBranchId, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setBranchVets(res.data.vets)
        } else {
          setBranchVets([])
        }
      } catch { setBranchVets([]) }
      finally { setLoadingVets(false) }
    }
    load()
  }, [selectedBranchId, token])

  // Load slots when vet + date change
  useEffect(() => {
    if (!selectedVetId || !selectedDate) { setSlots([]); return }
    const load = async () => {
      setLoadingSlots(true)
      try {
        const res = await getAvailableSlots(selectedVetId, selectedDate, token || undefined, selectedBranchId || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setSlots(res.data.slots)
        } else {
          setSlots(generateMockSlots())
        }
      } catch { setSlots(generateMockSlots()) }
      finally { setLoadingSlots(false) }
    }
    load()
  }, [selectedVetId, selectedDate, selectedBranchId, token])

  // Reset types when mode changes
  useEffect(() => {
    if (mode === 'online') {
      setSelectedTypes(['consultation'])
    } else {
      setSelectedTypes([])
    }
  }, [mode])

  // Reset vet when branch changes
  useEffect(() => {
    setSelectedVetId('')
    setSelectedSlot(null)
    setSlots([])
  }, [selectedBranchId])

  // Reset pet when owner changes
  useEffect(() => {
    setSelectedPetId('')
  }, [selectedOwner])

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setSelectedOwner(null)
      setOwnerPets([])
      setSelectedPetId('')
      setSelectedBranchId('')
      setSelectedVetId('')
      setMode('')
      setSelectedTypes([])
      setSelectedSlot(null)
      setSlots([])
      setBranchVets([])
    }
  }, [open])

  // Build branch options (only the admin's clinic branches)
  const branchOptions = branches.map((branch) => ({
    value: branch._id,
    label: branch.name,
  }))

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleSubmit = async () => {
    if (!selectedOwner) return toast.error('Please select a pet owner')
    if (!selectedPetId) return toast.error('Please select a pet')
    if (!selectedBranchId) return toast.error('Please select a clinic branch')
    if (!selectedVetId) return toast.error('Please select a veterinarian')
    if (!mode) return toast.error('Please select a mode of appointment')
    if (selectedTypes.length === 0) return toast.error('Please select at least one appointment type')
    if (!selectedSlot) return toast.error('Please select a time slot')

    setSubmitting(true)
    try {
      const res = await createClinicAppointment({
        ownerId: selectedOwner._id,
        petId: selectedPetId,
        vetId: selectedVetId,
        clinicId: clinic?._id || '',
        clinicBranchId: selectedBranchId,
        mode: mode as 'online' | 'face-to-face',
        types: selectedTypes,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      }, token || undefined)

      if (res.status === 'SUCCESS') {
        toast.success('Appointment booked successfully!')
        onBooked(selectedDate)
      } else {
        toast.error(res.message || 'Failed to book appointment')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by hour for the timetable
  const slotsByHour: Record<number, TimeSlot[]> = {}
  slots.forEach((s) => {
    const hour = parseInt(s.startTime.split(':')[0])
    if (!slotsByHour[hour]) slotsByHour[hour] = []
    slotsByHour[hour].push(s)
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[900px] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2">
          <h2 className="text-3xl font-bold text-[#2C3E2D]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
            Schedule Appointment
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex px-8 pb-8 pt-4 gap-8">
          {/* Left: Form Fields */}
          <div className="flex-1 space-y-5">
            {/* Owner Search (full width) */}
            <OwnerSearch
              value={selectedOwner}
              onSelect={setSelectedOwner}
              token={token}
            />

            {/* Row 1: Pet + Mode */}
            <div className="grid grid-cols-2 gap-4">
              {!selectedOwner ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Select pet</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    Select an owner first
                  </div>
                </div>
              ) : loadingPets ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Select pet</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                    Loading pets...
                  </div>
                </div>
              ) : ownerPets.length === 0 ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Select pet</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    No pets found for this owner
                  </div>
                </div>
              ) : (
                <Dropdown
                  label="Select pet"
                  value={selectedPetId}
                  placeholder="Choose a pet"
                  options={ownerPets.map((p) => ({ value: p._id, label: p.name }))}
                  onSelect={setSelectedPetId}
                />
              )}
              <Dropdown
                label="Mode of Appointment"
                value={mode}
                placeholder="Select mode"
                options={appointmentModes.map((m) => ({ value: m.value, label: m.label }))}
                onSelect={setMode}
              />
            </div>

            {/* Row 2: Branch + Vet */}
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                label="Vet Clinic Branch"
                value={selectedBranchId}
                placeholder="Select branch"
                options={branchOptions}
                onSelect={setSelectedBranchId}
              />
              {!selectedBranchId ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    Select a clinic branch first
                  </div>
                </div>
              ) : loadingVets ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                    Loading vets...
                  </div>
                </div>
              ) : branchVets.length === 0 ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    No vets available at this branch
                  </div>
                </div>
              ) : (
                <Dropdown
                  label="Chosen Veterinarian"
                  value={selectedVetId}
                  placeholder="Select vet"
                  options={branchVets.map((v) => ({ value: v._id, label: `Dr. ${v.firstName} ${v.lastName}` }))}
                  onSelect={setSelectedVetId}
                />
              )}
            </div>

            {/* Type of Appointment */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Type of Appointment</p>
              {!mode ? (
                <div className="px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                  Select mode first
                </div>
              ) : mode === 'online' ? (
                <div className="px-4 py-2.5 border border-[#7FA5A3] rounded-xl bg-[#7FA5A3]/5 text-sm text-[#5A7C7A] font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Consultation
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {faceToFaceTypes.map((t) => {
                    const isSelected = selectedTypes.includes(t.value)
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleType(t.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left flex items-center gap-2 ${
                          isSelected
                            ? 'border-[#7FA5A3] bg-[#7FA5A3]/10 text-[#5A7C7A]'
                            : 'border-gray-300 bg-white text-[#4F4F4F] hover:border-[#7FA5A3]/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#5A7C7A] border-[#5A7C7A]' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Date Picker */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Date</p>
              <DatePicker
                value={selectedDate}
                onChange={(date) => { setSelectedDate(date); setSelectedSlot(null) }}
                placeholder="Select a date"
                allowFutureDates={true}
                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </div>

          {/* Right: Time Table */}
          <div className="w-[260px] shrink-0">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 h-full flex flex-col">
              {!selectedVetId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a veterinarian to view available slots</p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[340px] pr-1">
                    {Object.entries(slotsByHour).map(([hour, hourSlots]) => (
                      <div key={hour} className="flex gap-2">
                        <div className="w-10 shrink-0 text-right pt-1">
                          <span className="text-[10px] font-medium text-gray-400">
                            {parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}{parseInt(hour) >= 12 ? 'PM' : 'AM'}
                          </span>
                        </div>
                        <div className="flex-1 space-y-0.5">
                          {hourSlots.map((slot) => {
                            const isSelected = selectedSlot?.startTime === slot.startTime
                            const isAvailable = slot.status === 'available'
                            const isYourBooking = slot.status === 'your-booking'
                            const isUnavailable = slot.status === 'unavailable'

                            let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                            if (isYourBooking) bg = 'bg-gray-300 text-gray-600 cursor-default'
                            if (isUnavailable) bg = 'bg-[#900B09] text-white cursor-default'
                            if (isSelected) bg = 'bg-[#476B6B] ring-2 ring-[#476B6B] ring-offset-1 text-white cursor-pointer'

                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => { if (isAvailable) setSelectedSlot(slot) }}
                                disabled={!isAvailable}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bg}`}
                              >
                                {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#7FA5A3]" />
                      <span className="text-[10px] text-gray-500">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-gray-300" />
                      <span className="text-[10px] text-gray-500">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#900B09]" />
                      <span className="text-[10px] text-gray-500">Unavailable</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-center gap-4 px-8 pb-8">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-2.5 bg-[#7FA5A3] text-white rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Set an appointment'}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-[#4F4F4F] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== RESCHEDULE MODAL ====================

function RescheduleModal({
  appointment,
  onClose,
  onRescheduled,
}: {
  appointment: Appointment | null
  onClose: () => void
  onRescheduled: () => void
}) {
  const { token } = useAuthStore()
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset state when appointment changes
  useEffect(() => {
    if (appointment) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSelectedDate(tomorrow.toISOString().split('T')[0])
      setSelectedSlot(null)
      setSlots([])
    }
  }, [appointment])

  // Load slots when date changes
  useEffect(() => {
    const vetId = appointment?.vetId?._id
    if (!vetId || !selectedDate) { setSlots([]); return }
    const load = async () => {
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        const branchId = appointment?.clinicBranchId?._id || appointment?.clinicBranchId
        const res = await getAvailableSlots(vetId, selectedDate, token || undefined, branchId || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setSlots(res.data.slots)
        } else {
          setSlots(generateMockSlots())
        }
      } catch { setSlots(generateMockSlots()) }
      finally { setLoadingSlots(false) }
    }
    load()
  }, [appointment, selectedDate, token])

  const handleReschedule = async () => {
    if (!appointment || !selectedSlot) return
    setSubmitting(true)
    try {
      const res = await rescheduleAppointment(appointment._id, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      }, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Appointment rescheduled successfully!')
        onRescheduled()
      } else {
        toast.error(res.message || 'Failed to reschedule')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by hour
  const slotsByHour: Record<number, TimeSlot[]> = {}
  slots.forEach((s) => {
    const hour = parseInt(s.startTime.split(':')[0])
    if (!slotsByHour[hour]) slotsByHour[hour] = []
    slotsByHour[hour].push(s)
  })

  return (
    <Dialog open={!!appointment} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-[#2C3E2D]">Reschedule Appointment</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-5">
          {/* Current appointment info */}
          {appointment && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-400 uppercase font-medium mb-2">Current Appointment</p>
              <div className="flex items-center gap-3">
                {appointment.petId?.photo ? (
                  <img src={appointment.petId.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-[#5A7C7A]" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm text-[#4F4F4F]">{appointment.petId?.name || 'Pet'}</p>
                  <p className="text-xs text-gray-500">
                    Dr. {appointment.vetId?.firstName} {appointment.vetId?.lastName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(appointment.date)}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatSlotTime(appointment.startTime)} - {formatSlotTime(appointment.endTime)}
                </span>
              </div>
            </div>
          )}

          {/* New Date */}
          <div>
            <p className="text-sm font-semibold text-[#2C3E2D] mb-2">New Date</p>
            <DatePicker
              value={selectedDate}
              onChange={(date) => { setSelectedDate(date); setSelectedSlot(null) }}
              placeholder="Select a date"
              allowFutureDates={true}
              minDate={new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>

          {/* Time Slots */}
          <div>
            <p className="text-sm font-semibold text-[#2C3E2D] mb-2">New Time Slot</p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[220px] space-y-0.5 pr-1">
                  {Object.entries(slotsByHour).map(([hour, hourSlots]) => (
                    <div key={hour} className="flex gap-2">
                      <div className="w-10 shrink-0 text-right pt-1">
                        <span className="text-[10px] font-medium text-gray-400">
                          {parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}{parseInt(hour) >= 12 ? 'PM' : 'AM'}
                        </span>
                      </div>
                      <div className="flex-1 space-y-0.5">
                        {hourSlots.map((slot) => {
                          const isSelected = selectedSlot?.startTime === slot.startTime
                          const isAvailable = slot.status === 'available'
                          const isYourBooking = slot.status === 'your-booking'
                          const isUnavailable = slot.status === 'unavailable'

                          let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                          if (isYourBooking) bg = 'bg-gray-300 text-gray-600 cursor-default'
                          if (isUnavailable) bg = 'bg-[#900B09] text-white cursor-default'
                          if (isSelected) bg = 'bg-[#476B6B] ring-2 ring-[#476B6B] ring-offset-1 text-white cursor-pointer'

                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => { if (isAvailable) setSelectedSlot(slot) }}
                              disabled={!isAvailable}
                              className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bg}`}
                            >
                              {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#7FA5A3]" />
                  <span className="text-[10px] text-gray-500">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-300" />
                  <span className="text-[10px] text-gray-500">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#900B09]" />
                  <span className="text-[10px] text-gray-500">Unavailable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleReschedule}
              disabled={submitting || !selectedSlot}
              className="px-6 py-2.5 bg-[#7FA5A3] text-white rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Rescheduling...' : 'Reschedule'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-[#4F4F4F] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
