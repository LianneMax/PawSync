'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, MessageCircle, RotateCcw } from 'lucide-react'

interface SubmissionData {
  fullName: string
  prcNumber: string
  submittedDate: string
}

export default function VerificationFailedPage() {
  const router = useRouter()
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)

  // This would typically come from the backend
  const rejectionReason = "The uploaded PRC ID photo is blurry and the license number is not clearly visible. Please upload a clear, high-resolution photo of your PRC ID where all text and numbers are legible."

  useEffect(() => {
    // Get data from sessionStorage
    const prcData = sessionStorage.getItem('prcLicenseData')

    if (prcData) {
      const prc = JSON.parse(prcData)

      const fullName = `${prc.firstName} ${prc.middleName ? prc.middleName + ' ' : ''}${prc.lastName}${prc.suffix ? ', ' + prc.suffix : ''}`

      setSubmissionData({
        fullName,
        prcNumber: prc.prcNumber,
        submittedDate: formatDate(new Date().toISOString().split('T')[0])
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

  const handleResubmit = () => {
    router.push('/onboarding/vet/prc-license')
  }

  const handleContactSupport = () => {
    // Open support contact (email or chat)
    window.location.href = 'mailto:support@pawsync.com'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#DC2626] rounded-full flex items-center justify-center">
            <X className="w-12 h-12 text-white stroke-3" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Verification Unsuccessful
          </h1>
          <p className="text-gray-600">
            Unfortunately, we were unable to verify your PRC license. Please
            review the reason below and resubmit with the correct information.
          </p>
        </div>

        {/* Submission Details Card */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
            Submission Details
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Full Name</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.fullName || 'Maria Cruz Santos'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.prcNumber || '0045678'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Submitted</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.submittedDate || 'January 20, 2026'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="px-3 py-1 bg-[#FEE2E2] text-[#DC2626] text-sm font-medium rounded-full">
                Not Verified
              </span>
            </div>
          </div>
        </div>

        {/* Rejection Reason */}
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#DC2626] mb-1">Reason for Rejection:</h4>
              <p className="text-sm text-gray-700">
                {rejectionReason}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleContactSupport}
            className="flex items-center justify-center gap-2 py-4 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Contact Support
          </button>

          <button
            onClick={handleResubmit}
            className="flex items-center justify-center gap-2 py-4 bg-[#5A7C7A] text-white rounded-xl font-semibold hover:bg-[#4A6C6A] transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Resubmit
          </button>
        </div>
      </div>
    </div>
  )
}
