'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import DashboardLayout from '@/components/DashboardLayout'
import AvatarUpload from '@/components/avatar-upload'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { Mail, Phone, Lock, Camera } from 'lucide-react'

export default function VetSettingsPage() {
  const { token } = useAuthStore()
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
          }
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
    if (!email.trim()) errors.email = true
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.emailFormat = true

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
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setProfilePhoto(reader.result as string)
                          }
                          reader.readAsDataURL(file.file)
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
                          profileErrors.firstName ? 'border-red-400' : 'border-gray-200'
                        }`}
                      />
                      {profileErrors.firstName && (
                        <p className="text-xs text-red-500 mt-1">First name is required</p>
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
                          profileErrors.lastName ? 'border-red-400' : 'border-gray-200'
                        }`}
                      />
                      {profileErrors.lastName && (
                        <p className="text-xs text-red-500 mt-1">Last name is required</p>
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
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setProfileErrors(prev => ({ ...prev, email: false, emailFormat: false }))
                      }}
                      className={`w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent ${
                        profileErrors.email || profileErrors.emailFormat ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />
                    {profileErrors.email && (
                      <p className="text-xs text-red-500 mt-1">Email is required</p>
                    )}
                    {profileErrors.emailFormat && (
                      <p className="text-xs text-red-500 mt-1">Please enter a valid email</p>
                    )}
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
                        passwordErrors.currentPassword ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-xs text-red-500 mt-1">Current password is required</p>
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
                        passwordErrors.newPassword || passwordErrors.newPasswordLength ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-xs text-red-500 mt-1">New password is required</p>
                    )}
                    {passwordErrors.newPasswordLength && (
                      <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
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
                        passwordErrors.confirmPassword || passwordErrors.passwordMismatch ? 'border-red-400' : 'border-gray-200'
                      }`}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Please confirm your password</p>
                    )}
                    {passwordErrors.passwordMismatch && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
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
