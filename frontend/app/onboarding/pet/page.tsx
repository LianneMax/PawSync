'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Dog, Cat, Check, ArrowLeft, ArrowRight, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { createPet, getMyPets } from '@/lib/pets'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BreedCombobox } from '@/components/ui/breed-combobox'
import AvatarUpload from '@/components/avatar-upload'

type PetSpecies = 'dog' | 'cat' | null

export default function PetOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F6F2]" />}>
      <PetOnboardingContent />
    </Suspense>
  )
}

function PetOnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFromDashboard = searchParams.get('from') === 'dashboard'
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  // Step state: 2 = Pet Profile, 3 = Basic Details
  const [currentStep, setCurrentStep] = useState(2)
  const [slidePhase, setSlidePhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')
  const [mounted, setMounted] = useState(false)
  const [existingPetName, setExistingPetName] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Fetch existing pet name when adding from dashboard
  useEffect(() => {
    if (!isFromDashboard) return
    const token = useAuthStore.getState().token || localStorage.getItem('authToken')
    if (!token) return
    getMyPets(token).then((res) => {
      if (res.status === 'SUCCESS' && res.data?.pets && res.data.pets.length > 0) {
        setExistingPetName(res.data.pets[0].name)
      }
    }).catch(() => {})
  }, [isFromDashboard])

  // Pet Profile state (Step 2)
  const [species, setSpecies] = useState<PetSpecies>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  // Pet Details state (Step 3)
  const [fullName, setFullName] = useState('')
  const [breed, setBreed] = useState('')
  const [secondaryBreed, setSecondaryBreed] = useState('')
  const [sex, setSex] = useState('')
  const [sterilization, setSterilization] = useState('')
  const [weight, setWeight] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Clinic search state
  const [clinicSearch, setClinicSearch] = useState('')
  const [selectedClinic, setSelectedClinic] = useState<{ id: string; name: string; address: string } | null>(null)
  const [showClinicResults, setShowClinicResults] = useState(false)

  const mockClinics = [
    { id: '1', name: 'PawCare Veterinary Clinic', address: '123 Main St, Manila' },
    { id: '2', name: 'Happy Pets Animal Hospital', address: '456 Oak Ave, Quezon City' },
    { id: '3', name: 'VetCare Plus', address: '789 Pine Rd, Makati' },
    { id: '4', name: 'Animal Wellness Center', address: '321 Elm St, Pasig' },
    { id: '5', name: 'Pet Health Clinic', address: '654 Cedar Blvd, Taguig' },
  ]

  const filteredClinics = mockClinics.filter(clinic =>
    clinic.name.toLowerCase().includes(clinicSearch.toLowerCase()) ||
    clinic.address.toLowerCase().includes(clinicSearch.toLowerCase())
  )

  // Close clinic dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clinicDropdownRef.current && !clinicDropdownRef.current.contains(event.target as Node)) {
        setShowClinicResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleContinueToDetails = () => {
    if (!species) {
      alert('Please select your pet\'s species')
      return
    }
    sessionStorage.setItem('petProfileData', JSON.stringify({ species, photo: photoPreview }))
    goToStep(3)
  }

  const handleBackToProfile = () => {
    goToStep(2)
  }

  const handleBackToSignup = () => {
    router.push(isFromDashboard ? '/dashboard' : '/signup')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    const newErrors: Record<string, boolean> = {}
    if (!fullName.trim()) newErrors.fullName = true
    if (!breed) newErrors.breed = true
    if (!sex) newErrors.sex = true
    if (!sterilization) newErrors.sterilization = true
    if (!weight.trim()) newErrors.weight = true
    if (!dateOfBirth) newErrors.dateOfBirth = true
    if (dateOfBirth && new Date(dateOfBirth) > new Date()) newErrors.dateOfBirthFuture = true

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setSubmitLoading(true)

    try {
      const token = useAuthStore.getState().token || localStorage.getItem('authToken')
      const response = await createPet({
        name: fullName,
        species: species as 'dog' | 'cat',
        breed,
        secondaryBreed: secondaryBreed || undefined,
        sex: sex as 'male' | 'female',
        dateOfBirth,
        weight: parseFloat(weight),
        sterilization: sterilization as 'yes' | 'no' | 'unknown',
        photo: photoPreview || undefined,
        notes: notes || undefined,
      }, token || undefined)

      if (response.status === 'ERROR') {
        setSubmitError(response.message || 'Failed to create pet. Please try again.')
        setSubmitLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setSubmitError('An error occurred while saving your pet. Please try again.')
      setSubmitLoading(false)
    }
  }

  const userData = useAuthStore((state) => state.user)

  // Slide classes: forward = exit left, enter from right; backward = exit right, enter from left
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
              <p className="font-bold text-[#4F4F4F]" style={{ fontSize: '14px' }}>{userData.firstName} {userData.lastName}</p>
              <p className="text-gray-600" style={{ fontSize: '14px' }}>{userData.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-4">
          {/* Step 1 - Sign Up / Dashboard (Completed) */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-[#4F4F4F]">{isFromDashboard ? 'Dashboard' : 'Sign Up'}</span>
            </div>
          </div>

          {/* Connector 1-2 */}
          <div className="h-1 bg-[#7FA5A3] transition-all duration-500 ease-out" style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '150ms' }}></div>

          {/* Step 2 - Pet Profile */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '300ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStep > 2 ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]'}`}>
                {currentStep > 2 ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-semibold">2</span>
                )}
              </div>
              <span className="text-sm font-medium text-[#4F4F4F]">Pet Profile</span>
            </div>
          </div>

          {/* Connector 2-3 */}
          <div className={`h-1 transition-all duration-500 ease-out ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`} style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '450ms' }}></div>

          {/* Step 3 - Basic Details */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '600ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`}>
                <span className={`font-semibold transition-colors duration-500 ${currentStep >= 3 ? 'text-white' : 'text-gray-600'}`}>3</span>
              </div>
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 3 ? 'text-[#4F4F4F]' : 'text-gray-500'}`}>Basic Details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sliding Content */}
      <div className={`${shouldAnimate ? 'transition-all duration-300 ease-out' : ''} ${getSlideClass()}`}>
        {currentStep === 2 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12 transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '400ms' }}>
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-[#5A7C7A] mb-3">
                {isFromDashboard ? "Let's Meet another furry friend" : "Let's Meet your furry friend"}
              </h1>
              <p className="text-gray-600">
                {isFromDashboard ? (
                  <>
                    Give {existingPetName || 'your pet'} a new friend!<br />
                    What type of pet do you have?
                  </>
                ) : (
                  <>
                    To get started with PawSync, we need to create a profile<br />
                    for at least one pet. What type of pet do you have?
                  </>
                )}
              </p>
            </div>

            {/* Species Selection */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-[#4F4F4F] mb-4">
                Select your pet&apos;s species
              </label>
              <div className="grid grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setSpecies('dog')}
                  className={`p-8 rounded-2xl border-2 transition-all ${
                    species === 'dog'
                      ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                      species === 'dog' ? 'bg-[#5A7C7A]' : 'bg-gray-300'
                    }`}>
                      <Dog className="w-10 h-10 text-white" />
                    </div>
                    <span className="font-semibold text-[#4F4F4F] text-lg">Dog - Canine</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSpecies('cat')}
                  className={`p-8 rounded-2xl border-2 transition-all ${
                    species === 'cat'
                      ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                      species === 'cat' ? 'bg-[#5A7C7A]' : 'bg-gray-300'
                    }`}>
                      <Cat className="w-10 h-10 text-white" />
                    </div>
                    <span className="font-semibold text-[#4F4F4F] text-lg">Cat - Feline</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="bg-gray-50 rounded-2xl p-8 mb-8">
              <AvatarUpload
                className="w-full"
                maxSize={5 * 1024 * 1024}
                onFileChange={(file) => {
                  if (file?.file instanceof File) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setPhotoPreview(reader.result as string)
                    }
                    reader.readAsDataURL(file.file)
                    setPhotoFile(file.file)
                  } else {
                    setPhotoPreview(null)
                    setPhotoFile(null)
                  }
                }}
              >
                <div className="flex-1 pt-2">
                  <h3 className="font-semibold text-[#4F4F4F] mb-2">Upload a photo of your pet</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    This helps vets identify your pet and makes their profile more personal.
                  </p>
                  <p className="text-sm text-gray-500">
                    You can also skip this and add a photo later!
                  </p>
                </div>
              </AvatarUpload>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToSignup}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <button
                type="button"
                onClick={handleContinueToDetails}
                className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold text-[#5A7C7A] mb-3">
                Tell us about your {species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : 'Pet'}
              </h1>
              <p className="text-gray-600">
                Fill in the basic details about your pet. This information<br />
                helps veterinarians provide better care
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Error Message */}
              {submitError && (
                <div className="mb-6 p-3 bg-red-50 border border-red-300 text-red-700 rounded-xl text-sm">
                  {submitError}
                </div>
              )}

              {/* Clinic Search Section */}
              <div className="mb-8">
                <div className="relative" ref={clinicDropdownRef}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  {selectedClinic ? (
                    <div className="w-full pl-12 pr-12 py-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#4F4F4F]">{selectedClinic.name}</p>
                        <p className="text-sm text-gray-500">{selectedClinic.address}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClinic(null)
                          setClinicSearch('')
                        }}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Select Clinic"
                      value={clinicSearch}
                      onChange={(e) => {
                        setClinicSearch(e.target.value)
                        setShowClinicResults(true)
                      }}
                      onFocus={() => setShowClinicResults(true)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-xl border border-gray-200 shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    />
                  )}

                  {showClinicResults && !selectedClinic && (
                    <div className="absolute z-10 w-full mt-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                      {filteredClinics.length > 0 ? (
                        filteredClinics.map((clinic) => (
                          <button
                            key={clinic.id}
                            type="button"
                            onClick={() => {
                              setSelectedClinic(clinic)
                              setClinicSearch('')
                              setShowClinicResults(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <p className="font-medium text-[#4F4F4F]">{clinic.name}</p>
                            <p className="text-sm text-gray-500">{clinic.address}</p>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 text-center">
                          No clinics found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Information Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-[#4F4F4F] mb-4 pb-2 border-b border-gray-200">
                  Basic Information
                </h3>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Full name*"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: false })) }}
                    className={`w-full h-13 px-4 bg-gray-50 rounded-xl border shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all ${errors.fullName ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors.fullName && <p className="text-xs text-red-500 mt-1 ml-1">This field is required</p>}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <BreedCombobox
                    species={species}
                    value={breed}
                    onChange={(v) => { setBreed(v); setErrors(prev => ({ ...prev, breed: false })) }}
                    placeholder="Primary Breed*"
                    error={errors.breed}
                  />
                  <BreedCombobox
                    species={species}
                    value={secondaryBreed}
                    onChange={setSecondaryBreed}
                    placeholder="Secondary Breed (optional)"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Select value={sex} onValueChange={(val) => { setSex(val); setErrors(prev => ({ ...prev, sex: false })) }}>
                      <SelectTrigger className={`w-full h-13 px-4 bg-gray-50 rounded-xl shadow-xs shadow-black/5 text-base ${errors.sex ? 'border-red-400' : 'border-gray-200'}`}>
                        <SelectValue placeholder="Sex*" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.sex && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
                  </div>

                  <div>
                    <Select value={sterilization} onValueChange={(val) => { setSterilization(val); setErrors(prev => ({ ...prev, sterilization: false })) }}>
                      <SelectTrigger className={`w-full h-13 px-4 bg-gray-50 rounded-xl shadow-xs shadow-black/5 text-base ${errors.sterilization ? 'border-red-400' : 'border-gray-200'}`}>
                        <SelectValue placeholder="Sterilization*" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.sterilization && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Weight (kg)*"
                      value={weight}
                      onChange={(e) => { setWeight(e.target.value); setErrors(prev => ({ ...prev, weight: false })) }}
                      className={`w-full h-13 px-4 bg-gray-50 rounded-xl border shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all ${errors.weight ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {errors.weight && <p className="text-xs text-red-500 mt-1 ml-1">Required</p>}
                  </div>
                </div>

                <div className="mb-4">
                  <DatePicker
                    value={dateOfBirth}
                    onChange={(v) => { setDateOfBirth(v); setErrors(prev => ({ ...prev, dateOfBirth: false, dateOfBirthFuture: false })) }}
                    placeholder="Date of Birth*"
                    error={errors.dateOfBirth || errors.dateOfBirthFuture}
                  />
                  {errors.dateOfBirthFuture
                    ? <p className="text-xs text-red-500 mt-1 ml-1">Date of birth cannot be in the future</p>
                    : !errors.dateOfBirth && <p className="text-xs text-gray-500 mt-1 ml-1">If unsure, enter an approximate date</p>
                  }
                </div>

                <div className="mb-4">
                  <textarea
                    placeholder="Notes&#10;Ex. Markings, Color"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleBackToProfile}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>

                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading ? 'Saving...' : 'Continue'}
                  {!submitLoading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
