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
  Building2,
  FileText,
  CreditCard,
  QrCode,
  Heart,
  Clock,
  AlertTriangle,
  Stethoscope,
  User,
  UserCheck,
  UserX,
  UserMinus,
  UserRoundCog,
  Repeat2,
  ChevronDown,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

type NotificationCategory =
  | 'Appointments'
  | 'Pet Tag Requests'
  | 'System Updates'
  | 'Messages'
  | 'Reminders'
  | 'Others'

type CategoryFilter = 'All' | NotificationCategory
type ReadFilter = 'All' | 'Read' | 'Unread'

const CATEGORY_OPTIONS: CategoryFilter[] = [
  'All',
  'Appointments',
  'Pet Tag Requests',
  'System Updates',
  'Messages',
  'Reminders',
  'Others',
]

const READ_FILTER_OPTIONS: ReadFilter[] = ['All', 'Read', 'Unread']

function inferNotificationCategory(notification: Notification): NotificationCategory {
  const existing = (notification.category || '').trim().toLowerCase()

  if (existing === 'appointments') return 'Appointments'
  if (existing === 'pet tag requests') return 'Pet Tag Requests'
  if (existing === 'system updates') return 'System Updates'
  if (existing === 'messages') return 'Messages'
  if (existing === 'reminders') return 'Reminders'
  if (existing === 'others') return 'Others'

  switch (notification.type) {
    case 'appointment_scheduled':
    case 'appointment_cancelled':
    case 'appointment_completed':
    case 'appointment_rescheduled':
    case 'clinic_new_appointment_booked':
    case 'clinic_appointment_cancelled':
    case 'clinic_appointment_rescheduled':
    case 'appointment_reassigned':
      return 'Appointments'
    case 'clinic_pet_tag_requested':
      return 'Pet Tag Requests'
    case 'appointment_reminder':
    case 'vaccine_due':
    case 'bill_due':
    case 'pregnancy_due_soon':
    case 'pregnancy_overdue':
      return 'Reminders'
    case 'confinement_release_request':
    case 'confinement_release_confirmed':
      return 'Messages'
    case 'clinic_vet_application_submitted':
    case 'clinic_invoice_paid':
    case 'bill_paid':
    case 'pregnancy_confirmed':
    case 'clinic_qr_payment_submitted':
    case 'vet_resignation_submitted':
    case 'vet_resignation_approved':
    case 'vet_resignation_rejected':
    case 'vet_resigned':
    case 'clinic_vet_resignation_review':
      return 'System Updates'
    default:
      return 'Others'
  }
}

function isNotificationRead(notification: Notification): boolean {
  if (typeof notification.read === 'boolean') return notification.read
  if (typeof notification.isRead === 'boolean') return notification.isRead
  return false
}

