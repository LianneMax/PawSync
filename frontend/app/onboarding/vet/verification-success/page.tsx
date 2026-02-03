'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Shield } from 'lucide-react'

interface VerificationData {
  fullName: string
  prcNumber: string
  validUntil: string
  verifiedOn: string
}

export default function VerificationSuccessPage() {
  const router = useRouter()
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)

  useEffect(() => {
    // Get data from sessionStorage
    const prcData = sessionStorage.getItem('prcLicenseData')

    if (prcData) {
      const prc = JSON.parse(prcData)

      const fullName = `${prc.firstName} ${prc.middleName ? prc.middleName + ' ' : ''}${prc.lastName}${prc.suffix ? ', ' + prc.suffix : ''}`

      setVerificationData({
        fullName,
        prcNumber: prc.prcNumber,
        validUntil: formatDate(prc.expirationDate),
        verifiedOn: formatDate(new Date().toISOString().split('T')[0])
      })
    }
  }, [])

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleContinue = () => {
    // Clear onboarding data and redirect to dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#22C55E] rounded-full flex items-center justify-center animate-bounce-slow">
            <Check className="w-12 h-12 text-white stroke-3" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#4F4F4F] mb-3">
            License Verified! 🎉
          </h1>
          <p className="text-gray-600">
            Congratulations! Your PRC license has been verified. You now
            have full access to PawSync as a verified veterinarian.
          </p>
        </div>

        {/* Verification Details Card */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
            Verification Details
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Full Name</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.fullName || 'Maria Cruz Santos, DVM'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.prcNumber || '0045678'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Valid Until</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.validUntil || 'December 31, 2026'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Verified On</span>
              <span className="font-semibold text-[#4F4F4F]">
                {verificationData?.verifiedOn || 'January 21, 2026'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="px-3 py-1 bg-[#DCFCE7] text-[#16A34A] text-sm font-medium rounded-full">
                Verified
              </span>
            </div>
          </div>
        </div>

        {/* Verified Badge Notice */}
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[#DCFCE7] rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div>
              <h4 className="font-semibold text-[#4F4F4F] mb-1">Verified Badge Active</h4>
              <p className="text-sm text-gray-600">
                Your profile now displays a verified badge, letting pet owners know you&apos;re a
                licensed veterinarian.
              </p>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#5A7C7A] text-white rounded-xl font-semibold hover:bg-[#4A6C6A] transition-colors"
        >
          <Check className="w-5 h-5" />
          Continue to Dashboard
        </button>
      </div>
    </div>
  )
}
