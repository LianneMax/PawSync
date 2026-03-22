'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import {
  getClinicAppointments,
  getAvailableSlots,
  createClinicAppointment,
  createGuestIntakeAppointment,
  sendGuestClaimInvite,
  updateGuestEmail,
  searchPetOwners,
  getPetsForOwner,
  cancelAppointment,
  rescheduleAppointment,
  clinicCheckInAppointment,
  updateAppointmentStatus,
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
  AlertTriangle,
  Scissors,
  List,
  Building2,
  LogIn,
  Smartphone,
  UserPlus,
  Mail,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatePicker } from '@/components/ui/date-picker'
import { BreedCombobox } from '@/components/ui/breed-combobox'
import AppointmentServiceSelector from '@/components/AppointmentServiceSelector'

// ==================== CONSTANTS ====================

const appointmentModes = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'face-to-face', label: 'Face to Face', icon: Users },
]


const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-l-green-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' },
  in_clinic: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500' },
  in_progress: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-l-purple-500' },
  completed: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-l-gray-400' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' },
}

// ==================== HELPERS ====================

// Normalize appointment type to valid enum values
function normalizeAppointmentType(type: string): string {
  const typeMap: Record<string, string> = {
    // Normalize capitalized versions
    'Consultation': 'consultation',
    'consultation': 'consultation',
    'General Checkup': 'general-checkup',
    'Vaccination': 'vaccination',
    'Vaccination / Immunization': 'vaccination',
    'Vaccination/Immunization': 'vaccination',
    'Flea & Tick Prevention': 'flea-tick-prevention',
    'Flea Tick Prevention': 'flea-tick-prevention',
    'Rabies': 'rabies-vaccination',
    'Rabies Vaccination': 'rabies-vaccination',
    'Deworming': 'deworming',
    'Sterilization': 'Sterilization',
    'Grooming': 'Grooming',
    'Basic Grooming': 'basic-grooming',
    'Basic grooming': 'basic-grooming',
    'Full Grooming': 'full-grooming',
    'Full grooming': 'full-grooming',
    'General Consultation': 'General Consultation',
    'Preventive Care': 'Preventive Care',
  }
  
  // Return mapped value if exists, otherwise return as-is (already in correct format)
  return typeMap[type] || type
}

