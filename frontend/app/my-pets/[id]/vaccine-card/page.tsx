'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft, CheckCircle2, ShieldCheck, X, Loader, AlertCircle } from 'lucide-react'
import { getVaccinationsByPet, getStatusLabel, type Vaccination } from '@/lib/vaccinations'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetInfo {
  name: string
  microchipNumber: string | null
  photo: string | null
  species?: string | null
}

function getDoseLabel(vax: Vaccination): string {
  const vt = typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId !== null ? vax.vaccineTypeId : null
  if (!vt) {
    return vax.doseNumber > 1 ? `Dose #${vax.doseNumber}` : 'Initial Dose'
  }
  const effectiveSeries = vt.isSeries ? vt.totalSeries : 1
  if (vax.doseNumber <= effectiveSeries) {
    if (vt.isSeries) return `Series ${vax.doseNumber}/${vt.totalSeries}`
    return 'Initial Dose'
  }
  const boosterNum = vax.boosterNumber > 0 ? vax.boosterNumber : vax.doseNumber - effectiveSeries
  return `Booster #${boosterNum}`
}

function getDoseMlLabel(vax: Vaccination): string {
  if (vax.administeredDoseMl != null) return `${vax.administeredDoseMl} mL`
  return null
}

function getAutoDoseMlBySpecies(species?: string | null): string | null {
  if (!species) return null
  const normalized = species.toLowerCase()
  if (normalized === 'canine' || normalized === 'dog') return '1.0 mL'
  if (normalized === 'feline' || normalized === 'cat') return '0.5 mL'
  return null
}

