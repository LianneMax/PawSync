//Login Page



'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Lock, X, KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { login, forgotPassword, verifyOtp, resetPassword } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

const slides = [
  {
    image: '/images/illustrations/slide-1.png'

  },
  {
    image: '/images/illustrations/slide-2.png'

  },
  {
    image: '/images/illustrations/slide-3.png'
  },
  {
    image: '/images/illustrations/slide-4.png'
  },
  {
    image: '/images/illustrations/slide-5.png'
  },
]

const SLIDE_DURATION = 3000

type ModalType = null | 'incorrect-password' | 'account-locked' | 'forgot-password' | 'otp' | 'new-password'

export default function LoginPage() {
  const router = useRouter()
  const { login: storeLogin } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [lockMinutes, setLockMinutes] = useState(15)

  // Forgot password flow state
  const [resetEmail, setResetEmail] = useState('')
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Carousel state
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

    if (!email || !password) {
      setError('Please enter email and password')
      return
    }

    setLoading(true)

    try {
      const response = await login(email, password)

      if (response.status === 'ERROR') {
        if (response.code === 'ACCOUNT_LOCKED') {
          if (response.lockUntil) {
            const remaining = Math.ceil((new Date(response.lockUntil).getTime() - Date.now()) / 60000)
            setLockMinutes(remaining > 0 ? remaining : 15)
          }
          setActiveModal('account-locked')
        } else if (response.code === 'INCORRECT_PASSWORD') {
          setActiveModal('incorrect-password')
        } else {
          setError(response.message)
        }
        setLoading(false)
        return
      }

      if (response.data) {
        storeLogin(response.data.user, response.data.token)
        localStorage.setItem('authToken', response.data.token)

        if (rememberMe) {
          localStorage.setItem('rememberEmail', email)
        }

        if (response.data.user.userType === 'pet-owner') {
          router.push('/onboarding/pet-profile')
        } else {
          router.push('/onboarding/vet/prc-license')
        }
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    console.log('Google sign-in')
  }

  const openForgotPassword = () => {
    setResetEmail('')
    setModalError(null)
    setActiveModal('forgot-password')
  }

  const handleForgotPasswordSubmit = async () => {
    if (!resetEmail) {
      setModalError('Please enter your email address')
      return
    }
    setModalLoading(true)
    setModalError(null)
    try {
      const response = await forgotPassword(resetEmail)
      if (response.status === 'SUCCESS') {
        setOtpValues(['', '', '', '', '', ''])
        setActiveModal('otp')
      } else {
        setModalError(response.message)
      }
    } catch {
      setModalError('An error occurred. Please try again.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6)
      const newOtp = [...otpValues]
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || ''
      }
      setOtpValues(newOtp)
      const focusIndex = Math.min(digits.length, 5)
      otpRefs.current[focusIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return

    const newOtp = [...otpValues]
    newOtp[index] = value
    setOtpValues(newOtp)

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpSubmit = async () => {
    const otp = otpValues.join('')
    if (otp.length !== 6) {
      setModalError('Please enter the complete 6-digit code')
      return
    }
    setModalLoading(true)
    setModalError(null)
    try {
      const response = await verifyOtp(resetEmail, otp)
      if (response.status === 'SUCCESS' && response.data?.resetToken) {
        setResetToken(response.data.resetToken)
        setNewPassword('')
        setConfirmNewPassword('')
        setActiveModal('new-password')
      } else {
        setModalError(response.message || 'Invalid OTP')
      }
    } catch {
      setModalError('An error occurred. Please try again.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleResetPasswordSubmit = async () => {
    if (!newPassword || !confirmNewPassword) {
      setModalError('Please fill in both fields')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setModalError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setModalError('Password must be at least 6 characters')
      return
    }
    setModalLoading(true)
    setModalError(null)
    try {
      const response = await resetPassword(resetEmail, resetToken, newPassword, confirmNewPassword)
      if (response.status === 'SUCCESS') {
        setActiveModal(null)
        setError(null)
        // Optionally show success - for now just close and let them login
      } else {
        setModalError(response.message)
      }
    } catch {
      setModalError('An error occurred. Please try again.')
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    setActiveModal(null)
    setModalError(null)
    setModalLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7FA5A3] p-4 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="auth-background" />

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex relative z-10">
        {/* Left side - Login Form */}
        <div className="w-full md:w-3/5 p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Centered Logo */}
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logos/pawsync-logo.png"
                alt="PawSync Logo"
                width={80}
                height={80}
                priority
              />
            </div>

            {/* Welcome Back - Odor Mean Chey font, centered */}
            <h1
              className="text-5xl text-[#5A7C7A] mb-3 text-center"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Welcome Back
            </h1>
            <p className="text-gray-600 mb-8 text-center" style={{ fontFamily: 'var(--font-outfit)' }}>
              Login to your PawSync account
            </p>

            <form onSubmit={handleSubmit}>
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                  {error}
                </div>
              )}

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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between mb-6">
                <label className="flex items-center cursor-pointer">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      rememberMe
                        ? 'bg-[#7FA5A3] border-[#7FA5A3]'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="ml-2 text-gray-700">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-[#5A7C7A] hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#7FA5A3] text-white rounded-xl hover:bg-[#6B9290] transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
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

              {/* Sign Up Link */}
              <p className="text-center mt-6 text-gray-700">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-[#5A7C7A] hover:underline">
                  Sign up here
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

      {/* ===== MODALS ===== */}

      {/* Modal Overlay */}
      {activeModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full p-8 relative animate-in fade-in zoom-in-95 duration-200 ${
              activeModal === 'forgot-password' ? 'max-w-xl' : 'max-w-md'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ---- Incorrect Password Modal ---- */}
            {activeModal === 'incorrect-password' && (
              <div className="text-center">
                <h2
                  className="text-4xl text-[#8B1A1A] mb-4 text-left font-bold italic"
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  Incorrect Password
                </h2>
                <p className="text-gray-700 text-lg text-left mb-8">
                  Your password is incorrect, please try again.
                </p>
                <button
                  onClick={closeModal}
                  className="w-full max-w-xs mx-auto block py-4 bg-[#333] text-white rounded-xl hover:bg-[#444] transition-colors text-lg"
                >
                  Get Started
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeModal()
                    openForgotPassword()
                  }}
                  className="mt-4 text-gray-500 hover:text-gray-700 underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* ---- Account Locked Modal ---- */}
            {activeModal === 'account-locked' && (
              <div className="text-center">
                <h2
                  className="text-4xl text-[#8B1A1A] mb-4 text-left font-bold italic"
                  style={{ fontFamily: 'var(--font-outfit)' }}
                >
                  Account Locked
                </h2>
                <p className="text-gray-700 text-lg text-left mb-8">
                  You have been temporarily locked out.<br />
                  Please try again in {lockMinutes} Minutes
                </p>
                <button
                  onClick={closeModal}
                  className="w-full max-w-xs mx-auto block py-4 bg-[#333] text-white rounded-xl hover:bg-[#444] transition-colors text-lg"
                >
                  Get Started
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeModal()
                    openForgotPassword()
                  }}
                  className="mt-4 text-gray-500 hover:text-gray-700 underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* ---- Forgot Password Modal ---- */}
            {activeModal === 'forgot-password' && (
              <div>
                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Lock icon */}
                <div className="mb-4">
                  <Lock className="w-10 h-10 text-gray-700" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                <p className="text-[#5A7C7A] mb-6">
                  Please enter your email address to reset your password
                </p>

                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    {modalError && (
                      <p className="text-red-500 text-sm mb-2">{modalError}</p>
                    )}

                    {/* Email fieldset */}
                    <fieldset className="border border-gray-300 rounded-lg px-3 pb-3 pt-1 mb-6">
                      <legend className="text-sm text-gray-500 px-1">Email</legend>
                      <input
                        type="email"
                        placeholder="example_name@gmail.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full outline-none text-gray-700 bg-transparent"
                      />
                    </fieldset>

                    {/* Submit button */}
                    <button
                      onClick={handleForgotPasswordSubmit}
                      disabled={modalLoading}
                      className="w-full h-10 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {modalLoading ? 'Sending...' : 'Submit'}
                    </button>

                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full mt-3 text-center text-gray-500 hover:text-gray-700 underline text-sm"
                    >
                      Back to Login
                    </button>
                  </div>

                  {/* Illustration */}
                  <div className="hidden sm:block w-48 h-48 relative shrink-0">
                    <Image
                      src="/images/illustrations/forgot-password.png"
                      alt="Forgot Password"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---- OTP Modal ---- */}
            {activeModal === 'otp' && (
              <div>
                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Key icon */}
                <div className="mb-4">
                  <KeyRound className="w-10 h-10 text-gray-700" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">One Time Pin</h2>
                <p className="text-[#5A7C7A] mb-6">
                  Please enter the 6 digit code sent to your email.
                </p>

                {modalError && (
                  <p className="text-red-500 text-sm mb-3">{modalError}</p>
                )}

                {/* OTP Inputs */}
                <div className="flex justify-center gap-3 mb-6">
                  {otpValues.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`w-12 h-12 text-center text-lg font-semibold rounded-lg border-2 outline-none transition-colors ${
                        digit
                          ? 'border-[#7FA5A3] bg-white'
                          : 'border-gray-200 bg-gray-50'
                      } focus:border-[#5A7C7A] focus:ring-1 focus:ring-[#5A7C7A]`}
                    />
                  ))}
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleOtpSubmit}
                  disabled={modalLoading}
                  className="w-full py-3 bg-[#7FA5A3] text-white rounded-xl hover:bg-[#6B9290] transition-colors disabled:opacity-50 text-lg"
                >
                  {modalLoading ? 'Verifying...' : 'Confirm'}
                </button>
              </div>
            )}

            {/* ---- Create New Password Modal ---- */}
            {activeModal === 'new-password' && (
              <div>
                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Lock icon */}
                <div className="mb-4">
                  <Lock className="w-10 h-10 text-gray-700" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Create New Password</h2>
                <p className="text-[#5A7C7A] mb-6">
                  Please Enter and Confirm New Password
                </p>

                {modalError && (
                  <p className="text-red-500 text-sm mb-3">{modalError}</p>
                )}

                {/* New Password fieldset */}
                <fieldset className="border border-gray-300 rounded-lg px-3 pb-3 pt-1 mb-4">
                  <legend className="text-sm text-gray-500 px-1">New Password:</legend>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full outline-none text-gray-700 bg-transparent"
                  />
                </fieldset>

                {/* Confirm Password fieldset */}
                <fieldset className="border border-gray-300 rounded-lg px-3 pb-3 pt-1 mb-6">
                  <legend className="text-sm text-gray-500 px-1">Confirm Password:</legend>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full outline-none text-gray-700 bg-transparent"
                  />
                </fieldset>

                {/* Submit button */}
                <button
                  onClick={handleResetPasswordSubmit}
                  disabled={modalLoading}
                  className="w-full py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {modalLoading ? 'Updating...' : 'Submit'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
