'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  type Appointment,
  updateAppointmentStatus,
  cancelAppointment,
} from '@/lib/appointments'
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Video,
  MapPin,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

// ==================== CONSTANTS ====================

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-l-green-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' },
}

// ==================== HELPERS ====================

function getDisplayStatus(appt: Appointment): string {
  if (appt.status === 'pending' || appt.status === 'confirmed') {
    const apptEnd = new Date(appt.date.split('T')[0] + 'T' + appt.endTime)
    if (apptEnd < new Date()) return 'cancelled'
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

// ==================== MAIN PAGE ====================

export default function VetAppointmentsPage() {
  const { token } = useAuthStore()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarDate, setCalendarDate] = useState(() => new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const loadAppointments = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await authenticatedFetch('/appointments/vet', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.appointments) {
        setAppointments(res.data.appointments)
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

  // Filter confirmed appointments for the selected calendar date
  const confirmedForDate = appointments.filter((a) => {
    if (a.status !== 'confirmed') return false
    const apptDate = new Date(a.date).toISOString().split('T')[0]
    return apptDate === calendarDate
  })

  // Upcoming = confirmed and not yet passed, sorted by date asc
  const upcomingAppointments = appointments
    .filter((a) => getDisplayStatus(a) === 'confirmed')
    .sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.startTime)
      const dateB = new Date(b.date + 'T' + b.startTime)
      return dateA.getTime() - dateB.getTime()
    })

  // Previous = completed + cancelled + past-pending (displayed as cancelled), sorted by date desc
  const previousAppointments = appointments
    .filter((a) => {
      const ds = getDisplayStatus(a)
      return ds === 'completed' || ds === 'cancelled'
    })
    .sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.startTime)
      const dateB = new Date(b.date + 'T' + b.startTime)
      return dateB.getTime() - dateA.getTime()
    })

  // Stats for today
  const today = new Date().toISOString().split('T')[0]
  const todayAppts = appointments.filter((a) => new Date(a.date).toISOString().split('T')[0] === today)
  const todayConfirmed = todayAppts.filter((a) => a.status === 'confirmed').length
  const todayCompleted = todayAppts.filter((a) => a.status === 'completed').length

  const handleComplete = async (id: string) => {
    try {
      const res = await updateAppointmentStatus(id, 'completed', token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Appointment marked as completed')
        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to complete')
      }
    } catch {
      toast.error('An error occurred')
    }
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
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
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
    setCalendarDate(d.toISOString().split('T')[0])
  }

  const dateLabel = new Date(calendarDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const hours = Array.from({ length: 11 }, (_, i) => i + 7) // 7AM to 5PM

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
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{todayConfirmed}</p>
                <p className="text-xs text-gray-500">Confirmed Today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{todayCompleted}</p>
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
                    {confirmedForDate.length} confirmed appointment{confirmedForDate.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => goToDay(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  {hours.map((hour) => {
                    const timeLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
                    const hourAppts = confirmedForDate.filter((a) => {
                      const apptHour = parseInt(a.startTime.split(':')[0])
                      return apptHour === hour
                    })

                    return (
                      <div key={hour} className="flex border-b border-gray-50 min-h-[72px]">
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
                                          <img src={appt.petId.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
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
                                          {appt.status}
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
                                      {appt.types.map((t) => (
                                        <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                          {t.replace('-', ' ')}
                                        </span>
                                      ))}
                                    </div>

                                    {/* Branch info */}
                                    {appt.clinicBranchId?.name && (
                                      <p className="text-[10px] text-gray-400 mt-1.5">
                                        {appt.clinicBranchId.name} {appt.clinicBranchId.address ? `- ${appt.clinicBranchId.address}` : ''}
                                      </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-2.5">
                                      <button
                                        onClick={() => handleComplete(appt._id)}
                                        className="px-3 py-1 text-[10px] font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                                      >
                                        Mark Complete
                                      </button>
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
                    <div className={`w-3 h-3 rounded-sm ${colors.bg} border-l-2 ${colors.border}`} />
                    <span className="text-[10px] text-gray-500 capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1 space-y-4">
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
                <h3 className="font-semibold text-[#4F4F4F] mb-4">Working Hours</h3>
                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-100">
                    <p className="text-sm font-medium text-[#2C3E2D] mb-2">Baivet - Main Branch</p>
                    <p className="text-xs text-gray-500 mb-2">Paranaque</p>
                    <p className="text-xs text-gray-600">9:00 AM - 6:00 PM • Mon, Wed, Tue, Thu, Fri</p>
                  </div>
                </div>
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
                            <img src={appt.petId.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
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
                        {appt.types.map((t) => (
                          <span key={t} className="px-2 py-0.5 text-[10px] rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                            {t.replace('-', ' ')}
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
