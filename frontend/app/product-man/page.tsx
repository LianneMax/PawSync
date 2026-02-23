'use client'

import { useAuthStore } from '@/store/authStore'
import DashboardLayout from '@/components/DashboardLayout'
import { Briefcase } from 'lucide-react'

export default function ProductManPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Briefcase className="w-8 h-8 text-[#7FA5A3]" />
            <h1 className="text-[32px] font-bold text-[#476B6B]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              Services
            </h1>
          </div>
          <p className="text-gray-500">Explore and manage available services</p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder Service Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-[#7FA5A3] rounded-xl flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-[#476B6B] mb-2">Service Name</h3>
            <p className="text-gray-600 text-sm mb-4">Service description goes here</p>
            <button className="w-full bg-[#7FA5A3] text-white font-semibold py-2 rounded-lg hover:bg-[#6B8E8C] transition-colors">
              View Details
            </button>
          </div>

          {/* Add more service cards here */}
        </div>

        {/* Empty State Message */}
        {(!user || user.userType === 'pet-owner') && (
          <div className="mt-8 bg-[#F8F6F2] rounded-2xl p-12 text-center border border-gray-200">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-2">Services Coming Soon</h2>
            <p className="text-gray-500">Browse and manage veterinary services offered by clinics in your area.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
