'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  BarChart3,
  Syringe,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader,
  TrendingUp,
  PawPrint,
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Vaccination {
  _id: string
  status: 'active' | 'expired' | 'overdue' | 'pending' | 'declined'
  vaccineName: string
  dateAdministered: string | null
  petId?: { _id: string; name: string; species: string } | null
}

interface Appointment {
  _id: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  date: string
  types: string[]
  petId?: { _id: string; name: string } | null
}

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#4F4F4F]">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-[#4F4F4F] font-medium capitalize">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">{value} / {total}</p>
          <p className="text-xs font-bold text-[#4F4F4F]">{pct}%</p>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { token } = useAuthStore()
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/vaccinations/clinic/records`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/appointments/clinic`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([vaxJson, apptJson]) => {
        setVaccinations(vaxJson.status === 'SUCCESS' ? (vaxJson.data?.vaccinations ?? []) : [])
        setAppointments(apptJson.status === 'SUCCESS' ? (apptJson.data?.appointments ?? []) : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  // Vaccination stats
  const total = vaccinations.length
  const active = vaccinations.filter((v) => v.status === 'active').length
  const expired = vaccinations.filter((v) => v.status === 'expired').length
  const overdue = vaccinations.filter((v) => v.status === 'overdue').length
  const pending = vaccinations.filter((v) => v.status === 'pending').length
  const declined = vaccinations.filter((v) => v.status === 'declined').length
  const complianceRate = total > 0 ? Math.round((active / total) * 100) : 0

  // Unique pets vaccinated
  const uniquePets = new Set(
    vaccinations.filter((v) => v.petId?._id).map((v) => (v.petId as any)._id)
  ).size

  // Vaccination by species
  const dogs = vaccinations.filter((v) => (v.petId as any)?.species === 'dog').length
  const cats = vaccinations.filter((v) => (v.petId as any)?.species === 'cat').length

  // Top vaccines
  const vaxCounts: Record<string, number> = {}
  vaccinations.forEach((v) => {
    vaxCounts[v.vaccineName] = (vaxCounts[v.vaccineName] || 0) + 1
  })
  const topVaccines = Object.entries(vaxCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Appointment stats
  const totalAppts = appointments.length
  const completedAppts = appointments.filter((a) => a.status === 'completed').length
  const vaccinationAppts = appointments.filter((a) => a.types?.includes('vaccination')).length

  // Monthly vaccination trend (last 6 months)
  const now = new Date()
  const months: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const count = vaccinations.filter((v) => {
      if (!v.dateAdministered) return false
      const vDate = new Date(v.dateAdministered)
      return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear()
    }).length
    months.push({ label: monthStr, count })
  }
  const maxMonthCount = Math.max(...months.map((m) => m.count), 1)

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#7FA5A3]/10 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#7FA5A3]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#4F4F4F]">Analytics</h1>
            <p className="text-sm text-gray-500">Vaccination compliance and clinic performance</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Vaccinations"
                value={total}
                icon={Syringe}
                iconBg="bg-teal-50"
                iconColor="text-teal-500"
              />
              <StatCard
                label="Unique Pets Vaccinated"
                value={uniquePets}
                icon={PawPrint}
                iconBg="bg-amber-50"
                iconColor="text-amber-500"
              />
              <StatCard
                label="Compliance Rate"
                value={`${complianceRate}%`}
                sub="active / total"
                icon={TrendingUp}
                iconBg="bg-green-50"
                iconColor="text-green-500"
              />
              <StatCard
                label="Needs Attention"
                value={overdue + expired}
                sub="overdue + expired"
                icon={AlertTriangle}
                iconBg="bg-red-50"
                iconColor="text-red-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vaccination status breakdown */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
                  Status Breakdown
                </h2>
                <ProgressBar label="Active" value={active} total={total} color="bg-green-500" />
                <ProgressBar label="Pending" value={pending} total={total} color="bg-blue-400" />
                <ProgressBar label="Overdue" value={overdue} total={total} color="bg-orange-400" />
                <ProgressBar label="Expired" value={expired} total={total} color="bg-red-400" />
                <ProgressBar label="Declined" value={declined} total={total} color="bg-gray-400" />
              </div>

              {/* Top vaccines */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
                  Top Vaccines Administered
                </h2>
                {topVaccines.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topVaccines.map(([name, count], idx) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-medium text-[#4F4F4F]">{name}</p>
                            <p className="text-xs font-bold text-[#476B6B]">{count}</p>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-[#7FA5A3]"
                              style={{ width: `${(count / (topVaccines[0]?.[1] || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Monthly trend chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
                Vaccinations per Month (Last 6 Months)
              </h2>
              <div className="flex items-end gap-3 h-32">
                {months.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[10px] font-bold text-[#476B6B]">{m.count || ''}</p>
                    <div
                      className="w-full bg-[#7FA5A3] rounded-t-lg transition-all"
                      style={{
                        height: `${(m.count / maxMonthCount) * 96}px`,
                        minHeight: m.count > 0 ? '4px' : '0',
                      }}
                    />
                    <p className="text-[9px] text-gray-400">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Appointments + species grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Appointment stats */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
                  Appointment Insights
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      <p className="text-sm text-[#4F4F4F]">Total Appointments</p>
                    </div>
                    <p className="font-bold text-[#476B6B]">{totalAppts}</p>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <p className="text-sm text-[#4F4F4F]">Completed</p>
                    </div>
                    <p className="font-bold text-[#476B6B]">{completedAppts}</p>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <Syringe className="w-4 h-4 text-teal-500" />
                      <p className="text-sm text-[#4F4F4F]">Vaccination Appointments</p>
                    </div>
                    <p className="font-bold text-[#476B6B]">{vaccinationAppts}</p>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <p className="text-sm text-[#4F4F4F]">Completion Rate</p>
                    </div>
                    <p className="font-bold text-[#476B6B]">
                      {totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Species breakdown */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
                  Species Breakdown
                </h2>
                <div className="flex gap-6 mb-4">
                  <div className="flex-1 bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{dogs}</p>
                    <p className="text-xs text-amber-500 font-semibold mt-0.5">Dogs</p>
                  </div>
                  <div className="flex-1 bg-purple-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{cats}</p>
                    <p className="text-xs text-purple-500 font-semibold mt-0.5">Cats</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-600">{total - dogs - cats}</p>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">Other</p>
                  </div>
                </div>
                {total > 0 && (
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {dogs > 0 && (
                      <div
                        className="bg-amber-400 h-full rounded-l-full"
                        style={{ width: `${(dogs / total) * 100}%` }}
                        title={`Dogs: ${dogs}`}
                      />
                    )}
                    {cats > 0 && (
                      <div
                        className="bg-purple-400 h-full"
                        style={{ width: `${(cats / total) * 100}%` }}
                        title={`Cats: ${cats}`}
                      />
                    )}
                    {total - dogs - cats > 0 && (
                      <div
                        className="bg-gray-300 h-full rounded-r-full"
                        style={{ width: `${((total - dogs - cats) / total) * 100}%` }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
