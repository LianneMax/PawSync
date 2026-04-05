'use client'

import { useState, useEffect, use } from 'react'
import { useAuthStore } from '@/store/authStore'
import Image from 'next/image'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import {
  ArrowLeft, Mail, Phone, PawPrint, Calendar, Syringe,
  AlertCircle, Clock, CheckCircle, Send, User, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getSinglePetOwner,
  sendOwnerNote,
  getClinicVets,
  type SingleOwnerResponse,
  type OwnerPetSummary,
  type OwnerInviteStatus,
} from '@/lib/clinics'

interface ClinicVet {
  _id: string        // assignment ID
  vetId: string      // vet user ID
  name: string       // pre-formatted "Dr. First Last"
  email: string
  status: string
}

// ==================== HELPERS ====================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  return `${y} year${y > 1 ? 's' : ''}`
}

// ==================== STATUS BADGE ====================

const STATUS_CONFIG: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   classes: '', icon: <Clock className="w-3 h-3" /> },
  invited:   { label: 'Pending',   classes: '', icon: <Clock className="w-3 h-3" /> },
  resent:    { label: 'Pending',   classes: '', icon: <Clock className="w-3 h-3" /> },
  expired:   { label: 'Expired',   classes: 'bg-red-50 text-red-700 border border-red-200',     icon: <AlertCircle className="w-3 h-3" /> },
  activated: { label: 'Activated', classes: '', icon: <CheckCircle className="w-3 h-3" /> },
}

