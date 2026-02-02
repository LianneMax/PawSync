'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  Search,
  Home,
  PawPrint,
  Calendar,
  FileText,
  Receipt,
  Bell,
  Settings,
  Users,
  ClipboardList,
  Building2,
  UserCog,
  MoreVertical,
  LogOut,
  User
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type UserType = 'pet-owner' | 'veterinarian' | 'clinic-admin'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavbarProps {
  userType: UserType
  userName?: string
  userEmail?: string
  userAvatar?: string
  notificationCount?: number
  isExpanded?: boolean
  onToggle?: (expanded: boolean) => void
}

// Navigation items for each user type
const navItemsByUserType: Record<UserType, NavItem[]> = {
  'pet-owner': [
    { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-5 h-5" /> },
    { label: 'My Pets', href: '/my-pets', icon: <PawPrint className="w-5 h-5" /> },
    { label: 'Appointments', href: '/my-appointments', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Vaccine Cards', href: '/vaccine-cards', icon: <FileText className="w-5 h-5" /> },
    { label: 'Billing and Invoicing', href: '/billing', icon: <Receipt className="w-5 h-5" /> },
  ],
  'veterinarian': [
    { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-5 h-5" /> },
    { label: 'Appointments', href: '/vet-appointments', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Patient Records', href: '/patient-records', icon: <ClipboardList className="w-5 h-5" /> },
    { label: 'My Schedule', href: '/schedule', icon: <Calendar className="w-5 h-5" /> },
  ],
  'clinic-admin': [
    { label: 'Dashboard', href: '/dashboard', icon: <Home className="w-5 h-5" /> },
    { label: 'Staff Management', href: '/staff', icon: <Users className="w-5 h-5" /> },
    { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Clinic Settings', href: '/clinic-settings', icon: <Building2 className="w-5 h-5" /> },
    { label: 'User Management', href: '/users', icon: <UserCog className="w-5 h-5" /> },
  ],
}

export default function Navbar({
  userType,
  userName = 'User',
  userEmail = 'user@email.com',
  userAvatar,
  notificationCount = 0,
  isExpanded: controlledExpanded,
  onToggle
}: NavbarProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const collapseTimer = useRef<NodeJS.Timeout | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // Expand on hover or while the dropdown menu is open
  const isExpanded = controlledExpanded ?? (isHovering || menuOpen)

  const navItems = navItemsByUserType[userType]

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    setIsHovering(true)
    onToggle?.(true)
  }, [onToggle])

  const handleMouseLeave = useCallback(() => {
    if (menuOpen) return
    setIsHovering(false)
    onToggle?.(false)
  }, [menuOpen, onToggle])

  const handleMenuChange = useCallback((open: boolean) => {
    setMenuOpen(open)
    if (!open) {
      // After menu closes, check if mouse is still over the nav with a small delay
      collapseTimer.current = setTimeout(() => {
        if (navRef.current && !navRef.current.matches(':hover')) {
          setIsHovering(false)
          onToggle?.(false)
        }
      }, 100)
    }
  }, [onToggle])

  return (
    <>
      {/* Navbar */}
      <nav
        ref={navRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-0 h-full bg-[#7FA5A3] transition-all duration-300 ease-in-out z-50 flex flex-col ${
          isExpanded ? 'w-72' : 'w-20'
        }`}
      >

        {/* Header with Logo */}
        <div className="p-4 flex items-center justify-left w-full">
          <div className="flex items-center gap-3 transition-all duration-300">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Image
                src="/images/logos/pawsync-logo-white.png"
                alt="PawSync Logo"
                width={43}
                height={43}
              />
            </div>
            <span
              className={`text-white font-bold text-lg whitespace-nowrap transition-all duration-200 ${
                isExpanded
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-2 pointer-events-none'
              }`}
            >
              PawSync Clinic
            </span>

          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 mb-4">
          {isExpanded ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-white/50 transition-all text-sm"
              />
            </div>
          ) : (
            <button className="w-full flex justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <Search className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white border-l-4 border-white'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    } ${!isExpanded ? 'justify-center px-0' : ''}`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {item.icon}
                    {isExpanded && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Bottom Section */}
        <div className="px-2 pb-4 space-y-1">
          {/* Notifications */}
          <Link
            href="/notifications"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors ${
              !isExpanded ? 'justify-center px-0' : ''
            }`}
            title={!isExpanded ? 'Notifications' : undefined}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-[#7FA5A3] text-xs font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </div>
            {isExpanded && (
              <span className="font-medium flex-1 whitespace-nowrap">Notifications</span>
            )}
            {isExpanded && notificationCount > 0 && (
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full whitespace-nowrap">
                {notificationCount}
              </span>
            )}
          </Link>

          {/* User Profile with Dropdown */}
          <div
            className={`mt-4 p-3 bg-white/10 rounded-xl flex items-center gap-3 ${
              !isExpanded ? 'justify-center' : ''
            }`}
          >
            <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden shrink-0">
              {userAvatar ? (
                <Image src={userAvatar} alt={userName} width={40} height={40} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-gray-400 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {isExpanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate whitespace-nowrap">{userName}</p>
                  <p className="text-white/70 text-sm truncate whitespace-nowrap">{userEmail}</p>
                </div>
                <DropdownMenu open={menuOpen} onOpenChange={handleMenuChange}>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-white/70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" className="w-48 mb-2">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/notifications" className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Notifications
                        {notificationCount > 0 && (
                          <span className="ml-auto text-xs bg-[#7FA5A3] text-white px-1.5 py-0.5 rounded-full">
                            {notificationCount > 99 ? '99+' : notificationCount}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => {
                        logout()
                        router.push('/login')
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
