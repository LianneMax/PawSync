'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { getMyPets, type Pet } from '@/lib/pets'
import {
  getMyAppointments,
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  type Appointment,
  type TimeSlot,
} from '@/lib/appointments'
import {
  getAllClinicsWithBranches,
  getVetsForBranch,
  type ClinicWithBranches,
  type BranchVet,
} from '@/lib/clinics'
import {
  Calendar,
  Plus,
  Clock,
  X,
  ChevronDown,
  PawPrint,
  Video,
  Users,
  Check,
} from 'lucide-react'
import AppointmentServiceSelector from '@/components/AppointmentServiceSelector'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'

const appointmentModes = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'face-to-face', label: 'Face to Face', icon: Users },
]


// ---- Helper: normalize appointment type to valid enum values ----
function normalizeAppointmentType(type: string): string {
  const typeMap: Record<string, string> = {
    // Normalize capitalized versions
    'Consultation': 'consultation',
    'consultation': 'consultation',
    'General Checkup': 'general-checkup',
    'Vaccination': 'vaccination',
    'Deworming': 'deworming',
    'Sterilization': 'Sterilization',
    'Grooming': 'Grooming',
    'Basic Grooming': 'basic-grooming',
    'Basic grooming': 'basic-grooming',
    'Full Grooming': 'full-grooming',
    'Full grooming': 'full-grooming',
    'General Consultation': 'General Consultation',
    'Preventive Care': 'Preventive Care',
  }
  
  // Return mapped value if exists, otherwise return as-is (already in correct format)
  return typeMap[type] || type
}

// ---- Helper: format time for display ----
function formatSlotTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m}${ampm}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


