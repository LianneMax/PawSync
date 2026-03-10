'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { getVaccinationsByPet, type Vaccination } from '@/lib/medicalRecords'
import { CheckCircle2, XCircle, ShieldCheck, X, PawPrint, AlertCircle } from 'lucide-react'

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

/** Determine the effective pill status for a vaccination */
function getPillStatus(vax: Vaccination): 'active' | 'expired' | 'overdue' | 'pending' | 'declined' {
  if (vax.status === 'declined') return 'declined'
  if (vax.status === 'overdue') return 'overdue'
  if (vax.status === 'pending') return 'pending'
  if (vax.expiryDate && isPast(vax.expiryDate)) return 'expired'
  return 'active'
}


function VaccineStatusDetail({ vax }: { vax: Vaccination }) {
  const status = getPillStatus(vax)
  const isOverdueOrExpired = status === 'expired' || status === 'overdue'
  const dateToShow = vax.expiryDate ?? vax.nextDueDate ?? null

  return (
    <div className="text-right">
      {dateToShow ? (
        <>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
            {isOverdueOrExpired ? 'Expired' : 'Valid Until'}
          </p>
          <div className="flex items-center gap-1 justify-end">
            <p className={`text-sm font-bold ${isOverdueOrExpired ? 'text-[#983232]' : 'text-green-600'}`}>
              {formatMonthYear(dateToShow)}
            </p>
            {isOverdueOrExpired
              ? <XCircle className="w-4 h-4 text-[#983232]" />
              : <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
        </>
      ) : (
        <>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
          <p className={`text-sm font-semibold ${isOverdueOrExpired ? 'text-[#983232]' : status === 'active' ? 'text-green-600' : 'text-blue-500'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </>
      )}
    </div>
  )
}

interface SelectedVax extends Vaccination {
  petName: string
}

interface PetWithVax {
  pet: Pet
  vaccinations: Vaccination[]
}

const PawIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z" />
    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="4.5" cy="14" rx="1.5" ry="2" />
    <ellipse cx="19.5" cy="14" rx="1.5" ry="2" />
  </svg>
)

export default function VaccineCardsPage() {
  const { token } = useAuthStore()
  const [petsData, setPetsData] = useState<PetWithVax[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVax, setSelectedVax] = useState<SelectedVax | null>(null)
  const [selectedCard, setSelectedCard] = useState<Pet | null>(null)

  useEffect(() => {
    async function fetchAll() {
      if (!token) return
      setLoading(true)
      try {
        const petsRes = await getMyPets(token)
        const pets = petsRes.data?.pets ?? []
        const results = await Promise.all(
          pets.map(async (pet) => {
            const vaxRes = await getVaccinationsByPet(pet._id, token)
            return { pet, vaccinations: (vaxRes.data?.vaccinations ?? []).filter((v: Vaccination) => v.status !== 'declined') }
          })
        )
        setPetsData(results)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [token])

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <h1
          className="text-[32px] text-[#476B6B] mb-8"
          style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
        >
          Vaccine Cards
        </h1>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-3xl shadow-xl h-64 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : petsData.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#4F4F4F] mb-2">No pets found</h2>
            <p className="text-gray-500">Add a pet to see their vaccine card here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {petsData.map(({ pet, vaccinations }) => {
              const latestVax = vaccinations[0]
              const hasOverdue = vaccinations.some((v) => getPillStatus(v) === 'overdue' || getPillStatus(v) === 'expired')

              return (
                <div key={pet._id} className="cursor-pointer" onClick={() => setSelectedCard(pet)}>
                  {/* Card — no overflow-hidden so cutouts can escape edges */}
                  <div className="bg-white rounded-3xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
                    {/* Header — clip rounded top separately */}
                    <div className="rounded-t-3xl overflow-hidden">
                      <div className="px-5 py-3.5 flex items-center justify-between bg-[#476B6B]">
                        <img
                          src="/images/pawsync-logo-white.png"
                          alt="PawSync"
                          className="h-7 w-auto object-contain"
                        />
                        <span style={{ fontFamily: 'var(--font-outfit)' }} className="text-white font-bold text-[11px] tracking-wider uppercase">Vaccination Card</span>
                      </div>
                    </div>

                    {/* Pet Info */}
                    <div className="px-5 pt-4 pb-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-widest mb-1 font-medium">Pet&apos;s Name</p>
                        <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-bold text-[#476B6B] uppercase truncate mb-3 leading-tight tracking-wide">{pet.name}</p>
                        <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-widest mb-1 font-medium">NFC Tag No.</p>
                        <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-xs font-semibold text-[#476B6B]">{pet.nfcTagId ?? pet.microchipNumber ?? 'Not registered'}</p>
                      </div>
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#5A8A8A] shrink-0 flex items-center justify-center">
                        {pet.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <PawIcon className="w-8 h-8 fill-white/60" />
                        )}
                      </div>
                    </div>

                    {/* Dashed divider with half-circle cutouts */}
                    <div className="relative flex items-center h-5 mx-0">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#F8F6F2] rounded-r-full z-10" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#F8F6F2] rounded-l-full z-10" />
                      <div className="w-full border-t-2 border-dashed border-gray-200" />
                    </div>

                    {/* Vaccine section */}
                    <div className="px-5 py-4">
                      {vaccinations.length === 0 ? (
                        <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm text-gray-400 text-center py-6">No vaccinations recorded yet.</p>
                      ) : (
                        <>
                          {vaccinations.map((vax, idx) => (
                            <button
                              key={vax._id}
                              onClick={(e) => { e.stopPropagation(); setSelectedVax({ ...vax, petName: pet.name }) }}
                              className="w-full flex items-center justify-between py-3 text-left hover:opacity-70 transition-opacity"
                              style={{ borderBottom: idx !== vaccinations.length - 1 ? '1px solid #E5E7EB' : 'none' }}
                            >
                              <p style={{ fontFamily: 'var(--font-outfit)' }} className="font-semibold text-[#1a1a1a] text-sm pr-2">{vax.vaccineName}</p>
                              <div className="text-right shrink-0">
                                {(vax.expiryDate ?? vax.nextDueDate) ? (
                                  <>
                                    <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[9px] text-gray-400 uppercase tracking-wide mb-1 font-medium">
                                      {getPillStatus(vax) === 'expired' || getPillStatus(vax) === 'overdue' ? 'Expired' : 'Valid Until'}
                                    </p>
                                    <p style={{ fontFamily: 'var(--font-outfit)' }} className={`text-xs font-bold ${getPillStatus(vax) === 'expired' || getPillStatus(vax) === 'overdue' ? 'text-[#983232]' : 'text-[#1a1a1a]'}`}>
                                      {formatMonthYear((vax.expiryDate ?? vax.nextDueDate)!)}
                                    </p>
                                  </>
                                ) : (
                                  <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[10px] font-bold text-blue-500">{vax.status}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Divider before footer */}
                    {latestVax && <div className="mx-5 border-t border-gray-100" />}

                    {/* Footer */}
                    {latestVax && (
                      <div className="px-5 py-3 grid grid-cols-2 gap-4">
                        <div>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-widest mb-1 font-medium">Administered</p>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-semibold text-[#333] truncate">
                            {latestVax.vetId ? `Dr. ${latestVax.vetId.firstName} ${latestVax.vetId.lastName}` : '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-[8px] text-gray-500 uppercase tracking-widest mb-1 font-medium">Veterinary Clinic</p>
                          <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm font-semibold text-[#333] truncate">{latestVax.clinicId?.name ?? '—'}</p>
                        </div>
                      </div>
                    )}

                    {/* Verified badge */}
                    <div className="mx-5 mb-4 flex items-center justify-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl py-2.5 px-4">
                      <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
                      <span style={{ fontFamily: 'var(--font-outfit)' }} className="text-xs font-semibold text-[#2E7D32]">Vet Verified — Linked to Medical Records</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
                  <p className="text-white/75 text-xs">{selectedVax.petName} · Vaccine details</p>
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
                  label={isPast(selectedVax.expiryDate) ? 'Expired' : 'Valid until'}
                  value={formatFullDate(selectedVax.expiryDate)}
                  highlight={isPast(selectedVax.expiryDate) ? 'red' : 'green'}
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
              {selectedVax.vetId && (
                <DetailRow label="Veterinarian" value={`Dr. ${selectedVax.vetId.firstName} ${selectedVax.vetId.lastName}`} />
              )}
              {selectedVax.clinicId && (
                <DetailRow label="Veterinary clinic" value={selectedVax.clinicId.name} />
              )}
              <div className="pt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#7FA5A3]" />
                <span className="text-xs font-semibold text-[#476B6B]">Vet verified — linked to medical records</span>
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

      {/* Full Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between bg-linear-to-r from-[#476B6B] to-[#5A8A8A] sticky top-0">
              <img src="/images/logos/pawsync-logo-white.png" alt="PawSync" className="h-6 w-auto object-contain" />
              <button
                onClick={() => setSelectedCard(null)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Pet Info */}
            <div className="px-6 pt-5 pb-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pet&apos;s Name</p>
                <p className="text-2xl font-black text-[#1a1a1a] uppercase mb-3">{selectedCard.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Microchip No.</p>
                <p className="text-sm font-bold text-[#333]">{selectedCard.microchipNumber ?? selectedCard.nfcTagId ?? 'Not registered'}</p>
              </div>
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F0EF] shrink-0 border-2 border-[#C8DADA] flex items-center justify-center">
                {selectedCard.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedCard.photo} alt={selectedCard.name} className="w-full h-full object-cover" />
                ) : (
                  <PawIcon className="w-10 h-10 fill-[#7FA5A3]" />
                )}
              </div>
            </div>

            <div className="mx-6 border-t-2 border-dashed border-gray-200 mb-4" />

            {/* Pet Details */}
            <div className="px-6 pb-4 space-y-2">
              <DetailRow label="Species" value={`${selectedCard.species.charAt(0).toUpperCase()}${selectedCard.species.slice(1)}`} />
              <DetailRow label="Breed" value={selectedCard.breed} />
              <DetailRow label="Sex" value={selectedCard.sex.charAt(0).toUpperCase() + selectedCard.sex.slice(1)} />
              <DetailRow label="Date of Birth" value={formatFullDate(selectedCard.dateOfBirth)} />
              {selectedCard.weight && <DetailRow label="Weight" value={`${selectedCard.weight} kg`} />}
            </div>

            <div className="mx-6 border-t-2 border-dashed border-gray-200 mb-4" />

            {/* Vaccinations */}
            <div className="px-6 pb-6">
              <h3 className="text-sm font-bold text-[#4F4F4F] uppercase tracking-wide mb-3">Vaccination History</h3>
              {(petsData.find((p) => p.pet._id === selectedCard._id)?.vaccinations ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No vaccinations recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {petsData.find((p) => p.pet._id === selectedCard._id)?.vaccinations.map((vax) => {
                    const status = getPillStatus(vax)
                    const isNegative = status === 'expired' || status === 'overdue'
                    return (
                      <button
                        key={vax._id}
                        onClick={() => { setSelectedVax({ ...vax, petName: selectedCard.name }); setSelectedCard(null) }}
                        className="w-full flex items-center justify-between py-3 px-3 text-left hover:bg-[#F8F6F2] transition-colors rounded-xl border border-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {isNegative && <AlertCircle className="w-3.5 h-3.5 text-[#983232] shrink-0" />}
                          <div>
                            <p className="font-semibold text-[#1a1a1a] text-sm">{vax.vaccineName}</p>
                            <p className="text-xs text-gray-400">{vax.dateAdministered ? formatFullDate(vax.dateAdministered) : '—'}</p>
                          </div>
                        </div>
                        <VaccineStatusDetail vax={vax} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedCard(null)}
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
        highlight === 'red' ? 'text-[#983232]' : highlight === 'green' ? 'text-green-600' : 'text-[#1a1a1a]'
      }`}>
        {value}
      </p>
    </div>
  )
}
