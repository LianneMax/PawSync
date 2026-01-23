'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowLeft, ArrowRight, Search } from 'lucide-react'

// Sample clinic data - in a real app, this would come from an API
const clinicsData = [
  {
    id: 1,
    name: 'BaiVet Animal Clinic',
    branches: [
      { id: 1, name: 'Parañaque City', address: '123 Street, Parañaque City', isMain: true },
      { id: 2, name: 'Makati City', address: '456 Avenue, Makati City', isMain: false },
      { id: 3, name: 'Taguig City', address: '789 Road, Taguig City', isMain: false },
    ]
  },
  {
    id: 2,
    name: 'Pet Care Plus Veterinary',
    branches: [
      { id: 4, name: 'Quezon City', address: '321 Boulevard, Quezon City', isMain: true },
      { id: 5, name: 'Manila', address: '654 Street, Manila', isMain: false },
      { id: 6, name: 'Pasig City', address: '987 Lane, Pasig City', isMain: false },
    ]
  },
  {
    id: 3,
    name: 'Pet Care Plus Veterinary',
    branches: [
      { id: 7, name: 'Caloocan', address: '111 Drive, Caloocan', isMain: true },
      { id: 8, name: 'Valenzuela', address: '222 Way, Valenzuela', isMain: false },
      { id: 9, name: 'Malabon', address: '333 Path, Malabon', isMain: false },
    ]
  },
  {
    id: 4,
    name: 'Pet Care Plus Veterinary',
    branches: [
      { id: 10, name: 'Las Piñas', address: '444 Circle, Las Piñas', isMain: true },
      { id: 11, name: 'Muntinlupa', address: '555 Square, Muntinlupa', isMain: false },
      { id: 12, name: 'San Juan', address: '666 Court, San Juan', isMain: false },
    ]
  },
  {
    id: 5,
    name: 'Pet Care Plus Veterinary',
    branches: [
      { id: 13, name: 'Mandaluyong', address: '777 Plaza, Mandaluyong', isMain: true },
      { id: 14, name: 'Marikina', address: '888 Park, Marikina', isMain: false },
      { id: 15, name: 'Pasay', address: '999 Center, Pasay', isMain: false },
    ]
  },
]

export default function SelectClinicPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClinic, setSelectedClinic] = useState<number | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [expandedClinic, setExpandedClinic] = useState<number | null>(null)

  const filteredClinics = clinicsData.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleClinicSelect = (clinicId: number) => {
    if (expandedClinic === clinicId) {
      // If clicking the same clinic, just collapse it
      setExpandedClinic(null)
    } else {
      setSelectedClinic(clinicId)
      setExpandedClinic(clinicId)
      setSelectedBranch(null) // Reset branch selection when changing clinic
    }
  }

  const handleBranchSelect = (branchId: number) => {
    setSelectedBranch(branchId)
  }

  const handleSubmit = () => {
    if (!selectedClinic || !selectedBranch) {
      alert('Please select a clinic and branch')
      return
    }

    // Store clinic selection data
    const clinicData = {
      clinicId: selectedClinic,
      branchId: selectedBranch,
      clinicName: clinicsData.find(c => c.id === selectedClinic)?.name,
      branchName: clinicsData
        .find(c => c.id === selectedClinic)
        ?.branches.find(b => b.id === selectedBranch)?.name
    }
    sessionStorage.setItem('clinicData', JSON.stringify(clinicData))

    // TODO: Send all data to backend API for verification
    console.log('Submitting for verification:', {
      prcLicense: JSON.parse(sessionStorage.getItem('prcLicenseData') || '{}'),
      clinic: clinicData
    })

    // Redirect to verification pending page or dashboard
    router.push('/dashboard')
  }

  const handleBack = () => {
    router.push('/onboarding/vet/prc-license')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-12">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-start">
          <div className="w-16 h-16 bg-[#5A7C7A] rounded-2xl"></div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-4">
          {/* Step 1 - Sign Up (Completed) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Sign Up</span>
            </div>
          </div>

          {/* Connector */}
          <div className="w-16 h-1 bg-[#7FA5A3]"></div>

          {/* Step 2 - PRC License (Completed) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">PRC License</span>
            </div>
          </div>

          {/* Connector */}
          <div className="w-16 h-1 bg-[#7FA5A3]"></div>

          {/* Step 3 - Select Clinic (Active) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/30 border-2 border-[#7FA5A3] flex items-center justify-center">
                <span className="text-[#5A7C7A] font-semibold">3</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Select Clinic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
            Select Clinic & Branch
          </h1>
          <p className="text-gray-600">
            Choose the clinic and branch where you'd like to apply
          </p>
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search Clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Clinic List */}
        <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
          {filteredClinics.map((clinic) => (
            <div key={clinic.id} className="border border-gray-200 rounded-2xl overflow-hidden">
              {/* Clinic Header */}
              <div
                onClick={() => handleClinicSelect(clinic.id)}
                className={`flex items-center justify-between p-5 cursor-pointer transition-colors ${
                  selectedClinic === clinic.id ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-xl"></div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{clinic.name}</h3>
                    <p className="text-sm text-gray-500">{clinic.branches.length} Branches</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedClinic === clinic.id
                    ? 'border-[#7FA5A3] bg-[#7FA5A3]'
                    : 'border-gray-300'
                }`}>
                  {selectedClinic === clinic.id && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
              </div>

              {/* Branches (Expandable) */}
              {expandedClinic === clinic.id && (
                <div className="bg-gray-50 px-5 pb-5">
                  <p className="text-sm font-medium text-gray-600 mb-3">Select Branch</p>
                  <div className="space-y-2">
                    {clinic.branches.map((branch) => (
                      <div
                        key={branch.id}
                        onClick={() => handleBranchSelect(branch.id)}
                        className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                          selectedBranch === branch.id
                            ? 'bg-[#7FA5A3]/10 border border-[#7FA5A3]'
                            : 'bg-white border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedBranch === branch.id
                              ? 'border-[#7FA5A3]'
                              : 'border-gray-300'
                          }`}>
                            {selectedBranch === branch.id && (
                              <div className="w-2.5 h-2.5 bg-[#7FA5A3] rounded-full"></div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{branch.name}</span>
                              {branch.isMain && (
                                <span className="px-2 py-0.5 bg-[#7FA5A3] text-white text-xs rounded-full">
                                  MAIN
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{branch.address}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
          >
            Submit for Verification
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