function getNotificationIcon(type: NotificationType) {
  const IconBubble = ({
    icon: Icon,
    bg,
    fg,
  }: {
    icon: React.ComponentType<{ className?: string }>
    bg: string
    fg: string
  }) => (
    <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-5 h-5 ${fg}`} />
    </div>
  )

  switch (type) {
    case 'appointment_scheduled':
      return <IconBubble icon={CalendarCheck} bg="bg-[#DBEAFE]" fg="text-[#1D4ED8]" />
    case 'appointment_cancelled':
      return <IconBubble icon={CalendarX} bg="bg-[#FEE2E2]" fg="text-[#DC2626]" />
    case 'appointment_completed':
      return <IconBubble icon={CheckCircle2} bg="bg-[#DCFCE7]" fg="text-[#16A34A]" />
    case 'appointment_reminder':
      return <IconBubble icon={CalendarClock} bg="bg-[#EDE9FE]" fg="text-[#7C3AED]" />
    case 'appointment_rescheduled':
      return <IconBubble icon={CalendarArrowUp} bg="bg-[#E0F2FE]" fg="text-[#0369A1]" />
    case 'appointment_reassigned':
      return <IconBubble icon={Repeat2} bg="bg-[#F1F5F9]" fg="text-[#334155]" />
    case 'bill_due':
      return <IconBubble icon={Receipt} bg="bg-[#FEF3C7]" fg="text-[#D97706]" />
    case 'bill_paid':
      return <IconBubble icon={BadgeCheck} bg="bg-[#DCFCE7]" fg="text-[#16A34A]" />
    case 'vaccine_due':
      return <IconBubble icon={Syringe} bg="bg-[#FEF9C3]" fg="text-[#CA8A04]" />
    case 'pet_lost':
      return <IconBubble icon={PawPrint} bg="bg-[#FEE2E2]" fg="text-[#DC2626]" />
    case 'pet_found':
      return <IconBubble icon={CheckCheck} bg="bg-[#DCFCE7]" fg="text-[#16A34A]" />
    case 'clinic_new_appointment_booked':
      return <IconBubble icon={Building2} bg="bg-[#E0F2FE]" fg="text-[#0369A1]" />
    case 'clinic_appointment_cancelled':
      return <IconBubble icon={CalendarX} bg="bg-[#FFE4E6]" fg="text-[#E11D48]" />
    case 'clinic_appointment_rescheduled':
      return <IconBubble icon={CalendarArrowUp} bg="bg-[#ECFEFF]" fg="text-[#0E7490]" />
    case 'clinic_vet_application_submitted':
      return <IconBubble icon={FileText} bg="bg-[#F1F5F9]" fg="text-[#334155]" />
    case 'clinic_pet_tag_requested':
      return <IconBubble icon={PawPrint} bg="bg-[#FFF7ED]" fg="text-[#C2410C]" />
    case 'clinic_invoice_paid':
      return <IconBubble icon={CreditCard} bg="bg-[#DCFCE7]" fg="text-[#15803D]" />
    case 'confinement_release_request':
      return <IconBubble icon={Clock} bg="bg-[#FEF3C7]" fg="text-[#B45309]" />
    case 'confinement_release_confirmed':
      return <IconBubble icon={CheckCircle2} bg="bg-[#DCFCE7]" fg="text-[#16A34A]" />
    case 'pregnancy_confirmed':
      return <IconBubble icon={Heart} bg="bg-[#FCE7F3]" fg="text-[#BE185D]" />
    case 'pregnancy_due_soon':
      return <IconBubble icon={Clock} bg="bg-[#FFF7ED]" fg="text-[#EA580C]" />
    case 'pregnancy_overdue':
      return <IconBubble icon={AlertTriangle} bg="bg-[#FEE2E2]" fg="text-[#B91C1C]" />
    case 'clinic_qr_payment_submitted':
      return <IconBubble icon={QrCode} bg="bg-[#ECFEFF]" fg="text-[#0F766E]" />
    case 'vet_resignation_submitted':
      return <IconBubble icon={User} bg="bg-[#FEF3C7]" fg="text-[#B45309]" />
    case 'vet_resignation_approved':
      return <IconBubble icon={UserCheck} bg="bg-[#DCFCE7]" fg="text-[#15803D]" />
    case 'vet_resignation_rejected':
      return <IconBubble icon={UserX} bg="bg-[#FEE2E2]" fg="text-[#DC2626]" />
    case 'vet_resigned':
      return <IconBubble icon={UserMinus} bg="bg-[#F1F5F9]" fg="text-[#475569]" />
    case 'clinic_vet_resignation_review':
      return <IconBubble icon={UserRoundCog} bg="bg-[#E0E7FF]" fg="text-[#4338CA]" />
    default:
      return <IconBubble icon={BellRing} bg="bg-[#E2E8F0]" fg="text-[#475569]" />
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All')
  const [selectedReadFilter, setSelectedReadFilter] = useState<ReadFilter>('All')

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

  const filteredNotifications = notifications
    .filter((notification) => {
      if (selectedCategory === 'All') return true
      return inferNotificationCategory(notification) === selectedCategory
    })
    .filter((notification) => {
      const read = isNotificationRead(notification)
      if (selectedReadFilter === 'All') return true
      if (selectedReadFilter === 'Read') return read
      return !read
    })

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

  const confirmConfinementRelease = useCallback(async (notification: Notification) => {
    const confinementRecordId = notification.metadata?.confinementRecordId
    if (!confinementRecordId) return

    try {
      await authenticatedFetch(
        `/confinement/${confinementRecordId}/confirm-release`,
        { method: 'PATCH' },
        token || undefined
      )
      await markAsRead(notification._id)
      fetchNotifications()
    } catch (err) {
      console.error('[Notifications] Confirm confinement release failed:', err)
    }
  }, [fetchNotifications, markAsRead, token])

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

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full sm:w-47.5 h-10 px-3 rounded-lg border border-gray-200 bg-white flex items-center justify-between text-sm text-[#4F4F4F]">
                    <span>{selectedCategory === 'All' ? 'All Categories' : selectedCategory}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg">
                  <DropdownMenuRadioGroup value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoryFilter)}>
                    {CATEGORY_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option === 'All' ? 'All Categories' : option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full sm:w-32.5 h-10 px-3 rounded-lg border border-gray-200 bg-white flex items-center justify-between text-sm text-[#4F4F4F]">
                    <span>{selectedReadFilter}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-lg">
                  <DropdownMenuRadioGroup value={selectedReadFilter} onValueChange={(value) => setSelectedReadFilter(value as ReadFilter)}>
                    {READ_FILTER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {filteredNotifications.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
            )}
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => markAsRead(notification._id)}
                className={`rounded-xl border-l-4 p-4 cursor-pointer transition-all ${
                  isNotificationRead(notification)
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
                    {userData.userType === 'veterinarian' && notification.type === 'confinement_release_request' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmConfinementRelease(notification)
                        }}
                        className="mt-2 inline-flex items-center rounded-md bg-[#5A7C7A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#476B6B] transition-colors"
                      >
                        Confirm Release
                      </button>
                    )}
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
