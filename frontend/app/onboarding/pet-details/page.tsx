'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowLeft, ArrowRight } from 'lucide-react'

export default function PetDetailsPage() {
  const router = useRouter()

  // Get species from previous page
  const getPetProfileData = () => {
    if (typeof window !== 'undefined') {
      const data = sessionStorage.getItem('petProfileData')
      return data ? JSON.parse(data) : null
    }
    return null
  }

  const petProfileData = getPetProfileData()
  const species = petProfileData?.species || 'pet'

  // Form state
  const [fullName, setFullName] = useState('')
  const [breed, setBreed] = useState('')
  const [crossBreed, setCrossBreed] = useState('')
  const [isCrossBreed, setIsCrossBreed] = useState(false)
  const [sex, setSex] = useState('')
  const [sterilization, setSterilization] = useState('')
  const [weight, setWeight] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [microchipId, setMicrochipId] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Store pet details
    const petDetails = {
      fullName,
      breed,
      crossBreed: isCrossBreed ? crossBreed : null,
      isCrossBreed,
      sex,
      sterilization,
      weight,
      dateOfBirth,
      microchipId,
      notes
    }

    sessionStorage.setItem('petDetails', JSON.stringify(petDetails))

    // TODO: Send all data to backend API
    // For now, redirect to dashboard or success page
    console.log('Complete pet data:', {
      ...getPetProfileData(),
      ...petDetails
    })

    // Redirect to dashboard
    router.push('/dashboard')
  }

  const handleBack = () => {
    router.push('/onboarding/pet-profile')
  }

  // Get user data from signup
  const getUserData = () => {
    if (typeof window !== 'undefined') {
      const data = sessionStorage.getItem('signupData')
      return data ? JSON.parse(data) : null
    }
    return null
  }

  const userData = getUserData()

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-12">
      {/* Header with user info */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div className="w-16 h-16 bg-[#5A7C7A] rounded-2xl"></div>
          {userData && (
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm">
              <p className="font-semibold text-gray-800">{userData.firstName} {userData.lastName}</p>
              <p className="text-sm text-gray-600">{userData.email}</p>
            </div>
          )}
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

          {/* Step 2 - Pet Profile (Completed) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Pet Profile</span>
            </div>
          </div>

          {/* Connector */}
          <div className="w-16 h-1 bg-[#7FA5A3]"></div>

          {/* Step 3 - Basic Details (Active) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <span className="text-white font-semibold">3</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Basic Details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
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
          {/* Basic Information Section */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-200">
              Basic Information
            </h3>

            {/* Full Name */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Full name*"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Breed and Cross Breed */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Breed*"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                required
              />
              <input
                type="text"
                placeholder="Cross Breed (Optional)"
                value={crossBreed}
                onChange={(e) => {
                  setCrossBreed(e.target.value)
                  if (e.target.value) setIsCrossBreed(true)
                }}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
              />
            </div>

            {/* Cross Breed Checkbox */}
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCrossBreed}
                  onChange={(e) => setIsCrossBreed(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3] cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-700">Cross Breed</span>
              </label>
            </div>

            {/* Sex, Sterilization, Weight */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="">Sex*</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              <div className="relative">
                <select
                  value={sterilization}
                  onChange={(e) => setSterilization(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="">Sterilization*</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">Unknown</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>

              <input
                type="text"
                placeholder="Weight (kg)*"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Date of Birth and Microchip */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <input
                  type="date"
                  placeholder="Date of Birth*"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                  required
                />
                <p className="text-xs text-gray-500 mt-1 ml-1">If unsure, enter an approximate date</p>
              </div>

              <input
                type="text"
                placeholder="Microchip ID (if any)"
                value={microchipId}
                onChange={(e) => setMicrochipId(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
              />
            </div>

            {/* Notes */}
            <div className="mb-4">
              <textarea
                placeholder="Notes&#10;Ex. Markings, Color"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleBack}
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
    </div>
  )
}
