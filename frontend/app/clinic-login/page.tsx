'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

const slides = [
  { image: '/images/illustrations/slide-1.png' },
  { image: '/images/illustrations/slide-2.png' },
  { image: '/images/illustrations/slide-3.png' },
  { image: '/images/illustrations/slide-4.png' },
  { image: '/images/illustrations/slide-5.png' },
]

const SLIDE_DURATION = 3000

export default function ClinicLoginPage() {
  const router = useRouter()
  const { login: storeLogin } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
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
    if (!email.trim()) newFieldErrors.email = 'This field is required'
    if (!password) newFieldErrors.password = 'This field is required'

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }
    setFieldErrors({})
    setLoading(true)

    try {
      const response = await login(email, password)

      if (response.status === 'ERROR') {
        if (response.code === 'ACCOUNT_LOCKED') {
          setError('Account is temporarily locked. Please try again later.')
        } else if (response.code === 'INCORRECT_PASSWORD') {
          setError('Incorrect email or password.')
        } else {
          setError(response.message)
        }
        setLoading(false)
        return
      }

      if (response.data) {
        // Verify this is a clinic admin account
        if (response.data.user.userType !== 'clinic-admin') {
          setError('This portal is for clinic administrators only. Please use the regular login page.')
          setLoading(false)
          return
        }

        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)

        if (rememberMe) {
          localStorage.setItem('rememberEmail', email)
          document.cookie = `authToken=${response.data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        } else {
          localStorage.removeItem('rememberEmail')
          document.cookie = `authToken=${response.data.token}; path=/; SameSite=Lax`
        }

        sessionStorage.setItem('justLoggedIn', 'true')
        router.push('/clinic-admin')
      }
    } catch {
      setError('An error occurred during login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#476B6B] p-4 relative overflow-hidden">
      <div className="auth-background" />

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex relative z-10">
        {/* Left side - Login Form */}
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

            {/* Header */}
            <h1
              className="text-4xl text-[#476B6B] mb-2 text-center"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Clinic Management
            </h1>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#7FA5A3]" />
              <p className="text-[#7FA5A3] text-sm font-medium">Administration Portal</p>
            </div>
            <p className="text-gray-500 mb-8 text-center text-sm">
              Sign in to manage your clinic, staff, and operations
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="mb-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
                    className={`w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.email ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
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
                    placeholder="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                    className={`w-full pl-12 pr-12 py-4 bg-gray-100 rounded-xl border-2 ${fieldErrors.password ? 'border-red-400' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-[#476B6B] transition-all`}
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

              {/* Remember Me */}
              <div className="flex items-center justify-between mb-6">
                <label className="flex items-center cursor-pointer">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      rememberMe ? 'bg-[#476B6B] border-[#476B6B]' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="ml-2 text-[#4F4F4F]">Remember me</span>
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#476B6B] text-white rounded-xl hover:bg-[#3a5a5a] transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              {/* Links */}
              <div className="text-center space-y-3">
                <p className="text-gray-400 text-sm">
                  Are you a pet owner or veterinarian?{' '}
                  <Link href="/login" className="text-[#7FA5A3] hover:underline">
                    Login here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Right side - Carousel */}
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
