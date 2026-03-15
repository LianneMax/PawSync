'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { Eye, EyeOff, Lock, Mail, Phone, User, X, ChevronDown } from 'lucide-react'
import AvatarUpload from '@/components/avatar-upload'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

// ==================== ACCORDION SECTION ====================

function AccordionSection({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-8 py-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#7FA5A3]">{icon}</span>
          <span className="text-base font-semibold text-[#4F4F4F]">{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`transition-all duration-200 ease-in-out ${
          open ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-8 pb-8 border-t border-gray-100 pt-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// ==================== FORGOT PASSWORD MODAL ====================

type ForgotStep = 'email' | 'otp' | 'reset'

function ForgotPasswordModal({
  initialEmail,
  onClose,
}: {
  initialEmail: string
  onClose: () => void
}) {
  const [step, setStep] = useState<ForgotStep>('email')
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleSendOtp = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setStep('otp')
        setResendCooldown(60)
        toast.success('OTP sent to your email')
      } else {
        setError(data.message || 'Failed to send OTP')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = Array(6).fill('')
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i]
    setOtp(newOtp)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('')
    if (otpValue.length < 6) { setError('Please enter the full 6-digit OTP.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setResetToken(data.data.resetToken)
        setStep('reset')
      } else {
        setError(data.message || 'Invalid OTP')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword) { setError('Please enter a new password.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, newPassword, confirmPassword }),
      })
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        toast.success('Password reset successfully')
        onClose()
      } else {
        setError(data.message || 'Failed to reset password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const STEPS: ForgotStep[] = ['email', 'otp', 'reset']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s
                    ? 'bg-[#476B6B] text-white'
                    : STEPS.indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {STEPS.indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`h-0.5 w-10 mx-1 transition-colors ${
                    STEPS.indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <>
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Forgot Password</h2>
            <p className="text-sm text-gray-400 mb-6">
              We&apos;ll send a 6-digit OTP to your email address.
            </p>
            <div>
              <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#7FA5A3] focus:ring-2 focus:ring-[#7FA5A3]/20 transition-all"
                placeholder="your@email.com"
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full mt-6 py-3 bg-[#3D5A58] hover:bg-[#2F4C4A] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <>
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">Enter OTP</h2>
            <p className="text-sm text-gray-400 mb-6">
              A 6-digit code was sent to{' '}
              <span className="font-medium text-[#4F4F4F]">{email}</span>. It expires in 10 minutes.
            </p>
            <div className="flex gap-2 justify-center mb-3" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl outline-none focus:border-[#7FA5A3] focus:ring-2 focus:ring-[#7FA5A3]/20 transition-all border-gray-200"
                />
              ))}
            </div>
            <div className="text-center mb-4">
              {resendCooldown > 0 ? (
                <span className="text-xs text-gray-400">Resend OTP in {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs text-[#476B6B] hover:underline font-medium disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </div>
            {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.join('').length < 6}
              className="w-full py-3 bg-[#3D5A58] hover:bg-[#2F4C4A] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </>
        )}

        {/* Step 3: Reset Password */}
        {step === 'reset' && (
          <>
            <h2 className="text-xl font-bold text-[#4F4F4F] mb-1">New Password</h2>
            <p className="text-sm text-gray-400 mb-6">Choose a strong password for your account.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#7FA5A3] focus:ring-2 focus:ring-[#7FA5A3]/20 transition-all"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#7FA5A3] focus:ring-2 focus:ring-[#7FA5A3]/20 transition-all"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full mt-6 py-3 bg-[#3D5A58] hover:bg-[#2F4C4A] text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ==================== SETTINGS PAGE ====================

export default function SettingsPage() {
  const { token } = useAuthStore()
  const authUser = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)

  // Accordion open state
  const [profileOpen, setProfileOpen] = useState(true)
  const [passwordOpen, setPasswordOpen] = useState(false)

  // Profile fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')

  // Photo fields
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Errors
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await authenticatedFetch('/users/profile', { method: 'GET' }, token)
        if (res.status === 'SUCCESS') {
          const u = res.data.user
          setFirstName(u.firstName)
          setLastName(u.lastName)
          setEmail(u.email)
          setContactNumber(u.contactNumber || '')
          if (u.photo) {
            setCurrentPhoto(u.photo)
            if (authUser) setUser({ ...authUser, avatar: u.photo })
          }
        }
      } catch {
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const handleSavePhoto = async () => {
    if (!pendingPhoto) return
    setPhotoSaving(true)
    try {
      const res = await authenticatedFetch(
        '/users/profile',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: pendingPhoto }),
        },
        token || undefined
      )
      if (res.status === 'SUCCESS') {
        toast.success('Profile photo updated')
        setCurrentPhoto(pendingPhoto)
        if (authUser) setUser({ ...authUser, avatar: pendingPhoto })
        setPendingPhoto(null)
      } else {
        toast.error(res.message || 'Failed to update photo')
      }
    } catch {
      toast.error('Failed to update photo')
    } finally {
      setPhotoSaving(false)
    }
  }

const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!firstName.trim()) errors.firstName = 'First name is required'
    if (!lastName.trim()) errors.lastName = 'Last name is required'
    if (!email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email'
    if (Object.keys(errors).length) { setProfileErrors(errors); return }
    setProfileErrors({})
    setSaving(true)
    try {
      const res = await authenticatedFetch(
        '/users/profile',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName, email, contactNumber: contactNumber.trim() || null }),
        },
        token || undefined
      )
      if (res.status === 'SUCCESS') {
        toast.success('Profile updated successfully')
        if (authUser) setUser({ ...authUser, firstName, lastName, email })
      } else {
        toast.error(res.message || 'Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.currentPassword = 'Current password is required'
    if (!newPassword) errors.newPassword = 'New password is required'
    else if (newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters'
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your new password'
    else if (newPassword && newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
    if (Object.keys(errors).length) { setPasswordErrors(errors); return }
    setPasswordErrors({})
    setPasswordLoading(true)
    try {
      const res = await authenticatedFetch(
        '/users/change-password',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        },
        token || undefined
      )
      if (res.status === 'SUCCESS') {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(res.message || 'Failed to change password')
      }
    } catch {
      toast.error('Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-[#4F4F4F] mb-1">Account Settings</h1>
        <p className="text-sm text-gray-400 mb-8">Manage your personal information and security settings</p>

        <div className="space-y-4">

          {/* ── Profile Picture ───────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-base font-semibold text-[#4F4F4F] mb-6">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <AvatarUpload
                maxSize={5 * 1024 * 1024}
                onFileChange={(file) => {
                  if (file?.file instanceof File) {
                    const reader = new FileReader()
                    reader.onloadend = () => setPendingPhoto(reader.result as string)
                    reader.readAsDataURL(file.file)
                  } else {
                    setPendingPhoto(null)
                  }
                }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#4F4F4F] mb-1">{firstName} {lastName}</p>
                <p className="text-xs text-gray-400 mb-4">PNG, JPG or WEBP · Max 5MB</p>
                {pendingPhoto && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSavePhoto}
                      disabled={photoSaving}
                      className="px-4 py-2 bg-[#7FA5A3] hover:bg-[#476B6B] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {photoSaving ? 'Saving...' : 'Save Photo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingPhoto(null)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Personal Information (accordion) ─────────────────── */}
          <AccordionSection
            icon={<User className="w-5 h-5" />}
            title="Personal Information"
            open={profileOpen}
            onToggle={() => setProfileOpen((v) => !v)}
          >
            <form onSubmit={handleSaveProfile}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setProfileErrors((p) => ({ ...p, firstName: '' })) }}
                      className={`w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${profileErrors.firstName ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {profileErrors.firstName && <p className="text-red-500 text-xs mt-1">{profileErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); setProfileErrors((p) => ({ ...p, lastName: '' })) }}
                      className={`w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${profileErrors.lastName ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {profileErrors.lastName && <p className="text-red-500 text-xs mt-1">{profileErrors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#4F4F4F] mb-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setProfileErrors((p) => ({ ...p, email: '' })) }}
                    className={`w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${profileErrors.email ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {profileErrors.email && <p className="text-red-500 text-xs mt-1">{profileErrors.email}</p>}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#4F4F4F] mb-2">
                    <Phone className="w-4 h-4" />
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 09171234567"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-5 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#7FA5A3] hover:bg-[#476B6B] text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </AccordionSection>

          {/* ── Change Password (accordion) ───────────────────────── */}
          <AccordionSection
            icon={<Lock className="w-5 h-5" />}
            title="Change Password"
            open={passwordOpen}
            onToggle={() => setPasswordOpen((v) => !v)}
          >
            <form onSubmit={handleChangePassword}>
              <div className="space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPasswordErrors((p) => ({ ...p, currentPassword: '' })) }}
                      className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${passwordErrors.currentPassword ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.currentPassword}</p>}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-[#4F4F4F] mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors((p) => ({ ...p, newPassword: '' })) }}
                      className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${passwordErrors.newPassword ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors((p) => ({ ...p, confirmPassword: '' })) }}
                      className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7FA5A3]/20 focus:border-[#7FA5A3] transition-all ${passwordErrors.confirmPassword ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder="Repeat new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-sm text-[#476B6B] hover:text-[#3a5858] hover:underline font-medium transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-6 py-2.5 bg-[#7FA5A3] hover:bg-[#476B6B] text-white font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </AccordionSection>

        </div>
      </div>

      {showForgotModal && (
        <ForgotPasswordModal
          initialEmail={email}
          onClose={() => setShowForgotModal(false)}
        />
      )}
    </DashboardLayout>
  )
}
