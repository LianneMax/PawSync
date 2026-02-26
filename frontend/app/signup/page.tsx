'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, User, Heart, Stethoscope, Eye, EyeOff, Phone } from 'lucide-react'
import { register, googleAuth } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { useGoogleLogin } from '@react-oauth/google'

type UserType = 'pet-owner' | 'veterinarian' | null

const slides = [
  { image: '/images/illustrations/slide-1.png' },
  { image: '/images/illustrations/slide-2.png' },
  { image: '/images/illustrations/slide-3.png' },
  { image: '/images/illustrations/slide-4.png' },
  { image: '/images/illustrations/slide-5.png' },
]

const SLIDE_DURATION = 3000

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login: storeLogin } = useAuthStore()
  const [userType, setUserType] = useState<UserType>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [currentSlide, setCurrentSlide] = useState(0)
  const [exitingSlide, setExitingSlide] = useState<number | null>(null)

  // Pre-fill name/email if redirected from login after a Google "no account" response
  useEffect(() => {
    if (searchParams.get('via') === 'google') {
      const pending = sessionStorage.getItem('googlePendingUser')
      if (pending) {
        try {
          const { firstName: gFirst, lastName: gLast, email: gEmail } = JSON.parse(pending)
          if (gFirst) setFirstName(gFirst)
          if (gLast) setLastName(gLast)
          if (gEmail) setEmail(gEmail)
        } catch { /* ignore */ }
      }
    }
  }, [searchParams])

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
    if (!userType) newFieldErrors.userType = 'Please select a user type'
    if (!firstName.trim()) newFieldErrors.firstName = 'This field is required'
    if (!lastName.trim()) newFieldErrors.lastName = 'This field is required'
    if (!email.trim()) newFieldErrors.email = 'This field is required'
    if (!mobileNumber.trim()) newFieldErrors.mobileNumber = 'This field is required'
    if (!password) newFieldErrors.password = 'This field is required'
    if (!confirmPassword) newFieldErrors.confirmPassword = 'This field is required'

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords don't match" })
      return
    }

    if (password.length < 6) {
      setFieldErrors({ password: 'Password must be at least 6 characters' })
      return
    }

    setFieldErrors({})

    setLoading(true)

    try {
      const response = await register(firstName, lastName, email, mobileNumber, password, confirmPassword, userType!)

      if (response.status === 'ERROR') {
        setError(response.message)
        setLoading(false)
        return
      }

      if (response.data) {
        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)
        document.cookie = `authToken=${response.data.token}; path=/; SameSite=Lax`
        document.cookie = `userType=${response.data.user.userType}; path=/; SameSite=Lax`

        sessionStorage.setItem('signupData', JSON.stringify({
          userType,
          firstName,
          lastName,
          email,
          mobileNumber
        }))

        if (userType === 'pet-owner') {
          router.push('/onboarding/pet')
        } else if (userType === 'veterinarian') {
          router.push('/onboarding/vet')
        }
      }
    } catch (err) {
      setError('An error occurred during registration. Please try again.')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // Require role selection before opening Google OAuth
      if (!userType) {
        setFieldErrors({ userType: 'Please select your account type before signing up with Google' })
        return
      }
      setGoogleLoading(true)
      setError(null)
      try {
        const response = await googleAuth(tokenResponse.access_token, userType)

        if (response.status === 'ERROR') {
          setError(response.message)
          return
        }

        if (response.data) {
          const { user, token } = response.data
          storeLogin(user, token)
          localStorage.setItem('authToken', token)
          document.cookie = `authToken=${token}; path=/; SameSite=Lax`
          document.cookie = `userType=${user.userType}; path=/; SameSite=Lax`
          sessionStorage.removeItem('googlePendingUser')
          sessionStorage.setItem('justLoggedIn', 'true')

          if (user.userType === 'pet-owner') {
            router.push('/onboarding/pet')
          } else if (user.userType === 'veterinarian') {
            router.push('/onboarding/vet')
          } else {
            router.push('/dashboard')
          }
        }
      } catch {
        setError('Google sign-up failed. Please try again.')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-up was cancelled or failed. Please try again.')
    }
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7FA5A3] p-4 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="auth-background" />

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex relative z-10">
        {/* Left side - Sign Up Form */}
        <div className="w-full md:w-3/5 p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Sign Up - Odor Mean Chey font, centered */}
            <h1
              className="text-5xl text-[#5A7C7A] mb-3 text-center"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Sign Up
            </h1>
            <p className="text-gray-600 mb-8 text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
              Register Your PawSync Account
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Server Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* User Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#4F4F4F] mb-3">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Pet Owner Button */}
                  <button
                    type="button"
                    onClick={() => { setUserType('pet-owner'); setFieldErrors(prev => ({ ...prev, userType: '' })) }}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                      fieldErrors.userType && !userType
                        ? 'border-red-400 bg-white'
                        : userType === 'pet-owner'
                          ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-[#4F4F4F]">Pet Owner</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      userType === 'pet-owner' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                    }`}>
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                  </button>

                  {/* Veterinarian Button */}
                  <button
                    type="button"
                    onClick={() => { setUserType('veterinarian'); setFieldErrors(prev => ({ ...prev, userType: '' })) }}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                      fieldErrors.userType && !userType
                        ? 'border-red-400 bg-white'
                        : userType === 'veterinarian'
                          ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-[#4F4F4F]">Veterinarian</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      userType === 'veterinarian' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                    }`}>
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </div>
                {fieldErrors.userType && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.userType}</p>}
              </div>

              {/* Name Inputs - Side by Side */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setFieldErrors(prev => ({ ...prev, firstName: '' })) }}
                      className={`w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.firstName ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                    />
                  </div>
                  {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.firstName}</p>}
                </div>
                <div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); setFieldErrors(prev => ({ ...prev, lastName: '' })) }}
                      className={`w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.lastName ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                    />
                  </div>
                  {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              {/* Email Input */}
              <div className="mb-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                    className={`w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.email ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                  />
                </div>
                {fieldErrors.email && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.email}</p>}
              </div>

              {/* Mobile Number Input */}
              <div className="mb-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    name="mobileNumber"
                    autoComplete="tel"
                    placeholder="Mobile Number"
                    value={mobileNumber}
                    onChange={(e) => { setMobileNumber(e.target.value); setFieldErrors(prev => ({ ...prev, mobileNumber: '' })) }}
                    className={`w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.mobileNumber ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                  />
                </div>
                {fieldErrors.mobileNumber && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.mobileNumber}</p>}
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    placeholder="Create Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                    className={`w-full pl-12 pr-12 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.password ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.password}</p>}
              </div>

              {/* Confirm Password Input */}
              <div className="mb-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })) }}
                    className={`w-full pl-12 pr-12 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.confirmPassword ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.confirmPassword}</p>}
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#7FA5A3] text-white rounded-xl hover:bg-[#6B9290] transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>

              {/* Divider */}
              <div className="flex items-center mb-6">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-gray-500 text-sm">or continue with</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* Google Sign Up */}
              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
                disabled={googleLoading}
                className="w-full py-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {googleLoading ? 'Signing up...' : 'Sign up with Google'}
              </button>

              {/* Login Link */}
              <p className="text-center mt-6 text-[#4F4F4F]">
                Already have an account?{' '}
                <Link href="/login" className="text-[#5A7C7A] hover:underline">
                  Login here
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right side - Auto-sliding Carousel */}
        <div className="hidden md:flex md:w-2/5 bg-linear-to-br from-gray-50 to-gray-100 p-8 flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex flex-col items-center">
            {/* Slide Image */}
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
                  <Image
                    src={slide.image}
                    alt={`Slide ${index + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>
              ))}
            </div>

            {/* Slide Indicators */}
            <div className="flex justify-center gap-3 mt-8">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`w-10 h-1.5 rounded-full transition-colors duration-300 ${
                    index === currentSlide ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/20'
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
