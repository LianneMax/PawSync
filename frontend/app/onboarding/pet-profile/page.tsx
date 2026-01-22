'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dog, Cat, Image as ImageIcon, Check, ArrowLeft, ArrowRight } from 'lucide-react'

type PetSpecies = 'dog' | 'cat' | null

export default function PetProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [species, setSpecies] = useState<PetSpecies>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

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

  const handleContinue = () => {
    if (!species) {
      alert('Please select your pet\'s species')
      return
    }

    // Store pet profile data in sessionStorage
    const petProfileData = {
      species,
      photo: photoPreview
    }
    sessionStorage.setItem('petProfileData', JSON.stringify(petProfileData))

    // Navigate to pet details page
    router.push('/onboarding/pet-details')
  }

  const handleBack = () => {
    router.push('/signup')
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
    <div className="min-h-screen bg-gray-50 p-4">
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

          {/* Step 2 - Pet Profile (Active) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3] flex items-center justify-center">
                <span className="text-white font-semibold">2</span>
              </div>
              <span className="text-sm font-medium text-gray-700">Pet Profile</span>
            </div>
          </div>

          {/* Connector */}
          <div className="w-16 h-1 bg-gray-300"></div>

          {/* Step 3 - Basic Details (Pending) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 font-semibold">3</span>
              </div>
              <span className="text-sm font-medium text-gray-500">Basic Details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#5A7C7A] mb-3">Let's Meet your furry friend</h1>
          <p className="text-gray-600">
            To get started with PawSync, we need to create a profile<br />
            for at least one pet. What type of pet do you have?
          </p>
        </div>

        {/* Species Selection */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Select your pet's species
          </label>
          <div className="grid grid-cols-2 gap-6">
            {/* Dog Option */}
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

            {/* Cat Option */}
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
                  species === 'cat' ? 'bg-gray-300' : 'bg-gray-300'
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
            {/* Photo Preview/Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-32 h-32 bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#7FA5A3] transition-colors overflow-hidden"
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

            {/* Photo Upload Instructions */}
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
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <button
            type="button"
            onClick={handleContinue}
            className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
