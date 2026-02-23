'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { getClinicPatients, type ClinicPatient } from '@/lib/clinics'
import { authenticatedFetch } from '@/lib/auth'
import { Smartphone, Search, FileText, Calendar, PawPrint, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface Clinic {
  _id: string;
  name: string;
}

export default function PatientManagementPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [patients, setPatients] = useState<ClinicPatient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<ClinicPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'dog' | 'cat'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const isBranchAdmin = user?.userType === 'branch-admin'

  // Fetch clinics for the admin
  const fetchClinics = useCallback(async () => {
    if (!token) return
    try {
      const response = await authenticatedFetch('/clinics/mine', { method: 'GET' }, token)
      if (response.status === 'SUCCESS' && response.data?.clinics.length > 0) {
        setClinics(response.data.clinics)
        // For branch admins, automatically set the clinic ID without showing dropdown
        // For clinic admins, default to first clinic
        const clinicId = response.data.clinics[0]._id
        setSelectedClinicId(clinicId)
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error)
      toast.error('Failed to fetch clinics')
    }
  }, [token])

  // Fetch patients for the selected clinic
  const fetchPatients = useCallback(async (clinicId: string) => {
    if (!token || !clinicId) return
    setLoading(true)
    try {
      const response = await getClinicPatients(clinicId, token)
      if (response.status === 'SUCCESS' && response.data?.patients) {
        setPatients(response.data.patients)
        setFilteredPatients(response.data.patients)
      } else {
        setPatients([])
        setFilteredPatients([])
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error)
      toast.error('Failed to fetch patients')
      setPatients([])
      setFilteredPatients([])
    } finally {
      setLoading(false)
    }
  }, [token])

  // Apply filters to patients
  const applyFilters = (data: ClinicPatient[], species: string, query: string) => {
    let filtered = data

    // Filter by species
    if (species !== 'all') {
      filtered = filtered.filter((p) => p.species === species)
    }

    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.owner.firstName.toLowerCase().includes(q) ||
          p.owner.lastName.toLowerCase().includes(q) ||
          p.owner.contactNumber.includes(q) ||
          p.microchipNumber?.includes(q)
      )
    }

    setFilteredPatients(filtered)
  }

  // Handle species filter change
  const handleSpeciesChange = (species: 'all' | 'dog' | 'cat') => {
    setSpeciesFilter(species)
    applyFilters(patients, species, searchQuery)
  }

  // Handle search input
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(patients, speciesFilter, query)
  }

  // Load clinics on mount
  useEffect(() => {
    fetchClinics()
  }, [fetchClinics])

  // Load patients when clinic changes
  useEffect(() => {
    if (selectedClinicId) {
      fetchPatients(selectedClinicId)
    }
  }, [selectedClinicId, fetchPatients])

  // Apply filters when patients, species filter, or search query changes
  useEffect(() => {
    applyFilters(patients, speciesFilter, searchQuery)
  }, [patients, speciesFilter, searchQuery])

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#4F4F4F] mb-2">Patient Management</h1>
          <p className="text-gray-500">Stay on top of your patients&apos; care</p>
        </div>

        {/* Search Patient Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-[#7FA5A3]" />
              <h2 className="text-lg font-semibold text-[#4F4F4F]">Search Patient</h2>
            </div>
            <button className="flex items-center gap-2 bg-[#7FA5A3] hover:bg-[#6B8E8C] text-white px-4 py-2 rounded-lg text-sm transition-colors">
              <Smartphone className="w-4 h-4" />
              Scan Pet Tag
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Enter a Client Name, Patients Name or ID Tag"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
            />
          </div>
        </div>

        {/* Species Filter & Actions */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex gap-3">
            <span className="text-sm font-semibold text-gray-600 self-center">Select Species:</span>
            {(['all', 'dog', 'cat'] as const).map((species) => (
              <button
                key={species}
                onClick={() => handleSpeciesChange(species)}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                  speciesFilter === species
                    ? 'bg-[#7FA5A3] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {species === 'all' ? 'All' : species === 'dog' ? 'Dogs' : 'Cats'}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Search className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Patients List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">No patients found</h3>
              <p className="text-gray-400 text-center">
                {patients.length === 0
                  ? 'No medical records have been created yet'
                  : 'Try adjusting your filters or search query'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <button
                  key={patient._id}
                  onClick={() => router.push(`/clinic-admin/patients/${patient._id}`)}
                  className="w-full bg-white hover:bg-gray-50 p-6 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Patient Avatar & Info */}
                    <div className="flex gap-4 flex-1">
                      {patient.photo ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={patient.photo}
                            alt={patient.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <PawPrint className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#4F4F4F] mb-1">{patient.name}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {patient.breed} • {patient.species === 'dog' ? 'Dog' : 'Cat'} • {patient.sex === 'male' ? 'Male' : 'Female'}
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Owner</p>
                            <p className="text-gray-700 font-medium">
                              {patient.owner.firstName} {patient.owner.lastName}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Contact</p>
                            <p className="text-gray-700 font-medium">{patient.owner.contactNumber}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Blood Type</p>
                            <p className="text-gray-700 font-medium">{patient.bloodType || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 uppercase font-semibold mb-1">Records</p>
                            <p className="text-gray-700 font-medium">{patient.recordCount}</p>
                          </div>
                        </div>

                        {patient.lastVisit && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Last visit: {new Date(patient.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
