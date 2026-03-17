'use client'

import { useState, useEffect } from 'react'
import { Loader, ShieldCheck } from 'lucide-react'
import { getVaccinationsByPet, getStatusLabel, type Vaccination } from '@/lib/vaccinations'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetInfo {
  name: string
  microchipNumber: string | null
  photo: string | null
}

interface Props {
  petId: string
  token: string
  /** If provided, the card will also highlight this record as newly saved/updated */
  highlightId?: string
  /** Key to force re-fetch (increment after save) */
  refreshKey?: number
}

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

function VaccineRow({ vax }: { vax: Vaccination }) {
  const expiry = vax.expiryDate
  const expired = expiry ? isExpired(expiry) : false

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <p className="font-semibold text-[#1a1a1a] text-xs leading-tight pr-2">{vax.vaccineName}</p>
      <div className="text-right shrink-0">
        {expiry ? (
          <>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
              {expired ? 'Expired' : 'Valid Until'}
            </p>
            <p className={`text-xs font-bold ${expired ? 'text-[#983232]' : 'text-[#1a1a1a]'}`}>
              {formatMonthYear(expiry)}
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
    </div>
  )
}

export default function VaccineCardPreview({ petId, token, refreshKey }: Props) {
  const [pet, setPet] = useState<PetInfo | null>(null)
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!petId || !token) return

    setLoading(true)
    Promise.all([
      fetch(`${API_BASE_URL}/pets/${petId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      getVaccinationsByPet(petId, token),
    ])
      .then(([petRes, vaxData]) => {
        if (petRes.status === 'SUCCESS' && petRes.data?.pet) {
          const p = petRes.data.pet
          setPet({ name: p.name, microchipNumber: p.microchipNumber || null, photo: p.photo || null })
        }
        setVaccinations(vaxData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [petId, token, refreshKey])

  const latestVax = vaccinations[0]

  const getVetName = (vax: Vaccination): string => {
    if (typeof vax.vetId === 'object' && vax.vetId !== null) {
      const v = vax.vetId as any
      return `Dr. ${v.firstName} ${v.lastName}`
    }
    return '—'
  }

  const getClinicName = (vax: Vaccination): string => {
    if (typeof vax.clinicId === 'object' && vax.clinicId !== null) {
      return (vax.clinicId as any).name || '—'
    }
    return '—'
  }

  return (
    <div className="sticky top-6">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vaccine Card Preview</p>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        {/* Card Header */}
        <div className="px-5 py-3.5 flex items-center justify-between bg-linear-to-r from-[#476B6B] to-[#5A8A8A]">
          <img
            src="/images/logos/pawsync-logo-white.png"
            alt="PawSync"
            className="h-7 w-auto object-contain"
          />
          <span style={{ fontFamily: 'var(--font-outfit)' }} className="text-white/90 font-bold text-[11px] tracking-wider uppercase">Vaccination Card</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-5 h-5 text-[#7FA5A3] animate-spin" />
          </div>
        ) : (
          <>
            {/* Pet Info */}
            <div className="px-5 pt-4 pb-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-wider mb-1 font-medium">Pet&apos;s Name</p>
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-bold text-[#476B6B] uppercase truncate mb-3">{pet?.name ?? '—'}</p>
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-wider mb-1 font-medium">NFC Tag No.</p>
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-xs font-bold text-[#476B6B]">{pet?.microchipNumber ?? 'Not registered'}</p>
              </div>
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#E8F0EF] shrink-0 border-2 border-[#C8DADA] flex items-center justify-center">
                {pet?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#7FA5A3]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z"/>
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5"/>
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2"/>
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center h-5 mx-0">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-r-full z-10" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-l-full z-10" />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            {/* Vaccine list */}
            {vaccinations.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm text-gray-400">No vaccination records on file yet.</p>
              </div>
            ) : (
              <div className="px-5 py-4">
                {vaccinations.map((vax, idx) => (
                  <div key={vax._id} className="flex items-center justify-between py-3" style={{ borderBottom: idx !== vaccinations.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                    <p style={{ fontFamily: 'var(--font-outfit)' }} className="font-semibold text-[#1a1a1a] text-sm leading-tight pr-2">{vax.vaccineName}</p>
                    <div className="text-right shrink-0">
                      {vax.expiryDate ? (
                        <>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 font-medium">
                            {isExpired(vax.expiryDate) ? 'Expired' : 'Valid Until'}
                          </p>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className={`text-xs font-bold ${isExpired(vax.expiryDate) ? 'text-[#983232]' : 'text-[#1a1a1a]'}`}>
                            {formatMonthYear(vax.expiryDate)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Status</p>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className={`text-xs font-bold ${vax.status === 'overdue' ? 'text-[#983232]' : 'text-blue-500'}`}>
                            {getStatusLabel(vax.status)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Divider before footer */}
            {vaccinations.length > 0 && <div className="mx-5 border-t border-gray-100" />}

            {/* Footer */}
            {latestVax && (
              <div className="px-5 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-wider mb-1 font-medium">Administered</p>
                  <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-semibold text-[#333] truncate">{getVetName(latestVax)}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-wider mb-1 font-medium">Veterinary Clinic</p>
                  <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-semibold text-[#333] truncate">{getClinicName(latestVax)}</p>
                </div>
              </div>
            )}

            {/* Verified badge */}
            <div className="mx-5 mb-4 mt-3 flex items-center justify-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl py-2.5 px-4">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
              <span style={{ fontFamily: 'var(--font-outfit)' }} className="text-xs font-semibold text-[#2E7D32]">Vet Verified — Linked to Medical Records</span>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-2">
        Live preview · Updates after saving
      </p>
    </div>
  )
}
