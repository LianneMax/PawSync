'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Mail, Lock, User, Building2, Eye, EyeOff } from 'lucide-react'
import { register } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

const slides = [
  { image: '/images/illustrations/slide-1.png' },
  { image: '/images/illustrations/slide-2.png' },
  { image: '/images/illustrations/slide-3.png' },
  { image: '/images/illustrations/slide-4.png' },
  { image: '/images/illustrations/slide-5.png' },
]

const SLIDE_DURATION = 3000

export default function ClinicSignupPage() {
  const router = useRouter()
  const { login: storeLogin } = useAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [currentSlide, setCurrentSlide] = useState(0)
  const [exitingSlide, setExitingSlide] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % slides.length
        setExitingSlide(prev)
        setTimeout(() => setExitingSlide(null), 700)
        return next
      })
    }, SLIDE_DURATION)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const newFieldErrors: Record<string, string> = {}
    if (!firstName.trim()) newFieldErrors.firstName = 'This field is required'
    if (!lastName.trim()) newFieldErrors.lastName = 'This field is required'
    if (!email.trim()) newFieldErrors.email = 'This field is required'
    if (!clinicName.trim()) newFieldErrors.clinicName = 'This field is required'
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
    setLoading(true)

    try {
      const response = await register(firstName, lastName, email, password, 'clinic-admin')

      if (response.status === 'ERROR') {
        setError(response.message)
        setLoading(false)
        return
      }

      if (response.data) {
        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)
        document.cookie = `authToken=${response.data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`

        // Store clinic name in session for onboarding
        sessionStorage.setItem('signupData', JSON.stringify({
          firstName,
          lastName,
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#476B6B] p-4 relative overflow-hidden">
      <div className="auth-background" />

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex relative z-10">
        {/* Left side - Signup Form */}
        <div className="w-full md:w-3/5 p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logos/pawsync-logo-medium-outline.png"
                alt="PawSync Logo"
                width={80}
                height={80}
                priority
              />
            </div>

            <h1
              className="text-4xl text-[#476B6B] mb-2 text-center"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Register Your Clinic
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Building2 className="w-4 h-4 text-[#7FA5A3]" />
              <p className="text-[#7FA5A3] text-sm font-medium">Create an administrator account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Clinic Name */}
              <div className="mb-3">
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Clinic Name"
                    value={clinicName}
                    onChange={(e) => { setClinicName(e.target.value); setFieldErrors(prev => ({ ...prev, clinicName: '' })) }}
                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.clinicName ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                  />
                </div>
                {fieldErrors.clinicName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.clinicName}</p>}
              </div>

              {/* Name row */}
              <div className="mb-3 flex gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setFieldErrors(prev => ({ ...prev, firstName: '' })) }}
                      className={`w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.firstName ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                    />
                  </div>
                  {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.firstName}</p>}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setFieldErrors(prev => ({ ...prev, lastName: '' })) }}
                    className={`w-full px-4 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.lastName ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                  />
                  {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              {/* Email */}
              <div className="mb-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.email ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                  />
                </div>
                {fieldErrors.email && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="mb-3">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                    className={`w-full pl-12 pr-12 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.password ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })) }}
                    className={`w-full pl-12 pr-12 py-3.5 bg-gray-100 rounded-xl border-2 ${fieldErrors.confirmPassword ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#476B6B] text-white rounded-xl hover:bg-[#3a5a5a] transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating account...' : 'Register Clinic'}
              </button>

              <p className="text-center text-[#4F4F4F] text-sm">
                Already have a clinic account?{' '}
                <Link href="/clinic-login" className="text-[#476B6B] hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right side */}
        <div className="hidden md:flex md:w-2/5 bg-linear-to-br from-[#476B6B]/10 to-[#7FA5A3]/10 p-8 flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex flex-col items-center">
            <div className="mb-6 flex justify-center w-full aspect-square relative">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out ${
                    index === currentSlide
                      ? 'opacity-100 translate-x-0'
                      : index === exitingSlide
                        ? 'opacity-0 translate-x-full'
                        : 'opacity-0 -translate-x-full pointer-events-none'
                  }`}
                >
                  <Image src={slide.image} alt={`Slide ${index + 1}`} fill className="object-contain" />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3 mt-8">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`w-10 h-1.5 rounded-full transition-colors duration-300 ${
                    index === currentSlide ? 'bg-[#476B6B]' : 'bg-[#476B6B]/20'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
