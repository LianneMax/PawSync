'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getPetById, updatePet, type Pet as APIPet } from '@/lib/pets'
import AvatarUpload from '@/components/avatar-upload'
import { ArrowLeft, PawPrint, Pencil, Check, X, Camera } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [activeTab, setActiveTab] = useState<'basic' | 'nfc'>('basic')
  const [showNfcModal, setShowNfcModal] = useState(false)
  const [nfcReason, setNfcReason] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editSex, setEditSex] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editMicrochip, setEditMicrochip] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editAllergies, setEditAllergies] = useState('')
  const [editPhoto, setEditPhoto] = useState<string | null>(null)

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

      if (Object.keys(updates).length === 0) {
        setEditing(false)
        setShowPhotoUpload(false)
        return
      }

      const response = await updatePet(petId, updates as Partial<APIPet>, token)
      if (response.status === 'SUCCESS') {
        toast('Pet Updated', { description: `${pet.name}'s profile has been updated.` })
        await fetchPet()
        setEditing(false)
        setShowPhotoUpload(false)
      } else {
        toast('Error', { description: response.message || 'Failed to update pet.' })
      }
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

  const handleSubmitPetTagRequest = async () => {
    if (!pet || !token) return
    setIsSubmittingRequest(true)
    try {
      // TODO: Replace with actual API call to submit pet tag replacement request
      toast('Pet Tag Replacement Request', {
        description: `Your request for a pet tag replacement${nfcReason ? ` (${nfcReason})` : ''} has been submitted.`
      })
      setShowNfcModal(false)
      setShowConfirmation(false)
      setNfcReason('')
    } catch {
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
          <div className="bg-gradient-to-br from-[#476B6B] to-[#5A8A8A] p-8 flex flex-col items-center relative">
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
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
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
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                  <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!pet.nfcTagId}
                    className="px-6 py-2.5 bg-[#7FA5A3] text-white font-semibold rounded-lg hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Request for Pet Tag Replacement
                  </button>
                  <button
                    onClick={handleMarkAsLost}
                    disabled={pet.isLost || isSubmittingRequest}
                    className="px-6 py-2.5 bg-[#900B09] text-white font-semibold rounded-lg hover:bg-[#7A0907] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingRequest ? 'Marking...' : 'Mark as Lost'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Pet Tag Replacement</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to request a pet tag replacement for <strong>{pet?.name}</strong>? Please provide a reason for the request in the next step.
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowConfirmation(false)
                setShowNfcModal(true)
              }}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors"
            >
              Continue
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pet Tag Replacement Request Reason Modal */}
      <Dialog open={showNfcModal} onOpenChange={setShowNfcModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Details for {pet?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-semibold text-gray-600">
                Reason for Request <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select
                id="reason"
                value={nfcReason}
                onChange={(e) => setNfcReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#4F4F4F] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              >
                <option value="">Select a reason (optional)</option>
                <option value="lost_replacement">Lost/Damaged Tag Replacement</option>
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
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPetTagRequest}
              disabled={isSubmittingRequest}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
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
