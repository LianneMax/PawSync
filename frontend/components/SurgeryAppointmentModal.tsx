'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getSurgeryServices, type ProductService } from '@/lib/medicalRecords'
import { getAvailableSlots, createAppointment, getClinicBranches, getAssignedVets, type ClinicBranch, type AssignedVet } from '@/lib/appointments'
import { toast } from 'sonner'
import { Clock, AlertCircle, Loader2, Check, ChevronDown, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import SurgeryMedicalRecordModal from '@/components/SurgeryMedicalRecordModal'

interface SurgeryAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petId: string
  petName: string
  clinicId?: string
  clinicBranchId?: string
  vetId?: string
}

interface TimeSlot {
  startTime: string
  endTime: string
  status: 'available' | 'your-booking' | 'unavailable'
}

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
                    {opt.value === value && <Check className="w-4 h-4" />}
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

function formatSlotTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m}${ampm}`
}

export default function SurgeryAppointmentModal({
  open,
  onOpenChange,
  petId,
  petName,
  clinicId,
  clinicBranchId,
  vetId,
}: SurgeryAppointmentModalProps) {
  const token = useAuthStore((s) => s.token)
  const [surgeryServices, setSurgeryServices] = useState<ProductService[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [selectedVetId, setSelectedVetId] = useState(vetId || '')
  const [selectedBranchId, setSelectedBranchId] = useState(clinicBranchId || '')
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [vets, setVets] = useState<AssignedVet[]>([])
  const [branches, setBranches] = useState<ClinicBranch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [loadingVets, setLoadingVets] = useState(false)
  const [surgeryAccordionOpen, setSurgeryAccordionOpen] = useState(true)
  const [createdAppointmentId, setCreatedAppointmentId] = useState('')
  const [showMedicalRecordModal, setShowMedicalRecordModal] = useState(false)

  // Load surgery services on mount
  useEffect(() => {
    if (!open || !token) return
    const loadServices = async () => {
      const res = await getSurgeryServices(token as string)
      if (res.status === 'SUCCESS' && res.data?.items) {
        setSurgeryServices(res.data.items)
      }
    }
    loadServices()
  }, [open, token])

  // Fetch available time slots when date and vet change
  useEffect(() => {
    if (!date || !selectedVetId || !token) {
      setTimeSlots([])
      return
    }
    const fetchSlots = async () => {
      setLoading(true)
      try {
        const res = await getAvailableSlots(selectedVetId, date, token as string, selectedBranchId || undefined)
        if (res.status === 'SUCCESS' && res.data?.slots) {
          setTimeSlots(res.data.slots)
        }
      } catch {
        toast.error('Failed to fetch available slots')
      } finally {
        setLoading(false)
      }
    }
    fetchSlots()
  }, [date, selectedVetId, selectedBranchId, token])

  // Load clinic branches when modal opens
  useEffect(() => {
    if (!open || !token) return
    const loadBranches = async () => {
      setBranchesLoading(true)
      try {
        const res = await getClinicBranches(token as string)
        if (res.status === 'SUCCESS' && res.data) {
          setBranches(res.data)
        }
      } catch (error) {
        toast.error('Failed to load branches')
      } finally {
        setBranchesLoading(false)
      }
    }
    loadBranches()
  }, [open, token])

  // Fetch vets when branch is selected
  useEffect(() => {
    if (!selectedBranchId || !token) {
      setVets([])
      return
    }
    const loadVets = async () => {
      setLoadingVets(true)
      try {
        const res = await getAssignedVets(selectedBranchId, token as string)
        if (res.status === 'SUCCESS' && res.data) {
          setVets(res.data)
        }
      } catch (error) {
        toast.error('Failed to load vets')
      } finally {
        setLoadingVets(false)
      }
    }
    loadVets()
  }, [selectedBranchId, token])

  const handleSubmit = async () => {
    if (!selectedServices.length || !date || !selectedVetId || !selectedSlot) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!token) {
      toast.error('Authentication required')
      return
    }

    setSubmitting(true)
    try {
      const res = await createAppointment(
        {
          petId,
          vetId: selectedVetId,
          clinicId: clinicId || '',
          clinicBranchId: selectedBranchId || '',
          mode: 'face-to-face',
          types: selectedServices,
          date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        },
        token as string
      )

      if (res.status === 'SUCCESS' && res.data?.appointment?._id) {
        toast.success('Surgery appointment scheduled successfully')
        setCreatedAppointmentId(res.data.appointment._id)
        setShowMedicalRecordModal(true)
        // Close the appointment modal but keep it in memory
        onOpenChange(false)
        // Reset form
        setSelectedServices([])
        setDate('')
        setSelectedSlot(null)
      } else {
        toast.error(res.message || 'Failed to schedule appointment')
      }
    } catch (error) {
      toast.error('Failed to schedule appointment')
    } finally {
      setSubmitting(false)
    }
  }

  const minDate = new Date(new Date().setHours(0, 0, 0, 0))

  // Check if a time slot has already passed
  const isPastSlot = (slotStartTime: string): boolean => {
    const today = new Date()
    const todayYmd = today.toISOString().split('T')[0]
    
    // If not today, slot is not in the past
    if (date !== todayYmd) return false
    
    // Compare times
    const [slotHour, slotMin] = slotStartTime.split(':')
    const currentHour = today.getHours()
    const currentMin = today.getMinutes()
    
    const slotTimeInMinutes = parseInt(slotHour) * 60 + parseInt(slotMin)
    const currentTimeInMinutes = currentHour * 60 + currentMin
    
    return slotTimeInMinutes <= currentTimeInMinutes
  }

  // Group time slots by hour
  const slotsByHour: Record<number, TimeSlot[]> = {}
  timeSlots.forEach((s) => {
    const hour = parseInt(s.startTime.split(':')[0])
    if (!slotsByHour[hour]) slotsByHour[hour] = []
    slotsByHour[hour].push(s)
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        <DialogHeader className="px-8 py-6 border-b border-gray-200">
          <DialogTitle className="text-2xl text-[#2C3E2D]">Schedule Surgery</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex gap-8">
            {/* Left side: Form fields */}
            <div className="flex-1 space-y-6">
              {/* First row: Pet info and Branch */}
              <div className="grid grid-cols-2 gap-8">
                {/* Pet Info (read-only display) */}
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Pet</p>
                  <div className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-700">
                    {petName}
                  </div>
                </div>

                {/* Vet Clinic Branch */}
                <Dropdown
                  label="Vet Clinic Branch"
                  value={selectedBranchId}
                  placeholder="Select a branch"
                  options={branches.map((b) => ({
                    value: b._id,
                    label: b.name,
                  }))}
                  onSelect={(val) => {
                    setSelectedBranchId(val)
                    setSelectedVetId('')
                    setSelectedSlot(null)
                    setDate('')
                  }}
                />
              </div>

              {/* Second row: Mode and Vet */}
              <div className="grid grid-cols-2 gap-8">
                {/* Mode of Appointment */}
                <div>
                  <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Mode of Appointment</p>
                  <div className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-700">
                    Face to Face
                  </div>
                </div>

                {/* Chosen Veterinarian */}
                {selectedBranchId ? (
                  loadingVets ? (
                    <div>
                      <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                      <div className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 flex items-center justify-center gap-2 text-gray-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading...</span>
                      </div>
                    </div>
                  ) : (
                    <Dropdown
                      label="Chosen Veterinarian"
                      value={selectedVetId}
                      placeholder="Select a veterinarian"
                      options={vets.map((v) => ({
                        value: v._id,
                        label: `${v.firstName} ${v.lastName}`,
                      }))}
                      onSelect={(val) => {
                        setSelectedVetId(val)
                        setSelectedSlot(null)
                      }}
                    />
                  )
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Chosen Veterinarian</p>
                    <div className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 text-gray-600 text-sm">
                      Select a branch first
                    </div>
                  </div>
                )}
              </div>

              {/* Type of Appointment - Accordion */}
              <div>
                <p className="text-sm font-semibold text-[#2C3E2D] mb-2">Type of Appointment</p>
                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => setSurgeryAccordionOpen(!surgeryAccordionOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#2C3E2D]">Surgery & Advanced Procedures</span>
                      {selectedServices.length > 0 && !surgeryAccordionOpen && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[#5A7C7A] bg-[#7FA5A3]/15 px-2 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" />
                          {selectedServices.length} selected
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        surgeryAccordionOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Accordion body */}
                  {surgeryAccordionOpen && (
                    <div className="px-3 pb-3 pt-1 bg-white space-y-1 border-t border-gray-200">
                      {surgeryServices.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No surgery services available</p>
                      ) : (
                        surgeryServices.map((service) => (
                          <button
                            key={service._id}
                            type="button"
                            onClick={() => {
                              if (selectedServices.includes(service._id)) {
                                setSelectedServices(selectedServices.filter((id) => id !== service._id))
                              } else {
                                setSelectedServices([...selectedServices, service._id])
                              }
                            }}
                            className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2.5 transition-colors ${
                              selectedServices.includes(service._id)
                                ? 'bg-[#7FA5A3]/10 text-[#5A7C7A]'
                                : 'text-[#4F4F4F] hover:bg-gray-100'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                selectedServices.includes(service._id)
                                  ? 'border-[#5A7C7A] bg-[#7FA5A3]'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedServices.includes(service._id) && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{service.name}</p>
                              {service.price && <p className="text-xs text-gray-500">₱{service.price}</p>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Date */}
              <DatePicker
                value={date}
                onChange={(value) => {
                  setDate(value)
                  setSelectedSlot(null)
                }}
                placeholder="Select a date"
                allowFutureDates={true}
                minDate={minDate}
              />
            </div>

            {/* Right side: Time slots */}
            <div className="w-80 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-[#5A7C7A]" />
                <h3 className="text-sm font-semibold text-[#2C3E2D]">Available Times</h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : date && selectedVetId ? (
                timeSlots.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                    <p className="text-xs text-yellow-700">No slots available</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-0.5 max-h-80 pr-1">
                      {Object.entries(slotsByHour)
                        .sort(([hourA], [hourB]) => parseInt(hourA) - parseInt(hourB))
                        .map(([hour, hourSlots]) => (
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
                                const isSelected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
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
                                      if (isAvailable) setSelectedSlot({ startTime: slot.startTime, endTime: slot.endTime })
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
                )
              ) : (
                <p className="text-xs text-gray-500 py-8 text-center">Select vet and date to view times</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 px-8 py-4 flex gap-2 justify-center">
          <button
            onClick={() => onOpenChange(false)}
            className="px-8 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedServices.length || !date || !selectedVetId || !selectedSlot}
            className="flex items-center gap-2 px-8 py-2.5 bg-[#5A7C7A] text-white rounded-full text-sm font-medium hover:bg-[#4a6a6a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Set an appointment
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SurgeryMedicalRecordModal
      open={showMedicalRecordModal}
      onOpenChange={setShowMedicalRecordModal}
      appointmentId={createdAppointmentId}
      petId={petId}
      petName={petName}
      onSaved={() => {
        setShowMedicalRecordModal(false)
        setCreatedAppointmentId('')
      }}
    />
    </>
  )
}
