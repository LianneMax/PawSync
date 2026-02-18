'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet as APIPet } from '@/lib/pets'
import { getRecordsByPet, getRecordById, type MedicalRecord } from '@/lib/medicalRecords'
import { ArrowLeft, Search, FileText, Calendar, Stethoscope, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ==================== TYPES ====================

interface Pet {
  _id: string
  name: string
  species: string
  breed: string
  photo: string | null
  dateOfBirth: string
}

// ==================== HELPERS ====================

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
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== MAIN PAGE ====================

export default function MedicalRecordsPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Load pets
  const loadPets = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await getMyPets(token)
      if (res.status === 'SUCCESS' && res.data?.pets) {
        setPets(res.data.pets)
      }
    } catch (err) {
      console.error('Failed to load pets:', err)
      toast.error('Failed to load your pets')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPets()
  }, [loadPets])

  // Load records when pet selected
  const loadRecords = useCallback(
    async (petId: string) => {
      if (!token) return
      setLoadingRecords(true)
      try {
        const res = await getRecordsByPet(petId, token)
        if (res.status === 'SUCCESS' && res.data?.records) {
          setRecords(res.data.records)
        } else {
          setRecords([])
        }
      } catch (err) {
        console.error('Failed to load records:', err)
        toast.error('Failed to load medical records')
        setRecords([])
      } finally {
        setLoadingRecords(false)
      }
    },
    [token]
  )

  const handleSelectPet = (pet: Pet) => {
    setSelectedPet(pet)
    loadRecords(pet._id)
  }

  const handleBack = () => {
    setSelectedPet(null)
    setRecords([])
  }

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

  const filteredPets = pets.filter((p) => {
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.breed.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
        </div>
      </DashboardLayout>
    )
  }

  // List view - show pets
  if (!selectedPet) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[32px] font-bold text-[#476B6B] mb-2" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              My Medical Records
            </h1>
            <p className="text-gray-600 text-sm">View medical records shared by your veterinarians</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative inline-block">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent w-64"
              />
            </div>
          </div>

          {/* Pets Grid */}
          {filteredPets.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-1">No pets found</h3>
              <p className="text-sm text-gray-400">
                {searchQuery ? 'Try a different search' : 'You have no pets registered'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPets.map((pet) => (
                <button
                  key={pet._id}
                  onClick={() => handleSelectPet(pet)}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#7FA5A3] hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    {pet.photo ? (
                      <img
                        src={pet.photo}
                        alt={pet.name}
                        className="w-14 h-14 rounded-lg object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#7FA5A3] to-[#5A7C7A] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#4F4F4F] text-sm line-clamp-1">{pet.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {pet.species}
                        {pet.breed ? ` • ${pet.breed}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{calculateAge(pet.dateOfBirth)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  // Detail view - show records for selected pet
  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-[32px] font-bold text-[#476B6B]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              {selectedPet.name}'s Records
            </h1>
            <p className="text-gray-600 text-sm">
              {selectedPet.breed} • {calculateAge(selectedPet.dateOfBirth)} old
            </p>
          </div>
        </div>

        {/* Records List */}
        {loadingRecords ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No medical records</h3>
            <p className="text-sm text-gray-400">
              Medical records shared by your veterinarian will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <button
                key={record._id}
                onClick={() => handleViewRecord(record._id)}
                className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-[#7FA5A3] hover:shadow-lg transition-all text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Stethoscope className="w-4 h-4 text-[#7FA5A3] flex-shrink-0" />
                      <h3 className="font-semibold text-[#4F4F4F]">Medical Record</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        <span>{formatDate(record.createdAt)}</span>
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
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View Record Modal */}
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
                      {formatDate(viewRecord.createdAt)}
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
                        <p className="text-xs text-gray-500 uppercase font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
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
                  onClick={() => {
                    router.push(`/dashboard/medical-records/${viewRecord._id}`)
                  }}
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
    </DashboardLayout>
  )
}
