'use client'

import { useEffect, useState } from 'react'
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
  const { user } = useAuthStore()
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)

  useEffect(() => {
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
        <div className="text-center mb-6">
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
                {submissionData?.fullName || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">PRC License No.</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.prcNumber || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Date of Registration</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.registrationDate || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Expiration Date</span>
              <span className="font-semibold text-[#4F4F4F]">
                {submissionData?.expirationDate || '—'}
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
        <p className="text-sm text-gray-500 text-center">
          You&apos;ll receive an email at{' '}
          <span className="text-[#7FA5A3] font-medium">
            {submissionData?.email || 'your email address'}
          </span>{' '}
          once your license is verified.
        </p>
      </div>
    </div>
  )
}
