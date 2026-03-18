'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, Loader, ShieldCheck, Syringe } from 'lucide-react'
import { getVaccinationsByPet, getStatusLabel, type Vaccination } from '@/lib/vaccinations'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PetInfo {
  name: string
  microchipNumber: string | null
  photo: string | null
  species?: string | null
}

interface Props {
  petId: string
  token: string
  /** If provided, the card will also highlight this record as newly saved/updated */
  highlightId?: string
  /** Key to force re-fetch (increment after save) */
  refreshKey?: number
  /** Keep card fixed while scrolling (default true for split-layout pages) */
  sticky?: boolean
  /** Enable click-to-open vaccine details modal like pet-owner vaccine card page */
  interactive?: boolean
}

function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getDoseLabel(vax: Vaccination): string {
  const vaccineType = typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId !== null ? vax.vaccineTypeId : null
  if (!vaccineType) {
    return vax.doseNumber > 1 ? `Dose #${vax.doseNumber}` : 'Initial Dose'
  }
  const effectiveSeries = vaccineType.isSeries ? vaccineType.totalSeries : 1
  if (vax.doseNumber <= effectiveSeries) {
    if (vaccineType.isSeries) return `Series ${vax.doseNumber}/${vaccineType.totalSeries}`
    return 'Initial Dose'
  }
  const boosterNum = vax.boosterNumber > 0 ? vax.boosterNumber : vax.doseNumber - effectiveSeries
  return `Booster #${boosterNum}`
}

function getAutoDoseMlBySpecies(species?: string | null): string | null {
  if (!species) return null
  const normalized = species.toLowerCase()
  if (normalized === 'canine' || normalized === 'dog') return '1.0 mL'
  if (normalized === 'feline' || normalized === 'cat') return '0.5 mL'
  return null
}

function getDoseMlLabel(vax: Vaccination, petSpecies?: string | null): string {
  if (vax.administeredDoseMl != null) return `${vax.administeredDoseMl} mL`
  const speciesFallback = getAutoDoseMlBySpecies(petSpecies)
  if (speciesFallback) return speciesFallback
  const vaccineType = typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId !== null ? vax.vaccineTypeId : null
  if (vaccineType?.doseVolumeMl != null) return `${vaccineType.doseVolumeMl} mL`
  return '—'
}

function isInSeriesPhase(vax: Vaccination): boolean {
  const vaccineType = typeof vax.vaccineTypeId === 'object' && vax.vaccineTypeId !== null ? vax.vaccineTypeId : null
  if (!vaccineType) return false
  const effectiveSeries = vaccineType.isSeries ? vaccineType.totalSeries : 1
  return vax.doseNumber < effectiveSeries
}

function getDoseDropdownLabel(v: Vaccination) {
  const dose = !v.doseNumber || v.doseNumber === 1 ? 'Initial' : `Booster ${v.doseNumber - 1}`
  const date = v.dateAdministered
    ? new Date(v.dateAdministered).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  return `${dose}${date ? ` — ${date}` : ''}`
}

