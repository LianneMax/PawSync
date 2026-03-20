'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, Phone, MessageCircle, User, CheckCircle2, Nfc, Loader, X, MapPin, Heart, Navigation, Info, ChevronDown, PawPrint, Calendar, Scissors, AlertTriangle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { hasNFCTag } from '@/lib/petNfc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'


interface ScanLocation {
  lat: number
  lng: number
  scannedAt: string
}

interface PetData {
  _id: string
  name: string
  species: string
  breed: string
  secondaryBreed?: string
  sex: string
  sterilization?: 'spayed' | 'unspayed' | 'neutered' | 'unneutered' | 'unknown' | 'yes' | 'no' | null
  dateOfBirth: string
  weight: number
  microchipNumber?: string | null
  photo?: string
  allergies: string[]
  pregnancyStatus?: 'pregnant' | 'not_pregnant'
  isLost: boolean
  lostReportedByStranger: boolean
  lostContactName: string | null
  lostMessage: string | null
  scanLocations: ScanLocation[]
  nfcTagId?: string | null
  nfc_tag_id?: string | null
  tag_uid?: string | null
  nfc_id?: string | null
  tag_request_status?: 'pending' | 'approved' | null
}

interface OwnerData {
  _id: string
  firstName: string
  lastName: string
  contactNumber: string
  photo?: string | null
}

interface VitalsData {
  weight: { value: number | string; notes: string }
  temperature: { value: number | string; notes: string }
  pulseRate: { value: number | string; notes: string }
  spo2: { value: number | string; notes: string }
  recordedAt: string
}

interface VaccinationData {
  _id: string
  vaccineName: string
  manufacturer: string
  batchNumber: string
  route: string | null
  dateAdministered: string | null
  expiryDate: string | null
  nextDueDate: string | null
  status: 'active' | 'expired' | 'overdue' | 'pending'
  isUpToDate: boolean
  vet: { firstName: string; lastName: string } | null
  clinic: { name: string } | null
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
  const [showFoundDrawer, setShowFoundDrawer] = useState(false)
  const [foundStep, setFoundStep] = useState<'alert' | 'location' | 'success'>('alert')
  const [isReportingFound, setIsReportingFound] = useState(false)
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [locationShared, setLocationShared] = useState(false)
  const [showOwnerLostModal, setShowOwnerLostModal] = useState(false)
  const [showStrangerMissingConfirmModal, setShowStrangerMissingConfirmModal] = useState(false)
  const [lostNameShown, setLostNameShown] = useState('')
  const [lostContact, setLostContact] = useState('')
  const [lostMessage, setLostMessage] = useState('')
  const token = useAuthStore((state) => state.token)
  const userId = useAuthStore((state) => state.user?.id)
  const userType = useAuthStore((state) => state.user?.userType)
  // Ensures the drawer only auto-opens once (on initial page load), not when state updates later
  const drawerTriggeredRef = useRef(false)

  // Auto-open the "found" drawer when a lost pet profile loads — skip if the viewer is the owner
  useEffect(() => {
    if (pet?.isLost && owner && !drawerTriggeredRef.current) {
      drawerTriggeredRef.current = true
      const isOwner = !!userId && userId === owner._id
      if (!isOwner) {
        setShowFoundDrawer(true)
        // Fire-and-forget scan alert to the owner
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        fetch(`${apiUrl}/pets/${petId}/scan-alert`, { method: 'POST' }).catch(() => {})
      }
    }
  }, [pet?.isLost, owner, userId, petId])

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

  const openOwnerLostModal = () => {
    if (!pet || !owner) return
    setLostNameShown(pet.name)
    setLostContact(owner.contactNumber || '')
    setLostMessage(
      pet.lostMessage ||
      'If you found me, please call or message my owner and feel free to share your current location with them.'
    )
    setShowOwnerLostModal(true)
  }

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

