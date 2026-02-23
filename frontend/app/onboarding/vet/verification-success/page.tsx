'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function VerificationSuccessPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#16A34A] rounded-full flex items-center justify-center animate-bounce-slow">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F] mb-3">
            License Verified!
          </h1>
          <p className="text-gray-600">
            Congratulations! Your PRC license has been verified. You now have full access to the PawSync veterinary platform.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Email</span>
            <span className="font-semibold text-[#4F4F4F]">
              {user?.email || '—'}
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Status</span>
            <span className="px-3 py-1 bg-[#DCFCE7] text-[#16A34A] text-sm font-medium rounded-full">
              Verified
            </span>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={() => router.push('/vet-dashboard')}
          className="w-full py-4 bg-[#5A7C7A] text-white rounded-xl font-semibold hover:bg-[#4A6C6A] transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
