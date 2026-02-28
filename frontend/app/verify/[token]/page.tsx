'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  Loader,
  Syringe,
  Calendar,
  User,
  Building2,
  PawPrint,
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface VerifiedVaccination {
  _id: string
  vaccineName: string
  dateAdministered: string | null
  expiryDate: string | null
  nextDueDate: string | null
  status: 'active' | 'expired' | 'overdue' | 'pending' | 'declined'
  manufacturer: string
  batchNumber: string
  route: string | null
  petId: {
    name: string
    species: string
    breed: string
    photo?: string
  } | null
  vetId: { firstName: string; lastName: string } | null
  clinicId: { name: string } | null
  clinicBranchId: { name: string } | null
  vaccineTypeId: { name: string } | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const STATUS_CONFIG = {
  active: {
    label: 'Valid',
    icon: ShieldCheck,
    bg: 'from-emerald-500 to-green-600',
    badge: 'bg-green-100 text-green-700 border-green-200',
  },
  expired: {
    label: 'Expired',
    icon: ShieldX,
    bg: 'from-red-500 to-rose-600',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
  overdue: {
    label: 'Overdue',
    icon: ShieldX,
    bg: 'from-orange-500 to-amber-600',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  pending: {
    label: 'Pending',
    icon: ShieldCheck,
    bg: 'from-blue-500 to-indigo-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  declined: {
    label: 'Declined',
    icon: ShieldX,
    bg: 'from-gray-500 to-gray-600',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
  },
} as const

const PawIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z" />
    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="4.5" cy="14" rx="1.5" ry="2" />
    <ellipse cx="19.5" cy="14" rx="1.5" ry="2" />
  </svg>
)

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 shrink-0 w-32">{label}</p>
      <p className="text-sm font-semibold text-[#1a1a1a] text-right">{value}</p>
    </div>
  )
}

export default function VerifyVaccinationPage() {
  const { token } = useParams<{ token: string }>()
  const [vax, setVax] = useState<VerifiedVaccination | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE_URL}/vaccinations/verify/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.status === 'SUCCESS') {
          setVax(json.data.vaccination)
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center">
        <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
      </div>
    )
  }

  if (notFound || !vax) {
    return (
      <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
          <div className="px-6 py-5 bg-linear-to-r from-[#476B6B] to-[#5A8A8A] flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <PawIcon className="w-6 h-6 fill-white" />
            </div>
            <span className="text-white font-black text-lg">PawSync</span>
          </div>
          <div className="px-6 py-10 text-center">
            <ShieldX className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Record Not Found</h2>
            <p className="text-gray-400 text-sm">
              This QR code is invalid or the vaccination record no longer exists.
            </p>
          </div>
          <div className="h-2 bg-linear-to-r from-[#476B6B] to-[#5A8A8A]" />
        </div>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[vax.status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const displayDate = vax.nextDueDate ?? vax.expiryDate

  return (
    <div className="min-h-screen bg-[#F8F6F2] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 bg-linear-to-r ${cfg.bg}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <PawIcon className="w-5 h-5 fill-white" />
              </div>
              <span className="text-white font-black">PawSync</span>
            </div>
            <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Verification</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <StatusIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">{vax.vaccineName}</p>
              <span className="text-white/80 text-xs font-semibold capitalize">
                Status: {cfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Pet info */}
        {vax.petId && (
          <div className="px-6 pt-5 pb-3 flex items-center gap-3 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[#E8F0EF] shrink-0">
              {vax.petId.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vax.petId.photo} alt={vax.petId.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PawPrint className="w-6 h-6 text-[#7FA5A3]" />
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-[#1a1a1a] text-base">{vax.petId.name}</p>
              <p className="text-xs text-gray-400 capitalize">
                {vax.petId.species} · {vax.petId.breed}
              </p>
            </div>
          </div>
        )}

        {/* Vaccine details */}
        <div className="px-6 py-4">
          <Row label="Vaccine" value={vax.vaccineName} />
          {vax.dateAdministered && (
            <Row label="Administered" value={formatDate(vax.dateAdministered)} />
          )}
          {displayDate && (
            <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50">
              <p className="text-xs text-gray-400 shrink-0 w-32">
                {vax.nextDueDate ? 'Valid Until' : 'Expires'}
              </p>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold ${isPast(displayDate) ? 'text-red-500' : 'text-green-600'}`}>
                  {formatDate(displayDate)}
                </p>
                {isPast(displayDate)
                  ? <XCircle className="w-4 h-4 text-red-500" />
                  : <CheckCircle2 className="w-4 h-4 text-green-500" />
                }
              </div>
            </div>
          )}
          {vax.manufacturer && <Row label="Manufacturer" value={vax.manufacturer} />}
          {vax.batchNumber && <Row label="Batch No." value={vax.batchNumber} />}
          {vax.vetId && (
            <Row label="Veterinarian" value={`Dr. ${vax.vetId.firstName} ${vax.vetId.lastName}`} />
          )}
          {vax.clinicId && <Row label="Clinic" value={vax.clinicId.name} />}
          {vax.clinicBranchId && <Row label="Branch" value={vax.clinicBranchId.name} />}
        </div>

        {/* Verified footer */}
        <div className="mx-6 mb-5 pt-4 border-t border-dashed border-gray-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7FA5A3]" />
            <span className="text-xs font-semibold text-[#476B6B]">
              Verified by PawSync — Linked to official medical records
            </span>
          </div>
        </div>

        <div className="h-2 bg-linear-to-r from-[#476B6B] to-[#5A8A8A]" />
      </div>
    </div>
  )
}
