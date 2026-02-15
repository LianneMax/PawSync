'use client'

import { useState } from 'react'
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

// ==================== TYPES ====================

interface VerificationRequest {
  id: string
  name: string
  email: string
  initials: string
  status: 'Pending' | 'Verified' | 'Rejected'
  prcLicenseNumber: string
  profession: string
  dateOfRegistration: string
  expirationDate: string
  rejectionReason?: string
}

// ==================== MOCK DATA ====================

const mockRequests: VerificationRequest[] = [
  { id: '1', name: 'Maria Cruz Santos', email: 'maria.santos@email.com', initials: 'MS', status: 'Pending', prcLicenseNumber: '0045678', profession: 'Veterinary Medicine', dateOfRegistration: 'June 15, 2020', expirationDate: 'December 31, 2026' },
  { id: '2', name: 'Carlos Rivera', email: 'carlos.rivera@email.com', initials: 'CR', status: 'Pending', prcLicenseNumber: '0067890', profession: 'Veterinary Medicine', dateOfRegistration: 'March 10, 2019', expirationDate: 'September 30, 2026' },
  { id: '3', name: 'Sofia Garcia', email: 'sofia.garcia@email.com', initials: 'SG', status: 'Verified', prcLicenseNumber: '0034567', profession: 'Veterinary Medicine', dateOfRegistration: 'January 5, 2018', expirationDate: 'July 31, 2027' },
  { id: '4', name: 'Miguel Torres', email: 'miguel.torres@email.com', initials: 'MT', status: 'Verified', prcLicenseNumber: '0012345', profession: 'Veterinary Medicine', dateOfRegistration: 'August 20, 2017', expirationDate: 'February 28, 2027' },
  { id: '5', name: 'Ana Reyes', email: 'ana.reyes@email.com', initials: 'AR', status: 'Rejected', prcLicenseNumber: '0098765', profession: 'Veterinary Medicine', dateOfRegistration: 'April 12, 2021', expirationDate: 'October 31, 2026', rejectionReason: 'The uploaded PRC ID photo is blurry and the license number is not clearly visible.' },
  { id: '6', name: 'David Lim', email: 'david.lim@email.com', initials: 'DL', status: 'Rejected', prcLicenseNumber: '0076543', profession: 'Veterinary Medicine', dateOfRegistration: 'November 1, 2020', expirationDate: 'May 31, 2026', rejectionReason: 'License has expired. Please submit a renewed PRC license.' },
]

// ==================== STATUS BADGE ====================

function VerificationStatusBadge({ status }: { status: VerificationRequest['status'] }) {
  const styles = {
    Pending: 'bg-orange-100 text-orange-700',
    Verified: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

// ==================== MAIN COMPONENT ====================

export default function VerificationPage() {
  const [requests, setRequests] = useState(mockRequests)
  const [activeTab, setActiveTab] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending')
  const [verifyChecked, setVerifyChecked] = useState<Record<string, boolean>>({})

  // Modal states
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const pendingCount = requests.filter(r => r.status === 'Pending').length
  const verifiedCount = requests.filter(r => r.status === 'Verified').length
  const rejectedCount = requests.filter(r => r.status === 'Rejected').length

  const filtered = requests.filter(r => r.status === activeTab)

  const handleReject = () => {
    if (!selectedRequest || !rejectionReason.trim()) return
    setRequests(prev => prev.map(r =>
      r.id === selectedRequest.id ? { ...r, status: 'Rejected' as const, rejectionReason } : r
    ))
    setRejectOpen(false)
    setRejectionReason('')
    setSelectedRequest(null)
  }

  const handleVerify = () => {
    if (!selectedRequest) return
    setRequests(prev => prev.map(r =>
      r.id === selectedRequest.id ? { ...r, status: 'Verified' as const } : r
    ))
    setConfirmOpen(false)
    setSelectedRequest(null)
  }

  const tabs = [
    { key: 'Pending' as const, label: 'Pending', count: pendingCount },
    { key: 'Verified' as const, label: 'Verified', count: verifiedCount },
    { key: 'Rejected' as const, label: 'Rejected', count: rejectedCount },
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
        <div className="flex gap-1 mb-8 bg-[#F1F0ED] rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#476B6B] text-white'
                  : 'text-[#4F4F4F] hover:bg-white/50'
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
          {filtered.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No {activeTab.toLowerCase()} verification requests</p>
            </div>
          )}

          {filtered.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Profile header */}
              <div className="p-6 flex items-center gap-4 border-b border-gray-100">
                <div className="w-12 h-12 bg-[#F1F0ED] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[#4F4F4F] font-semibold">{req.initials}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-[#4F4F4F]">{req.name}</h3>
                    <VerificationStatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-gray-500">{req.email}</p>
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
                    <p className="text-sm font-semibold text-[#4F4F4F]">{req.dateOfRegistration}</p>
                  </div>
                  <div className="bg-[#F8F6F2] rounded-xl p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Expiration Date</p>
                    <p className="text-sm font-semibold text-[#4F4F4F]">{req.expirationDate}</p>
                  </div>
                </div>

                {/* PRC ID Photo */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-[#4F4F4F] mb-3">PRC ID Photo</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-24 bg-[#F1F0ED] rounded-xl flex items-center justify-center border border-gray-200">
                      <span className="text-xs text-gray-400">PRC ID</span>
                    </div>
                    <div className="space-y-2">
                      <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> View Full Size
                      </button>
                      <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#4F4F4F] border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rejected reason */}
                {req.status === 'Rejected' && req.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-medium text-red-700 mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-600">{req.rejectionReason}</p>
                  </div>
                )}

                {/* Actions for pending */}
                {req.status === 'Pending' && (
                  <>
                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verifyChecked[req.id] || false}
                        onChange={(e) => setVerifyChecked(prev => ({ ...prev, [req.id]: e.target.checked }))}
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
                        disabled={!verifyChecked[req.id]}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark as Verified
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
              disabled={!rejectionReason.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Verification
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
              Verify {selectedRequest?.name}?
            </h3>
            <p className="text-sm text-gray-500">
              By confirming, you acknowledge that you have reviewed the submitted PRC license details and ID photo, and they are valid and authentic.
            </p>
          </div>

          {selectedRequest && (
            <div className="bg-[#F8F6F2] rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">License Details:</p>
              <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                <strong>PRC No.:</strong> {selectedRequest.prcLicenseNumber} &bull; <strong>Expires:</strong> {selectedRequest.expirationDate}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setConfirmOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-[#4F4F4F] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleVerify} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors">
              Confirm Verification
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