// Format appointment type for display
function formatAppointmentTypeDisplay(type: string): string {
  const displayMap: Record<string, string> = {
    'consultation': 'Consultation',
    'general-checkup': 'General Checkup',
    'primary-treatment': 'Primary Treatment',
    'vaccination': 'Vaccination',
    'rabies-vaccination': 'Rabies Vaccination',
    'puppy-litter-vaccination': 'Puppy Litter Vaccination',
    'deworming': 'Deworming',
    'cbc': 'CBC Test',
    'blood-chemistry-16': 'Blood Chemistry (16)',
    'pcr-test': 'PCR Test',
    'x-ray': 'X-Ray',
    'ultrasound': 'Ultrasound',
    'abdominal-surgery': 'Abdominal Surgery',
    'orthopedic-surgery': 'Orthopedic Surgery',
    'dental-scaling': 'Dental Scaling',
    'laser-therapy': 'Laser Therapy',
    'Sterilization': 'Sterilization',
    'inpatient-care': 'Inpatient Care',
    'outpatient-treatment': 'Outpatient Treatment',
    'point-of-care-diagnostic': 'Point of Care Diagnostic',
    'basic-grooming': 'Basic Grooming',
    'full-grooming': 'Full Grooming',
    'Basic Grooming': 'Basic Grooming',
    'Full Grooming': 'Full Grooming',
    'General Consultation': 'General Consultation',
    'Preventive Care': 'Preventive Care',
    'Grooming': 'Grooming',
    'flea-tick-prevention': 'Flea & Tick Prevention',
    'heartworm': 'Heartworm Prevention',
  }
  
  return displayMap[type] || type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

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

function toYmd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getAppointmentDateYmd(dateValue: string) {
  if (!dateValue) return ''
  if (dateValue.includes('T')) return dateValue.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue
  const parsed = new Date(dateValue)
  if (isNaN(parsed.getTime())) return ''
  return toYmd(parsed)
}

// ==================== DROPDOWN COMPONENT ====================

function Dropdown({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled,
  disabledOptions = [],
  disabledReasonByValue = {},
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onSelect: (val: string) => void
  disabled?: boolean
  disabledOptions?: string[]
  disabledReasonByValue?: Record<string, string>
}) {
  const selected = options.find((o) => o.value === value)

  return (
    <div>
      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">{label}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl text-left text-sm transition-colors ${
              disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white hover:border-[#7FA5A3]'
            }`}
          >
            <span className={selected ? 'text-[#4F4F4F]' : 'text-gray-400'}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) max-h-48 overflow-y-auto rounded-xl">
          {options.map((opt) => {
            const isDisabledOption = disabledOptions.includes(opt.value)
            return (
              <DropdownMenuItem
                key={opt.value}
                disabled={isDisabledOption}
                onSelect={() => {
                  if (!isDisabledOption) onSelect(opt.value)
                }}
                className={`px-4 py-2.5 text-sm transition-colors ${
                  isDisabledOption
                    ? 'text-gray-400 cursor-not-allowed'
                    : opt.value === value
                      ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium'
                      : 'text-[#4F4F4F]'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span>{opt.label}</span>
                  {isDisabledOption && <span className="text-xs text-gray-400">({disabledReasonByValue[opt.value] || 'Unavailable'})</span>}
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
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
  onReschedule,
  onCancel,
  onCheckIn,
  scheduleType,
  branches,
}: {
  appointments: Appointment[]
  selectedDate: string
  onDateChange: (date: string) => void
  vets: BranchVet[]
  onReschedule: (appt: Appointment) => void
  onCancel: (id: string) => void
  onCheckIn: (id: string) => void
  scheduleType: 'medical' | 'grooming'
  branches: ClinicBranchItem[]
}) {
  const parseHourFromTime = (time?: string | null, fallback = 0) => {
    if (!time || typeof time !== 'string') return fallback
    const [hourPart] = time.split(':')
    const parsed = parseInt(hourPart, 10)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const activeBranch = branches.find((branch) => branch.isMain) || branches[0]
  const openHour = parseHourFromTime(activeBranch?.openingTime, 7)
  const closeHour = parseHourFromTime(activeBranch?.closingTime, 17)
  const hourSpan = Math.max(1, closeHour - openHour)
  const hours = Array.from({ length: hourSpan }, (_, i) => i + openHour)

  const selectedDateObject = new Date(selectedDate)
  const selectedDayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][selectedDateObject.getDay()]
  const branchOperatingDays = activeBranch?.operatingDays || []
  const isBranchOpenOnSelectedDate = branchOperatingDays.length === 0 || branchOperatingDays.includes(selectedDayName)

  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Navigate date
  const goToDay = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    onDateChange(toYmd(d))
  }

  const dateLabel = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const isViewingToday = selectedDate === toYmd(new Date())
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const isCurrentTimeVisible = isViewingToday && isBranchOpenOnSelectedDate && currentHour >= openHour && currentHour < closeHour
  const timelinePercentage = isCurrentTimeVisible
    ? ((currentHour - openHour + currentMinute / 60) / hourSpan) * 100
    : 0

  // Show active appointments (pending, confirmed, in_clinic, in_progress) for the selected date in the calendar view
  const confirmedAppointments = appointments.filter((a) => {
    if (!['pending', 'confirmed', 'in_clinic', 'in_progress'].includes(a.status)) return false
    // Match by date (compare YYYY-MM-DD)
    const apptDate = new Date(a.date).toISOString().split('T')[0]
    return apptDate === selectedDate
  })

  // For grooming, we only need one column (clinic/branch); for medical, we map by vet
  if (scheduleType === 'grooming') {
    // Grooming view: single column for clinic/branch
    const branchName = branches.length > 0 ? branches[0].name : 'Clinic'
    
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
          <div className="min-w-80">
            {/* Branch Header */}
            <div className="flex border-b border-gray-100">
              {/* Time column header */}
              <div className="w-20 shrink-0 px-3 py-3 bg-gray-50" />
              {/* Branch column */}
              <div className="flex-1 min-w-60 px-3 py-3 bg-gray-50 border-l border-gray-100 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Building2 className="w-4 h-4 text-[#5A7C7A] shrink-0" />
                  <p className="text-sm font-medium text-[#4F4F4F]">{branchName}</p>
                </div>
                <p className="text-[10px] text-gray-400">Grooming</p>
              </div>
            </div>

            <div className="relative">
              {isCurrentTimeVisible && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `calc(${timelinePercentage}%)` }}
                >
                  <div className="relative flex items-center">
                    <span className="w-20 shrink-0 text-right pr-2 text-[10px] font-semibold text-red-500 bg-white leading-none">
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                    <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
                  </div>
                </div>
              )}

              {/* Time Rows */}
              {hours.map((hour) => {
                const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
                const hourAppointments = confirmedAppointments.filter((a) => {
                  const startHour = parseInt(a.startTime.split(':')[0])
                  return startHour === hour
                })

                return (
                  <div key={hour} className="flex border-b border-gray-50 min-h-16">
                    {/* Time label */}
                    <div className="w-20 shrink-0 px-3 py-2 text-right">
                      <span className="text-xs text-gray-400 font-medium">{timeLabel}</span>
                    </div>
                    {/* Grooming column */}
                    <div className="flex-1 min-w-60 px-2 py-1.5 border-l border-gray-100">
                      {hourAppointments.map((appt) => {
                        const colors = statusColors[appt.status] || statusColors.pending
                        return (
                          <div
                            key={appt._id}
                            className={`rounded-lg px-2.5 py-1.5 mb-1 border-l-[3px] ${appt.isEmergency ? 'border-l-red-500 bg-red-50' : `${colors.border} ${colors.bg}`}`}
                          >
                            <p className="text-xs font-medium text-[#4F4F4F] truncate">
                              {appt.petId?.name || 'Pet'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                            </p>
                            <div className="flex items-start justify-between mt-0.5">
                              <span className="text-[10px] text-gray-400">
                                {formatSlotTime(appt.startTime)}
                              </span>
                              <span className={`text-[10px] font-medium capitalize ${appt.isEmergency ? 'text-red-700' : colors.text}`}>
                                {appt.isEmergency ? 'Emergency' : appt.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100 text-gray-500 capitalize">
                                {appt.mode === 'face-to-face' ? 'Face to Face' : 'Online'}
                              </span>
                              {appt.isEmergency && (
                                <span className="px-1.5 py-0.5 text-[9px] rounded bg-red-100 text-red-700 font-medium">
                                  Emergency
                                </span>
                              )}
                              {appt.isWalkIn && !appt.isEmergency && (
                                <span className="px-1.5 py-0.5 text-[9px] rounded bg-orange-100 text-orange-700 font-medium">
                                  Walk-In
                                </span>
                              )}
                              {appt.types.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 text-[9px] rounded bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                  {formatAppointmentTypeDisplay(t)}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2">
                              {(appt.status === 'confirmed' || appt.status === 'pending') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onCheckIn(appt._id)}
                                    className="text-[10px] font-medium px-2 py-1 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200"
                                  >
                                    Check-in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onReschedule(appt)}
                                    className="text-[10px] font-medium px-2 py-1 rounded-lg border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#7FA5A3]/5 hover:border-[#5A8280] transition-all duration-200"
                                  >
                                    Reschedule
                                  </button>
                                </>
                              )}
                              {(appt.status === 'confirmed' || appt.status === 'in_clinic') && (
                                <button
                                  type="button"
                                  onClick={() => onCancel(appt._id)}
                                  className="text-[10px] font-medium px-2 py-1 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200"
                                >
                                  Cancel
                                </button>
                              )}
                              {appt.status === 'in_progress' && (
                                <button
                                  type="button"
                                  className="text-[10px] font-medium px-2 py-1 rounded-lg border border-blue-300 text-blue-600 opacity-70 cursor-not-allowed"
                                  title="Complete appointment action coming soon"
                                >
                                  Complete Appointment
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Medical view: map appointments by vetId for quick lookup
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
        <div className="min-w-175">
          {/* Vet Headers */}
          <div className="flex border-b border-gray-100">
            {/* Time column header */}
            <div className="w-20 shrink-0 px-3 py-3 bg-gray-50" />
            {/* Vet columns */}
            {displayVets.map((vet) => (
              <div key={vet._id} className="flex-1 min-w-40 px-3 py-3 bg-gray-50 border-l border-gray-100 text-center">
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

          <div className="relative">
            {isCurrentTimeVisible && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: `calc(${timelinePercentage}%)` }}
              >
                <div className="relative flex items-center">
                  <span className="w-20 shrink-0 text-right pr-2 text-[10px] font-semibold text-red-500 bg-white leading-none">
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                  <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
                </div>
              </div>
            )}

            {/* Time Rows */}
            {hours.map((hour) => {
              const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`

              return (
                <div key={hour} className="flex border-b border-gray-50 min-h-16">
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
                      <div key={vet._id} className="flex-1 min-w-40 px-2 py-1.5 border-l border-gray-100">
                        {vetAppts.map((appt) => {
                          const colors = statusColors[appt.status] || statusColors.pending
                          return (
                            <div
                              key={appt._id}
                              className={`rounded-lg px-2.5 py-1.5 mb-1 border-l-[3px] ${appt.isEmergency ? 'border-l-red-500 bg-red-50' : `${colors.border} ${colors.bg}`}`}
                            >
                              <p className="text-xs font-medium text-[#4F4F4F] truncate">
                                {appt.petId?.name || 'Pet'}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate">
                                {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                              </p>
                              <div className="flex items-start justify-between mt-0.5">
                                <span className="text-[10px] text-gray-400">
                                  {formatSlotTime(appt.startTime)}
                                </span>
                                <span className={`text-[10px] font-medium capitalize ${appt.isEmergency ? 'text-red-700' : colors.text}`}>
                                  {appt.isEmergency ? 'Emergency' : appt.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100 text-gray-500 capitalize">
                                  {appt.mode === 'face-to-face' ? 'Face to Face' : 'Online'}
                                </span>
                                {appt.isEmergency && (
                                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-red-100 text-red-700 font-medium">
                                    Emergency
                                  </span>
                                )}
                                {appt.isWalkIn && !appt.isEmergency && (
                                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-orange-100 text-orange-700 font-medium">
                                    Walk-In
                                  </span>
                                )}
                                {appt.types.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 text-[9px] rounded bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                    {formatAppointmentTypeDisplay(t)}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center justify-end gap-2 mt-2">
                                {(appt.status === 'confirmed' || appt.status === 'pending') && (
                                  <button
                                    type="button"
                                    onClick={() => onCheckIn(appt._id)}
                                    className="text-[10px] font-medium px-2 py-1 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200"
                                  >
                                    Check-in
                                  </button>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'pending') && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onReschedule(appt)}
                                      className="text-[10px] font-medium px-2 py-1 rounded-lg border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#7FA5A3]/5 hover:border-[#5A8280] transition-all duration-200"
                                    >
                                      Reschedule
                                    </button>
                                  </>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'in_clinic') && (
                                  <button
                                    type="button"
                                    onClick={() => onCancel(appt._id)}
                                    className="text-[10px] font-medium px-2 py-1 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200"
                                  >
                                    Cancel
                                  </button>
                                )}
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
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 px-6 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-gray-500">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-[10px] text-gray-500">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-gray-500">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-[10px] text-gray-500">Emergency</span>
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
  openingTime?: string | null
  closingTime?: string | null
  operatingDays?: string[]
}

interface ClinicInfo {
  _id: string
  name: string
}

export default function ClinicAdminAppointmentsPage() {
  const { token } = useAuthStore()
  const user = useAuthStore((state) => state.user)
  const isClinicAdmin = user?.userType === 'clinic-admin'
  const isMainBranchAdmin = isClinicAdmin && user?.isMainBranch === true

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all')
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [scheduleType, setScheduleType] = useState<'medical' | 'grooming'>('medical')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  // Unfiltered appointment list for NFC check-in (independent of current scheduleType tab)
  const allAppointmentsRef = useRef<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null)

  // Guest claim invite / update email
  const [guestInviteTarget, setGuestInviteTarget] = useState<Appointment | null>(null)
  const [guestEmailModalOpen, setGuestEmailModalOpen] = useState(false)
  const [guestEmailValue, setGuestEmailValue] = useState('')
  const [guestEmailSendInvite, setGuestEmailSendInvite] = useState(true)
  const [guestEmailSubmitting, setGuestEmailSubmitting] = useState(false)

  // Check-in functionality
  const [appointmentToCheckIn, setAppointmentToCheckIn] = useState<string | null>(null)
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [nfcScanModalOpen, setNfcScanModalOpen] = useState(false)
  const [nfcScanningActive, setNfcScanningActive] = useState(false)

  // Clinic data
  const [clinic, setClinic] = useState<ClinicInfo | null>(null)
  const [branches, setBranches] = useState<ClinicBranchItem[]>([])
  const [allVets, setAllVets] = useState<BranchVet[]>([])

  // Calendar date
  const [calendarDate, setCalendarDate] = useState(() => toYmd(new Date()))
  const [ownerFilterQuery, setOwnerFilterQuery] = useState('')
  const [ownerFilterOpen, setOwnerFilterOpen] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [selectedPetId, setSelectedPetId] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [customDateOpen, setCustomDateOpen] = useState(false)

  const showListFilters = activeTab === 'previous' || (activeTab === 'upcoming' && viewMode === 'list')

  const ownerOptions = useMemo(() => {
    const grouped = new Map<string, { ownerId: string; ownerName: string; pets: Array<{ petId: string; petName: string }> }>()

    appointments.forEach((appt) => {
      const ownerObj = typeof appt.ownerId === 'object' && appt.ownerId ? appt.ownerId : null
      const ownerId = ownerObj?._id ? String(ownerObj._id) : ''
      const ownerName = [ownerObj?.firstName, ownerObj?.lastName].filter(Boolean).join(' ').trim()
      const petObj = typeof appt.petId === 'object' && appt.petId ? appt.petId : null
      const petId = petObj?._id ? String(petObj._id) : ''
      const petName = petObj?.name || 'Pet'

      if (!ownerId || !ownerName) return

      if (!grouped.has(ownerId)) {
        grouped.set(ownerId, { ownerId, ownerName, pets: [] })
      }

      if (petId) {
        const ownerEntry = grouped.get(ownerId)!
        if (!ownerEntry.pets.some((p) => p.petId === petId)) {
          ownerEntry.pets.push({ petId, petName })
        }
      }
    })

    return Array.from(grouped.values()).sort((a, b) => a.ownerName.localeCompare(b.ownerName))
  }, [appointments])

  const selectedOwner = useMemo(
    () => ownerOptions.find((o) => o.ownerId === selectedOwnerId) || null,
    [ownerOptions, selectedOwnerId],
  )

  const selectedPet = useMemo(
    () => selectedOwner?.pets.find((p) => p.petId === selectedPetId) || null,
    [selectedOwner, selectedPetId],
  )

  useEffect(() => {
    if (selectedOwner) {
      setOwnerFilterQuery(selectedOwner.ownerName)
    } else if (!selectedOwnerId) {
      setOwnerFilterQuery('')
    }
  }, [selectedOwner, selectedOwnerId])

  const suggestedOwners = useMemo(() => {
    const q = ownerFilterQuery.trim().toLowerCase()
    if (!q) return ownerOptions.slice(0, 8)
    return ownerOptions.filter((o) => o.ownerName.toLowerCase().includes(q)).slice(0, 8)
  }, [ownerOptions, ownerFilterQuery])

  const selectedOwnerPets = useMemo(
    () => (selectedOwner?.pets || []).slice().sort((a, b) => a.petName.localeCompare(b.petName)),
    [selectedOwner],
  )

  const displayedAppointments = useMemo(() => {
    if (!showListFilters) return appointments

    const today = new Date()
    const todayYmd = toYmd(today)
    let startYmd = ''
    let endYmd = ''

    if (dateFilter === 'custom') {
      if (customStartDate && customEndDate) {
        startYmd = customStartDate <= customEndDate ? customStartDate : customEndDate
        endYmd = customStartDate <= customEndDate ? customEndDate : customStartDate
      }
    } else if (dateFilter !== 'all') {
      if (activeTab === 'upcoming') {
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()))
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        const yearEnd = new Date(today.getFullYear(), 11, 31)

        if (dateFilter === 'today') {
          startYmd = todayYmd
          endYmd = todayYmd
        }
        if (dateFilter === 'week') {
          startYmd = todayYmd
          endYmd = toYmd(weekEnd)
        }
        if (dateFilter === 'month') {
          startYmd = todayYmd
          endYmd = toYmd(monthEnd)
        }
        if (dateFilter === 'year') {
          startYmd = todayYmd
          endYmd = toYmd(yearEnd)
        }
      } else {
        const weekStart = new Date(today)
        weekStart.setDate(weekStart.getDate() - 6)
        const monthStart = new Date(today)
        monthStart.setDate(monthStart.getDate() - 29)
        const yearStart = new Date(today)
        yearStart.setDate(yearStart.getDate() - 364)

        if (dateFilter === 'today') {
          startYmd = todayYmd
          endYmd = todayYmd
        }
        if (dateFilter === 'week') {
          startYmd = toYmd(weekStart)
          endYmd = todayYmd
        }
        if (dateFilter === 'month') {
          startYmd = toYmd(monthStart)
          endYmd = todayYmd
        }
        if (dateFilter === 'year') {
          startYmd = toYmd(yearStart)
          endYmd = todayYmd
        }
      }
    }

    return appointments.filter((appt) => {
      if (selectedOwnerId) {
        const ownerId = typeof appt.ownerId === 'string' ? appt.ownerId : appt.ownerId?._id
        if (!ownerId || String(ownerId) !== selectedOwnerId) return false
      }

      if (selectedPetId) {
        const petId = typeof appt.petId === 'string' ? appt.petId : appt.petId?._id
        if (!petId || String(petId) !== selectedPetId) return false
      }

      if (startYmd && endYmd) {
        const apptYmd = getAppointmentDateYmd(appt.date)
        if (!apptYmd || apptYmd < startYmd || apptYmd > endYmd) return false
      }

      return true
    })
  }, [appointments, showListFilters, selectedOwnerId, selectedPetId, dateFilter, customStartDate, customEndDate, activeTab])

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: 'owner' | 'pet' | 'date'; label: string }> = []

    if (selectedOwner) {
      chips.push({ key: 'owner', label: selectedOwner.ownerName })
    }
    if (selectedPet) {
      chips.push({ key: 'pet', label: selectedPet.petName })
    }

    if (dateFilter !== 'all') {
      if (activeTab === 'upcoming') {
        if (dateFilter === 'today') chips.push({ key: 'date', label: 'Today' })
        if (dateFilter === 'week') chips.push({ key: 'date', label: 'This Week' })
        if (dateFilter === 'month') chips.push({ key: 'date', label: 'This Month' })
        if (dateFilter === 'year') chips.push({ key: 'date', label: 'This Year' })
      } else {
        if (dateFilter === 'today') chips.push({ key: 'date', label: 'Today' })
        if (dateFilter === 'week') chips.push({ key: 'date', label: 'One Week Ago' })
        if (dateFilter === 'month') chips.push({ key: 'date', label: 'One Month Ago' })
        if (dateFilter === 'year') chips.push({ key: 'date', label: 'One Year Ago' })
      }

      if (dateFilter === 'custom') {
        if (customStartDate && customEndDate) {
          chips.push({ key: 'date', label: `${formatDate(customStartDate)} - ${formatDate(customEndDate)}` })
        } else {
          chips.push({ key: 'date', label: 'Custom Date' })
        }
      }
    }

    return chips
  }, [selectedOwner, selectedPet, dateFilter, customStartDate, customEndDate, activeTab])

  // Load clinic + branches (for clinic admins, vets, etc.)
  useEffect(() => {
    const load = async () => {
      try {
        const clinicRes = await authenticatedFetch('/clinics/mine', {}, token || undefined)
        if (clinicRes.status === 'SUCCESS' && clinicRes.data?.clinics?.length > 0) {
          const c = clinicRes.data.clinics[0]
          setClinic({ _id: c._id, name: c.name })

          // Fetch branches for clinic admins
          if (isClinicAdmin) {
            const branchRes = await authenticatedFetch(`/clinics/${c._id}/branches`, {}, token || undefined)
            if (branchRes.status === 'SUCCESS' && branchRes.data?.branches) {
              setBranches(branchRes.data.branches)
            }
          }
        }
      } catch { /* silent */ }
    }
    if (token) load()
  }, [token, isClinicAdmin])

  // Load vets for the calendar — scoped to selected branch when one is chosen
  useEffect(() => {
    const load = async () => {
      try {
        if (isMainBranchAdmin && selectedBranchFilter !== 'all') {
          // Fetch vets assigned to the specific selected branch
          const res = await getVetsForBranch(selectedBranchFilter, token || undefined)
          if (res.status === 'SUCCESS' && res.data?.vets) {
            setAllVets(res.data.vets)
          }
        } else {
          // Fetch all vets across the clinic
          const res = await authenticatedFetch('/clinics/mine/vets', {}, token || undefined)
          if (res.status === 'SUCCESS' && res.data?.vets) {
            setAllVets(res.data.vets.map((v: { vetId?: string; _id?: string; name?: string; email?: string }) => ({
              _id: v.vetId || v._id,
              firstName: v.name?.replace('Dr. ', '').split(' ')[0] || '',
              lastName: v.name?.replace('Dr. ', '').split(' ').slice(1).join(' ') || '',
              email: v.email || '',
            })))
          }
        }
      } catch { /* silent */ }
    }
    if (token) load()
  }, [token, isMainBranchAdmin, selectedBranchFilter])

  // Load appointments (backend auto-filters by branch from JWT)
  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setAppointments([])
    try {
      // Calendar view is only available for upcoming; activeTab is the source of truth for the filter
      // Main branch admins can filter by branch; passing no branchId returns all branches
      const branchIdParam = isMainBranchAdmin && selectedBranchFilter !== 'all' ? selectedBranchFilter : undefined
      const res = await getClinicAppointments({ filter: activeTab, branchId: branchIdParam }, token || undefined)
      if (res.status === 'SUCCESS' && res.data) {
        // Store the full unfiltered list for NFC check-in (which must work across all service types)
        allAppointmentsRef.current = res.data.appointments

        // Filter appointments based on schedule type
        // Mixed appointments (grooming + medical) appear in both tabs
        const filtered = res.data.appointments.filter((a: Appointment) => {
          const apptHasGrooming = a.types?.some(t => t === 'basic-grooming' || t === 'full-grooming')
          const apptHasMedical = a.types?.some(t => t !== 'basic-grooming' && t !== 'full-grooming')
          if (scheduleType === 'grooming') {
            return apptHasGrooming
          } else {
            return apptHasMedical
          }
        })
        setAppointments(filtered)

        // On initial calendar load, auto-navigate to the first active appointment's date
        if (activeTab === 'upcoming' && viewMode === 'calendar' && filtered.length > 0) {
          const firstConfirmed = filtered.find((a) => ['confirmed', 'in_clinic', 'in_progress', 'pending'].includes(a.status))
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
  }, [activeTab, viewMode, token, scheduleType, isMainBranchAdmin, selectedBranchFilter])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  const handleCancel = (id: string) => {
    setAppointmentToCancel(id)
  }

  const confirmCancel = async () => {
    if (!appointmentToCancel) return
    setCancelSubmitting(true)
    try {
      const res = await cancelAppointment(appointmentToCancel, token || undefined)
      if (res.status === 'SUCCESS') {
        // Get appointment details for toast
        const appointment = appointments.find(a => a._id === appointmentToCancel)
        const petName = appointment?.petId?.name || 'the appointment'
        
        toast(
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <X className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Appointment Cancelled</p>
              <p className="text-sm text-gray-600">The appointment for {petName} has been cancelled.</p>
            </div>
          </div>,
          { duration: 5000 }
        )
        loadAppointments()
        setAppointmentToCancel(null)
      } else {
        toast.error(res.message || 'Failed to cancel')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const handleClinicServiceStatusChange = async (id: string, nextStatus: 'in_progress' | 'completed') => {
    setCheckInSubmitting(true)
    try {
      const appointment = appointments.find(a => a._id === id)
      if (!appointment) {
        toast.error('Appointment not found')
        return
      }

      // Backend transition rules do not allow pending -> in_progress directly.
      // For clinic services check-in, move pending -> confirmed first.
      if (nextStatus === 'in_progress' && appointment.status === 'pending') {
        const confirmRes = await updateAppointmentStatus(id, 'confirmed', token || undefined)
        if (confirmRes.status !== 'SUCCESS') {
          toast.error(confirmRes.message || 'Failed to check in')
          return
        }
      }

      const res = await updateAppointmentStatus(id, nextStatus, token || undefined)

      if (res.status === 'SUCCESS') {
        setAppointments(prev => prev.map(appt => appt._id === id ? { ...appt, status: nextStatus } : appt))

        if (appointment && nextStatus === 'in_progress') {
          const isGroomingOnly = appointment.types?.some(t => GROOMING_TYPES.includes(t)) &&
            !appointment.types?.some(t => !GROOMING_TYPES.includes(t))
          if (isGroomingOnly) {
            await createGroomingBilling(appointment)
          }
        }

        const petName = appointment?.petId?.name || 'Pet'
        toast(
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              {nextStatus === 'completed' ? (
                <Check className="w-4 h-4 text-blue-600" />
              ) : (
                <LogIn className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {nextStatus === 'completed' ? 'Appointment Completed' : 'Patient Checked In'}
              </p>
              <p className="text-sm text-gray-600">
                {nextStatus === 'completed'
                  ? `${petName} appointment is now completed.`
                  : `${petName} is now in progress.`}
              </p>
            </div>
          </div>,
          { duration: 5000 }
        )

        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to update appointment status')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const handleCheckIn = async (id: string) => {
    const appointment = appointments.find(a => a._id === id)
    if (!appointment) return

    if (scheduleType === 'grooming') {
      if (appointment.status === 'confirmed' || appointment.status === 'pending') {
        await handleClinicServiceStatusChange(id, 'in_progress')
      }
      return
    }

    setAppointmentToCheckIn(id)
  }

  const GROOMING_TYPES = ['basic-grooming', 'full-grooming']
  const GROOMING_LABEL_MAP: Record<string, string> = {
    'basic-grooming': 'Basic Grooming',
    'full-grooming': 'Full Grooming',
  }

  const createGroomingBilling = async (appointment: Appointment) => {
    try {
      const groomingType = appointment.types?.find(t => GROOMING_TYPES.includes(t))
      if (!groomingType) return

      const groomingLabel = GROOMING_LABEL_MAP[groomingType] || 'Grooming'

      // Fetch the product catalog to find the matching grooming service
      const psRes = await authenticatedFetch('/product-services', { method: 'GET' }, token || undefined)
      const allServices: any[] = psRes?.data?.items ?? []
      const groomingService = allServices.find(
        (s: any) => s.isActive && s.category === 'Grooming' &&
          s.name.toLowerCase().replace(/\s+/g, ' ').trim() === groomingLabel.toLowerCase()
      ) || allServices.find(
        (s: any) => s.isActive && s.category === 'Grooming'
      )

      const petId = appointment.petId?._id ?? appointment.petId
      const ownerId = appointment.ownerId?._id ?? appointment.ownerId
      const clinicBranchId = appointment.clinicBranchId?._id ?? appointment.clinicBranchId

      const billingItem = groomingService
        ? { productServiceId: groomingService._id, name: groomingService.name, type: 'Service', unitPrice: groomingService.price, quantity: 1 }
        : { name: groomingLabel, type: 'Service', unitPrice: 0, quantity: 1 }

      await authenticatedFetch(
        '/billings',
        {
          method: 'POST',
          body: JSON.stringify({
            ownerId,
            petId,
            clinicBranchId,
            appointmentId: appointment._id,
            items: [billingItem],
            serviceLabel: groomingLabel,
            status: 'pending_payment',
          }),
        },
        token || undefined,
      )
    } catch (err) {
      console.error('Failed to auto-create grooming billing:', err)
    }
  }

  const confirmCheckIn = async () => {
    if (!appointmentToCheckIn) return
    setCheckInSubmitting(true)
    try {
      const res = await clinicCheckInAppointment(appointmentToCheckIn, token || undefined)
      if (res.status === 'SUCCESS') {
        const appointment = appointments.find(a => a._id === appointmentToCheckIn)
        const petName = appointment?.petId?.name || 'Pet'

        // Auto-create billing for grooming appointments (no vet approval needed)
        if (appointment) {
          const isGroomingOnly = appointment.types?.some(t => GROOMING_TYPES.includes(t)) &&
            !appointment.types?.some(t => !GROOMING_TYPES.includes(t))
          if (isGroomingOnly) {
            await createGroomingBilling(appointment)
          }
        }

        toast(
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <LogIn className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Patient Checked In</p>
              <p className="text-sm text-gray-600">{petName} is now in the clinic.</p>
            </div>
          </div>,
          { duration: 5000 }
        )
        loadAppointments()
        setAppointmentToCheckIn(null)
      } else {
        toast.error(res.message || 'Failed to check in')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCheckInSubmitting(false)
    }
  }

  // ── Guest invite actions ───────────────────────────────────────────────────
  const handleSendGuestInvite = async (appt: Appointment) => {
    const ownerId = appt.ownerId?._id || (typeof appt.ownerId === 'string' ? appt.ownerId : '')
    if (!ownerId) return
    try {
      const res = await sendGuestClaimInvite(ownerId, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Claim invite sent to pet owner')
        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to send invite')
      }
    } catch {
      toast.error('An error occurred while sending the invite')
    }
  }

  const handleOpenGuestEmailModal = (appt: Appointment) => {
    setGuestInviteTarget(appt)
    setGuestEmailValue('')
    setGuestEmailSendInvite(true)
    setGuestEmailModalOpen(true)
  }

  const handleSubmitGuestEmail = async () => {
    if (!guestInviteTarget) return
    const ownerId = guestInviteTarget.ownerId?._id || (typeof guestInviteTarget.ownerId === 'string' ? guestInviteTarget.ownerId : '')
    if (!ownerId || !guestEmailValue.trim()) return
    setGuestEmailSubmitting(true)
    try {
      const res = await updateGuestEmail(ownerId, { email: guestEmailValue.trim(), sendInvite: guestEmailSendInvite }, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success(res.message || 'Email updated')
        setGuestEmailModalOpen(false)
        setGuestInviteTarget(null)
        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to update email')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setGuestEmailSubmitting(false)
    }
  }

  // Handle NFC/QR scan check-in
  const nfcWsRef = useRef<WebSocket | null>(null)
  const nfcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [scanError, setScanError] = useState<string>('')
  const [isCheckingInFromScan, setIsCheckingInFromScan] = useState(false)

  const stopNfcScanning = () => {
    if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
    if (nfcWsRef.current) {
      nfcWsRef.current.close()
      nfcWsRef.current = null
    }
  }

  const checkInByNfcTagId = useCallback(async (rawTagId: string) => {
    const nfcTagId = rawTagId.trim().toUpperCase()
    console.log('[NFC] Scan received, tag:', nfcTagId)
    setIsCheckingInFromScan(true)
    setScanError('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      console.log('[NFC] Resolving pet...')
      const petResponse = await fetch(`${apiUrl}/nfc/by-tag-id/${encodeURIComponent(nfcTagId)}`)

      if (!petResponse.ok) {
        console.warn('[NFC] Pet not found for tag:', nfcTagId)
        setScanError('Pet not found. This NFC tag may not be registered.')
        setIsCheckingInFromScan(false)
        setNfcScanningActive(false)
        return
      }

      const petData = await petResponse.json()
      if (!petData.data?.pet?._id) {
        setScanError('Unable to identify pet from NFC tag.')
        setIsCheckingInFromScan(false)
        setNfcScanningActive(false)
        return
      }

      const petId = petData.data.pet._id
      console.log('[NFC] Pet resolved:', petId)

      // Search across ALL appointments (not just the currently displayed schedule type)
      // so that grooming appointments are found when on the medical tab and vice versa.
      const todayYmd = new Date().toISOString().split('T')[0]
      const appointmentForPet = allAppointmentsRef.current.find(
        appt => {
          const apptPetId = appt.petId?._id?.toString() ?? appt.petId?.toString()
          const apptDate = getAppointmentDateYmd(appt.date)
          return apptPetId === petId.toString() &&
            (appt.status === 'confirmed' || appt.status === 'pending' || appt.status === 'in_clinic') &&
            apptDate === todayYmd
        }
      )

      if (!appointmentForPet) {
        console.warn('[NFC] No active appointment found for pet', petId, 'on', todayYmd)
        setScanError('No active appointment found for this pet today.')
        setIsCheckingInFromScan(false)
        setNfcScanningActive(false)
        return
      }

      if (appointmentForPet.status === 'in_clinic') {
        setScanError('This patient is already checked in.')
        setIsCheckingInFromScan(false)
        setNfcScanningActive(false)
        return
      }

      const isGroomingAppointment = appointmentForPet.types?.some((t: string) => GROOMING_TYPES.includes(t)) &&
        !appointmentForPet.types?.some((t: string) => !GROOMING_TYPES.includes(t))

      let checkInSuccess = false
      let checkInMessage: string | undefined

      if (isGroomingAppointment) {
        // Grooming check-in: pending → confirmed → in_progress
        if (appointmentForPet.status === 'pending') {
          const confirmRes = await updateAppointmentStatus(appointmentForPet._id, 'confirmed', token || undefined)
          if (confirmRes.status !== 'SUCCESS') {
            setScanError(confirmRes.message || 'Failed to confirm appointment before check-in.')
            setIsCheckingInFromScan(false)
            setNfcScanningActive(false)
            return
          }
        }
        const res = await updateAppointmentStatus(appointmentForPet._id, 'in_progress', token || undefined)
        checkInSuccess = res.status === 'SUCCESS'
        checkInMessage = res.message
        if (checkInSuccess) {
          await createGroomingBilling(appointmentForPet)
        }
      } else {
        // Medical / clinic service check-in: confirmed → in_clinic
        // If still pending, confirm first (pending → in_clinic is not a valid backend transition)
        if (appointmentForPet.status === 'pending') {
          const confirmRes = await updateAppointmentStatus(appointmentForPet._id, 'confirmed', token || undefined)
          if (confirmRes.status !== 'SUCCESS') {
            setScanError(confirmRes.message || 'Failed to confirm appointment before check-in.')
            setIsCheckingInFromScan(false)
            setNfcScanningActive(false)
            return
          }
        }
        const res = await clinicCheckInAppointment(appointmentForPet._id, token || undefined)
        checkInSuccess = res.status === 'SUCCESS'
        checkInMessage = res.message
      }

      if (checkInSuccess) {
        const petName = petData.data.pet.name || 'Pet'
        toast(
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Patient Checked In</p>
              <p className="text-sm text-gray-600">{petName} has been checked in via NFC scan.</p>
            </div>
          </div>,
          { duration: 5000 }
        )
        loadAppointments()
        // Continue scanning for more patients
        setIsCheckingInFromScan(false)
        setScanError('')
        // Auto-restart scanning
        setTimeout(() => startNfcScan(), 1000)
      } else {
        setScanError(checkInMessage || 'Failed to check in patient.')
        setIsCheckingInFromScan(false)
        setNfcScanningActive(false)
      }
    } catch (error) {
      console.error('[NFC] Error checking in by NFC tag:', error)
      setScanError('Failed to check in patient. Please try again.')
      setIsCheckingInFromScan(false)
      setNfcScanningActive(false)
    }
  }, [token, loadAppointments])

  const startNfcScan = useCallback(() => {
    setScanError('')
    stopNfcScanning()

    // Connect to backend NFC WebSocket for card scan events
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const backendHost = apiUrl.replace(/\/api$/, '')
      const wsUrl = backendHost.replace(/^http/, 'ws') + '/ws/nfc'
      console.log('[NFC] Connecting to WebSocket:', wsUrl)
      const ws = new WebSocket(wsUrl)
      nfcWsRef.current = ws

      nfcTimeoutRef.current = setTimeout(() => {
        ws.close()
        nfcWsRef.current = null
        setScanError('No NFC tag detected. Please try again.')
        setNfcScanningActive(false)
      }, 30000)

      ws.onopen = () => {
        console.log('[NFC] WebSocket connected, waiting for card...')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('[NFC] WebSocket message:', msg.type)
          if (msg.type === 'card' && msg.data?.uid) {
            console.log('[NFC] Card detected, uid:', msg.data.uid)
            if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
            checkInByNfcTagId(msg.data.uid)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
        nfcWsRef.current = null
        setScanError('NFC reader not available.')
        setNfcScanningActive(false)
      }
    } catch {
      setScanError('NFC scanning not supported on this device.')
      setNfcScanningActive(false)
    }
  }, [checkInByNfcTagId])

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-8">
        {/* Header */}
        <PageHeader
          title="Appointments"
          subtitle="Manage and schedule appointments for your clinic"
          className="mb-8"
        />

        {/* Row 1: Tabs + Action */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm">
            <button
              onClick={() => { setActiveTab('upcoming'); setViewMode('calendar') }}
              className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => { setActiveTab('previous'); setViewMode('list') }}
              className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'previous'
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNfcScanModalOpen(true)}
              className="flex items-center gap-2 border border-[#7FA5A3] text-[#7FA5A3] px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#7FA5A3]/5 hover:border-[#5A8280] transition-all"
            >
              <LogIn className="w-4 h-4" />
              Scan Check-in
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-[#7FA5A3] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Set an appointment
            </button>
          </div>
        </div>

        {/* Row 2: Schedule type + view toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Schedule Type Toggle */}
            <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setScheduleType('medical')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  scheduleType === 'medical'
                    ? 'bg-[#7FA5A3] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-gray-50'
                }`}
              >
                Medical Services
              </button>
              <button
                onClick={() => setScheduleType('grooming')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  scheduleType === 'grooming'
                    ? 'bg-[#7FA5A3] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-gray-50'
                }`}
              >
                Clinic Services
              </button>
            </div>

            {/* Branch filter — dropdown for main branch admin, static badge otherwise */}
            {isMainBranchAdmin && branches.length > 0 ? (
              <div className="inline-flex items-center rounded-full border border-[#DCEAE3] bg-white p-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-[#4F4F4F] hover:bg-[#F5FAF8] transition-all"
                    >
                      <Building2 className="w-4 h-4" />
                      {selectedBranchFilter === 'all'
                        ? 'All Branches'
                        : branches.find((b) => b._id === selectedBranchFilter)?.name || 'All Branches'}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 rounded-xl">
                    <DropdownMenuItem
                      onSelect={() => setSelectedBranchFilter('all')}
                      className={selectedBranchFilter === 'all' ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium' : ''}
                    >
                      All Branches
                    </DropdownMenuItem>
                    {branches.map((branch) => (
                      <DropdownMenuItem
                        key={branch._id}
                        onSelect={() => setSelectedBranchFilter(branch._id)}
                        className={selectedBranchFilter === branch._id ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium' : ''}
                      >
                        {branch.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : branches.length > 0 ? (
              <span className="px-3 py-1.5 rounded-xl text-sm bg-[#F8F6F2] text-[#4F4F4F] font-medium">
                {branches.find(b => b._id === user?.clinicBranchId)?.name || branches[0]?.name || 'My Branch'}
              </span>
            ) : null}
          </div>

          {activeTab === 'upcoming' && (
            <div className="inline-flex items-center rounded-full border border-[#DCEAE3] bg-white p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-[#F5FAF8]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-[#F5FAF8]'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
          )}
        </div>

        {showListFilters && (
          <>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
              <div className="relative w-full md:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={ownerFilterQuery}
                    placeholder="Search pet owner..."
                    onFocus={() => setOwnerFilterOpen(true)}
                    onBlur={() => setTimeout(() => setOwnerFilterOpen(false), 120)}
                    onChange={(e) => {
                      const next = e.target.value
                      setOwnerFilterQuery(next)
                      setOwnerFilterOpen(true)
                      if (selectedOwner && next !== selectedOwner.ownerName) {
                        setSelectedOwnerId('')
                        setSelectedPetId('')
                      }
                    }}
                    className="w-full pl-10 pr-24 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-[#4F4F4F] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]/40"
                  />
                  {(selectedOwnerId || ownerFilterQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerFilterQuery('')
                        setSelectedOwnerId('')
                        setSelectedPetId('')
                        setOwnerFilterOpen(false)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {ownerFilterOpen && suggestedOwners.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                    {suggestedOwners.map((owner) => (
                      <button
                        key={owner.ownerId}
                        type="button"
                        onClick={() => {
                          setSelectedOwnerId(owner.ownerId)
                          setSelectedPetId('')
                          setOwnerFilterQuery(owner.ownerName)
                          setOwnerFilterOpen(false)
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#7FA5A3]/10"
                      >
                        <p className="text-sm font-medium text-[#4F4F4F]">{owner.ownerName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Pets: {owner.pets.map((p) => p.petName).join(', ') || 'No pets'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {ownerFilterOpen && ownerFilterQuery.trim().length > 0 && suggestedOwners.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 px-4 py-3 text-sm text-gray-400">
                    No pet owners found
                  </div>
                )}

                {selectedOwnerPets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPetId('')}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        selectedPetId === ''
                          ? 'bg-[#7FA5A3] text-white'
                          : 'bg-white border border-gray-200 text-[#4F4F4F] hover:bg-gray-50'
                      }`}
                    >
                      All Pets
                    </button>
                    {selectedOwnerPets.map((pet) => (
                      <button
                        key={pet.petId}
                        type="button"
                        onClick={() => setSelectedPetId(pet.petId)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          selectedPetId === pet.petId
                            ? 'bg-[#7FA5A3] text-white'
                            : 'bg-white border border-gray-200 text-[#4F4F4F] hover:bg-gray-50'
                        }`}
                      >
                        {pet.petName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative w-full md:w-auto">
                <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-gray-100 overflow-x-auto">
                  {([
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: activeTab === 'upcoming' ? 'This Week' : 'One Week Ago' },
                    { value: 'month', label: activeTab === 'upcoming' ? 'This Month' : 'One Month Ago' },
                    { value: 'year', label: activeTab === 'upcoming' ? 'This Year' : 'One Year Ago' },
                    { value: 'custom', label: 'Custom' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setDateFilter(option.value)
                        setCustomDateOpen(option.value === 'custom')
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                        dateFilter === option.value
                          ? 'bg-[#7FA5A3] text-white shadow-sm'
                          : 'text-[#4F4F4F] hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  {dateFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all')
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setCustomDateOpen(false)
                      }}
                      className="px-3 py-2 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {dateFilter === 'custom' && customDateOpen && (
                  <div className="absolute right-0 mt-2 w-full md:w-130 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 z-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Start Date</p>
                        <DatePicker
                          value={customStartDate}
                          onChange={setCustomStartDate}
                          allowFutureDates
                          className="w-full"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">End Date</p>
                        <DatePicker
                          value={customEndDate}
                          onChange={setCustomEndDate}
                          allowFutureDates
                          minDate={customStartDate ? new Date(customStartDate) : undefined}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        onClick={() => setCustomDateOpen(false)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-[#4F4F4F] hover:bg-gray-100"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {activeFilterChips.map((chip) => (
                  <span
                    key={`${chip.key}-${chip.label}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[#7FA5A3]/10 text-[#5A7C7A]"
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={() => {
                        if (chip.key === 'owner') {
                          setSelectedOwnerId('')
                          setSelectedPetId('')
                          setOwnerFilterQuery('')
                        }
                        if (chip.key === 'pet') {
                          setSelectedPetId('')
                        }
                        if (chip.key === 'date') {
                          setDateFilter('all')
                          setCustomStartDate('')
                          setCustomEndDate('')
                          setCustomDateOpen(false)
                        }
                      }}
                      className="text-[#5A7C7A] hover:text-[#476B6B]"
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

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
            onReschedule={setRescheduleTarget}
            onCancel={handleCancel}
            onCheckIn={handleCheckIn}
            scheduleType={scheduleType}
            branches={branches}
          />
        ) : displayedAppointments.length > 0 ? (
          /* ---- LIST VIEW ---- */
          <div className="md:max-h-[calc(100vh-24rem)] md:overflow-y-auto md:pr-2 md:pb-2 scroll-smooth">
            <div className="space-y-4">
              {displayedAppointments.map((appt) => (
                <div key={appt._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {appt.petId?.photo ? (
                      <Image src={appt.petId.photo} alt="" width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
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
                        {isMainBranchAdmin && selectedBranchFilter === 'all' && (() => {
                          const branchId = typeof appt.clinicBranchId === 'object' ? appt.clinicBranchId?._id : appt.clinicBranchId
                          const branchName = branches.find(b => b._id === branchId)?.name
                          return branchName ? (
                            <span className="text-xs text-[#7FA5A3] flex items-center gap-1 font-medium">
                              <Building2 className="w-3 h-3" /> {branchName}
                            </span>
                          ) : null
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-1">
                      {appt.isEmergency && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Emergency</span>
                      )}
                      {appt.isWalkIn && !appt.isEmergency && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Walk-In</span>
                      )}
                      {appt.ownerId?.isGuest && (
                        appt.ownerId?.claimStatus === 'unclaimable' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Unclaimable
                          </span>
                        ) : appt.ownerId?.claimStatus === 'invited' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Invite Sent
                          </span>
                        ) : appt.ownerId?.claimStatus === 'claimed' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Claimed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                            <UserPlus className="w-3 h-3" /> Guest
                          </span>
                        )
                      )}
                      {appt.types.map((t) => (
                        <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">{formatAppointmentTypeDisplay(t)}</span>
                      ))}
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${
                      appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      appt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      appt.status === 'in_clinic' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                      appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      appt.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {appt.status}
                    </span>
                    {activeTab === 'upcoming' && (
                      scheduleType === 'grooming' ? (
                        <div className="flex items-center gap-2">
                          {(appt.status === 'confirmed' || appt.status === 'pending') && (
                            <>
                              <button
                                onClick={() => handleCheckIn(appt._id)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200"
                              >
                                Check-in
                              </button>
                              <button
                                onClick={() => setRescheduleTarget(appt)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#7FA5A3]/5 hover:border-[#5A8280] transition-all duration-200"
                              >
                                Reschedule
                              </button>
                            </>
                          )}
                          {(appt.status === 'confirmed' || appt.status === 'in_clinic') && (
                            <button
                              onClick={() => handleCancel(appt._id)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200"
                            >
                              Cancel
                            </button>
                          )}
                          {appt.status === 'in_progress' && (
                            <button
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 opacity-70 cursor-not-allowed"
                              title="Complete appointment action coming soon"
                            >
                              Complete Appointment
                            </button>
                          )}
                        </div>
                      ) : (
                        (appt.status === 'confirmed' || appt.status === 'pending' || appt.status === 'in_clinic') && (
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {(appt.status === 'confirmed' || appt.status === 'pending') && (
                              <>
                                <button
                                  onClick={() => handleCheckIn(appt._id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-500 transition-all duration-200"
                                >
                                  Check-in
                                </button>
                                <button
                                  onClick={() => setRescheduleTarget(appt)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#7FA5A3]/5 hover:border-[#5A8280] transition-all duration-200"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}
                            {(appt.status === 'confirmed' || appt.status === 'in_clinic') && (
                              <button
                                onClick={() => handleCancel(appt._id)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 transition-all duration-200"
                              >
                                Cancel
                              </button>
                            )}
                            {(appt.status === 'confirmed' || appt.status === 'pending') && appt.ownerId?.isGuest && appt.ownerId?.claimStatus !== 'claimed' && (
                              appt.ownerId?.claimStatus === 'unclaimable' ? (
                                <button
                                  onClick={() => handleOpenGuestEmailModal(appt)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3" /> Add Email
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendGuestInvite(appt)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-500 transition-all duration-200 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" /> Send Invite
                                </button>
                              )
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ---- EMPTY STATE ---- */
          <div className="md:max-h-[calc(100vh-24rem)] md:overflow-y-auto md:pr-2 md:pb-2 scroll-smooth">
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
        userClinicBranchId={user?.clinicBranchId}
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

      {/* Cancel Confirmation Modal */}
      <Dialog open={appointmentToCancel !== null} onOpenChange={(open) => { if (!open) setAppointmentToCancel(null) }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[#FEE2E2] rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-[#900B09]" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-center text-[#2C3E2D] mb-2">Cancel Appointment?</DialogTitle>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAppointmentToCancel(null)}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-[#2C3E2D] font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Keep It
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#900B09] text-white font-medium rounded-xl hover:bg-[#7A0A08] transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Appointment'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-in Confirmation Modal */}
      <Dialog open={appointmentToCheckIn !== null} onOpenChange={(open) => { if (!open) setAppointmentToCheckIn(null) }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <LogIn className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-center text-[#2C3E2D] mb-2">Check Patient In?</DialogTitle>
            <p className="text-sm text-gray-600 text-center mb-6">
              Confirm that this patient has arrived and is now in the clinic.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAppointmentToCheckIn(null)}
                disabled={checkInSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-[#2C3E2D] font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckIn}
                disabled={checkInSubmitting}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkInSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Checking In...
                  </>
                ) : (
                  'Check In'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFC/QR Scan Check-in Modal */}
      <Dialog open={nfcScanModalOpen} onOpenChange={(open) => {
        if (!open) {
          stopNfcScanning()
          setNfcScanModalOpen(false)
        } else {
          setNfcScanningActive(true)
          startNfcScan()
        }
      }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-center text-[#2C3E2D] mb-2">Scan Pet Check-in</DialogTitle>
            <p className="text-sm text-gray-600 text-center mb-6">
              Tap the NFC tag to automatically check the patient in. You can scan multiple patients.
            </p>

            {nfcScanningActive ? (
              <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-pulse">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-blue-700">Ready to scan...</p>
                  <p className="text-xs text-blue-600 text-center">Hold pet tag near the NFC reader</p>
                </div>
              </div>
            ) : null}

            {scanError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-700 mb-1">Scan Failed</p>
                <p className="text-xs text-red-600">{scanError}</p>
              </div>
            )}

            {isCheckingInFromScan && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-medium text-amber-700">Processing scan...</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  stopNfcScanning()
                  setNfcScanModalOpen(false)
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-[#2C3E2D] font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Close
              </button>
              {!nfcScanningActive ? (
                <button
                  onClick={() => {
                    setNfcScanningActive(true)
                    setScanError('')
                    startNfcScan()
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm"
                >
                  Retry Scan
                </button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Guest Email + Send Invite Modal */}
      <Dialog open={guestEmailModalOpen} onOpenChange={(open) => { if (!open) { setGuestEmailModalOpen(false); setGuestInviteTarget(null) } }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-center text-[#2C3E2D] mb-1">Update Email & Send Invite</DialogTitle>
            <p className="text-sm text-gray-500 text-center mb-5">
              Add an email for <strong>{guestInviteTarget?.ownerId?.firstName} {guestInviteTarget?.ownerId?.lastName}</strong> so they can claim their records.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[#2C3E2D] block mb-1.5">Email address</label>
                <input
                  type="email"
                  value={guestEmailValue}
                  onChange={(e) => setGuestEmailValue(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] transition-colors"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={guestEmailSendInvite}
                  onClick={() => setGuestEmailSendInvite((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${guestEmailSendInvite ? 'bg-purple-500' : 'bg-gray-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${guestEmailSendInvite ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-[#4F4F4F]">Send claim invite email immediately</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setGuestEmailModalOpen(false); setGuestInviteTarget(null) }}
                disabled={guestEmailSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-[#2C3E2D] font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitGuestEmail}
                disabled={guestEmailSubmitting || !guestEmailValue.trim()}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {guestEmailSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                ) : guestEmailSendInvite ? 'Save & Send Invite' : 'Save Email'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  userClinicBranchId,
}: {
  open: boolean
  onClose: () => void
  onBooked: (bookedDate?: string) => void
  clinic: ClinicInfo | null
  branches: ClinicBranchItem[]
  userClinicBranchId?: string | null
}) {
  const { token } = useAuthStore()
  const currentYear = new Date().getFullYear()
  const user = useAuthStore((state) => state.user)
  const isClinicAdmin = user?.userType === 'clinic-admin'

  // Form state
  const [selectedOwner, setSelectedOwner] = useState<PetOwner | null>(null)
  const [ownerPets, setOwnerPets] = useState<{ _id: string; name: string; species: string; breed: string; photo: string | null; isLost: boolean; isAlive: boolean; isConfined: boolean; status: 'alive' | 'lost' | 'deceased' | 'confined'; deceasedAt?: string | null }[]>([])
  const [branchVets, setBranchVets] = useState<BranchVet[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [loadingVets, setLoadingVets] = useState(false)
  const [loadingPets, setLoadingPets] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedVetId, setSelectedVetId] = useState('')
  const [mode, setMode] = useState('face-to-face')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsIsClosed, setSlotsIsClosed] = useState(false)
  const [isAutoSelectingDate, setIsAutoSelectingDate] = useState(false)
  const [noAvailableDatesMessage, setNoAvailableDatesMessage] = useState('')
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false)
  const [isWalkIn, setIsWalkIn] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Guest intake mode
  const [isGuestMode, setIsGuestMode] = useState(false)
  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestContact, setGuestContact] = useState('')
  const [guestPetName, setGuestPetName] = useState('')
  const [guestPetSpecies, setGuestPetSpecies] = useState<'canine' | 'feline' | ''>('')
  const [guestPetBreed, setGuestPetBreed] = useState('')
  const [guestPetSex, setGuestPetSex] = useState<'male' | 'female' | ''>('')
  const [guestPetDob, setGuestPetDob] = useState('')
  const [guestPetWeight, setGuestPetWeight] = useState('')
  const [guestPetSterilization, setGuestPetSterilization] = useState('')

  const groomingTypeValues = new Set([
    'basic-grooming',
    'full-grooming',
    ...serviceCategories
      .filter((cat: any) => cat?.id === 'grooming' || String(cat?.label || '').toLowerCase().includes('groom'))
      .flatMap((cat: any) => (cat?.services || []).map((service: any) => service.value)),
  ])

  // Helper: grooming/medical checks
  const hasGrooming = selectedTypes.some((type) => groomingTypeValues.has(type))
  const hasMedical = selectedTypes.some((type) => !groomingTypeValues.has(type))
  const isGroomingOnly = hasGrooming && !hasMedical
  const selectedPet = ownerPets.find((pet) => pet._id === selectedPetId) || null
  const selectedPetIsDeceased = !!(selectedPet && (!selectedPet.isAlive || selectedPet.status === 'deceased'))
  const selectedPetIsLost = !!selectedPet?.isLost
  const selectedPetIsConfined = !!(selectedPet?.isConfined || selectedPet?.status === 'confined')
  const selectedVet = branchVets.find((vet) => vet._id === selectedVetId) || null
  const selectedVetUnavailableAfter = selectedVet?.unavailableAfter ? new Date(selectedVet.unavailableAfter) : null
  const selectedDateObj = selectedDate ? new Date(selectedDate) : null
  const isSelectedDateBeyondVetEnd = !!(
    selectedVetUnavailableAfter &&
    selectedDateObj &&
    selectedDateObj > new Date(new Date(selectedVetUnavailableAfter).setHours(23, 59, 59, 999))
  )

  const formatYmd = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const canUseSlot = (dateYmd: string, slot: TimeSlot) => {
    if (slot.status !== 'available') return false
    const todayYmd = formatYmd(new Date())
    if (dateYmd !== todayYmd) return true

    const now = new Date()
    const [slotHour, slotMin] = slot.startTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return slotMinutes > nowMinutes
  }

  const fetchSlotsForDate = async (dateYmd: string) => {
    if (isGroomingOnly) {
      return authenticatedFetch(
        `/appointments/grooming-slots?branchId=${selectedBranchId}&date=${dateYmd}`,
        { method: 'GET' },
        token || undefined
      )
    }
    return getAvailableSlots(selectedVetId, dateYmd, token || undefined, selectedBranchId || undefined)
  }
  
  // For clinic admins, lock branch to their assigned branch
  const adminBranch = isClinicAdmin && userClinicBranchId 
    ? branches.find(b => b._id === userClinicBranchId)
    : null

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

  // Load slots when vet + date change (or grooming + branch + date change)
  useEffect(() => {
    const shouldLoadSlots = isGroomingOnly ? (selectedBranchId && selectedDate) : (selectedVetId && selectedDate)
    if (!shouldLoadSlots) { setSlots([]); setSlotsIsClosed(false); return }
    const load = async () => {
      setLoadingSlots(true)
      try {
        let res
        if (isGroomingOnly) {
          res = await authenticatedFetch(
            `/appointments/grooming-slots?branchId=${selectedBranchId}&date=${selectedDate}`,
            { method: 'GET' },
            token || undefined
          )
        } else {
          res = await getAvailableSlots(selectedVetId, selectedDate, token || undefined, selectedBranchId || undefined)
        }
        if (res.status === 'SUCCESS' && res.data) {
          setSlotsIsClosed(res.data.isClosed ?? false)
          setSlots(res.data.slots ?? [])
        } else {
          setSlotsIsClosed(false)
          setSlots([])
        }
      } catch { setSlotsIsClosed(false); setSlots([]) }
      finally { setLoadingSlots(false) }
    }
    load()
  }, [selectedVetId, selectedDate, selectedBranchId, token, isGroomingOnly])

  useEffect(() => {
    if (!open) return
    setHasAutoSelectedDate(false)
    setNoAvailableDatesMessage('')
  }, [open, selectedBranchId, selectedVetId, isGroomingOnly, mode, selectedTypes.join('|')])

  useEffect(() => {
    const shouldFindDate = open
      && !hasAutoSelectedDate
      && !!mode
      && selectedTypes.length > 0
      && !!selectedBranchId
      && (isGroomingOnly || !!selectedVetId)

    if (!shouldFindDate) return

    let cancelled = false
    const findEarliestAvailableDate = async () => {
      setIsAutoSelectingDate(true)
      setNoAvailableDatesMessage('')
      const start = new Date()
      start.setHours(0, 0, 0, 0)

      try {
        for (let offset = 0; offset < 60; offset += 1) {
          const candidateDate = new Date(start)
          candidateDate.setDate(start.getDate() + offset)
          const candidateYmd = formatYmd(candidateDate)

          const res = await fetchSlotsForDate(candidateYmd)
          if (cancelled || res.status !== 'SUCCESS' || !res.data) continue
          if (res.data.isClosed) continue

          const dateSlots: TimeSlot[] = res.data.slots || []
          const hasBookableSlot = dateSlots.some((slot) => canUseSlot(candidateYmd, slot))
          if (!hasBookableSlot) continue

          setSelectedDate(candidateYmd)
          setSelectedSlot(null)
          setNoAvailableDatesMessage('')
          setHasAutoSelectedDate(true)
          return
        }

        setSelectedDate('')
        setSelectedSlot(null)
        setSlots([])
        setSlotsIsClosed(false)
        setNoAvailableDatesMessage('No available appointment dates at the moment.')
        setHasAutoSelectedDate(true)
      } finally {
        if (!cancelled) setIsAutoSelectingDate(false)
      }
    }

    findEarliestAvailableDate()

    return () => {
      cancelled = true
    }
  }, [open, hasAutoSelectedDate, mode, selectedTypes, selectedBranchId, selectedVetId, isGroomingOnly, token])

  // Reset types when mode changes
  useEffect(() => {
    if (mode === 'online') {
      setSelectedTypes(['consultation'])
    } else {
      setSelectedTypes([])
    }
  }, [mode])

  // Emergency appointments are always face-to-face.
  useEffect(() => {
    if (isEmergency && mode !== 'face-to-face') {
      setMode('face-to-face')
    }
  }, [isEmergency, mode])

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
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSelectedDate(formatYmd(tomorrow))
      setSelectedOwner(null)
      setOwnerPets([])
      setSelectedPetId('')
      setSelectedBranchId('')
      setSelectedVetId('')
      setMode('face-to-face')
      setSelectedTypes([])
      setSelectedSlot(null)
      setSlots([])
      setBranchVets([])
      setSlotsIsClosed(false)
      setIsWalkIn(false)
      setIsEmergency(false)
      setIsAutoSelectingDate(false)
      setNoAvailableDatesMessage('')
      setHasAutoSelectedDate(false)
    } else {
      // Auto-set branch for clinic admins
      if (isClinicAdmin && adminBranch && !selectedBranchId) {
        setSelectedBranchId(adminBranch._id)
      }
      
      // Load services when modal opens
      const loadServices = async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
          const res = await fetch(
            `${apiUrl}/product-services?type=Service`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          )
          const data = await res.json()
          if (data.status === 'SUCCESS' && data.data?.items) {
            // Group by category dynamically — no hardcoding needed
            const grouped: Record<string, any[]> = {}
            for (const item of data.data.items) {
              const cat = item.category || 'Other'
              if (!grouped[cat]) grouped[cat] = []
              grouped[cat].push(item)
            }
            const formatted = Object.entries(grouped).map(([cat, items]) => ({
              id: cat.toLowerCase().replace(/\s+/g, '-'),
              label: cat,
              services: items.map((item: any) => ({ value: normalizeAppointmentType(item.name), label: item.name })),
            }))
            setServiceCategories(formatted)
          }
        } catch { /* silent */ }
      }
      loadServices()
    }
  }, [open, token, isClinicAdmin, adminBranch, selectedBranchId])

  // Build branch options (only the admin's clinic branches)
  const branchOptions = branches.map((branch) => ({
    value: branch._id,
    label: branch.name,
  }))

  const handleTypeChange = (types: string[]) => {
    setSelectedTypes(types.map(normalizeAppointmentType))
    // When types change, always clear slot (user must reselect time)
    setSelectedSlot(null)
    // If switching to grooming-only, clear vet selection since grooming doesn't require a vet
    const normalizedTypes = types.map(normalizeAppointmentType)
    const nowGroomingOnly = normalizedTypes.some((type) => groomingTypeValues.has(type)) &&
      !normalizedTypes.some((type) => !groomingTypeValues.has(type))
    if (nowGroomingOnly && selectedVetId) {
      setSelectedVetId('')
    }
  }

  const handleSubmit = async () => {
    // ── Guest intake path ────────────────────────────────────────────────────
    if (isGuestMode) {
      if (!guestFirstName.trim()) return toast.error('Owner first name is required')
      if (!guestLastName.trim()) return toast.error('Owner last name is required')
      if (!guestPetName.trim()) return toast.error('Pet name is required')
      if (!guestPetSpecies) return toast.error('Pet species is required')
      if (!guestPetBreed.trim()) return toast.error('Pet breed is required')
      if (!guestPetSex) return toast.error('Pet sex is required')
      if (!guestPetDob) return toast.error('Pet date of birth is required')
      if (!guestPetWeight || Number(guestPetWeight) <= 0) return toast.error('Pet weight is required')
      if (!guestPetSterilization) return toast.error('Pet sterilization status is required')
      if (!selectedBranchId) return toast.error('Please select a clinic branch')
      if (!isGroomingOnly && !selectedVetId) return toast.error('Please select a veterinarian')
      if (!isEmergency && selectedTypes.length === 0) return toast.error('Please select at least one appointment type')
      if (!selectedSlot) return toast.error('Please select a time slot')

      setSubmitting(true)
      try {
        const normalizedTypes = isEmergency ? ['consultation'] : selectedTypes.map(normalizeAppointmentType)
        const guestData: any = {
          ownerFirstName: guestFirstName.trim(),
          ownerLastName: guestLastName.trim(),
          ownerEmail: guestEmail.trim() || undefined,
          ownerContact: guestContact.trim() || undefined,
          petName: guestPetName.trim(),
          petSpecies: guestPetSpecies,
          petBreed: guestPetBreed.trim(),
          petSex: guestPetSex,
          petDateOfBirth: guestPetDob,
          petWeight: Number(guestPetWeight),
          petSterilization: guestPetSterilization,
          clinicBranchId: selectedBranchId,
          mode: 'face-to-face',
          types: normalizedTypes,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          isWalkIn: isEmergency ? true : isWalkIn,
          isEmergency,
          notes: undefined,
        }
        if (selectedVetId) guestData.vetId = selectedVetId

        const res = await createGuestIntakeAppointment(guestData, token || undefined)

        if (res.status === 'SUCCESS') {
          const branch = branches.find(b => b._id === selectedBranchId)
          const branchName = branch?.name || 'the clinic'
          const appointmentDate = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const claimStatus = res.data?.guestOwner?.claimStatus
          const inviteSent = res.data?.inviteSent

          toast(
            <div className="flex gap-2">
              <UserPlus className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Guest Appointment Created</p>
                <p className="text-sm text-gray-600">
                  {guestPetName} ({guestFirstName} {guestLastName}) — {branchName} on {appointmentDate}.
                  {inviteSent
                    ? ' Claim invite sent to owner\'s email.'
                    : claimStatus === 'unclaimable'
                      ? ' No email provided — use "Add Email" to send an invite later.'
                      : ' Owner can be invited to claim records.'}
                </p>
              </div>
            </div>,
            { duration: 7000 }
          )

          if (res.data?.nameDuplicateWarning) {
            toast(
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">Duplicate name warning</p>
                  <p className="text-sm text-amber-700">{res.data.nameDuplicateWarning}</p>
                </div>
              </div>,
              { duration: 8000 }
            )
          }

          const rescheduled: any[] = res.data?.rescheduledAppointments ?? []
          if (isEmergency && rescheduled.length > 0) {
            toast(
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">Appointments rescheduled</p>
                  <p className="text-sm text-amber-700">{rescheduled.length} appointment{rescheduled.length > 1 ? 's were' : ' was'} rescheduled for the emergency. Owners have been notified.</p>
                </div>
              </div>,
              { duration: 10000 }
            )
          }

          onBooked(selectedDate)
        } else {
          toast.error(res.message || 'Failed to create guest appointment')
        }
      } catch {
        toast.error('An error occurred')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // ── Regular (existing owner) path ────────────────────────────────────────
    if (!selectedOwner) return toast.error('Please select a pet owner')
    if (!selectedPetId) return toast.error('Please select a pet')
    if (selectedPetIsDeceased) return toast.error('Appointments cannot be scheduled for pets marked as deceased.')
    if (selectedPetIsLost) return toast.error('Appointments cannot be scheduled for pets marked as lost.')
    if (selectedPetIsConfined) return toast.error('Appointments cannot be scheduled for pets currently in confinement.')
    if (!selectedBranchId) return toast.error('Please select a clinic branch')
    if (!isGroomingOnly && !selectedVetId) return toast.error('Please select a veterinarian')
    if (!isGroomingOnly && isSelectedDateBeyondVetEnd && selectedVetUnavailableAfter) {
      return toast.error(`Vet unavailable after ${selectedVetUnavailableAfter.toLocaleDateString('en-US')}`)
    }
    if (!mode) return toast.error('Please select a mode of appointment')
    if (!isEmergency && selectedTypes.length === 0) return toast.error('Please select at least one appointment type')
    if (!selectedSlot) return toast.error('Please select a time slot')

    setSubmitting(true)
    try {
      // Normalize types to valid enum values; emergency defaults to consultation
      const normalizedTypes = isEmergency ? ['consultation'] : selectedTypes.map(normalizeAppointmentType)

      // For grooming-only, don't send vetId; backend will set it to null
      const appointmentData: any = {
        ownerId: selectedOwner._id,
        petId: selectedPetId,
        clinicId: clinic?._id || '',
        clinicBranchId: selectedBranchId,
        mode: mode as 'online' | 'face-to-face',
        types: normalizedTypes,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        isWalkIn,
        isEmergency,
      }

      // Only include vetId if it has a value (medical appointments)
      if (selectedVetId) {
        appointmentData.vetId = selectedVetId
      }

      const res = await createClinicAppointment(appointmentData, token || undefined)

      if (res.status === 'SUCCESS') {
        // Get pet name and branch info for toast
        const pet = ownerPets.find(p => p._id === selectedPetId)
        const branch = branches.find(b => b._id === selectedBranchId)

        const petName = pet?.name || 'the pet'
        const branchName = branch?.name || 'the clinic'
        const appointmentDate = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

        toast(
          <div className="flex gap-2">
            <Calendar className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">New Appointment Scheduled</p>
              <p className="text-sm text-gray-600">A new appointment for {petName} has been scheduled at {branchName} on {appointmentDate}.</p>
            </div>
          </div>,
          { duration: 5000 }
        )

        // If emergency, warn about displaced appointments
        const rescheduled: any[] = res.data?.rescheduledAppointments ?? []
        if (isEmergency && rescheduled.length > 0) {
          const names = rescheduled
            .map((a: any) => `${a.petId?.name || 'Pet'} (${a.ownerId?.firstName || ''} ${a.ownerId?.lastName || ''})`)
            .join(', ')
          toast(
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Appointments rescheduled</p>
                <p className="text-sm text-amber-700">{rescheduled.length} appointment{rescheduled.length > 1 ? 's were' : ' was'} automatically rescheduled to accommodate the emergency: {names}. Owners have been notified.</p>
              </div>
            </div>,
            { duration: 10000 }
          )
        }

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

  // Check if a time slot has already passed
  const isPastSlot = (slotStartTime: string): boolean => {
    const today = new Date()
    const todayYmd = today.toISOString().split('T')[0]
    
    // If not today, slot is not in the past
    if (selectedDate !== todayYmd) return false
    
    // Compare times
    const [slotHour, slotMin] = slotStartTime.split(':')
    const currentHour = today.getHours()
    const currentMin = today.getMinutes()
    
    const slotTimeInMinutes = parseInt(slotHour) * 60 + parseInt(slotMin)
    const currentTimeInMinutes = currentHour * 60 + currentMin
    
    return slotTimeInMinutes <= currentTimeInMinutes
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-225 max-h-[95vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">Schedule Appointment</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2 shrink-0">
          <h2 className="text-2xl text-[#476B6B]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
            Schedule Appointment
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Mode toggle: Regular vs Guest Intake */}
        <div className="px-8 pb-1 pt-2 shrink-0">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setIsGuestMode(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!isGuestMode ? 'bg-white shadow-sm text-[#2C3E2D]' : 'text-gray-500 hover:text-[#2C3E2D]'}`}
            >
              <Users className="w-4 h-4" />
              Existing Owner
            </button>
            <button
              type="button"
              onClick={() => { setIsGuestMode(true); setIsWalkIn(true) }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${isGuestMode ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-[#2C3E2D]'}`}
            >
              <UserPlus className="w-4 h-4" />
              Guest Intake
            </button>
          </div>
          {isGuestMode && (
            <p className="text-xs text-purple-600 mt-1.5">Walk-in or emergency patient with no PawSync account. Records will be marked as Guest/Unclaimed.</p>
          )}
        </div>

        <div className="flex px-8 pb-4 pt-4 gap-8 overflow-y-auto flex-1">
          {/* Left: Form Fields */}
          <div className="flex-1 space-y-5">
            {!isGuestMode && selectedPetIsDeceased && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium">⚠️ This pet is marked as deceased</p>
                <p className="text-xs text-amber-700 mt-1">Appointments cannot be scheduled for deceased pets.</p>
              </div>
            )}

            {!isGuestMode && selectedPetIsLost && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">⚠️ This pet is marked as lost</p>
                <p className="text-xs text-yellow-700 mt-1">Appointments cannot be scheduled for lost pets. Please update their status once they are found.</p>
              </div>
            )}

            {!isGuestMode && selectedPetIsConfined && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium">⚠️ This pet is currently confined</p>
                <p className="text-xs text-blue-700 mt-1">Appointments cannot be scheduled while a pet is under confinement.</p>
              </div>
            )}

            {/* ── Guest Intake Form ─────────────────────────────────────────── */}
            {isGuestMode ? (
              <div className="space-y-4">
                {/* Owner Info */}
                <div>
                  <p className="text-sm font-bold text-[#2C3E2D] mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Owner Information
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">First Name <span className="text-red-500">*</span></label>
                      <input type="text" value={guestFirstName} onChange={e => setGuestFirstName(e.target.value)} placeholder="First name" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Last Name <span className="text-red-500">*</span></label>
                      <input type="text" value={guestLastName} onChange={e => setGuestLastName(e.target.value)} placeholder="Last name" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Email <span className="text-gray-400 font-normal">(optional — needed to send invite)</span></label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="owner@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Contact Number <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="tel" value={guestContact} onChange={e => setGuestContact(e.target.value)} placeholder="09xxxxxxxxx" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                  </div>
                  {!guestEmail.trim() && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Without email, owner status will be <strong>Unclaimable</strong> until updated later.
                    </p>
                  )}
                </div>

                {/* Pet Info */}
                <div>
                  <p className="text-sm font-bold text-[#2C3E2D] mb-2 flex items-center gap-1.5">
                    <PawPrint className="w-4 h-4" /> Pet Information
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Pet Name <span className="text-red-500">*</span></label>
                      <input type="text" value={guestPetName} onChange={e => setGuestPetName(e.target.value)} placeholder="e.g. Buddy" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <Dropdown label="Species *" value={guestPetSpecies} placeholder="Select species" options={[{ value: 'canine', label: 'Canine (Dog)' }, { value: 'feline', label: 'Feline (Cat)' }]} onSelect={(v) => { setGuestPetSpecies(v as 'canine' | 'feline'); setGuestPetBreed('') }} />
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Breed <span className="text-red-500">*</span></label>
                      <BreedCombobox species={guestPetSpecies || null} value={guestPetBreed} onChange={setGuestPetBreed} placeholder="Select Breed *" />
                    </div>
                    <Dropdown label="Sex *" value={guestPetSex} placeholder="Select sex" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} onSelect={(v) => { setGuestPetSex(v as 'male' | 'female'); setGuestPetSterilization('') }} />
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" value={guestPetDob} onChange={e => setGuestPetDob(e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Weight (kg) <span className="text-red-500">*</span></label>
                      <input type="number" min="0.1" step="0.1" value={guestPetWeight} onChange={e => setGuestPetWeight(e.target.value)} placeholder="e.g. 5.5" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3]" />
                    </div>
                    <Dropdown
                      label="Sterilization *"
                      value={guestPetSterilization}
                      placeholder={guestPetSex ? 'Select status' : 'Select sex first'}
                      options={
                        guestPetSex === 'female'
                          ? [{ value: 'spayed', label: 'Spayed' }, { value: 'unspayed', label: 'Unspayed' }]
                          : guestPetSex === 'male'
                          ? [{ value: 'neutered', label: 'Neutered' }, { value: 'unneutered', label: 'Unneutered' }]
                          : []
                      }
                      onSelect={setGuestPetSterilization}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Owner Search (full width) — regular mode */
              <OwnerSearch
                value={selectedOwner}
                onSelect={setSelectedOwner}
                token={token}
              />
            )}

            {/* Row 1: Pet + Mode — only shown for regular (non-guest) mode */}
            {!isGuestMode && (
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
                    disabledOptions={ownerPets.filter((pet) => pet.isLost || !pet.isAlive || pet.status === 'deceased' || pet.isConfined || pet.status === 'confined').map((pet) => pet._id)}
                    disabledReasonByValue={Object.fromEntries(
                      ownerPets
                        .filter((pet) => pet.isLost || !pet.isAlive || pet.status === 'deceased' || pet.isConfined || pet.status === 'confined')
                        .map((pet) => [
                          pet._id,
                          !pet.isAlive || pet.status === 'deceased'
                            ? 'Deceased Pet'
                            : (pet.isConfined || pet.status === 'confined')
                              ? 'Confined Pet'
                              : 'Lost Pet',
                        ])
                    )}
                    onSelect={setSelectedPetId}
                  />
                )}
                <Dropdown
                  label="Mode of Appointment"
                  value={mode}
                  placeholder="Select mode"
                  options={appointmentModes.map((m) => ({ value: m.value, label: m.label }))}
                  disabled={isEmergency}
                  onSelect={setMode}
                />
              </div>
            )}

            {/* Row 2: Branch + Vet */}
            <div className="grid grid-cols-2 gap-4">
              {isClinicAdmin && adminBranch ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Vet Clinic Branch</p>
                  <div className="flex items-center justify-between px-4 py-2.5 border border-[#7FA5A3] rounded-xl bg-[#7FA5A3]/5">
                    <span className="text-sm text-[#4F4F4F] font-medium">
                      {adminBranch.name}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#7FA5A3]/20 text-[#5A7C7A] font-medium">
                      Your Branch
                    </span>
                  </div>
                </div>
              ) : (
                <Dropdown
                  label="Vet Clinic Branch"
                  value={selectedBranchId}
                  placeholder="Select branch"
                  options={branchOptions}
                  onSelect={setSelectedBranchId}
                />
              )}
              {isGroomingOnly ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    Not applicable for grooming only
                  </div>
                </div>
              ) : !selectedBranchId ? (
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
                  options={branchVets.map((v) => ({
                    value: v._id,
                    label: v.unavailableAfter
                      ? `Dr. ${v.firstName} ${v.lastName} (Resigning • Unavailable after ${new Date(v.unavailableAfter).toLocaleDateString('en-US')})`
                      : v.resignationStatus === 'pending'
                        ? `Dr. ${v.firstName} ${v.lastName} (Resignation pending)`
                        : `Dr. ${v.firstName} ${v.lastName}`
                  }))}
                  onSelect={setSelectedVetId}
                />
              )}
            </div>

            {!isGroomingOnly && isSelectedDateBeyondVetEnd && selectedVetUnavailableAfter && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Vet unavailable after {selectedVetUnavailableAfter.toLocaleDateString('en-US')}. Choose another veterinarian or earlier date.
              </div>
            )}

            {/* Walk-In / Emergency Toggles */}
            <div className="space-y-2.5">
              {/* Walk-In Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isWalkIn}
                  onClick={() => { if (!isEmergency) setIsWalkIn((v) => !v) }}
                  disabled={isEmergency}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${isEmergency ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${isWalkIn ? 'bg-[#7FA5A3]' : 'bg-gray-200'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isWalkIn ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className={`text-sm font-semibold ${isEmergency ? 'text-gray-400' : 'text-[#2C3E2D]'}`}>Walk-in patient</span>
                {isWalkIn && !isEmergency && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Walk-In</span>
                )}
              </div>

              {/* Emergency Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEmergency}
                  onClick={() => {
                    const next = !isEmergency
                    setIsEmergency(next)
                    if (next) {
                      setIsWalkIn(true)
                      setMode('face-to-face')
                    } else {
                      if (selectedSlot && slots.find(s => s.startTime === selectedSlot.startTime)?.status !== 'available') {
                        setSelectedSlot(null)
                      }
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isEmergency ? 'bg-red-500' : 'bg-gray-200'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isEmergency ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-sm font-semibold text-[#2C3E2D]">Emergency</span>
                {isEmergency && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Emergency</span>
                )}
              </div>

              {/* Emergency warning */}
              {isEmergency && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">This will override any existing booking for the selected time slot. Affected appointments will be flagged for review after saving.</p>
                </div>
              )}
            </div>

            {/* Type of Appointment */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Type of Appointment</p>
              {isEmergency ? (
                <div className="px-4 py-2.5 border border-red-300 rounded-xl bg-red-50 text-sm text-red-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Emergency
                </div>
              ) : !mode ? (
                <div className="px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                  Select mode first
                </div>
              ) : mode === 'online' ? (
                <div className="px-4 py-2.5 border border-[#7FA5A3] rounded-xl bg-[#7FA5A3]/5 text-sm text-[#5A7C7A] font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Consultation
                </div>
              ) : (
                <AppointmentServiceSelector
                  values={selectedTypes}
                  onChange={handleTypeChange}
                  categories={serviceCategories}
                />
              )}
            </div>
          </div>

          {/* Right: Time Table */}
          <div className="w-65 shrink-0">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 h-full flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Date</p>
                <DatePicker
                  value={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date)
                    setSelectedSlot(null)
                    setNoAvailableDatesMessage('')
                    setHasAutoSelectedDate(true)
                  }}
                  placeholder="Select a date"
                  allowFutureDates={true}
                  minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                  fromYear={currentYear}
                  toYear={currentYear + 20}
                />
              </div>

              {isAutoSelectingDate && (
                <p className="text-xs text-[#5A7C7A] text-center">Finding the earliest available appointment date...</p>
              )}

              {noAvailableDatesMessage && (
                <p className="text-xs text-[#900B09] text-center">{noAvailableDatesMessage}</p>
              )}

              <div className="border-t border-gray-200" />

              {!selectedBranchId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a clinic branch to view available slots</p>
                </div>
              ) : !isGroomingOnly && !selectedVetId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a veterinarian to view available slots</p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : slotsIsClosed ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">{isGroomingOnly ? 'Groomer' : 'Vet'} is not available on this date</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">No available slots for this date</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                    <div className="flex flex-col gap-1">
                    {Object.entries(slotsByHour).map(([hour, hourSlots]) => (
                      <div key={hour} className="flex gap-2">
                        <div className="w-10 shrink-0 text-right pt-1">
                          <span className="-ml-0.75 text-[10px] font-medium text-gray-400">
                            {parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}{parseInt(hour) >= 12 ? 'PM' : 'AM'}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          {hourSlots.map((slot) => {
                            const isSelected = selectedSlot?.startTime === slot.startTime
                            const isPast = isPastSlot(slot.startTime)
                            const isAvailable = slot.status === 'available' && !isPast
                            const isUnavailable = slot.status === 'unavailable' || slot.status === 'your-booking' || isPast
                            const isOverridable = isEmergency && isUnavailable && !isPast

                            let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                            if (isUnavailable && !isOverridable) bg = 'bg-[#900B09] text-white cursor-default'
                            if (isOverridable) bg = 'bg-amber-400 hover:bg-amber-500 cursor-pointer text-white'
                            if (isSelected) bg = 'bg-gray-300 text-gray-600 cursor-pointer'

                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => { if (isAvailable || isOverridable) setSelectedSlot(slot) }}
                                disabled={!isAvailable && !isOverridable}
                                className={`w-full h-8 px-3 rounded-lg text-xs leading-none font-medium transition-all ${bg}`}
                              >
                                {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-gray-200 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#7FA5A3]" />
                      <span className="text-[10px] text-gray-500">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      <span className="text-[10px] text-gray-500">Booked</span>
                    </div>
                    {isEmergency ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-[10px] text-gray-500">Override</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#900B09]" />
                        <span className="text-[10px] text-gray-500">Unavailable</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-center gap-4 px-8 py-4 shrink-0 border-t border-gray-100">
          <button
            onClick={handleSubmit}
            disabled={submitting || (!isGuestMode && (selectedPetIsLost || selectedPetIsDeceased || selectedPetIsConfined))}
            className={`px-8 py-2.5 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${isGuestMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#7FA5A3] hover:bg-[#6b9391]'}`}
          >
            {submitting ? (isGuestMode ? 'Creating...' : 'Booking...') : isGuestMode ? 'Create Guest Appointment' : 'Set an appointment'}
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
  const currentYear = new Date().getFullYear()
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [rescheduleIsClosed, setRescheduleIsClosed] = useState(false)
  const [isAutoSelectingDate, setIsAutoSelectingDate] = useState(false)
  const [noAvailableDatesMessage, setNoAvailableDatesMessage] = useState('')
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isGroomingOnly = useMemo(() => {
    if (!appointment?.types?.length) return false
    const hasGrooming = appointment.types.some((type) => String(type).toLowerCase().includes('groom'))
    const hasMedical = appointment.types.some((type) => !String(type).toLowerCase().includes('groom'))
    return hasGrooming && !hasMedical
  }, [appointment])

  // Reset state when appointment changes
  useEffect(() => {
    if (appointment) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSelectedDate(tomorrow.toISOString().split('T')[0])
      setSelectedSlot(null)
      setSlots([])
      setRescheduleIsClosed(false)
      setIsAutoSelectingDate(false)
      setNoAvailableDatesMessage('')
      setHasAutoSelectedDate(false)
    }
  }, [appointment])

  // Load slots when date changes.
  // Grooming-only appointments can be rescheduled without a vet assignment.
  useEffect(() => {
    const vetId = appointment?.vetId?._id
    const branchId = appointment?.clinicBranchId?._id || appointment?.clinicBranchId
    if (!selectedDate || (!isGroomingOnly && !vetId) || (isGroomingOnly && !branchId)) {
      setSlots([])
      setRescheduleIsClosed(false)
      return
    }
    const load = async () => {
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        let res
        if (isGroomingOnly) {
          res = await authenticatedFetch(
            `/appointments/grooming-slots?branchId=${branchId}&date=${selectedDate}`,
            { method: 'GET' },
            token || undefined
          )
        } else {
          res = await getAvailableSlots(vetId, selectedDate, token || undefined, branchId || undefined)
        }
        if (res.status === 'SUCCESS' && res.data) {
          setRescheduleIsClosed(res.data.isClosed ?? false)
          setSlots(res.data.slots ?? [])
        } else {
          setRescheduleIsClosed(false)
          setSlots([])
        }
      } catch { setRescheduleIsClosed(false); setSlots([]) }
      finally { setLoadingSlots(false) }
    }
    load()
  }, [appointment, selectedDate, token, isGroomingOnly])

  useEffect(() => {
    if (!appointment || hasAutoSelectedDate) return

    const vetId = appointment?.vetId?._id
    const branchId = appointment?.clinicBranchId?._id || appointment?.clinicBranchId
    if ((!isGroomingOnly && !vetId) || (isGroomingOnly && !branchId)) return

    const formatYmd = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    let cancelled = false
    const findEarliestAvailableDate = async () => {
      setIsAutoSelectingDate(true)
      setNoAvailableDatesMessage('')
      const start = new Date()
      start.setHours(0, 0, 0, 0)

      try {
        for (let offset = 0; offset < 60; offset += 1) {
          const candidateDate = new Date(start)
          candidateDate.setDate(start.getDate() + offset)
          const candidateYmd = formatYmd(candidateDate)

          let res
          if (isGroomingOnly) {
            res = await authenticatedFetch(
              `/appointments/grooming-slots?branchId=${branchId}&date=${candidateYmd}`,
              { method: 'GET' },
              token || undefined
            )
          } else {
            res = await getAvailableSlots(vetId, candidateYmd, token || undefined, branchId || undefined)
          }

          if (cancelled || res.status !== 'SUCCESS' || !res.data) continue
          if (res.data.isClosed) continue

          const todayYmd = formatYmd(new Date())
          const hasBookableSlot = (res.data.slots || []).some((slot: TimeSlot) => {
            if (slot.status !== 'available') return false
            if (candidateYmd !== todayYmd) return true
            const now = new Date()
            const [slotHour, slotMin] = slot.startTime.split(':').map(Number)
            const slotMinutes = slotHour * 60 + slotMin
            const nowMinutes = now.getHours() * 60 + now.getMinutes()
            return slotMinutes > nowMinutes
          })

          if (!hasBookableSlot) continue

          setSelectedDate(candidateYmd)
          setSelectedSlot(null)
          setNoAvailableDatesMessage('')
          setHasAutoSelectedDate(true)
          return
        }

        setSelectedDate('')
        setSelectedSlot(null)
        setSlots([])
        setRescheduleIsClosed(false)
        setNoAvailableDatesMessage('No available appointment dates at the moment.')
        setHasAutoSelectedDate(true)
      } finally {
        if (!cancelled) setIsAutoSelectingDate(false)
      }
    }

    findEarliestAvailableDate()

    return () => {
      cancelled = true
    }
  }, [appointment, token, isGroomingOnly, hasAutoSelectedDate])

  const handleReschedule = async () => {
    if (!appointment || !selectedSlot) return
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      toast.error('Only pending or confirmed appointments can be rescheduled.')
      return
    }
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

  // Check if a time slot has already passed
  const isPastSlot = (slotStartTime: string): boolean => {
    const today = new Date()
    const todayYmd = today.toISOString().split('T')[0]
    
    // If not today, slot is not in the past
    if (selectedDate !== todayYmd) return false
    
    // Compare times
    const [slotHour, slotMin] = slotStartTime.split(':')
    const currentHour = today.getHours()
    const currentMin = today.getMinutes()
    
    const slotTimeInMinutes = parseInt(slotHour) * 60 + parseInt(slotMin)
    const currentTimeInMinutes = currentHour * 60 + currentMin
    
    return slotTimeInMinutes <= currentTimeInMinutes
  }

  return (
    <Dialog open={!!appointment} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-130 p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Reschedule Appointment</DialogTitle>
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
                  <Image src={appointment.petId.photo} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-[#5A7C7A]" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm text-[#4F4F4F]">{appointment.petId?.name || 'Pet'}</p>
                  <p className="text-xs text-gray-500">
                    {appointment.vetId?.firstName
                      ? `Dr. ${appointment.vetId.firstName} ${appointment.vetId?.lastName || ''}`.trim()
                      : 'Grooming service'}
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
              onChange={(date) => {
                setSelectedDate(date)
                setSelectedSlot(null)
                setNoAvailableDatesMessage('')
                setHasAutoSelectedDate(true)
              }}
              placeholder="Select a date"
              allowFutureDates={true}
              minDate={new Date(new Date().setHours(0, 0, 0, 0))}
              fromYear={currentYear}
              toYear={currentYear + 20}
            />
            {isAutoSelectingDate && (
              <p className="text-xs text-[#5A7C7A] mt-2">Finding the earliest available appointment date...</p>
            )}
            {noAvailableDatesMessage && (
              <p className="text-xs text-[#900B09] mt-2">{noAvailableDatesMessage}</p>
            )}
          </div>

          {/* Time Slots */}
          <div>
            <p className="text-sm font-semibold text-[#2C3E2D] mb-2">New Time Slot</p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              {loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rescheduleIsClosed ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-sm text-gray-400 text-center">Vet is not available on this date</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-sm text-gray-400 text-center">No available slots for this date</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-55 space-y-1 pr-1">
                  {Object.entries(slotsByHour).map(([hour, hourSlots]) => (
                    <div key={hour} className="flex gap-2">
                      <div className="w-10 shrink-0 text-right pt-1">
                        <span className="text-[10px] font-medium text-gray-400">
                          {parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}{parseInt(hour) >= 12 ? 'PM' : 'AM'}
                        </span>
                      </div>
                      <div className="flex-1 space-y-1">
                        {hourSlots.map((slot) => {
                          const isSelected = selectedSlot?.startTime === slot.startTime
                          const isPast = isPastSlot(slot.startTime)
                          const isAvailable = slot.status === 'available' && !isPast
                          const isUnavailable = slot.status === 'unavailable' || slot.status === 'your-booking' || isPast

                          let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                          if (isUnavailable) bg = 'bg-[#900B09] text-white cursor-default'
                          if (isSelected) bg = 'bg-gray-300 text-gray-600 cursor-pointer'

                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => { if (isAvailable) setSelectedSlot(slot) }}
                              disabled={!isAvailable}
                              className={`w-full h-8 px-3 rounded-lg text-xs leading-none font-medium transition-all ${bg}`}
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
              <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-gray-200 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7FA5A3]" />
                  <span className="text-[10px] text-gray-500">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="text-[10px] text-gray-500">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#900B09]" />
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
