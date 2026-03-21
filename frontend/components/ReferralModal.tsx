'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getClinicBranches, getAssignedVets, type ClinicBranch, type AssignedVet } from '@/lib/appointments'
import { createReferral } from '@/lib/referrals'
import { toast } from 'sonner'
import { ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ReferralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
  petName: string
  recordId: string
  /** The branch the referring vet is currently in */
  referringBranchId: string
  /** Called with the new referral ID after successful submission */
  onReferred: (referralId: string) => void
}

function BranchVetDropdown({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled = false,
  loading = false,
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onSelect: (val: string) => void
  disabled?: boolean
  loading?: boolean
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <div>
      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">{label}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:border-[#7FA5A3] transition-colors text-left text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              <span className={selected ? 'text-[#4F4F4F]' : 'text-gray-400'}>
                {selected ? selected.label : placeholder}
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) max-h-48 overflow-y-auto rounded-xl">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">No options available</div>
          ) : (
            options.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => onSelect(opt.value)}
                className={`px-4 py-2.5 text-sm transition-colors ${
                  opt.value === value ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium' : 'text-[#4F4F4F]'
                }`}
              >
                {opt.label}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function ReferralModal({
  open,
  onOpenChange,
  petId,
  petName,
  recordId,
  referringBranchId,
  onReferred,
}: ReferralModalProps) {
  const token = useAuthStore((s) => s.token)

  const [branches, setBranches] = useState<ClinicBranch[]>([])
  const [vets, setVets] = useState<AssignedVet[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedVetId, setSelectedVetId] = useState('')
  const [reason, setReason] = useState('')
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [vetsLoading, setVetsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validationError, setValidationError] = useState('')

  // Load all clinic branches when modal opens
  useEffect(() => {
    if (!open || !token) return
    setBranchesLoading(true)
    getClinicBranches(token as string, true)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data) setBranches(res.data)
      })
      .catch(() => toast.error('Failed to load branches'))
      .finally(() => setBranchesLoading(false))
  }, [open, token])

  // Load vets when branch changes
  useEffect(() => {
    if (!selectedBranchId || !token) { setVets([]); return }
    setVetsLoading(true)
    setSelectedVetId('')
    getAssignedVets(selectedBranchId, token as string)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data) setVets(res.data)
      })
      .catch(() => toast.error('Failed to load vets'))
      .finally(() => setVetsLoading(false))
  }, [selectedBranchId, token])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedBranchId('')
      setSelectedVetId('')
      setReason('')
      setValidationError('')
      setShowConfirm(false)
    }
  }, [open])

  const validate = (): boolean => {
    if (!selectedBranchId) { setValidationError('Please select a branch.'); return false }
    if (!selectedVetId) { setValidationError('Please select a referred vet.'); return false }
    if (!reason.trim()) { setValidationError('Please enter a reason for referral.'); return false }
    setValidationError('')
    return true
  }

  const handleRequestConfirm = () => {
    if (!validate()) return
    setShowConfirm(true)
  }

  const handleConfirmedSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      const res = await createReferral(
        {
          petId,
          medicalRecordId: recordId,
          referredVetId: selectedVetId,
          referredBranchId: selectedBranchId,
          referringBranchId,
          reason: reason.trim(),
        },
        token as string
      )
      if (res.status === 'SUCCESS' && res.data?.referral._id) {
        toast.success('Referral created and medical history shared')
        setShowConfirm(false)
        onOpenChange(false)
        onReferred(res.data.referral._id)
      } else {
        toast.error(res.message || 'Failed to create referral')
        setShowConfirm(false)
      }
    } catch {
      toast.error('Failed to create referral')
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedVet = vets.find((v) => v._id === selectedVetId)
  const selectedBranch = branches.find((b) => b._id === selectedBranchId)

  return (
    <>
      {/* ── Main referral form modal ── */}
      <Dialog open={open && !showConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-2xl p-0 gap-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="px-6 py-5 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-[#2C3E2D]">Referral to Another Vet</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-0.5">
              Select a branch and vet to refer <strong>{petName}</strong>. The referred vet will receive the pet's complete medical history.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            {/* Branch */}
            <BranchVetDropdown
              label="Clinic Branch"
              value={selectedBranchId}
              placeholder="Select a branch"
              options={branches
                .filter((b) => b._id !== referringBranchId)
                .map((b) => ({ value: b._id, label: b.name }))}
              onSelect={setSelectedBranchId}
              loading={branchesLoading}
            />

            {/* Vet */}
            <BranchVetDropdown
              label="Referred Veterinarian"
              value={selectedVetId}
              placeholder={selectedBranchId ? 'Select a vet' : 'Select a branch first'}
              options={vets.map((v) => ({ value: v._id, label: `Dr. ${v.firstName} ${v.lastName}` }))}
              onSelect={setSelectedVetId}
              disabled={!selectedBranchId}
              loading={vetsLoading}
            />

            {/* Reason */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Reason for Referral</p>
              <textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); setValidationError('') }}
                placeholder="Describe the reason for referral…"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] placeholder-gray-400 resize-none focus:outline-none focus:border-[#7FA5A3] transition-colors"
              />
            </div>

            {validationError && (
              <div className="flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationError}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestConfirm}
              className="px-6 py-2.5 text-sm font-medium text-white bg-[#5A7C7A] rounded-full hover:bg-[#4a6a6a] transition-colors"
            >
              Review &amp; Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation dialog ── */}
      <Dialog open={showConfirm} onOpenChange={(o) => { if (!o && !submitting) setShowConfirm(false) }}>
        <DialogContent className="max-w-sm rounded-2xl p-6 gap-0 [&>button]:hidden">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base font-semibold text-[#4F4F4F]">Finalize referral?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              You are referring <strong>{petName}</strong> to{' '}
              <strong>Dr. {selectedVet ? `${selectedVet.firstName} ${selectedVet.lastName}` : '—'}</strong>{' '}
              at <strong>{selectedBranch?.name ?? '—'}</strong>. Their full medical history will be shared immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <button
              disabled={submitting}
              onClick={() => setShowConfirm(false)}
              className="px-5 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Go back
            </button>
            <button
              disabled={submitting}
              onClick={handleConfirmedSubmit}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#5A7C7A] rounded-full hover:bg-[#4a6a6a] transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Referral
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
