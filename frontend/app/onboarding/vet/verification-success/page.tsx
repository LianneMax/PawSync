'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, BadgeCheck, Home } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface VerificationData {
  fullName: string
  prcNumber: string
  registrationDate: string
  expirationDate: string
  branch: string
  verifiedOn: string
}

export default function VerificationSuccessPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

  useEffect(() => {
    const fetchVerification = async () => {
      if (!token) return
      try {
        const res = await fetch(`${API_URL}/verifications/mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        const verifications = data?.data?.verifications
        if (verifications && verifications.length > 0) {
          const latest = verifications[0]
          const fullName = `${latest.firstName} ${latest.middleName ? latest.middleName + ' ' : ''}${latest.lastName}${latest.suffix ? ', ' + latest.suffix : ''}`
          setVerificationData({
            fullName,
            prcNumber: latest.prcLicenseNumber,
            registrationDate: formatDate(latest.registrationDate),
            expirationDate: formatDate(latest.expirationDate),
            branch: latest.branchId?.name || '—',
            verifiedOn: formatDate(latest.updatedAt || latest.createdAt)
          })
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchVerification()
  }, [token])

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-[#35785C] rounded-full flex items-center justify-center animate-bounce-slow">
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-[#35785C] mb-1.5">
            License Verified
          </h1>
          <p className="text-sm text-gray-600">
            Your PRC license has been successfully verified.
            You now have full access to the PawSync veterinary platform.
          </p>
        </div>

        {/* Submission Details Card */}
        {!loading && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <h3 className="text-xs font-bold text-[#4F4F4F] uppercase tracking-wide mb-3">
              Submission Details
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">Full Name</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">PRC License No.</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.prcNumber || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">Date of Registration</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.registrationDate || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">Expiration Date</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.expirationDate || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">Branch</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.branch || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                <span className="text-sm text-gray-500">Verified on</span>
                <span className="text-sm font-semibold text-[#4F4F4F]">{verificationData?.verifiedOn || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-500">Status</span>
                <span className="flex items-center gap-1 px-2.5 py-1 bg-[#DCFCE7] text-[#16A34A] text-xs font-medium rounded-full">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={() => router.push('/vet-dashboard')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#35785C] text-white rounded-xl font-semibold hover:bg-[#2D6B52] transition-colors text-sm"
        >
          Continue to Dashboard
          <Home className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
