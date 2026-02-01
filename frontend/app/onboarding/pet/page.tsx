'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Dog, Cat, Image as ImageIcon, Check, ArrowLeft, ArrowRight, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BreedCombobox } from '@/components/ui/breed-combobox'

type PetSpecies = 'dog' | 'cat' | null

export default function PetOnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clinicDropdownRef = useRef<HTMLDivElement>(null)

  // Step state: 2 = Pet Profile, 3 = Basic Details
  const [currentStep, setCurrentStep] = useState(2)
  const [slidePhase, setSlidePhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
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
    router.push('/signup')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const petDetails = {
      fullName, breed, secondaryBreed: secondaryBreed || null, sex, sterilization, weight, dateOfBirth, notes,
      clinic: selectedClinic
    }
    sessionStorage.setItem('petDetails', JSON.stringify(petDetails))
    router.push('/dashboard')
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
              <span className="text-sm font-medium text-gray-700">Pet Profile</span>
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
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 3 ? 'text-gray-700' : 'text-gray-500'}`}>Basic Details</span>
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
              <h1 className="text-4xl font-bold text-[#5A7C7A] mb-3">Let&apos;s Meet your furry friend</h1>
              <p className="text-gray-600">
                To get started with PawSync, we need to create a profile<br />
                for at least one pet. What type of pet do you have?
              </p>
            </div>

            {/* Species Selection */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
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
                    <span className="font-semibold text-gray-700 text-lg">Dog - Canine</span>
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
                    <span className="font-semibold text-gray-700 text-lg">Cat - Feline</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="bg-gray-50 rounded-2xl p-8 mb-8">
              <div className="flex items-start gap-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-32 h-32 bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#7FA5A3] transition-colors overflow-hidden"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Pet preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-10 h-10 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Add Photo</p>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2">Upload a photo of your pet</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    This helps vets identify your pet and makes their profile more personal.
                  </p>
                  <p className="text-sm text-gray-500">
                    You can also skip this and add a photo later!
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToSignup}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
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

            <form onSubmit={handleSubmit}>
              {/* Clinic Search Section */}
              <div className="mb-8">
                <div className="relative" ref={clinicDropdownRef}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  {selectedClinic ? (
                    <div className="w-full pl-12 pr-12 py-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{selectedClinic.name}</p>
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
                            <p className="font-medium text-gray-800">{clinic.name}</p>
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
                <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
                  Basic Information
                </h3>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Full name*"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-13 px-4 bg-gray-50 rounded-xl border border-gray-200 shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <BreedCombobox
                    species={species}
                    value={breed}
                    onChange={setBreed}
                    placeholder="Primary Breed*"
                    required
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
                    <Select value={sex} onValueChange={(val) => setSex(val)} required>
                      <SelectTrigger className="w-full h-13 px-4 bg-gray-50 rounded-xl border-gray-200 shadow-xs shadow-black/5 text-base">
                        <SelectValue placeholder="Sex*" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select value={sterilization} onValueChange={(val) => setSterilization(val)} required>
                      <SelectTrigger className="w-full h-13 px-4 bg-gray-50 rounded-xl border-gray-200 shadow-xs shadow-black/5 text-base">
                        <SelectValue placeholder="Sterilization*" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <input
                    type="text"
                    placeholder="Weight (kg)*"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full h-13 px-4 bg-gray-50 rounded-xl border border-gray-200 shadow-xs shadow-black/5 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div className="mb-4">
                  <DatePicker
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    placeholder="Date of Birth*"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1 ml-1">If unsure, enter an approximate date</p>
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
      </div>
    </div>
  )
}
