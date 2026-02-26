'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, X, Loader, AlertCircle } from 'lucide-react'
import { getVaccinationsByPet, getStatusLabel, getStatusClasses, type Vaccination } from '@/lib/vaccinations'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetInfo {
  name: string
  microchipNumber: string | null
  photo: string | null
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

function VaccineStatus({ vax }: { vax: Vaccination }) {
  const expiry = vax.expiryDate
  if (!expiry) {
    return (
      <div className="text-right">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${getStatusClasses(vax.status)}`}>
          {getStatusLabel(vax.status)}
        </span>
      </div>
    )
  }

  const expired = isExpired(expiry)
  return (
    <div className="text-right">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
        {expired ? 'EXPIRED:' : 'VALID UNTIL:'}
      </p>
      <div className="flex items-center gap-1 justify-end">
        <p className={`text-sm font-bold ${expired ? 'text-red-500' : 'text-green-600'}`}>
          {formatMonthYear(expiry)}
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
  const { token } = useAuthStore()

  const [pet, setPet] = useState<PetInfo | null>(null)
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVax, setSelectedVax] = useState<Vaccination | null>(null)

  useEffect(() => {
    if (!petId || !token) return

    const load = async () => {
      try {
        setLoading(true)
        // Fetch pet info and vaccinations in parallel
        const [petRes, vaxData] = await Promise.all([
          fetch(`${API_BASE_URL}/pets/${petId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
          getVaccinationsByPet(petId, token),
        ])

        if (petRes.status === 'SUCCESS' && petRes.data?.pet) {
          const p = petRes.data.pet
          setPet({
            name: p.name,
            microchipNumber: p.microchipNumber || null,
            photo: p.photo || null,
          })
        }

        // Filter out declined/pending-only records for the card view
        setVaccinations(vaxData.filter((v) => v.status !== 'declined'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vaccination records')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [petId, token])

  const getVetName = (vax: Vaccination): string => {
    if (typeof vax.vetId === 'object' && vax.vetId !== null) {
      const v = vax.vetId as any
      return `Dr. ${v.firstName} ${v.lastName}`
    }
    return 'Unknown Vet'
  }

  const getClinicName = (vax: Vaccination): string => {
    if (typeof vax.clinicId === 'object' && vax.clinicId !== null) {
      return (vax.clinicId as any).name || '—'
    }
    return '—'
  }

  const getBranchName = (vax: Vaccination): string => {
    if (typeof vax.clinicBranchId === 'object' && vax.clinicBranchId !== null) {
      return (vax.clinicBranchId as any).name || '—'
    }
    return '—'
  }

  const latestVax = vaccinations[0]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Back */}
        <button
          onClick={() => router.push(`/my-pets/${petId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {pet?.name ?? 'Pet'}
        </button>

        <h1 className="text-xl font-bold text-[#4F4F4F] mb-5">Vaccine Card</h1>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

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
                <p className="text-2xl font-black text-[#1a1a1a] uppercase mb-3">{pet?.name ?? '—'}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Microchip No.</p>
                <p className="text-sm font-bold text-[#333]">{pet?.microchipNumber ?? 'Not registered'}</p>
              </div>

              {/* Pet Photo */}
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F0EF] shrink-0 border-2 border-[#C8DADA] flex items-center justify-center">
                {pet?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-[#7FA5A3]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z"/>
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2"/>
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Dashed divider */}
            <div className="mx-6 border-t-2 border-dashed border-gray-200 mb-1" />

            {/* Vaccine list */}
            {vaccinations.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-400 text-sm">No vaccination records on file yet.</p>
              </div>
            ) : (
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
                    <VaccineStatus vax={vax} />
                  </button>
                ))}
              </div>
            )}

            {/* Footer */}
            {latestVax && (
              <div className="mx-6 mt-2 mb-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Last Administered By</p>
                  <p className="text-xs font-semibold text-[#333]">{getVetName(latestVax)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Veterinary Clinic</p>
                  <p className="text-xs font-semibold text-[#333]">{getClinicName(latestVax)}</p>
                </div>
              </div>
            )}

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
              {selectedVax.dateAdministered && (
                <DetailRow label="Date administered" value={formatFullDate(selectedVax.dateAdministered)} />
              )}
              {selectedVax.expiryDate && (
                <DetailRow
                  label={isExpired(selectedVax.expiryDate) ? 'Expired' : 'Valid until'}
                  value={formatFullDate(selectedVax.expiryDate)}
                  highlight={isExpired(selectedVax.expiryDate) ? 'red' : 'green'}
                />
              )}
              {selectedVax.nextDueDate && (
                <DetailRow label="Next due" value={formatFullDate(selectedVax.nextDueDate)} />
              )}
              {selectedVax.manufacturer && (
                <DetailRow label="Manufacturer" value={selectedVax.manufacturer} />
              )}
              {selectedVax.batchNumber && (
                <DetailRow label="Batch / Lot No." value={selectedVax.batchNumber} />
              )}
              {selectedVax.route && (
                <DetailRow label="Route" value={selectedVax.route.charAt(0).toUpperCase() + selectedVax.route.slice(1)} />
              )}
              <DetailRow label="Veterinarian" value={
                typeof selectedVax.vetId === 'object' && selectedVax.vetId !== null
                  ? `Dr. ${(selectedVax.vetId as any).firstName} ${(selectedVax.vetId as any).lastName}`
                  : '—'
              } />
              <DetailRow label="Clinic" value={
                typeof selectedVax.clinicId === 'object' && selectedVax.clinicId !== null
                  ? (selectedVax.clinicId as any).name
                  : '—'
              } />
              {typeof selectedVax.clinicBranchId === 'object' && selectedVax.clinicBranchId !== null && (
                <DetailRow label="Branch" value={(selectedVax.clinicBranchId as any).name} />
              )}
              {selectedVax.notes && (
                <DetailRow label="Notes" value={selectedVax.notes} />
              )}
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
