'use client'

import DashboardLayout from '@/components/DashboardLayout'

export default function DashboardPage() {
  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Example cards */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Welcome to PawSync</h2>
            <p className="text-gray-600">
              Manage your pet's health records, appointments, and more.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Upcoming Appointments</h2>
            <p className="text-gray-600">
              You have no upcoming appointments.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">My Pets</h2>
            <p className="text-gray-600">
              Add your first pet to get started.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
