'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  Users,
  Building2,
  Clock,
  PawPrint,
  Calendar,
  ArrowRight,
  UserCog,
  Nfc,
} from 'lucide-react'

// ==================== TYPES ====================

interface DashboardStats {
  totalVeterinarians: number
  activeBranches: number
  pendingApplications: number
}

interface ApplicationItem {
  _id: string
  vetId: { _id: string; firstName: string; lastName: string; email: string } | null
  branchId: { _id: string; name: string } | null
  status: string
  createdAt: string
}

// Mock appointments (still mock until appointments feature is built)
const todayAppointments = [
  { id: '1', time: '9:00 AM', pet: 'Coco', owner: 'Maria Santos', type: 'Check-up', vet: 'Dr. Gino Bailon' },
  { id: '2', time: '10:30 AM', pet: 'Bruno', owner: 'Juan Reyes', type: 'Vaccination', vet: 'Dr. Maria Santos' },
  { id: '3', time: '1:00 PM', pet: 'Mimi', owner: 'Ana Castro', type: 'Dental Cleaning', vet: 'Dr. Juan Reyes' },
  { id: '4', time: '2:30 PM', pet: 'Max', owner: 'Paolo Luna', type: 'Follow-up', vet: 'Dr. Ana Castro' },
  { id: '5', time: '4:00 PM', pet: 'Luna', owner: 'Rosa Cruz', type: 'Grooming', vet: 'Dr. Sofia Lim' },
]

// ==================== MAIN COMPONENT ====================

export default function ClinicAdminDashboard() {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const clinicName = user?.firstName || 'Admin'

  const [stats, setStats] = useState<DashboardStats>({
    totalVeterinarians: 0,
    activeBranches: 0,
    pendingApplications: 0,
  })
  const [pendingApps, setPendingApps] = useState<ApplicationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, appsRes] = await Promise.all([
          authenticatedFetch('/clinics/mine/stats', {}, token || undefined),
          authenticatedFetch('/vet-applications/clinic?status=pending', {}, token || undefined),
        ])

        if (statsRes.status === 'SUCCESS') {
          setStats(statsRes.data.stats)
        }

        if (appsRes.status === 'SUCCESS') {
          setPendingApps(appsRes.data.applications || [])
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
    { label: 'Total Veterinarians', value: stats.totalVeterinarians.toString(), icon: Users, color: 'bg-green-50', iconColor: 'text-green-600' },
    { label: 'Active Branches', value: stats.activeBranches.toString(), icon: Building2, color: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Pending Applications', value: stats.pendingApplications.toString(), icon: Clock, color: 'bg-yellow-50', iconColor: 'text-yellow-600' },
  ]

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-6 lg:p-8">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-[#476B6B] to-[#7FA5A3] rounded-2xl p-8 mb-8 text-white">
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

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
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
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-10 bg-[#476B6B] rounded-xl flex flex-col items-center justify-center shrink-0">
                      <span className="text-white text-[11px] font-semibold leading-tight">{apt.time.split(' ')[0]}</span>
                      <span className="text-white/70 text-[9px] font-medium leading-tight">{apt.time.split(' ')[1]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-[#4F4F4F] text-sm">{apt.type}</p>
                      <p className="text-xs text-gray-500">{apt.vet}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-[#4F4F4F]">{apt.pet}</p>
                    <p className="text-xs text-gray-500">{apt.owner}</p>
                  </div>
                </div>
              ))}
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
