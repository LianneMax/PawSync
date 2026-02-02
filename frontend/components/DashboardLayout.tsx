'use client'

import { ReactNode, useCallback, useEffect, useState } from 'react'
import Navbar from './Navbar'
import {
  BellRing,
  Syringe,
  CheckCircle2,
  CalendarCheck,
  Calendar,
  CheckCheck,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'

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

  userType?: UserType
}

interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'vaccination' | 'clinic' | 'appointment'
  read: boolean
}

// Mock notifications
const initialNotifications: Notification[] = [
  {
    id: '1',
    title: 'Vaccination Reminder',
    message: "Coco's rabies vaccination is due on January, 2026. Schedule an appointment soon!",
    time: '2 hours ago',
    type: 'vaccination',
    read: false,
  },
  {
    id: '2',
    title: 'Clinic Visit Completed!',
    message: "Coco's rabies vaccination is due on January, 2026. Schedule an appointment soon!",
    time: '2 hours ago',
    type: 'clinic',
    read: false,
  },
  {
    id: '3',
    title: 'Appointment Confirmed!',
    message: "Coco's rabies vaccination is due on January, 2026. Schedule an appointment soon!",
    time: '2 hours ago',
    type: 'appointment',
    read: true,
  },
]

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'vaccination':
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEF9C3] flex items-center justify-center shrink-0">
          <Syringe className="w-5 h-5 text-[#CA8A04]" />
        </div>
      )
    case 'clinic':
      return (
        <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
        </div>
      )
    case 'appointment':
      return (
        <div className="w-10 h-10 rounded-full bg-[#DBEAFE] flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5 text-[#5A7C7A]" />
        </div>
      )
  }
}

export default function DashboardLayout({
  children,
  userType: userTypeOverride
}: DashboardLayoutProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  useEffect(() => {
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
      setUserData({
        firstName: 'Lianne',
        lastName: 'Balbastro',
        email: 'lianne_balbastro@dlsu.edu.ph',
        userType: userTypeOverride || 'pet-owner'
      })
    }
  }, [userTypeOverride])

  // Simulate a new system notification arriving after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      const newNotification: Notification = {
        id: String(Date.now()),
        title: 'New Appointment Scheduled',
        message: 'A new appointment for Coco has been scheduled at BaiVet Animal Clinic on Feb 20, 2026.',
        time: 'Just now',
        type: 'appointment',
        read: false,
      }

      setNotifications((prev) => [newNotification, ...prev])

      toast('New Appointment Scheduled', {
        description: 'A new appointment for Coco has been scheduled at BaiVet Animal Clinic on Feb 20, 2026.',
        icon: <Calendar className="w-4 h-4 text-[#5A7C7A]" />,
      })
    }, 8000)

    return () => clearTimeout(timer)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      <Navbar
        userType={userData.userType}
        userName={`${userData.firstName} ${userData.lastName}`.trim()}
        userEmail={userData.email}
        userAvatar={userData.avatar}
        notificationCount={unreadCount}
        isExpanded={isNavExpanded}
        onToggle={setIsNavExpanded}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-all duration-300 relative ${
          isNavExpanded ? 'ml-72' : 'ml-20'
        }`}
      >
        {/* Sticky notification bell in upper right */}
        <button
          onClick={() => setNotificationsOpen(true)}
          className="fixed top-4 right-4 z-40 w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:bg-[#F8F6F2] transition-all"
        >
          <BellRing className="w-5 h-5 text-[#476B6B] fill-[#476B6B]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#900B09] rounded-full border-2 border-[#F8F6F2]" />
          )}
        </button>

        {children}
      </main>

      {/* Notifications Sheet */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 border-l border-[#7FA5A3]/20">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold text-gray-900">Notifications</SheetTitle>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#73A3A7] hover:text-[#5A7C7A] transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all as read
                </button>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`rounded-xl border-l-4 p-4 cursor-pointer transition-all ${
                  notification.read
                    ? 'bg-[#EFEFEF] border-l-[#EFEFEF] shadow-none hover:shadow-sm'
                    : 'bg-[#DEEDED] border-l-[#73A3A7] shadow-md hover:shadow-lg'
                }`}
              >
                <div className="flex gap-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{notification.title}</p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notification.message}</p>
                    <p className="text-[11px] text-[#73A3A7] mt-2 font-medium">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
