'use client'

import { ReactNode, useEffect, useState } from 'react'
import Navbar from './Navbar'

type UserType = 'pet-owner' | 'veterinarian' | 'clinic-admin'

interface UserData {
  firstName: string
  lastName: string
  email: string
  userType: UserType
  avatar?: string
}

interface DashboardLayoutProps {
  children: ReactNode
  notificationCount?: number
  userType?: UserType // Optional override for user type
}

export default function DashboardLayout({
  children,
  notificationCount = 0,
  userType: userTypeOverride
}: DashboardLayoutProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isNavExpanded, setIsNavExpanded] = useState(true)

  useEffect(() => {
    // Get user data from sessionStorage or auth state
    // In a real app, this would come from your auth context/store
    const signupData = sessionStorage.getItem('signupData')
    if (signupData) {
      const parsed = JSON.parse(signupData)
      setUserData({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        userType: userTypeOverride || (parsed.userType as UserType),
        avatar: parsed.avatar
      })
    } else {
      // Default fallback for development
      setUserData({
        firstName: 'Lianne',
        lastName: 'Balbastro',
        email: 'lianne_balbastro@dlsu.edu.ph',
        userType: userTypeOverride || 'pet-owner'
      })
    }
  }, [userTypeOverride])

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        userType={userData.userType}
        userName={`${userData.firstName} ${userData.lastName}`.trim()}
        userEmail={userData.email}
        userAvatar={userData.avatar}
        notificationCount={notificationCount}
        isExpanded={isNavExpanded}
        onToggle={setIsNavExpanded}
      />

      {/* Main Content Area - adjusts margin based on navbar state */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          isNavExpanded ? 'ml-72' : 'ml-20'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
