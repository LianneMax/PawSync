'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { type Appointment } from '@/lib/appointments'
import {
  Users,
  Calendar,
  Syringe,
  Heart,
  ChevronRight,
  PawPrint,
} from 'lucide-react'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatSlotTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m} ${ampm}`
}

export default function VetDashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const { token } = useAuthStore()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [vaccinesDueCount, setVaccinesDueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      setLoading(true)
      try {
        const [apptRes, vacRes] = await Promise.all([
          authenticatedFetch('/appointments/vet', { method: 'GET' }, token),
          authenticatedFetch('/vaccinations/vet/my-records', { method: 'GET' }, token),
        ])

        if (apptRes.status === 'SUCCESS') {
          setAppointments(apptRes.data.appointments)
        }

        if (vacRes.status === 'SUCCESS') {
          const now = new Date()
          const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          const count = vacRes.data.vaccinations.filter((v: { status: string; nextDueDate?: string }) => {
            if (v.status === 'overdue') return true
            if (v.nextDueDate) {
              const due = new Date(v.nextDueDate)
              return due >= now && due <= in7Days
            }
            return false
          }).length
          setVaccinesDueCount(count)
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const today = new Date().toISOString().split('T')[0]

  const totalPatients = new Set(
    appointments.filter((a) => a.petId?._id).map((a) => a.petId._id)
  ).size

  const todayCount = appointments.filter((a) => {
    const apptDate = new Date(a.date).toISOString().split('T')[0]
    return apptDate === today && (a.status === 'confirmed' || a.status === 'completed')
  }).length

  const todayList = appointments
    .filter((a) => {
      const apptDate = new Date(a.date).toISOString().split('T')[0]
      return apptDate === today && a.status === 'confirmed'
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const displayName = user ? `Dr. ${user.lastName}` : 'Dr.'

  const stats = [
    { label: 'Total Patients', value: loading ? '—' : String(totalPatients), icon: Users, bg: 'bg-red-50', iconColor: 'text-red-400' },
    { label: "Today's Appointments", value: loading ? '—' : String(todayCount), icon: Calendar, bg: 'bg-yellow-50', iconColor: 'text-yellow-500' },
    { label: 'Vaccines Due This Week', value: loading ? '—' : String(vaccinesDueCount), icon: Syringe, bg: 'bg-green-50', iconColor: 'text-green-500' },
    { label: 'In Confinement', value: '—', icon: Heart, bg: 'bg-blue-50', iconColor: 'text-blue-400' },
  ]

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-[#476B6B] to-[#7FA5A3] rounded-2xl p-8 mb-8">
          <h1
            className="text-3xl text-white mb-2"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            {getGreeting()}, {displayName}!
          </h1>
          <p className="text-white/80 mb-4">
            {loading
              ? 'Loading your schedule...'
              : `You have ${todayCount} appointment${todayCount !== 1 ? 's' : ''} scheduled for today.`}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <p className="text-3xl font-bold text-[#4F4F4F]">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#476B6B]" />
              <h2 className="text-lg font-semibold text-[#4F4F4F]">Today&apos;s Appointments</h2>
            </div>
            <button
              onClick={() => router.push('/vet-appointments')}
              className="text-[#7FA5A3] hover:text-[#476B6B] text-sm font-medium flex items-center gap-1 transition-colors"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : todayList.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No confirmed appointments for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayList.map((appt) => {
                const apptDate = new Date(appt.date)
                const day = apptDate.getDate().toString()
                const month = apptDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                const title = appt.types.map((t) => t.replace('-', ' ')).join(', ')

                return (
                  <div
                    key={appt._id}
                    className="flex items-center justify-between p-4 bg-[#F8F6F2] rounded-xl hover:bg-[#F1F0ED] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-[#476B6B] rounded-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-white text-lg font-bold leading-tight">{day}</span>
                        <span className="text-white/70 text-[10px] uppercase">{month}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[#4F4F4F] capitalize">{title}</p>
                        <p className="text-sm text-gray-500">
                          {formatSlotTime(appt.startTime)} - {formatSlotTime(appt.endTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {appt.petId?.photo ? (
                        <img src={appt.petId.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center">
                          <PawPrint className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="text-right">
                        <p className="font-medium text-[#4F4F4F] text-sm">{appt.petId?.name || 'Pet'}</p>
                        <p className="text-xs text-gray-500">
                          {appt.ownerId?.firstName} {appt.ownerId?.lastName}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
