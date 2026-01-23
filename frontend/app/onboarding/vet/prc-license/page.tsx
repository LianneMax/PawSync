'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowLeft, ArrowRight, Upload, FileText } from 'lucide-react'

export default function PRCLicensePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [prcNumber, setPrcNumber] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [prcFile, setPrcFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPrcFile(file)
      setFileName(file.name)
    }
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()

    // Store PRC license data in sessionStorage
    const prcLicenseData = {
      firstName,
      lastName,
      middleName,
      suffix,
      prcNumber,
      registrationDate,
      expirationDate,
      fileName
    }
    sessionStorage.setItem('prcLicenseData', JSON.stringify(prcLicenseData))

    // Navigate to clinic selection page
    router.push('/onboarding/vet/select-clinic')
  }

  const handleBack = () => {
    router.push('/signup')
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

          {/* Step 2 - PRC License (Active) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/30 border-2 border-[#7FA5A3] flex items-center justify-center">
                <span className="text-[#5A7C7A] font-semibold">2</span>
              </div>
              <span className="text-sm font-medium text-gray-700">PRC License</span>
            </div>
          </div>

          {/* Connector */}
          <div className="w-16 h-1 bg-gray-300"></div>

          {/* Step 3 - Select Clinic (Pending) */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 font-semibold">3</span>
              </div>
              <span className="text-sm font-medium text-gray-500">Select Clinic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
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

        <form onSubmit={handleContinue}>
          {/* Full Name Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Full Name (as it appears on PRC ID)
            </h3>

            {/* First Name and Last Name */}
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

            {/* Middle Name and Suffix */}
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

            {/* PRC Registration Number */}
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

            {/* Registration and Expiration Dates */}
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
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
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