// ---- Dropdown component ----
function Dropdown({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabledOptions = [],
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onSelect: (val: string) => void
  disabledOptions?: string[]
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div>
      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">{label}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:border-[#7FA5A3] transition-colors text-left text-sm"
        >
          <span className={selected ? 'text-[#4F4F4F]' : 'text-gray-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
            {options.map((opt) => {
              const isDisabled = disabledOptions.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { 
                    if (!isDisabled) {
                      onSelect(opt.value)
                      setOpen(false)
                    }
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    isDisabled
                      ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      : opt.value === value 
                        ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium hover:bg-[#F8F6F2]'
                        : 'text-[#4F4F4F] hover:bg-[#F8F6F2]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {isDisabled && <span className="text-xs text-gray-400">(Lost Pet)</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ========== MAIN PAGE ==========
export default function MyAppointmentsPage() {
  const { token } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous'>('upcoming')
  const [serviceType, setServiceType] = useState<'all' | 'medical' | 'grooming'>('all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  // Filtered appointments based on service type
  const filteredAppointments = appointments.filter((a) => {
    if (serviceType === 'all') return true
    const isGrooming = a.types?.some(t => t === 'basic-grooming' || t === 'full-grooming')
    return serviceType === 'grooming' ? isGrooming : !isGrooming
  })

  // Load appointments
  const loadAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyAppointments(activeTab, token || undefined)
      if (res.status === 'SUCCESS' && res.data) {
        setAppointments(res.data.appointments)
      }
    } catch {
      // silent - will show empty state
    } finally {
      setLoading(false)
    }
  }, [activeTab, token])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  const handleCancel = (id: string) => {
    setAppointmentToCancel(id)
  }

  const confirmCancel = async () => {
    if (!appointmentToCancel) return
    setCancelSubmitting(true)
    try {
      const res = await cancelAppointment(appointmentToCancel, token || undefined)
      if (res.status === 'SUCCESS') {
        // Get appointment details for toast
        const appointment = appointments.find(a => a._id === appointmentToCancel)
        const petName = appointment?.petId?.name || 'the appointment'
        
        toast(
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <X className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Appointment Cancelled</p>
              <p className="text-sm text-gray-600">The appointment for {petName} has been cancelled.</p>
            </div>
          </div>,
          { duration: 5000 }
        )
        loadAppointments()
        setAppointmentToCancel(null)
      } else {
        toast.error(res.message || 'Failed to cancel')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setCancelSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-2">
          <h1
            className="text-[32px] text-[#476B6B]"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Appointments
          </h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and Manage your pet&apos;s appointments</p>
        </div>

        {/* Tabs + Action */}
        <div className="flex items-center justify-between mt-6 mb-4">
          <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('previous')}
              className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === 'previous'
                  ? 'bg-[#476B6B] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[#7FA5A3] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Set an appointment
          </button>
        </div>

        {/* Service Type Filter */}
        <div className="inline-flex bg-white rounded-full p-1 shadow-sm mb-6 border border-gray-100">
          {(['all', 'medical', 'grooming'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setServiceType(type)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                serviceType === type
                  ? 'bg-[#7FA5A3] text-white shadow-sm'
                  : 'text-[#4F4F4F] hover:bg-gray-50'
              }`}
            >
              {type === 'all' ? 'All' : type === 'medical' ? 'Medical Services' : 'Clinic Services'}
            </button>
          ))}
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAppointments.length > 0 ? (
          <div className="space-y-4">
            {filteredAppointments.map((appt) => (
              <div key={appt._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {appt.petId?.photo ? (
                    <img src={appt.petId.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                      <PawPrint className="w-6 h-6 text-[#5A7C7A]" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[#4F4F4F]">{appt.petId?.name || 'Pet'}</p>
                    <p className="text-xs text-gray-500">
                      Dr. {appt.vetId?.firstName} {appt.vetId?.lastName} &middot; {appt.clinicBranchId?.name || appt.clinicId?.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(appt.date)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatSlotTime(appt.startTime)} - {formatSlotTime(appt.endTime)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {appt.types.map((t) => (
                      <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">{t ? t.replace('-', ' ') : ''}</span>
                    ))}
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${
                    appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    appt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    appt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {appt.status}
                  </span>
                  {(appt.status === 'pending' || appt.status === 'confirmed') && activeTab === 'upcoming' && (
                    <button
                      onClick={() => handleCancel(appt._id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              {activeTab === 'upcoming' ? (
                <>
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-6">
                    {serviceType === 'all'
                      ? 'No upcoming appointments'
                      : serviceType === 'medical'
                      ? 'No upcoming medical service appointments'
                      : 'No upcoming clinic service appointments'}
                  </p>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="bg-[#7FA5A3] text-white px-6 py-2 rounded-xl hover:bg-[#6b9391] transition-colors inline-flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Set an Appointment
                  </button>
                </>
              ) : (
                <>
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {serviceType === 'all'
                      ? 'No past appointments'
                      : serviceType === 'medical'
                      ? 'No past medical service appointments'
                      : 'No past clinic service appointments'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule Appointment Modal */}
      <ScheduleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onBooked={() => { setModalOpen(false); loadAppointments() }}
      />

      {/* Cancel Confirmation Modal */}
      <Dialog open={appointmentToCancel !== null} onOpenChange={(open) => { if (!open) setAppointmentToCancel(null) }}>
        <DialogContent className="max-w-md p-0 gap-0 rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[#FEE2E2] rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-[#900B09]" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-center text-[#2C3E2D] mb-2">Cancel Appointment?</DialogTitle>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAppointmentToCancel(null)}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-[#2C3E2D] font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Keep It
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#900B09] text-white font-medium rounded-xl hover:bg-[#7A0A08] transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Appointment'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

// ========== SCHEDULE MODAL ==========
function ScheduleModal({
  open,
  onClose,
  onBooked,
}: {
  open: boolean
  onClose: () => void
  onBooked: () => void
}) {
  const { token } = useAuthStore()

  // Form state
  const [pets, setPets] = useState<Pet[]>([])
  const [clinics, setClinics] = useState<ClinicWithBranches[]>([])
  const [branchVets, setBranchVets] = useState<BranchVet[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [loadingVets, setLoadingVets] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedVetId, setSelectedVetId] = useState('')
  const [mode, setMode] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [isClosedDay, setIsClosedDay] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Helper: grooming/medical checks
  const hasGrooming = selectedTypes.some(t => t === 'basic-grooming' || t === 'full-grooming')
  const hasMedical = selectedTypes.some(t => t !== 'basic-grooming' && t !== 'full-grooming')
  const isGroomingOnly = hasGrooming && !hasMedical

  // Load pets + clinics/branches when modal opens
  useEffect(() => {
    if (!open) return
    const loadPets = async () => {
      try {
        const res = await getMyPets(token || undefined)
        if (res.status === 'SUCCESS' && res.data) setPets(res.data.pets)
      } catch { /* silent */ }
    }
    const loadClinics = async () => {
      try {
        const res = await getAllClinicsWithBranches()
        if (res.status === 'SUCCESS' && res.data) setClinics(res.data.clinics)
      } catch { /* silent */ }
    }
    const loadServices = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        const categories = ['General Consultation', 'Preventive Care', 'Surgeries', 'Grooming']
        const categoryMap: Record<string, any[]> = {}
        
        // Fetch services for each category
        for (const cat of categories) {
          const res = await fetch(
            `${apiUrl}/product-services?type=Service&category=${encodeURIComponent(cat)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          )
          const data = await res.json()
          if (data.status === 'SUCCESS' && data.data?.items) {
            categoryMap[cat] = data.data.items
          }
        }
        
        // Build service categories in the expected format
        const formatted = [
          {
            id: 'general',
            label: 'General Consultation',
            services: (categoryMap['General Consultation'] || []).map((item: any) => ({
              value: item.name,
              label: item.name,
            })),
          },
          {
            id: 'preventive',
            label: 'Preventive Care',
            services: (categoryMap['Preventive Care'] || []).map((item: any) => ({
              value: item.name,
              label: item.name,
            })),
          },
          {
            id: 'surgery',
            label: 'Surgical Procedures',
            services: (categoryMap['Surgeries'] || [])
              .filter((item: any) => item.name === 'Sterilization')
              .map((item: any) => ({
                value: item.name,
                label: item.name,
              })),
          },
          {
            id: 'grooming',
            label: 'Grooming',
            services: (categoryMap['Grooming'] || []).map((item: any) => ({
              value: item.name,
              label: item.name,
            })),
          },
        ]
        setServiceCategories(formatted)
      } catch { /* silent */ }
    }
    loadPets()
    loadClinics()
    loadServices()
  }, [open, token])

  // Load vets when branch changes
  useEffect(() => {
    if (!selectedBranchId) { setBranchVets([]); return }
    const load = async () => {
      setLoadingVets(true)
      try {
        const res = await getVetsForBranch(selectedBranchId, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setBranchVets(res.data.vets)
        } else {
          setBranchVets([])
        }
      } catch {
        setBranchVets([])
      } finally {
        setLoadingVets(false)
      }
    }
    load()
  }, [selectedBranchId, token])

  // Load slots when vet + date change (or grooming + branch + date change)
  useEffect(() => {
    const shouldLoadSlots = isGroomingOnly ? (selectedBranchId && selectedDate) : (selectedVetId && selectedDate)
    if (!shouldLoadSlots) { setSlots([]); setIsClosedDay(false); return }

    const load = async () => {
      setLoadingSlots(true)
      setIsClosedDay(false)
      try {
        let res
        if (isGroomingOnly) {
          // Load grooming slots for the branch
          res = await authenticatedFetch(
            `/appointments/grooming-slots?branchId=${selectedBranchId}&date=${selectedDate}`,
            { method: 'GET' },
            token || undefined
          )
        } else {
          // Load vet slots (medical or mixed)
          res = await getAvailableSlots(selectedVetId, selectedDate, token || undefined, selectedBranchId || undefined)
        }
        
        if (res.status === 'SUCCESS' && res.data) {
          if (res.data.isClosed) {
            setSlots([])
            setIsClosedDay(true)
          } else {
            setSlots(res.data.slots || [])
            setIsClosedDay(false)
          }
        } else {
          setSlots([])
        }
      } catch {
        setSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }
    load()
  }, [selectedVetId, selectedDate, selectedBranchId, token, isGroomingOnly])

  // Reset types when mode changes
  useEffect(() => {
    if (mode === 'online') {
      setSelectedTypes(['consultation'])
    } else {
      setSelectedTypes([])
    }
  }, [mode])

  // Reset vet when branch changes
  useEffect(() => {
    setSelectedVetId('')
    setSelectedSlot(null)
    setSlots([])
  }, [selectedBranchId])

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setSelectedPetId('')
      setSelectedBranchId('')
      setSelectedVetId('')
      setMode('')
      setSelectedTypes([])
      setSelectedSlot(null)
      setSlots([])
      setIsClosedDay(false)
      setBranchVets([])
    }
  }, [open])

  // Build flat list of branches with clinic name for the dropdown
  const branchOptions = clinics.flatMap((clinic) =>
    clinic.branches.map((branch) => ({
      value: branch._id,
      label: `${clinic.name} — ${branch.name}`,
      clinicId: clinic._id,
    }))
  )

  const selectedBranchOption = branchOptions.find((b) => b.value === selectedBranchId)

  const handleTypeChange = (types: string[]) => {
    setSelectedTypes(types)
  }

  // Check for conflicting appointments for the same pet
  const checkForConflicts = async (): Promise<{ hasConflict: boolean; message?: string }> => {
    if (!selectedPetId || !selectedSlot) return { hasConflict: false }

    try {
      // Fetch all appointments for the authenticated user
      const res = await authenticatedFetch(
        `/appointments/mine`,
        { method: 'GET' },
        token || undefined
      )

      if (res.status !== 'SUCCESS' || !res.data?.appointments) {
        return { hasConflict: false }
      }

      // Filter to only appointments for this pet with pending/confirmed status
      const petAppointments = res.data.appointments.filter(
        (apt: any) => apt.petId._id === selectedPetId && (apt.status === 'pending' || apt.status === 'confirmed')
      )

      // Check if booking grooming appointment
      const isGroomingOnly = selectedTypes.some((t) => t === 'basic-grooming' || t === 'full-grooming') &&
        !selectedTypes.some((t) => t !== 'basic-grooming' && t !== 'full-grooming')

      if (isGroomingOnly) {
        // Check for existing grooming appointments on the same day
        const existingGroomingOnDay = petAppointments.find((apt: any) => {
          const aptDateStr = new Date(apt.date).toISOString().split('T')[0]
          return aptDateStr === selectedDate &&
            (apt.types.includes('basic-grooming') || apt.types.includes('full-grooming'))
        })

        if (existingGroomingOnDay) {
          return {
            hasConflict: true,
            message: 'This dog already has a grooming appointment scheduled for this day. Only one grooming appointment per dog is allowed per day.'
          }
        }
      }

      // Check for appointments at the same time
      const existingAtSameTime = petAppointments.find((apt: any) => {
        const aptDateStr = new Date(apt.date).toISOString().split('T')[0]
        return aptDateStr === selectedDate && apt.startTime === selectedSlot.startTime
      })

      if (existingAtSameTime) {
        return {
          hasConflict: true,
          message: 'This dog already has an appointment scheduled at this time. Please choose a different time.'
        }
      }

      return { hasConflict: false }
    } catch (error) {
      // If check fails, allow submission to proceed (backend will catch conflicts)
      return { hasConflict: false }
    }
  }

  const handleSubmit = async () => {
    if (!selectedPetId) return toast.error('Please select a pet')
    if (!selectedBranchId) return toast.error('Please select a clinic branch')
    if (!isGroomingOnly && !selectedVetId) return toast.error('Please select a veterinarian')
    if (!mode) return toast.error('Please select a mode of appointment')
    if (selectedTypes.length === 0) return toast.error('Please select at least one appointment type')
    if (!selectedSlot) return toast.error('Please select a time slot')

    setSubmitting(true)
    try {
      // Check for pet-specific conflicts
      const conflictCheck = await checkForConflicts()
      if (conflictCheck.hasConflict) {
        setSubmitting(false)
        return toast.error(conflictCheck.message || 'Appointment conflict detected')
      }

      // Normalize types to valid enum values and send to backend
      const normalizedTypes = selectedTypes.map(normalizeAppointmentType)
      const res = await createAppointment({
        petId: selectedPetId,
        vetId: selectedVetId,
        clinicId: selectedBranchOption?.clinicId || '',
        clinicBranchId: selectedBranchId,
        mode: mode as 'online' | 'face-to-face',
        types: normalizedTypes,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      }, token || undefined)

      if (res.status === 'SUCCESS') {
        // Get pet name and clinic/branch info for toast
        const pet = pets.find(p => p._id === selectedPetId)
        const selectedBranchOption = clinics.flatMap((clinic) =>
          clinic.branches.map((branch) => ({
            value: branch._id,
            label: `${clinic.name} — ${branch.name}`,
            clinicId: clinic._id,
          }))
        ).find(b => b.value === selectedBranchId)
        
        const petName = pet?.name || 'Your pet'
        const branchName = selectedBranchOption?.label || 'the clinic'
        const appointmentDate = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        
        toast(
          <div className="flex gap-2">
            <Calendar className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">New Appointment Scheduled</p>
              <p className="text-sm text-gray-600">A new appointment for {petName} has been scheduled at {branchName} on {appointmentDate}.</p>
            </div>
          </div>,
          { duration: 5000 }
        )
        onBooked()
      } else {
        toast.error(res.message || 'Failed to book appointment')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by hour for the timetable
  const slotsByHour: Record<number, TimeSlot[]> = {}
  slots.forEach((s) => {
    const hour = parseInt(s.startTime.split(':')[0])
    if (!slotsByHour[hour]) slotsByHour[hour] = []
    slotsByHour[hour].push(s)
  })

  // Check if a time slot has already passed
  const isPastSlot = (slotStartTime: string): boolean => {
    const today = new Date()
    const todayYmd = today.toISOString().split('T')[0]
    
    // If not today, slot is not in the past
    if (selectedDate !== todayYmd) return false
    
    // Compare times
    const [slotHour, slotMin] = slotStartTime.split(':')
    const currentHour = today.getHours()
    const currentMin = today.getMinutes()
    
    const slotTimeInMinutes = parseInt(slotHour) * 60 + parseInt(slotMin)
    const currentTimeInMinutes = currentHour * 60 + currentMin
    
    return slotTimeInMinutes <= currentTimeInMinutes
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-225 max-h-[95vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2 shrink-0">
          <h2 className="text-2xl text-[#476B6B]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
            Schedule Appointment
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex px-8 pb-4 pt-4 gap-8 overflow-y-auto flex-1">
          {/* Left: Form Fields */}
          <div className="flex-1 space-y-5">
            {/* Lost Pet Warning */}
            {selectedPetId && pets.find(p => p._id === selectedPetId)?.isLost && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">⚠️ This pet is marked as lost</p>
                <p className="text-xs text-yellow-700 mt-1">Appointments cannot be scheduled for lost pets. Please update their status once they are found.</p>
              </div>
            )}

            {/* Row 1: Pet + Branch */}
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                label="Select pet"
                value={selectedPetId}
                placeholder="Menu Label"
                options={pets.map((p) => ({ value: p._id, label: p.name }))}
                disabledOptions={pets.filter(p => p.isLost).map(p => p._id)}
                onSelect={setSelectedPetId}
              />
              <Dropdown
                label="Vet Clinic Branch"
                value={selectedBranchId}
                placeholder="Menu Label"
                options={branchOptions}
                onSelect={setSelectedBranchId}
              />
            </div>

            {/* Row 2: Mode + Vet */}
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                label="Mode of Appointment"
                value={mode}
                placeholder="Menu Label"
                options={appointmentModes.map((m) => ({ value: m.value, label: m.label }))}
                onSelect={setMode}
              />
              {isGroomingOnly ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    Not applicable for grooming only
                  </div>
                </div>
              ) : !selectedBranchId ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    Select a clinic branch first
                  </div>
                </div>
              ) : loadingVets ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                    Loading vets...
                  </div>
                </div>
              ) : branchVets.length === 0 ? (
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                    No vets available at this branch
                  </div>
                </div>
              ) : (
                <Dropdown
                  label="Chosen Veterinarian"
                  value={selectedVetId}
                  placeholder="Menu Label"
                  options={branchVets.map((v) => ({ value: v._id, label: `Dr. ${v.firstName} ${v.lastName}` }))}
                  onSelect={setSelectedVetId}
                />
              )}
            </div>

            {/* Row 3: Type of Appointment */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Type of Appointment</p>
              {!mode ? (
                <div className="px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                  Select mode first
                </div>
              ) : mode === 'online' ? (
                <div className="px-4 py-2.5 border border-[#7FA5A3] rounded-xl bg-[#7FA5A3]/5 text-sm text-[#5A7C7A] font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Consultation
                </div>
              ) : (
                <AppointmentServiceSelector
                  values={selectedTypes}
                  onChange={handleTypeChange}
                  categories={serviceCategories}
                />
              )}
            </div>

            {/* Date Picker */}
            <div>
              <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Date</p>
              <DatePicker
                value={selectedDate}
                onChange={(date) => { setSelectedDate(date); setSelectedSlot(null) }}
                placeholder="Select a date"
                allowFutureDates={true}
                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
          </div>

          {/* Right: Time Table */}
          <div className="w-65 shrink-0">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 h-full flex flex-col">
              {!selectedBranchId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a clinic branch to view available slots</p>
                </div>
              ) : !isGroomingOnly && !selectedVetId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a veterinarian to view available slots</p>
                </div>
              ) : !selectedDate ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a date to view available slots</p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isClosedDay ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">{isGroomingOnly ? 'Groomer' : 'Vet'} is not available on this day</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">No available slots for this date</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-0.5 max-h-85 pr-1">
                    {Object.entries(slotsByHour).map(([hour, hourSlots]) => (
                      <div key={hour} className="flex gap-2">
                        {/* Hour label */}
                        <div className="w-10 shrink-0 text-right pt-1">
                          <span className="text-[10px] font-medium text-gray-400">
                            {parseInt(hour) > 12 ? parseInt(hour) - 12 : parseInt(hour)}{parseInt(hour) >= 12 ? 'PM' : 'AM'}
                          </span>
                        </div>
                        {/* Slot blocks */}
                        <div className="flex-1 space-y-0.5">
                          {hourSlots.map((slot) => {
                            const isSelected = selectedSlot?.startTime === slot.startTime
                            const isAvailable = slot.status === 'available' && !isPastSlot(slot.startTime)
                            const isUnavailable = slot.status === 'unavailable' || slot.status === 'your-booking' || isPastSlot(slot.startTime)

                            let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                            if (isUnavailable) bg = 'bg-[#900B09] text-white cursor-default'
                            if (isSelected) bg = 'bg-gray-300 text-gray-600 cursor-pointer'

                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => {
                                  if (isAvailable) setSelectedSlot(slot)
                                }}
                                disabled={!isAvailable}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bg}`}
                              >
                                {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-gray-200 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#7FA5A3]" />
                      <span className="text-[10px] text-gray-500">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      <span className="text-[10px] text-gray-500">Your Booking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#900B09]" />
                      <span className="text-[10px] text-gray-500">Unavailable</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-center gap-4 px-8 pb-8 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-2.5 bg-[#7FA5A3] text-white rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Set an appointment'}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-[#4F4F4F] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
