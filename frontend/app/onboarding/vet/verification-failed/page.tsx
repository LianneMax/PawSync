'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, XCircle, RotateCcw } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface SubmissionData {
  fullName: string
  prcNumber: string
  registrationDate: string
  expirationDate: string
  branch: string
  submittedDate: string
  rejectionReason: string
}

export default function VerificationFailedPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)
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
          setSubmissionData({
            fullName,
            prcNumber: latest.prcLicenseNumber,
            registrationDate: formatDate(latest.registrationDate),
            expirationDate: formatDate(latest.expirationDate),
            branch: latest.branchId?.name || '—',
            submittedDate: formatDate(latest.createdAt),
            rejectionReason: latest.rejectionReason || 'No reason provided.'
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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 relative">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-[#DC2626] rounded-full flex items-center justify-center animate-bounce-slow">
            <X className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-[#4F4F4F] mb-1.5">
            Verification Unsuccessful
          </h1>
          <p className="text-sm text-gray-600">
            Unfortunately, we are unable to verify your PRC license.
            Please review the reason below and resubmit with the correct information.
          </p>
        </div>

        {!loading && (
          <>
            {/* Submission Details Card */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <h3 className="text-xs font-bold text-[#4F4F4F] uppercase tracking-wide mb-3">
                Submission Details
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">Full Name</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.fullName || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">PRC License No.</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.prcNumber || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">Date of Registration</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.registrationDate || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">Expiration Date</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.expirationDate || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">Branch</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.branch || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
                  <span className="text-sm text-gray-500">Submitted on</span>
                  <span className="text-sm font-semibold text-[#4F4F4F]">{submissionData?.submittedDate || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-[#F4D3D2] text-[#CC6462] text-xs font-medium rounded-full">
                    <XCircle className="w-3.5 h-3.5" />
                    Not Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Rejection Reason */}
            <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-[#CC6462] mb-1">Reason for Rejection:</p>
              <p className="text-sm text-[#4F4F4F]">
                {submissionData?.rejectionReason || '—'}
              </p>
            </div>
          </>
        )}

        {/* Resubmit Button */}
        <button
          onClick={() => router.push('/onboarding/vet')}
          className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 text-[#4F4F4F] rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Resubmit
        </button>
      </div>
    </div>
  )
}
