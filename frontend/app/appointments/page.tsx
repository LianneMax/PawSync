'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Calendar, Plus, Clock } from 'lucide-react'

export default function AppointmentsPage() {
  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F]">Appointments</h1>
          <button className="flex items-center gap-2 bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors">
            <Plus className="w-5 h-5" />
            Book Appointment
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-4">Upcoming Appointments</h2>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">No upcoming appointments</p>
              <button className="bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Schedule One Now
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-4">Past Appointments</h2>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No past appointments</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
