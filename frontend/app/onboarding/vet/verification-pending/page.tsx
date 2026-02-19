'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface SubmissionData {
  fullName: string
  prcNumber: string
  registrationDate: string
  expirationDate: string
  submittedDate: string
  email: string
}

export default function VerificationPendingPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    // Get data from sessionStorage
    const prcData = sessionStorage.getItem('prcLicenseData')

    if (prcData) {
      const prc = JSON.parse(prcData)

      const fullName = `${prc.firstName} ${prc.middleName ? prc.middleName + ' ' : ''}${prc.lastName}${prc.suffix ? ', ' + prc.suffix : ''}`

      setSubmissionData({
        fullName,
        prcNumber: prc.prcNumber,
        registrationDate: formatDate(prc.registrationDate),
        expirationDate: formatDate(prc.expirationDate),
        submittedDate: formatDate(new Date().toISOString().split('T')[0]),
        email: user?.email || ''
      })
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

  const handleEditSubmission = () => {
    router.push('/onboarding/vet')
  }

  const handleConfirmSubmission = () => {
    // Navigate to success page after confirmation
    router.push('/onboarding/vet/verification-success')
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
            Verification In Progress
          </h1>
          <p className="text-gray-600">
            Your PRC license has been submitted for review. Our team is
            verifying your credentials. This usually takes 1-2 business days.
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
                {submissionData?.fullName || 'Maria Cruz Santos, DVM'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.prcNumber || '0045678'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Date of Registration</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.registrationDate || 'June 15, 2020'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Expiration Date</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.expirationDate || 'December 31, 2026'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Submitted</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.submittedDate || 'January 20, 2026'}
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
            {submissionData?.email || 'maria.santos@email.com'}
          </span>{' '}
          once your license is verified.
        </p>

        {/* Confirm Submission Button */}
        <button
          onClick={() => setShowConfirmation(true)}
          className="w-full py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
        >
          Confirm Submission
        </button>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 max-w-sm shadow-2xl">
              <h2 className="text-2xl font-bold text-[#4F4F4F] mb-4">
                Confirm Submission?
              </h2>
              <p className="text-gray-600 mb-2">
                Are you sure you want to submit your PRC license for verification?
              </p>
              <p className="text-sm text-red-600 font-medium mb-6 bg-red-50 p-3 rounded-lg">
                ⚠️ You will no longer be able to edit your response after submitting.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-[#4F4F4F] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmation(false)
                    handleConfirmSubmission()
                  }}
                  className="flex-1 py-3 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
