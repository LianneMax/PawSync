'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, Phone, MessageCircle, User, CheckCircle2, Nfc, Loader, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'

interface PetData {
  _id: string
  name: string
  species: string
  breed: string
  secondaryBreed?: string
  sex: string
  dateOfBirth: string
  weight: number
  photo?: string
  allergies: string[]
  isLost: boolean
}

interface OwnerData {
  _id: string
  firstName: string
  lastName: string
  contactNumber: string
}

interface VitalsData {
  weight: { value: number | string; notes: string }
  temperature: { value: number | string; notes: string }
  pulseRate: { value: number | string; notes: string }
  spo2: { value: number | string; notes: string }
  recordedAt: string
}

interface VaccinationData {
  vaccineName: string
  dateAdministered: string
  nextDueDate: string | null
  isUpToDate: boolean
}

interface PublicProfileResponse {
  status: string
  data: {
    pet: PetData
    owner: OwnerData
    vitals: VitalsData | null
    vaccinations: VaccinationData[]
    vaccinationStatus: 'none' | 'up_to_date' | 'overdue'
  }
}

export default function PetProfilePage() {
  const params = useParams()
  const petId = params.petId as string

  const [pet, setPet] = useState<PetData | null>(null)
  const [owner, setOwner] = useState<OwnerData | null>(null)
  const [vitals, setVitals] = useState<VitalsData | null>(null)
  const [vaccinations, setVaccinations] = useState<VaccinationData[]>([])
  const [vaccinationStatus, setVaccinationStatus] = useState<string>('none')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isReporting, setIsReporting] = useState(false)
  const [showNfcRequestModal, setShowNfcRequestModal] = useState(false)
  const [nfcReason, setNfcReason] = useState('')
  const [isSubmittingNfcRequest, setIsSubmittingNfcRequest] = useState(false)
  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        const res = await fetch(`${apiUrl}/pets/${petId}/public`)
        if (!res.ok) throw new Error('Pet not found')
        const json: PublicProfileResponse = await res.json()

        setPet(json.data.pet)
        setOwner(json.data.owner)
        setVitals(json.data.vitals)
        setVaccinations(json.data.vaccinations)
        setVaccinationStatus(json.data.vaccinationStatus)
        setError(null)
      } catch (err) {
        console.error('Error fetching pet profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pet profile')
      } finally {
        setLoading(false)
      }
    }

    if (petId) fetchProfile()
  }, [petId])

  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    if (age > 0) return `${age} Year${age !== 1 ? 's' : ''}`
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth()
    return months > 0 ? `${months} Month${months !== 1 ? 's' : ''}` : 'Newborn'
  }

  const handleReportMissing = async () => {
    if (!pet) return
    setIsReporting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const res = await fetch(`${apiUrl}/pets/${pet._id}/report-missing`, { method: 'POST' })
      const json = await res.json()
      if (json.status === 'SUCCESS') {
        toast.success('Report Submitted', { description: json.message })
        setPet(prev => prev ? { ...prev, isLost: true } : null)
      } else {
        toast.error('Error', { description: json.message })
      }
    } catch {
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsReporting(false)
    }
  }

  const handleSubmitNfcRequest = async () => {
    if (!pet || !token) {
      toast.error('Please sign in to request an NFC tag')
      return
    }

    setIsSubmittingNfcRequest(true)
    try {
      const data = await authenticatedFetch(
        `/nfc/pet/${pet._id}/request-tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: nfcReason || undefined }),
        },
        token
      )

      if (data.status === 'SUCCESS') {
        toast.success('NFC Tag Request Submitted', {
          description: 'Your clinic will process your request and write the tag soon.'
        })
        setShowNfcRequestModal(false)
        setNfcReason('')
      } else {
        toast.error('Error', { description: data.message || 'Failed to submit request' })
      }
    } catch (error) {
      console.error('Error submitting NFC request:', error)
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmittingNfcRequest(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5A7C7A] mx-auto mb-4" />
          <p className="text-gray-600">Loading pet profile...</p>
        </div>
      </div>
    )
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Pet Not Found</h1>
          <p className="text-gray-600">{error || 'This pet profile could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#7FA5A3] to-[#6b9391] h-64 flex items-center justify-center relative">
        {pet.photo ? (
          <Image
            src={pet.photo}
            alt={pet.name}
            width={160}
            height={160}
            className="w-40 h-40 rounded-full object-cover border-4 border-white/20 shadow-lg"
          />
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-400/50 border-4 border-white/20 flex items-center justify-center shadow-lg">
            <User className="w-16 h-16 text-white/60" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 pt-6 space-y-6">
        {/* Name + Report Missing */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#4F4F4F]">{pet.name}</h1>
          <button
            onClick={handleReportMissing}
            disabled={isReporting || pet.isLost}
            className="bg-[#8B2E2E] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-[#7A2828] transition-colors disabled:opacity-60"
          >
            <AlertCircle className="w-4 h-4" />
            {pet.isLost ? 'Reported Missing' : 'Report Missing'}
          </button>
        </div>

        {/* Request NFC Tag (only for logged-in users) */}
        {token && (
          <button
            onClick={() => setShowNfcRequestModal(true)}
            className="w-full bg-[#7FA5A3] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#6b9391] transition-colors"
          >
            <Nfc className="w-5 h-5" />
            Request NFC Tag
          </button>
        )}

        {/* Info Chips */}
        <div className="flex gap-3">
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-3 flex-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Species</p>
            <p className="text-base font-bold text-[#4F4F4F] capitalize">{pet.species}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-3 flex-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Gender</p>
            <p className="text-base font-bold text-[#4F4F4F] capitalize">{pet.sex}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-3 flex-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Age</p>
            <p className="text-base font-bold text-[#4F4F4F]">{calculateAge(pet.dateOfBirth)}</p>
          </div>
        </div>

        {/* Vitals Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Weight</p>
            <p className="text-lg font-bold text-[#4F4F4F]">
              {vitals?.weight?.value ?? pet.weight} <span className="text-sm font-semibold text-gray-500">kg</span>
            </p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Temperature</p>
            <p className="text-lg font-bold text-[#4F4F4F]">
              {vitals?.temperature?.value ?? '—'} <span className="text-sm font-semibold text-gray-500">&deg;C</span>
            </p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pulse Rate</p>
            <p className="text-lg font-bold text-[#4F4F4F]">
              {vitals?.pulseRate?.value ?? '—'} <span className="text-sm font-semibold text-gray-500">bpm</span>
            </p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">SpO2</p>
            <p className="text-lg font-bold text-[#4F4F4F]">
              {vitals?.spo2?.value ?? '—'} <span className="text-sm font-semibold text-gray-500">%</span>
            </p>
          </div>
        </div>

        {/* Known Allergies */}
        {pet.allergies && pet.allergies.length > 0 && (
          <div className="bg-[#F8F6F2] rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Allergies</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pet.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="bg-[#476B6B] text-white text-xs px-2.5 py-1 rounded-full"
                >
                  {allergy}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Vaccination Records */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#4F4F4F]">Vaccination Records</h3>
            {vaccinationStatus === 'up_to_date' && (
              <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-3 py-1 rounded-full">
                Up to Date
              </span>
            )}
            {vaccinationStatus === 'overdue' && (
              <span className="text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-3 py-1 rounded-full">
                Overdue
              </span>
            )}
          </div>
          {vaccinations.length > 0 ? (
            <div className="space-y-2">
              {vaccinations.map((vax, idx) => (
                <div
                  key={idx}
                  className="bg-[#F8F6F2] rounded-xl px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#4F4F4F]">{vax.vaccineName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(vax.dateAdministered).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {vax.isUpToDate && (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#F8F6F2] rounded-xl px-5 py-6 text-center">
              <p className="text-gray-400 text-sm">No vaccination records yet</p>
            </div>
          )}
        </div>
      </div>

      {/* NFC Tag Request Modal */}
      {showNfcRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6 relative">
            <button
              onClick={() => { setShowNfcRequestModal(false); setNfcReason(''); }}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#7FA5A3]/10 rounded-full flex items-center justify-center">
                <Nfc className="w-5 h-5 text-[#7FA5A3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Request NFC Tag</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Request an NFC tag for <span className="font-semibold">{pet?.name}</span>. Your clinic will process the request.
            </p>

            <div className="mb-5">
              <label htmlFor="nfc-reason" className="text-sm font-semibold text-gray-600 block mb-1.5">
                Reason <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select
                id="nfc-reason"
                value={nfcReason}
                onChange={(e) => setNfcReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              >
                <option value="">Select a reason (optional)</option>
                <option value="lost_replacement">Lost/Damaged Tag Replacement</option>
                <option value="upgrade">Upgrade to New Tag</option>
                <option value="additional">Additional Tag</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowNfcRequestModal(false); setNfcReason(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNfcRequest}
                disabled={isSubmittingNfcRequest}
                className="flex-1 py-2.5 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6b9391] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingNfcRequest ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar - Owner Info */}
      {owner && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#2C4A3E] rounded-t-3xl px-5 py-4 flex items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 bg-[#3D5E50] rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-[#8BAFA5] uppercase tracking-wider">Pet Owner</p>
                <p className="text-white font-bold text-base truncate">
                  {owner.firstName} {owner.lastName}
                </p>
              </div>
              {owner.contactNumber && (
                <a
                  href={`tel:${owner.contactNumber}`}
                  className="w-12 h-12 bg-[#3D5E50] rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#4A6F5F] transition-colors"
                >
                  <Phone className="w-5 h-5 text-white" />
                </a>
              )}
              {owner.contactNumber && (
                <a
                  href={`sms:${owner.contactNumber}`}
                  className="w-12 h-12 bg-[#3D5E50] rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#4A6F5F] transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
