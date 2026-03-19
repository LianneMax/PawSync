'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { getVaccinationsByPet, type Vaccination } from '@/lib/medicalRecords'
import { ShieldCheck, X, PawPrint, XCircle, BadgeCheck, Clock, Syringe, ChevronRight } from 'lucide-react'

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getAutoDoseMlBySpecies(species?: string | null): string | null {
  if (!species) return null
  const normalized = species.toLowerCase()
  if (normalized === 'canine' || normalized === 'dog') return '1.0 mL'
  if (normalized === 'feline' || normalized === 'cat') return '0.5 mL'
  return null
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function getPillStatus(vax: Vaccination): 'active' | 'expired' | 'overdue' | 'pending' {
  if (vax.status === 'overdue' || vax.status === 'expired') return 'overdue'
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
  const displayVaccinations = vaccinations.filter(
    (item, index, arr) => arr.findIndex((v) => v.vaccineName === item.vaccineName) === index
  )

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
          {displayVaccinations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No vaccinations recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: 80 }}>
              {displayVaccinations.map((vax) => {
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

// ── Vaccine Detail Bottom Sheet ───────────────────────────────────────────────

function VaxDetailSheet({ vaccinations, petSpecies, onClose }: { vaccinations: Vaccination[]; petSpecies?: string | null; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  // Oldest → latest for arrow navigation
  const orderedVaccinations = [...vaccinations].sort(
    (a, b) => new Date(a.dateAdministered ?? 0).getTime() - new Date(b.dateAdministered ?? 0).getTime()
  )
  const [selectedIdx, setSelectedIdx] = useState(0)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 320)
  }

  const vax = orderedVaccinations[selectedIdx]
  const vet = vax.vetId
  const vetName = vet ? `Dr. ${vet.firstName} ${vet.lastName}` : '—'
  const clinicName = vax.clinicId?.name ?? '—'
  const prcLicense = vet?.prcLicenseNumber ?? vet?.licenseNumber ?? null
  const totalDoses = orderedVaccinations.length

  const vt = vax.vaccineTypeId
  const totalSeries = vt?.totalSeries ?? 1
  const isSeries = Boolean(vt?.isSeries && totalSeries > 1)
  const currentDoseNumber = vax.doseNumber ?? 1
  const currentSeriesDose = Math.min(currentDoseNumber, totalSeries)
  const seriesProgressPct = Math.round((currentSeriesDose / totalSeries) * 100)
  const showSeriesProgress = isSeries && currentDoseNumber <= totalSeries

  const doseLabel = (v: Vaccination) => {
    const doseNumber = v.doseNumber ?? 1
    const vType = v.vaccineTypeId
    const vTotalSeries = vType?.totalSeries ?? 1
    const vIsSeries = Boolean(vType?.isSeries && vTotalSeries > 1)

    let label = 'Initial'
    if (vIsSeries) {
      label = doseNumber <= vTotalSeries ? `Series ${doseNumber}/${vTotalSeries}` : `Booster #${doseNumber - vTotalSeries}`
    } else if (doseNumber > 1) {
      label = `Booster ${doseNumber - 1}`
    }

    const date = v.dateAdministered
      ? new Date(v.dateAdministered).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : ''
    return `${label}${date ? ` — ${date}` : ''}`
  }

  const doseCountLabel = (v: Vaccination): string => {
    const dose = v.doseNumber ?? 1
    const vt = v.vaccineTypeId
    const isSeries = vt?.isSeries
    const totalSeries = vt?.totalSeries ?? 1
    if (isSeries) {
      if (dose <= totalSeries) return `Series ${dose}/${totalSeries}`
      return `Booster #${dose - totalSeries}`
    }
    if (dose === 1) return 'Initial'
    return `Booster #${dose - 1}`
  }

  const rows = [
    { label: 'Brand name', value: vax.manufacturer || '—' },
    { label: 'Dose', value: vax.administeredDoseMl != null ? `${vax.administeredDoseMl} mL` : getAutoDoseMlBySpecies(petSpecies) ?? (vax.vaccineTypeId?.doseVolumeMl != null ? `${vax.vaccineTypeId.doseVolumeMl} mL` : '—') },
    { label: 'Date administered', value: vax.dateAdministered ? formatFullDate(vax.dateAdministered) : '—' },
    { label: 'Batch / lot number', value: vax.batchNumber || '—' },
    { label: 'Veterinary clinic', value: clinicName },
    { label: 'Veterinarian', value: vetName },
    { label: 'Booster count', value: doseCountLabel(vax) },
    ...(prcLicense ? [{ label: 'Professional license no.', value: prcLicense }] : []),
  ]

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center"
      style={{ fontFamily: 'var(--font-outfit)' }}
      onClick={handleClose}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet wrapper */}
      <div
        className={`relative w-full ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxWidth: 'min(500px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Syringe icon floats above the sheet */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10 w-12 h-12 bg-[#476B6B] rounded-full flex items-center justify-center shadow-lg">
          <Syringe className="w-6 h-6 text-white" />
        </div>

        {/* White sheet */}
        <div className="bg-white rounded-t-3xl overflow-y-auto max-h-[85vh] [&::-webkit-scrollbar]:hidden pt-10 pb-8 px-6">
          {/* Title */}
          <div className="bg-[#F3F3F3] rounded-2xl px-4 py-3 text-center mb-4">
            <p className="text-[17px] font-bold text-[#333]">{vax.vaccineName} Details</p>
          </div>

          {/* Dose navigation — oldest to latest */}
          {totalDoses > 1 && (
            <div className="mb-4">
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">Dose timeline</label>
              <div className="bg-[#F3F3F3] rounded-xl px-3 py-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIdx((prev) => Math.max(0, prev - 1))}
                  disabled={selectedIdx === 0}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous dose"
                >
                  <ChevronRight className="w-4 h-4 text-[#4F4F4F] rotate-180" />
                </button>

                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold text-[#333]">{doseLabel(vax)}</p>
                  <p className="text-[11px] text-gray-500">Dose {selectedIdx + 1} of {totalDoses} · Oldest to latest</p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIdx((prev) => Math.min(totalDoses - 1, prev + 1))}
                  disabled={selectedIdx === totalDoses - 1}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next dose"
                >
                  <ChevronRight className="w-4 h-4 text-[#4F4F4F]" />
                </button>
              </div>
            </div>
          )}

          {/* Series status bar */}
          {showSeriesProgress && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Series status</p>
                <p className="text-xs font-semibold text-[#4F4F4F]">{currentSeriesDose}/{totalSeries}</p>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#476B6B] rounded-full transition-all" style={{ width: `${seriesProgressPct}%` }} />
              </div>
            </div>
          )}

          {/* Dashed divider */}
          <div className="border-t-2 border-dashed border-gray-200 mb-5" />

          {/* Rows */}
          <div className="space-y-3.5">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[14px] text-gray-400 shrink-0">{label}</span>
                <span className="text-[14px] font-semibold text-[#333] text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            className="mt-6 w-full py-3 bg-[#476B6B] text-white rounded-2xl text-sm font-semibold hover:bg-[#3a5858] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Open Card Modal ───────────────────────────────────────────────────────────

function OpenCardModal({ petData, onClose }: { petData: PetWithVax; onClose: () => void }) {
  const { pet, vaccinations } = petData
  const [selectedVaxGroup, setSelectedVaxGroup] = useState<Vaccination[] | null>(null)
  const cardVaccinations = vaccinations.filter(
    (item, index, arr) => arr.findIndex((v) => v.vaccineName === item.vaccineName) === index
  )

  const openSheet = (vax: Vaccination) => {
    const group = vaccinations
      .filter((v) => v.vaccineName === vax.vaccineName)
      .sort((a, b) => new Date(a.dateAdministered ?? 0).getTime() - new Date(b.dateAdministered ?? 0).getTime())
    setSelectedVaxGroup(group)
  }

  // Mask that cuts quarter-circles from the bottom corners of the top section
  const maskBottom = `
    radial-gradient(circle 18px at 0px 100%, transparent 18px, black 18px),
    radial-gradient(circle 18px at 100% 100%, transparent 18px, black 18px)
  `
  // Mask that cuts quarter-circles from the top corners of the bottom section
  const maskTop = `
    radial-gradient(circle 18px at 0px 0%, transparent 18px, black 18px),
    radial-gradient(circle 18px at 100% 0%, transparent 18px, black 18px)
  `

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full flex flex-col"
        style={{ maxWidth: 'min(500px, 100%)', maxHeight: '90vh', fontFamily: 'var(--font-outfit)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP SECTION — header + pet info, mask cuts bottom corners ── */}
        <div
          className="bg-white rounded-t-4xl shrink-0"
          style={{
            borderBottom: '2px dashed #d1d5db',
            maskImage: maskBottom,
            maskComposite: 'intersect',
            WebkitMaskImage: maskBottom,
            WebkitMaskComposite: 'destination-in',
          }}
        >
          {/* Header */}
          <div className="bg-[#476B6B] rounded-t-4xl flex items-center justify-between px-7 py-4">
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

          {/* Pet Info */}
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
        </div>

        {/* ── BOTTOM SECTION — vaccines + pill, mask cuts top corners ── */}
        <div
          className="bg-white rounded-b-4xl overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: 'none',
            maskImage: maskTop,
            maskComposite: 'intersect',
            WebkitMaskImage: maskTop,
            WebkitMaskComposite: 'destination-in',
          }}
        >
          <div>
            {/* Vaccine section */}
            <div className="mx-6 mt-4 rounded-[19px] overflow-hidden bg-[#EFEFEF]">
              <div className="divide-y divide-gray-200">
                {cardVaccinations.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-gray-400">No vaccinations recorded yet.</p>
                  </div>
                ) : (
                  cardVaccinations.map((vax) => {
                    const status = getPillStatus(vax)
                    const isNegative = status === 'expired' || status === 'overdue'
                    const dateToShow = vax.expiryDate ?? vax.nextDueDate ?? null

                    return (
                      <button
                        key={vax._id}
                        onClick={() => openSheet(vax)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 transition-colors text-left"
                      >
                        <p className="text-[18px] text-[#4F4F4F] font-normal">
                          {vax.vaccineName}
                        </p>
                        <div className="flex items-center gap-2">
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
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* White footer strip */}
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

            {/* Vet Verified pill */}
            <div className="mx-6 my-5 flex items-center justify-center gap-2 bg-[#BAE0BD] rounded-full py-2.5 px-4">
              <ShieldCheck className="w-4 h-4 text-[#35785C] shrink-0" />
              <span className="text-[13px] text-[#35785C] font-normal">
                Vet Verified — Linked to Medical Records
              </span>
            </div>
          </div>
        </div>
      </div>

      {selectedVaxGroup && (
        <VaxDetailSheet vaccinations={selectedVaxGroup} petSpecies={pet.species} onClose={() => setSelectedVaxGroup(null)} />
      )}
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
              vaccinations: vaxRes.data?.vaccinations ?? [],
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