function isInSeriesPhase(vax: Vaccination): boolean {
  const vt = typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId !== null ? vax.vaccineTypeId : null
  if (!vt) return false
  const effectiveSeries = vt.isSeries ? vt.totalSeries : 1
  return vax.doseNumber < effectiveSeries
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
  const expiry = vax.expiryDate ?? null
  const nextDue = vax.nextDueDate ?? null
  const expired = expiry ? isExpired(expiry) : false

  return (
    <div className="text-right shrink-0">
      {expiry ? (
        <>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
            {expired ? 'Protection Ended' : 'Protected Until'}
          </p>
          <p className={`text-xs font-bold ${expired ? 'text-[#983232]' : 'text-[#1a1a1a]'}`}>
            {formatMonthYear(expiry)}
          </p>
        </>
      ) : nextDue ? (
        <>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Booster Due</p>
          <p className={`text-xs font-bold ${isExpired(nextDue) ? 'text-[#983232]' : 'text-amber-600'}`}>
            {formatMonthYear(nextDue)}
          </p>
        </>
      ) : (
        <>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
          <p className={`text-xs font-bold ${vax.status === 'overdue' ? 'text-[#983232]' : 'text-blue-500'}`}>
            {getStatusLabel(vax.status)}
          </p>
        </>
      )}
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
            species: p.species || null,
          })
        }

        const filteredVaccinations = vaxData.filter((vax) => {
          const isLegacyPendingPlaceholder =
            vax.status === 'pending' ||
            (vax.vaccineName || '').toLowerCase().includes('to be filled by vet') ||
            (vax.vaccineName || '').toLowerCase().startsWith('pending')
          return !isLegacyPendingPlaceholder
        })

        setVaccinations(filteredVaccinations)
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

        <div className="max-w-sm mx-auto">
          {/* Card — no overflow-hidden so cutout circles can escape the edges */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100">

            {/* Card Header — clip rounded top separately */}
            <div className="rounded-t-3xl overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-center bg-[#476B6B]">
                <Image src="/images/pawsync-logo-white.png" alt="PawSync" width={120} height={32} className="h-8 w-auto" style={{ fontFamily: 'var(--font-outfit)' }} />
              </div>
            </div>

            {/* Pet Info */}
            <div className="px-6 pt-5 pb-5 flex items-start gap-4">
              <div className="flex-1">
                <p className="text-[8px] font-medium text-gray-400 uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>Pet&apos;s Name</p>
                <p className="text-sm font-bold text-[#476B6B] mb-3 leading-tight tracking-wide" style={{ fontFamily: 'var(--font-outfit)' }}>{pet?.name ?? '—'}</p>
                <p className="text-[8px] font-medium text-gray-400 uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>NFC Tag No.</p>
                <p className="text-xs font-semibold text-[#476B6B]" style={{ fontFamily: 'var(--font-outfit)' }}>{pet?.microchipNumber ?? 'Not registered'}</p>
              </div>
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#5A8A8A] shrink-0 flex items-center justify-center">
                {pet?.photo ? (
                  <Image src={pet.photo} alt={pet.name} width={64} height={64} sizes="64px" className="w-full h-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white/60" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z"/>
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2"/>
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Dashed divider with half-circle cutouts */}
            <div className="relative flex items-center h-5 mx-0">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#F8F6F2] rounded-r-full z-10" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#F8F6F2] rounded-l-full z-10" />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            {/* Vaccine section — white background */}
            <div className="px-6 py-4 space-y-3">
              {vaccinations.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-gray-400 text-sm" style={{ fontFamily: 'var(--font-outfit)' }}>No vaccination records on file yet.</p>
                </div>
              ) : (
                <>
                  {vaccinations.map((vax) => (
                    <button
                      key={vax._id}
                      onClick={() => setSelectedVax(vax)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <p className="font-medium text-[#1a1a1a] text-sm pr-2" style={{ fontFamily: 'var(--font-outfit)' }}>{vax.vaccineName}</p>
                      <VaccineStatus vax={vax} />
                    </button>
                  ))}

                </>
              )}
              {/* Footer */}
              {latestVax && (
                <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-medium text-gray-400 uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>Administered</p>
                    <p className="text-sm font-semibold text-[#333]" style={{ fontFamily: 'var(--font-outfit)' }}>{getVetName(latestVax)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-medium text-gray-400 uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>Veterinary Clinic</p>
                    <p className="text-sm font-semibold text-[#333]" style={{ fontFamily: 'var(--font-outfit)' }}>{getClinicName(latestVax)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Verified badge */}
            <div className="mx-6 mb-6 flex items-center justify-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl py-3 px-4">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
              <span className="text-xs font-semibold text-[#2E7D32]" style={{ fontFamily: 'var(--font-outfit)' }}>Vet Verified — Linked to Medical Records</span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4 px-4">
            Tap any vaccine to view full details.
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
              <DetailRow label="Dose" value={getDoseMlLabel(selectedVax) ?? getAutoDoseMlBySpecies(pet?.species) ?? '—'} />
              {selectedVax.dateAdministered && (
                <DetailRow label="Date administered" value={formatFullDate(selectedVax.dateAdministered)} />
              )}
              {selectedVax.expiryDate && (
                <DetailRow
                  label={isExpired(selectedVax.expiryDate) ? 'Protection ended' : 'Protected until'}
                  value={formatFullDate(selectedVax.expiryDate)}
                  highlight={isExpired(selectedVax.expiryDate) ? 'red' : 'green'}
                />
              )}
              {selectedVax.nextDueDate && (
                <DetailRow
                  label={isInSeriesPhase(selectedVax) ? 'Next series dose' : 'Booster due'}
                  value={formatFullDate(selectedVax.nextDueDate)}
                  highlight={isExpired(selectedVax.nextDueDate) ? 'red' : undefined}
                />
              )}
              {(() => {
                const vt = selectedVax.vaccineTypeId
                if (typeof vt === 'object' && vt !== null) {
                  return (
                    <>
                      <DetailRow label="Protection duration" value={`${vt.validityDays} days per dose`} />
                      {vt.isSeries && (
                        <DetailRow label="Series" value={`${vt.totalSeries} doses, ${vt.seriesIntervalDays}d apart`} />
                      )}
                      {vt.boosterValid && vt.boosterIntervalDays && (
                        <DetailRow label="Booster schedule" value={`Every ${vt.boosterIntervalDays} days (ongoing)`} />
                      )}
                    </>
                  )
                }
                return null
              })()}
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
