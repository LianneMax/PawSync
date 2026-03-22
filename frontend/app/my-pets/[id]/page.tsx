'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const LastScannedMap = dynamic(() => import('@/components/LastScannedMap'), { ssr: false })
const ScanLocationsMap = dynamic(() => import('@/components/ScanLocationsMap'), { ssr: false })
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getPetById, updatePet, togglePetLost, requestConfinementRelease, markPetDeceased, transferPet, searchTransferOwnerEmails, type Pet as APIPet } from '@/lib/pets'
import { getRecordsByPet, getRecordById, type MedicalRecord, type VitalEntry } from '@/lib/medicalRecords'
import { getAllClinicsWithBranches, type ClinicWithBranches } from '@/lib/clinics'
import { getMyAppointments, type Appointment } from '@/lib/appointments'
import { authenticatedFetch } from '@/lib/auth'
import AvatarUpload from '@/components/avatar-upload'
import { uploadImage } from '@/lib/upload'
import { ArrowLeft, PawPrint, Pencil, Check, X, Camera, FileText, Calendar, Stethoscope, ChevronRight, QrCode, Nfc, ChevronDown, AlertTriangle, Phone, MessageSquare, CreditCard, MapPin, Cross, Skull, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PopulatedOwner {
  contactNumber?: string
  firstName?: string
  lastName?: string
}

interface TagRequest {
  _id: string
  petId: { _id: string }
  status: string
  reason?: string
  createdAt: string
  fulfilledAt?: string
}

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  return `${y} year${y > 1 ? 's' : ''}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function PetProfilePage() {
  const router = useRouter()
  const params = useParams()
  const petId = params.id as string
  const token = useAuthStore((state) => state.token)

  const [pet, setPet] = useState<APIPet | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'medical-records' | 'nfc'>('basic')
  const [showNfcModal, setShowNfcModal] = useState(false)
  const [nfcReason, setNfcReason] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [, setNextAppointment] = useState<unknown>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [clinicBranches, setClinicBranches] = useState<ClinicWithBranches[]>([])
  const [, setLoadingClinics] = useState(false)
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [healthMetrics, setHealthMetrics] = useState<{ lastVisit: string; nextVisit: string; lastSpo2: string }>({ lastVisit: '-', nextVisit: '-', lastSpo2: '-' })
  const [showQRCodeModal, setShowQRCodeModal] = useState(false)
  const [tagRequests, setTagRequests] = useState<TagRequest[]>([])
  const [loadingTagRequests, setLoadingTagRequests] = useState(false)
  const [showClinicDropdown, setShowClinicDropdown] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostNameShown, setLostNameShown] = useState('')
  const [lostContact, setLostContact] = useState('')
  const [lostMessage, setLostMessage] = useState('')
  const [isMarkingLost, setIsMarkingLost] = useState(false)
  const [isUpdatingConfinement, setIsUpdatingConfinement] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeReason, setRemoveReason] = useState('')
  const [removeDeceasedDate, setRemoveDeceasedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [removeNewOwnerEmail, setRemoveNewOwnerEmail] = useState('')
  const [removeEmailSuggestions, setRemoveEmailSuggestions] = useState<string[]>([])
  const [isRemoveTransferSearchOpen, setIsRemoveTransferSearchOpen] = useState(false)
  const [isLoadingRemoveEmailSuggestions, setIsLoadingRemoveEmailSuggestions] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [removeBillingBlocked, setRemoveBillingBlocked] = useState(false)
  const removeTransferDebounceRef = useRef<NodeJS.Timeout>(null)
  const hasRegisteredNfcTag = Boolean(pet?.nfcTagId?.trim() && pet.nfcTagId !== '-')
  const isPetDeceased = Boolean(pet && (!pet.isAlive || pet.status === 'deceased'))
  const deceasedDateLabel = pet
    ? formatDate(pet.deceasedAt || new Date().toISOString())
    : ''
  const lostPetLockedMessage = 'Purchase a pet tag first to unlock this feature.'

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editSex, setEditSex] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editMicrochip, setEditMicrochip] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editAllergies, setEditAllergies] = useState('')
  const [editPhoto, setEditPhoto] = useState<string | null>(null)
  const resolvedProfilePhoto = editPhoto || pet?.photo || (pet as APIPet & { profile_image?: string | null; image_url?: string | null })?.profile_image || (pet as APIPet & { profile_image?: string | null; image_url?: string | null })?.image_url || null
  const hasProfilePhoto = Boolean(resolvedProfilePhoto)

  const fetchPet = useCallback(async () => {
    if (!token || !petId) return
    try {
      setLoading(true)
      const response = await getPetById(petId, token)
      if (response.status === 'SUCCESS' && response.data?.pet) {
        setPet(response.data.pet)
      }
    } catch (error) {
      console.error('Failed to fetch pet:', error)
    } finally {
      setLoading(false)
    }
  }, [token, petId])

  const fetchMedicalRecords = useCallback(async () => {
    if (!token || !petId) return
    setRecordsLoading(true)
    try {
      const res = await getRecordsByPet(petId, token)
      if (res.status === 'SUCCESS' && res.data) {
        const records = [
          ...(res.data.currentRecord ? [res.data.currentRecord] : []),
          ...res.data.historicalRecords,
        ]
        setMedicalRecords(records)
      } else {
        setMedicalRecords([])
      }
    } catch (err) {
      setMedicalRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }, [token, petId])

  const fetchTagRequests = useCallback(async () => {
    if (!token || !petId) return
    setLoadingTagRequests(true)
    try {
      const response = await authenticatedFetch(
        `/nfc/clinic/all-requests`,
        { method: 'GET' },
        token
      )
      const data = response
      if (data.status === 'SUCCESS' && data.data?.requests) {
        const petRequests = data.data.requests.filter((req: TagRequest) => req.petId._id === petId)
        setTagRequests(petRequests)
      } else {
        setTagRequests([])
      }
    } catch (err) {
      setTagRequests([])
    } finally {
      setLoadingTagRequests(false)
    }
  }, [token, petId])

  const fetchAppointments = useCallback(async () => {
    if (!token) return
    setAppointmentsLoading(true)
    try {
      const res = await getMyAppointments(undefined, token)
      if (res.status === 'SUCCESS' && res.data?.appointments) {
        setAppointments(res.data.appointments)
      } else {
        setAppointments([])
      }
    } catch (err) {
      setAppointments([])
    } finally {
      setAppointmentsLoading(false)
    }
  }, [token])

  const computeHealthMetrics = useCallback(() => {
    if (!petId) return

    const now = new Date()

    // Filter appointments for this pet
    const petAppts = appointments.filter((a) => {
      const apptPetId = typeof a.petId === 'object' ? a.petId?._id : a.petId
      return apptPetId === petId
    })

    // Get last visit: most recent completed appointment
    const completed = petAppts
      .filter((a) => a.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const lastVisitDate = completed[0] ? new Date(completed[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'

    // Get next visit: next upcoming appointment
    const upcoming = petAppts
      .filter(
        (a) =>
          ['pending', 'confirmed', 'in_progress'].includes(a.status) &&
          new Date(a.date) >= now
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const nextVisitDate = upcoming[0] ? new Date(upcoming[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'

    // Get last SpO2: most recent medical record with spo2 value
    let lastSpo2Value = '-'
    
    if (medicalRecords.length > 0) {
      // Sort records by createdAt descending (most recent first)
      const sortedRecords = [...medicalRecords].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      // Find first record with non-empty spo2 value
      const recordWithSpo2 = sortedRecords.find((r) => {
        const spo2Val = r.vitals?.spo2?.value
        return spo2Val !== undefined && spo2Val !== null && spo2Val !== ''
      })
      
      if (recordWithSpo2?.vitals?.spo2?.value !== undefined && recordWithSpo2?.vitals?.spo2?.value !== null && recordWithSpo2?.vitals?.spo2?.value !== '') {
        lastSpo2Value = `${recordWithSpo2.vitals.spo2.value}%`
      }
    }

    setHealthMetrics({
      lastVisit: lastVisitDate,
      nextVisit: nextVisitDate,
      lastSpo2: lastSpo2Value
    })
  }, [petId, appointments, medicalRecords])

  const handleViewRecord = async (recordId: string) => {
    if (!token) return
    setViewLoading(true)
    try {
      const res = await getRecordById(recordId, token)
      if (res.status === 'SUCCESS' && res.data?.record) {
        setViewRecord(res.data.record)
      } else {
        toast.error('Failed to load record')
      }
    } catch (err) {
      toast.error('An error occurred')
    } finally {
      setViewLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'medical-records' && medicalRecords.length === 0 && !recordsLoading) {
      fetchMedicalRecords()
    }
  }, [activeTab, medicalRecords, recordsLoading, fetchMedicalRecords])

  // Fetch medical records on mount to compute health metrics
  useEffect(() => {
    if (medicalRecords.length === 0 && !recordsLoading) {
      fetchMedicalRecords()
    }
  }, [token, petId])

  useEffect(() => {
    if (activeTab === 'nfc' && tagRequests.length === 0 && !loadingTagRequests) {
      fetchTagRequests()
    }
  }, [activeTab, tagRequests, loadingTagRequests, fetchTagRequests])

  // Fetch appointments on mount and recompute health metrics when they change
  useEffect(() => {
    if (appointments.length === 0 && !appointmentsLoading) {
      fetchAppointments()
    }
  }, [appointments.length, appointmentsLoading, fetchAppointments])

  // Compute health metrics when appointments or medical records change
  useEffect(() => {
    computeHealthMetrics()
  }, [computeHealthMetrics])

  useEffect(() => {
    const fetchClinics = async () => {
      setLoadingClinics(true)
      try {
        const response = await getAllClinicsWithBranches()
        if (response.status === 'SUCCESS' && response.data?.clinics) {
          setClinicBranches(response.data.clinics)
        }
      } catch (error) {
        console.error('Failed to fetch clinics:', error)
      } finally {
        setLoadingClinics(false)
      }
    }
    fetchClinics()
  }, [])

  useEffect(() => {
    fetchPet()
  }, [fetchPet])

  const startEditing = () => {
    if (!pet) return
    setEditName(pet.name)
    setEditSex(pet.sex)
    setEditWeight(String(pet.weight))
    setEditMicrochip(pet.microchipNumber || '')
    setEditNotes(pet.notes || '')
    setEditAllergies(pet.allergies.join(', '))
    setEditPhoto(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditPhoto(null)
    setShowPhotoUpload(false)
  }

  const handleSave = async () => {
    if (!pet || !token) return
    setSaving(true)
    try {
      const updates: Record<string, unknown> = {}

      if (editName.trim() && editName !== pet.name) updates.name = editName.trim()
      if (editMicrochip !== (pet.microchipNumber || '')) updates.microchipNumber = editMicrochip || null
      if (editNotes !== (pet.notes || '')) updates.notes = editNotes || null
      if (editPhoto) updates.photo = editPhoto

      const newAllergies = editAllergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
      if (JSON.stringify(newAllergies) !== JSON.stringify(pet.allergies)) {
        updates.allergies = newAllergies
      }

      if (Object.keys(updates).length === 0) {
        setEditing(false)
        setShowPhotoUpload(false)
        return
      }

      // Update pet information if there are pet-related changes
      if (Object.keys(updates).length > 0) {
        const response = await updatePet(petId, updates as Partial<APIPet>, token)
        if (response.status !== 'SUCCESS') {
          toast('Error', { description: response.message || 'Failed to update pet.' })
          setSaving(false)
          return
        }
      }

      toast('Pet Updated', { description: `${pet.name}'s profile has been updated.` })
      await fetchPet()
      setEditing(false)
      setShowPhotoUpload(false)
    } catch {
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoChange = async (newPhoto: string) => {
    if (!pet || !token) return
    setSaving(true)
    try {
      const response = await updatePet(petId, { photo: newPhoto } as Partial<APIPet>, token)
      if (response.status === 'SUCCESS') {
        toast('Photo Updated', { description: `${pet.name}'s photo has been changed.` })
        await fetchPet()
        setShowPhotoUpload(false)
      } else {
        toast('Error', { description: response.message || 'Failed to update photo.' })
      }
    } catch {
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const openLostModal = () => {
    if (!pet || !hasRegisteredNfcTag) return
    setLostNameShown(pet.name)
    setLostContact(typeof pet.ownerId === 'object' ? (pet.ownerId as PopulatedOwner).contactNumber || '' : '')
    setLostMessage('If you found me, please call or message my owner and feel free to share your current location with them.')
    setShowLostModal(true)
  }

  const handleReportLost = async () => {
    if (!pet || !token) return
    if (!hasRegisteredNfcTag) {
      toast('NFC Tag Required', { description: lostPetLockedMessage })
      return
    }
    setIsMarkingLost(true)
    try {
      const response = await togglePetLost(pet._id, true, token, {
        lostContactName: lostNameShown || null,
        lostContactNumber: lostContact || null,
        lostMessage: lostMessage || null,
        lostReportedByStranger: false, // Owner is marking as lost, not a stranger
      })
      if (response.status === 'SUCCESS') {
        toast('Pet Marked as Lost', { description: `${pet.name} has been marked as lost. Vets will be notified.` })
        setShowLostModal(false)
        await fetchPet()
      } else {
        toast('Error', { description: response.message || 'Failed to mark pet as lost.' })
      }
    } catch {
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsMarkingLost(false)
    }
  }

  const handleRequestNfcTag = async () => {
    if (!pet || !token) return

    if (!pet.isAlive || pet.status === 'deceased') {
      toast('Action Unavailable', { description: 'Deceased pets cannot request NFC tags.' })
      return
    }

    // If pet has no tag, submit request immediately
    if (!pet.nfcTagId) {
      setIsSubmittingRequest(true)
      try {
        const response = await authenticatedFetch(
          `/nfc/pet/${pet._id}/request-tag`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: '' }),
          },
          token
        )

        const data = response

        if (data.status === 'SUCCESS') {
          toast('NFC Tag Request Submitted', {
            description: 'Your clinic will process your tag request shortly.'
          })
        } else {
          toast('Error', { description: data.message || 'Failed to submit request' })
        }
      } catch (error) {
        console.error('Error submitting NFC request:', error)
        toast('Error', { description: 'Something went wrong. Please try again.' })
      } finally {
        setIsSubmittingRequest(false)
      }
    } else {
      // If pet has a tag, show replacement modal for user to select clinic and date
      setShowNfcModal(true)
    }
  }

  const handleReleaseFromConfinement = async () => {
    if (!pet || !token || !pet.isConfined) return

    setIsUpdatingConfinement(true)
    try {
      const response = await requestConfinementRelease(pet._id, token)
      if (response.status === 'SUCCESS') {
        toast('Release Requested', {
          description: `${pet.name}'s handling veterinarian has been notified to confirm discharge.`
        })
        await fetchPet()
      } else {
        toast('Error', { description: response.message || 'Failed to request release from confinement.' })
      }
    } catch {
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsUpdatingConfinement(false)
    }
  }

  const handleSubmitPetTagRequest = async () => {
    if (!pet || !token || !selectedBranch || !pickupDate) return
    setIsSubmittingRequest(true)
    try {
      // Find the clinic and branch details
      let branchName = ''
      for (const clinic of clinicBranches) {
        const branch = clinic.branches.find((b) => b._id === selectedBranch)
        if (branch) {
          branchName = branch.name
          break
        }
      }

      const response = await authenticatedFetch(
        `/pet-tag-requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            petId: pet._id,
            petName: pet.name,
            ownerId: pet.ownerId,
            ownerName: (pet.ownerId as PopulatedOwner)?.firstName || '',
            clinicBranchId: selectedBranch,
            clinicBranchName: branchName,
            reason: nfcReason,
            pickupDate: pickupDate,
            status: 'pending'
          }),
        },
        token
      )

      const data = response

      if (data.status === 'SUCCESS') {
        toast('Replacement Request Submitted', {
          description: 'Your clinic will process your replacement request shortly.'
        })
        setShowNfcModal(false)
        setNfcReason('')
        setSelectedBranch('')
        setPickupDate('')
        await fetchTagRequests() // Refresh the request history
      } else {
        toast('Error', { description: data.message || 'Failed to submit request' })
      }
    } catch (error) {
      console.error('Error submitting pet tag request:', error)
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const isRemoveTransfer = removeReason === 'transfer'
  const isRemovePassedAway = removeReason === 'passed-away'

  useEffect(() => {
    if (!showRemoveModal || !isRemoveTransfer) {
      setRemoveEmailSuggestions([])
      setIsRemoveTransferSearchOpen(false)
      setIsLoadingRemoveEmailSuggestions(false)
      return
    }
    const query = removeNewOwnerEmail.trim().toLowerCase()
    if (query.length < 2) {
      setRemoveEmailSuggestions([])
      setIsLoadingRemoveEmailSuggestions(false)
      return
    }
    if (removeTransferDebounceRef.current) clearTimeout(removeTransferDebounceRef.current)
    removeTransferDebounceRef.current = setTimeout(async () => {
      try {
        setIsLoadingRemoveEmailSuggestions(true)
        const response = await searchTransferOwnerEmails(query, token || undefined)
        setRemoveEmailSuggestions(response.status === 'SUCCESS' ? (response.data?.emails || []) : [])
      } catch {
        setRemoveEmailSuggestions([])
      } finally {
        setIsLoadingRemoveEmailSuggestions(false)
      }
    }, 300)
    return () => {
      if (removeTransferDebounceRef.current) clearTimeout(removeTransferDebounceRef.current)
    }
  }, [showRemoveModal, isRemoveTransfer, removeNewOwnerEmail, token])

  const resetRemoveForm = () => {
    setRemoveReason('')
    const now = new Date()
    setRemoveDeceasedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    setRemoveNewOwnerEmail('')
    setRemoveEmailSuggestions([])
    setIsRemoveTransferSearchOpen(false)
    setIsLoadingRemoveEmailSuggestions(false)
    setRemoveError('')
    setRemoveBillingBlocked(false)
  }

  const handleRemovePet = async () => {
    if (!removeReason) { setRemoveError('Please select a reason'); return }
    if (isRemoveTransfer && removeNewOwnerEmail.trim() && !removeNewOwnerEmail.includes('@')) { setRemoveError('Please enter a valid email address'); return }
    if (pet?.isLost) {
      setRemoveError(isRemoveTransfer
        ? 'Cannot transfer a pet marked as lost. Mark the pet as found first.'
        : 'Cannot mark a lost pet as deceased. Mark the pet as found first.')
      return
    }
    if (isRemovePassedAway && !removeDeceasedDate) { setRemoveError('Please select the date of death'); return }

    setRemoveLoading(true)
    setRemoveError('')
    try {
      if (!token || !pet) return
      if (isRemoveTransfer) {
        const response = await transferPet(pet._id, { newOwnerEmail: removeNewOwnerEmail.trim() || undefined }, token)
        if (response.status === 'BILLING_BLOCKED') { setRemoveBillingBlocked(true); setRemoveLoading(false); return }
        if (response.status === 'ERROR') { setRemoveError(response.message || 'Transfer failed'); setRemoveLoading(false); return }
        toast('Pet Transferred', { description: response.message || `${pet.name} has been transferred successfully.`, icon: <PawPrint className="w-4 h-4 text-[#7FA5A3]" /> })
      } else if (isRemovePassedAway) {
        const response = await markPetDeceased(pet._id, { deceasedAt: removeDeceasedDate }, token)
        if (response.status === 'ERROR') { setRemoveError(response.message || 'Unable to mark pet as deceased'); setRemoveLoading(false); return }
        toast('Pet Marked as Deceased', { description: `${pet.name} is now read-only and remains in dashboard history.`, icon: <Skull className="w-4 h-4 text-amber-700" /> })
      }
      resetRemoveForm()
      setShowRemoveModal(false)
      router.push('/my-pets')
    } catch {
      setRemoveError('Something went wrong. Please try again.')
    } finally {
      setRemoveLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 bg-gray-200 rounded" />
            <div className="bg-white rounded-2xl p-8 space-y-4">
              <div className="flex justify-center"><div className="w-28 h-28 bg-gray-200 rounded-full" /></div>
              <div className="h-6 w-48 bg-gray-200 rounded mx-auto" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!pet) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <button onClick={() => router.push('/my-pets')} className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to My Pets
          </button>
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-2">Pet not found</h2>
            <p className="text-gray-500">This pet may have been removed or you don&apos;t have access.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const sterilizationLabel = (() => {
    switch (pet.sterilization as string) {
      case 'spayed':
      case 'unspayed':
      case 'neutered':
      case 'unneutered':
        return pet.sterilization.charAt(0).toUpperCase() + pet.sterilization.slice(1)
      case 'unknown':
        return 'Unknown'
      // Handle legacy values
      case 'yes':
        return pet.sex === 'female' ? 'Spayed' : 'Neutered'
      case 'no':
        return pet.sex === 'female' ? 'Unspayed' : 'Unneutered'
      default:
        return 'Unknown'
    }
  })()

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Back button */}
        <button
          onClick={() => router.push('/my-pets')}
          className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Pets
        </button>

        <div className="flex gap-6 max-w-6xl mx-auto">
          {/* Main Profile Card */}
          <div className="flex-1 min-w-0">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header with photo */}
          <div className="bg-linear-to-br from-[#476B6B] to-[#5A8A8A] p-8 flex flex-col items-center relative">
            {/* Remove Pet button — left side */}
            {!editing && !isPetDeceased && (
              <div className="absolute top-4 left-4">
                <button
                  onClick={() => setShowRemoveModal(true)}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Pet
                </button>
              </div>
            )}

            {/* Edit / Save buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={cancelEditing}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-white text-[#476B6B] px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  {pet?.qrCode && (
                    <button
                      onClick={() => setShowQRCodeModal(true)}
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR Code
                    </button>
                  )}
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </>
              )}
            </div>

            {/* Pet Photo */}
            <div className="relative mb-4">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-white/20 flex items-center justify-center border-4 border-white/30">
                {hasProfilePhoto ? (
                  <Image
                    src={resolvedProfilePhoto!}
                    alt={pet.name}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <PawPrint className="w-12 h-12 text-white/60" />
                )}
              </div>
              {!hasProfilePhoto && (
                <button
                  onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors"
                >
                  <Camera className="w-4 h-4 text-[#476B6B]" />
                </button>
              )}
            </div>

            {/* Name */}
            {editing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl text-center bg-white/20 text-white border border-white/30 rounded-xl px-4 py-1 focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-white/50"
                style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
              />
            ) : (
              <h1
                className="text-2xl text-white"
                style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
              >
                {pet.name}
              </h1>
            )}
            <p className="text-white/70 text-sm mt-1">
              {pet.breed}{pet.secondaryBreed ? ` · ${pet.secondaryBreed}` : ''} | {pet.species}
            </p>
            {isPetDeceased && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-[#F5E6D8] border border-[#8B5E3C] text-[#8B5E3C] text-xs font-semibold px-3 py-1 rounded-full">
                <Cross className="w-3.5 h-3.5" />
                Passed Away — {deceasedDateLabel}
              </div>
            )}
          </div>

          {/* Photo upload area (toggled) */}
          {showPhotoUpload && (
            <div className="border-b border-gray-200 p-6 bg-[#F8F6F2]">
              <AvatarUpload
                className="w-full"
                maxSize={5 * 1024 * 1024}
                defaultAvatar={pet.photo || undefined}
                onFileChange={(file) => {
                  if (file?.file instanceof File) {
                    uploadImage(file.file, 'pets').then((url) => {
                      if (editing) {
                        setEditPhoto(url)
                      } else {
                        handlePhotoChange(url)
                      }
                    }).catch(console.error)
                  }
                }}
              >
                <div className="flex-1 pt-2">
                  <h3 className="font-semibold text-[#4F4F4F] mb-1">Change {pet.name}&apos;s Photo</h3>
                  <p className="text-sm text-gray-500">Upload a new photo. It will be saved {editing ? 'when you click Save.' : 'immediately.'}</p>
                </div>
              </AvatarUpload>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-8 px-6 lg:px-8">
              <button
                onClick={() => setActiveTab('basic')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                  activeTab === 'basic'
                    ? 'border-[#7FA5A3] text-[#476B6B]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Basic Pet Information
              </button>
              <button
                onClick={() => setActiveTab('medical-records')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                  activeTab === 'medical-records'
                    ? 'border-[#7FA5A3] text-[#476B6B]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Medical Records
              </button>
              <button
                onClick={() => setActiveTab('nfc')}
                className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
                  activeTab === 'nfc'
                    ? 'border-[#7FA5A3] text-[#476B6B]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Manage NFC
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 lg:p-8">
            {/* Basic Information Tab */}
            {activeTab === 'basic' && (
              <>
                {/* eHealth Card Quick-Access */}
                <button
                  onClick={() => router.push(`/my-pets/${petId}/vaccine-card`)}
                  className="w-full flex items-center justify-between bg-linear-to-br from-[#476B6B] to-[#5A8A8A] text-white rounded-2xl px-5 py-4 mb-6 hover:opacity-90 transition-opacity shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Vaccine Card</p>
                      <p className="text-white/80 text-xs">View vaccination card</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/70" />
                </button>

                {/* Basic Info Section */}
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {/* Species - read only */}
              <DetailField label="Species" value={pet.species.charAt(0).toUpperCase() + pet.species.slice(1)} />

              {/* Breed - read only */}
              <DetailField
                label="Breed"
                value={pet.breed + (pet.secondaryBreed ? ` × ${pet.secondaryBreed}` : '')}
              />

              {/* Sex - read only */}
              <DetailField label="Sex" value={pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)} />

              {/* Age - read only (derived from birthday) */}
              <DetailField label="Age" value={calculateAge(pet.dateOfBirth)} />

              {/* Birthday - read only */}
              <DetailField label="Date of Birth" value={formatDate(pet.dateOfBirth)} />

              {/* Weight - read only */}
              <DetailField label="Weight" value={`${pet.weight} kg`} />

              {/* Sterilization - read only */}
              <DetailField label="Sterilization" value={sterilizationLabel} />

              {/* Pregnancy Status - read only, female only */}
              {pet.sex === 'female' && (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pregnancy Status</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    pet.pregnancyStatus === 'pregnant'
                      ? 'bg-pink-100 text-pink-700 border border-pink-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {pet.pregnancyStatus === 'pregnant' ? 'Pregnant' : 'Not Pregnant'}
                  </span>
                </div>
              )}

              {/* Blood Type - read only */}
              <DetailField label="Blood Type" value={pet.bloodType || '-'} />

              {/* Microchip - editable */}
              {editing ? (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Microchip Number</p>
                  <input
                    type="text"
                    value={editMicrochip}
                    onChange={(e) => setEditMicrochip(e.target.value)}
                    placeholder="Enter microchip number"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              ) : (
                <DetailField label="Microchip Number" value={pet.microchipNumber || '-'} />
              )}

              {/* Owner Contact Number - read only */}
              <DetailField
                label="Owner Contact"
                value={typeof pet.ownerId === 'object' ? (pet.ownerId as PopulatedOwner).contactNumber || '-' : '-'}
              />

              {isPetDeceased && (
                <DetailField
                  label="Passed Away"
                  value={deceasedDateLabel}
                  highlight
                />
              )}
            </div>

            {/* Health Section */}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Health</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <DetailField label="Last Visit" value={healthMetrics.lastVisit} />
              <DetailField label="Next Visit" value={healthMetrics.nextVisit} />
              <DetailField label="Last SpO2" value={healthMetrics.lastSpo2} />

              <div className="bg-[#F8F6F2] rounded-xl p-4 sm:col-span-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Confinement Status</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className={`inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${
                    pet.isConfined
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {pet.isConfined ? 'Currently Confined' : 'Not Confined'}
                  </span>

                  {pet.isConfined && (
                    <button
                      onClick={handleReleaseFromConfinement}
                      disabled={isUpdatingConfinement}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#35785C] text-white hover:bg-[#2D6B52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdatingConfinement ? 'Releasing...' : 'Release from Confinement'}
                    </button>
                  )}
                </div>
              </div>

              {/* Allergies - editable */}
              {editing ? (
                <div className="bg-[#F8F6F2] rounded-xl p-4 sm:col-span-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Allergies</p>
                  <input
                    type="text"
                    value={editAllergies}
                    onChange={(e) => setEditAllergies(e.target.value)}
                    placeholder="Separate with commas (e.g. Pollen, Chicken)"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              ) : (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Allergies</p>
                  {pet.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pet.allergies.map((allergy) => (
                        <span key={allergy} className="bg-[#476B6B] text-white text-xs px-2.5 py-1 rounded-full">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-[#4F4F4F]">None</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes - editable */}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Notes</h3>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about your pet (markings, color, personality...)"
                rows={4}
                className="w-full bg-[#F8F6F2] border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
              />
            ) : (
              <div className="bg-[#F8F6F2] rounded-xl p-4">
                <p className="text-sm text-[#4F4F4F]">{pet.notes || 'No notes added.'}</p>
              </div>
            )}
              </>
            )}

            {/* Medical Records Tab */}
            {activeTab === 'medical-records' && (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Medical Records</h3>
                {medicalRecords.filter((record) => record.sharedWithOwner).length === 0 ? (
                  <div className="bg-[#F8F6F2] rounded-xl border border-gray-200 p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-500 mb-1">No medical records</h4>
                    <p className="text-sm text-gray-400">
                      Medical records shared by your veterinarian will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicalRecords.filter((record) => record.sharedWithOwner).map((record) => (
                      <button
                        key={record._id}
                        onClick={() => handleViewRecord(record._id)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-[#7FA5A3] hover:shadow-lg transition-all text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Stethoscope className="w-4 h-4 text-[#7FA5A3] shrink-0" />
                              <h4 className="font-semibold text-[#4F4F4F]">Medical Record</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
                                <span>{new Date(record.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide">Veterinarian</p>
                                <p className="text-sm text-[#4F4F4F]">
                                  Dr. {record.vetId?.firstName} {record.vetId?.lastName}
                                </p>
                              </div>
                            </div>
                            {record.clinicId && (
                              <p className="text-xs text-gray-500 mt-2">
                                {record.clinicId?.name}
                                {record.clinicBranchId?.name && ` — ${record.clinicBranchId.name}`}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Manage NFC Tab */}
            {activeTab === 'nfc' && (
              <>
                {/* NFC & ID Section */}
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Identification</h3>
                <div className="bg-[#F8F6F2] rounded-xl flex mb-4">
                  <div className="flex-1 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">NFC Tag ID</p>
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.nfcTagId || 'Not registered'}</p>
                  </div>
                  <div className="w-px bg-gray-300 my-3" />
                  <div className="flex-1 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Lost Status</p>
                    <p className={`text-sm font-bold ${pet.isLost ? 'text-[#900B09]' : 'text-[#4F4F4F]'}`}>
                      {pet.isLost ? 'Marked as Lost' : 'Safe'}
                    </p>
                  </div>
                </div>
                {pet.isLost && pet.lostReportedByStranger && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5 mb-8">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">Reported by a stranger:</span> This pet was marked as missing by a finder, not by you.
                      If your pet is safe, please update its status.
                    </p>
                  </div>
                )}

                {/* Scan Locations Map */}
                {pet.scanLocations && pet.scanLocations.length > 0 ? (
                  <div className="mb-8 flex gap-6 items-start">
                    {/* Left - Map */}
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Sighting Locations</h3>
                      <p className="text-xs text-gray-400 mb-3">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />
                        Red = most recent &nbsp;·&nbsp;
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1" />
                        Blue = earlier sightings
                      </p>
                      <div className="mb-2 h-150 rounded-lg overflow-hidden border border-gray-200">
                        <ScanLocationsMap locations={pet.scanLocations} petName={pet.name} />
                      </div>
                      {pet.lastScannedLat && pet.lastScannedLng && (
                        <a
                          href={`https://www.google.com/maps?q=${pet.lastScannedLat},${pet.lastScannedLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-[#7FA5A3] hover:text-[#6b8f8d] transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Open latest location in Google Maps
                        </a>
                      )}
                    </div>

                    {/* Right - Scan History List */}
                    <div className="w-80 shrink-0">
                      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col h-150 sticky top-6">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                          <h3 className="text-sm font-semibold text-[#4F4F4F]">Scan History</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {pet.scanLocations.length} sighting{pet.scanLocations.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col">
                          <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex-1">
                            <div className="p-3 space-y-3">
                            {[...pet.scanLocations]
                              .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
                              .map((scan, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between gap-2 bg-linear-to-r from-gray-50 to-white border border-gray-100 rounded-lg p-3 hover:border-[#7FA5A3] hover:shadow-md transition-all"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      {idx === 0 && (
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                                      )}
                                      {idx > 0 && (
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                                      )}
                                      <p className="text-xs font-semibold text-[#4F4F4F]">
                                        {idx === 0 ? 'Most Recent' : `Scan ${idx}`}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1">
                                      {new Date(scan.scannedAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                      })}
                                    </p>
                                    <div className="flex items-center gap-1 text-gray-600">
                                      <MapPin className="w-3.5 h-3.5 text-[#7FA5A3] shrink-0" />
                                      <p className="text-xs text-gray-500 truncate">
                                        {scan.lat.toFixed(4)}, {scan.lng.toFixed(4)}
                                      </p>
                                    </div>
                                  </div>
                                  <a
                                    href={`https://www.google.com/maps?q=${scan.lat},${scan.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in Google Maps"
                                    className="flex items-center justify-center w-8 h-8 text-[#7FA5A3] hover:text-[#6b8f8d] hover:bg-[#7FA5A3]/10 rounded-lg transition-all shrink-0 mt-0.5"
                                  >
                                    <MapPin className="w-4 h-4" />
                                  </a>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                ) : pet.lastScannedLat && pet.lastScannedLng ? (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Last Scanned Location</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Reported by a finder on {pet.lastScannedAt ? new Date(pet.lastScannedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'unknown date'}
                    </p>
                    <LastScannedMap
                      lat={pet.lastScannedLat}
                      lng={pet.lastScannedLng}
                      petName={pet.name}
                      scannedAt={pet.lastScannedAt ?? ''}
                    />
                    <a
                      href={`https://www.google.com/maps?q=${pet.lastScannedLat},${pet.lastScannedLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[#7FA5A3] hover:text-[#6b8f8d] transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Open in Google Maps
                    </a>
                  </div>
                ) : null}

                {/* Request Pet Tag Replacement & Mark as Lost Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4 mb-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <button
                          onClick={handleRequestNfcTag}
                          disabled={isSubmittingRequest || !hasRegisteredNfcTag || isPetDeceased}
                          className="px-6 py-2.5 bg-[#7FA5A3] text-white font-semibold rounded-lg hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPetDeceased ? 'Tag Request Disabled' : isSubmittingRequest ? 'Submitting...' : 'Request Replacement Pet Tag'}
                        </button>
                      </span>
                    </TooltipTrigger>
                    {!hasRegisteredNfcTag && (
                      <TooltipContent side="top" sideOffset={8}>
                        Register a pet tag first before requesting a replacement.
                      </TooltipContent>
                    )}
                    {isPetDeceased && (
                      <TooltipContent side="top" sideOffset={8}>
                        Deceased pets cannot request NFC tags.
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <button
                          onClick={openLostModal}
                          disabled={pet.isLost || !hasRegisteredNfcTag}
                          className="px-6 py-2.5 bg-[#900B09] text-white font-semibold rounded-lg hover:bg-[#7A0907] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Mark as Lost
                        </button>
                      </span>
                    </TooltipTrigger>
                    {!hasRegisteredNfcTag && (
                      <TooltipContent side="top" sideOffset={8}>
                        {lostPetLockedMessage}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>

                {/* Request History Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Request History</h3>
                  {tagRequests.length === 0 ? (
                    <div className="bg-[#F8F6F2] rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                      <Nfc className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-500 mb-1">No requests yet</h4>
                      <p className="text-sm text-gray-400">
                        You haven&apos;t requested any NFC tags for {pet.name} yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tagRequests.map((request) => (
                        <div key={request._id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-[#4F4F4F]">NFC Tag Request</h4>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                  request.status === 'pending'
                                    ? 'bg-blue-100 text-blue-700'
                                    : request.status === 'fulfilled'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                Requested: {new Date(request.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              {request.reason && (
                                <p className="text-xs text-gray-500">
                                  Reason: {request.reason.replace(/_/g, ' ')}
                                </p>
                              )}
                              {request.status === 'fulfilled' && request.fulfilledAt && (
                                <p className="text-xs text-green-600 mt-1">
                                  Fulfilled: {new Date(request.fulfilledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Pet Tag Replacement Request Modal */}
      <Dialog open={showNfcModal} onOpenChange={(open) => {
        setShowNfcModal(open)
        if (!open) {
          setNfcReason('')
          setNextAppointment(null)
          setSelectedBranch('')
          setPickupDate('')
          setShowClinicDropdown(false)
        }
      }}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Request Replacement Pet Tag for {pet?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Clinic Branch Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600">
                Select Pickup Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowClinicDropdown(!showClinicDropdown)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className={selectedBranch ? 'text-[#4F4F4F]' : 'text-gray-400'}>
                    {selectedBranch 
                      ? clinicBranches.flatMap(c => c.branches).find(b => b._id === selectedBranch)
                        ? `${clinicBranches.find(c => c.branches.find(b => b._id === selectedBranch))?.name} - ${clinicBranches.find(c => c.branches.find(b => b._id === selectedBranch))?.branches.find(b => b._id === selectedBranch)?.name}`
                        : 'Select a clinic branch...'
                      : 'Select a clinic branch...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showClinicDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showClinicDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <div className="max-h-60 overflow-y-auto">
                      {clinicBranches.map((clinic) =>
                        clinic.branches.map((branch) => (
                          <button
                            key={branch._id}
                            onClick={() => {
                              setSelectedBranch(branch._id)
                              setShowClinicDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors border-b border-gray-100 last:border-b-0 ${
                              selectedBranch === branch._id ? 'bg-[#E8F4F3] text-[#35785C] font-semibold' : 'text-[#4F4F4F]'
                            }`}
                          >
                            <div className="font-semibold">{clinic.name}</div>
                            <div className="text-xs text-gray-500">{branch.name}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {selectedBranch && (
                <div className="mt-2 p-3 bg-[#F8F6F2] rounded-lg">
                  {(() => {
                    for (const clinic of clinicBranches) {
                      const branch = clinic.branches.find((b) => b._id === selectedBranch)
                      if (branch) {
                        return (
                          <div className="text-sm">
                            <p className="font-semibold text-[#4F4F4F]">{clinic.name}</p>
                            <p className="text-xs text-gray-600">{branch.address}</p>
                          </div>
                        )
                      }
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Pickup Date */}
            <div className="space-y-2">
              <label htmlFor="pickup-date" className="text-sm font-semibold text-gray-600">
                Pickup Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={pickupDate}
                onChange={setPickupDate}
                minDate={new Date(Date.now() + 86400000)}
                allowFutureDates
                className="w-full"
              />
              <p className="text-xs text-gray-500">Select a date from tomorrow onwards</p>
            </div>

            {/* Reason for Replacement */}
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-semibold text-gray-600">
                Reason for Replacement <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    id="reason"
                    type="button"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] flex items-center justify-between"
                  >
                    <span className={nfcReason ? 'text-[#4F4F4F]' : 'text-gray-500'}>
                      {
                        {
                          '': 'Select a reason (optional)',
                          lost_replacement: 'Lost/Damaged Tag',
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
                    <DropdownMenuRadioItem value="lost_replacement">Lost/Damaged Tag</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="upgrade">Upgrade to New Tag</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="additional">Additional Tag</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="other">Other</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowNfcModal(false)
                setNfcReason('')
                setNextAppointment(null)
                setSelectedBranch('')
                setPickupDate('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPetTagRequest}
              disabled={isSubmittingRequest || !selectedBranch || !pickupDate}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Medical Record Modal */}
      <Dialog open={!!viewRecord || viewLoading} onOpenChange={(v) => { if (!v) setViewRecord(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
            </div>
          ) : viewRecord ? (
            <div>
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="text-xl">Medical Record</DialogTitle>
              </DialogHeader>
              
              <div className="mt-6 space-y-6">
                {/* Record Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Date of Examination</p>
                    <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                      {new Date(viewRecord.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Attending Veterinarian</p>
                    <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                      Dr. {viewRecord.vetId?.firstName} {viewRecord.vetId?.lastName}
                    </p>
                  </div>
                </div>

                {/* Clinic Info */}
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Clinic</p>
                  <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                    {viewRecord.clinicId?.name}
                    {viewRecord.clinicBranchId?.name && ` — ${viewRecord.clinicBranchId.name}`}
                  </p>
                  {viewRecord.clinicBranchId?.address && (
                    <p className="text-xs text-gray-500 mt-1">{viewRecord.clinicBranchId.address}</p>
                  )}
                </div>

                {/* Vitals */}
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F] mb-3">Physical Examination</p>
                  <div className="grid grid-cols-2 gap-3">
                    {viewRecord.vitals && Object.entries(viewRecord.vitals).map(([key, vital]: [string, VitalEntry]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase font-semibold">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-sm font-medium text-[#4F4F4F] mt-1">
                          {vital.value || vital.value === 0 ? vital.value : '—'}
                        </p>
                        {vital.notes && <p className="text-xs text-gray-500 mt-1">{vital.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall Observation */}
                {viewRecord.overallObservation && (
                  <div>
                    <p className="text-sm font-semibold text-[#4F4F4F] mb-2">Clinical Assessment</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 border border-gray-100 whitespace-pre-wrap">
                      {viewRecord.overallObservation}
                    </p>
                  </div>
                )}

                {/* Images */}
                {viewRecord.images && viewRecord.images.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#4F4F4F] mb-3">Diagnostic Images</p>
                    <div className="grid grid-cols-2 gap-3">
                      {viewRecord.images.map((img, idx) => (
                        <div key={img._id || idx} className="rounded-lg overflow-hidden border border-gray-200">
                          {img.url ? (
                            <Image
                              src={img.url}
                              alt={img.description || `Image ${idx + 1}`}
                              width={400}
                              height={160}
                              className="w-full h-40 object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                              <FileText className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                          {img.description && (
                            <p className="text-xs text-gray-500 px-3 py-2 bg-gray-50 border-t border-gray-100">
                              {img.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-8 border-t pt-4">
                <button
                  onClick={() => router.push(`/dashboard/medical-records/${viewRecord._id}`)}
                  className="px-6 py-2 bg-[#7FA5A3] text-white rounded-xl text-sm font-medium hover:bg-[#6b8f8d] transition-colors"
                >
                  View Full Report
                </button>
                <button
                  onClick={() => setViewRecord(null)}
                  className="px-6 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={showQRCodeModal} onOpenChange={setShowQRCodeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-[#4F4F4F]">{pet?.name}&apos;s Pet Profile QR Code</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            {pet?.qrCode && (
              <>
                <div className="bg-white p-4 rounded-lg border-2 border-[#74a3a7]/40 w-full max-w-xs">
                  <QRCodeSVG
                    value={`${window.location.origin}/pet/${pet._id}`}
                    size={256}
                    fgColor="#74a3a7"
                    bgColor="#FFFFFF"
                    level="M"
                    marginSize={2}
                    className="w-full h-auto"
                  />
                </div>

                <div className="text-center text-sm text-[#4F4F4F] w-full">
                  <p className="font-semibold mb-1">Scan to view pet profile</p>
                  <p className="text-xs">You can also open the profile directly using the button below.</p>
                </div>

                <div className="w-full pt-4">
                  <a
                    href={`${window.location.origin}/pet/${pet._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold text-center text-white bg-[#74a3a7] hover:bg-[#658f93] transition-colors"
                  >
                    Open Public Profile
                  </a>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Report Lost Pet Modal */}
      <Dialog open={showLostModal} onOpenChange={(open) => {
        setShowLostModal(open)
        if (!open) {
          setLostNameShown('')
          setLostContact('')
          setLostMessage('')
        }
      }}>
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
              This will mark {pet?.name} as lost and notify vets and nearby users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Pet display */}
            <div className="flex items-center gap-3 bg-[#F8F6F2] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/20 flex items-center justify-center overflow-hidden shrink-0">
                {pet?.photo ? (
                  <Image src={pet.photo} alt={pet?.name || ''} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <PawPrint className="w-5 h-5 text-[#7FA5A3]" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#4F4F4F] text-sm">{pet?.name}</p>
                <p className="text-xs text-gray-500">{pet?.breed}{pet?.secondaryBreed ? ` × ${pet.secondaryBreed}` : ''}</p>
              </div>
            </div>

            {/* Name Shown */}
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

            {/* Contact Number */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Contact Number
              </label>
              <input
                type="tel"
                value={lostContact}
                onChange={(e) => setLostContact(e.target.value)}
                placeholder="Your contact number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#900B09]/30"
              />
            </div>

            {/* Additional Message */}
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

            {/* Warning info */}
            <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#900B09] shrink-0 mt-0.5" />
              <p className="text-xs text-[#900B09]">
                Marking as lost will update your pet&apos;s NFC tag. Anyone who scans it will see a lost pet alert and can share their location with you.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <button
              onClick={() => setShowLostModal(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReportLost}
              disabled={isMarkingLost || !hasRegisteredNfcTag}
              className="flex-1 px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {isMarkingLost ? 'Marking...' : 'Mark as Lost & Update NFC Tag'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Pet Modal */}
      <Dialog open={showRemoveModal} onOpenChange={(v) => { if (!v) { resetRemoveForm(); setShowRemoveModal(false) } }}>
        <DialogContent className="max-w-lg w-[95vw] p-6">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-2xl text-[#900B09]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              Remove Pet
            </DialogTitle>
            <DialogDescription className="sr-only">
              Remove {pet?.name} from your profile
            </DialogDescription>
          </DialogHeader>

          {/* Billing blocked alert */}
          {removeBillingBlocked && (
            <div className="bg-amber-50 border border-amber-400 rounded-xl p-4 mb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Outstanding Bill</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This pet has an unpaid bill. Please settle the balance in Billing before removing or transferring them.
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          {!removeBillingBlocked && (
            <div className="bg-[#F4D3D2] border border-[#CC6462] rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-[#B71C1C] mb-2">This action cannot be undone</p>
              <p className="text-xs text-[#4F4F4F] leading-relaxed">
                This will permanently affect your pet&apos;s profile. Records are kept for veterinary reference. Marking as deceased is irreversible. Transferring ownership requires a settled bill.
              </p>
            </div>
          )}

          {/* Pet info */}
          <div className="w-full border border-gray-200 rounded-xl p-3 bg-white text-sm text-[#4F4F4F] mb-4">
            {pet?.name} &mdash; {pet?.breed}
          </div>

          {/* Reason Selection */}
          <div className="space-y-3 mb-4">
            <label className="text-sm font-semibold text-[#4F4F4F] block">Reason for Removal</label>
            {([{ value: 'passed-away', label: 'Pet passed away' }, { value: 'transfer', label: 'Transfer pet ownership' }] as const).map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setRemoveReason(r.value); setRemoveError('') }}
                className={`w-full flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-colors text-left ${
                  removeReason === r.value ? 'border-[#7FA5A3] bg-[#F8F6F2]' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${removeReason === r.value ? 'border-[#7FA5A3]' : 'border-gray-300'}`}>
                  {removeReason === r.value && <span className="w-2 h-2 rounded-full bg-[#7FA5A3]" />}
                </span>
                <span className="text-sm text-[#4F4F4F]">{r.label}</span>
              </button>
            ))}
          </div>

          {isRemoveTransfer && (
            <div className="mb-4 relative">
              <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">New Owner Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Search pet owner email..."
                  value={removeNewOwnerEmail}
                  onChange={(e) => { setRemoveNewOwnerEmail(e.target.value); setIsRemoveTransferSearchOpen(true); setRemoveError('') }}
                  onFocus={() => setIsRemoveTransferSearchOpen(true)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] transition-colors"
                />
                {isLoadingRemoveEmailSuggestions && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {isRemoveTransferSearchOpen && removeEmailSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                  {removeEmailSuggestions.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => { setRemoveNewOwnerEmail(email); setIsRemoveTransferSearchOpen(false); setRemoveError('') }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors text-[#4F4F4F]"
                    >
                      {email}
                    </button>
                  ))}
                </div>
              )}
              {isRemoveTransferSearchOpen && removeNewOwnerEmail.trim().length >= 2 && !isLoadingRemoveEmailSuggestions && removeEmailSuggestions.length === 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 px-4 py-3 text-sm text-gray-400">
                  No pet owners found
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Recipient must have an existing PawSync pet-owner account.</p>
            </div>
          )}

          {/* Date of Death */}
          {isRemovePassedAway && (
            <div className="mb-4">
              <label className="text-sm font-semibold text-[#4F4F4F] block mb-1.5">Date of Death</label>
              <DatePicker
                value={removeDeceasedDate}
                onChange={(value) => { setRemoveDeceasedDate(value); setRemoveError('') }}
                placeholder="MM/DD/YYYY"
                allowFutureDates={false}
              />
              <p className="text-xs text-gray-400 mt-1">Defaults to today. You may select an earlier date.</p>
            </div>
          )}

          {/* Error */}
          {removeError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-600">{removeError}</p>
            </div>
          )}

          {/* Confirm button */}
          <button
            disabled={removeLoading || removeBillingBlocked}
            className={`w-full font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
              isRemoveTransfer ? 'bg-[#476B6B] hover:bg-[#3a5a5a] text-white' : 'bg-[#900B09] hover:bg-[#7A0A08] text-white'
            }`}
            onClick={handleRemovePet}
          >
            {removeLoading ? 'Processing...' : isRemoveTransfer ? (
              <><PawPrint className="w-4 h-4" />Transfer {pet?.name}</>
            ) : (
              `Mark ${pet?.name} as Deceased`
            )}
          </button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#F8F6F2] rounded-xl p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-[#900B09]' : 'text-[#4F4F4F]'}`}>{value}</p>
    </div>
  )
}
