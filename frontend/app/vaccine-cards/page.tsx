'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { FileText, Plus, Download } from 'lucide-react'

export default function VaccineCardsPage() {
  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F]">Vaccine Cards</h1>
          <button className="flex items-center gap-2 bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors">
            <Plus className="w-5 h-5" />
            Upload Vaccine Card
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Empty state */}
          <div className="col-span-full">
            <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-[#4F4F4F] mb-2">No vaccine cards yet</h2>
              <p className="text-gray-500 mb-6">
                Upload your pet&apos;s vaccine cards to keep their health records organized and accessible.
              </p>
              <div className="flex gap-4 justify-center">
                <button className="bg-[#7FA5A3] text-white px-8 py-3 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Upload Card
                </button>
                <button className="bg-gray-100 text-[#4F4F4F] px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors inline-flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  View Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
