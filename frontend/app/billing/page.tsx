'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Receipt, Download, Filter } from 'lucide-react'

export default function BillingPage() {
  return (
    <DashboardLayout notificationCount={12}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing and Invoicing</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Invoices</h2>
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-5 h-5" />
                Filter
              </button>
            </div>
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">No invoices yet</p>
              <p className="text-sm text-gray-400">
                Your invoices will appear here after you complete appointments and services.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Account Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-[#7FA5A3] to-[#6b9391] text-white rounded-lg p-6">
                <p className="text-sm font-medium text-white text-opacity-90 mb-2">Total Amount Spent</p>
                <p className="text-3xl font-bold">$0.00</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
                <p className="text-sm font-medium text-white text-opacity-90 mb-2">Outstanding Balance</p>
                <p className="text-3xl font-bold">$0.00</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
                <p className="text-sm font-medium text-white text-opacity-90 mb-2">Last Payment</p>
                <p className="text-3xl font-bold">—</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
