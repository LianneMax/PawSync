'use client'

import { ReactNode, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from './Navbar'
import { useAuthStore } from '@/store/authStore'
import {
  BellRing,
  Syringe,
  CheckCircle2,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  CalendarArrowUp,
  Receipt,
  BadgeCheck,
  PawPrint,
  CheckCheck,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationType,
} from '@/lib/notifications'
import { authenticatedFetch } from '@/lib/auth'

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
  userType?: UserType
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'vaccine_due':
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEF9C3] flex items-center justify-center shrink-0">
          <Syringe className="w-5 h-5 text-[#CA8A04]" />
        </div>
      )
    case 'appointment_completed':
      return (
        <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
        </div>
      )
    case 'appointment_cancelled':
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
          <CalendarX className="w-5 h-5 text-[#DC2626]" />
        </div>
      )
    case 'appointment_reminder':
      return (
        <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-[#7C3AED]" />
        </div>
      )
    case 'appointment_rescheduled':
      return (
        <div className="w-10 h-10 rounded-full bg-[#E0F2FE] flex items-center justify-center shrink-0">
          <CalendarArrowUp className="w-5 h-5 text-[#0369A1]" />
        </div>
      )
    case 'bill_due':
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0">
          <Receipt className="w-5 h-5 text-[#D97706]" />
        </div>
      )
    case 'bill_paid':
      return (
        <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
          <BadgeCheck className="w-5 h-5 text-[#16A34A]" />
        </div>
      )
    case 'pet_lost':
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
          <PawPrint className="w-5 h-5 text-[#DC2626]" />
        </div>
      )
    case 'pet_found':
      return (
        <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
          <PawPrint className="w-5 h-5 text-[#16A34A]" />
        </div>
      )
    case 'appointment_scheduled':
    default:
      return (
        <div className="w-10 h-10 rounded-full bg-[#DBEAFE] flex items-center justify-center shrink-0">
          <CalendarCheck className="w-5 h-5 text-[#5A7C7A]" />
        </div>
      )
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDashboardPath(userType: string): string {
  switch (userType) {
    case 'veterinarian': return '/vet-dashboard'
    case 'clinic-admin': return '/clinic-admin'
    default: return '/dashboard'
  }
}

export default function DashboardLayout({
  children,
  userType: userTypeOverride
}: DashboardLayoutProps) {
  const router = useRouter()
  const authUser = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const token = useAuthStore((state) => state.token)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isNavExpanded, setIsNavExpanded] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Sync avatar from DB on mount so navbar always shows the saved photo
  useEffect(() => {
    if (!authUser || !token || authUser.avatar) return
    authenticatedFetch('/users/profile', { method: 'GET' }, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.user?.photo) {
          setUser({ ...authUser, avatar: res.data.user.photo })
        }
      })
      .catch(() => {/* silent — avatar will just remain unset */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    // If no authenticated user in store, redirect to the appropriate login page
    if (!authUser) {
      router.replace(userTypeOverride === 'clinic-admin' ? '/clinic-login' : '/login')
      return
    }

    // If a specific userType is required for this page, enforce it
    if (userTypeOverride && authUser.userType !== userTypeOverride) {
      router.replace(getDashboardPath(authUser.userType))
      return
    }

    const resolvedUserType: UserType =
      userTypeOverride || (authUser.userType as UserType)

    setUserData({
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      userType: resolvedUserType,
      avatar: authUser.avatar,
    })
  }, [userTypeOverride, authUser, router])

  const fetchNotifications = useCallback(() => {
    if (!authUser) return
    getMyNotifications()
      .then(setNotifications)
      .catch((err) => console.error('[Notifications] fetch error:', err))
  }, [authUser])

  // Fetch on mount
  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // Re-fetch whenever the sheet opens so data is always fresh
  useEffect(() => {
    if (notificationsOpen) fetchNotifications()
  }, [notificationsOpen, fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    )
    await markNotificationRead(id).catch(() => {})
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead().catch(() => {})
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
        <SheetContent side="right" className="w-95 sm:w-105 p-0 border-l border-[#7FA5A3]/20">
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
            {notifications.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
            )}
            {notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => markAsRead(notification._id)}
                className={`rounded-xl border-l-4 p-4 cursor-pointer transition-all ${
                  notification.read
                    ? 'bg-[#EFEFEF] border-l-[#EFEFEF] shadow-none hover:shadow-sm'
                    : 'bg-[#DEEDED] border-l-[#73A3A7] shadow-md hover:shadow-lg'
                }`}
              >
                <div className="flex gap-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#4F4F4F] text-sm">{notification.title}</p>
                    <p className="text-xs text-[#4F4F4F] mt-1 leading-relaxed">{notification.message}</p>
                    <p className="text-[11px] text-[#959595] mt-2 font-medium">{timeAgo(notification.createdAt)}</p>
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
