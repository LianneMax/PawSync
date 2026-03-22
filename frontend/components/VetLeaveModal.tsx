'use client'

import { useState, useEffect } from 'react'
import { Calendar, X, AlertTriangle, CheckCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { previewLeave, applyLeave, type LeaveConflict, type LeaveDecision } from '@/lib/vetLeave'
import { DatePicker } from '@/components/ui/date-picker'

interface Props {
  open: boolean
  onClose: () => void
  token: string
  onSuccess: () => void
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`
}

function getMinDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function VetLeaveModal({ open, onClose, token, onSuccess }: Props) {
  const [step, setStep] = useState<'form' | 'conflicts'>('form')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [conflicts, setConflicts] = useState<LeaveConflict[]>([])
  // decisions: keyed by appointmentId
  const [decisions, setDecisions] = useState<Record<string, { action: 'reassign' | 'cancel'; newVetId?: string }>>({})

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('form')
      setDate('')
      setReason('')
      setConflicts([])
      setDecisions({})
    }
  }, [open])

  const handlePreview = async () => {
    if (!date) return toast.error('Please select a leave date')

    setLoading(true)
    try {
      const res = await previewLeave(date, token)
      if (res.status === 'SUCCESS') {
        const appts = res.data?.affectedAppointments ?? []
        setConflicts(appts)
        // Default all to 'cancel'
        const defaultDecisions: Record<string, { action: 'cancel' }> = {}
        appts.forEach((a) => { defaultDecisions[a.appointmentId] = { action: 'cancel' } })
        setDecisions(defaultDecisions)
        setStep('conflicts')
      } else {
        toast.error(res.message || 'Could not check conflicts')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const leaveDecisions: LeaveDecision[] = conflicts.map((c) => {
        const d = decisions[c.appointmentId]
        return {
          appointmentId: c.appointmentId,
          action: d?.action ?? 'cancel',
          newVetId: d?.action === 'reassign' ? d.newVetId : undefined,
        }
      })

      // Validate: all reassign decisions must have a vet selected
      for (const ld of leaveDecisions) {
        if (ld.action === 'reassign' && !ld.newVetId) {
          toast.error('Please select a replacement vet for all reassigned appointments')
          return
        }
      }

      const res = await applyLeave({ date, reason: reason || undefined, decisions: leaveDecisions }, token)
      if (res.status === 'SUCCESS') {
        toast.success('Leave filed successfully')
        onSuccess()
        onClose()
      } else {
        toast.error(res.message || 'Failed to file leave')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Submit directly when there are no conflicts
  const handleNoConflictSubmit = async () => {
    if (!date) return toast.error('Please select a leave date')
    setSubmitting(true)
    try {
      const res = await applyLeave({ date, reason: reason || undefined, decisions: [] }, token)
      if (res.status === 'SUCCESS') {
        toast.success('Leave filed successfully')
        onSuccess()
        onClose()
      } else {
        toast.error(res.message || 'Failed to file leave')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">File Leave</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#7FA5A3]" />
            <span className="font-semibold text-[#4F4F4F]">
              {step === 'form' ? 'File Leave' : 'Review Affected Appointments'}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'form' && (
          <div className="p-4 space-y-3">
            {/* Date picker */}
            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1.5">Leave Date</label>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="MM/DD/YYYY"
                allowFutureDates
                minDate={getMinDate()}
              />
              <p className="text-[10px] text-gray-400 mt-1">Minimum 3 days in advance</p>
            </div>

            {/* Reason (optional) */}
            <div>
              <label className="block text-xs font-medium text-[#4F4F4F] mb-1.5">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Medical appointment, personal matter…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#4F4F4F] placeholder:text-gray-300 focus:outline-none focus:border-[#7FA5A3] resize-none"
              />
            </div>

            {/* Info note */}
            <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Appointments scheduled on your leave date will need to be reassigned or cancelled. You&apos;ll review them in the next step.
              </p>
            </div>

            <button
              onClick={handlePreview}
              disabled={loading || !date}
              className="w-full py-2.5 bg-[#7FA5A3] hover:bg-[#6b9391] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </div>
        )}

        {step === 'conflicts' && (
          <div className="flex flex-col max-h-[70vh]">
            {/* Conflict list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conflicts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
                  <p className="font-medium text-[#4F4F4F]">No appointments affected</p>
                  <p className="text-xs text-gray-400 mt-1">You have no scheduled appointments on this date.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    You have <strong>{conflicts.length}</strong> appointment{conflicts.length > 1 ? 's' : ''} on this date.
                    Choose what to do with each:
                  </p>
                  {conflicts.map((conflict) => {
                    const decision = decisions[conflict.appointmentId] ?? { action: 'cancel' as const }
                    return (
                      <div key={conflict.appointmentId} className="border border-gray-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#4F4F4F]">{conflict.petName}</p>
                            <p className="text-xs text-gray-400">{conflict.ownerName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatTime(conflict.startTime)} · {conflict.branchName}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {conflict.types.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">
                                  {t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action selector */}
                        <div className="space-y-2">
                          {conflict.availableVets.length > 0 && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={decision.action === 'reassign'}
                                onChange={() =>
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [conflict.appointmentId]: { action: 'reassign', newVetId: prev[conflict.appointmentId]?.newVetId },
                                  }))
                                }
                                className="accent-[#7FA5A3]"
                              />
                              <span className="text-xs text-[#4F4F4F]">Reassign to another vet</span>
                            </label>
                          )}

                          {decision.action === 'reassign' && conflict.availableVets.length > 0 && (
                            <div className="ml-5">
                              <div className="relative">
                                <select
                                  value={decision.newVetId || ''}
                                  onChange={(e) =>
                                    setDecisions((prev) => ({
                                      ...prev,
                                      [conflict.appointmentId]: { action: 'reassign', newVetId: e.target.value },
                                    }))
                                  }
                                  className="w-full appearance-none px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] pr-8"
                                >
                                  <option value="">Select vet…</option>
                                  {conflict.availableVets.map((v) => (
                                    <option key={v._id} value={v._id}>
                                      Dr. {v.firstName} {v.lastName}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                              </div>
                            </div>
                          )}

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={decision.action === 'cancel'}
                              onChange={() =>
                                setDecisions((prev) => ({
                                  ...prev,
                                  [conflict.appointmentId]: { action: 'cancel' },
                                }))
                              }
                              className="accent-[#7FA5A3]"
                            />
                            <span className="text-xs text-[#4F4F4F]">
                              {conflict.availableVets.length === 0
                                ? 'Auto-cancel (no other vet available)'
                                : 'Cancel this appointment'}
                            </span>
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-3 flex gap-3">
              <button
                onClick={() => setStep('form')}
                disabled={submitting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-[#4F4F4F] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={conflicts.length === 0 ? handleNoConflictSubmit : handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#7FA5A3] hover:bg-[#6b9391] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? 'Filing…' : 'Confirm Leave'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
