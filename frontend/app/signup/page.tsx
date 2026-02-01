'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Mail, Lock, User, Heart, Stethoscope } from 'lucide-react'
import { register } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

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
  const { login: storeLogin } = useAuthStore()
  const [userType, setUserType] = useState<UserType>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    if (!userType) {
      setError('Please select user type')
      return
    }

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match!")
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const response = await register(firstName, lastName, email, password, confirmPassword, userType)

      if (response.status === 'ERROR') {
        setError(response.message)
        setLoading(false)
        return
      }

      if (response.data) {
        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)

        sessionStorage.setItem('signupData', JSON.stringify({
          userType,
          firstName,
          lastName,
          email
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

  const handleGoogleSignIn = () => {
    console.log('Google sign-in')
  }

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

            <form onSubmit={handleSubmit}>
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                  {error}
                </div>
              )}

              {/* User Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Pet Owner Button */}
                  <button
                    type="button"
                    onClick={() => setUserType('pet-owner')}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                      userType === 'pet-owner'
                        ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-700">Pet Owner</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      userType === 'pet-owner' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                    }`}>
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                  </button>

                  {/* Veterinarian Button */}
                  <button
                    type="button"
                    onClick={() => setUserType('veterinarian')}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                      userType === 'veterinarian'
                        ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-700">Veterinarian</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      userType === 'veterinarian' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                    }`}>
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Name Inputs - Side by Side */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="mb-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Create Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="mb-6">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#7FA5A3] text-white rounded-xl hover:bg-[#6B9290] transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Login'}
              </button>

              {/* Divider */}
              <div className="flex items-center mb-6">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-gray-500 text-sm">or continue with</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>

              {/* Login Link */}
              <p className="text-center mt-6 text-gray-700">
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
