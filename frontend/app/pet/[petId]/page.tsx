'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, Phone, MapPin, Mail, Heart, Calendar, QrCode, X, Nfc, Loader } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'

interface Pet {
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
  microchipNumber?: string
  sterilization?: string
  notes?: string
  qrCode?: string
  nfcTagId?: string
}

interface Owner {
  _id: string
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  address?: string
}

interface MedicalRecord {
  _id: string
  recordType: string
  description: string
  dateOfRecord: string
  notes?: string
}

export default function PetProfilePage() {
  const params = useParams()
  const petId = params.petId as string
  const token = useAuthStore((state) => state.token)

  const [pet, setPet] = useState<Pet | null>(null)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQRCode, setShowQRCode] = useState(false)
  const [showNfcRequestModal, setShowNfcRequestModal] = useState(false)
  const [nfcReason, setNfcReason] = useState('')
  const [isSubmittingNfcRequest, setIsSubmittingNfcRequest] = useState(false)

  useEffect(() => {
    const fetchPetProfile = async () => {
      try {
        setLoading(true)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        
        // Fetch pet data
        const petRes = await fetch(`${apiUrl}/pets/${petId}`)
        if (!petRes.ok) {
          throw new Error('Pet not found')
        }
        const petData = await petRes.json()
        setPet(petData)

        // Fetch owner data
        const ownerRes = await fetch(`${apiUrl}/users/${petData.ownerId}`)
        if (ownerRes.ok) {
          const ownerData = await ownerRes.json()
          setOwner(ownerData)
        }

        // Fetch medical records
        const recordsRes = await fetch(`${apiUrl}/medical-records/pet/${petId}`)
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json()
          setMedicalRecords(Array.isArray(recordsData) ? recordsData : recordsData.records || [])
        }

        setError(null)
      } catch (err) {
        console.error('Error fetching pet profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pet profile')
      } finally {
        setLoading(false)
      }
    }

    if (petId) {
      fetchPetProfile()
    }
  }, [petId])

  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age > 0 ? `${age} year${age !== 1 ? 's' : ''}` : 'Less than 1 year'
  }

  const handleSubmitNfcRequest = async () => {
    if (!pet || !token) {
      toast('Error', { description: 'Please sign in to request an NFC tag' })
      return
    }

    setIsSubmittingNfcRequest(true)
    try {
      const response = await authenticatedFetch(
        `/nfc/pet/${pet._id}/request-tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: nfcReason }),
        },
        token
      )

      const data = response

      if (data.status === 'SUCCESS') {
        toast('NFC Tag Request Submitted', {
          description: 'Your clinic will process your request and write the tag soon.'
        })
        setShowNfcRequestModal(false)
        setNfcReason('')
      } else {
        toast('Error', { description: data.message || 'Failed to submit request' })
      }
    } catch (error) {
      console.error('Error submitting NFC request:', error)
      toast('Error', { description: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmittingNfcRequest(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5A7C7A] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pet profile...</p>
        </div>
      </div>
    )
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-center mb-2">Pet Not Found</h1>
          <p className="text-gray-600 text-center">{error || 'This pet profile could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pet Photo Header */}
      <div className="bg-[#5A7C7A] h-48 flex items-center justify-center relative">
        {pet.photo ? (
          <Image
            src={pet.photo}
            alt={pet.name}
            width={200}
            height={200}
            className="w-40 h-40 rounded-full object-cover border-4 border-white"
          />
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-400 border-4 border-white flex items-center justify-center">
            <Heart className="w-16 h-16 text-white opacity-50" />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Pet Name and Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 -mt-20 relative z-10">
          <div className="flex justify-between items-start mb-4 gap-3">
            <h1 className="text-3xl font-bold text-gray-800">{pet.name}</h1>
            <div className="flex gap-2">
              {pet.qrCode && (
                <button
                  onClick={() => setShowQRCode(true)}
                  className="bg-[#476B6B] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#3f5959] transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  Show QR
                </button>
              )}
              {token && (
                <button
                  onClick={() => setShowNfcRequestModal(true)}
                  className={`text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    pet.nfcTagId
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-[#7FA5A3] hover:bg-[#6B8E8C]'
                  }`}
                >
                  <Nfc className="w-4 h-4" />
                  {pet.nfcTagId ? 'Request Tag Replacement' : 'Request NFC Tag'}
                </button>
              )}
              {pet.isLost && (
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-red-700">
                  <AlertCircle className="w-4 h-4" />
                  Report Missing
                </button>
              )}
            </div>
          </div>

          {/* Basic Info Chips */}
          <div className="flex gap-3 flex-wrap mb-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <p className="text-xs text-orange-600 font-semibold">SPECIES</p>
              <p className="text-lg font-bold text-gray-800 capitalize">{pet.species}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <p className="text-xs text-blue-600 font-semibold">GENDER</p>
              <p className="text-lg font-bold text-gray-800 capitalize">{pet.sex}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
              <p className="text-xs text-yellow-600 font-semibold">AGE</p>
              <p className="text-lg font-bold text-gray-800">{calculateAge(pet.dateOfBirth)}</p>
            </div>
          </div>

          {/* Breed and Weight */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">BREED</p>
              <p className="text-gray-800 font-semibold">
                {pet.breed}{pet.secondaryBreed && ` & ${pet.secondaryBreed}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">WEIGHT</p>
              <p className="text-gray-800 font-semibold">{pet.weight} KG</p>
            </div>
            {pet.microchipNumber && (
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">MICROCHIP</p>
                <p className="text-gray-800 font-semibold text-sm">{pet.microchipNumber}</p>
              </div>
            )}
            {pet.sterilization && (
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">STERILIZATION</p>
                <p className="text-gray-800 font-semibold capitalize">{pet.sterilization}</p>
              </div>
            )}
          </div>

          {/* Allergies */}
          {pet.allergies && pet.allergies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Known Allergies</h3>
              <div className="flex gap-2 flex-wrap">
                {pet.allergies.map((allergy, idx) => (
                  <span key={idx} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {pet.notes && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-bold text-gray-600 mb-2">NOTES</h3>
              <p className="text-gray-800">{pet.notes}</p>
            </div>
          )}
        </div>

        {/* Medical Records */}
        {medicalRecords.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#5A7C7A]" />
              Medical Records
            </h2>
            <div className="space-y-3">
              {medicalRecords.map((record) => (
                <div key={record._id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-gray-800">{record.recordType}</h4>
                    <span className="text-sm text-gray-500">
                      {new Date(record.dateOfRecord).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">{record.description}</p>
                  {record.notes && <p className="text-gray-500 text-xs mt-2">{record.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owner Information */}
        {owner && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Owner Information</h2>
            <div className="bg-gradient-to-r from-[#5A7C7A] to-[#476B6B] rounded-lg p-6 text-white">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  <Heart className="w-8 h-8 text-[#5A7C7A]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{owner.firstName} {owner.lastName}</h3>
                  {owner.address && (
                    <p className="text-gray-100 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {owner.address}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 bg-white bg-opacity-10 rounded-lg p-4">
                <a 
                  href={`tel:${owner.mobileNumber}`}
                  className="flex items-center gap-3 text-white hover:text-gray-200 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  <span>{owner.mobileNumber}</span>
                </a>
                <a 
                  href={`mailto:${owner.email}`}
                  className="flex items-center gap-3 text-white hover:text-gray-200 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <span>{owner.email}</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {medicalRecords.length === 0 && !owner && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            <p>Limited information available for this pet.</p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRCode && pet?.qrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-8 relative">
            <button
              onClick={() => setShowQRCode(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="text-center">
              <QrCode className="w-12 h-12 text-[#476B6B] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{pet.name}&apos;s Pet Profile</h3>
              <p className="text-sm text-gray-600 mb-6">
                Scan this QR code to view {pet.name}'s public pet profile
              </p>

              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-6">
                <img
                  src={pet.qrCode}
                  alt={`QR code for ${pet.name}`}
                  className="w-full"
                />
              </div>

              <p className="text-xs text-gray-500 mb-4">
                This QR code links to: {window.location.origin}/pet/{pet._id}
              </p>

              <button
                onClick={() => setShowQRCode(false)}
                className="w-full py-2 bg-[#476B6B] text-white rounded-lg font-semibold hover:bg-[#3f5959] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NFC Request Modal */}
      <Dialog open={showNfcRequestModal} onOpenChange={setShowNfcRequestModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request NFC Tag for {pet?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="nfc-reason" className="text-sm font-semibold text-gray-600">
                Reason for Request <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select
                id="nfc-reason"
                value={nfcReason}
                onChange={(e) => setNfcReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
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
                setShowNfcRequestModal(false)
                setNfcReason('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitNfcRequest}
              disabled={isSubmittingNfcRequest}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
