'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface VerificationData {
  fullName: string
  prcNumber: string
  validUntil: string
  submittedOn: string
  email: string
}

export default function VerificationSuccessPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)

  useEffect(() => {
    const prcData = sessionStorage.getItem('prcLicenseData')

    if (prcData) {
      const prc = JSON.parse(prcData)
      const fullName = `${prc.firstName} ${prc.middleName ? prc.middleName + ' ' : ''}${prc.lastName}${prc.suffix ? ', ' + prc.suffix : ''}`

      setVerificationData({
        fullName,
        prcNumber: prc.prcNumber,
        validUntil: formatDate(prc.expirationDate),
        submittedOn: formatDate(new Date().toISOString().split('T')[0]),
        email: user?.email || ''
      })

      // Clear onboarding sessionStorage after reading
      sessionStorage.removeItem('prcLicenseData')
      sessionStorage.removeItem('clinicData')
    }
  }, [user])

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#E89B3C] rounded-3xl flex items-center justify-center animate-bounce-slow">
            <FileText className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F] mb-3">
            Verification Pending
          </h1>
          <p className="text-gray-600">
            Your PRC license details have been submitted for review.
            Our team will verify your credentials within 1–2 business days.
          </p>
        </div>

        {/* Submission Details Card */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-4">
            Submission Details
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Full Name</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.fullName || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.prcNumber || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Valid Until</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.validUntil || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Submitted On</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.submittedOn || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="px-3 py-1 bg-[#FEF3C7] text-[#B45309] text-sm font-medium rounded-full">
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* Email Notice */}
        <p className="text-sm text-gray-500 text-center mb-6">
          You&apos;ll receive an email at{' '}
          <span className="text-[#7FA5A3] font-medium">
            {verificationData?.email || 'your email address'}
          </span>{' '}
          once your license is verified.
        </p>

        {/* Continue Button */}
        <button
          onClick={() => router.push('/vet-dashboard')}
          className="w-full py-4 bg-[#5A7C7A] text-white rounded-xl font-semibold hover:bg-[#4A6C6A] transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  )
}
