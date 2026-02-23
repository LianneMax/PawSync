'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { DatePicker } from '@/components/ui/date-picker'
import ProgressUpload from '@/components/progress-upload'

interface ApiBranch {
  _id: string
  name: string
  address: string
  isMain: boolean
}

interface ApiClinic {
  _id: string
  name: string
  address: string | null
  mainBranchId: string | null
  branches: ApiBranch[]
}

export default function VetOnboardingPage() {
  const router = useRouter()
  const { token } = useAuthStore()

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
  const [prcIdPhotoBase64, setPrcIdPhotoBase64] = useState('')
  const [fileName, setFileName] = useState('')
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  // Select Clinic state (Step 3)
  const [clinics, setClinics] = useState<ApiClinic[]>([])
  const [loadingClinics, setLoadingClinics] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

  // Fetch real clinics from API
  useEffect(() => {
    const fetchClinics = async () => {
      setLoadingClinics(true)
      try {
        const res = await fetch(`${API_URL}/clinics`)
        const data = await res.json()
        if (data.status === 'SUCCESS') {
          setClinics(data.data.clinics)
        }
      } catch (err) {
        console.error('Failed to fetch clinics:', err)
      } finally {
        setLoadingClinics(false)
      }
    }
    fetchClinics()
  }, [API_URL])

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

    const newErrors: Record<string, boolean> = {}
    if (!firstName.trim()) newErrors.firstName = true
    if (!lastName.trim()) newErrors.lastName = true
    if (!middleName.trim()) newErrors.middleName = true
    if (!prcNumber.trim()) newErrors.prcNumber = true
    else if (!/^\d{7}$/.test(prcNumber.trim())) newErrors.prcNumberFormat = true
    if (!registrationDate) newErrors.registrationDate = true
    if (!expirationDate) newErrors.expirationDate = true
    if (!prcIdPhotoBase64) newErrors.prcIdPhoto = true

    // Check if expiration date is in the past (license expired)
    if (expirationDate) {
      const expDate = new Date(expirationDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      expDate.setHours(0, 0, 0, 0)
      if (expDate < today) {
        newErrors.expirationDateExpired = true
        toast.error('Your PRC license has already expired')
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    goToStep(3)
  }

  const handleBackToPrc = () => {
    goToStep(2)
  }

  const handleBackToSignup = () => {
    router.push('/signup')
  }

  const handleClinicSelect = (clinicId: string) => {
    if (expandedClinic === clinicId) {
      setExpandedClinic(null)
    } else {
      setSelectedClinic(clinicId)
      setExpandedClinic(clinicId)

      const clinic = clinics.find(c => c._id === clinicId)
      if (clinic) {
        if (clinic.branches.length === 0 && clinic.mainBranchId) {
          // No branches visible but has a main branch — auto-select it
          setSelectedBranch(clinic.mainBranchId)
        } else if (clinic.branches.length === 1) {
          // Only one branch — auto-select it
          setSelectedBranch(clinic.branches[0]._id)
        } else {
          setSelectedBranch(null)
        }
      } else {
        setSelectedBranch(null)
      }
    }
  }

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranch(branchId)
  }

  const handleSubmit = () => {
    if (!selectedClinic || !selectedBranch) {
      setSubmitError('Please select a clinic and branch')
      return
    }
    setSubmitError('')
    setShowConfirmDialog(true)
  }

  const handleConfirmAndSubmit = async () => {
    if (!token) {
      setSubmitError('You must be logged in to submit')
      setShowConfirmDialog(false)
      return
    }

    setSubmitting(true)

    try {
      const verificationRes = await fetch(`${API_URL}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          firstName, lastName,
          middleName: middleName || null,
          suffix: suffix || null,
          prcLicenseNumber: prcNumber,
          profession: 'Veterinary Medicine',
          registrationDate, expirationDate,
          prcIdPhoto: prcIdPhotoBase64 || null,
          clinicId: selectedClinic,
          branchId: selectedBranch
        })
      })
      const verificationData = await verificationRes.json()

      if (verificationData.status !== 'SUCCESS') {
        setSubmitError(verificationData.message || 'Failed to submit verification')
        setShowConfirmDialog(false)
        setSubmitting(false)
        return
      }

      const applicationRes = await fetch(`${API_URL}/vet-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          clinicId: selectedClinic,
          branchId: selectedBranch,
          verificationId: verificationData.data.verification._id
        })
      })
      const applicationData = await applicationRes.json()

      if (applicationData.status !== 'SUCCESS') {
        setSubmitError(applicationData.message || 'Failed to submit application')
        setShowConfirmDialog(false)
        setSubmitting(false)
        return
      }

      const selectedClinicObj = clinics.find(c => c._id === selectedClinic)
      const selectedBranchObj = selectedClinicObj?.branches.find(b => b._id === selectedBranch)

      sessionStorage.setItem('prcLicenseData', JSON.stringify({
        firstName, lastName, middleName, suffix,
        prcNumber, registrationDate, expirationDate, fileName
      }))
      sessionStorage.setItem('clinicData', JSON.stringify({
        clinicId: selectedClinic, branchId: selectedBranch,
        clinicName: selectedClinicObj?.name, branchName: selectedBranchObj?.name
      }))

      router.push('/onboarding/vet/verification-pending')
    } catch (err) {
      console.error('Submission error:', err)
      setSubmitError('An error occurred. Please try again.')
      setShowConfirmDialog(false)
    } finally {
      setSubmitting(false)
    }
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
    <>
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
              <p className="font-bold text-[#4F4F4F]" style={{ fontSize: '14px' }}>{userData.firstName} {userData.lastName}</p>
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
              <span className="text-sm font-medium text-[#4F4F4F]">Sign Up</span>
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
              <span className="text-sm font-medium text-[#4F4F4F]">PRC License</span>
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
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 3 ? 'text-[#4F4F4F]' : 'text-gray-500'}`}>Select Clinic</span>
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

            <form onSubmit={handleContinueToClinic} noValidate>
              {/* Full Name Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">
                  Full Name (as it appears on PRC ID)
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <input
                      type="text"
                      placeholder="First Name*"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: false })) }}
                      className={`w-full px-4 py-4 bg-white rounded-xl border ${errors.firstName ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                    />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Last Name*"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: false })) }}
                      className={`w-full px-4 py-4 bg-white rounded-xl border ${errors.lastName ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                    />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Middle Name*"
                      value={middleName}
                      onChange={(e) => { setMiddleName(e.target.value); setErrors(prev => ({ ...prev, middleName: false })) }}
                      className={`w-full px-4 py-4 bg-white rounded-xl border ${errors.middleName ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                    />
                    {errors.middleName && <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>}
                  </div>
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
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">
                  PRC License Details
                </h3>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="PRC Registration Number #"
                    value={prcNumber}
                    maxLength={7}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 7)
                      setPrcNumber(val)
                      setErrors(prev => ({ ...prev, prcNumber: false, prcNumberFormat: false }))
                    }}
                    className={`w-full px-4 py-4 bg-white rounded-xl border ${errors.prcNumber || errors.prcNumberFormat ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                  />
                  {errors.prcNumber
                    ? <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>
                    : errors.prcNumberFormat
                    ? <p className="text-xs text-red-500 mt-1 ml-1">PRC license number must be exactly 7 digits</p>
                    : <p className="text-xs text-gray-500 mt-1 ml-1">Enter your 7-digit PRC license number for Veterinary Medicine</p>
                  }
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DatePicker
                      value={registrationDate}
                      onChange={(v) => {
                        // Prevent future dates for registration date
                        if (v && new Date(v) > new Date()) {
                          return
                        }
                        setRegistrationDate(v)
                        setErrors(prev => ({ ...prev, registrationDate: false }))
                      }}
                      placeholder="Date of Registration"
                      error={errors.registrationDate}
                    />
                    {!errors.registrationDate && (
                      <p className="text-xs text-gray-500 mt-1 ml-1">
                        When your license was first issued
                      </p>
                    )}
                  </div>
                  <div>
                    <DatePicker
                      value={expirationDate}
                      onChange={(v) => { setExpirationDate(v); setErrors(prev => ({ ...prev, expirationDate: false, expirationDateExpired: false })) }}
                      placeholder="Expiration Date"
                      error={errors.expirationDate || errors.expirationDateExpired}
                      allowFutureDates={true}
                    />
                    {errors.expirationDateExpired ? (
                      <p className="text-xs text-red-500 mt-1 ml-1">Your license has already expired</p>
                    ) : !errors.expirationDate && (
                      <p className="text-xs text-gray-500 mt-1 ml-1">
                        When your current license expires
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PRC ID Photo Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">
                  PRC ID Photo*
                </h3>

                <ProgressUpload
                  maxFiles={1}
                  multiple={false}
                  maxSize={10 * 1024 * 1024}
                  accept="image/jpeg,image/png,application/pdf"
                  simulateUpload={true}
                  title="Submit a PDF File of your PRC ID"
                  titleClassName="text-[#476B6B]"
                  description="Take a clear photo showing all details visible of both FRONT and BACK."
                  hint="Accepted file types: JPG, PNG, PDF"
                  onFilesChange={(files) => {
                    if (files.length > 0 && files[0].file instanceof File) {
                      setFileName(files[0].file.name)
                      // Convert file to base64 for storage
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        setPrcIdPhotoBase64(reader.result as string)
                        setErrors(prev => ({ ...prev, prcIdPhoto: false }))
                      }
                      reader.readAsDataURL(files[0].file)
                    } else {
                      setFileName('')
                      setPrcIdPhotoBase64('')
                    }
                  }}
                />
                {errors.prcIdPhoto && <p className="text-xs text-red-500 mt-1 ml-1">PRC ID Photo is required</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleBackToSignup}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
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
              {loadingClinics ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Loading clinics...</p>
                </div>
              ) : filteredClinics.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No clinics found. Please check back later.</p>
                </div>
              ) : (
                filteredClinics.map((clinic) => (
                  <div key={clinic._id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Clinic Header */}
                    <div
                      onClick={() => handleClinicSelect(clinic._id)}
                      className={`flex items-center justify-between p-5 cursor-pointer transition-colors ${
                        selectedClinic === clinic._id ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gray-200 rounded-xl"></div>
                        <div>
                          <h3 className="font-semibold text-[#4F4F4F]">{clinic.name}</h3>
                          <p className="text-sm text-gray-500">
                            {clinic.branches.length === 0
                              ? 'Main Branch'
                              : `${clinic.branches.length} Branch${clinic.branches.length !== 1 ? 'es' : ''}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedClinic === clinic._id
                          ? 'border-[#7FA5A3] bg-[#7FA5A3]'
                          : 'border-gray-300'
                      }`}>
                        {selectedClinic === clinic._id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>

                    {/* Branches (Expandable) */}
                    {expandedClinic === clinic._id && (
                      <div className="bg-gray-50 px-5 pb-5">
                        {clinic.branches.length === 0 ? (
                          <>
                            <p className="text-sm font-medium text-gray-600 mb-3">Branch</p>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[#7FA5A3]/10 border border-[#7FA5A3]">
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full border-2 border-[#7FA5A3] flex items-center justify-center">
                                  <div className="w-2.5 h-2.5 bg-[#7FA5A3] rounded-full"></div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-[#4F4F4F]">Main Branch</span>
                                    <span className="px-2 py-0.5 bg-[#7FA5A3] text-white text-xs rounded-full">
                                      MAIN
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500">{clinic.address || 'Primary clinic location'}</p>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-600 mb-3">Select Branch</p>
                            <div className="space-y-2">
                              {clinic.branches.map((branch) => (
                                <div
                                  key={branch._id}
                                  onClick={() => handleBranchSelect(branch._id)}
                                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                                    selectedBranch === branch._id
                                      ? 'bg-[#7FA5A3]/10 border border-[#7FA5A3]'
                                      : 'bg-white border border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      selectedBranch === branch._id
                                        ? 'border-[#7FA5A3]'
                                        : 'border-gray-300'
                                    }`}>
                                      {selectedBranch === branch._id && (
                                        <div className="w-2.5 h-2.5 bg-[#7FA5A3] rounded-full"></div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-[#4F4F4F]">{branch.name}</span>
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleBackToPrc}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
              >
                Continue to Review
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Confirmation Dialog */}
    {showConfirmDialog && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-[#4F4F4F] mb-3">
            Are you sure?
          </h2>
          <p className="text-gray-600 mb-6">
            Please make sure all your details are correct. You will no longer be able to edit your information after submitting.
          </p>

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-400 rounded-xl">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitting}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-[#4F4F4F] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAndSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
