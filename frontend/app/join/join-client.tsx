'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { PawPrint, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export default function JoinClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { login: storeLogin } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')

  if (!token) {
    return (
      <div className="min-h-screen bg-[#7FA5A3] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">This invitation link is missing or malformed.</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter your first and last name.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/activate-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName, lastName, password }),
      })
      const data = await res.json()

      if (data.status === 'SUCCESS' && data.data) {
        const { user, token: jwt } = data.data
        storeLogin(user, jwt)
        localStorage.setItem('authToken', jwt)
        document.cookie = `authToken=${jwt}; path=/; SameSite=Lax`
        document.cookie = `userType=${user.userType}; path=/; SameSite=Lax`
        setStatus('success')
        setTimeout(() => router.push('/dashboard'), 2000)
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
          <CheckCircle className="w-14 h-14 text-[#476B6B] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#4F4F4F] mb-2">Welcome to PawSync!</h2>
          <p className="text-gray-500 text-sm">Your account is ready. Taking you to your dashboard&hellip;</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#7FA5A3] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-br from-[#476B6B] to-[#5A8A8A] px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <PawPrint className="w-7 h-7 text-white" />
            <span className="text-white font-bold text-xl tracking-wide">PawSync</span>
          </div>
          <h1 className="text-white text-2xl font-bold mb-1">A pet is waiting for you!</h1>
          <p className="text-white/80 text-sm">Set up your account to accept the transfer</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
          <p className="text-sm text-gray-500 text-center">
            Your pet&apos;s profile and records are already in your account &mdash; just complete your details below.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">First Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Jane"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Last Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Smith"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                required
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4F4F4F] mb-1">Confirm Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                required
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {(errorMessage || status === 'error') && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
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
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#476B6B] hover:bg-[#3a5a5a] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Setting up your account&hellip;</>
            ) : (
              <><PawPrint className="w-4 h-4" />Accept Transfer &amp; Get Started</>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By continuing you agree to PawSync&apos;s terms of service.
          </p>
        </form>
      </div>
    </div>
  )
}
