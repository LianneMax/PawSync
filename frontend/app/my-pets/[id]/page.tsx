'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getPetById, updatePet, togglePetLost, type Pet as APIPet } from '@/lib/pets'
import { updateProfile } from '@/lib/users'
import { getRecordsByPet, getRecordById, type MedicalRecord } from '@/lib/medicalRecords'
import { getAllClinicsWithBranches, type ClinicWithBranches } from '@/lib/clinics'
import { authenticatedFetch } from '@/lib/auth'
import AvatarUpload from '@/components/avatar-upload'
import { ArrowLeft, PawPrint, Pencil, Check, X, Camera, FileText, Calendar, Stethoscope, ChevronRight, QrCode, Nfc, ChevronDown, AlertTriangle, Phone, MessageSquare, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

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
  const [nextAppointment, setNextAppointment] = useState<any>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [clinicBranches, setClinicBranches] = useState<ClinicWithBranches[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [showQRCodeModal, setShowQRCodeModal] = useState(false)
  const [tagRequests, setTagRequests] = useState<any[]>([])
  const [loadingTagRequests, setLoadingTagRequests] = useState(false)
  const [showClinicDropdown, setShowClinicDropdown] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostNameShown, setLostNameShown] = useState('')
  const [lostContact, setLostContact] = useState('')
  const [lostMessage, setLostMessage] = useState('')
  const [isMarkingLost, setIsMarkingLost] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editSex, setEditSex] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editMicrochip, setEditMicrochip] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editAllergies, setEditAllergies] = useState('')
  const [editPhoto, setEditPhoto] = useState<string | null>(null)
  const [editOwnerContact, setEditOwnerContact] = useState('')

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
      if (res.status === 'SUCCESS' && res.data?.records) {
        setMedicalRecords(res.data.records)
      } else {
        setMedicalRecords([])
      }
    } catch (err) {
      console.error('Failed to load medical records:', err)
      setMedicalRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }, [token, petId])

  const fetchTagRequests = useCallback(async () => {
    if (!token || !petId) return
    setLoadingTagRequests(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await authenticatedFetch(
        `/nfc/clinic/all-requests`,
        { method: 'GET' },
        token
      )
      const data = response
      if (data.status === 'SUCCESS' && data.data?.requests) {
        const petRequests = data.data.requests.filter((req: any) => req.petId._id === petId)
        setTagRequests(petRequests)
      } else {
        setTagRequests([])
      }
    } catch (err) {
      console.error('Failed to load tag requests:', err)
      setTagRequests([])
    } finally {
      setLoadingTagRequests(false)
    }
  }, [token, petId])

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
      console.error('Failed to load record:', err)
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

  useEffect(() => {
    if (activeTab === 'nfc' && tagRequests.length === 0 && !loadingTagRequests) {
      fetchTagRequests()
    }
  }, [activeTab, tagRequests, loadingTagRequests, fetchTagRequests])

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
    setEditOwnerContact(typeof pet.ownerId === 'object' ? (pet.ownerId as any).contactNumber || '' : '')
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
      if (editSex && editSex !== pet.sex) updates.sex = editSex
      if (editWeight && parseFloat(editWeight) !== pet.weight) updates.weight = parseFloat(editWeight)
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

      // Check if owner contact number changed
      const currentOwnerContact = typeof pet.ownerId === 'object' ? (pet.ownerId as any).contactNumber : ''
      const contactNumberChanged = editOwnerContact.trim() !== (currentOwnerContact || '')

      if (Object.keys(updates).length === 0 && !contactNumberChanged) {
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

      // Update user contact number if it changed
      if (contactNumberChanged) {
        const profileResponse = await updateProfile(
          { contactNumber: editOwnerContact.trim() },
          token
        )
        if (profileResponse.status !== 'SUCCESS') {
          toast('Error', { description: profileResponse.message || 'Failed to update contact number.' })
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

  const handleMarkAsLost = async () => {
    if (!pet || !token) return
    setIsSubmittingRequest(true)
    try {
      const response = await updatePet(petId, { isLost: true } as Partial<APIPet>, token)
      if (response.status === 'SUCCESS') {
        toast('Pet Marked as Lost', { description: `${pet.name} has been marked as lost. Vets will be notified.` })
        await fetchPet()
      } else {
        toast('Error', { description: response.message || 'Failed to mark pet as lost.' })
      }
    } catch {
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const openLostModal = () => {
    if (!pet) return
    setLostNameShown(pet.name)
    setLostContact(typeof pet.ownerId === 'object' ? (pet.ownerId as any).contactNumber || '' : '')
    setLostMessage('')
    setShowLostModal(true)
  }

  const handleReportLost = async () => {
    if (!pet || !token) return
    setIsMarkingLost(true)
    try {
      const response = await togglePetLost(pet._id, true, token)
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

  const fetchNextAppointment = async () => {
    if (!pet || !token) return
    try {
      const response = await authenticatedFetch(
        `/appointments/pet/${pet._id}/next`,
        { method: 'GET' },
        token
      )
      const data = response

      if (data.data?.appointment) {
        setNextAppointment(data.data.appointment)
        // Auto-fill pickup date from appointment date
        const appointmentDate = new Date(data.data.appointment.date)
        setPickupDate(appointmentDate.toISOString().split('T')[0])
        setSelectedBranch(data.data.appointment.clinicBranchId?._id || '')
      }
    } catch (error) {
      console.error('Error fetching next appointment:', error)
    }
  }

  const handleSubmitPetTagRequest = async () => {
    if (!pet || !token || !selectedBranch || !pickupDate) return
    setIsSubmittingRequest(true)
    try {
      // Find the clinic and branch details
      let clinicName = ''
      let branchName = ''
      for (const clinic of clinicBranches) {
        const branch = clinic.branches.find((b) => b._id === selectedBranch)
        if (branch) {
          clinicName = clinic.name
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
            ownerName: (pet.ownerId as any)?.firstName || '',
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

  const sterilizationLabel = pet.sterilization === 'yes' ? 'Neutered' : pet.sterilization === 'no' ? 'Unneutered' : 'Unknown'

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        {/* Back button */}
        <button
          onClick={() => router.push('/my-pets')}
          className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Pets
        </button>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header with photo */}
          <div className="bg-linear-to-br from-[#476B6B] to-[#5A8A8A] p-8 flex flex-col items-center relative">
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
                {(editPhoto || pet.photo) ? (
                  <Image
                    src={editPhoto || pet.photo!}
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
              {/* Change photo button */}
              <button
                onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors"
              >
                <Camera className="w-4 h-4 text-[#476B6B]" />
              </button>
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
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      const base64 = reader.result as string
                      if (editing) {
                        setEditPhoto(base64)
                      } else {
                        handlePhotoChange(base64)
                      }
                    }
                    reader.readAsDataURL(file.file)
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

              {/* Sex - editable */}
              {editing ? (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Sex</p>
                  <select
                    value={editSex}
                    onChange={(e) => setEditSex(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              ) : (
                <DetailField label="Sex" value={pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)} />
              )}

              {/* Age - read only (derived from birthday) */}
              <DetailField label="Age" value={calculateAge(pet.dateOfBirth)} />

              {/* Birthday - read only */}
              <DetailField label="Date of Birth" value={formatDate(pet.dateOfBirth)} />

              {/* Weight - editable */}
              {editing ? (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Weight (kg)</p>
                  <input
                    type="number"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              ) : (
                <DetailField label="Weight" value={`${pet.weight} kg`} />
              )}

              {/* Sterilization - read only */}
              <DetailField label="Sterilization" value={sterilizationLabel} />

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

              {/* Owner Contact Number - editable */}
              {editing ? (
                <div className="bg-[#F8F6F2] rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Owner Contact</p>
                  <input
                    type="tel"
                    value={editOwnerContact}
                    onChange={(e) => setEditOwnerContact(e.target.value)}
                    placeholder="Enter contact number"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>
              ) : (
                <DetailField 
                  label="Owner Contact" 
                  value={typeof pet.ownerId === 'object' ? (pet.ownerId as any).contactNumber || '-' : '-'} 
                />
              )}
            </div>

            {/* Health Section */}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Health</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <DetailField label="Last Visit" value="-" />
              <DetailField label="Next Visit" value="-" />
              <DetailField label="SpO2" value="-" />

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
                {medicalRecords.length === 0 ? (
                  <div className="bg-[#F8F6F2] rounded-xl border border-gray-200 p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-gray-500 mb-1">No medical records</h4>
                    <p className="text-sm text-gray-400">
                      Medical records shared by your veterinarian will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicalRecords.map((record) => (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <DetailField label="NFC Tag ID" value={pet.nfcTagId || 'Not registered'} />
                  <DetailField label="Lost Status" value={pet.isLost ? 'Marked as Lost' : 'Safe'} highlight={pet.isLost} />
                </div>

                {/* Request Pet Tag Replacement & Mark as Lost Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 mb-8">
                  <button
                    onClick={handleRequestNfcTag}
                    disabled={isSubmittingRequest || !pet.nfcTagId}
                    className="px-6 py-2.5 bg-[#7FA5A3] text-white font-semibold rounded-lg hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingRequest ? 'Submitting...' : 'Request Replacement Pet Tag'}
                  </button>
                  <button
                    onClick={openLostModal}
                    disabled={pet.isLost}
                    className="px-6 py-2.5 bg-[#900B09] text-white font-semibold rounded-lg hover:bg-[#7A0907] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark as Lost
                  </button>
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
              <input
                id="pickup-date"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
              <p className="text-xs text-gray-500">Select a date from tomorrow onwards</p>
            </div>

            {/* Reason for Replacement */}
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-semibold text-gray-600">
                Reason for Replacement <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select
                id="reason"
                value={nfcReason}
                onChange={(e) => setNfcReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              >
                <option value="">Select a reason (optional)</option>
                <option value="lost_replacement">Lost/Damaged Tag</option>
                <option value="upgrade">Upgrade to New Tag</option>
                <option value="additional">Additional Tag</option>
                <option value="other">Other</option>
              </select>
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
                    {viewRecord.vitals && Object.entries(viewRecord.vitals).map(([key, vital]: [string, any]) => (
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
                          {img.data ? (
                            <img
                              src={`data:${img.contentType};base64,${img.data}`}
                              alt={img.description || `Image ${idx + 1}`}
                              className="w-full h-40 object-cover"
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
            <DialogTitle className="text-center">{pet?.name}'s Pet Profile QR Code</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            {pet?.qrCode && (
              <>
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 w-full max-w-xs">
                  <img
                    src={pet.qrCode}
                    alt={`QR code for ${pet.name}`}
                    className="w-full"
                  />
                </div>

                <div className="text-center text-sm text-gray-600 w-full">
                  <p className="font-semibold text-gray-800 mb-2">Scan to view pet profile:</p>
                  <p className="text-xs text-gray-500 break-all">
                    {window.location.origin}/pet/{pet._id}
                  </p>
                </div>

                <div className="w-full flex gap-3 pt-4">
                  <button
                    onClick={() => setShowQRCodeModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
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
                  <img src={pet.photo} alt={pet?.name} className="w-full h-full object-cover" />
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
              disabled={isMarkingLost}
              className="flex-1 px-4 py-2 bg-[#900B09] text-white rounded-xl text-sm font-semibold hover:bg-[#7A0907] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {isMarkingLost ? 'Marking...' : 'Mark as Lost & Update NFC Tag'}
            </button>
          </DialogFooter>
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
