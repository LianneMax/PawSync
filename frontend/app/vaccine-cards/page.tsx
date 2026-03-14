'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { getVaccinationsByPet, type Vaccination } from '@/lib/medicalRecords'
import { ShieldCheck, X, PawPrint, XCircle, BadgeCheck, Clock } from 'lucide-react'

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function getPillStatus(vax: Vaccination): 'active' | 'expired' | 'overdue' | 'pending' | 'declined' {
  if (vax.status === 'declined') return 'declined'
  if (vax.status === 'overdue') return 'overdue'
  if (vax.status === 'pending') return 'pending'
  if (vax.expiryDate && isPast(vax.expiryDate)) return 'expired'
  return 'active'
}

const PawIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z" />
    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5" />
    <ellipse cx="4.5" cy="14" rx="1.5" ry="2" />
    <ellipse cx="19.5" cy="14" rx="1.5" ry="2" />
  </svg>
)

interface PetWithVax {
  pet: Pet
  vaccinations: Vaccination[]
}

// ── Closed Card ───────────────────────────────────────────────────────────────

function ClosedCard({ pet, vaccinations, onClick }: { pet: Pet; vaccinations: Vaccination[]; onClick: () => void }) {
  const latestVax = vaccinations[0]

  return (
    <div
      className="cursor-pointer select-none"
      style={{ fontFamily: 'var(--font-outfit)' }}
      onClick={onClick}
    >
      {/* Fixed-height card — all cards same size */}
      <div
        className="bg-white rounded-3xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow flex flex-col"
        style={{ height: 360 }}
      >
        {/* Header */}
        <div className="rounded-t-3xl bg-[#476B6B] px-5 py-3 flex items-center justify-between shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/pawsync-logo-white.png"
            alt="PawSync"
            className="h-8 w-auto object-contain"
          />
          <span style={{ color: 'white', fontSize: 14, fontFamily: 'var(--font-outfit)', fontWeight: '400', letterSpacing: '0.1em' }}>
            VACCINATION CARD
          </span>
        </div>

        {/* Pet Info */}
        <div className="px-5 pt-4 pb-2 flex items-start gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 font-medium">
              Pet&apos;s Name
            </p>
            <p className="text-sm font-bold text-[#476B6B] uppercase truncate leading-tight tracking-wide mb-3">
              {pet.name}
            </p>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 font-medium">
              NFC Tag No.
            </p>
            <p className="text-xs font-semibold text-[#476B6B]">
              {pet.nfcTagId ?? pet.microchipNumber ?? 'Not registered'}
            </p>
          </div>
          <div className="w-22.5 h-22.5 rounded-xl overflow-hidden bg-[#476B6B] shrink-0 flex items-center justify-center">
            {pet.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              <PawIcon className="w-8 h-8 text-white/60" />
            )}
          </div>
        </div>

        {/* Ticket-punch divider */}
        <div className="flex items-center h-5 mx-0 shrink-0">
          <div className="w-full border-t-2 border-dashed border-gray-200" />
        </div>

        {/* Vaccine pills + vet footer — grows to fill */}
        <div className="px-5 pt-3 flex flex-col flex-1 overflow-hidden">
          {/* Vaccine status pills */}
          {vaccinations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No vaccinations recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: 80 }}>
              {vaccinations.map((vax) => {
                const status = getPillStatus(vax)
                const isNegative = status === 'expired' || status === 'overdue'
                const isPending = status === 'pending'
                return (
                  <span
                    key={vax._id}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full leading-none ${
                      isNegative
                        ? 'bg-red-100 text-red-800'
                        : isPending
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {isNegative ? (
                      <XCircle className="w-3 h-3 shrink-0" />
                    ) : isPending ? (
                      <Clock className="w-3 h-3 shrink-0" />
                    ) : (
                      <BadgeCheck className="w-3 h-3 shrink-0" />
                    )}
                    {vax.vaccineName}
                  </span>
                )
              })}
            </div>
          )}

          {/* Vet + clinic info */}
          {latestVax && (
            <div className="grid grid-cols-2 gap-2 mt-auto pb-1">
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5 font-medium">
                  Administered
                </p>
                <p className="text-xs font-semibold text-[#333] truncate">
                  {latestVax.vetId ? `Dr. ${latestVax.vetId.firstName} ${latestVax.vetId.lastName}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-0.5 font-medium">
                  Vet Clinic
                </p>
                <p className="text-xs font-semibold text-[#333] truncate">
                  {latestVax.clinicId?.name ?? '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Verified badge */}
        <div className="mx-5 mb-4 mt-3 flex items-center justify-center gap-2 bg-[#BAE0BD] rounded-full py-2 px-4 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#35785C] shrink-0" />
          <span className="text-[10px] font-semibold text-[#35785C]">
            Vet Verified — Linked to Medical Records
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Open Card Modal ───────────────────────────────────────────────────────────

function OpenCardModal({ petData, onClose }: { petData: PetWithVax; onClose: () => void }) {
  const { pet, vaccinations } = petData

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* Card container — close to 502:669 Figma ratio */}
      <div
        className="relative bg-white rounded-[20px] shadow-2xl w-full overflow-hidden"
        style={{ maxWidth: 500, fontFamily: 'var(--font-outfit)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-[#476B6B] flex items-center justify-between px-7 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/pawsync-logo-white.png"
            alt="PawSync"
            className="h-9 w-auto object-contain"
          />
          <span className="text-white text-lg tracking-wider font-normal">VACCINATION CARD</span>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Pet Info ── */}
        <div className="px-7 pt-6 pb-5 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">
              PET&apos;S NAME
            </p>
            <p className="text-[22px] font-bold text-[#476B6B] uppercase leading-tight mb-5">
              {pet.name}
            </p>
            <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">
              NFC TAG NO.
            </p>
            <p className="text-[18px] text-[#476B6B] font-normal">
              {pet.nfcTagId ?? pet.microchipNumber ?? 'Not registered'}
            </p>
          </div>
          {/* Pet photo — teal box top-right */}
          <div
            className="rounded-[19px] overflow-hidden bg-[#476B6B] shrink-0 flex items-center justify-center"
            style={{ width: 130, height: 120 }}
          >
            {pet.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
            ) : (
              <PawIcon className="w-14 h-14 text-white/60" />
            )}
          </div>
        </div>

        {/* ── Ticket-punch divider ── */}
        <div className="relative flex items-center h-8">
          {/* Left half-circle punch — flat side at card edge, curve points inward */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
            style={{
              width: 18,
              height: 36,
              background: 'rgba(0,0,0,0.6)',
              borderTopRightRadius: 36,
              borderBottomRightRadius: 36,
            }}
          />
          {/* Right half-circle punch — flat side at card edge, curve points inward */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
            style={{
              width: 18,
              height: 36,
              background: 'rgba(0,0,0,0.6)',
              borderTopLeftRadius: 36,
              borderBottomLeftRadius: 36,
            }}
          />
          <div className="w-full border-t-2 border-dashed border-gray-300 mx-5" />
        </div>

        {/* ── Vaccine section (gray) ── */}
        <div className="mx-6 mt-4 rounded-[19px] overflow-hidden bg-[#EFEFEF]">
          {/* Vaccine rows */}
          <div className="divide-y divide-gray-200">
            {vaccinations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No vaccinations recorded yet.</p>
              </div>
            ) : (
              vaccinations.map((vax) => {
                const status = getPillStatus(vax)
                const isNegative = status === 'expired' || status === 'overdue'
                const dateToShow = vax.expiryDate ?? vax.nextDueDate ?? null

                return (
                  <div key={vax._id} className="flex items-center justify-between px-5 py-4">
                    <p className="text-[18px] text-[#4F4F4F] font-normal">
                      {vax.vaccineName}
                    </p>
                    {dateToShow ? (
                      <div className="text-right">
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-0.5">
                          {isNegative ? 'EXPIRED' : 'VALID UNTIL'}
                        </p>
                        <p className={`text-[14px] font-normal ${isNegative ? 'text-[#983232]' : 'text-[#4F4F4F]'}`}>
                          {formatMonthYear(dateToShow)}
                        </p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-0.5">STATUS</p>
                        <p className="text-[14px] text-[#4F4F4F]">{vax.status}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* ── White footer strip inside gray box ── */}
          {vaccinations.length > 0 && vaccinations[0].vetId && (
            <div className="bg-white border-t border-[#C2C2C2] grid grid-cols-2 gap-4 px-5 py-4 rounded-b-[19px]">
              <div>
                <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">ADMINISTERED</p>
                <p className="text-[14px] text-[#4F4F4F] truncate">
                  {`Dr. ${vaccinations[0].vetId.firstName} ${vaccinations[0].vetId.lastName}`}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">VETERINARY CLINIC</p>
                <p className="text-[14px] text-[#4F4F4F] truncate">
                  {vaccinations[0].clinicId?.name ?? '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Vet Verified pill ── */}
        <div className="mx-6 my-5 flex items-center justify-center gap-2 bg-[#BAE0BD] rounded-full py-2.5 px-4">
          <ShieldCheck className="w-4 h-4 text-[#35785C] shrink-0" />
          <span className="text-[13px] text-[#35785C] font-normal">
            Vet Verified — Linked to Medical Records
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VaccineCardsPage() {
  const { token } = useAuthStore()
  const [petsData, setPetsData] = useState<PetWithVax[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<PetWithVax | null>(null)

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
            return {
              pet,
              vaccinations: (vaxRes.data?.vaccinations ?? []).filter(
                (v: Vaccination) => v.status !== 'declined'
              ),
            }
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl shadow-xl animate-pulse border border-gray-100" style={{ height: 360 }} />
            ))}
          </div>
        ) : petsData.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm text-center border-2 border-dashed border-gray-200">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#4F4F4F] mb-2">No pets found</h2>
            <p className="text-gray-500">Add a pet to see their vaccine card here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {petsData.map((petData) => (
              <ClosedCard
                key={petData.pet._id}
                pet={petData.pet}
                vaccinations={petData.vaccinations}
                onClick={() => setSelectedCard(petData)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedCard && (
        <OpenCardModal
          petData={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </DashboardLayout>
  )
}