function StatusBadge({ status }: { status: OwnerInviteStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const isActivated = status === 'activated'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.classes}`}
      style={isActivated ? { backgroundColor: '#D5F4D2', color: '#35785C' } : ['pending', 'invited', 'resent'].includes(status) ? { backgroundColor: '#C5D8FF', color: '#4569B1' } : undefined}
    >
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ==================== PET CARD ====================

function PetCard({ pet }: { pet: OwnerPetSummary }) {
  const hasDueVaccines = pet.dueVaccinations.length > 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Pet header */}
      <div className="flex items-center gap-4 p-5 border-b border-gray-100">
        {pet.photo ? (
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-[#7FA5A3]/30">
            <Image
              src={pet.photo}
              alt={pet.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center shrink-0">
            <PawPrint className="w-7 h-7 text-[#4A8A87]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[#4F4F4F]">{pet.name}</h3>
          <p className="text-sm text-gray-500 capitalize">{pet.species} · {pet.breed}</p>
        </div>
        {hasDueVaccines && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold shrink-0">
            <Syringe className="w-3 h-3" />
            Vaccine Due
          </span>
        )}
      </div>

      {/* Pet details grid */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Sex</p>
          <p className="text-sm font-medium text-[#4F4F4F] capitalize">{pet.sex}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Age</p>
          <p className="text-sm font-medium text-[#4F4F4F]">{calculateAge(pet.dateOfBirth)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Weight</p>
          <p className="text-sm font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Last Visit</p>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#7FA5A3]" />
            <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(pet.lastVisit)}</p>
          </div>
        </div>
      </div>

      {/* Due vaccinations */}
      {hasDueVaccines && (
        <div className="px-5 pb-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Syringe className="w-3.5 h-3.5" /> Due / Overdue Vaccinations
          </p>
          <div className="space-y-2">
            {pet.dueVaccinations.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-[#4F4F4F]">{v.vaccineName}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {v.status === 'overdue' && (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Overdue</span>
                  )}
                  <span className="text-xs text-gray-500">{formatDate(v.nextDueDate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== SEND NOTE PANEL ====================

function SendNotePanel({ ownerId, token }: { ownerId: string; token: string | null }) {
  const [note, setNote] = useState('')
  const [selectedVetId, setSelectedVetId] = useState<string>('') // '' = clinic name
  const [vets, setVets] = useState<ClinicVet[]>([])
  const [loadingVets, setLoadingVets] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!token) return
    getClinicVets(token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.vets) {
          // Only show active vets in the dropdown
          setVets((res.data.vets as unknown as ClinicVet[]).filter((v) => v.status === 'Active'))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVets(false))
  }, [token])

  const selectedVet = vets.find((v) => v._id === selectedVetId) ?? null
  const senderLabel = selectedVet ? selectedVet.name : 'Clinic'

  const handleSend = async () => {
    if (!note.trim()) { toast.error('Please enter a note message.'); return }
    if (!token) { toast.error('Not authenticated.'); return }
    setSending(true)
    try {
      const vetName = selectedVet?.name ?? undefined
      const res = await sendOwnerNote(ownerId, { note: note.trim(), vetName }, token)
      if (res.status === 'SUCCESS') {
        toast.success('Note sent to the owner via email.')
        setNote('')
        setSelectedVetId('')
      } else {
        toast.error(res.message || 'Failed to send note.')
      }
    } catch {
      toast.error('An error occurred. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Send Follow-Up Note</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        This sends an email directly to the owner with your note. The email includes a button for them to book an appointment.
      </p>
      <div className="space-y-3">
        {/* Vet dropdown */}
        <div className="relative">
          <label className="block text-xs font-medium text-[#4F4F4F] mb-1">
            Sending as
          </label>
          <button
            type="button"
            disabled={loadingVets}
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] disabled:opacity-60"
          >
            <span className="text-[#4F4F4F]">
              {loadingVets ? 'Loading vets…' : senderLabel}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          </button>

          {dropdownOpen && !loadingVets && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              <button
                type="button"
                onClick={() => { setSelectedVetId(''); setDropdownOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedVetId === ''
                    ? 'bg-[#7FA5A3]/10 text-[#476B6B] font-medium'
                    : 'text-[#4F4F4F] hover:bg-gray-50'
                }`}
              >
                Clinic
              </button>
              {vets.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">No active vets assigned.</p>
              ) : (
                vets.map((vet) => (
                  <button
                    key={vet._id}
                    type="button"
                    onClick={() => { setSelectedVetId(vet._id); setDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedVetId === vet._id
                        ? 'bg-[#7FA5A3]/10 text-[#476B6B] font-medium'
                        : 'text-[#4F4F4F] hover:bg-gray-50'
                    }`}
                  >
                    {vet.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Note textarea */}
        <div>
          <label className="block text-xs font-medium text-[#4F4F4F] mb-1">
            Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Hi! We noticed your pet's rabies vaccination is overdue. Please schedule an appointment at your earliest convenience."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !note.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#476B6B] hover:bg-[#3d5c5c] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {sending
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending…</>
            : <><Send className="w-4 h-4" />Send Note via Email</>}
        </button>
      </div>
    </div>
  )
}

// ==================== MAIN PAGE ====================

export default function OwnerProfilePage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params)
  const token = useAuthStore((state) => state.token)

  const [data, setData] = useState<SingleOwnerResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !ownerId) return
    setLoading(true)
    getSinglePetOwner(ownerId, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data) {
          setData(res.data)
        } else {
          toast.error(res.message || 'Failed to load owner profile.')
        }
      })
      .catch(() => toast.error('Failed to load owner profile.'))
      .finally(() => setLoading(false))
  }, [ownerId, token])

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Back */}
        <Link
          href="/clinic-admin/clients"
          className="inline-flex items-center gap-2 text-sm text-[#476B6B] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
          </div>
        ) : !data ? (
          <div className="text-center py-24 text-gray-400">Owner not found.</div>
        ) : (
          <div className="space-y-8">
            {/* Owner Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="relative bg-linear-to-r from-[#476B6B] to-[#7FA5A3] px-8 py-6">
                <div className="absolute top-4 right-6">
                  <StatusBadge status={data.owner.inviteStatus as OwnerInviteStatus} />
                </div>
                <div className="flex items-center gap-5">
                  {data.owner.photo ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-3 border-white/30">
                      <Image
                        src={data.owner.photo}
                        alt={`${data.owner.firstName} ${data.owner.lastName}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <User className="w-10 h-10 text-white/80" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-white">
                      {data.owner.firstName} {data.owner.lastName}
                    </h1>
                    <p className="text-white/80 text-sm mt-1">{data.owner.email}</p>
                    {data.owner.contactNumber && (
                      <p className="text-white/80 text-sm">{data.owner.contactNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                <div className="py-3 sm:py-0 sm:pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 text-[#7FA5A3]" />
                    <p className="text-xs text-gray-400 uppercase font-medium">Email</p>
                  </div>
                  <p className="text-sm text-[#4F4F4F]">{data.owner.email}</p>
                </div>
                <div className="py-3 sm:py-0 sm:px-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 text-[#7FA5A3]" />
                    <p className="text-xs text-gray-400 uppercase font-medium">Contact</p>
                  </div>
                  <p className="text-sm text-[#4F4F4F]">{data.owner.contactNumber || '—'}</p>
                </div>
                <div className="py-3 sm:py-0 sm:pl-6">
                  <div className="flex items-center gap-2 mb-1">
                    <PawPrint className="w-4 h-4 text-[#7FA5A3]" />
                    <p className="text-xs text-gray-400 uppercase font-medium">Registered Pets</p>
                  </div>
                  <p className="text-sm text-[#4F4F4F]">{data.pets.length} pet{data.pets.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Two-column layout: pets + send note */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pets — takes 2/3 */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-base font-semibold text-[#4F4F4F] flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-[#7FA5A3]" />
                  Pets
                </h2>
                {data.pets.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                    <PawPrint className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No pets registered yet.</p>
                  </div>
                ) : (
                  data.pets.map((pet) => <PetCard key={pet.id} pet={pet} />)
                )}
              </div>

              {/* Send Note — takes 1/3 */}
              <div className="lg:col-span-1">
                <h2 className="text-base font-semibold text-[#4F4F4F] flex items-center gap-2 mb-4">
                  <Send className="w-4 h-4 text-[#7FA5A3]" />
                  Quick Contact
                </h2>
                <SendNotePanel ownerId={ownerId} token={token} />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
