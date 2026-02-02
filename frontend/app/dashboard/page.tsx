'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Calendar,
  PawPrint,
  FileText,
  Syringe,
  AlertTriangle,
  Plus,
  Clock,
  MapPin,
  Filter,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// --- Types ---
interface Pet {
  id: string
  name: string
  species: string
  breed: string
  sex: string
  age: string
  weight: string
  birthDate: string
  lastVisit: string
  nextVisit: string
  image: string | null
  isLost: boolean
  sterilization: string
  microchipNumber: string
  allergies: string[]
  nfcTagId: string
  vet: { name: string; clinic: string; verified: boolean }
}

// --- Mock Data ---
const mockPets: Pet[] = [
  {
    id: '1',
    name: 'Coco',
    species: 'Dog',
    breed: 'Pomeranian',
    sex: 'Female',
    age: '1 Year Old',
    weight: '2.8 kg',
    birthDate: '12/25/25',
    lastVisit: 'Jan 5',
    nextVisit: 'Jan 25',
    image: null,
    isLost: true,
    sterilization: 'UNNEUTERED',
    microchipNumber: '-',
    allergies: ['Chicken', 'Eggs', 'Milk'],
    nfcTagId: 'PAWSYNC-NFC-001',
    vet: { name: 'Dr. Gino Bailon', clinic: 'BaiVet Animal Clinic', verified: true },
  },
  {
    id: '2',
    name: 'Coco',
    species: 'Dog',
    breed: 'Pomeranian',
    sex: 'Female',
    age: '1 Year Old',
    weight: '2.8 kg',
    birthDate: '12/25/25',
    lastVisit: 'Jan 5',
    nextVisit: 'Jan 25',
    image: null,
    isLost: false,
    sterilization: 'UNNEUTERED',
    microchipNumber: '-',
    allergies: ['Chicken', 'Eggs', 'Milk'],
    nfcTagId: 'PAWSYNC-NFC-002',
    vet: { name: 'Dr. Gino Bailon', clinic: 'BaiVet Animal Clinic', verified: true },
  },
]

const mockAppointments = [
  {
    id: '1',
    title: 'Rabies Vaccination',
    date: new Date(2026, 0, 25),
    time: '10:00 am - 10:30 am',
    clinic: 'BaiVet Animal Clinic',
    petName: 'Coco',
    petBreed: 'Pomeranian',
    status: 'CONFIRMED' as const,
  },
  {
    id: '2',
    title: 'Deworming',
    date: new Date(2026, 1, 17),
    time: '10:00 am - 10:30 am',
    clinic: 'BaiVet Animal Clinic',
    petName: 'Coco',
    petBreed: 'Pomeranian',
    status: 'PENDING' as const,
  },
]

