'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Users,
  Calendar,
  Syringe,
  Heart,
  ChevronRight,
  LogOut,
  PawPrint,
} from 'lucide-react'

// Mock data
const mockStats = [
  { label: 'Total Patients', value: '1,247', icon: Users, color: 'bg-green-50', iconColor: 'text-green-600' },
  { label: "Today's Appointments", value: '12', icon: Calendar, color: 'bg-blue-50', iconColor: 'text-blue-600' },
  { label: 'Vaccines Due This Week', value: '86', icon: Syringe, color: 'bg-yellow-50', iconColor: 'text-yellow-600' },
  { label: 'In Confinement', value: '5', icon: Heart, color: 'bg-purple-50', iconColor: 'text-purple-600' },
]

const mockAppointments = [
  {
    id: '1',
    title: 'Annual Checkup & Vaccination',
    time: '9:00 AM - 9:30 AM',
    day: '19',
    month: 'JAN',
    petName: 'Pichi',
    ownerName: 'Alyssa Mansueto',
    ownerInitials: 'AM',
  },
  {
    id: '2',
    title: 'Skin Allergy Follow-up',
    time: '10:00 AM - 10:30 AM',
    day: '19',
    month: 'JAN',
    petName: 'Bruno',
    ownerName: 'Carlos Rodriguez',
    ownerInitials: 'CR',
  },
  {
    id: '3',
    title: 'Post-Surgery Checkup',
    time: '11:00 AM - 11:30 AM',
    day: '19',
    month: 'JAN',
    petName: 'Whiskers',
    ownerName: 'Maria Santos',
    ownerInitials: 'MS',
  },
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function VetDashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [appointments] = useState(mockAppointments)

  const displayName = user ? `Dr. ${user.lastName}` : 'Dr. Bailon'

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#476B6B] to-[#7FA5A3] rounded-2xl p-8 mb-8 relative overflow-hidden">
          {/* Decorative circle */}
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -right-5 top-5 w-32 h-32 bg-white/5 rounded-full" />

          <h1
            className="text-3xl text-white mb-2 relative z-10"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            {getGreeting()}, {displayName}!
          </h1>
          <p className="text-white/80 mb-4 relative z-10">
            You have 12 appointments scheduled for today and 5 pending follow-ups.
          </p>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-colors text-sm relative z-10"
          >
            <LogOut className="w-4 h-4" />
            Logout (Demo)
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {mockStats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
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

          <div className="space-y-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-4 bg-[#F8F6F2] rounded-xl hover:bg-[#F1F0ED] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Date badge */}
                  <div className="w-14 h-14 bg-[#476B6B] rounded-xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-white text-lg font-bold leading-tight">{apt.day}</span>
                    <span className="text-white/70 text-[10px] uppercase">{apt.month}</span>
                  </div>
                  {/* Appointment info */}
                  <div>
                    <p className="font-semibold text-[#4F4F4F]">{apt.title}</p>
                    <p className="text-sm text-gray-500">{apt.time}</p>
                  </div>
                </div>

                {/* Pet & Owner */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center">
                    <PawPrint className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#4F4F4F] text-sm">{apt.petName}</p>
                    <p className="text-xs text-gray-500">{apt.ownerName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
