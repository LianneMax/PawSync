'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet as APIPet } from '@/lib/pets'
import { Plus, PawPrint, Search, AlertTriangle, Nfc } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { getAllClinicsWithBranches, type ClinicBranch } from '@/lib/clinics'
import { toast } from 'sonner'

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

export default function MyPetsPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const [pets, setPets] = useState<APIPet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedClinic, setSelectedClinic] = useState('')
  const [selectedPickupDate, setSelectedPickupDate] = useState('')
  const [clinicBranches, setClinicBranches] = useState<ClinicBranch[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)

  const fetchPets = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const response = await getMyPets(token)
      if (response.status === 'SUCCESS' && response.data?.pets) {
        setPets(response.data.pets)
      }
    } catch (error) {
      console.error('Failed to fetch pets:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  // Fetch clinic branches for pet tag pickup selection
  useEffect(() => {
    const fetchClinicBranches = async () => {
      setLoadingClinics(true)
      try {
        const response = await getAllClinicsWithBranches()
        if (response.status === 'SUCCESS' && response.data?.clinics) {
          // Flatten all branches from all clinics
          const allBranches = response.data.clinics.flatMap((clinic) =>
            clinic.branches.map((branch) => ({
              ...branch,
              clinicName: clinic.name,
            }))
          )
          setClinicBranches(allBranches)
        }
      } catch (error) {
        console.error('Failed to fetch clinic branches:', error)
      } finally {
        setLoadingClinics(false)
      }
    }

    fetchClinicBranches()
  }, [])

  const filteredPets = pets.filter((pet) =>
    pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pet.breed.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="relative inline-block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search pets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent w-48"
            />
          </div>
        </div>

        {/* Pet Count */}
        <div className="mb-6">
          <h1
            className="text-[32px] text-[#476B6B]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            My Pets
          </h1>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Loading...'
              : `You have ${pets.length} pet${pets.length !== 1 ? 's' : ''} registered under your account`}
          </p>
        </div>

        {/* Pet Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 h-[280px] animate-pulse">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full mb-3" />
                  <div className="h-5 w-24 bg-gray-200 rounded mb-1" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPets.map((pet) => (
              <div
                key={pet._id}
                className={`bg-white rounded-2xl p-6 relative ${
                  pet.isLost
                    ? 'border-2 border-[#E8A838] shadow-[0_0_0_1px_rgba(232,168,56,0.2)]'
                    : 'border border-gray-200'
                }`}
              >
                {/* Lost badge */}
                {pet.isLost && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFF3E0] border border-[#E8A838] text-[#B7791F] text-[10px] font-semibold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap z-10">
                    <AlertTriangle className="w-3 h-3" />
                    Marked as Lost
                  </div>
                )}

                {/* Pet Photo + Info */}
                <div className="flex flex-col items-center mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-3">
                    {pet.photo ? (
                      <Image
                        src={pet.photo}
                        alt={pet.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <PawPrint className="w-7 h-7 text-gray-300" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#4F4F4F]">{pet.name}</h3>
                  <p className="text-sm text-gray-500">
                    {pet.breed.charAt(0).toUpperCase() + pet.breed.slice(1)}
                    {pet.secondaryBreed ? ` · ${pet.secondaryBreed}` : ''}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#F8F6F2] rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Age</p>
                    <p className="text-sm font-bold text-[#4F4F4F]">{calculateAge(pet.dateOfBirth)}</p>
                  </div>
                  <div className="bg-[#F8F6F2] rounded-xl px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Weight</p>
                    <p className="text-sm font-bold text-[#4F4F4F]">{pet.weight} kg</p>
                  </div>
                </div>

                <div className="bg-[#F8F6F2] rounded-xl px-3 py-2 mb-5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last Checkup</p>
                  <p className="text-sm font-bold text-[#4F4F4F]">-</p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => router.push(`/my-pets/${pet._id}`)}
                    className={`text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                      pet.isLost
                        ? 'bg-[#E8A838] text-white hover:bg-[#D4962F]'
                        : 'bg-[#7FA5A3] text-white hover:bg-[#6b9391]'
                    }`}
                  >
                    <PawPrint className="w-3.5 h-3.5" />
                    View Profile
                  </button>
                  {!pet.nfcTagId ? (
                    <button
                      onClick={() => {
                        setSelectedPetId(pet._id)
                        setShowConfirmation(true)
                      }}
                      className="text-sm font-semibold py-2.5 rounded-xl border border-[#7FA5A3] text-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Nfc className="w-3.5 h-3.5" />
                      Request Pet Tag
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/my-pets/${pet._id}`)}
                      className="text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Nfc className="w-3.5 h-3.5" />
                      <span>Registered</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add New Pet Card */}
            <div
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors min-h-[280px]"
              onClick={() => router.push('/onboarding/pet?from=dashboard')}
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Plus className="w-7 h-7 text-gray-400" />
              </div>
              <p className="font-semibold text-[#4F4F4F]">Add New Pet</p>
              <p className="text-xs text-gray-400 mt-1 text-center">Register a new pet to start tracking their health</p>
            </div>
          </div>
        ) : pets.length > 0 ? (
          /* Search returned no results */
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#4F4F4F] mb-2">No pets found</h2>
            <p className="text-gray-500">No pets match &quot;{searchQuery}&quot;. Try a different search.</p>
          </div>
        ) : (
          /* Empty state - no pets at all */
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
            <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#4F4F4F] mb-2">No pets yet</h2>
            <p className="text-gray-500 mb-6">
              Start by adding your first pet to track their health records and appointments.
            </p>
            <button
              onClick={() => router.push('/onboarding/pet')}
              className="bg-[#7FA5A3] text-white px-8 py-3 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Pet
            </button>
          </div>
        )}
      </div>

      {/* Pet Tag Request Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Pet Tag for {selectedPetId && pets.find(p => p._id === selectedPetId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Clinic Selection */}
            <div className="space-y-2">
              <label htmlFor="clinic" className="text-sm font-semibold text-gray-700">
                Select Pickup Clinic
              </label>
              <select
                id="clinic"
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
                disabled={loadingClinics}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">{loadingClinics ? '-- Loading clinics --' : '-- Select a clinic branch --'}</option>
                {clinicBranches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <label htmlFor="pickup-date" className="text-sm font-semibold text-gray-700">
                Select Pickup Date
              </label>
              <DatePicker
                value={selectedPickupDate}
                onChange={setSelectedPickupDate}
                placeholder="MM/DD/YYYY"
              />
            </div>

            {/* Selected clinic details */}
            {selectedClinic && (
              <div className="bg-[#F8F6F2] rounded-lg p-3 text-sm">
                <p className="text-gray-700">
                  <strong>Branch:</strong> {clinicBranches.find(c => c._id === selectedClinic)?.name}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {clinicBranches.find(c => c._id === selectedClinic)?.address}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowConfirmation(false)
                setSelectedClinic('')
                setSelectedPickupDate('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedPetId && selectedClinic && selectedPickupDate) {
                  const selectedBranch = clinicBranches.find(c => c._id === selectedClinic)
                  toast('Pet Tag Request Submitted', {
                    description: `Your request has been submitted. Pickup at ${selectedBranch?.name} on ${new Date(selectedPickupDate).toLocaleDateString()}.`
                  })
                  setShowConfirmation(false)
                  setSelectedClinic('')
                  setSelectedPickupDate('')
                  setSelectedPetId(null)
                } else {
                  toast('Please fill in all fields', {
                    description: 'Select a clinic branch and pickup date to continue.'
                  })
                }
              }}
              disabled={isSubmitting || !selectedClinic || !selectedPickupDate}
              className="px-4 py-2 bg-[#7FA5A3] text-white rounded-lg text-sm font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Request Tag'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