const quickActions = [
  {
    label: 'Book Appointment',
    description: 'Schedule a vet visit',
    icon: <Calendar className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/my-appointments',
  },
  {
    label: 'View Pet Records',
    description: 'Access medical history',
    icon: <FileText className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/my-pets',
  },
  {
    label: 'View Vaccine Cards',
    description: 'View Vaccination Cards',
    icon: <Syringe className="w-5 h-5 text-[#7FA5A3]" />,
    href: '/vaccine-cards',
  },
  {
    label: 'Mark Pet as Lost',
    description: 'Report a Missing Pet',
    icon: <AlertTriangle className="w-5 h-5 text-[#7FA5A3]" />,
    href: '#',
  },
]

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getStatusColor(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-500 text-white'
    case 'PENDING':
      return 'bg-amber-500 text-white'
    case 'CANCELLED':
      return 'bg-red-500 text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

// --- Pet Detail Modal ---
function PetDetailModal({
  pet,
  open,
  onClose,
  onReportLost,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
  onReportLost: (pet: Pet) => void
}) {
  if (!pet) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogDescription className="sr-only">Pet profile details for {pet.name}</DialogDescription>
        <div className="flex flex-col lg:flex-row">
          {/* Left Column - Pet Info */}
          <div className="lg:w-1/2 p-6 lg:p-8">
            {/* Avatar */}
            <div className="flex justify-center mb-4">
              <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center">
                <PawPrint className="w-12 h-12 text-gray-400" />
              </div>
            </div>
            {/* Name */}
            <h2
              className="text-2xl font-bold text-center text-gray-900 mb-4"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              {pet.name}
            </h2>
            {/* Breed / Sex / Age pills */}
            <div className="flex justify-center gap-2 mb-6">
              <div className="bg-[#476B6B] text-white rounded-full px-4 py-1.5">
                <p className="text-[10px] text-white/70">Breed</p>
                <p className="text-sm font-semibold -mt-0.5">{pet.breed}</p>
              </div>
              <div className="bg-[#476B6B] text-white rounded-full px-4 py-1.5">
                <p className="text-[10px] text-white/70">Sex</p>
                <p className="text-sm font-semibold -mt-0.5">{pet.sex}</p>
              </div>
              <div className="bg-[#476B6B] text-white rounded-full px-4 py-1.5">
                <p className="text-[10px] text-white/70">Age</p>
                <p className="text-sm font-semibold -mt-0.5">{pet.age}</p>
              </div>
            </div>
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#F8F6F2] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Weight</p>
                <p className="text-base font-bold text-gray-900">{pet.weight.replace(' kg', '')} KG</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Birth Date</p>
                <p className="text-base font-bold text-gray-900">{pet.birthDate}</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sterilization</p>
                <p className="text-base font-bold text-gray-900">{pet.sterilization}</p>
              </div>
              <div className="bg-[#F8F6F2] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Microchip Number</p>
                <p className="text-base font-bold text-gray-900">{pet.microchipNumber}</p>
              </div>
            </div>
            {/* Allergies */}
            {pet.allergies.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Known Allergies</p>
                <div className="flex gap-2 flex-wrap">
                  {pet.allergies.map((allergy) => (
                    <span
                      key={allergy}
                      className="bg-[#7FA5A3] text-white px-4 py-1.5 rounded-full text-sm font-medium"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Vet Info */}
            <div className="bg-[#476B6B] rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full shrink-0" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{pet.vet.name}</p>
                <p className="text-white/70 text-xs">{pet.vet.clinic}</p>
              </div>
              {pet.vet.verified && (
                <span className="bg-[#7FA5A3] text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                  PRC Verified
                </span>
              )}
            </div>
          </div>

          {/* Right Column - NFC & Actions */}
          <div className="lg:w-1/2 p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-gray-200 space-y-4">
            {/* NFC Tag Status */}
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="font-semibold text-gray-900 text-sm">NFC Tag Status</p>
              <p className="text-xs text-gray-400 mb-3">Tag ID: {pet.nfcTagId}</p>
              <div className={`rounded-lg p-3 mb-3 ${pet.isLost ? 'bg-red-50' : 'bg-[#F8F6F2]'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${pet.isLost ? 'bg-red-500' : 'bg-green-500'}`} />
                  <p className="text-sm font-medium text-gray-900">
                    {pet.isLost ? 'LOST - Showing Lost Pet Alert' : 'Normal - Showing Pet Profile'}
                  </p>
                </div>
              </div>
              <div className="bg-[#F8F6F2] rounded-lg p-4 min-h-[80px]">
                <p className="text-xs text-gray-400">What Strangers See When Scanning:</p>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => {/* navigate to book appointment */}}
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">Book Appointment</p>
                <p className="text-xs text-gray-400">Schedule a Vet Visit for {pet.name}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => {/* navigate to medical records */}}
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">View Medical Records</p>
                <p className="text-xs text-gray-400">Medical History and Reports</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => {/* navigate to vaccine card */}}
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">Vaccine Card</p>
                <p className="text-xs text-gray-400">View Vaccination History</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button
              className="w-full border border-gray-200 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              onClick={() => onReportLost(pet)}
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">Report {pet.name} as Lost</p>
                <p className="text-xs text-gray-400">Update NFC tag to show Lost Status</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Report Lost Pet Modal ---
function ReportLostPetModal({
  pet,
  open,
  onClose,
}: {
  pet: Pet | null
  open: boolean
  onClose: () => void
}) {
  const [contactName, setContactName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [message, setMessage] = useState('')

  if (!pet) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] p-6">
        <DialogHeader className="mb-0">
          <DialogTitle
            className="text-2xl font-bold text-[#900B09]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Report Lost Pet
          </DialogTitle>
          <DialogDescription className="sr-only">
            Report {pet.name} as lost
          </DialogDescription>
        </DialogHeader>

        {/* Info Box */}
        <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-[#B71C1C] mb-2">
            What happens when you report a pet as lost?
          </p>
          <p className="text-xs text-gray-700 leading-relaxed">
            When someone scans your pet&apos;s NFC tag, they will see a &quot;LOST PET&quot; alert with your basic
            contact information. This helps strangers who find your pet contact you immediately.
          </p>
          <p className="text-xs text-gray-700 mt-2 leading-relaxed">
            Note that you will be able to see the last scanned location of your pet
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-900 block mb-1.5">Select Pet</label>
            <div className="w-full border border-gray-200 rounded-xl p-3 bg-white text-sm text-gray-700">
              {pet.name} - {pet.breed}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1.5">Name Shown</label>
              <input
                type="text"
                placeholder="Your Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1.5">Contact Number</label>
              <input
                type="text"
                placeholder="+63 123 456 7890"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-900 block mb-1.5">
              Additional Message (Optional)
            </label>
            <textarea
              placeholder="e.g., Please call immediately if found. Reward Offered"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
            />
          </div>
        </div>

        <button
          className="w-full bg-[#900B09] hover:bg-[#7A0A08] text-white font-semibold py-3 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
          onClick={() => {
            toast('Pet Reported as Lost', {
              description: `${pet.name} has been marked as lost. NFC tag updated.`,
              icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
            })
            onClose()
          }}
        >
          <AlertTriangle className="w-4 h-4" />
          Mark as Lost &amp; Update NFC Tag
        </button>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Dashboard ---
export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [userName, setUserName] = useState('User')
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [petModalOpen, setPetModalOpen] = useState(false)
  const [reportLostOpen, setReportLostOpen] = useState(false)
  const [reportLostPet, setReportLostPet] = useState<Pet | null>(null)

  useEffect(() => {
    if (user?.firstName) {
      setUserName(user.firstName)
    } else {
      const signupData = sessionStorage.getItem('signupData')
      if (signupData) {
        const parsed = JSON.parse(signupData)
        setUserName(parsed.firstName || 'User')
      }
    }
  }, [user])

  // Show login toast notifications on first load
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem('justLoggedIn')
    if (justLoggedIn) {
      sessionStorage.removeItem('justLoggedIn')

      setTimeout(() => {
        toast('Vaccination Reminder', {
          description: "Coco's rabies vaccination is due on January, 2026. Schedule an appointment soon!",
          icon: <Syringe className="w-4 h-4 text-yellow-500" />,
        })
      }, 500)

      setTimeout(() => {
        toast('Appointment Confirmed!', {
          description: 'Your appointment at BaiVet Animal Clinic has been confirmed.',
          icon: <Calendar className="w-4 h-4 text-green-500" />,
        })
      }, 1500)
    }
  }, [])

  const handlePetClick = (pet: Pet) => {
    setSelectedPet(pet)
    setPetModalOpen(true)
  }

  const handleReportLost = (pet: Pet) => {
    setPetModalOpen(false)
    setReportLostPet(pet)
    setTimeout(() => setReportLostOpen(true), 200)
  }

  const handleQuickAction = (href: string) => {
    if (href === '#') {
      // Mark Pet as Lost quick action - open report modal for first pet
      if (mockPets.length > 0) {
        setReportLostPet(mockPets[0])
        setReportLostOpen(true)
      }
    } else {
      router.push(href)
    }
  }

  return (
    <DashboardLayout notificationCount={3}>
      <div className="p-4 pt-5 lg:p-6 lg:pt-5 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-[#476B6B] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h1
              className="text-2xl lg:text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Welcome Back, {userName}
            </h1>
            <p className="text-white/80 text-sm lg:text-base">
              Coco has a vaccination due next week. Don&apos;t forget to schedule an appointment!
            </p>
          </div>
          <div className="absolute inset-0 opacity-5">
            <div className="auth-background" />
          </div>
        </div>

        {/* My Pets Section */}
        <section>
          <div className="mb-4">
            <h2
              className="text-xl font-bold text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              My Pets
            </h2>
            <p className="text-sm text-gray-500">Manage your Furry Family Members</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {mockPets.map((pet) => (
              <div
                key={pet.id}
                className={`bg-white rounded-2xl p-5 w-[314px] h-[206px] shrink-0 cursor-pointer hover:shadow-md transition-shadow relative flex flex-col ${
                  pet.isLost
                    ? 'border-2 border-[#900B09]'
                    : 'border border-gray-200'
                }`}
                onClick={() => handlePetClick(pet)}
              >
                {pet.isLost && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#900B09] text-white text-[10px] font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10">
                    Marked as LOST
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
                    <PawPrint className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{pet.name}</p>
                    <p className="text-xs text-gray-500">
                      {pet.breed} | {pet.sex} | {pet.age}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-100 my-2" />
                <div className="flex gap-3 mt-auto">
                  <div className="flex-1 bg-[#F8F6F2] rounded-lg px-3 py-2 text-center">
                    <p className="text-sm font-bold text-gray-900">{pet.weight}</p>
                    <p className="text-[10px] text-gray-400">Weight</p>
                  </div>
                  <div className="flex-1 bg-[#F8F6F2] rounded-lg px-3 py-2 text-center">
                    <p className="text-sm font-bold text-gray-900">{pet.lastVisit}</p>
                    <p className="text-[10px] text-gray-400">Last Visit</p>
                  </div>
                  <div className="flex-1 bg-[#F8F6F2] rounded-lg px-3 py-2 text-center">
                    <p className="text-sm font-bold text-gray-900">{pet.nextVisit}</p>
                    <p className="text-[10px] text-gray-400">Next Visit</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Add New Pet Card */}
            <div
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 w-[314px] h-[206px] shrink-0 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FA5A3] hover:bg-[#F8F6F2] transition-colors"
              onClick={() => router.push('/onboarding/pet')}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700">Add New Pet</p>
              <p className="text-xs text-gray-400 mt-0.5">Register another Furry Friend</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className="mb-4">
            <h2
              className="text-xl font-bold text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Quick Actions
            </h2>
            <p className="text-sm text-gray-500">Common tasks at your Fingertips</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <div
                key={action.label}
                className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-[#7FA5A3] transition-all group"
                onClick={() => handleQuickAction(action.href)}
              >
                <div className="w-10 h-10 bg-[#F8F6F2] rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#7FA5A3]/15 transition-colors">
                  {action.icon}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{action.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{action.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Appointments */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-bold text-[#476B6B]"
              style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
            >
              Upcoming Appointments
            </h2>
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#7FA5A3] transition-colors"
              onClick={() => router.push('/my-appointments')}
            >
              View all
              <Filter className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {mockAppointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex flex-col items-center justify-center bg-[#7FA5A3]/10 rounded-xl w-14 h-14 shrink-0">
                  <span className="text-lg font-bold text-[#7FA5A3] leading-tight">
                    {appt.date.getDate()}
                  </span>
                  <span className="text-[10px] text-[#7FA5A3] font-medium">
                    {monthNames[appt.date.getMonth()]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{appt.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {appt.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {appt.clinic}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-[#F8F6F2] rounded-lg px-3 py-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <PawPrint className="w-3 h-3 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{appt.petName}</p>
                    <p className="text-[10px] text-gray-400">{appt.petBreed}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${getStatusColor(
                    appt.status
                  )}`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Pet Detail Modal */}
      <PetDetailModal
        pet={selectedPet}
        open={petModalOpen}
        onClose={() => setPetModalOpen(false)}
        onReportLost={handleReportLost}
      />

      {/* Report Lost Pet Modal */}
      <ReportLostPetModal
        pet={reportLostPet}
        open={reportLostOpen}
        onClose={() => setReportLostOpen(false)}
      />
    </DashboardLayout>
  )
}
