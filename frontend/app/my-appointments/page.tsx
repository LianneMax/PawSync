'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
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
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'

const appointmentModes = [
  { value: 'online', label: 'Online', icon: Video },
  { value: 'face-to-face', label: 'Face to Face', icon: Users },
]

const faceToFaceTypes = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'check-up', label: 'Check Up' },
]

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

// ---- Generate mock slots when backend isn't connected ----
function generateMockSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = 7; h < 17; h++) {
    const hStr = h.toString().padStart(2, '0')
    const nextH = (h + 1).toString().padStart(2, '0')
    slots.push({ startTime: `${hStr}:00`, endTime: `${hStr}:30`, status: 'available' })
    slots.push({ startTime: `${hStr}:30`, endTime: `${nextH}:00`, status: 'available' })
  }
  // Mark some as unavailable for demo
  slots[0].status = 'unavailable'
  slots[7].status = 'unavailable'
  slots[12].status = 'unavailable'
  return slots
}

// ---- Dropdown component ----
function Dropdown({
  label,
  value,
  placeholder,
  options,
  onSelect,
}: {
  label: string
  value: string
  placeholder: string
  options: { value: string; label: string }[]
  onSelect: (val: string) => void
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
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(opt.value); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F6F2] transition-colors ${
                  opt.value === value ? 'bg-[#7FA5A3]/10 text-[#5A7C7A] font-medium' : 'text-[#4F4F4F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

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

  const handleCancel = async (id: string) => {
    try {
      const res = await cancelAppointment(id, token || undefined)
      if (res.status === 'SUCCESS') {
        toast.success('Appointment cancelled')
        loadAppointments()
      } else {
        toast.error(res.message || 'Failed to cancel')
      }
    } catch {
      toast.error('An error occurred')
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
        <div className="flex items-center justify-between mt-6 mb-6">
          <div className="flex items-center bg-[#7FA5A3]/15 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-8 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'upcoming'
                  ? 'bg-[#7FA5A3] text-white shadow-sm'
                  : 'text-[#5A7C7A] hover:text-[#476B6B]'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('previous')}
              className={`px-8 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'previous'
                  ? 'bg-[#7FA5A3] text-white shadow-sm'
                  : 'text-[#5A7C7A] hover:text-[#476B6B]'
              }`}
            >
              Previous
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-[#7FA5A3] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#6b9391] transition-colors"
          >
            Set an appointment
          </button>
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((appt) => (
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
                      <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-[#7FA5A3]/10 text-[#5A7C7A] capitalize">{t.replace('-', ' ')}</span>
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
                  <p className="text-gray-500 mb-6">No upcoming appointments</p>
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
                  <p className="text-gray-500">No past appointments</p>
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
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
    loadPets()
    loadClinics()
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

  // Load slots when vet + date change
  useEffect(() => {
    if (!selectedVetId || !selectedDate) { setSlots([]); return }
    const load = async () => {
      setLoadingSlots(true)
      try {
        const res = await getAvailableSlots(selectedVetId, selectedDate, token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setSlots(res.data.slots)
        } else {
          setSlots(generateMockSlots())
        }
      } catch {
        setSlots(generateMockSlots())
      } finally {
        setLoadingSlots(false)
      }
    }
    load()
  }, [selectedVetId, selectedDate, token])

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

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleSubmit = async () => {
    if (!selectedPetId) return toast.error('Please select a pet')
    if (!selectedBranchId) return toast.error('Please select a clinic branch')
    if (!selectedVetId) return toast.error('Please select a veterinarian')
    if (!mode) return toast.error('Please select a mode of appointment')
    if (selectedTypes.length === 0) return toast.error('Please select at least one appointment type')
    if (!selectedSlot) return toast.error('Please select a time slot')

    setSubmitting(true)
    try {
      const res = await createAppointment({
        petId: selectedPetId,
        vetId: selectedVetId,
        clinicId: selectedBranchOption?.clinicId || '',
        clinicBranchId: selectedBranchId,
        mode: mode as 'online' | 'face-to-face',
        types: selectedTypes,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      }, token || undefined)

      if (res.status === 'SUCCESS') {
        toast.success('Appointment booked successfully!')
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[900px] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-2">
          <h2 className="text-3xl font-bold text-[#2C3E2D]" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
            Schedule Appointment
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex px-8 pb-8 pt-4 gap-8">
          {/* Left: Form Fields */}
          <div className="flex-1 space-y-5">
            {/* Row 1: Pet + Branch */}
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                label="Select pet"
                value={selectedPetId}
                placeholder="Menu Label"
                options={pets.map((p) => ({ value: p._id, label: p.name }))}
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
              {!selectedBranchId ? (
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
                <div className="grid grid-cols-2 gap-2">
                  {faceToFaceTypes.map((t) => {
                    const isSelected = selectedTypes.includes(t.value)
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleType(t.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors text-left flex items-center gap-2 ${
                          isSelected
                            ? 'border-[#7FA5A3] bg-[#7FA5A3]/10 text-[#5A7C7A]'
                            : 'border-gray-300 bg-white text-[#4F4F4F] hover:border-[#7FA5A3]/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#5A7C7A] border-[#5A7C7A]' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {t.label}
                      </button>
                    )
                  })}
                </div>
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
          <div className="w-[260px] shrink-0">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 h-full flex flex-col">
              {!selectedVetId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">Select a veterinarian to view available slots</p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[340px] pr-1">
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
                            const isAvailable = slot.status === 'available'
                            const isYourBooking = slot.status === 'your-booking'
                            const isUnavailable = slot.status === 'unavailable'

                            let bg = 'bg-[#7FA5A3] hover:bg-[#6b9391] cursor-pointer text-white'
                            if (isYourBooking) bg = 'bg-gray-300 text-gray-600 cursor-default'
                            if (isUnavailable) bg = 'bg-[#900B09] text-white cursor-default'
                            if (isSelected) bg = 'bg-[#476B6B] ring-2 ring-[#476B6B] ring-offset-1 text-white cursor-pointer'

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
                  <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#7FA5A3]" />
                      <span className="text-[10px] text-gray-500">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-gray-300" />
                      <span className="text-[10px] text-gray-500">Your Booking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-[#900B09]" />
                      <span className="text-[10px] text-gray-500">Unavailable</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-center gap-4 px-8 pb-8">
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
