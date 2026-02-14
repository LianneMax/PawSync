'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Calendar, Plus, Clock, Search, Filter } from 'lucide-react'
import { useState } from 'react'

export default function VetAppointmentsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F]">My Appointments</h1>
          <button className="flex items-center gap-2 bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors">
            <Plus className="w-5 h-5" />
            Add Time Slot
          </button>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by patient or owner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
            />
          </div>
          <button className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-4">Upcoming Patient Appointments</h2>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">No upcoming appointments scheduled</p>
              <button className="bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Appointment
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-4">Completed Appointments</h2>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No completed appointments</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-4">Today's Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Scheduled Appointments</span>
                <span className="text-2xl font-bold text-blue-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed</span>
                <span className="text-2xl font-bold text-green-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending</span>
                <span className="text-2xl font-bold text-orange-600">0</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-4">Weekly Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Appointments</span>
                <span className="text-2xl font-bold text-purple-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Available Slots</span>
                <span className="text-2xl font-bold text-[#7FA5A3]">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cancellations</span>
                <span className="text-2xl font-bold text-red-600">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