function getDoseCountLabel(v: Vaccination): string {
  const dose = v.doseNumber ?? 1
  const vaccineType = v.vaccineTypeId
  if (typeof vaccineType === 'object' && vaccineType !== null) {
    if (vaccineType.isSeries) {
      if (dose <= vaccineType.totalSeries) return `Series ${dose}/${vaccineType.totalSeries}`
      return `Booster #${dose - vaccineType.totalSeries}`
    }
  }
  if (dose === 1) return 'Initial'
  return `Booster #${dose - 1}`
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

export default function VaccineCardPreview({ petId, token, refreshKey, sticky = true, interactive = false }: Props) {
  const [pet, setPet] = useState<PetInfo | null>(null)
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVaxGroup, setSelectedVaxGroup] = useState<Vaccination[] | null>(null)

  const openSheet = (vax: Vaccination) => {
    const group = vaccinations
      .filter((item) => item.vaccineName === vax.vaccineName)
      .sort((a, b) => new Date(b.dateAdministered ?? 0).getTime() - new Date(a.dateAdministered ?? 0).getTime())
    setSelectedVaxGroup(group)
  }

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
          setPet({
            name: p.name,
            microchipNumber: p.microchipNumber || null,
            photo: p.photo || null,
            species: p.species || null,
          })
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

  const maskBottom = `
    radial-gradient(circle 18px at 0px 100%, transparent 18px, black 18px),
    radial-gradient(circle 18px at 100% 100%, transparent 18px, black 18px)
  `

  const maskTop = `
    radial-gradient(circle 18px at 0px 0%, transparent 18px, black 18px),
    radial-gradient(circle 18px at 100% 0%, transparent 18px, black 18px)
  `

  if (interactive) {
    return (
      <div className={sticky ? 'sticky top-6' : ''} style={{ fontFamily: 'var(--font-outfit)' }}>
        <div
          className="relative w-full flex flex-col rounded-4xl border border-gray-200 shadow-2xl"
          style={{ maxWidth: 'min(500px, 100%)' }}
        >
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
            <div className="bg-[#476B6B] rounded-t-4xl flex items-center justify-between px-7 py-4">
              <img
                src="/images/logos/pawsync-logo-white.png"
                alt="PawSync"
                className="h-9 w-auto object-contain"
              />
              <span className="text-white text-lg tracking-wider font-normal">VACCINATION CARD</span>
            </div>

            <div className="px-7 pt-6 pb-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">PET&apos;S NAME</p>
                <p className="text-[22px] font-bold text-[#476B6B] uppercase leading-tight mb-5">{pet?.name ?? '—'}</p>
                <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">NFC TAG NO.</p>
                <p className="text-[18px] text-[#476B6B] font-normal">{pet?.microchipNumber ?? 'Not registered'}</p>
              </div>
              <div
                className="rounded-[19px] overflow-hidden bg-[#476B6B] shrink-0 flex items-center justify-center"
                style={{ width: 130, height: 120 }}
              >
                {pet?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-14 h-14 fill-white/60" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z" />
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5" />
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5" />
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2" />
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2" />
                  </svg>
                )}
              </div>
            </div>
          </div>

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
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-5 h-5 text-[#7FA5A3] animate-spin" />
              </div>
            ) : (
              <div>
                <div className="mx-6 mt-4 rounded-[19px] overflow-hidden bg-[#EFEFEF]">
                  <div className="divide-y divide-gray-200">
                    {vaccinations.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <p className="text-sm text-gray-400">No vaccinations recorded yet.</p>
                      </div>
                    ) : (
                      vaccinations.map((vax) => {
                        const isNegative = Boolean(vax.expiryDate && isExpired(vax.expiryDate)) || vax.status === 'overdue'
                        const dateToShow = vax.expiryDate ?? vax.nextDueDate ?? null

                        return (
                          <button
                            key={vax._id}
                            onClick={() => openSheet(vax)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 transition-colors text-left"
                          >
                            <p className="text-[18px] text-[#4F4F4F] font-normal">{vax.vaccineName}</p>
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
                                  <p className="text-[14px] text-[#4F4F4F]">{getStatusLabel(vax.status)}</p>
                                </div>
                              )}
                              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>

                  {latestVax && (
                    <div className="bg-white border-t border-[#C2C2C2] grid grid-cols-2 gap-4 px-5 py-4 rounded-b-[19px]">
                      <div>
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">ADMINISTERED</p>
                        <p className="text-[14px] text-[#4F4F4F] truncate">{getVetName(latestVax)}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">VETERINARY CLINIC</p>
                        <p className="text-[14px] text-[#4F4F4F] truncate">{getClinicName(latestVax)}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mx-6 my-5 flex items-center justify-center gap-2 bg-[#BAE0BD] rounded-full py-2.5 px-4">
                  <ShieldCheck className="w-4 h-4 text-[#35785C] shrink-0" />
                  <span className="text-[13px] text-[#35785C] font-normal">Vet Verified — Linked to Medical Records</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedVaxGroup && (
          <VaxDetailSheet
            vaccinations={selectedVaxGroup}
            petSpecies={pet?.species}
            onClose={() => setSelectedVaxGroup(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={sticky ? 'sticky top-6' : ''}>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vaccine Card Preview</p>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
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
                    <path d="M12 14.5c-2.5 0-4.5 1.5-4.5 3.5 0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2 0-2-2-3.5-4.5-3.5z" />
                    <ellipse cx="7.5" cy="10.5" rx="1.75" ry="2.5" />
                    <ellipse cx="16.5" cy="10.5" rx="1.75" ry="2.5" />
                    <ellipse cx="4.5" cy="14" rx="1.5" ry="2" />
                    <ellipse cx="19.5" cy="14" rx="1.5" ry="2" />
                  </svg>
                )}
              </div>
            </div>

            <div className="relative flex items-center h-5 mx-0">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-r-full z-10" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-l-full z-10" />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            {vaccinations.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p style={{ fontFamily: 'var(--font-outfit)' }} className="text-sm text-gray-400">No vaccination records on file yet.</p>
              </div>
            ) : (
              <div className="px-5 py-4">
                {vaccinations.map((vax, idx) => (
                  <div
                    key={vax._id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: idx !== vaccinations.length - 1 ? '1px solid #E5E7EB' : 'none' }}
                  >
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

            {vaccinations.length > 0 && <div className="mx-5 border-t border-gray-100" />}

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

            <div className="mx-5 mb-4 mt-3 flex items-center justify-center gap-2 bg-[#E8F5E9] border border-[#A5D6A7] rounded-xl py-2.5 px-4">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
              <span style={{ fontFamily: 'var(--font-outfit)' }} className="text-xs font-semibold text-[#2E7D32]">Vet Verified — Linked to Medical Records</span>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-2">Live preview · Updates after saving</p>
    </div>
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

function VaxDetailSheet({
  vaccinations,
  petSpecies,
  onClose,
}: {
  vaccinations: Vaccination[]
  petSpecies?: string | null
  onClose: () => void
}) {
  const [closing, setClosing] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 320)
  }

  const vax = vaccinations[selectedIdx]
  const vetName =
    typeof vax.vetId === 'object' && vax.vetId !== null
      ? `Dr. ${vax.vetId.firstName} ${vax.vetId.lastName}`
      : '—'
  const clinicName = typeof vax.clinicId === 'object' && vax.clinicId !== null ? vax.clinicId.name : '—'

  const rows = [
    { label: 'Vaccine name', value: vax.vaccineName || '—' },
    { label: 'Dose', value: getDoseMlLabel(vax, petSpecies) },
    { label: 'Brand name', value: vax.manufacturer || '—' },
    { label: 'Date administered', value: vax.dateAdministered ? formatFullDate(vax.dateAdministered) : '—' },
    { label: 'Batch / lot number', value: vax.batchNumber || '—' },
    { label: 'Veterinary clinic', value: clinicName },
    { label: 'Veterinarian', value: vetName },
    { label: 'Booster count', value: getDoseCountLabel(vax) },
    { label: 'Protection status', value: vax.expiryDate && isExpired(vax.expiryDate) ? 'Expired' : getStatusLabel(vax.status) },
    ...(vax.expiryDate ? [{ label: 'Valid until', value: formatFullDate(vax.expiryDate) }] : []),
    ...(vax.nextDueDate ? [{ label: isInSeriesPhase(vax) ? 'Next series dose' : 'Booster due', value: formatFullDate(vax.nextDueDate) }] : []),
  ]

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40" />

      <div
        className={`relative w-full ${closing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ maxWidth: 'min(500px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10 w-12 h-12 bg-[#476B6B] rounded-full flex items-center justify-center shadow-lg">
          <Syringe className="w-6 h-6 text-white" />
        </div>

        <div className="bg-white rounded-t-3xl overflow-y-auto max-h-[85vh] [&::-webkit-scrollbar]:hidden pt-10 pb-8 px-6">
          <div className="bg-[#F3F3F3] rounded-2xl px-4 py-3 text-center mb-4">
            <p className="text-[17px] font-bold text-[#333]">{vax.vaccineName} Details</p>
          </div>

          {vaccinations.length > 1 && (
            <div className="mb-4">
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">Select dose</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full bg-[#F3F3F3] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#333] focus:outline-none focus:ring-2 focus:ring-[#476B6B] pr-8 relative text-left"
                  >
                    {getDoseDropdownLabel(vaccinations[selectedIdx])}{selectedIdx === 0 ? ' (Most recent)' : ''}
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 text-gray-400 pointer-events-none" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) max-h-56 overflow-y-auto rounded-xl">
                  <DropdownMenuRadioGroup value={String(selectedIdx)} onValueChange={(value) => setSelectedIdx(Number(value))}>
                    {vaccinations.map((item, i) => (
                      <DropdownMenuRadioItem key={item._id} value={String(i)}>
                        {getDoseDropdownLabel(item)}{i === 0 ? ' (Most recent)' : ''}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div className="border-t-2 border-dashed border-gray-200 mb-5" />

          <div className="space-y-3.5">
            {rows.map(({ label, value }) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </div>

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
