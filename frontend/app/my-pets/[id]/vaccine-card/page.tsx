'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, X } from 'lucide-react'

// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE_PET = {
  name: 'Max',
  microchipNumber: '123456789101112',
  photo: null as string | null,
  qrCode: null as string | null,
}

const SAMPLE_VACCINATIONS = [
  {
    _id: '1',
    vaccineName: 'Anti-rabies',
    dateAdministered: '2024-12-13',
    nextDueDate: '2026-12-01',
    isUpToDate: true,
    vetId: { firstName: 'Karla', lastName: 'Peralta' },
    clinicId: { name: 'Happy Trails Veterinary Care' },
    clinicBranchId: { name: 'Main Branch' },
  },
  {
    _id: '2',
    vaccineName: 'Core vaccine (DHLPPi)',
    dateAdministered: '2024-11-05',
    nextDueDate: '2026-02-01',
    isUpToDate: true,
    vetId: { firstName: 'Karla', lastName: 'Peralta' },
    clinicId: { name: 'Happy Trails Veterinary Care' },
    clinicBranchId: { name: 'Main Branch' },
  },
  {
    _id: '3',
    vaccineName: 'Anti-tick & flea',
    dateAdministered: '2024-02-10',
    nextDueDate: '2025-03-01',
    isUpToDate: false,
    vetId: { firstName: 'Karla', lastName: 'Peralta' },
    clinicId: { name: 'Happy Trails Veterinary Care' },
    clinicBranchId: { name: 'Main Branch' },
  },
  {
    _id: '4',
    vaccineName: 'Leptospirosis',
    dateAdministered: '2024-12-13',
    nextDueDate: '2026-12-01',
    isUpToDate: true,
    vetId: { firstName: 'Karla', lastName: 'Peralta' },
    clinicId: { name: 'Happy Trails Veterinary Care' },
    clinicBranchId: { name: 'Main Branch' },
  },
]

type SampleVax = (typeof SAMPLE_VACCINATIONS)[number]
// ─────────────────────────────────────────────────────────────────────────────

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isExpired(nextDueDate: string | null): boolean {
  if (!nextDueDate) return false
  return new Date(nextDueDate) < new Date()
}

