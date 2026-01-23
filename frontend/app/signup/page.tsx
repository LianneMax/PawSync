'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, User, Heart, Stethoscope } from 'lucide-react'

type UserType = 'pet-owner' | 'veterinarian' | null

export default function SignUpPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<UserType>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert("Passwords don't match!")
      return
    }
    // Handle signup logic here
    console.log('Sign up:', { userType, firstName, lastName, email, password })

    // Store user data in sessionStorage for use in onboarding
    sessionStorage.setItem('signupData', JSON.stringify({
      userType,
      firstName,
      lastName,
      email
    }))

    // Redirect based on user type
    if (userType === 'pet-owner') {
      router.push('/onboarding/pet-profile')
    } else if (userType === 'veterinarian') {
      // Redirect veterinarians to PRC license verification
      router.push('/onboarding/vet/prc-license')
    }
  }

  const handleGoogleSignIn = () => {
    // Handle Google sign-in logic here
    console.log('Google sign-in')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7FA5A3] p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex">
        {/* Left side - Sign Up Form */}
        <div className="w-full md:w-1/2 p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <h1 className="text-5xl font-bold text-[#5A7C7A] mb-3">Sign Up</h1>
            <p className="text-gray-600 mb-8">Register Your PawSync Account</p>

            <form onSubmit={handleSubmit}>
              {/* User Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Pet Owner Button */}
                  <button
                    type="button"
                    onClick={() => setUserType('pet-owner')}
                    className={`p-6 rounded-2xl border-2 transition-all ${
                      userType === 'pet-owner'
                        ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        userType === 'pet-owner' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                      }`}>
                        <Heart className="w-7 h-7 text-white" />
                      </div>
                      <span className="font-medium text-gray-700">Pet Owner</span>
                    </div>
                  </button>

                  {/* Veterinarian Button */}
                  <button
                    type="button"
                    onClick={() => setUserType('veterinarian')}
                    className={`p-6 rounded-2xl border-2 transition-all ${
                      userType === 'veterinarian'
                        ? 'border-[#7FA5A3] bg-[#7FA5A3]/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        userType === 'veterinarian' ? 'bg-[#7FA5A3]' : 'bg-[#7FA5A3]/70'
                      }`}>
                        <Stethoscope className="w-7 h-7 text-white" />
                      </div>
                      <span className="font-medium text-gray-700">Veterinarian</span>
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

              {/* Login Button (Note: The design shows "Login" but this should be "Sign Up") */}
              <button
                type="submit"
                className="w-full py-4 bg-[#7FA5A3] text-white rounded-xl font-semibold hover:bg-[#6B9290] transition-colors mb-6"
              >
                Sign Up
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
                className="w-full py-4 bg-white border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
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
                <Link href="/login" className="text-[#5A7C7A] font-semibold hover:underline">
                  Login here
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right side - Illustration */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-gray-50 to-gray-100 p-12 flex-col items-center justify-center">
          <div className="max-w-md">
            {/* Illustration Placeholder - You'll need to add the actual illustration */}
            <div className="mb-8 flex justify-center">
              <div className="w-80 h-80 bg-[#7FA5A3]/20 rounded-full flex items-center justify-center">
                <div className="w-64 h-64 bg-[#7FA5A3]/30 rounded-full flex items-center justify-center">
                  <svg
                    className="w-32 h-32 text-[#7FA5A3]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
                  </svg>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#5A7C7A] mb-3 text-center">
              Your Pet's Health in Your Pocket
            </h2>
            <p className="text-gray-600 text-center leading-relaxed">
              Pet owners can access their pet's complete medical records anytime through the web
              platform.
            </p>

            {/* Progress Dots */}
            <div className="flex justify-center gap-3 mt-8">
              <div className="w-8 h-2 bg-[#7FA5A3] rounded-full"></div>
              <div className="w-8 h-2 bg-[#7FA5A3]/40 rounded-full"></div>
              <div className="w-8 h-2 bg-[#7FA5A3]/40 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