  const formatMonthYear = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const getSterilizationLabel = (sterilization?: PetData['sterilization']) => {
    switch (sterilization) {
      case 'spayed':
        return 'Spayed'
      case 'unspayed':
        return 'Unspayed'
      case 'neutered':
        return 'Neutered'
      case 'unneutered':
        return 'Unneutered'
      case 'yes':
        return pet?.sex === 'female' ? 'Spayed' : 'Neutered'
      case 'no':
        return pet?.sex === 'female' ? 'Unspayed' : 'Unneutered'
      case 'unknown':
      default:
        return 'Unknown'
    }
  }

  const handleReportMissing = async () => {
    if (!pet) return
    setIsReporting(true)
    try {
      // Capture geolocation first so the stranger's location is recorded with the report
      const getLocation = (): Promise<GeolocationPosition | null> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null)
          navigator.geolocation.getCurrentPosition((pos) => resolve(pos), () => resolve(null), { timeout: 10000 })
        })
      const position = await getLocation()

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Pass auth token so backend can detect if this is the owner
      if (token) headers['Authorization'] = `Bearer ${token}`

      const body: Record<string, unknown> = {}
      if (position) {
        body.latitude = position.coords.latitude
        body.longitude = position.coords.longitude
      }

      const res = await fetch(`${apiUrl}/pets/${pet._id}/report-missing`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.status === 'SUCCESS') {
        toast.success('Report Submitted', { description: json.message })
        // Mark the drawer as already triggered so it doesn't auto-open again
        drawerTriggeredRef.current = true
        // Update local pet state — include the new scan location if the backend saved one
        setPet(prev => {
          if (!prev) return null
          const newLocations = [...prev.scanLocations]
          if (json.scanLocation) newLocations.push({ ...json.scanLocation, scannedAt: new Date(json.scanLocation.scannedAt).toISOString() })
          return { ...prev, isLost: true, lostReportedByStranger: true, scanLocations: newLocations }
        })
      } else {
        toast.error('Error', { description: json.message })
      }
    } catch {
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsReporting(false)
    }
  }

  const handleOwnerReportLost = async () => {
    if (!pet || !token) return
    setIsReporting(true)
    try {
      const data = await authenticatedFetch(
        `/pets/${pet._id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isLost: true,
            lostContactName: lostNameShown || null,
            lostContactNumber: lostContact || null,
            lostMessage: lostMessage || null,
            lostReportedByStranger: false,
          }),
        },
        token
      )

      if (data?.status === 'SUCCESS') {
        setPet((prev) => prev ? {
          ...prev,
          isLost: true,
          lostContactName: lostNameShown || null,
          lostMessage: lostMessage || null,
          lostReportedByStranger: false,
        } : null)
        setShowOwnerLostModal(false)
        toast.success('Pet Reported as Lost', { description: `${pet.name} has been marked as lost.` })
      } else {
        toast.error('Error', { description: data?.message || 'Failed to report pet as lost' })
      }
    } catch {
      toast.error('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsReporting(false)
    }
  }

  const handleReportFound = async () => {
    setIsReportingFound(true)
    try {
      const getLocation = (): Promise<GeolocationPosition | null> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null)
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => resolve(null),
            { timeout: 10000 }
          )
        })

      const position = await getLocation()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const body: Record<string, unknown> = {}
      if (position) {
        body.latitude = position.coords.latitude
        body.longitude = position.coords.longitude
      }

      const response = await fetch(`${apiUrl}/pets/${pet!._id}/report-found`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.status !== 'SUCCESS') {
        throw new Error(result?.message || 'Failed to report pet found')
      }

      // Update local scanLocations so the map refreshes immediately
      if (position) {
        const newEntry = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          scannedAt: new Date().toISOString(),
        }
        setPet(prev => prev ? { ...prev, scanLocations: [...prev.scanLocations, newEntry] } : null)
      }

      setFoundStep('success')
    } catch {
      setFoundStep('success')
    } finally {
      setIsReportingFound(false)
    }
  }

  const handleShareLocation = async () => {
    setIsSharingLocation(true)
    try {
      const getLocation = (): Promise<GeolocationPosition | null> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null)
          navigator.geolocation.getCurrentPosition((pos) => resolve(pos), () => resolve(null), { timeout: 10000 })
        })
      const position = await getLocation()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const body: Record<string, unknown> = {}
      if (position) {
        body.latitude = position.coords.latitude
        body.longitude = position.coords.longitude
      }
      const response = await fetch(`${apiUrl}/pets/${pet!._id}/report-found`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.status !== 'SUCCESS') {
        throw new Error(result?.message || 'Failed to share location')
      }
      if (position) {
        setPet(prev => prev ? {
          ...prev,
          scanLocations: [...prev.scanLocations, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            scannedAt: new Date().toISOString(),
          }]
        } : null)
      }
      setLocationShared(true)
      toast.success('Location Shared', { description: 'The owner has been notified. Thank you!' })
    } catch {
      toast.error('Error', { description: 'Could not share location. Please try again.' })
    } finally {
      setIsSharingLocation(false)
    }
  }

  const handleSubmitNfcRequest = async () => {
    if (!pet || !token) {
      toast.error('Please sign in to request an NFC tag')
      return
    }

    const hasPendingRequest = pet.tag_request_status === 'pending' || pet.tag_request_status === 'approved'
    if (hasPendingRequest) {
      toast.info('Request already sent', {
        description: 'A pet tag request already exists for this pet.'
      })
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
        setPet((prev) => prev ? { ...prev, tag_request_status: 'pending' } : prev)
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

  const isOwner = !!userId && !!owner && userId === owner._id
  const hasPendingRequest = pet.tag_request_status === 'pending' || pet.tag_request_status === 'approved'

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Hero Section */}
      <div className={`h-64 flex items-center justify-center relative ${pet.isLost ? 'bg-linear-to-b from-[#C0392B] to-[#962d22]' : 'bg-linear-to-b from-[#7FA5A3] to-[#6b9391]'}`}>
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
          {hasNFCTag(pet) && (
            <button
              onClick={() => {
                if (isOwner) {
                  openOwnerLostModal()
                  return
                }
                setShowStrangerMissingConfirmModal(true)
              }}
              disabled={isReporting || pet.isLost}
              className="bg-[#8B2E2E] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-[#7A2828] transition-colors disabled:opacity-60"
            >
              <AlertCircle className="w-4 h-4" />
              {pet.isLost ? 'Reported Missing' : 'Report Missing'}
            </button>
          )}
        </div>

        {/* Lost pet info card — shown when lost */}
        {pet.isLost && (
          <div className="bg-[#FDF2F2] border border-[#E8BEBE] rounded-xl px-4 py-4 space-y-3">
            {pet.lostReportedByStranger ? (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#900B09] shrink-0 mt-0.5" />
                <p className="text-xs text-[#7A2828] leading-relaxed">
                  <span className="font-semibold">Reported by a finder.</span> The registered owner has not yet confirmed this report.
                  If you are the owner and your pet is safe, please update its status.
                </p>
              </div>
            ) : (
              <>
                {pet.lostContactName && (
                  <p className="text-sm font-semibold text-[#4F4F4F]">
                    Looking for: <span className="text-[#900B09]">{pet.lostContactName}</span>
                  </p>
                )}
                {pet.lostMessage && (
                  <p className="text-sm text-[#4F4F4F] leading-relaxed">{pet.lostMessage}</p>
                )}
              </>
            )}
            {/* Share location button — visible to strangers only */}
            {!(!!userId && !!owner && userId === owner._id) && (
              <button
                onClick={handleShareLocation}
                disabled={isSharingLocation || locationShared}
                className="w-full py-2.5 bg-[#35785C] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2D6B52] transition-colors disabled:opacity-60"
              >
                {isSharingLocation ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Sharing location...</>
                ) : locationShared ? (
                  <><CheckCircle2 className="w-4 h-4" /> Location Shared</>
                ) : (
                  <><Navigation className="w-4 h-4" /> Share My Location</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Request NFC Tag (only for pet-owners) */}
        {token && userType === 'pet-owner' && (
          <button
            onClick={() => {
              if (hasPendingRequest) return
              setShowNfcRequestModal(true)
            }}
            disabled={hasPendingRequest}
            className="w-full bg-[#7FA5A3] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#6b9391] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Nfc className="w-5 h-5" />
            {hasPendingRequest ? 'Request Sent' : 'Request Pet Tag'}
          </button>
        )}

        {/* Public Pet Information */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <PawPrint className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Species</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F] capitalize">{pet.species}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gender</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F] capitalize">{pet.sex}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Age</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F]">{calculateAge(pet.dateOfBirth)}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Scissors className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sterilization</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F]">{getSterilizationLabel(pet.sterilization)}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <PawPrint className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Breed</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F] capitalize">{pet.breed}{pet.secondaryBreed ? ` × ${pet.secondaryBreed}` : ''}</p>
          </div>
          <div className="bg-[#F8F6F2] rounded-xl px-5 py-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Nfc className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Microchip Number</p>
            </div>
            <p className="text-base font-bold text-[#4F4F4F]">{pet.microchipNumber || 'Not registered'}</p>
          </div>
        </div>

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
          <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#476B6B] px-6 py-4 flex items-center justify-between">
              <img
                src="/images/logos/pawsync-logo-white.png"
                alt="PawSync"
                className="h-8 w-auto object-contain"
              />
              <span className="text-white text-sm tracking-wider font-normal">VACCINATION CARD</span>
            </div>

            <div className="px-6 pt-5 pb-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">PET&apos;S NAME</p>
                <p className="text-[22px] font-bold text-[#476B6B] uppercase leading-tight mb-4">{pet.name}</p>
                <p className="text-[11px] text-[#4F4F4F] uppercase tracking-wider mb-1 font-normal">NFC TAG NO.</p>
                <p className="text-[18px] text-[#476B6B] font-normal">{pet.microchipNumber || 'Not registered'}</p>
              </div>
              <div className="rounded-[19px] overflow-hidden bg-[#476B6B] shrink-0 flex items-center justify-center w-30 h-27.5">
                {pet.photo ? (
                  <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/20" />
                )}
              </div>
            </div>

            <div className="relative flex items-center h-6">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-r-full z-10" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-l-full z-10" />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            {vaccinations.length > 0 ? (
              <div>
                <div className="mx-5 mt-4 rounded-[19px] overflow-hidden bg-[#EFEFEF]">
                  <div className="divide-y divide-gray-200">
                    {vaccinations.map((vax) => {
                      const dateToShow = vax.expiryDate ?? vax.nextDueDate
                      const isNegative = vax.status === 'overdue' || vax.status === 'expired'

                      return (
                        <div key={vax._id} className="w-full flex items-center justify-between px-5 py-4">
                          <p className="text-[18px] text-[#4F4F4F] font-normal">{vax.vaccineName}</p>
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
                              <p className="text-[14px] text-[#4F4F4F] capitalize">{vax.status}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {vaccinations[0] && (
                    <div className="bg-white border-t border-[#C2C2C2] grid grid-cols-2 gap-4 px-5 py-4 rounded-b-[19px]">
                      <div>
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">ADMINISTERED</p>
                        <p className="text-[14px] text-[#4F4F4F] truncate">
                          {vaccinations[0].vet ? `Dr. ${vaccinations[0].vet.firstName} ${vaccinations[0].vet.lastName}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#959595] uppercase tracking-wide mb-1">VETERINARY CLINIC</p>
                        <p className="text-[14px] text-[#4F4F4F] truncate">{vaccinations[0].clinic?.name ?? '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mx-5 my-5 flex items-center justify-center gap-2 bg-[#BAE0BD] rounded-full py-2.5 px-4">
                  <CheckCircle2 className="w-4 h-4 text-[#35785C] shrink-0" />
                  <span className="text-[13px] text-[#35785C] font-normal">Vet Verified — Linked to Medical Records</span>
                </div>
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No vaccination records on file</div>
            )}
          </div>
        </div>
      </div>

      {/* Lost Pet — Found Drawer (auto-opens when pet.isLost) */}
      <Sheet open={showFoundDrawer} onOpenChange={setShowFoundDrawer}>
        <SheetContent
          side="bottom"
          close={false}
          className="rounded-t-3xl border-t-0 pb-10 px-6 pt-6 max-w-lg mx-auto left-0 right-0"
        >
          {foundStep === 'alert' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-[#900B09] rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <SheetHeader className="text-center mb-5">
                <SheetTitle className="text-xl font-bold text-[#900B09]">Lost Pet Alert!</SheetTitle>
                <SheetDescription className="text-sm text-gray-600 mt-1">
                  <span className="font-semibold text-[#4F4F4F]">{pet?.name}</span> has been reported
                  as missing{pet?.lostReportedByStranger ? ' by a finder' : ' by their owner'}. Have you found this pet?
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3">
                <button
                  onClick={() => setFoundStep('location')}
                  className="w-full py-3 bg-[#35785C] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#2D6B52] transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  I Found This Pet!
                </button>
                <button
                  onClick={() => setShowFoundDrawer(false)}
                  className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}

          {foundStep === 'location' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-[#7FA5A3] rounded-full flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-white" />
                </div>
              </div>
              <SheetHeader className="text-center mb-4">
                <SheetTitle className="text-xl font-bold text-[#4F4F4F]">Share Your Location</SheetTitle>
                <SheetDescription className="text-sm text-gray-600 mt-1">
                  Tap the button below to share your current location with the pet owner.
                </SheetDescription>
              </SheetHeader>
              <div className="bg-[#F8F6F2] rounded-xl p-4 mb-5 flex items-start gap-3">
                <Info className="w-4 h-4 text-[#7FA5A3] shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Only your <span className="font-semibold text-[#4F4F4F]">last scanned location</span> will
                  be shared with the owner to help them find their pet. Your personal information and contact
                  details will not be disclosed.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleReportFound}
                  disabled={isReportingFound}
                  className="w-full py-3 bg-[#35785C] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#2D6B52] transition-colors disabled:opacity-50"
                >
                  {isReportingFound ? (
                    <><Loader className="w-4 h-4 animate-spin" /> Sharing location...</>
                  ) : (
                    <><Navigation className="w-4 h-4" /> Share Location &amp; Report Found</>
                  )}
                </button>
                <button
                  onClick={() => setFoundStep('alert')}
                  className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </>
          )}

          {foundStep === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-[#35785C] rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <SheetHeader className="text-center mb-5">
                <SheetTitle className="text-xl font-bold text-[#35785C]">Thank You!</SheetTitle>
                <SheetDescription className="text-sm text-gray-600 mt-1">
                  The owner of <span className="font-semibold text-[#4F4F4F]">{pet?.name}</span> has been
                  notified. Please use the contact details below to reach them directly.
                </SheetDescription>
              </SheetHeader>
              <button
                onClick={() => setShowFoundDrawer(false)}
                className="w-full py-3 bg-[#35785C] text-white rounded-xl font-semibold text-sm hover:bg-[#2D6B52] transition-colors"
              >
                Done
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="nfc-reason"
                    type="button"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                  >
                    <span className={nfcReason ? 'text-gray-800' : 'text-gray-500'}>
                      {
                        {
                          '': 'Select a reason (optional)',
                          lost_replacement: 'Lost/Damaged Tag Replacement',
                          upgrade: 'Upgrade to New Tag',
                          additional: 'Additional Tag',
                          other: 'Other',
                        }[nfcReason] || 'Select a reason (optional)'
                      }
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg">
                  <DropdownMenuRadioGroup value={nfcReason} onValueChange={setNfcReason}>
                    <DropdownMenuRadioItem value="">Select a reason (optional)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="lost_replacement">Lost/Damaged Tag Replacement</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="upgrade">Upgrade to New Tag</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="additional">Additional Tag</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="other">Other</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
                disabled={isSubmittingNfcRequest || hasPendingRequest}
                className="flex-1 py-2.5 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6b9391] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingNfcRequest ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : hasPendingRequest ? (
                  'Request Sent'
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stranger Report Missing Confirmation Modal */}
      <Dialog
        open={showStrangerMissingConfirmModal && !isOwner}
        onOpenChange={(open) => !open && setShowStrangerMissingConfirmModal(false)}
      >
        <DialogContent className="max-w-md w-[95vw] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#900B09] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Report Missing Pet?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Submitting this report will notify the pet owner that someone has flagged this pet as missing. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <button
              onClick={() => setShowStrangerMissingConfirmModal(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setShowStrangerMissingConfirmModal(false)
                await handleReportMissing()
              }}
              disabled={isReporting}
              className="flex-1 px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {isReporting ? 'Submitting...' : 'Yes, Notify Owner'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Report Lost Modal (public profile only for logged-in owner) */}
      <Dialog open={showOwnerLostModal && isOwner} onOpenChange={(open) => !open && setShowOwnerLostModal(false)}>
        <DialogContent className="sm:max-w-110">
          <DialogHeader>
            <DialogTitle
              className="text-2xl font-normal text-[#900B09] flex items-center gap-2"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              <AlertTriangle className="w-6 h-6" />
              Report Lost Pet
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              This will mark {pet.name} as lost and notify vets and nearby users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 bg-[#F8F6F2] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/20 flex items-center justify-center overflow-hidden shrink-0">
                {pet.photo ? (
                  <Image src={pet.photo} alt={pet.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <PawPrint className="w-5 h-5 text-[#7FA5A3]" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">{pet.name}</p>
                <p className="text-xs text-gray-500">{pet.breed}{pet.secondaryBreed ? ` × ${pet.secondaryBreed}` : ''}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-600">Name Shown on Tag</label>
              <input
                type="text"
                value={lostNameShown}
                onChange={(e) => setLostNameShown(e.target.value)}
                placeholder="Name to display on lost pet alert"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Contact Number
              </label>
              <input
                type="text"
                value={lostContact}
                onChange={(e) => setLostContact(e.target.value)}
                placeholder="Your contact number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Additional Message <span className="text-gray-400 text-xs font-normal">(Optional)</span>
              </label>
              <textarea
                value={lostMessage}
                onChange={(e) => setLostMessage(e.target.value)}
                placeholder="Any details that may help identify your pet..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30 resize-none"
              />
            </div>

            <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#900B09] shrink-0 mt-0.5" />
              <p className="text-xs text-[#900B09]">
                Marking as lost will update your pet&apos;s NFC tag. Anyone who scans it will see a lost pet alert and can share their location with you.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <button
              onClick={() => setShowOwnerLostModal(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOwnerReportLost}
              disabled={isReporting}
              className="flex-1 px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {isReporting ? 'Marking...' : 'Mark as Lost & Update NFC Tag'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Bar - Owner Info (pill) */}
      {owner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <div
              className="rounded-full px-5 py-3 flex items-center gap-3 shadow-lg"
              style={{ backgroundColor: '#7FA5A3', boxShadow: '0 8px 24px rgba(127,165,163,0.45)' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                {owner.photo ? (
                  <Image
                    src={owner.photo}
                    alt={`${owner.firstName} ${owner.lastName}`}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-semibold text-white/70 uppercase tracking-wider">Pet Owner</p>
                <p className="text-white font-bold text-sm truncate leading-tight">
                  {owner.firstName} {owner.lastName}
                </p>
              </div>
              {owner.contactNumber && (
                <a
                  href={`tel:${owner.contactNumber}`}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors"
                >
                  <Phone className="w-4 h-4 text-white" />
                </a>
              )}
              {owner.contactNumber && (
                <a
                  href={`sms:${owner.contactNumber}`}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
