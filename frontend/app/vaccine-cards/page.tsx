'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { getVaccinationsByPet, type Vaccination } from '@/lib/medicalRecords'
import { CheckCircle2, XCircle, ShieldCheck, X, PawPrint, Printer } from 'lucide-react'

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function VaccineStatus({ expiryDate, nextDueDate, status }: {
  expiryDate: string | null
  nextDueDate: string | null
  status: string
}) {
  // Prefer nextDueDate (booster), then expiryDate
  const displayDate = nextDueDate ?? expiryDate
  const label = nextDueDate ? 'Valid Until' : expiryDate ? 'Expires' : null

  if (!displayDate || !label) {
    // No date info — show the backend status
    const statusMap: Record<string, { text: string; color: string }> = {
      active: { text: 'Active', color: 'text-green-600' },
      expired: { text: 'Expired', color: 'text-red-500' },
      overdue: { text: 'Overdue', color: 'text-orange-500' },
      pending: { text: 'Pending', color: 'text-blue-500' },
      declined: { text: 'Declined', color: 'text-gray-400' },
    }
    const cfg = statusMap[status] ?? { text: 'Unknown', color: 'text-gray-400' }
    return (
      <div className="text-right">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Status</p>
        <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.text}</p>
      </div>
    )
  }

  const past = isPast(displayDate)
  return (
    <div className="text-right">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
        {past ? 'Expired' : label}
      </p>
      <div className="flex items-center gap-1 justify-end">
        <p className={`text-sm font-bold ${past ? 'text-red-500' : 'text-green-600'}`}>
          {formatMonthYear(displayDate)}
        </p>
        {past ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
      </div>
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
            return { pet, vaccinations: vaxRes.data?.vaccinations ?? [] }
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
              <div key={i} className="bg-white rounded-3xl shadow-xl h-80 animate-pulse border border-gray-100" />
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
              return (
                <div key={pet._id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

                  {/* Card Header */}
                  <div className="px-6 py-4 flex items-center justify-between bg-linear-to-r from-[#476B6B] to-[#5A8A8A]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                        <PawIcon className="w-5 h-5 fill-white" />
                      </div>
                      <span className="text-white font-black text-lg tracking-wide">PawSync</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/90 font-bold text-sm tracking-wider uppercase">
                        Vaccination Card
                      </span>
                      <button
                        onClick={() => window.print()}
                        title="Print vaccine card"
                        className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors print:hidden"
                      >
                        <Printer className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* Pet Info */}
                  <div className="px-6 pt-5 pb-4 flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pet&apos;s Name</p>
                      <p className="text-2xl font-black text-[#1a1a1a] uppercase mb-3">{pet.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Microchip No.</p>
                      <p className="text-sm font-bold text-[#333]">{pet.microchipNumber ?? '—'}</p>
                    </div>
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F0EF] shrink-0 border-2 border-[#C8DADA] flex items-center justify-center">
                      {pet.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        <PawIcon className="w-10 h-10 fill-[#7FA5A3]" />
                      )}
                    </div>
                  </div>

                  {/* Dashed divider */}
                  <div className="mx-6 border-t-2 border-dashed border-gray-200 mb-1" />

                  {/* Vaccine list */}
                  <div className="px-6 py-2">
                    {vaccinations.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No vaccinations recorded yet.</p>
                    ) : (
                      vaccinations.map((vax, idx) => (
                        <button
                          key={vax._id}
                          onClick={() => setSelectedVax({ ...vax, petName: pet.name })}
                          className={`w-full flex items-center justify-between py-3.5 text-left hover:bg-[#F8F6F2] transition-colors rounded-lg px-2 -mx-2 ${
                            idx < vaccinations.length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                        >
                          <p className="font-semibold text-[#1a1a1a] text-sm">{vax.vaccineName}</p>
                          <VaccineStatus expiryDate={vax.expiryDate} nextDueDate={vax.nextDueDate} status={vax.status} />
                        </button>
                      ))
                    )}
                  </div>

                  {/* Administered / Clinic footer */}
                  {latestVax && (
                    <div className="mx-6 mt-2 mb-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Administered</p>
                        <p className="text-xs font-semibold text-[#333]">
                          {latestVax.vetId
                            ? `Dr. ${latestVax.vetId.firstName} ${latestVax.vetId.lastName}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Veterinary Clinic</p>
                        <p className="text-xs font-semibold text-[#333]">{latestVax.clinicId?.name ?? '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* Bottom accent strip */}
                  <div className="h-2 w-full bg-linear-to-r from-[#476B6B] to-[#5A8A8A]" />
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
              <DetailRow label="Date administered" value={formatFullDate(selectedVax.dateAdministered)} />
              {selectedVax.nextDueDate && (
                <DetailRow
                  label={isExpired(selectedVax.nextDueDate) ? 'Expired' : 'Valid until'}
                  value={formatFullDate(selectedVax.nextDueDate)}
                  highlight={isExpired(selectedVax.nextDueDate) ? 'red' : 'green'}
                />
              )}
              {selectedVax.vetId && (
                <DetailRow
                  label="Veterinarian"
                  value={`Dr. ${selectedVax.vetId.firstName} ${selectedVax.vetId.lastName}`}
                />
              )}
              {selectedVax.clinicId && (
                <DetailRow label="Veterinary clinic" value={selectedVax.clinicId.name} />
              )}
              {selectedVax.clinicBranchId && typeof selectedVax.clinicBranchId === 'object' && (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <DetailRow label="Branch" value={(selectedVax.clinicBranchId as any).name} />
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
