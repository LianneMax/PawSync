'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { getClinicAppointments, Appointment } from '@/lib/appointments'
import {
  Users,
  Building2,
  Clock,
  PawPrint,
  Calendar,
  ArrowRight,
  UserCog,
  Nfc,
  UsersRound,
  CalendarPlus,
} from 'lucide-react'

// ==================== TYPES ====================

interface DashboardStats {
  totalVeterinarians: number
  activeBranches: number
  pendingApplications: number
  totalClients: number
  totalPets: number
  isOpenNow: boolean
}

interface ApplicationItem {
  _id: string
  vetId: { _id: string; firstName: string; lastName: string; email: string } | null
  branchId: { _id: string; name: string } | null
  status: string
  createdAt: string
}

// ==================== HELPERS ====================

const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
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

const formatTypes = (types: string[]) =>
  types.map(formatAppointmentTypeDisplay).join(', ')

// ==================== MAIN COMPONENT ====================

export default function ClinicAdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const clinicName = user?.firstName || 'Admin'

  const [stats, setStats] = useState<DashboardStats>({
    totalVeterinarians: 0,
    activeBranches: 0,
    pendingApplications: 0,
    totalClients: 0,
    totalPets: 0,
    isOpenNow: false,
  })
  const [pendingApps, setPendingApps] = useState<ApplicationItem[]>([])
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [statsRes, appsRes, appointmentsRes] = await Promise.all([
          authenticatedFetch('/clinics/mine/stats', {}, token || undefined),
          authenticatedFetch('/vet-applications/clinic?status=pending', {}, token || undefined),
          getClinicAppointments({ date: today, filter: 'upcoming' }, token || undefined),
        ])

        if (statsRes.status === 'SUCCESS') {
          setStats(statsRes.data.stats)
        }

        if (appsRes.status === 'SUCCESS') {
          setPendingApps(appsRes.data.applications || [])
        }

        if (appointmentsRes.status === 'SUCCESS' && appointmentsRes.data) {
          setTodayAppointments(appointmentsRes.data.appointments)
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    if (token) fetchDashboardData()
  }, [token])

  const statCards = [
    { label: 'Total Veterinarians', value: stats.totalVeterinarians.toString(), icon: Users, color: 'bg-red-50', iconColor: 'text-red-400' },
    { label: 'Total Clients', value: stats.totalClients.toString(), icon: UsersRound, color: 'bg-yellow-50', iconColor: 'text-yellow-500' },
    { label: 'Total Pets', value: stats.totalPets.toString(), icon: PawPrint, color: 'bg-green-50', iconColor: '', iconStyle: { color: '#35785C' } },
    { label: 'Active Branches', value: stats.activeBranches.toString(), icon: Building2, color: 'bg-blue-50', iconColor: 'text-blue-500' },
  ]

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-6 lg:p-8">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-[#476B6B] to-[#7FA5A3] rounded-2xl p-8 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="text-3xl text-white mb-2"
                style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
              >
                Welcome back, {clinicName}!
              </h1>
              <p className="text-white/80 text-sm">
                You have {todayAppointments.length} appointments scheduled for today{pendingApps.length > 0 ? ` and ${pendingApps.length} pending vet application${pendingApps.length !== 1 ? 's' : ''} to review` : ''}.
              </p>
            </div>
            {!loading && (
              <div
                className="shrink-0 flex items-center gap-2.5 pl-5 pr-6 py-2 rounded-full text-sm font-bold"
                style={stats.isOpenNow
                  ? { backgroundColor: '#D5F4D2', color: '#35785C' }
                  : { backgroundColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.65)' }}
              >
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${stats.isOpenNow ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: stats.isOpenNow ? '#35785C' : 'rgba(255,255,255,0.5)' }}
                />
                {stats.isOpenNow ? 'Open' : 'Closed'}
              </div>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} style={(stat as any).iconStyle} />
              </div>
              <p className="text-3xl font-bold text-[#4F4F4F]">{loading ? '-' : stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Appointments */}
          <div className="bg-white rounded-2xl shadow-sm">
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#476B6B]" />
                <h3 className="font-semibold text-[#4F4F4F]">Today&apos;s Appointments</h3>
              </div>
              <Link href="/clinic-admin/appointments" className="text-sm text-[#476B6B] hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="px-6 py-8 text-center">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No appointments scheduled for today
                </div>
              ) : (
                todayAppointments.slice(0, 5).map((apt) => {
                  const time = formatTime(apt.startTime)
                  const [timePart, ampm] = time.split(' ')
                  const vetName = apt.vetId ? `Dr. ${apt.vetId.firstName} ${apt.vetId.lastName}` : '—'
                  const petName = apt.petId?.name ?? '—'
                  const ownerName = apt.ownerId ? `${apt.ownerId.firstName} ${apt.ownerId.lastName}` : '—'
                  return (
                    <div key={apt._id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 bg-[#476B6B] rounded-xl flex flex-col items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-semibold leading-tight">{timePart}</span>
                          <span className="text-white/70 text-[9px] font-medium leading-tight">{ampm}</span>
                        </div>
                        <div>
                          <p className="font-medium text-[#4F4F4F] text-sm">{formatTypes(apt.types)}</p>
                          <p className="text-xs text-gray-500">{vetName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#4F4F4F]">{petName}</p>
                        <p className="text-xs text-gray-500">{ownerName}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Quick Actions + Recent Applications */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-[#4F4F4F] mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/clinic-admin/clinic-management"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <Building2 className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">Manage Clinic</span>
                </Link>
                <Link
                  href="/clinic-admin/nfc"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <Nfc className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">NFC Tags</span>
                </Link>
                <Link
                  href="/clinic-admin/verification"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <UserCog className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">Vet Applications</span>
                </Link>
                <Link
                  href="/clinic-admin/patients"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <PawPrint className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">View Patients</span>
                </Link>
                <Link
                  href="/clinic-admin/clients?addClient=true"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <UsersRound className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">Add Client</span>
                </Link>
                <Link
                  href="/clinic-admin/appointments?book=true"
                  className="flex items-center gap-3 p-4 rounded-xl bg-[#F8F6F2] hover:bg-[#F1F0ED] transition-colors"
                >
                  <CalendarPlus className="w-5 h-5 text-[#476B6B]" />
                  <span className="text-sm font-medium text-[#4F4F4F]">Book Appointment</span>
                </Link>
              </div>
            </div>

            {/* Pending Vet Applications (Real Data) */}
            <div className="bg-white rounded-2xl shadow-sm">
              <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-[#476B6B]" />
                  <h3 className="font-semibold text-[#4F4F4F]">Pending Vet Applications</h3>
                </div>
                <Link href="/clinic-admin/verification" className="text-sm text-[#476B6B] hover:underline flex items-center gap-1">
                  Review All <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="px-6 py-8 text-center">
                    <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : pendingApps.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">
                    No pending applications
                  </div>
                ) : (
                  pendingApps.slice(0, 3).map((app) => {
                    const vet = app.vetId
                    const name = vet ? `Dr. ${vet.firstName} ${vet.lastName}` : 'Unknown'
                    const email = vet?.email || ''
                    const initials = vet ? `${vet.firstName?.[0] || ''}${vet.lastName?.[0] || ''}` : '??'
                    const date = new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                    return (
                      <div key={app._id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#F1F0ED] rounded-full flex items-center justify-center shrink-0">
                            <span className="text-[#4F4F4F] font-medium text-sm">{initials}</span>
                          </div>
                          <div>
                            <p className="font-medium text-[#4F4F4F] text-sm">{name}</p>
                            <p className="text-xs text-gray-500">{email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Pending
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{date}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