function VaccineStatus({ nextDueDate }: { nextDueDate: string | null }) {
  if (!nextDueDate) {
    return (
      <div className="text-right">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
        <p className="text-sm font-semibold text-gray-500">No expiry</p>
      </div>
    )
  }

  const expired = isExpired(nextDueDate)
  return (
    <div className="text-right">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
        {expired ? 'EXPIRED:' : 'VALID UNTIL:'}
      </p>
      <div className="flex items-center gap-1 justify-end">
        <p className={`text-sm font-bold ${expired ? 'text-red-500' : 'text-green-600'}`}>
          {formatMonthYear(nextDueDate)}
        </p>
        {expired ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
      </div>
    </div>
  )
}

export default function VaccineCardPage() {
  const router = useRouter()
  const params = useParams()
  const petId = params.id as string

  const [selectedVax, setSelectedVax] = useState<SampleVax | null>(null)

  const pet = SAMPLE_PET
  const vaccinations = SAMPLE_VACCINATIONS
  const latestVax = vaccinations[0]

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Back */}
        <button
          onClick={() => router.push(`/my-pets/${petId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {pet.name}
        </button>

        <h1 className="text-xl font-bold text-[#4F4F4F] mb-5">Vaccine Card</h1>

        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

            {/* Card Header */}
            <div className="px-6 py-4 flex items-center justify-between bg-linear-to-r from-[#476B6B] to-[#5A8A8A]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z"/>
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2"/>
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2"/>
                  </svg>
                </div>
                <span className="text-white font-black text-lg tracking-wide">PawSync</span>
              </div>
              <span className="text-white/90 font-bold text-sm tracking-wider uppercase">
                Vaccination Card
              </span>
            </div>

            {/* Pet Info */}
            <div className="px-6 pt-5 pb-4 flex items-start gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pet&apos;s Name</p>
                <p className="text-2xl font-black text-[#1a1a1a] uppercase mb-3">{pet.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Microchip No.</p>
                <p className="text-sm font-bold text-[#333]">{pet.microchipNumber}</p>
              </div>

              {/* Pet Photo placeholder */}
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F0EF] shrink-0 border-2 border-[#C8DADA] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#7FA5A3]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z"/>
                  <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5"/>
                  <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5"/>
                  <ellipse cx="4.5" cy="14" rx="1.5" ry="2"/>
                  <ellipse cx="19.5" cy="14" rx="1.5" ry="2"/>
                </svg>
              </div>
            </div>

            {/* Dashed divider */}
            <div className="mx-6 border-t-2 border-dashed border-gray-200 mb-1" />

            {/* Vaccine list */}
            <div className="px-6 py-2">
              {vaccinations.map((vax, idx) => (
                <button
                  key={vax._id}
                  onClick={() => setSelectedVax(vax)}
                  className={`w-full flex items-center justify-between py-3.5 text-left hover:bg-[#F8F6F2] transition-colors rounded-lg px-2 -mx-2 ${
                    idx < vaccinations.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <p className="font-semibold text-[#1a1a1a] text-sm">{vax.vaccineName}</p>
                  <VaccineStatus nextDueDate={vax.nextDueDate} />
                </button>
              ))}
            </div>

            {/* Administered / Clinic footer */}
            <div className="mx-6 mt-2 mb-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Administered</p>
                <p className="text-xs font-semibold text-[#333]">
                  Dr. {latestVax.vetId.firstName} {latestVax.vetId.lastName}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Veterinary Clinic</p>
                <p className="text-xs font-semibold text-[#333]">{latestVax.clinicId.name}</p>
              </div>
            </div>

            {/* Bottom accent strip */}
            <div className="h-2 w-full bg-linear-to-r from-[#476B6B] to-[#5A8A8A]" />
          </div>

          <p className="text-center text-xs text-gray-400 mt-4 px-4">
            Vaccinations are linked to your pet&apos;s medical records. Tap any vaccine to view details.
          </p>
        </div>
      </div>

      {/* Vaccine Detail Modal */}
      {selectedVax && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between bg-linear-to-r from-[#476B6B] to-[#5A8A8A]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{selectedVax.vaccineName}</p>
                  <p className="text-white/75 text-xs">Vaccine details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVax(null)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="mx-5 border-t-2 border-dashed border-gray-200 mt-4" />

            <div className="px-5 pt-4 pb-6 space-y-3">
              <DetailRow label="Vaccine name" value={selectedVax.vaccineName} />
              <DetailRow label="Date administered" value={formatFullDate(selectedVax.dateAdministered)} />
              {selectedVax.nextDueDate && (
                <DetailRow
                  label={isExpired(selectedVax.nextDueDate) ? 'Expired' : 'Valid until'}
                  value={formatFullDate(selectedVax.nextDueDate)}
                  highlight={isExpired(selectedVax.nextDueDate) ? 'red' : 'green'}
                />
              )}
              <DetailRow
                label="Veterinarian"
                value={`Dr. ${selectedVax.vetId.firstName} ${selectedVax.vetId.lastName}`}
              />
              <DetailRow label="Veterinary clinic" value={selectedVax.clinicId.name} />
              <DetailRow label="Branch" value={selectedVax.clinicBranchId.name} />
              <div className="pt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#7FA5A3]" />
                <span className="text-xs font-semibold text-[#476B6B]">
                  Vet verified — linked to medical records
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedVax(null)}
              className="w-full py-3.5 font-semibold text-white text-sm bg-linear-to-r from-[#476B6B] to-[#5A8A8A] hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'green' }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-xs text-gray-400 shrink-0 w-36">{label}</p>
      <p className={`text-sm font-semibold text-right ${
        highlight === 'red' ? 'text-red-500' : highlight === 'green' ? 'text-green-600' : 'text-[#1a1a1a]'
      }`}>
        {value}
      </p>
    </div>
  )
}
