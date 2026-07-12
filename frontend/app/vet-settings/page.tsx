'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import AvatarUpload from '@/components/avatar-upload'
import { uploadImage } from '@/lib/upload'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import type { ReportStyleProfile } from '@/lib/users'
import { Mail, Phone, Lock, Camera, Sparkles } from 'lucide-react'

export default function VetSettingsPage() {
  const { token } = useAuthStore()
  const authUser = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Profile state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // AI report style profile (tone/format only; never changes clinical facts)
  const [style, setStyle] = useState<ReportStyleProfile>({})
  const [styleSaving, setStyleSaving] = useState(false)

  // Errors
  const [profileErrors, setProfileErrors] = useState<Record<string, boolean>>({})
  const [passwordErrors, setPasswordErrors] = useState<Record<string, boolean>>({})

  // Tabs
  // Tab state not currently used, but kept for future expansion
  // const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')

  useEffect(() => {
    if (!token) return

    const loadProfile = async () => {
      setLoading(true)
      try {
        const res = await authenticatedFetch('/users/profile', { method: 'GET' }, token)
        if (res.status === 'SUCCESS') {
          const userData = res.data.user
          setFirstName(userData.firstName)
          setLastName(userData.lastName)
          setEmail(userData.email)
          setContactNumber(userData.contactNumber || '')
          if (userData.photo) {
            setCurrentAvatar(userData.photo)
            if (authUser) setUser({ ...authUser, avatar: userData.photo })
          }
          if (userData.reportStyleProfile) setStyle(userData.reportStyleProfile)
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
        toast.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [token])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: Record<string, boolean> = {}
    if (!firstName.trim()) errors.firstName = true
    if (!lastName.trim()) errors.lastName = true
    // Email is read-only (account identity) — not validated or sent.

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors)
      return
    }

    setProfileErrors({})
    setSaving(true)

    try {
      const updateData: { firstName: string; lastName: string; contactNumber?: string; photo?: string } = {
        firstName,
        lastName,
        contactNumber: contactNumber || undefined
      }

      if (profilePhoto) {
        updateData.photo = profilePhoto
      }

      const res = await authenticatedFetch('/users/profile', { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      }, token || undefined)

      if (res.status === 'SUCCESS') {
        toast.success('Profile updated successfully')
        if (res.data.user.photo) {
          setCurrentAvatar(res.data.user.photo)
          if (authUser) setUser({ ...authUser, avatar: res.data.user.photo })
        }
        setProfilePhoto(null)
      } else {
        toast.error(res.message || 'Failed to update profile')
      }
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault()
    setStyleSaving(true)
    try {
      const res = await authenticatedFetch('/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportStyleProfile: style }),
      }, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Report style saved')
      } else {
        toast.error(res.message || 'Failed to save report style')
      }
    } catch (err) {
      console.error('Error saving report style:', err)
      toast.error('Failed to save report style')
    } finally {
      setStyleSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Record<string, boolean> = {}
    if (!currentPassword.trim()) errors.currentPassword = true
    if (!newPassword.trim()) errors.newPassword = true
    if (newPassword.length < 6) errors.newPasswordLength = true
    if (!confirmPassword.trim()) errors.confirmPassword = true
    if (newPassword !== confirmPassword) errors.passwordMismatch = true

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    setPasswordErrors({})
    setPasswordLoading(true)

    try {
      const res = await authenticatedFetch('/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      }, token || undefined)

      if (res.status === 'SUCCESS') {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(res.message || 'Failed to change password')
      }
    } catch (err) {
      console.error('Error changing password:', err)
      toast.error('Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout userType="veterinarian">
        <div className="p-6 lg:p-8">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType="veterinarian">
      <div className="p-6 lg:p-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your profile information and account security"
          className="mb-8"
        />

        {/* Profile Settings Form */}
        <div className="max-w-3xl">
          <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Change Photo Section */}
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-6">Update Profile Photo</h2>
                
                <div className="flex items-center gap-6">
                  {/* Photo Preview with Camera Icon */}
                  <div className="shrink-0 relative">
                    <div className="w-32 h-32 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center shadow-sm border-2 border-gray-300">
                      {currentAvatar || profilePhoto ? (
                        <Image
                          src={profilePhoto ? URL.createObjectURL(new Blob([profilePhoto])) : currentAvatar!}
                          alt="Profile"
                          width={128}
                          height={128}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-[#7FA5A3] to-[#476B6B] flex items-center justify-center">
                          <span className="text-white font-bold text-3xl">
                            {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md border border-gray-200">
                      <Camera className="w-4 h-4 text-[#7FA5A3]" />
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="flex-1">
                    <AvatarUpload
                      maxSize={5 * 1024 * 1024}
                      onFileChange={(file) => {
                        if (file?.file instanceof File) {
                          uploadImage(file.file, 'profiles').then(setProfilePhoto).catch(console.error)
                        } else {
                          setProfilePhoto(null)
                        }
                      }}
                    >
                      <div className="text-center">
                        <p className="text-sm font-medium text-[#4F4F4F] mb-1">Upload a new photo</p>
                        <p className="text-xs text-gray-500">PNG or JPG, up to 5MB</p>
                      </div>
                    </AvatarUpload>
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-6">Personal Information</h2>

                <div className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value)
                          setProfileErrors(prev => ({ ...prev, firstName: false }))
                        }}
                        className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                          profileErrors.firstName ? 'border-[#900B09]/20' : 'border-gray-200'
                        }`}
                      />
                      {profileErrors.firstName && (
                        <p className="text-xs text-[#900B09] mt-1">First name is required</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value)
                          setProfileErrors(prev => ({ ...prev, lastName: false }))
                        }}
                        className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                          profileErrors.lastName ? 'border-[#900B09]/20' : 'border-gray-200'
                        }`}
                      />
                      {profileErrors.lastName && (
                        <p className="text-xs text-[#900B09] mt-1">Last name is required</p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="flex text-sm font-medium text-[#4F4F4F] mb-2 items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      disabled
                      title="Email is your account identity and cannot be changed here"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Your email is your login identity and can&apos;t be changed here. Contact support to update it.</p>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="flex text-sm font-medium text-[#4F4F4F] mb-2 items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Contact Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 rounded-xl bg-[#7FA5A3] text-white font-medium hover:bg-[#476B6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Updating...' : 'Update Settings'}
                  </button>
                </div>
              </div>
            </form>

          {/* AI Report Style Form */}
          <form onSubmit={handleSaveStyle} className="space-y-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#7FA5A3]" />
                  AI Report Style
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Tune the tone and formatting of AI-drafted reports to match how you write. This only
                  affects style, never the clinical facts, which always come from the medical record.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Length</label>
                      <select
                        value={style.verbosity ?? ''}
                        onChange={(e) => setStyle((s) => ({ ...s, verbosity: (e.target.value || undefined) as ReportStyleProfile['verbosity'] }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      >
                        <option value="">No preference</option>
                        <option value="concise">Concise</option>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Structure</label>
                      <select
                        value={style.format ?? ''}
                        onChange={(e) => setStyle((s) => ({ ...s, format: (e.target.value || undefined) as ReportStyleProfile['format'] }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      >
                        <option value="">No preference</option>
                        <option value="prose">Flowing prose</option>
                        <option value="bulleted">Bulleted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Reading level</label>
                      <input
                        type="text"
                        value={style.readingLevel ?? ''}
                        onChange={(e) => setStyle((s) => ({ ...s, readingLevel: e.target.value || undefined }))}
                        placeholder="e.g. grade 8, professional"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Spelling</label>
                      <select
                        value={style.spelling ?? ''}
                        onChange={(e) => setStyle((s) => ({ ...s, spelling: (e.target.value || undefined) as ReportStyleProfile['spelling'] }))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                      >
                        <option value="">No preference</option>
                        <option value="US">US English</option>
                        <option value="UK">UK English</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium text-[#4F4F4F]">
                    <input
                      type="checkbox"
                      checked={style.analogies === false}
                      onChange={(e) => setStyle((s) => ({ ...s, analogies: e.target.checked ? false : undefined }))}
                      className="w-4 h-4 rounded border-gray-300 text-[#7FA5A3] focus:ring-[#7FA5A3]"
                    />
                    Do not use analogies or metaphors
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">Extra style notes (optional)</label>
                    <textarea
                      value={style.extraNotes ?? ''}
                      onChange={(e) => setStyle((s) => ({ ...s, extraNotes: e.target.value || undefined }))}
                      maxLength={300}
                      rows={2}
                      placeholder="e.g. Lead with the diagnosis. Keep sentences short."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                    />
                    <p className="text-xs text-gray-400 mt-1">Tone and formatting only. Clinical facts always come from the record.</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={styleSaving}
                    className="px-6 py-2 rounded-xl bg-[#7FA5A3] text-white font-medium hover:bg-[#476B6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {styleSaving ? 'Saving...' : 'Save Report Style'}
                  </button>
                </div>
              </div>
            </form>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-lg font-semibold text-[#4F4F4F] mb-6 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#7FA5A3]" />
                  Change Password
                </h2>

                <div className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value)
                        setPasswordErrors(prev => ({ ...prev, currentPassword: false }))
                      }}
                      className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                        passwordErrors.currentPassword ? 'border-[#900B09]/20' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-xs text-[#900B09] mt-1">Current password is required</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        setPasswordErrors(prev => ({ ...prev, newPassword: false, newPasswordLength: false }))
                      }}
                      className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                        passwordErrors.newPassword || passwordErrors.newPasswordLength ? 'border-[#900B09]/20' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-xs text-[#900B09] mt-1">New password is required</p>
                    )}
                    {passwordErrors.newPasswordLength && (
                      <p className="text-xs text-[#900B09] mt-1">Password must be at least 6 characters</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-[#4F4F4F] mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setPasswordErrors(prev => ({ ...prev, confirmPassword: false, passwordMismatch: false }))
                      }}
                      className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                        passwordErrors.confirmPassword || passwordErrors.passwordMismatch ? 'border-[#900B09]/20' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-xs text-[#900B09] mt-1">Please confirm your password</p>
                    )}
                    {passwordErrors.passwordMismatch && (
                      <p className="text-xs text-[#900B09] mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-6 py-2 rounded-xl bg-[#7FA5A3] text-white font-medium hover:bg-[#476B6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
