'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ArrowLeft, ArrowRight, Upload, FileText, Search } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

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

export default function VetOnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step state: 2 = PRC License, 3 = Select Clinic
  const [currentStep, setCurrentStep] = useState(2)
  const [slidePhase, setSlidePhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  // PRC License state (Step 2)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [prcNumber, setPrcNumber] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [fileName, setFileName] = useState('')

  // Select Clinic state (Step 3)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClinic, setSelectedClinic] = useState<number | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [expandedClinic, setExpandedClinic] = useState<number | null>(null)

  const filteredClinics = clinicsData.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
    }
  }

  const goToStep = (step: number) => {
    if (step === currentStep || slidePhase !== 'idle') return
    setSlideDirection(step > currentStep ? 'forward' : 'backward')
    setSlidePhase('exit')
    setTimeout(() => {
      setCurrentStep(step)
      setSlidePhase('enter')
      setTimeout(() => setSlidePhase('idle'), 300)
    }, 300)
  }

  const handleContinueToClinic = (e: React.FormEvent) => {
    e.preventDefault()

    // Store PRC license data in sessionStorage
    const prcLicenseData = {
      firstName, lastName, middleName, suffix,
      prcNumber, registrationDate, expirationDate, fileName
    }
    sessionStorage.setItem('prcLicenseData', JSON.stringify(prcLicenseData))

    goToStep(3)
  }

  const handleBackToPrc = () => {
    goToStep(2)
  }

  const handleBackToSignup = () => {
    router.push('/signup')
  }

  const handleClinicSelect = (clinicId: number) => {
    if (expandedClinic === clinicId) {
      setExpandedClinic(null)
    } else {
      setSelectedClinic(clinicId)
      setExpandedClinic(clinicId)
      setSelectedBranch(null)
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

    const clinicData = {
      clinicId: selectedClinic,
      branchId: selectedBranch,
      clinicName: clinicsData.find(c => c.id === selectedClinic)?.name,
      branchName: clinicsData
        .find(c => c.id === selectedClinic)
        ?.branches.find(b => b.id === selectedBranch)?.name
    }
    sessionStorage.setItem('clinicData', JSON.stringify(clinicData))

    router.push('/onboarding/vet/verification-pending')
  }

  const userData = useAuthStore((state) => state.user)

  // Slide classes
  const getSlideClass = () => {
    if (slidePhase === 'exit') {
      return slideDirection === 'forward'
        ? '-translate-x-full opacity-0'
        : 'translate-x-full opacity-0'
    }
    if (slidePhase === 'enter') {
      return slideDirection === 'forward'
        ? 'translate-x-full opacity-0'
        : '-translate-x-full opacity-0'
    }
    return 'translate-x-0 opacity-100'
  }

  const shouldAnimate = slidePhase === 'exit' || slidePhase === 'idle'

  return (
    <div className="min-h-screen bg-[#F8F6F2] p-4 pb-12 overflow-hidden">
      {/* Header with user info */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div className="w-14 h-14 bg-[#476B6B] rounded-xl flex items-center justify-center shadow-sm">
            <Image
              src="/images/logos/pawsync-logo-white.png"
              alt="PawSync Logo"
              width={38}
              height={38}
            />
          </div>
          {userData && (
            <div className="h-14 bg-[#F8F6F2] px-6 rounded-xl shadow-sm flex flex-col items-center justify-center">
              <p className="font-bold text-gray-800" style={{ fontSize: '14px' }}>{userData.firstName} {userData.lastName}</p>
              <p className="text-gray-600" style={{ fontSize: '14px' }}>{userData.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-4">
          {/* Step 1 - Sign Up (Completed) */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Sign Up</span>
            </div>
          </div>

          {/* Connector 1-2 */}
          <div className="h-1 bg-[#7FA5A3] transition-all duration-500 ease-out" style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '150ms' }}></div>

          {/* Step 2 - PRC License */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '300ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 bg-[#7FA5A3]`}>
                {currentStep > 2 ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-semibold">2</span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">PRC License</span>
            </div>
          </div>

          {/* Connector 2-3 */}
          <div className={`h-1 transition-all duration-500 ease-out ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`} style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '450ms' }}></div>

          {/* Step 3 - Select Clinic */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '600ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`}>
                <span className={`font-semibold transition-colors duration-500 ${currentStep >= 3 ? 'text-white' : 'text-gray-600'}`}>3</span>
              </div>
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 3 ? 'text-gray-700' : 'text-gray-500'}`}>Select Clinic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sliding Content */}
      <div className={`${shouldAnimate ? 'transition-all duration-300 ease-out' : ''} ${getSlideClass()}`}>
        {/* Step 2 - PRC License */}
        {currentStep === 2 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12 transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '400ms' }}>
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
                Submit PRC License for Verification
              </h1>
              <p className="text-gray-600">
                To ensure the safety and quality of care on PawSync, we need to<br />
                verify your Professional Regulation Commission (PRC) credentials
              </p>
            </div>

            <form onSubmit={handleContinueToClinic}>
              {/* Full Name Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Full Name (as it appears on PRC ID)
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="First Name*"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name*"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Middle Name*"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Suffix (if any)"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* PRC License Details Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  PRC License Details
                </h3>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="PRC Registration Number #"
                    value={prcNumber}
                    onChange={(e) => setPrcNumber(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1 ml-1">
                    Enter your 7-digit PRC license number for Veterinary Medicine
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="date"
                      placeholder="Date of Registration"
                      value={registrationDate}
                      onChange={(e) => setRegistrationDate(e.target.value)}
                      className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      When your license was first issued
                    </p>
                  </div>
                  <div>
                    <input
                      type="date"
                      placeholder="Expiration Date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1 ml-1">
                      When your current license expires
                    </p>
                  </div>
                </div>
              </div>

              {/* PRC ID Photo Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  PRC ID Photo
                </h3>

                <div className="bg-gray-50 rounded-2xl p-8 border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-xl mx-auto mb-4 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="font-semibold text-gray-800 mb-2">
                      Submit a PDF File of your PRC ID
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Take a clear photo showing all details visible of both FRONT and BACK.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Choose File
                    </button>

                    {fileName && (
                      <p className="text-sm text-[#5A7C7A] mt-3 font-medium">
                        Selected: {fileName}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-3">
                      Accepted file type: PDF
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleBackToSignup}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3 - Select Clinic */}
        {currentStep === 3 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
                Select Clinic & Branch
              </h1>
              <p className="text-gray-600">
                Choose the clinic and branch where you&apos;d like to apply
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
                onClick={handleBackToPrc}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
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
        )}
      </div>
    </div>
  )
}
