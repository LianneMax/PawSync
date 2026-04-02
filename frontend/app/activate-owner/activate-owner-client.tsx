'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { PawPrint, Lock, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export default function ActivateOwnerClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { login: storeLogin } = useAuthStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!token) {
    return (
      <div className="min-h-screen bg-[#7FA5A3] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm mb-6">This invitation link is missing or malformed. Please check your email for the correct link.</p>
          <Link href="/login" className="text-[#5A7C7A] text-sm hover:underline">Back to Login</Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const newFieldErrors: Record<string, string> = {}
    if (!password) newFieldErrors.password = 'Password is required'
    else if (password.length < 8) newFieldErrors.password = 'Password must be at least 8 characters'
    if (!confirmPassword) newFieldErrors.confirmPassword = 'Please confirm your password'
    else if (password !== confirmPassword) newFieldErrors.confirmPassword = 'Passwords do not match'

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/auth/activate-pet-owner-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json()

      if (data.status === 'SUCCESS' && data.data) {
        const { user, token: jwt } = data.data
        storeLogin(user as any, jwt)
        localStorage.setItem('authToken', jwt)
        document.cookie = `authToken=${jwt}; path=/; SameSite=Lax`
        document.cookie = `userType=${user.userType}; path=/; SameSite=Lax`
        sessionStorage.setItem('justLoggedIn', 'true')
        setStatus('success')
        setTimeout(() => router.push('/dashboard'), 2500)
      } else {
        setErrorMessage(data.message || 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setErrorMessage('Unable to connect. Please check your connection and try again.')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#7FA5A3] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <CheckCircle className="w-14 h-14 text-[#7FA5A3] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Account Activated!</h2>
          <p className="text-gray-500 text-sm">Welcome to PawSync! Taking you to your dashboard&hellip;</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#7FA5A3] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#476B6B] to-[#5A8A8A] px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image
              src="/images/logos/pawsync-logo-white.png"
              alt="PawSync"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-white font-bold text-xl tracking-wide">PawSync</span>
          </div>
          <h1 className="text-white text-2xl font-bold mb-1">Activate Your Account</h1>
          <p className="text-white/80 text-sm">Your clinic has created a PawSync account for you</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          <p className="text-sm text-gray-500 text-center">
            Set a secure password to activate your account and access your pet&apos;s records, appointments, and more.
          </p>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                placeholder="Min. 8 characters"
                className={`w-full pl-11 pr-11 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${
                  fieldErrors.password ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })) }}
                placeholder="Re-enter your password"
                className={`w-full pl-11 pr-11 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all ${
                  fieldErrors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* Error */}
          {(errorMessage || status === 'error') && (
            <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-600">{errorMessage}</p>
                {status === 'error' && (
                  <button
                    type="button"
                    onClick={() => { setStatus('form'); setErrorMessage('') }}
                    className="text-xs text-red-500 underline mt-1"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7FA5A3] hover:bg-[#6B9290] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Activating your account&hellip;</>
            ) : (
              <><PawPrint className="w-4 h-4" />Activate My Account</>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-[#5A7C7A] hover:underline">Log in here</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
