'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Edit } from 'lucide-react'

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
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)

  useEffect(() => {
    // Get data from sessionStorage
    const prcData = sessionStorage.getItem('prcLicenseData')
    const signupData = sessionStorage.getItem('signupData')

    if (prcData && signupData) {
      const prc = JSON.parse(prcData)
      const signup = JSON.parse(signupData)

      const fullName = `${prc.firstName} ${prc.middleName ? prc.middleName + ' ' : ''}${prc.lastName}${prc.suffix ? ', ' + prc.suffix : ''}`

      setSubmissionData({
        fullName,
        prcNumber: prc.prcNumber,
        registrationDate: formatDate(prc.registrationDate),
        expirationDate: formatDate(prc.expirationDate),
        submittedDate: formatDate(new Date().toISOString().split('T')[0]),
        email: signup.email
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

  const handleEditSubmission = () => {
    router.push('/onboarding/vet/prc-license')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#E89B3C] rounded-3xl flex items-center justify-center">
            <FileText className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Verification In Progress
          </h1>
          <p className="text-gray-600">
            Your PRC license has been submitted for review. Our team is
            verifying your credentials. This usually takes 1-2 business days.
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
                {submissionData?.fullName || 'Maria Cruz Santos, DVM'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.prcNumber || '0045678'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Date of Registration</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.registrationDate || 'June 15, 2020'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Expiration Date</span>
              <span className="font-semibold text-gray-900">
                {submissionData?.expirationDate || 'December 31, 2026'}
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
              <span className="px-3 py-1 bg-[#FEF3C7] text-[#B45309] text-sm font-medium rounded-full">
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* Email Notice */}
        <p className="text-sm text-gray-500 text-center mb-6">
          You'll receive an email at{' '}
          <span className="text-[#7FA5A3] font-medium">
            {submissionData?.email || 'maria.santos@email.com'}
          </span>{' '}
          once your license is verified.
        </p>

        {/* Edit Submission Button */}
        <button
          onClick={handleEditSubmission}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Edit className="w-5 h-5" />
          Edit Submission
        </button>
      </div>
    </div>
  )
}
