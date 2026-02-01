'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Search, ClipboardList, Filter } from 'lucide-react'
import { useState } from 'react'

export default function PatientRecordsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Patient Records</h1>

          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by patient name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
              />
            </div>
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Filter className="w-5 h-5" />
              Filter
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No patient records found</h2>
          <p className="text-gray-500 mb-6">
            Patient records will appear here as you create and manage patient profiles.
          </p>
          <p className="text-sm text-gray-400">
            Use the search and filter options above to find specific patient records.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Patients</span>
                <span className="text-2xl font-bold text-blue-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Cases</span>
                <span className="text-2xl font-bold text-[#7FA5A3]">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed Treatments</span>
                <span className="text-2xl font-bold text-green-600">0</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Updates</h3>
            <p className="text-gray-500 text-center py-6">
              No recent patient updates
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
