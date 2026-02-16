'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Building2, Eye, EyeOff, Check, ArrowLeft, ArrowRight, MapPin, Phone, Clock } from 'lucide-react'
import { register } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import ProgressUpload from '@/components/progress-upload'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ClinicSignupPage() {
  const router = useRouter()
  const { login: storeLogin } = useAuthStore()

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1)
  const [slidePhase, setSlidePhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  // Step 1 - Sign Up
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Step 2 - Clinic Logo
  const [clinicLogoBase64, setClinicLogoBase64] = useState('')

  // Step 3 - Branch Details
  const [branchName, setBranchName] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchCity, setBranchCity] = useState('')
  const [branchProvince, setBranchProvince] = useState('')
  const [branchPhone, setBranchPhone] = useState('')
  const [branchEmail, setBranchEmail] = useState('')
  const [openingTime, setOpeningTime] = useState('')
  const [closingTime, setClosingTime] = useState('')
  const [operatingDays, setOperatingDays] = useState<string[]>([])
  const [branchErrors, setBranchErrors] = useState<Record<string, string>>({})

  // Submit state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Step 1 validation
  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const newFieldErrors: Record<string, string> = {}
    if (!clinicName.trim()) newFieldErrors.clinicName = 'This field is required'
    if (!email.trim()) newFieldErrors.email = 'This field is required'
    if (!password) newFieldErrors.password = 'This field is required'
    if (password && password.length < 6) newFieldErrors.password = 'Password must be at least 6 characters'
    if (!confirmPassword) newFieldErrors.confirmPassword = 'This field is required'
    if (password && confirmPassword && password !== confirmPassword) {
      newFieldErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }
    setFieldErrors({})
    goToStep(2)
  }

  // Step 3 validation & submit
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const newBranchErrors: Record<string, string> = {}
    if (!branchAddress.trim()) newBranchErrors.branchAddress = 'This field is required'

    if (Object.keys(newBranchErrors).length > 0) {
      setBranchErrors(newBranchErrors)
      return
    }
    setBranchErrors({})
    setLoading(true)

    try {
      const branchDetails = {
        name: branchName.trim() || `${clinicName} - Main Branch`,
        address: branchAddress.trim(),
        city: branchCity.trim() || undefined,
        province: branchProvince.trim() || undefined,
        phone: branchPhone.trim() || undefined,
        email: branchEmail.trim() || undefined,
        openingTime: openingTime || undefined,
        closingTime: closingTime || undefined,
        operatingDays: operatingDays.length > 0 ? operatingDays : undefined
      }

      // Use clinic name as the admin's display name
      const response = await register(
        clinicName,
        'Admin',
        email,
        password,
        confirmPassword,
        'clinic-admin',
        clinicName,
        branchDetails,
        clinicLogoBase64 || undefined
      )

      if (response.status === 'ERROR') {
        setError(response.message)
        setLoading(false)
        return
      }

      if (response.data) {
        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)
        document.cookie = `authToken=${response.data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`

        sessionStorage.setItem('signupData', JSON.stringify({
          email,
          userType: 'clinic-admin',
          clinicName,
        }))

        sessionStorage.setItem('justLoggedIn', 'true')
        router.push('/clinic-admin')
      }
    } catch {
      setError('An error occurred during registration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day: string) => {
    setOperatingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2] p-4 pb-12 overflow-hidden">
      {/* Header */}
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
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-4">
          {/* Step 1 - Sign Up */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 bg-[#7FA5A3]">
                {currentStep > 1 ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-white font-semibold">1</span>
                )}
              </div>
              <span className="text-sm font-medium text-[#4F4F4F]">Sign Up</span>
            </div>
          </div>

          {/* Connector 1-2 */}
          <div className={`h-1 transition-all duration-500 ease-out ${currentStep >= 2 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`} style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '150ms' }}></div>

          {/* Step 2 - Clinic Logo */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '300ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStep >= 2 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`}>
                {currentStep > 2 ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <span className={`font-semibold transition-colors duration-500 ${currentStep >= 2 ? 'text-white' : 'text-gray-600'}`}>2</span>
                )}
              </div>
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 2 ? 'text-[#4F4F4F]' : 'text-gray-500'}`}>Clinic Logo</span>
            </div>
          </div>

          {/* Connector 2-3 */}
          <div className={`h-1 transition-all duration-500 ease-out ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`} style={{ width: mounted ? '4rem' : '0rem', transitionDelay: '450ms' }}></div>

          {/* Step 3 - Branch Details */}
          <div className="flex items-center transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '600ms' }}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStep >= 3 ? 'bg-[#7FA5A3]' : 'bg-gray-300'}`}>
                <span className={`font-semibold transition-colors duration-500 ${currentStep >= 3 ? 'text-white' : 'text-gray-600'}`}>3</span>
              </div>
              <span className={`text-sm font-medium transition-colors duration-500 ${currentStep >= 3 ? 'text-[#4F4F4F]' : 'text-gray-500'}`}>Branch Details</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sliding Content */}
      <div className={`${shouldAnimate ? 'transition-all duration-300 ease-out' : ''} ${getSlideClass()}`}>

        {/* Step 1 - Sign Up */}
        {currentStep === 1 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12 transition-all duration-500 ease-out" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '400ms' }}>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
                Register Your Clinic
              </h1>
              <p className="text-gray-600">
                Create an administrator account to manage your veterinary clinic
              </p>
            </div>

            <form onSubmit={handleStep1Continue} noValidate>
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Clinic Name */}
              <div className="mb-4">
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Clinic Name*"
                    value={clinicName}
                    onChange={(e) => { setClinicName(e.target.value); setFieldErrors(prev => ({ ...prev, clinicName: '' })) }}
                    className={`w-full pl-12 pr-4 py-4 bg-white rounded-xl border ${fieldErrors.clinicName ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                  />
                </div>
                {fieldErrors.clinicName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.clinicName}</p>}
              </div>

              {/* Email */}
              <div className="mb-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email*"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                    className={`w-full pl-12 pr-4 py-4 bg-white rounded-xl border ${fieldErrors.email ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                  />
                </div>
                {fieldErrors.email && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="mb-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password*"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                    className={`w-full pl-12 pr-12 py-4 bg-white rounded-xl border ${fieldErrors.password ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="mb-8">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm Password*"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })) }}
                    className={`w-full pl-12 pr-12 py-4 bg-white rounded-xl border ${fieldErrors.confirmPassword ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.confirmPassword}</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <Link
                  href="/clinic-login"
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Login
                </Link>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-center text-[#4F4F4F] text-sm mt-6">
                Already have a clinic account?{' '}
                <Link href="/clinic-login" className="text-[#476B6B] hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </form>
          </div>
        )}

        {/* Step 2 - Clinic Logo */}
        {currentStep === 2 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
                Upload Clinic Logo
              </h1>
              <p className="text-gray-600">
                Add your clinic&apos;s logo to help pet owners recognize your brand.
                <br />You can skip this step and upload it later.
              </p>
            </div>

            <div className="mb-8">
              <ProgressUpload
                maxFiles={1}
                multiple={false}
                maxSize={5 * 1024 * 1024}
                accept="image/jpeg,image/png,image/webp"
                simulateUpload={true}
                title="Upload your clinic logo"
                titleClassName="text-[#476B6B]"
                description="A clear, high-quality logo helps build trust with pet owners."
                hint="Accepted file types: JPG, PNG, WEBP (max 5MB)"
                onFilesChange={(files) => {
                  if (files.length > 0 && files[0].file instanceof File) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setClinicLogoBase64(reader.result as string)
                    }
                    reader.readAsDataURL(files[0].file)
                  } else {
                    setClinicLogoBase64('')
                  }
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="px-6 py-4 text-gray-500 hover:text-[#4F4F4F] font-medium transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 - Branch Details */}
        {currentStep === 3 && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-12">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-[#5A7C7A] mb-3">
                Main Branch Details
              </h1>
              <p className="text-gray-600">
                Set up your clinic&apos;s main branch location and contact information.
                <br />You can add more branches later from your dashboard.
              </p>
            </div>

            <form onSubmit={handleFinalSubmit} noValidate>
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Branch Name */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">Branch Name</h3>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={`${clinicName} - Main Branch`}
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-1">Leave blank to use the default name</p>
              </div>

              {/* Location */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">Location</h3>
                <div className="mb-4">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Street Address*"
                      value={branchAddress}
                      onChange={(e) => { setBranchAddress(e.target.value); setBranchErrors(prev => ({ ...prev, branchAddress: '' })) }}
                      className={`w-full pl-12 pr-4 py-4 bg-white rounded-xl border ${branchErrors.branchAddress ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all`}
                    />
                  </div>
                  {branchErrors.branchAddress && <p className="text-xs text-red-500 mt-1 ml-1">{branchErrors.branchAddress}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="City"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Province / Region"
                    value={branchProvince}
                    onChange={(e) => setBranchProvince(e.target.value)}
                    className="w-full px-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Branch Email"
                      value={branchEmail}
                      onChange={(e) => setBranchEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">Operating Hours</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block ml-1">Opening Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="time"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block ml-1">Closing Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="time"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Days */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[#4F4F4F] mb-4">Operating Days</h3>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                        operatingDays.includes(day)
                          ? 'bg-[#7FA5A3] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-[#4F4F4F] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Clinic...' : 'Register Clinic'}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
