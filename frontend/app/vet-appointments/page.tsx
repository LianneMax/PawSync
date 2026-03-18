'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  type Appointment,
  checkInAppointment,
  cancelAppointment,
} from '@/lib/appointments'
import { getRecordByAppointment } from '@/lib/medicalRecords'
import MedicalRecordStagedModal from '@/components/MedicalRecordStagedModal'
import WorkingHoursModal from '@/components/WorkingHoursModal'
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Video,
  MapPin,
  X,
  LogIn,
  PlayCircle,
  Pencil,
  Building2,
  CheckCircle,
  Coffee,
  Syringe,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

// ==================== CONSTANTS ====================

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-l-green-500', dot: 'bg-green-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500', dot: 'bg-amber-500' },
  in_clinic: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  in_progress: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-l-indigo-500', dot: 'bg-indigo-500' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-[#F4D3D2]', text: 'text-[#983232]', border: 'border-l-[#983232]', dot: 'bg-[#983232]' },
}

// ==================== HELPERS ====================

function getDisplayStatus(appt: Appointment): string {
  const apptDate = dateOnly(appt.date)
  if (appt.status === 'confirmed') {
    const apptStart = new Date(`${apptDate}T${appt.startTime}`)
    const cancelThreshold = new Date(apptStart.getTime() + 15 * 60 * 1000)
    if (cancelThreshold < new Date()) return 'cancelled'
  }
  if (appt.status === 'in_progress') {
    const apptEnd = new Date(`${apptDate}T${appt.endTime}`)
    if (apptEnd < new Date()) return 'completed'
  }
  return appt.status
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
  }
  
  return displayMap[type] || type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function orderAppointmentTypePills(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const aPriority = a === 'vaccination' ? 1 : 0
    const bPriority = b === 'vaccination' ? 1 : 0
    return aPriority - bPriority
  })
}

// ==================== MAIN PAGE ====================

interface BranchSchedule {
  branchId: string
  branchName: string
  branchAddress: string
  branchOpeningTime: string | null
  branchClosingTime: string | null
  branchOperatingDays: string[]
  schedule: { _id: string; workingDays: string[]; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null } | null
}

