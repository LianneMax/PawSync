'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import {
  CheckCircle2,
  XCircle,
  Eye,
  Download,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'

// ==================== TYPES ====================

interface VetUser {
  _id: string
  firstName: string
  lastName: string
  email: string
}

interface BranchRef {
  _id: string
  name: string
}

interface VerificationRequest {
  _id: string
  vetId: VetUser
  firstName: string
  lastName: string
  middleName: string | null
  suffix: string | null
  prcLicenseNumber: string
  profession: string
  registrationDate: string
  expirationDate: string
  prcIdPhoto: string | null
  status: 'pending' | 'verified' | 'rejected'
  rejectionReason: string | null
  branchId: BranchRef | null
  createdAt: string
}

// ==================== STATUS BADGE ====================

function VerificationStatusBadge({ status }: { status: VerificationRequest['status'] }) {
  const styles = {
    pending: 'bg-orange-100 text-orange-700',
    verified: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels = {
    pending: 'Pending',
    verified: 'Verified',
    rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ==================== MAIN COMPONENT ====================

export default function VerificationPage() {
  const { token } = useAuthStore()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected'>('pending')
  const [verifyChecked, setVerifyChecked] = useState<Record<string, boolean>>({})

  // Modal states
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Photo viewer
  const [viewPhotoOpen, setViewPhotoOpen] = useState(false)
  const [viewPhotoSrc, setViewPhotoSrc] = useState('')

  const fetchVerifications = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await authenticatedFetch('/verifications/clinic', {}, token)
      if (res.status === 'SUCCESS') {
        setRequests(res.data.verifications)
      }
    } catch (err) {
      console.error('Failed to fetch verifications:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const verifiedCount = requests.filter(r => r.status === 'verified').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  const filtered = requests.filter(r => r.status === activeTab)

  const getInitials = (req: VerificationRequest) => {
    const first = req.firstName?.[0] || ''
    const last = req.lastName?.[0] || ''
    return (first + last).toUpperCase()
  }

  const getFullName = (req: VerificationRequest) => {
    let name = `${req.firstName} ${req.middleName ? req.middleName + ' ' : ''}${req.lastName}`
    if (req.suffix) name += `, ${req.suffix}`
    return name
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim() || !token) return
    setActionLoading(true)
    try {
      const res = await authenticatedFetch(`/verifications/${selectedRequest._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectionReason })
      }, token)
      if (res.status === 'SUCCESS') {
        await fetchVerifications()
        setRejectOpen(false)
        setRejectionReason('')
        setSelectedRequest(null)
      }
    } catch (err) {
      console.error('Reject error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!selectedRequest || !token) return
    setActionLoading(true)
    try {
      const res = await authenticatedFetch(`/verifications/${selectedRequest._id}/approve`, {
        method: 'PUT'
      }, token)
      if (res.status === 'SUCCESS') {
        await fetchVerifications()
        setConfirmOpen(false)
        setSelectedRequest(null)
      }
    } catch (err) {
      console.error('Verify error:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const tabs = [
    { key: 'pending' as const, label: 'Pending', count: pendingCount },
    { key: 'verified' as const, label: 'Verified', count: verifiedCount },
    { key: 'rejected' as const, label: 'Rejected', count: rejectedCount },
  ]

  return (
    <DashboardLayout userType="clinic-admin">
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#4F4F4F]">Verification Requests</h1>
          <p className="text-gray-500 text-sm mt-1">Review and verify veterinarian PRC license submissions.</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? 'bg-white/20' : 'bg-gray-300/50'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Request Cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading verification requests...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No {activeTab} verification requests</p>
            </div>
          ) : (
            filtered.map((req) => (
              <div key={req._id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Profile header */}
                <div className="p-6 flex items-center gap-4 border-b border-gray-100">
                  <div className="w-12 h-12 bg-[#F1F0ED] rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[#4F4F4F] font-semibold">{getInitials(req)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-[#4F4F4F]">{getFullName(req)}</h3>
                      <VerificationStatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-gray-500">{req.vetId?.email || ''}</p>
                  </div>
                </div>

                {/* PRC Details */}
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">PRC License Number</p>
                      <p className="text-sm font-semibold text-[#4F4F4F]">{req.prcLicenseNumber}</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Profession</p>
                      <p className="text-sm font-semibold text-[#4F4F4F]">{req.profession}</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Date of Registration</p>
                      <p className="text-sm font-semibold text-[#4F4F4F]">{formatDate(req.registrationDate)}</p>
                    </div>
                    <div className="bg-[#F8F6F2] rounded-xl p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Expiration Date</p>
                      <p className="text-sm font-semibold text-[#4F4F4F]">{formatDate(req.expirationDate)}</p>
                    </div>
                  </div>

                  {/* PRC ID Photo */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-[#4F4F4F] mb-3">PRC ID Photo</h4>
                    <div className="flex items-center gap-4">
                      {req.prcIdPhoto ? (
                        <div className="w-32 h-24 bg-[#F1F0ED] rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={req.prcIdPhoto} alt="PRC ID" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-32 h-24 bg-[#F1F0ED] rounded-xl flex items-center justify-center border border-gray-200">
                          <span className="text-xs text-gray-400">No photo</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {req.prcIdPhoto && (
                          <>
                            <button
                              onClick={() => { setViewPhotoSrc(req.prcIdPhoto!); setViewPhotoOpen(true) }}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Full Size
                            </button>
                            <a
                              href={req.prcIdPhoto}
                              download="prc-id.png"
                              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rejected reason */}
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                      <p className="text-sm font-medium text-red-700 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-600">{req.rejectionReason}</p>
                    </div>
                  )}

                  {/* Actions for pending */}
                  {req.status === 'pending' && (
                    <>
                      <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={verifyChecked[req._id] || false}
                          onChange={(e) => setVerifyChecked(prev => ({ ...prev, [req._id]: e.target.checked }))}
                          className="rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                        />
                        <span className="text-sm text-gray-600">Verify license details match the uploaded ID photo</span>
                      </label>

                      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => { setSelectedRequest(req); setRejectOpen(true) }}
                          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button
                          onClick={() => { setSelectedRequest(req); setConfirmOpen(true) }}
                          disabled={!verifyChecked[req._id]}
                          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Mark as Verified
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================== VIEW PHOTO MODAL ==================== */}
      <Dialog open={viewPhotoOpen} onOpenChange={setViewPhotoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">PRC ID Photo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {viewPhotoSrc && <img src={viewPhotoSrc} alt="PRC ID Full Size" className="max-w-full max-h-[70vh] rounded-xl" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== REJECT MODAL ==================== */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Reject Verification</DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for rejecting this verification request. This will be sent to the applicant.
            </p>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., The uploaded PRC ID photo is blurry and the license number is not clearly visible..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => { setRejectOpen(false); setRejectionReason('') }} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Rejecting...' : 'Reject Verification'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== CONFIRM VERIFICATION MODAL ==================== */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Confirm Verification</DialogTitle>
          </DialogHeader>

          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-[#4F4F4F] mb-2">
              Verify {selectedRequest ? getFullName(selectedRequest) : ''}?
            </h3>
            <p className="text-sm text-gray-500">
              By confirming, you acknowledge that you have reviewed the submitted PRC license details and ID photo, and they are valid and authentic.
            </p>
          </div>

          {selectedRequest && (
            <div className="bg-[#F8F6F2] rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">License Details:</p>
              <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                <strong>PRC No.:</strong> {selectedRequest.prcLicenseNumber} &bull; <strong>Expires:</strong> {formatDate(selectedRequest.expirationDate)}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setConfirmOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleVerify}
              disabled={actionLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Verifying...' : 'Confirm Verification'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
