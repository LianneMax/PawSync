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
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="h-screen bg-[#F8F6F2] flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-[#E89B3C] rounded-2xl flex items-center justify-center animate-bounce-slow">
            <FileText className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-[#4F4F4F] mb-1.5">
            Verification Pending
          </h1>
          <p className="text-sm text-gray-600">
            Your PRC license details have been submitted for review.
            Our team will verify your credentials within 1–2 business days.
          </p>
        </div>

        {/* Submission Details Card */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <h3 className="text-xs font-bold text-[#4F4F4F] uppercase tracking-wide mb-3">
            Submission Details
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
              <span className="text-sm text-gray-600">Full Name</span>
              <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.fullName || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
              <span className="text-sm text-gray-600">PRC License No.</span>
              <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.prcNumber || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
              <span className="text-sm text-gray-600">Date of Registration</span>
              <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.registrationDate || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
              <span className="text-sm text-gray-600">Expiration Date</span>
              <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.expirationDate || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-gray-600">Status</span>
              <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#B45309] text-xs font-medium rounded-full">
                Pending Review
              </span>
            </div>
          </div>
        </div>

        {/* Email Notice */}
        <p className="text-xs text-gray-500 text-center mb-4">
          You&apos;ll receive an email at{' '}
          <span className="text-[#7FA5A3] font-medium">
            {submissionData?.email || 'your email address'}
          </span>{' '}
          once your license is verified.
        </p>

        {/* Back to Login */}
        <button
          onClick={() => router.push('/login')}
          className="w-full py-3 bg-[#5A7C7A] text-white rounded-xl font-semibold hover:bg-[#4A6C6A] transition-colors text-sm"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}
