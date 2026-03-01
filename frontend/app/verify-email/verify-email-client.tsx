'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { verifyEmail, resendVerificationEmail } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

export default function VerifyEmailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login: storeLogin } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setErrorMessage('No verification token found. Please use the link from your email.')
      setStatus('error')
      return
    }

    verifyEmail(token).then((response) => {
      if (response.status === 'SUCCESS' && response.data) {
        const { user, token: jwt } = response.data
        storeLogin(user, jwt)
        localStorage.setItem('authToken', jwt)
        document.cookie = `authToken=${jwt}; path=/; SameSite=Lax`
        document.cookie = `userType=${user.userType}; path=/; SameSite=Lax`
        sessionStorage.setItem('justLoggedIn', 'true')
        setStatus('success')

        // Redirect to the right onboarding flow after a short delay
        setTimeout(() => {
          if (user.userType === 'pet-owner') {
            router.push('/onboarding/pet')
          } else if (user.userType === 'veterinarian') {
            router.push('/onboarding/vet')
          } else {
            router.push('/dashboard')
          }
        }, 2000)
      } else {
        setErrorMessage(response.message || 'This verification link is invalid or has expired.')
        setStatus('error')
      }
    }).catch(() => {
      setErrorMessage('An error occurred. Please try again.')
      setStatus('error')
    })
  }, [searchParams, storeLogin, router])

  const handleResend = async () => {
    if (!resendEmail.trim()) return
    setResendLoading(true)
    setResendMessage(null)
    try {
      const res = await resendVerificationEmail(resendEmail)
      setResendMessage(res.message)
    } catch {
      setResendMessage('Failed to resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7FA5A3] p-4 relative overflow-hidden">
      <div className="auth-background" />
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-12 relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/images/logos/pawsync-logo-medium-outline.png"
            alt="PawSync Logo"
            width={64}
            height={64}
            priority
          />
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-[#7FA5A3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader className="w-8 h-8 text-[#7FA5A3] animate-spin" />
            </div>
            <h1 className="text-2xl text-[#5A7C7A] mb-2" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              Verifying...
            </h1>
            <p className="text-gray-500">Please wait while we verify your email address.</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl text-[#5A7C7A] mb-2" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              Email Verified!
            </h1>
            <p className="text-gray-500">Your account is now active. Redirecting you to onboarding...</p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl text-[#5A7C7A] mb-2" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
              Link Expired
            </h1>
            <p className="text-gray-500 mb-6">{errorMessage}</p>

            <p className="text-sm text-gray-400 mb-3">Enter your email to get a new verification link:</p>
            <input
              type="email"
              placeholder="Your email address"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 rounded-xl border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all mb-3"
            />

            {resendMessage && (
              <p className="text-sm text-[#5A7C7A] mb-3">{resendMessage}</p>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || !resendEmail.trim()}
              className="w-full py-3 bg-[#7FA5A3] text-white rounded-xl hover:bg-[#6B9290] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {resendLoading ? 'Sending...' : 'Send new verification link'}
            </button>

            <Link href="/login" className="text-sm text-gray-400 hover:text-[#5A7C7A] transition-colors">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