function formatScheduleTime(time: string | null) {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`
}

function dateOnly(dateValue: string) {
  return dateValue.includes('T') ? dateValue.split('T')[0] : dateValue
}

export default function VetAppointmentsPage() {
  const { token } = useAuthStore()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarDate, setCalendarDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)
  const [continuingVisit, setContinuingVisit] = useState<string | null>(null)

  // Working hours modal state
  const [workingHoursOpen, setWorkingHoursOpen] = useState(false)
  const [schedules, setSchedules] = useState<BranchSchedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)

  // Staged modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null)
  const [activePetId, setActivePetId] = useState<string | null>(null)
  const [activeAppointmentTypes, setActiveAppointmentTypes] = useState<string[]>([])
  const [activeAppointmentDate, setActiveAppointmentDate] = useState<string | null>(null)

  const loadAppointments = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await authenticatedFetch('/appointments/vet', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.appointments) {
        // Filter out grooming appointments - vets should not see grooming bookings
        const filtered = res.data.appointments.filter((a: Appointment) => {
          const hasGrooming = a.types?.some(t => t === 'basic-grooming' || t === 'full-grooming')
          return !hasGrooming
        })
        setAppointments(filtered)
      }
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  // Update current time every minute
  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const loadSchedules = useCallback(async () => {
    if (!token) return
    setSchedulesLoading(true)
    try {
      const res = await authenticatedFetch('/vet-schedule/mine', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.schedules) {
        setSchedules(res.data.schedules)
      }
    } catch {
      /* silent */
    } finally {
      setSchedulesLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // Filter confirmed + in_progress appointments for the selected calendar date
  const confirmedForDate = appointments.filter((a) => {
    if (a.status !== 'confirmed' && a.status !== 'in_clinic' && a.status !== 'in_progress') return false
    const apptDate = dateOnly(a.date)
    return apptDate === calendarDate
  })

  // Upcoming = confirmed/in_progress and not yet passed, sorted by date asc
  const upcomingAppointments = appointments
    .filter((a) => {
      const ds = getDisplayStatus(a)
      if (ds !== 'confirmed' && ds !== 'in_clinic' && ds !== 'in_progress') return false
      const [year, month, day] = dateOnly(a.date).split('-').map(Number)
      const [hours, minutes] = a.startTime.split(':').map(Number)
      const apptTime = new Date(year, month - 1, day, hours, minutes, 0)
      return apptTime > new Date() // Only include future appointments
    })
    .sort((a, b) => {
      const [yearA, monthA, dayA] = dateOnly(a.date).split('-').map(Number)
      const [hoursA, minutesA] = a.startTime.split(':').map(Number)
      const dateA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA, 0)
      
      const [yearB, monthB, dayB] = dateOnly(b.date).split('-').map(Number)
      const [hoursB, minutesB] = b.startTime.split(':').map(Number)
      const dateB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB, 0)
      
      return dateA.getTime() - dateB.getTime()
    })

  // Previous = completed + cancelled + past-pending (displayed as cancelled), sorted by date desc
  const previousAppointments = appointments
    .filter((a) => {
      const ds = getDisplayStatus(a)
      return ds === 'completed' || ds === 'cancelled'
    })
    .sort((a, b) => {
      const dateA = new Date(`${dateOnly(a.date)}T${a.startTime}`)
      const dateB = new Date(`${dateOnly(b.date)}T${b.startTime}`)
      return dateB.getTime() - dateA.getTime()
    })

  // Stats for today
  const today = (() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()
  const todayAppts = appointments.filter((a) => {
    return dateOnly(a.date) === today
  })
  const todayConfirmed = todayAppts.filter((a) => a.status === 'confirmed' || a.status === 'in_clinic' || a.status === 'in_progress').length
  const todayCompleted = todayAppts.filter((a) => a.status === 'completed').length

  const handleCheckIn = async (appt: Appointment) => {
    if (!token) return
    setCheckingIn(appt._id)
    try {
      const res = await checkInAppointment(appt._id, token)
      if (res.status === 'SUCCESS') {
        const recordId = res.data?.medicalRecordId
        if (recordId) {
          const petId = typeof appt.petId === 'object' ? appt.petId._id : appt.petId
          setActiveRecordId(recordId)
          setActiveAppointmentId(appt._id)
          setActivePetId(petId)
          setActiveAppointmentTypes(appt.types || [])
          setActiveAppointmentDate(appt.date || null)
          setModalOpen(true)
          loadAppointments()
        }
      } else {
        toast.error(res.message || 'Failed to check in patient')
      }
    } finally {
      setCheckingIn(null)
    }
  }

  const handleContinueVisit = async (appt: Appointment) => {
    if (!token) return
    setContinuingVisit(appt._id)
    try {
      const res = await getRecordByAppointment(appt._id, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        const petId = typeof appt.petId === 'object' ? appt.petId._id : appt.petId
        setActiveRecordId(res.data.record._id)
        setActiveAppointmentId(appt._id)
        setActivePetId(petId)
        setActiveAppointmentTypes(appt.types || [])
        setActiveAppointmentDate(appt.date || null)
        setModalOpen(true)
      } else {
        toast.error('Could not find the visit record. Please try again.')
      }
    } finally {
      setContinuingVisit(null)
    }
  }

  const handleModalComplete = () => {
    setModalOpen(false)
    setActiveRecordId(null)
    setActiveAppointmentId(null)
    setActivePetId(null)
    setActiveAppointmentTypes([])
    setActiveAppointmentDate(null)
    loadAppointments()
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setActiveRecordId(null)
    setActiveAppointmentId(null)
    setActivePetId(null)
    setActiveAppointmentTypes([])
    setActiveAppointmentDate(null)
    loadAppointments()
  }

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

  // Calendar navigation
  const goToDay = (offset: number) => {
    const d = new Date(calendarDate)
    d.setDate(d.getDate() + offset)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setCalendarDate(`${year}-${month}-${day}`)
  }

  const goToMonth = (offset: number) => {
    setCalendarMonth((prev) => {
      let m = prev.month + offset
      let y = prev.year
      if (m > 11) { m = 0; y++ }
      if (m < 0) { m = 11; y-- }
      return { year: y, month: m }
    })
  }

  // Build calendar grid for the displayed month
  const { year: calYear, month: calMonthIdx } = calendarMonth
  const firstDayOfMonth = new Date(calYear, calMonthIdx, 1).getDay() // 0=Sun
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate()
  const calMonthLabel = new Date(calYear, calMonthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Set of dates (YYYY-MM-DD) that have upcoming appointments — for the dot indicator
  const datesWithAppointments = new Set(
    appointments
      .filter((a) => a.status === 'confirmed' || a.status === 'in_progress' || a.status === 'pending')
      .map((a) => {
        const d = new Date(a.date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })
  )

  const dateLabel = new Date(calendarDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const hours = Array.from({ length: 11 }, (_, i) => i + 7) // 7AM to 5PM

  // Calculate current time line position
  const isViewingToday = calendarDate === (() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()
  
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const isCurrentTimeVisible = isViewingToday && currentHour >= 7 && currentHour < 17 // 7AM to 5PM
  const timelinePercentage = isCurrentTimeVisible ? ((currentHour - 7 + currentMinute / 60) / 11) * 100 : 0

  return (
    <DashboardLayout userType="veterinarian">
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">My Appointments</h1>
            <p className="text-gray-500 text-sm mt-1">View and manage your scheduled appointments</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E8F2EE] rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#35785C]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#35785C]">{todayConfirmed}</p>
                <p className="text-xs text-gray-500">Appointments Today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C5D8FF] rounded-xl flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-[#4569B1]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#4569B1]">{todayCompleted}</p>
                <p className="text-xs text-gray-500">Completed Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm mb-6">
          {(['upcoming', 'previous'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'upcoming' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: Calendar View */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Date Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <button onClick={() => goToDay(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-[#4F4F4F]">{dateLabel}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {confirmedForDate.length} appointment{confirmedForDate.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => goToDay(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-125 relative">
                  {/* Current Time Line */}
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
                  {hours.map((hour) => {
                    const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
                    const hourAppts = confirmedForDate.filter((a) => {
                      const apptHour = parseInt(a.startTime.split(':')[0])
                      return apptHour === hour
                    })

                    return (
                      <div key={hour} className="flex border-b border-gray-50 min-h-18">
                        {/* Time label */}
                        <div className="w-20 shrink-0 px-3 py-2 text-right">
                          <span className="text-xs text-gray-400 font-medium">{timeLabel}</span>
                        </div>
                        {/* Appointments */}
                        <div className="flex-1 px-3 py-1.5 border-l border-gray-100">
                          {hourAppts.length === 0 ? (
                            <div className="h-full" />
                          ) : (
                            <div className="space-y-1.5">
                              {hourAppts.map((appt) => {
                                const colors = statusColors[appt.status] || statusColors.confirmed
                                return (
                                  <div
                                    key={appt._id}
                                    className={`rounded-xl px-4 py-3 border-l-[3px] ${colors.border} ${colors.bg}`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                        {appt.petId?.photo ? (
                                          <Image src={appt.petId.photo} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-9 h-9 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center">
                                            <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-sm font-semibold text-[#4F4F4F]">
                                            {appt.petId?.name || 'Pet'}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            Owner: {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs text-gray-500">
                                          {formatSlotTime(appt.startTime)} - {formatSlotTime(appt.endTime)}
                                        </span>
                                        <div className={`text-[10px] font-medium capitalize mt-0.5 ${colors.text}`}>
                                          {appt.status === 'in_progress' ? 'In Progress' : appt.status}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Mode & Type Tags */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600 capitalize">
                                        {appt.mode === 'face-to-face' ? (
                                          <><MapPin className="w-3 h-3" /> Face to Face</>
                                        ) : (
                                          <><Video className="w-3 h-3" /> Online</>
                                        )}
                                      </span>
                                      {orderAppointmentTypePills(appt.types).map((t) => (
                                        <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                          {formatAppointmentTypeDisplay(t)}
                                        </span>
                                      ))}
                                      {/* Auto-scheduled booster: show vaccine name pill */}
                                      {(() => {
                                        const match = appt.notes?.match(/^Auto-scheduled.*for (.+)$/)
                                        return match ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[#C5D8FF] text-[#4569B1] font-medium">
                                            <Syringe className="w-3 h-3" />{match[1]}
                                          </span>
                                        ) : null
                                      })()}
                                    </div>

                                    {/* Branch info */}
                                    {appt.clinicBranchId?.name && (
                                      <p className="text-[10px] text-gray-400 mt-1.5">
                                        {appt.clinicBranchId.name} {appt.clinicBranchId.address ? `- ${appt.clinicBranchId.address}` : ''}
                                      </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-2.5">
                                      {(appt.status === 'confirmed' || appt.status === 'in_clinic') && (
                                        <button
                                          onClick={() => handleCheckIn(appt)}
                                          disabled={checkingIn === appt._id}
                                          className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
                                        >
                                          <LogIn className="w-3 h-3" />
                                          {checkingIn === appt._id ? 'Starting…' : appt.status === 'in_clinic' ? 'Start Visit' : 'Check In Patient'}
                                        </button>
                                      )}
                                      {appt.status === 'in_progress' && (
                                        <button
                                          onClick={() => handleContinueVisit(appt)}
                                          disabled={continuingVisit === appt._id}
                                          className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
                                        >
                                          <PlayCircle className="w-3 h-3" />
                                          {continuingVisit === appt._id ? 'Loading…' : 'Continue Visit'}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleCancel(appt._id)}
                                        className="px-3 py-1 text-[10px] font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 px-6 py-3 border-t border-gray-100 bg-gray-50">
                {Object.entries(statusColors).map(([status, colors]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    <span className="text-[10px] text-gray-500 capitalize">
                      {status === 'in_progress' ? 'In Progress' : status === 'in_clinic' ? 'In Clinic' : status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1 space-y-4">

              {/* Month Calendar */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                {/* Month header */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => goToMonth(-1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{calMonthLabel}</span>
                  <button onClick={() => goToMonth(1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isSelected = dateStr === calendarDate
                    const isToday = dateStr === today
                    const hasDot = datesWithAppointments.has(dateStr)
                    return (
                      <div key={day} className="flex flex-col items-center py-0.5">
                        <button
                          onClick={() => {
                            setCalendarDate(dateStr)
                          }}
                          className={`w-8 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center
                            ${isSelected
                              ? 'bg-[#7FA5A3] text-white'
                              : isToday
                              ? 'bg-[#7FA5A3]/15 text-[#476B6B] font-bold'
                              : 'text-[#4F4F4F] hover:bg-gray-100'
                            }`}
                        >
                          {day}
                        </button>
                        {hasDot && !isSelected && (
                          <div className="w-1 h-1 rounded-full bg-[#7FA5A3] mt-0.5" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Upcoming Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm min-h-50">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#4F4F4F]" />
                  <h2 className="text-lg font-semibold text-[#4F4F4F]">Upcoming</h2>
                </div>
                {upcomingAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Clock className="w-12 h-12 text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No scheduled appointments</p>
                  </div>
                ) : (
                  <div className="space-y-3 w-full">
                    {upcomingAppointments.slice(0, 3).map((appt) => (
                      <div key={appt._id} className="border-b pb-3 last:border-b-0">
                        <p className="text-sm font-semibold text-[#4F4F4F]">{appt.petId?.name || 'Pet'}</p>
                        <p className="text-xs text-gray-500">{formatDate(appt.date)} at {formatSlotTime(appt.startTime)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Working Hours */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#4F4F4F]">Working Hours</h3>
                  <button
                    onClick={() => setWorkingHoursOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-[#4F4F4F] hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
                {schedulesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
                    <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
                    <p className="text-xs text-gray-400">No clinic assignments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((s) => (
                      <div key={s.branchId} className="pb-3 border-b border-gray-100 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-medium text-[#2C3E2D]">{s.branchName}</p>
                          {s.schedule && (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          )}
                        </div>
                        {s.branchAddress && (
                          <p className="text-xs text-gray-400 mb-1">{s.branchAddress}</p>
                        )}
                        {s.schedule ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-600">
                              {formatScheduleTime(s.schedule.startTime)} – {formatScheduleTime(s.schedule.endTime)}
                              {' · '}{s.schedule.workingDays.join(', ')}
                            </p>
                            {s.schedule.breakStart && s.schedule.breakEnd && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Coffee className="w-3 h-3" />
                                Break: {formatScheduleTime(s.schedule.breakStart)} – {formatScheduleTime(s.schedule.breakEnd)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-500">No schedule set</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Previous Appointments Tab */
          <div>
            {previousAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No previous appointments</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {previousAppointments.map((appt) => {
                  const displayStatus = getDisplayStatus(appt)
                  const colors = statusColors[displayStatus] || statusColors.completed
                  return (
                    <div
                      key={appt._id}
                      className={`bg-white rounded-xl p-4 shadow-sm border-l-[3px] ${colors.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {appt.petId?.photo ? (
                            <Image src={appt.petId.photo} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center">
                              <PawPrint className="w-5 h-5 text-[#5A7C7A]" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-[#4F4F4F]">{appt.petId?.name || 'Pet'}</p>
                            <p className="text-xs text-gray-500">
                              Owner: {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(appt.date)}</p>
                          <p className="text-xs text-gray-500">
                            {formatSlotTime(appt.startTime)} - {formatSlotTime(appt.endTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600 capitalize">
                          {appt.mode === 'face-to-face' ? (
                            <><MapPin className="w-3 h-3" /> Face to Face</>
                          ) : (
                            <><Video className="w-3 h-3" /> Online</>
                          )}
                        </span>
                        {orderAppointmentTypePills(appt.types).map((t) => (
                          <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                            {formatAppointmentTypeDisplay(t)}
                          </span>
                        ))}
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium capitalize ${colors.bg} ${colors.text}`}>
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staged Medical Record Modal */}
      {modalOpen && activeRecordId && activeAppointmentId && activePetId && (
        <MedicalRecordStagedModal
          recordId={activeRecordId}
          appointmentId={activeAppointmentId}
          petId={activePetId}
          appointmentTypes={activeAppointmentTypes}
          appointmentDate={activeAppointmentDate}
          onComplete={handleModalComplete}
          onClose={handleModalClose}
        />
      )}

      {/* Working Hours Modal */}
      {token && (
        <WorkingHoursModal
          open={workingHoursOpen}
          onClose={() => { setWorkingHoursOpen(false); loadSchedules() }}
          token={token}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <Dialog open={appointmentToCancel !== null} onOpenChange={(open) => { if (!open) setAppointmentToCancel(null) }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[#FEE2E2] rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-[#900B09]" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-[#2C3E2D] mb-2">Cancel Appointment?</h2>
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
    </DashboardLayout>
  )
}
