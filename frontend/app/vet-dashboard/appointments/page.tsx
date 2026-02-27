'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Calendar,
  Clock,
  PawPrint,
  CheckCircle,
  ChevronRight,
  FileText,
  Syringe,
  Filter,
  AlertCircle,
} from 'lucide-react'

interface Appointment {
  _id: string
  petId: { _id: string; name: string; species: string; breed: string }
  ownerId: { _id: string; firstName: string; lastName: string }
  vetId: string
  clinicId: string
  clinicBranchId: string
  date: string
  startTime: string
  endTime: string
  mode: 'online' | 'face-to-face'
  types: string[]
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  completed: 'bg-green-100 text-green-700 border-green-300',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  vaccination: <Syringe className="w-3 h-3" />,
  consultation: <FileText className="w-3 h-3" />,
  'check-up': <CheckCircle className="w-3 h-3" />,
  deworming: <AlertCircle className="w-3 h-3" />,
}

export default function VetAppointmentsPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming')
  const [completing, setCompleting] = useState<string | null>(null)
  const [completedResult, setCompletedResult] = useState<{
    appointmentId: string
    vaccinationId?: string
    types: string[]
  } | null>(null)

  const fetchAppointments = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/appointments/vet`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setAppointments(data.data.appointments || [])
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleComplete = async (apptId: string, types: string[]) => {
    if (!token) return
    setCompleting(apptId)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/appointments/${apptId}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'completed' }),
        }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setCompletedResult({
          appointmentId: apptId,
          vaccinationId: data.data.vaccinationId,
          types,
        })
        // Refresh list
        fetchAppointments()
      } else {
        alert(data.message || 'Failed to complete appointment')
      }
    } finally {
      setCompleting(null)
    }
  }

  const filtered = appointments.filter((a) => {
    if (filter === 'upcoming') return a.status === 'pending' || a.status === 'confirmed'
    if (filter === 'completed') return a.status === 'completed'
    return true
  })

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">My Appointments</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and complete your scheduled consultations</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm mb-6">
          {(['upcoming', 'all', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              {f === 'upcoming' ? 'Upcoming' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Post-completion action banner */}
        {completedResult && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
            <p className="font-semibold text-green-800 mb-3">Appointment marked as completed!</p>
            <p className="text-sm text-green-700 mb-3">What would you like to do next?</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  router.push(`/vet-dashboard/medical-records/new?appointmentId=${completedResult.appointmentId}`)
                  setCompletedResult(null)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
              >
                <FileText className="w-4 h-4" />
                Create Medical Record
              </button>
              {completedResult.vaccinationId && (
                <button
                  onClick={() => {
                    router.push(`/vet-dashboard/vaccinations/new?edit=${completedResult.vaccinationId}`)
                    setCompletedResult(null)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[#476B6B] text-[#476B6B] rounded-xl text-sm font-medium hover:bg-[#f0f7f7] transition-colors"
                >
                  <Syringe className="w-4 h-4" />
                  Fill Vaccination Record
                </button>
              )}
              <button
                onClick={() => setCompletedResult(null)}
                className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No {filter !== 'all' ? filter : ''} appointments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((appt) => {
              const petName = typeof appt.petId === 'object' ? appt.petId?.name : '—'
              const ownerName =
                typeof appt.ownerId === 'object'
                  ? `${appt.ownerId?.firstName || ''} ${appt.ownerId?.lastName || ''}`.trim()
                  : '—'
              const canComplete = appt.status === 'confirmed'

              return (
                <div
                  key={appt._id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: date + info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Date badge */}
                      <div className="w-14 h-14 bg-[#476B6B] rounded-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-white text-lg font-bold leading-tight">
                          {new Date(appt.date).getDate()}
                        </span>
                        <span className="text-white/70 text-[10px] uppercase">
                          {new Date(appt.date).toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Types */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {appt.types.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f0f7f7] text-[#476B6B] rounded-full text-xs font-medium"
                            >
                              {TYPE_ICONS[t]}
                              {t}
                            </span>
                          ))}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[appt.status]}`}
                          >
                            {appt.status}
                          </span>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                          <Clock className="w-3.5 h-3.5" />
                          {appt.startTime} – {appt.endTime}
                        </div>

                        {/* Pet + Owner */}
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <PawPrint className="w-3.5 h-3.5 text-[#476B6B]" />
                          <span className="font-medium">{petName}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{ownerName}</span>
                        </div>

                        {appt.notes && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{appt.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {canComplete && (
                        <button
                          onClick={() => handleComplete(appt._id, appt.types)}
                          disabled={completing === appt._id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {completing === appt._id ? 'Completing…' : 'Complete'}
                        </button>
                      )}
                      {appt.status === 'completed' && (
                        <>
                          <button
                            onClick={() =>
                              router.push(
                                `/vet-dashboard/medical-records/new?appointmentId=${appt._id}`
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#476B6B] text-[#476B6B] rounded-xl text-xs font-medium hover:bg-[#f0f7f7] transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Medical Record
                          </button>
                          {appt.types.includes('vaccination') && (
                            <button
                              onClick={() =>
                                router.push(
                                  `/vet-dashboard/vaccinations/new?appointmentId=${appt._id}`
                                )
                              }
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-medium hover:border-[#476B6B] transition-colors"
                            >
                              <Syringe className="w-3.5 h-3.5" />
                              Vaccination
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
